# VajraX — Deployment Guide

**Project:** Digital Twin: Antarctic Research Stations — Remote Management Platform  
**Problem Statement:** SIH 2026 PS-26060 | Ministry of Earth Sciences (MoES) / NCPOR  
**Internal codename:** VajraX

---

## Architecture Overview

```
Antarctic Station (Maitri/Bharati)          NCPOR HQ, Goa
┌─────────────────────────────┐             ┌──────────────────────────────┐
│  Simulator (PhaseX)         │             │  Cloud Backend               │
│  ├── StationSimulator       │             │  ├── FastAPI (port 8200)      │
│  └── LinkSimulator          │             │  ├── PostgreSQL/TimescaleDB   │
│                             │  MQTT/TLS   │  ├── Redis                   │
│  Edge Backend               │◄──────────►│  ├── Mosquitto MQTT           │
│  ├── FastAPI (port 8100)    │  Satellite  │  ├── MinIO (black-box frames) │
│  ├── TimescaleDB            │             │  └── WebSocket dashboard      │
│  ├── Redis                  │             └──────────────────────────────┘
│  └── SyncAgent              │
└─────────────────────────────┘
```

---

## Quick Start — Local Development

### Prerequisites

- Python 3.12+
- Docker Desktop (for DBs, Redis, MQTT, MinIO)
- `make` (GNU Make)

### 1. Clone and set up Python environment

```bash
git clone <repo-url> VajraX
cd VajraX
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. Start infrastructure

```bash
make dev
```

This starts:
- `postgres-edge-maitri` on port 5433
- `postgres-edge-bharati` on port 5434
- `postgres-cloud` on port 5435
- `redis-maitri` on port 6380
- `redis-bharati` on port 6381
- `redis-cloud` on port 6382
- `mosquitto-cloud` on ports 1883 / 8883
- `minio` on port 9000

### 3. Apply DB migrations

```bash
make migrate-all
```

### 4. Generate dev keypairs

```bash
make keygen-dev-all
# → writes keys/maitri_private.pem  keys/maitri_public.pem
# → writes keys/bharati_private.pem  keys/bharati_public.pem
```

### 5. Start Edge backends (two terminals)

```bash
# Maitri Edge
STATION_ID=maitri \
DATABASE_URL=postgresql+asyncpg://vajrax_edge:edge_secret_dev@localhost:5433/vajrax_edge \
REDIS_URL=redis://localhost:6380/0 \
STATION_CONFIG_PATH=edge/config/maitri.yaml \
uvicorn edge.main:app --host 0.0.0.0 --port 8100 --reload

# Bharati Edge (separate terminal)
STATION_ID=bharati \
DATABASE_URL=postgresql+asyncpg://vajrax_edge:edge_secret_dev@localhost:5434/vajrax_edge \
REDIS_URL=redis://localhost:6381/0 \
STATION_CONFIG_PATH=edge/config/bharati.yaml \
uvicorn edge.main:app --host 0.0.0.0 --port 8101 --reload
```

### 6. Start Cloud backend

```bash
DATABASE_URL=postgresql+asyncpg://vajrax_cloud:cloud_secret_dev@localhost:5435/vajrax_cloud \
REDIS_URL=redis://localhost:6382/0 \
CLOUD_JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))") \
uvicorn cloud.main:app --host 0.0.0.0 --port 8200 --reload
```

### 7. Start the simulator

```bash
python -m simulator.main
```

---

## Docker Compose Full Stack

```bash
docker compose -f infra/compose/docker-compose.dev.yml up
```

Services and ports:

| Service | Host Port |
|---|---|
| edge-maitri | 8100 |
| edge-bharati | 8101 |
| cloud | 8200 |
| postgres-edge-maitri | 5433 |
| postgres-edge-bharati | 5434 |
| postgres-cloud | 5435 |
| redis-maitri | 6380 |
| redis-bharati | 6381 |
| redis-cloud | 6382 |
| mosquitto (plain) | 1883 |
| mosquitto (TLS) | 8883 |
| toxiproxy (link sim) | 18883/18884 |
| minio | 9000 |

---

## Running Tests

```bash
make test-all          # unit + integration (373 tests)
make test-unit         # unit only (260 tests)
make test-integration  # integration only (113 tests)
```

---

## Key Generation

### Edge API Keys (offline, pre-provisioned)

Keys live in station YAML config (`local_api_keys`). Generate new keys:

```bash
# CREW level key
make keygen-edge-apikey ROLE=CREW

