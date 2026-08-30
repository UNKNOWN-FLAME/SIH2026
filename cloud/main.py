"""Cloud FastAPI application entry point.

Startup sequence (lifespan):
  1. Configure structured logging
  2. Init async DB engine (postgresql+asyncpg)
  3. Init Cloud Redis pool
  4. Load Ed25519 public keys for each station from STATION_PUBKEY_DIR
     (generates dev keypairs if files don't exist)
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

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.crypto.signing import Signer, Verifier, generate_station_keypair
from shared.db.async_base import get_async_engine
from shared.utils.logging import configure_logging
from cloud.auth.router import router as auth_router
from cloud.config import get_config
from cloud.deps import set_engine
from cloud.ingestion.service import CloudIngestionService
from cloud.middleware.audit_log import AuditLogMiddleware
from cloud.middleware.security import SecurityHeadersMiddleware
from cloud.mqtt_subscriber import CloudMQTTSubscriber
from cloud.redis_client import close_redis, init_redis, init_mock_redis
from cloud.websocket.manager import WebSocketManager
from cloud.websocket.router import router as ws_router, set_manager
from cloud.api.router import router as hq_router

log = structlog.get_logger(__name__)


def _ensure_station_keys(cfg) -> dict[str, Verifier]:
    """Load or generate Ed25519 keypairs for each configured station.

    In production, private keys are stored on the station hardware.
    In dev, we generate a throwaway keypair and persist the public key.
    """
    os.makedirs(cfg.station_pubkey_dir, exist_ok=True)
    verifiers: dict[str, Verifier] = {}
    for station_id in cfg.station_ids:
        pub_path = cfg.pubkey_path(station_id)
        priv_path = pub_path.replace("_public.pem", "_private.pem")
        if not os.path.exists(pub_path):
            log.warning(
                "cloud.startup.keygen_dev",
                station_id=station_id,
                pub_path=pub_path,
            )
            priv_pem, pub_pem = generate_station_keypair()
            os.makedirs(os.path.dirname(pub_path), exist_ok=True)
            with open(pub_path, "wb") as f:
                f.write(pub_pem)
            with open(priv_path, "wb") as f:
                f.write(priv_pem)
        verifiers[station_id] = Verifier.from_pem_file(pub_path)
        log.info("cloud.startup.key_loaded", station_id=station_id)
    return verifiers


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    cfg = get_config()
    configure_logging(level=cfg.log_level, json_output=cfg.log_json)
    log.info("cloud.startup.begin", stations=cfg.station_ids)

    # 1. DB
    engine = get_async_engine(cfg.database_url, echo=cfg.db_echo)
    set_engine(engine)

    # 2. Redis (optional — falls back to in-memory mock for local dev)
    redis_ok = False
    try:
        await init_redis(cfg.redis_url)
        redis_ok = True
    except Exception as exc:
        log.warning("cloud.startup.redis_unavailable", error=str(exc),
                    hint="Using in-memory Redis mock. Refresh tokens won't persist across restarts.")
        await init_mock_redis()

    # 3. Station public keys
    verifiers = _ensure_station_keys(cfg)

    # 4. Ingestion service
    from sqlalchemy.ext.asyncio import async_sessionmaker
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    ingestion_svc = CloudIngestionService(
        session_factory=session_factory,
        verifiers=verifiers,
    )

    # 5. WebSocket manager (optional — needs Redis)
    ws_manager = None
    if redis_ok:
        try:
            ws_manager = WebSocketManager()
            set_manager(ws_manager)
            await ws_manager.start_redis_listener()
        except Exception as exc:
            log.warning("cloud.startup.ws_unavailable", error=str(exc))
            ws_manager = None

    # 6. MQTT subscriber (optional — degrades gracefully)
    mqtt_sub = None
    try:
        mqtt_sub = CloudMQTTSubscriber(
            host=cfg.mqtt_host,
            port=cfg.mqtt_port,
            ingestion_service=ingestion_svc,
            tls=cfg.mqtt_tls,
        )
        await mqtt_sub.start()
    except Exception as exc:
        log.warning("cloud.startup.mqtt_unavailable", error=str(exc),
                    hint="Start Mosquitto or set MQTT_HOST. Station sync disabled.")
        mqtt_sub = None

    log.info("cloud.startup.done", redis=redis_ok, mqtt=mqtt_sub is not None)
    yield

    # --- Shutdown ---
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
    # Middleware — added last-to-first (outer → inner execution order)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuditLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_router)
    app.include_router(hq_router)
    app.include_router(ws_router)

    @app.get("/health", tags=["health"])
    async def root_health() -> dict:
        return {"status": "ok", "service": "vajrax-cloud", "stations": cfg.station_ids}

    return app


app = create_app()
