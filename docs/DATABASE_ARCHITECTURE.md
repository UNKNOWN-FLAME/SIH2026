# VajraX — Database Architecture & Schema Specification
### Dual-Twin Digital Platform for Antarctic Research Stations (Maitri & Bharati)
**SIH 2026 | Problem Statement 26060 | NCPOR / MoES**

---

## 1. Executive Summary & Design Rationale

Antarctica presents an extreme operational environment characterized by **scarce satellite bandwidth (4 MHz shared VSAT)**, **harsh weather-driven link degradation**, and **complete physical isolation** (annual ship resupply). 

Consequently, the database architecture follows a **Dual-Tier Edge-to-Cloud Model**:
1. **Edge Database (On-Station @ Maitri & Bharati):** High-frequency local writes (1 Hz), 7-day retention policy, local threshold alerts, tamper-evident black-box recording, and persistent store-and-forward priority queues. Operates autonomously even during total satellite blackouts.
2. **Cloud Database (NCPOR HQ @ Goa):** Long-term historical data aggregation, cross-station intelligence, AI predictive analytics (fuel/consumable depletion), asset topology, and role-based access control (RBAC).

```
┌──────────────────────────────────────────────────────────┐
│  EDGE DATABASE (Local TimescaleDB / SQLite @ Stations)   │
│  • Autonomous offline execution & zero-latency alerts    │
│  • 7-day downsampling retention policy                   │
│  • Append-Only Hash-Chained Black-Box Frames             │
│  • Store-and-Forward Priority Sync Queue (Redis/Postgres)│
└────────────────────────────┬─────────────────────────────┘
                             │  VSAT Satellite Link
                             │  (Protobuf + Zstd + Ed25519)
                             ▼
┌──────────────────────────────────────────────────────────┐
│  CLOUD DATABASE (PostgreSQL / Neon / Timescale Cloud)    │
│  • Multi-year historical telemetry repository            │
│  • AI Predictions (Fuel & Consumable Depletion)          │
│  • Annual Resupply Manifest & Logistics Planning         │
│  • User RBAC & Full Audit Logs                           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Cloud Databases Evaluation (Neon, Supabase, Timescale)

| Environment | Database Target | Recommended Provider | Justification |
|---|---|---|---|
| **Cloud Twin (HQ)** | PostgreSQL 16 | **Neon (Serverless Postgres)** / **Supabase** | Instant setup, zero devops overhead, instant DB branching for testing/demos, auto-scaling, and full SQLAlchemy async compatibility. |
| **Edge Twin (Station)** | TimescaleDB / SQLite | **Local On-Premises DB** | **Cannot use Cloud DB directly.** If satellite connectivity fails, the on-station life support monitoring and alert triggers must remain 100% operational locally. |

---

## 3. Database Schema Definitions (SQL DDL)

### 3.1. Telemetry / Time-Series (`sensor_readings`)
* **Type:** TimescaleDB Hypertable partitioned on `timestamp_utc`.
* **Domains:** `weather`, `energy`, `structural`, `glacial`, `seismic`, `life_support`.

```sql
CREATE TABLE sensor_readings (
    id                   BIGSERIAL,
    station_id           VARCHAR(32) NOT NULL,          -- 'maitri' | 'bharati'
    sensor_id            VARCHAR(128) NOT NULL,         -- e.g. 'maitri.energy.gen1.load'
    domain               VARCHAR(32) NOT NULL,          -- 'weather' | 'energy' | 'glacial' | 'seismic'
    metric_name          VARCHAR(64) NOT NULL,          -- 'temperature' | 'kw_output' | 'fuel_pct'
    value                DOUBLE PRECISION NOT NULL,
    unit                 VARCHAR(32) NOT NULL,          -- '°C', 'km/h', 'kW', '%'
    quality              VARCHAR(32) DEFAULT 'NOMINAL', -- 'NOMINAL' | 'DEGRADED' | 'FAULT'
    asset_id             VARCHAR(128),
    timestamp_utc        TIMESTAMPTZ NOT NULL,
    is_aggregate         BOOLEAN DEFAULT FALSE,
    aggregation_window_s INTEGER,
    PRIMARY KEY (station_id, sensor_id, timestamp_utc)
);

