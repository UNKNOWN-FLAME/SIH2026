"""Redis client singleton for Edge services.

All Edge services share a single redis.asyncio connection pool.
The pool is initialised once at application startup and closed on shutdown.

Channels used:
  - `sensor:{station_id}:{domain}` — per-domain reading pub/sub
  - `alerts:{station_id}` — alert lifecycle pub/sub (alert engine → black-box)
  - Outbound queue: sorted set key `queue:outbound:{station_id}`
  - Dedup cache:   key `dedup:alert:{station_id}:{rule_id}` with TTL
"""
from __future__ import annotations

from typing import Optional

import redis.asyncio as aioredis
import structlog

log = structlog.get_logger(__name__)

_pool: Optional[aioredis.Redis] = None


async def init_redis(url: str) -> aioredis.Redis:
    """Connect to Redis and store the global pool. Call once at startup."""
    global _pool
    _pool = aioredis.from_url(
        url,
        encoding="utf-8",
        decode_responses=False,  # keep bytes — JSON payloads are encoded manually
        socket_keepalive=True,
        health_check_interval=30,
    )
    # Verify connectivity
    await _pool.ping()
    log.info("edge.redis.connected", url=url)
    return _pool


async def close_redis() -> None:
    """Close the Redis connection pool gracefully."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        log.info("edge.redis.closed")


def get_redis() -> aioredis.Redis:
    """Return the global Redis client (must have called init_redis first)."""
    if _pool is None:
        raise RuntimeError("Redis not initialised — call init_redis() at startup")
    return _pool


# ---------------------------------------------------------------------------
# Channel name helpers
# ---------------------------------------------------------------------------

def sensor_channel(station_id: str, domain: str) -> str:
    return f"sensor:{station_id}:{domain}"


def alerts_channel(station_id: str) -> str:
    return f"alerts:{station_id}"


def queue_key(station_id: str) -> str:
    return f"queue:outbound:{station_id}"


def dedup_key(station_id: str, rule_id: str, sensor_id: str) -> str:
    return f"dedup:alert:{station_id}:{rule_id}:{sensor_id}"
