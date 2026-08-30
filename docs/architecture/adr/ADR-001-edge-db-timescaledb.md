# ADR-001: Use TimescaleDB for Edge Time-Series Storage

**Status:** Accepted
**Date:** 2026-08-27
**Deciders:** VajraX Architecture Team

## Context

The Edge Backend must store full-resolution sensor readings locally at each station.
Sensors produce data at rates from 1 Hz (energy/fire sensors, 1 reading/10s) down to
0.017 Hz (weather, 1 reading/60s). Over the 7-day local retention window, this generates
approximately 600K–1M rows per station.

The store must efficiently support:
1. **Time-range queries** — the black-box logger needs the last 5 minutes of readings for all sensors, triggered at alert time.
2. **Continuous aggregates** — 1-minute averages pre-computed for the sync agent (to avoid computing them on every sync cycle).
3. **Automatic data expiry** — 7-day retention with no manual cleanup job.
4. **Shared toolchain** — reuse the same ORM (SQLAlchemy) and migrations (Alembic) as other tables.

## Decision

Use **TimescaleDB** (a PostgreSQL extension) as the Edge time-series database.

The `sensor_readings` table is converted to a TimescaleDB **hypertable** partitioned by `timestamp_utc` with a 1-hour chunk interval. A **continuous aggregate** (`sensor_readings_1min`) pre-computes 1-minute averages. A **retention policy** automatically drops chunks older than 7 days.

## Rationale

- Hypertables provide automatic time-based partitioning, keeping time-range queries fast as the dataset grows — without manual partition management.
- Continuous aggregates compute 1-minute summaries asynchronously in the background, making sync agent reads instant (no aggregation at query time on the satellite-sync hot path).
- The retention policy (`add_retention_policy`) is a single SQL call; no application-level cleanup job is needed.
- Running on PostgreSQL means one SQLAlchemy `Base`, one Alembic migration chain, and one `psycopg2` driver across all Edge tables — no additional ORM or driver to learn.

## Alternative Considered

**SQLite with a time-series extension (CR-SQLite or sqlite-zstd-vfs).** Rejected because:
- No native continuous aggregates (1-min pre-aggregation would require a background Python job).
- No built-in retention policies.
- `TIMESTAMPTZ` support in SQLite is limited (timezone handling is application-level).

## Consequences

- TimescaleDB requires PostgreSQL 15+ as its base engine, which uses ~50–100 MB RAM at baseline. Station hardware must be capable of running PostgreSQL comfortably (any modern server/workstation can).
- The `sensor_readings` table must exist **before** the `create_hypertable()` call in migration `0001`. Order-sensitive — do not rearrange.
- If a future station runs on genuinely resource-constrained hardware (Raspberry Pi class, <512 MB RAM), this ADR should be revisited in favour of a SQLite-based approach.
- Black-box pre-event queries (`SELECT * FROM sensor_readings WHERE timestamp_utc >= now() - interval '5 minutes'`) are efficient because the 1-hour chunk containing the last 5 minutes is already in memory.
