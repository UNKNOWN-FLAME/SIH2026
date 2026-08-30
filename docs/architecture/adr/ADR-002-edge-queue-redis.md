# ADR-002: Use Redis (AOF) for Edge Outbound Queue Backing Store

**Status:** Accepted
**Date:** 2026-08-27
**Deciders:** VajraX Architecture Team

## Context

The Edge sync agent maintains a persistent outbound queue of messages to be delivered
to the Cloud MQTT broker opportunistically when the satellite link is available.
The queue has four hard requirements:

1. **Crash-safe persistence** — messages must survive Edge service restarts. A CRITICAL alert that was queued before a power cycle must not be lost.
2. **Priority-ordered dequeue** — black-box frames (priority 0) must be sent before routine telemetry (priority 3).
3. **TTL-based expiry** — routine telemetry older than `queue_retention_days` should expire automatically without a manual cleanup job.
4. **Internal pub/sub** — the Edge AI engine publishes anomaly events that the alert engine must consume; an internal message bus avoids a synchronous HTTP call between Edge services.

## Decision

Use **Redis 7** with **AOF (Append-Only File) persistence** as the Edge outbound queue backing store and internal message bus.

- Outbound queue: Redis **Sorted Set** (`ZADD` with priority score as the sort key, message timestamp as tiebreaker).
- Internal anomaly pub/sub: Redis **Pub/Sub** channels (`anomaly:{station_id}:{domain}`).
- Crash safety: AOF with `appendfsync everysec` — at most 1 second of data loss on a hard crash.
- TTL expiry: low-priority queue items stored with Redis `EXPIREAT` set to `created_at + retention_days`.

## Rationale

- **Sorted Set** natively supports priority-ordered dequeue (`ZPOPMIN`) with O(log N) complexity — far more efficient than a table scan on the PostgreSQL `outbound_queue` table for every dequeue operation.
- **Pub/Sub** enables zero-copy, zero-latency internal event delivery between the AI engine and the alert engine without adding HTTP service calls or shared database polling.
- **AOF persistence** provides crash-safe durability. On restart, Redis replays the AOF log and recovers all queued items that were not yet deleted.
- Redis memory footprint for the Edge queue at maximum queue depth is bounded: at 1 MB per SensorBatch message × 1000 items = ~1 GB, which is the configured `max_queue_size_bytes`. In practice, the queue is orders of magnitude smaller during normal operations.

## Alternative Considered

**SQLite-backed queue** using the `outbound_queue` table in the Edge PostgreSQL database.

Rejected because:
- Priority-ordered dequeue requires an indexed table scan on each dequeue — adds latency on the sync hot path.
- No native pub/sub for AI engine → alert engine communication; would require polling or a separate HTTP endpoint.
- Mixing operational queue data with time-series sensor data in one database adds coupling and makes it harder to independently tune each store.

## Consequences

- Redis is a **required infrastructure dependency** at the Edge. The Edge Docker Compose stack includes a `redis` container.
- The Edge startup sequence must wait for Redis to be healthy (`redis-cli ping`) before the sync agent or AI engine starts.
- AOF rewrite (`BGREWRITEAOF`) may cause brief I/O spikes on write-heavy hardware. Configure `auto-aof-rewrite-percentage 100` and `auto-aof-rewrite-min-size 64mb` to limit rewrite frequency.
- The `outbound_queue` PostgreSQL table (in migration `0001`) serves as a **secondary persistence fallback** and audit record, not the primary queue. The sync agent writes to Redis; the DB table is populated for crash-recovery completeness.
