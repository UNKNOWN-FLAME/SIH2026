# VajraX — Digital Twin: Antarctic Research Stations
### Remote Management Platform | NCPOR / MoES
**Smart India Hackathon 2026 | Problem Statement 26060**

---

## Overview

VajraX is a **dual-backend digital twin** for India's two permanent Antarctic research stations — **Maitri** (Schirmacher Oasis, Dronning Maud Land) and **Bharati** (Larsemann Hills, Prydz Bay) — built for the National Centre for Polar and Ocean Research (NCPOR) under the Ministry of Earth Sciences (MoES). It provides NCPOR operators at headquarters in Goa with a continuously updated, authoritative virtual replica of each station's physical state — spanning energy systems, environmental sensors, infrastructure, logistics, and crew safety alerts — while ensuring that on-site crews retain full operational awareness and automatic safety response capability even when the satellite link to HQ is completely unavailable.

**Hard constraint:** crew safety at the station must never depend on the satellite link being up.

---

## High-Level Architecture

The system has three logical tiers connected by an opportunistic VSAT satellite link:

```
┌─────────────────────────────────────────────────────────┐
│  STATION EDGE  (runs locally at Maitri / Bharati)        │
│                                                          │
│  Sensor Simulator ──► Ingestion Service                  │
│                              │                           │
│                       TimescaleDB (local)                │
│                              │                           │
│               ┌──────────────┴──────────────┐            │
│               │                             │            │
│         Edge AI Engine             Alert Engine          │
│         (anomaly detect)           (threshold rules)     │
│               │                             │            │
│               └──────────────┬──────────────┘            │
│                        Black-Box Logger                  │
│                              │                           │
│                     Outbound Sync Queue ◄── priority     │
│                         (Redis AOF)         lanes        │
│                              │                           │
│                    Edge Local API (FastAPI)               │
└──────────────────────────────┼──────────────────────────┘
                               │
                  ╔════════════╧══════════════╗
                  ║   SATELLITE LINK (VSAT)   ║
                  ║  MQTT over TLS 1.3 / mTLS ║
                  ║  QoS 2 (critical alerts)  ║
                  ║  QoS 1 (telemetry)        ║
                  ╚════════════╤══════════════╝
                               │
┌──────────────────────────────┼──────────────────────────┐
│  CLOUD BACKEND  (NCPOR HQ, Goa)                          │
│               Cloud MQTT Broker (Mosquitto)              │
│               Ingestion & Verification Service           │
│        TimescaleDB (cloud) + PostgreSQL                  │
│                    Cloud AI Engine                       │
│                  Cloud Public API (FastAPI)               │
│              REST + WebSocket — station_id-scoped        │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| API Framework | FastAPI + Uvicorn |
| Edge/Cloud DB | TimescaleDB (PostgreSQL 16) |
| ORM & Migrations | SQLAlchemy 2 + Alembic |
| Edge Queue | Redis 7 (AOF persistence) |
| Cloud Object Store | MinIO (S3-compatible) |
| Messaging | Eclipse Mosquitto (MQTT 5) via gmqtt |
| Transport Security | TLS 1.3 + mTLS (per-station certificates) |
| Serialization | Protocol Buffers (proto3) via betterproto |
| Compression | zstd |
| Auth | JWT (python-jose) + bcrypt passwords |
| Signing | Ed25519 (cryptography library) |
| Monitoring | Prometheus metrics + structlog |
| Dev Infrastructure | Docker + Docker Compose |

---

## Repository Structure

```
vajrax/
├── proto/                    Protocol Buffer schema definitions
│   ├── enums.proto           Shared enumerations (Severity, Domain, etc.)
│   ├── sensor.proto          SensorReading, SensorBatch
│   ├── alert.proto           Alert, AlertAck
│   ├── blackbox.proto        BlackBoxFrame
│   ├── logistics.proto       InventoryItem, InventorySnapshot
│   └── sync.proto            SyncEnvelope, LinkHeartbeat
│
├── edge/                     Edge Backend (runs at each station)
│   ├── ingestion/            Sensor ingestion service
│   ├── ai_engine/            Local anomaly detection
│   ├── alert_engine/         Threshold rule evaluation & local alerting
│   ├── black_box/            Critical event logger (append-only, hash-chained)
│   ├── sync_agent/           MQTT outbound queue & link manager
│   ├── api/                  Edge local REST API (FastAPI)
│   └── config/               Station-specific config (maitri.yaml, bharati.yaml)
│
├── cloud/                    Cloud Backend (runs at NCPOR HQ)
│   ├── receiver/             MQTT ingestion & signature verification
│   ├── ai_engine/            Predictive analytics (fuel, logistics)
│   ├── api/                  Cloud public REST + WebSocket API
│   └── config/               Cloud-side configuration
│
├── simulator/                Mock Sensor / IoT Simulation Layer
│   ├── station_sim/          Per-station sensor data generator
│   ├── link_sim/             Satellite link outage/degradation simulator
│   └── scenarios/            Named test scenarios (YAML)
│
├── shared/                   Code shared by Edge and Cloud
│   ├── schemas/              Pydantic models + generated Protobuf bindings
│   ├── crypto/               Signing & verification utilities
│   ├── db/                   SQLAlchemy models + Alembic migrations
│   └── utils/                Logging, config loading, time helpers
│
├── infra/                    Infrastructure as configuration
│   ├── compose/              Docker Compose files (dev, test)
│   ├── docker/               Dockerfiles + service configs (Mosquitto, etc.)
│   └── certs/dev/            Dev-only self-signed certs for mTLS
│
├── tests/                    Automated test suite
│   ├── unit/                 Unit tests per service
│   ├── integration/          Cross-service integration tests
│   └── e2e/                  Full outage-then-reconnect e2e scenarios
│
├── docs/                     Documentation
│   ├── PRD.md                Product Requirements Document
│   ├── architecture/         ADRs and convention documents
│   └── api/                  OpenAPI specs (auto-generated)
│
├── pyproject.toml            Root project configuration and dependencies
├── Makefile                  Convenience targets (dev, migrate, test, etc.)
└── README.md                 This file
```

---

## The `station_id` Convention

Every entity in the system carries a `station_id` field:

| Value | Station |
|---|---|
| `"maitri"` | Maitri Research Station, Schirmacher Oasis, Dronning Maud Land |
| `"bharati"` | Bharati Research Station, Larsemann Hills, Prydz Bay |

Applied consistently across: all Protobuf messages, all database rows, all REST routes (`/api/v1/stations/{station_id}/...`), all MQTT topics (`dt/{station_id}/...`), and all Docker service configurations (`STATION_ID` env var).

**Rule:** No code hardcodes `"maitri"` or `"bharati"` — only configuration files and test fixtures.

---

## Local Development Setup

> **[To be completed after Phase 0 verification.]**

### Prerequisites
- Docker & Docker Compose v2
- Python 3.12
- `make`
- `openssl` (for certificate generation)
- `protoc` + `grpcio-tools` (for `make proto-gen`)

### Quick Start

```bash
# 1. Generate dev TLS certificates (one-time)
make certs

# 2. Start all infrastructure (databases, Redis, Mosquitto, MinIO)
make dev

# 3. Run database migrations
make migrate-all

# 4. Generate Protobuf Python bindings
make proto-gen

# 5. Run tests
make test
```

### Environment Variables

Each service reads its configuration from environment variables and/or the station config YAML.
See `edge/config/maitri.yaml` and `edge/config/bharati.yaml` for station-specific configuration.

Key environment variables:
- `STATION_ID` — `maitri` or `bharati` (required for Edge services)
- `DATABASE_URL` — PostgreSQL connection URL
- `REDIS_URL` — Redis connection URL (Edge only)
- `MQTT_BROKER_HOST` — Cloud MQTT broker hostname
- `MQTT_BROKER_PORT` — default `8883` (TLS)
- `MIGRATION_TARGET` — `edge` or `cloud` (for Alembic)

---

## Project Name

**VajraX** — *Vajra* (वज्र), the indestructible thunderbolt of Indra, reflects the system's design philosophy: resilient, self-sufficient at the edge, and always operational regardless of external conditions.