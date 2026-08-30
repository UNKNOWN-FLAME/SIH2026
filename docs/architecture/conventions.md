# VajraX Architecture Conventions

This document is the authoritative reference for naming, routing, and data
format conventions used throughout VajraX. All services, schemas, and
configuration files must follow these conventions. Changes to conventions
require an ADR.

---

## 1. `station_id` Convention

| Value | Station |
|---|---|
| `"maitri"` | Maitri Research Station, Schirmacher Oasis, Dronning Maud Land |
| `"bharati"` | Bharati Research Station, Larsemann Hills, Prydz Bay |

**Rules:**
- `station_id` is always a lowercase ASCII string.
- No code may hardcode `"maitri"` or `"bharati"` except configuration files and test fixtures.
- All business logic reads `station_id` from context (request, config, message header).
- A third station may be added by adding a new config YAML only — no code changes.
- Validation: any API or service receiving an unknown `station_id` returns **HTTP 404** or rejects the message.

---

## 2. REST API Route Convention

All Cloud API routes follow the pattern:

```
GET    /api/v1/stations/{station_id}/{domain}/{resource}
POST   /api/v1/stations/{station_id}/{domain}/{resource}
PATCH  /api/v1/stations/{station_id}/{domain}/{resource}/{id}
```

Where `{station_id}` must be one of `["maitri", "bharati"]`.

| Response code | Condition |
|---|---|
| **404** | Unknown `station_id` in path |
| **403** | Valid `station_id` but token's `station_scope` does not include it |
| **401** | Missing or expired JWT |

**Edge local API routes** (no `station_id` in path — Edge knows its own identity):
```
GET  /api/v1/local/{domain}/{resource}
```

**Global routes** (not station-scoped):
```
GET  /api/v1/stations             # list all stations with current status
GET  /api/v1/health               # Cloud backend health check
POST /auth/login                  # authentication
POST /auth/refresh                # token refresh
```

---

## 3. MQTT Topic Hierarchy

```
# Device-to-Cloud (Edge publishes, Cloud subscribes)
dt/{station_id}/{domain}/{sensor_id}

# Bulk sync envelopes (all data domains)
dt/{station_id}/sync/{message_type}

# Heartbeat
dt/{station_id}/heartbeat

# Command-to-Device (Cloud publishes, Edge subscribes)
cmd/{station_id}/{service}/{command}
```

**Examples:**
```
dt/maitri/energy/maitri.energy.gen1.fuel_pct
dt/bharati/environment/bharati.environment.fire_z1.state
dt/maitri/sync/sensor_batch
dt/bharati/heartbeat
cmd/maitri/sync_agent/flush_queue
cmd/bharati/config/update_threshold
```

**ACL rules** enforced at the Mosquitto broker level:
- A station client (identified by mTLS CN `{station_id}-sync-agent`) may only:
  - **Publish** to `dt/{own_station_id}/#`
  - **Subscribe** to `cmd/{own_station_id}/#`
- Cross-station publishing is rejected at the broker — a Maitri cert cannot publish to Bharati topics.
- The Cloud receiver uses a broker-internal service account with wildcard subscribe: `dt/+/#`.

---

## 4. `sensor_id` Naming Convention

Format: `{station_id}.{domain}.{asset_id_local}.{metric}`

```
maitri.energy.gen1.fuel_pct
maitri.weather.aws.wind_speed_ms
bharati.environment.fire_z1.state
bharati.environment.ice.thickness_cm
bharati.energy.solar1.output_kw
```

**Rules:**
- All lowercase, dot-separated — no spaces, hyphens, or underscores.
- `asset_id_local` is the short asset identifier (e.g., `gen1`, `aws`, `fire_z1`).
- The full `asset_id` in the asset registry is `{station_id}.{asset_id_local}` (e.g., `maitri.gen1`).
- `sensor_id` is globally unique across the entire system.

---

## 5. `alert_id` Generation

Format: `{station_id}-{domain}-{unix_ms}-{rand_4hex}`

```
maitri-energy-1724745600000-a3f1
bharati-environment-1724749200000-cc82
maitri-weather-1724752800000-f091
```

**Properties:**
- Lexicographically sortable by creation time (unix_ms prefix within station+domain).
- Globally unique across both stations (station_id + random suffix).
- Generated at the Edge at the exact moment the alert is raised.
- Used as the de-duplication key at Cloud ingestion (Redis TTL cache + DB unique check).

**Implementation:** `shared/utils/alert_id.py` — `generate_alert_id(station_id, domain)`.

---

## 6. Timestamp Convention

| Context | Format |
|---|---|
| **Wire (JSON)** | ISO 8601 UTC with Z suffix: `"2026-08-27T09:44:00.000Z"` |
| **Wire (Protobuf)** | `google.protobuf.Timestamp` |
| **Database** | `TIMESTAMPTZ` (PostgreSQL) — always UTC |
| **Python** | `datetime` with `tzinfo=timezone.utc` — never naive |

**Rules:**
- No local time is ever stored in the database.
- `datetime.utcnow()` is **banned** — use `shared.utils.time.utcnow()` which returns a UTC-aware datetime.
- Station local time (for display) is computed by the frontend using the station's `timezone` from config.

---

## 7. Outbound Queue Priority Lanes

| Priority | Payload Type | MQTT QoS | Eviction Policy on Queue Overflow |
|---|---|---|---|
| **0** | Black-box frames | QoS 2 (exactly-once) | **Never evicted** |
| **1** | CRITICAL / HIGH alerts | QoS 2 (exactly-once) | **Never evicted** |
| **2** | MEDIUM / LOW alerts | QoS 1 (at-least-once) | Evicted last (oldest first) |
| **3** | Telemetry batches | QoS 1 (at-least-once) | Evicted first (oldest first) |

Queue overflow policy: when `max_queue_size_bytes` is reached, evict the oldest priority-3 items first, then priority-2, never priority-0 or priority-1.

---

## 8. Protobuf Versioning

- Current version string: `"1.0.0"` (semver).
- All `SyncEnvelope` messages carry `proto_version`.
- The Cloud receiver logs a warning for minor version mismatches and rejects on major version mismatches.
- Breaking schema changes require:
  1. A new proto file revision
  2. A `proto_version` bump
  3. An ADR documenting the migration plan

---

## 9. RBAC Role Hierarchy

| Role | Scope | Key Permissions |
|---|---|---|
| `ADMIN` | Global | All permissions, user management, system config |
| `OPERATOR` | Global or station-scoped | All data read/write, alert resolution, logistics management |
| `STATION_CREW` | Station-scoped (Edge + Cloud) | Local read/write, alert acknowledgement, inventory updates |
| `VIEWER` | Station-scoped or global | Read-only on all data endpoints |

Station-scoped: the user's `station_scope` in `user_roles` restricts their API access to that station's data only. `null` scope means global access to all stations.

---

## 10. Black-Box Hash Chain

```
Frame 0:  prev_hash = SHA-256(trigger_alert_id.encode("utf-8"))
          frame_hash = SHA-256(frame_0_bytes_without_frame_hash_field)

Frame N:  prev_hash = frame_hash of Frame N-1
          frame_hash = SHA-256(frame_N_bytes_without_frame_hash_field)
```

Verification: `shared/crypto/hash_chain.py` — `verify_chain(frames)`.
A broken chain (hash mismatch or missing frame index) must be reported and logged as a tamper event.

---

*Last updated: 2026-08-27 | VajraX Phase 0*
