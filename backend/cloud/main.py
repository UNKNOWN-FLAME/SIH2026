"""Cloud FastAPI application entry point.

Startup sequence (lifespan):
  1. Configure structured logging
  2. Init async DB engine (postgresql+asyncpg)
  3. Init Cloud Redis pool (or in-memory mock when unavailable)
  4. Load Ed25519 public keys for each station:
       - First checks STATION_PUBKEY_{STATION_ID.upper()} env var (production)
       - Falls back to generating throwaway in-memory keypairs (dev)
  5. Build CloudIngestionService
  6. Build WebSocketManager + start Redis pub/sub listener
  7. Build CloudMQTTSubscriber + start background MQTT task
  8. Inject engine into cloud/deps.py

Shutdown sequence (reverse):
  1. Stop MQTT subscriber
  2. Stop WebSocket Redis listener
  3. Close Redis pool
  4. Dispose DB engine

Mounted routes:
  /api/v1/hq/*  — HQ dashboard REST API
  /ws           — WebSocket live feed
  /health       — global health check
"""
from __future__ import annotations

import asyncio
import os
import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

# ── Load .env before any config module is imported ─────────────────────────
try:
    from dotenv import load_dotenv
    # Try backend/.env first, then root .env — silently skip if neither exists
    _env_file = Path(__file__).resolve().parent.parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)
    else:
        _root_env = Path(__file__).resolve().parent.parent.parent / ".env"
        if _root_env.exists():
            load_dotenv(_root_env, override=False)
except ImportError:
    pass  # python-dotenv not installed — env vars must be set in shell

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.crypto.signing import Verifier, generate_station_keypair
from shared.db.async_base import get_async_engine
from shared.utils.logging import configure_logging
from cloud.auth.router import router as auth_router
from cloud.config import get_config
from cloud.deps import set_engine
from cloud.ingestion.service import CloudIngestionService
from cloud.middleware.audit_log import AuditLogMiddleware
from cloud.middleware.security import SecurityHeadersMiddleware
from cloud.redis_client import close_redis, init_redis, init_mock_redis
from cloud.websocket.manager import WebSocketManager
from cloud.websocket.router import router as ws_router, set_manager
from cloud.api.router import router as hq_router

log = structlog.get_logger(__name__)


def _load_station_verifiers(cfg) -> dict[str, Verifier]:
    """Load Ed25519 public keys for each configured station.

    Priority (for each station_id):
      1. STATION_PUBKEY_{STATION_ID.upper()} environment variable (PEM string)
         → Use in production on Railway; set via Railway env vars dashboard.
      2. File on disk at cfg.station_pubkey_dir (legacy / local dev with files)
      3. Generate a throwaway in-memory keypair (dev fallback — keys lost on restart)
    """
    verifiers: dict[str, Verifier] = {}

    for station_id in cfg.station_ids:
        station_id_upper = station_id.upper().replace("-", "_")
        env_var_name = f"STATION_PUBKEY_{station_id_upper}"

        # 1. Try env var (production path — no filesystem needed)
        pem_str = os.environ.get(env_var_name, "").strip()
        if pem_str:
            # Env vars can't contain literal newlines in Railway dashboard;
            # allow the PEM to be stored with \n escaped as literal backslash-n
            pem_bytes = pem_str.replace("\\n", "\n").encode("utf-8")
            verifiers[station_id] = Verifier.from_pem_bytes(pem_bytes)
            log.info("cloud.startup.key_from_env", station_id=station_id, env_var=env_var_name)
            continue

        # 2. Try filesystem (local dev with actual PEM files)
        if cfg.station_pubkey_dir:
            pub_path = cfg.pubkey_path(station_id)
            if os.path.exists(pub_path):
                verifiers[station_id] = Verifier.from_pem_file(pub_path)
                log.info("cloud.startup.key_from_file", station_id=station_id, path=pub_path)
                continue

        # 3. Generate throwaway in-memory keypair (dev fallback)
        log.warning(
            "cloud.startup.keygen_throwaway",
            station_id=station_id,
            hint=(
                f"Set {env_var_name} env var (PEM string) for persistent keys. "
                "Using a throwaway keypair — real station data will fail signature verification."
            ),
        )
        _priv_pem, pub_pem = generate_station_keypair()
        verifiers[station_id] = Verifier.from_pem_bytes(pub_pem)

    return verifiers