# OPERATOR level key
make keygen-edge-apikey ROLE=OPERATOR

# ADMIN level key
make keygen-edge-apikey ROLE=ADMIN
```

Output: `ROLE.hex_secret` — paste into the station's `local_api_keys` block in YAML.

**Rotation:** Update YAML → `docker-compose restart edge`. No service disruption for sensors.

### Cloud JWT Secret

```bash
make keygen-cloud-jwt
# → CLOUD_JWT_SECRET=<64-char-hex>
```

Set this as a Docker secret or in Kubernetes Secret. Never commit to git.

### Ed25519 Station Keypairs

```bash
make keygen-edge STATION=maitri
# → keys/maitri_private.pem  (stays at Edge)
# → keys/maitri_public.pem   (copy to Cloud CLOUD_PUBKEY_DIR)
```

---

## API Quick Reference

### Edge API (per station)

Base URL: `http://<station-ip>:8100/api/v1/local`  
Auth: `Authorization: Bearer ROLE.hex_secret`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | CREW+ | Station status summary |
| GET | `/alerts` | CREW+ | List active alerts |
| GET | `/alerts/{id}` | CREW+ | Single alert detail |
| PATCH | `/alerts/{id}/acknowledge` | OPERATOR+ | Acknowledge alert |
| PATCH | `/alerts/{id}/resolve` | OPERATOR+ | Manually resolve alert |
| GET | `/sensors/latest` | CREW+ | Latest sensor readings |
| GET | `/sensors/{id}/history` | CREW+ | Sensor time-series |
| GET | `/inventory` | CREW+ | Inventory items |
| PATCH | `/inventory/{id}` | OPERATOR+ | Update inventory item |
| GET | `/health` | — | Health check (no auth) |

### Cloud HQ API

Base URL: `http://<hq-server>:8200`  
Auth: `Authorization: Bearer <JWT>`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/token` | — | Login → JWT + refresh token |
| POST | `/api/v1/auth/refresh` | — | Exchange refresh token |
| POST | `/api/v1/auth/logout` | — | Revoke refresh token |
| GET | `/api/v1/auth/me` | Any | Current user info |
| GET | `/api/v1/hq/dashboard` | Any | Summary for all stations |
| GET | `/api/v1/hq/{station_id}/status` | Any | Station connection status |
| GET | `/api/v1/hq/{station_id}/alerts` | Any | Alert list |
| PATCH | `/api/v1/hq/alerts/{id}/acknowledge` | OPERATOR+ | Acknowledge from HQ |
| GET | `/api/v1/hq/{station_id}/sensors/summary` | Any | Sensor summaries |
| GET | `/api/v1/hq/{station_id}/analytics` | Any | Analytics data |
| GET | `/ws` | JWT in query param | WebSocket live data |

---

## Security

See [`docs/architecture/ADR-004-security.md`](ADR-004-security.md) for the full security decision record.

Key points:
- Edge: offline pre-provisioned API keys (`ROLE.hex_secret`)  
- Cloud: HS256 JWT (1h) + Redis-backed opaque refresh tokens (7d)
- MQTT: Ed25519 signed + zstd compressed SyncEnvelopes
- All API responses: HSTS, CSP, X-Frame-Options: DENY, no-cache

---

## Production Checklist

- [ ] Replace `CLOUD_JWT_SECRET` dev default with `make keygen-cloud-jwt` output
- [ ] Enable MQTT TLS (`MQTT_USE_TLS=true`) and provision mTLS certs
- [ ] Copy public keys to Cloud (`CLOUD_PUBKEY_DIR`)
- [ ] Set `LOG_FORMAT=json` and ship logs to SIEM
- [ ] Apply DB migrations in production: `make migrate-all`
- [ ] Upgrade JWT to RS256 with HSM key (ADR-004, open item)
- [ ] Configure Prometheus scrape targets (`/metrics` endpoints)
- [ ] Enable MinIO bucket versioning for black-box frame retention
- [ ] Set Mosquitto ACL to restrict topics per station client cert