CREATE INDEX ix_sensor_time ON sensor_readings (station_id, sensor_id, timestamp_utc DESC);
```

---

### 3.2. Alert & Incident Management (`alerts`)
* **Purpose:** Real-time alarms for threshold breaches with acknowledgment lifecycle.

```sql
CREATE TABLE alerts (
    alert_id             VARCHAR(128) PRIMARY KEY,
    station_id           VARCHAR(32) NOT NULL,
    severity             VARCHAR(16) NOT NULL,          -- 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    domain               VARCHAR(32) NOT NULL,
    asset_id             VARCHAR(128),
    description          TEXT NOT NULL,
    triggered_at         TIMESTAMPTZ NOT NULL,
    raw_sensor_snapshot  JSONB,                         -- Sensor values at trigger instant
    ack_state            VARCHAR(16) DEFAULT 'OPEN',    -- 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
    acknowledged_by      VARCHAR(128),
    acknowledged_at      TIMESTAMPTZ,
    resolved_at          TIMESTAMPTZ,
    black_box_activated  BOOLEAN DEFAULT FALSE,         -- Triggers 10-hr high-res lock
    synced_to_cloud      BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_alerts_lookup ON alerts (station_id, severity, ack_state);
```

---

### 3.3. Tamper-Evident Black-Box Logger (`black_box_frames`)
* **Purpose:** Flight-data-recorder model locking 10 hours of second-by-second high-resolution data during critical incidents.
* **Security:** Append-only hash chain (`prev_hash` + `frame_hash`) providing verifiable chain-of-custody for official inquiries.

```sql
CREATE TABLE black_box_frames (
    frame_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id             VARCHAR(128) NOT NULL,
    station_id           VARCHAR(32) NOT NULL,
    trigger_alert_id     VARCHAR(128) REFERENCES alerts(alert_id),
    frame_index          INTEGER NOT NULL,
    phase                VARCHAR(32) NOT NULL,          -- 'PRE_EVENT' | 'ACTIVE' | 'POST_RESOLUTION'
    readings_protobuf    BYTEA NOT NULL,                -- High-res Protobuf binary dump
    prev_hash            BYTEA NOT NULL,                -- SHA-256 hash of frame (N-1)
    frame_hash           BYTEA NOT NULL,                -- SHA-256 hash of this frame
    timestamp_utc        TIMESTAMPTZ NOT NULL,
    window_closed        BOOLEAN DEFAULT FALSE,
    synced_to_cloud      BOOLEAN DEFAULT FALSE,
    CONSTRAINT uq_event_frame UNIQUE(event_id, frame_index)
);

CREATE INDEX ix_blackbox_timeline ON black_box_frames (event_id, timestamp_utc);
```

---

### 3.4. Store-and-Forward Outbound Queue (`outbound_queue`)
* **Purpose:** Persistent queue for satellite transmission prioritizing life safety alerts over routine telemetry.

```sql
CREATE TABLE outbound_queue (
    queue_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           VARCHAR(32) NOT NULL,
    message_type         VARCHAR(64) NOT NULL,          -- 'ALERT' | 'BLACK_BOX' | 'TELEMETRY_BATCH'
    payload_bytes        BYTEA NOT NULL,                -- Zstd compressed Protobuf binary
    priority             INTEGER NOT NULL DEFAULT 3,    -- 0=BlackBox, 1=Critical Alert, 2=Medium, 3=Telemetry
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts             INTEGER DEFAULT 0,
    last_attempted_at    TIMESTAMPTZ,
    acked_by_cloud       BOOLEAN DEFAULT FALSE,
    expires_at           TIMESTAMPTZ,
    source_id            VARCHAR(128)
);

CREATE INDEX ix_outbound_pending ON outbound_queue (acked_by_cloud, priority, created_at);
```

---

### 3.5. Logistics, Inventory & Annual Resupply (`inventory_items` & `resupply_manifests`)
* **Purpose:** Tracks fuel reserves, spare parts, and food/medical supplies across the 1-year resupply window.

```sql
CREATE TABLE inventory_items (
    item_id              VARCHAR(128) PRIMARY KEY,
    station_id           VARCHAR(32) NOT NULL,
    category             VARCHAR(32) NOT NULL,          -- 'FUEL' | 'SPARE_PARTS' | 'FOOD' | 'MEDICAL'
    name                 VARCHAR(256) NOT NULL,
    quantity             DOUBLE PRECISION NOT NULL,
    unit                 VARCHAR(32) NOT NULL,          -- 'litres', 'kg', 'units'
    min_safety_threshold DOUBLE PRECISION NOT NULL,
    daily_burn_rate      DOUBLE PRECISION,
    days_remaining       INTEGER,
    last_updated         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by           VARCHAR(128) DEFAULT 'system'
);

CREATE TABLE resupply_manifests (
    manifest_id          VARCHAR(128) PRIMARY KEY,
    expedition_name      VARCHAR(128) NOT NULL,         -- e.g. "44th Indian Antarctic Expedition"
    voyage_year          INTEGER NOT NULL,
    ship_name            VARCHAR(128),                  -- e.g. "MV Vasiliy Golovnin"
    departure_date       DATE,
    arrival_window_start DATE,
    arrival_window_end   DATE,
    status               VARCHAR(32) DEFAULT 'PLANNED'  -- 'PLANNED' | 'IN_TRANSIT' | 'DELIVERED'
);
```

---

### 3.6. Infrastructure Assets Topology (`assets` & `maintenance_events`)
* **Purpose:** Digital twin structural models, geospatial coordinates, and sub-systems.

```sql
CREATE TABLE assets (
    asset_id             VARCHAR(128) PRIMARY KEY,      -- e.g. 'maitri.building.main_block'
    station_id           VARCHAR(32) NOT NULL,
    asset_type           VARCHAR(64) NOT NULL,          -- 'BUILDING' | 'GENERATOR' | 'SOLAR_ARRAY' | 'FUEL_TANK'
    name                 VARCHAR(256) NOT NULL,
    latitude             DOUBLE PRECISION,
    longitude            DOUBLE PRECISION,
    elevation_m          DOUBLE PRECISION,
    status               VARCHAR(32) DEFAULT 'ACTIVE',  -- 'ACTIVE' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED'
    metadata_json        JSONB,
    commissioned_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_events (
    event_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             VARCHAR(128) REFERENCES assets(asset_id),
    station_id           VARCHAR(32) NOT NULL,
    title                VARCHAR(256) NOT NULL,
    description          TEXT,
    performed_by         VARCHAR(128) NOT NULL,
    performed_at         TIMESTAMPTZ NOT NULL,
    next_due_at          TIMESTAMPTZ
);
```

---

### 3.7. Cloud AI Predictive Analytics (`ai_predictions`)
* **Purpose:** Forecast curves for fuel exhaustion and equipment wear-and-tear.

```sql
CREATE TABLE ai_predictions (
    prediction_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           VARCHAR(32) NOT NULL,
    model_name           VARCHAR(64) NOT NULL,          -- 'fuel_depletion_prophet_v2' | 'vibration_anomaly'
    target_metric        VARCHAR(64) NOT NULL,
    predicted_for_date   TIMESTAMPTZ NOT NULL,
    predicted_value      DOUBLE PRECISION NOT NULL,
    confidence_lower     DOUBLE PRECISION,
    confidence_upper     DOUBLE PRECISION,
    risk_level           VARCHAR(16) DEFAULT 'NOMINAL', -- 'NOMINAL' | 'WARNING' | 'CRITICAL'
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.8. Security, Auditing & Access Control (`users`, `audit_log`, `link_status_log`)

```sql
CREATE TABLE users (
    user_id              VARCHAR(64) PRIMARY KEY,
    username             VARCHAR(64) UNIQUE NOT NULL,
    email                VARCHAR(256) UNIQUE NOT NULL,
    password_hash        VARCHAR(256) NOT NULL,
    roles                VARCHAR(32)[] NOT NULL,        -- ARRAY['ADMIN', 'OPERATOR']
    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
    entry_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           VARCHAR(32) NOT NULL,
    actor_id             VARCHAR(128),
    actor_role           VARCHAR(32),
    action               VARCHAR(64) NOT NULL,
    resource_type        VARCHAR(64) NOT NULL,
    resource_id          VARCHAR(128),
    request_body_hash    VARCHAR(64),
    response_status      INTEGER,
    timestamp_utc        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE link_status_log (
    id                   BIGSERIAL PRIMARY KEY,
    station_id           VARCHAR(32) NOT NULL,
    link_state           VARCHAR(16) NOT NULL,          -- 'UP' | 'DEGRADED' | 'DOWN'
    latency_ms           DOUBLE PRECISION,
    packet_loss_pct      DOUBLE PRECISION,
    queue_depth_bytes    BIGINT,
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. How to Connect Neon / PostgreSQL in VajraX

1. In your root `.env` file, configure the connection string:
   ```env
   # Example Neon Serverless URL
   DATABASE_URL="postgresql+asyncpg://vajrax_user:password@ep-cool-snow-123456.ap-southeast-1.aws.neon.tech/vajrax_db?sslmode=require"
   ```

2. Run Alembic migrations to build tables and indexes:
   ```bash
   alembic upgrade head
   ```
