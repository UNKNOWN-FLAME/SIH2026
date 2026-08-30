"""Cloud service configuration — reads from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List


class CloudConfig:
    """Typed configuration for all Cloud services."""

    station_ids: List[str]
    database_url: str
    db_echo: bool
    redis_url: str

    mqtt_host: str
    mqtt_port: int
    mqtt_tls: bool

    station_pubkey_dir: str       # dir with {station_id}_public.pem
    heartbeat_timeout_minutes: int

    api_host: str
    api_port: int

    log_level: str
    log_json: bool

    def __init__(self) -> None:
        raw_ids = os.environ.get("STATION_IDS", "maitri,bharati")
        self.station_ids = [s.strip().lower() for s in raw_ids.split(",") if s.strip()]

        self.database_url = os.environ.get(
            "DATABASE_URL",
            "postgresql://vajrax_cloud:cloud_secret_dev@localhost:5435/vajrax_cloud",
        )
        self.db_echo = os.environ.get("DB_ECHO", "false").lower() == "true"
        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6382/0")

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
        self.api_port = int(os.environ.get("API_PORT", "8200"))

        self.log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
        self.log_json = os.environ.get("LOG_FORMAT", "json") == "json"

    def pubkey_path(self, station_id: str) -> str:
        return os.path.join(self.station_pubkey_dir, f"{station_id}_public.pem")

    def __repr__(self) -> str:
        return f"CloudConfig(stations={self.station_ids}, db={self.database_url!r})"


@lru_cache(maxsize=1)
def get_config() -> CloudConfig:
    return CloudConfig()
