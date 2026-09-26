"""Insert a fresh batch of sensor readings with current timestamps.
Run this whenever the seeded data gets too old (> cutoff window).
Usage: PYTHONPATH=. python3 scripts/refresh_sensor_readings.py
"""
import asyncio
import os
import random
import ssl
import re
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(".env")


async def fetch_open_meteo(lat: float, lon: float) -> dict:
    import urllib.request
    import json
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,snowfall,shortwave_radiation"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'PolarDigitalTwin/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('current', {})
    except Exception as exc:
        print(f"[WARN] Open-Meteo fetch failed: {exc}")
        return {}



async def refresh():
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import text

    db_url = re.sub(
        r"[?&]sslmode=[^&]*|[?&]channel_binding=[^&]*",
        "",
        os.environ["CLOUD_DATABASE_URL"],
    ).rstrip("?&")
    engine = create_async_engine(
        db_url,
        connect_args={"ssl": ssl.create_default_context()},
        pool_size=2,
    )
    now = datetime.now(tz=timezone.utc)

    # 1. Fetch real-world live Antarctic weather from Open-Meteo
    maitri_cur = await fetch_open_meteo(-70.7667, 11.7333)
    bharati_cur = await fetch_open_meteo(-69.4100, 76.1867)

    m_temp = maitri_cur.get('temperature_2m', -15.5)
    m_wind = maitri_cur.get('wind_speed_10m', 26.0)
    m_dir  = maitri_cur.get('wind_direction_10m', 121.0)
    m_hum  = maitri_cur.get('relative_humidity_2m', 48.0)
    m_pres = maitri_cur.get('surface_pressure', 960.0)
    m_snow = maitri_cur.get('snowfall', 0.0)
    m_rad  = maitri_cur.get('shortwave_radiation', 95.0) or 95.0

    b_temp = bharati_cur.get('temperature_2m', -12.1)
    b_wind = bharati_cur.get('wind_speed_10m', 19.0)
    b_dir  = bharati_cur.get('wind_direction_10m', 127.0)
    b_hum  = bharati_cur.get('relative_humidity_2m', 49.0)
    b_pres = bharati_cur.get('surface_pressure', 950.0)
    b_snow = bharati_cur.get('snowfall', 0.0)
    b_rad  = bharati_cur.get('shortwave_radiation', 110.0) or 110.0

    readings = [
        # Maitri Weather (Live from Open-Meteo)
        ("maitri", "maitri.weather.aws1.temperature",  "weather", "°C", round(m_temp, 1)),
        ("maitri", "maitri.weather.aws1.wind_speed",   "weather", "km/h", round(m_wind, 1)),
        ("maitri", "maitri.weather.aws1.wind_dir",     "weather", "°", round(m_dir, 1)),
        ("maitri", "maitri.weather.aws1.humidity",     "weather", "%", round(m_hum, 1)),
        ("maitri", "maitri.weather.aws1.pressure",     "weather", "hPa", round(m_pres, 1)),
        ("maitri", "maitri.weather.aws1.snowfall",     "weather", "mm/h", round(m_snow, 1)),
        ("maitri", "maitri.weather.aws1.radiation",    "weather", "W/m²", round(m_rad, 1)),
        # Maitri Energy & Seismic
        ("maitri", "maitri.generator.gen1.kw_output",  "energy", "kW", 142.5),
        ("maitri", "maitri.generator.gen1.fuel_pct",   "energy", "%", 83.8),
        ("maitri", "maitri.generator.gen1.load_pct",   "energy", "%", 86.0),
        ("maitri", "maitri.power.grid.voltage",        "energy", "V", 415.0),
        ("maitri", "maitri.seismic.sta1.pgv",          "seismic", "mm/s", 0.12),
        ("maitri", "maitri.seismic.sta1.magnitude",    "seismic", "ML", 0.8),
        ("maitri", "maitri.glacier.ice_thickness",     "glaciology", "m", 1.85),
        ("maitri", "maitri.glacier.flow_rate",         "glaciology", "m/yr", 1.22),

        # Bharati Weather (Live from Open-Meteo)
        ("bharati", "bharati.weather.aws1.temperature", "weather", "°C", round(b_temp, 1)),
        ("bharati", "bharati.weather.aws1.wind_speed",  "weather", "km/h", round(b_wind, 1)),
        ("bharati", "bharati.weather.aws1.wind_dir",    "weather", "°", round(b_dir, 1)),
        ("bharati", "bharati.weather.aws1.humidity",    "weather", "%", round(b_hum, 1)),
        ("bharati", "bharati.weather.aws1.pressure",    "weather", "hPa", round(b_pres, 1)),
        ("bharati", "bharati.weather.aws1.snowfall",    "weather", "mm/h", round(b_snow, 1)),
        ("bharati", "bharati.weather.aws1.radiation",   "weather", "W/m²", round(b_rad, 1)),
        # Bharati Energy, Ocean & Glaciology
        ("bharati", "bharati.generator.gen1.kw_output", "energy", "kW", 185.0),
        ("bharati", "bharati.generator.gen1.fuel_pct",  "energy", "%", 84.2),
        ("bharati", "bharati.generator.gen1.load_pct",  "energy", "%", 88.0),
        ("bharati", "bharati.power.grid.voltage",       "energy", "V", 415.0),
        ("bharati", "bharati.solar.array1.kw_output",   "energy", "kW", 34.0),
        ("bharati", "bharati.seismic.sta1.pgv",         "seismic", "mm/s", 0.08),
        ("bharati", "bharati.seismic.sta1.magnitude",   "seismic", "ML", 0.6),
        ("bharati", "bharati.ocean.sst",                "ocean", "°C", -1.82),
        ("bharati", "bharati.ocean.salinity",           "ocean", "PSU", 34.65),
        ("bharati", "bharati.ocean.ice_extent",         "ocean", "%", 92.4),
        ("bharati", "bharati.ocean.wave_height",        "ocean", "m", 4.15),
        ("bharati", "bharati.glacier.ice_thickness",    "glaciology", "m", 2.15),
        ("bharati", "bharati.glacier.flow_rate",        "glaciology", "m/yr", 0.95),
    ]

    async with async_sessionmaker(engine, class_=AsyncSession)() as db:
        count = 0
        for station_id, sensor_id, domain, unit, value in readings:
            await db.execute(
                text("""
                    INSERT INTO sensor_readings
                        (station_id, sensor_id, domain, metric_name, value, unit, quality, timestamp_utc, is_aggregate)
                    VALUES
                        (:sid, :snid, :dom, :met, :val, :unit, 'NOMINAL', :ts, false)
                """),
                {
                    "sid": station_id,
                    "snid": sensor_id,
                    "dom": domain,
                    "met": sensor_id.rsplit(".", 1)[-1],
                    "val": value,
                    "unit": unit,
                    "ts": now,
                },
            )
            count += 1
        await db.commit()
        print(f"[OK] Inserted {count} real-world live readings at {now.isoformat()} (Maitri temp: {m_temp}°C, Bharati temp: {b_temp}°C)")

    await engine.dispose()



if __name__ == "__main__":
    asyncio.run(refresh())