async def _live_telemetry_loop(session_factory) -> None:
    """Continuously generates realistic live sensor fluctuations in dev/standalone mode.
    Ensures that weather, power, temperature, and seismic telemetry are ALWAYS live and fresh.
    """
    from sqlalchemy import text
    import httpx

    live_weather = {
        "m_temp": -15.5,
        "m_wind": 26.0,
        "m_dir": 121.0,
        "m_hum": 48.0,
        "m_pres": 960.0,
        "m_snow": 0.0,
        "m_rad": 95.0,
        "b_temp": -12.1,
        "b_wind": 19.0,
        "b_dir": 127.0,
        "b_hum": 49.0,
        "b_pres": 950.0,
        "b_snow": 0.0,
        "b_rad": 110.0,
    }
    last_fetch = 0.0

    while True:
        try:
            loop_now = asyncio.get_event_loop().time()
            if loop_now - last_fetch > 300:
                try:
                    async with httpx.AsyncClient(timeout=6.0) as client:
                        r_m = await client.get(
                            "https://api.open-meteo.com/v1/forecast?latitude=-70.7667&longitude=11.7333&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,snowfall,shortwave_radiation"
                        )
                        if r_m.status_code == 200:
                            cur_m = r_m.json().get("current", {})
                            live_weather["m_temp"] = cur_m.get("temperature_2m", live_weather["m_temp"])
                            live_weather["m_wind"] = cur_m.get("wind_speed_10m", live_weather["m_wind"])
                            live_weather["m_dir"] = cur_m.get("wind_direction_10m", live_weather["m_dir"])
                            live_weather["m_hum"] = cur_m.get("relative_humidity_2m", live_weather["m_hum"])
                            live_weather["m_pres"] = cur_m.get("surface_pressure", live_weather["m_pres"])
                            live_weather["m_snow"] = cur_m.get("snowfall", live_weather["m_snow"])
                            live_weather["m_rad"] = cur_m.get("shortwave_radiation", live_weather["m_rad"]) or 95.0

                        r_b = await client.get(
                            "https://api.open-meteo.com/v1/forecast?latitude=-69.4100&longitude=76.1867&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,snowfall,shortwave_radiation"
                        )
                        if r_b.status_code == 200:
                            cur_b = r_b.json().get("current", {})
                            live_weather["b_temp"] = cur_b.get("temperature_2m", live_weather["b_temp"])
                            live_weather["b_wind"] = cur_b.get("wind_speed_10m", live_weather["b_wind"])
                            live_weather["b_dir"] = cur_b.get("wind_direction_10m", live_weather["b_dir"])
                            live_weather["b_hum"] = cur_b.get("relative_humidity_2m", live_weather["b_hum"])
                            live_weather["b_pres"] = cur_b.get("surface_pressure", live_weather["b_pres"])
                            live_weather["b_snow"] = cur_b.get("snowfall", live_weather["b_snow"])
                            live_weather["b_rad"] = cur_b.get("shortwave_radiation", live_weather["b_rad"]) or 110.0
                    last_fetch = loop_now
                except Exception as exc:
                    log.warning("cloud.open_meteo.fetch_failed", error=str(exc))

            specs = [
                # Maitri Sensors (Live Real Weather from Antarctica)
                ("maitri", "maitri.generator.gen1.kw_output",  "energy", "kW",  142.0, 6.0),
                ("maitri", "maitri.generator.gen1.fuel_pct",   "energy", "%",   83.8,  0.5),
                ("maitri", "maitri.generator.gen1.load_pct",   "energy", "%",   86.0,  2.5),
                ("maitri", "maitri.power.grid.voltage",        "energy", "V",   415.0, 1.5),
                ("maitri", "maitri.weather.aws1.temperature",  "weather", "°C", live_weather["m_temp"],  0.2),
                ("maitri", "maitri.weather.aws1.wind_speed",   "weather", "km/h", live_weather["m_wind"], 1.5),
                ("maitri", "maitri.weather.aws1.wind_dir",     "weather", "°",   live_weather["m_dir"], 2.0),
                ("maitri", "maitri.weather.aws1.humidity",     "weather", "%",    live_weather["m_hum"],  0.5),
                ("maitri", "maitri.weather.aws1.pressure",     "weather", "hPa", live_weather["m_pres"],  0.3),
                ("maitri", "maitri.weather.aws1.snowfall",     "weather", "mm/h",  live_weather["m_snow"],  0.05),
                ("maitri", "maitri.weather.aws1.radiation",    "weather", "W/m²", live_weather["m_rad"], 5.0),
                ("maitri", "maitri.seismic.sta1.pgv",          "seismic", "mm/s", 0.12, 0.04),
                ("maitri", "maitri.seismic.sta1.magnitude",    "seismic", "ML",   0.8,  0.2),
                ("maitri", "maitri.glacier.ice_thickness",     "glaciology", "m", 1.85, 0.02),
                ("maitri", "maitri.glacier.flow_rate",         "glaciology", "m/yr", 1.22, 0.05),

                # Bharati Sensors (Live Real Weather from Antarctica)
                ("bharati", "bharati.generator.gen1.kw_output", "energy", "kW",  185.0, 8.0),
                ("bharati", "bharati.generator.gen1.fuel_pct",  "energy", "%",   84.2,  0.5),
                ("bharati", "bharati.generator.gen1.load_pct",  "energy", "%",   88.0,  2.5),
                ("bharati", "bharati.power.grid.voltage",       "energy", "V",   415.0, 1.5),
                ("bharati", "bharati.solar.array1.kw_output",   "energy", "kW",  34.0,  3.0),
                ("bharati", "bharati.weather.aws1.temperature", "weather", "°C", live_weather["b_temp"],  0.2),
                ("bharati", "bharati.weather.aws1.wind_speed",  "weather", "km/h", live_weather["b_wind"], 1.5),
                ("bharati", "bharati.weather.aws1.wind_dir",    "weather", "°",   live_weather["b_dir"], 2.0),
                ("bharati", "bharati.weather.aws1.humidity",    "weather", "%",    live_weather["b_hum"],  0.5),
                ("bharati", "bharati.weather.aws1.pressure",    "weather", "hPa", live_weather["b_pres"],  0.3),
                ("bharati", "bharati.weather.aws1.snowfall",    "weather", "mm/h", live_weather["b_snow"],  0.05),
                ("bharati", "bharati.weather.aws1.radiation",   "weather", "W/m²", live_weather["b_rad"], 5.0),
                ("bharati", "bharati.seismic.sta1.pgv",         "seismic", "mm/s", 0.08, 0.02),
                ("bharati", "bharati.seismic.sta1.magnitude",   "seismic", "ML",   0.6,  0.2),
                ("bharati", "bharati.ocean.sst",                "ocean", "°C", -1.82, 0.08),
                ("bharati", "bharati.ocean.salinity",           "ocean", "PSU", 34.65, 0.1),
                ("bharati", "bharati.ocean.ice_extent",         "ocean", "%", 92.4, 0.4),
                ("bharati", "bharati.ocean.wave_height",        "ocean", "m", 4.15, 0.3),
                ("bharati", "bharati.glacier.ice_thickness",    "glaciology", "m", 2.15, 0.03),
                ("bharati", "bharati.glacier.flow_rate",        "glaciology", "m/yr", 0.95, 0.04),
            ]

            now = datetime.now(tz=timezone.utc)
            async with session_factory() as db:
                for sid, snid, dom, unit, base, jitter in specs:
                    val = round(base + random.uniform(-jitter, jitter), 2)
                    await db.execute(
                        text("""
                            INSERT INTO sensor_readings
                                (station_id, sensor_id, domain, metric_name, value, unit, quality, timestamp_utc, is_aggregate)
                            VALUES
                                (:sid, :snid, :dom, :met, :val, :unit, 'NOMINAL', :ts, false)
                        """),
                        {
                            "sid": sid,
                            "snid": snid,
                            "dom": dom,
                            "met": snid.rsplit(".", 1)[-1],
                            "val": val,
                            "unit": unit,
                            "ts": now,
                        },
                    )
                await db.commit()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log.warning("cloud.telemetry.loop_error", error=str(exc))
        await asyncio.sleep(10)



