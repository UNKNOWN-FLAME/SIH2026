"""Initial Edge schema — creates all Edge-local tables and TimescaleDB hypertables.

Revision ID: 0001
Revises: (none)
Create Date: 2026-08-27
Branch: edge
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = ("edge",)
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # sensor_readings  (TimescaleDB hypertable)
    # ------------------------------------------------------------------
    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("sensor_id", sa.String(128), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("metric_name", sa.String(64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("quality", sa.String(32), nullable=False, server_default="NOMINAL"),
        sa.Column("asset_id", sa.String(128), nullable=True),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_aggregate", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("aggregation_window_s", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sensor_readings_station_id", "sensor_readings", ["station_id"])
    op.create_index("ix_sensor_readings_sensor_id", "sensor_readings", ["sensor_id"])
    op.create_index("ix_sensor_readings_timestamp_utc", "sensor_readings", ["timestamp_utc"])
    op.create_index(
        "ix_sensor_readings_station_sensor_time",
        "sensor_readings", ["station_id", "sensor_id", "timestamp_utc"]
    )
    # Convert to TimescaleDB hypertable (1-hour chunk interval)
    op.execute(
        "SELECT create_hypertable('sensor_readings', 'timestamp_utc', "
        "chunk_time_interval => INTERVAL '1 hour', "
        "if_not_exists => TRUE);"
    )
    # 7-day automated retention policy
    op.execute(
        "SELECT add_retention_policy('sensor_readings', INTERVAL '7 days', "
        "if_not_exists => TRUE);"
    )
    # 1-minute continuous aggregate for sync agent (downsampled Cloud transmission)
    op.execute("""
        CREATE MATERIALIZED VIEW sensor_readings_1min
        WITH (timescaledb.continuous) AS
        SELECT
            station_id,
            sensor_id,
            domain,
            metric_name,
            unit,
            time_bucket(INTERVAL '1 minute', timestamp_utc) AS bucket,
            AVG(value) AS avg_value,
            MIN(value) AS min_value,
            MAX(value) AS max_value,
            COUNT(*) AS sample_count
        FROM sensor_readings
        GROUP BY station_id, sensor_id, domain, metric_name, unit,
                 time_bucket(INTERVAL '1 minute', timestamp_utc)
        WITH NO DATA;
    """)
    op.execute(
        "SELECT add_continuous_aggregate_policy('sensor_readings_1min', "
        "start_offset => INTERVAL '1 hour', "
        "end_offset => INTERVAL '1 minute', "
        "schedule_interval => INTERVAL '1 minute', "
        "if_not_exists => TRUE);"
    )

    # ------------------------------------------------------------------
    # alerts
    # ------------------------------------------------------------------
    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.String(128), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("asset_id", sa.String(128), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_sensor_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("ack_state", sa.String(16), nullable=False, server_default="OPEN"),
        sa.Column("acknowledged_by", sa.String(128), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("black_box_activated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("synced_to_cloud", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("alert_id"),
    )
    op.create_index("ix_alerts_station_id", "alerts", ["station_id"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_triggered_at", "alerts", ["triggered_at"])
    op.create_index("ix_alerts_ack_state", "alerts", ["ack_state"])
    op.create_index(
        "ix_alerts_station_severity_state",
        "alerts", ["station_id", "severity", "ack_state"]
    )

    # ------------------------------------------------------------------
    # outbound_queue  (disk-backed sync queue; Redis is the primary queue,
    #                  this table provides crash-safe persistence fallback)
    # ------------------------------------------------------------------
    op.create_table(
        "outbound_queue",
        sa.Column("queue_id", sa.String(36), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("message_type", sa.String(64), nullable=False),
        sa.Column("payload_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acked_by_cloud", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_id", sa.String(128), nullable=True),
        sa.PrimaryKeyConstraint("queue_id"),
    )
    op.create_index("ix_outbound_queue_station_id", "outbound_queue", ["station_id"])
    op.create_index("ix_outbound_queue_priority", "outbound_queue", ["priority"])
    op.create_index("ix_outbound_queue_acked", "outbound_queue", ["acked_by_cloud"])
    op.create_index(
        "ix_outbound_queue_pending",
        "outbound_queue", ["acked_by_cloud", "priority", "created_at"]
    )

    # ------------------------------------------------------------------
    # black_box_frames  (append-only — DB role grants INSERT only)
    # ------------------------------------------------------------------
    op.create_table(
        "black_box_frames",
        sa.Column("frame_id", sa.String(36), nullable=False),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("trigger_alert_id", sa.String(128), nullable=False),
        sa.Column("frame_index", sa.Integer(), nullable=False),
        sa.Column("readings_protobuf", sa.LargeBinary(), nullable=False),
        sa.Column("phase", sa.String(32), nullable=False),
        sa.Column("prev_hash", sa.LargeBinary(32), nullable=False),
        sa.Column("frame_hash", sa.LargeBinary(32), nullable=False),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_partial_pre_event", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("window_closed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("synced_to_cloud", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("frame_id"),
        sa.UniqueConstraint("event_id", "frame_index", name="uq_blackbox_event_frame"),
    )
    op.create_index("ix_blackbox_event_id", "black_box_frames", ["event_id"])
    op.create_index("ix_blackbox_station_id", "black_box_frames", ["station_id"])
    op.create_index("ix_blackbox_timestamp", "black_box_frames", ["timestamp_utc"])
    op.create_index(
        "ix_blackbox_event_timestamp",
        "black_box_frames", ["event_id", "timestamp_utc"]
    )

    # ------------------------------------------------------------------
    # inventory_items
    # ------------------------------------------------------------------
    op.create_table(
        "inventory_items",
        sa.Column("item_id", sa.String(128), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("min_threshold", sa.Float(), nullable=True),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_by", sa.String(128), nullable=False, server_default="system"),
        sa.Column("synced_to_cloud", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("item_id"),
    )
    op.create_index("ix_inventory_items_station_id", "inventory_items", ["station_id"])

    # ------------------------------------------------------------------
    # asset_cache  (read-only Edge copy of Cloud asset registry)
    # ------------------------------------------------------------------
    op.create_table(
        "asset_cache",
        sa.Column("asset_id", sa.String(128), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("asset_type", sa.String(64), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("elevation_m", sa.Float(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("asset_id"),
    )
    op.create_index("ix_asset_cache_station_id", "asset_cache", ["station_id"])

    # ------------------------------------------------------------------
    # audit_log  (append-only — no UPDATE/DELETE on application role)
    # ------------------------------------------------------------------
    op.create_table(
        "audit_log",
        sa.Column("entry_id", sa.String(36), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=True),
        sa.Column("actor_role", sa.String(32), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(128), nullable=True),
        sa.Column("request_body_hash", sa.String(64), nullable=True),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("client_ip", sa.String(64), nullable=True),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("entry_id"),
    )
    op.create_index("ix_audit_log_station_id", "audit_log", ["station_id"])
    op.create_index("ix_audit_log_timestamp_utc", "audit_log", ["timestamp_utc"])

    # ------------------------------------------------------------------
    # link_status_log
    # ------------------------------------------------------------------
    op.create_table(
        "link_status_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("queue_depth_bytes", sa.BigInteger(), nullable=True),
        sa.Column("queue_item_count", sa.Integer(), nullable=True),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_link_status_station_id", "link_status_log", ["station_id"])
    op.create_index("ix_link_status_timestamp_utc", "link_status_log", ["timestamp_utc"])


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS sensor_readings_1min;")
    op.drop_table("link_status_log")
    op.drop_table("audit_log")
    op.drop_table("asset_cache")
    op.drop_table("inventory_items")
    op.drop_table("black_box_frames")
    op.drop_table("outbound_queue")
    op.drop_table("alerts")
    op.drop_table("sensor_readings")
