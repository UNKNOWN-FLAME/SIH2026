"""Cloud service configuration — reads from environment variables.

Database URL priority:
  1. CLOUD_DATABASE_URL  (Neon PostgreSQL — preferred)
  2. DATABASE_URL        (generic fallback)
  If neither is set, startup will raise RuntimeError from the DB engine.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List


class CloudConfig:
    """Typed configuration for all Cloud (NCPOR HQ) services."""

    station_ids: List[str]
    database_url: str
    db_echo: bool
    redis_url: str
    jwt_secret: str
    jwt_access_expire_minutes: int
    jwt_refresh_expire_days: int
    mqtt_enabled: bool           # set MQTT_ENABLED=false to suppress broker warnings
    mqtt_host: str
    mqtt_port: int
    mqtt_tls: bool
    station_pubkey_dir: str       # directory containing {station_id}_public.pem
    heartbeat_timeout_minutes: int
    api_host: str
    api_port: int
    log_level: str
    log_json: bool

    def __init__(self) -> None:
        raw_ids = os.environ.get("STATION_IDS", "maitri,bharati")
        self.station_ids = [s.strip().lower() for s in raw_ids.split(",") if s.strip()]

        # Neon URL (CLOUD_DATABASE_URL) takes priority over the generic DATABASE_URL
        db_url = (
            os.environ.get("CLOUD_DATABASE_URL")
            or os.environ.get("DATABASE_URL")
        )
        if not db_url:
            raise RuntimeError(
                "No cloud database URL configured. "
                "Set CLOUD_DATABASE_URL in your .env file."
            )
        self.database_url = db_url
        self.db_echo = os.environ.get("DB_ECHO", "false").lower() == "true"

        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

        self.jwt_secret = os.environ.get("CLOUD_JWT_SECRET", "")
        if not self.jwt_secret:
            raise RuntimeError(
                "CLOUD_JWT_SECRET is not set. Run `make keygen-cloud-jwt` "
                "and add the result to your .env file."
            )
        self.jwt_access_expire_minutes = int(
            os.environ.get("JWT_ACCESS_EXPIRE_MINUTES", "60")
        )
        self.jwt_refresh_expire_days = int(
            os.environ.get("JWT_REFRESH_EXPIRE_DAYS", "7")
        )

        self.mqtt_enabled = os.environ.get("MQTT_ENABLED", "false").lower() == "true"
        self.mqtt_host = os.environ.get("MQTT_HOST", "localhost")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
        self.mqtt_tls = os.environ.get("MQTT_TLS", "false").lower() == "true"

        self.station_pubkey_dir = os.environ.get(
            "STATION_PUBKEY_DIR", "infra/certs/stations"
        )
        self.heartbeat_timeout_minutes = int(
            os.environ.get("HEARTBEAT_TIMEOUT_MINUTES", "15")
        )

        self.api_host = os.environ.get("API_HOST", "0.0.0.0")
        self.api_port = int(os.environ.get("CLOUD_API_PORT", "8200"))

        self.log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
        self.log_json = os.environ.get("LOG_FORMAT", "json") == "json"

    def pubkey_path(self, station_id: str) -> str:
        """Absolute path to the Ed25519 public key for a given station."""
        return os.path.join(self.station_pubkey_dir, f"{station_id}_public.pem")

    def __repr__(self) -> str:
        # Mask credentials in repr to avoid leaking to logs
        safe_db = self.database_url.split("@")[-1] if "@" in self.database_url else "…"
        return f"CloudConfig(stations={self.station_ids}, db=…@{safe_db})"


@lru_cache(maxsize=1)
def get_config() -> CloudConfig:
    """Return the singleton CloudConfig (initialised once, cached thereafter)."""
    return CloudConfig()