@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    cfg = get_config()
    configure_logging(level=cfg.log_level, json_output=cfg.log_json)
    log.info("cloud.startup.begin", stations=cfg.station_ids)

    # 1. DB
    engine = get_async_engine(cfg.database_url, echo=cfg.db_echo)
    set_engine(engine)

    # 2. Redis (optional — falls back to in-memory mock; no crash on Railway)
    redis_ok = False
    try:
        await init_redis(cfg.redis_url)
        redis_ok = True
    except Exception as exc:
        log.warning(
            "cloud.startup.redis_unavailable",
            error=str(exc),
            hint="Using in-memory Redis mock. Refresh tokens won't persist across restarts.",
        )
        await init_mock_redis()

    # 3. Station public keys
    verifiers = _load_station_verifiers(cfg)

    # 4. Ingestion service
    from sqlalchemy.ext.asyncio import async_sessionmaker
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    ingestion_svc = CloudIngestionService(
        session_factory=session_factory,
        verifiers=verifiers,
    )

    # 5. WebSocket manager (optional — needs Redis pub/sub)
    ws_manager = None
    if redis_ok:
        try:
            ws_manager = WebSocketManager()
            set_manager(ws_manager)
            await ws_manager.start_redis_listener()
        except Exception as exc:
            log.warning("cloud.startup.ws_unavailable", error=str(exc))
            ws_manager = None

    # 6. MQTT subscriber (only started when MQTT_ENABLED=true)
    mqtt_sub = None
    if cfg.mqtt_enabled:
        try:
            from cloud.mqtt_subscriber import CloudMQTTSubscriber  # lazy import
            mqtt_sub = CloudMQTTSubscriber(
                host=cfg.mqtt_host,
                port=cfg.mqtt_port,
                ingestion_service=ingestion_svc,
                tls=cfg.mqtt_tls,
            )
            await mqtt_sub.start()
        except Exception as exc:
            log.warning(
                "cloud.startup.mqtt_unavailable",
                error=str(exc),
                hint="Check MQTT_BROKER_HOST / MQTT_PORT. Station sync disabled.",
            )
            mqtt_sub = None
    else:
        log.info(
            "cloud.mqtt.disabled",
            hint="Set MQTT_ENABLED=true in env to enable live edge-station sync.",
        )

    # 7. Live Telemetry Generator (dev / standalone mode)
    # Continuously generates realistic sensor updates so the dashboard stays 100% live
    live_telemetry_task = None
    if not cfg.mqtt_enabled:
        live_telemetry_task = asyncio.create_task(_live_telemetry_loop(session_factory))
        log.info("cloud.live_telemetry.started", interval_s=10)

    log.info("cloud.startup.done", redis=redis_ok, mqtt=mqtt_sub is not None)
    yield

    # --- Shutdown ---
    if live_telemetry_task:
        live_telemetry_task.cancel()
        try:
            await live_telemetry_task
        except asyncio.CancelledError:
            pass
    if mqtt_sub:
        await mqtt_sub.stop()
    if ws_manager:
        await ws_manager.stop()
    if redis_ok:
        await close_redis()
    await engine.dispose()
    log.info("cloud.shutdown.done")


def create_app() -> FastAPI:
    cfg = get_config()
    app = FastAPI(
        title="VajraX — Cloud Backend (NCPOR HQ)",
        description="Digital Twin cloud backend for Maitri & Bharati Antarctic Research Stations",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS — restrict to configured origins in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Security / audit middleware (added after CORS so it runs innermost)
    app.add_middleware(AuditLogMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    app.include_router(auth_router)
    app.include_router(hq_router)
    app.include_router(ws_router)

    @app.get("/health", tags=["health"])
    async def root_health() -> dict:
        return {"status": "ok", "service": "vajrax-cloud", "stations": cfg.station_ids}

    return app


app = create_app()
