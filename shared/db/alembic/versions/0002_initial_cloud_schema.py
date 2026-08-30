"""Initial Cloud schema — Cloud-only tables, built on top of the Edge schema (0001).

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-27
Branch: cloud
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = ("cloud",)
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # assets  (Cloud primary; Edge caches a read-only copy via asset_cache)
    # ------------------------------------------------------------------
    op.create_table(
        "assets",
        sa.Column("asset_id", sa.String(128), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("asset_type", sa.String(64), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("elevation_m", sa.Float(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("commissioned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decommissioned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("asset_id"),
    )
    op.create_index("ix_assets_station_id", "assets", ["station_id"])
    op.create_index("ix_assets_station_type", "assets", ["station_id", "asset_type"])

    # Seed initial asset registry for both stations
    op.execute("""
        INSERT INTO assets (asset_id, station_id, asset_type, name, latitude, longitude, elevation_m) VALUES
        ('maitri.gen1',          'maitri',  'generator',    'Maitri Generator 1 (Primary)',    -70.7683, 11.8268, 130.0),
        ('maitri.gen2',          'maitri',  'generator',    'Maitri Generator 2 (Backup)',     -70.7683, 11.8268, 130.0),
        ('maitri.grid',          'maitri',  'power_dist',   'Maitri Power Distribution Grid',  -70.7683, 11.8268, 130.0),
        ('maitri.aws',           'maitri',  'weather_stn',  'Maitri Automatic Weather Station',-70.7683, 11.8268, 130.0),
        ('maitri.main_building', 'maitri',  'building',     'Maitri Main Building',            -70.7683, 11.8268, 130.0),
        ('maitri.lab_building',  'maitri',  'building',     'Maitri Laboratory Building',      -70.7683, 11.8268, 130.0),
        ('maitri.generator_room','maitri',  'building',     'Maitri Generator Room',           -70.7683, 11.8268, 130.0),
        ('maitri.seismic_station','maitri', 'seismic',      'Maitri Seismic Monitoring Station',-70.7683,11.8268, 130.0),
        ('bharati.gen1',         'bharati', 'generator',    'Bharati Generator 1 (Primary)',   -69.4069, 76.1931, 35.0),
        ('bharati.grid',         'bharati', 'power_dist',   'Bharati Power Distribution Grid', -69.4069, 76.1931, 35.0),
        ('bharati.solar_array',  'bharati', 'solar',        'Bharati Solar Panel Array',       -69.4069, 76.1931, 35.0),
        ('bharati.aws',          'bharati', 'weather_stn',  'Bharati Automatic Weather Station',-69.4069,76.1931, 35.0),
        ('bharati.main_building','bharati', 'building',     'Bharati Main Building',           -69.4069, 76.1931, 35.0),
        ('bharati.lab_wing',     'bharati', 'building',     'Bharati Laboratory Wing',         -69.4069, 76.1931, 35.0),
        ('bharati.seismic_station','bharati','seismic',     'Bharati Seismic Monitoring Station',-69.4069,76.1931,35.0),
        ('bharati.sea_ice_monitor','bharati','ice_monitor', 'Bharati Sea Ice Thickness Monitor',-69.4069, 76.1931, 0.0);
    """)

    # ------------------------------------------------------------------
    # maintenance_events
    # ------------------------------------------------------------------
    op.create_table(
        "maintenance_events",
        sa.Column("event_id", sa.String(36), nullable=False),
        sa.Column("asset_id", sa.String(128), sa.ForeignKey("assets.asset_id"), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("technician", sa.String(256), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index("ix_maintenance_events_asset_id", "maintenance_events", ["asset_id"])
    op.create_index("ix_maintenance_events_station_id", "maintenance_events", ["station_id"])

    # ------------------------------------------------------------------
    # resupply_manifests + line items
    # ------------------------------------------------------------------
    op.create_table(
        "resupply_manifests",
        sa.Column("manifest_id", sa.String(36), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("arrival_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expedition_name", sa.String(256), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by", sa.String(128), nullable=True),
        sa.PrimaryKeyConstraint("manifest_id"),
    )
    op.create_index("ix_resupply_manifests_station_id", "resupply_manifests", ["station_id"])

    op.create_table(
        "resupply_line_items",
        sa.Column("line_item_id", sa.String(36), nullable=False),
        sa.Column("manifest_id", sa.String(36),
                  sa.ForeignKey("resupply_manifests.manifest_id"), nullable=False),
        sa.Column("item_id", sa.String(128), nullable=False),
        sa.Column("item_name", sa.String(256), nullable=False),
        sa.Column("quantity_delivered", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.PrimaryKeyConstraint("line_item_id"),
    )
    op.create_index("ix_resupply_line_items_manifest_id",
                    "resupply_line_items", ["manifest_id"])

    # ------------------------------------------------------------------
    # ai_predictions
    # ------------------------------------------------------------------
    op.create_table(
        "ai_predictions",
        sa.Column("prediction_id", sa.String(36), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("target", sa.String(256), nullable=False),
        sa.Column("predicted_value", sa.Float(), nullable=True),
        sa.Column("predicted_json", postgresql.JSONB(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(64), nullable=True),
        sa.Column("data_window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("prediction_id"),
    )
    op.create_index("ix_ai_predictions_station_id", "ai_predictions", ["station_id"])
    op.create_index("ix_ai_predictions_station_model",
                    "ai_predictions", ["station_id", "model_name"])

    # ------------------------------------------------------------------
    # station_connections  (Cloud-side link state tracker)
    # ------------------------------------------------------------------
    op.create_table(
        "station_connections",
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("link_state", sa.String(16), nullable=False, server_default="DOWN"),
        sa.Column("queue_depth_bytes", sa.BigInteger(), nullable=True),
        sa.Column("open_critical_alerts", sa.Integer(), nullable=True),
        sa.Column("open_high_alerts", sa.Integer(), nullable=True),
        sa.Column("services_healthy", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("station_id"),
    )
    # Seed initial rows for both stations
    op.execute("""
        INSERT INTO station_connections (station_id, link_state) VALUES
        ('maitri',  'DOWN'),
        ('bharati', 'DOWN');
    """)

    # ------------------------------------------------------------------
    # station_config  (per-station runtime config overrides)
    # ------------------------------------------------------------------
    op.create_table(
        "station_config",
        sa.Column("config_id", sa.String(36), nullable=False),
        sa.Column("station_id", sa.String(32), nullable=False),
        sa.Column("config_key", sa.String(128), nullable=False),
        sa.Column("config_value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_by", sa.String(128), nullable=True),
        sa.PrimaryKeyConstraint("config_id"),
        sa.UniqueConstraint("station_id", "config_key", name="uq_station_config_key"),
    )
    op.create_index("ix_station_config_station_id", "station_config", ["station_id"])

    # ------------------------------------------------------------------
    # users + roles + user_roles
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("username", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "roles",
        sa.Column("role_id", sa.String(36), nullable=False),
        sa.Column("role_name", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("role_id"),
        sa.UniqueConstraint("role_name", name="uq_roles_name"),
    )
    # Seed canonical roles
    op.execute("""
        INSERT INTO roles (role_id, role_name, description) VALUES
        ('00000001-0000-0000-0000-000000000001', 'ADMIN',
         'Full system access including user management and configuration'),
        ('00000001-0000-0000-0000-000000000002', 'OPERATOR',
         'HQ full read/write access across all assigned stations'),
        ('00000001-0000-0000-0000-000000000003', 'STATION_CREW',
         'On-site crew: local read/write, alert acknowledgement, inventory updates'),
        ('00000001-0000-0000-0000-000000000004', 'VIEWER',
         'Read-only access to Cloud dashboard data');
    """)

    op.create_table(
        "user_roles",
        sa.Column("assignment_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("role_id", sa.String(36), sa.ForeignKey("roles.role_id"), nullable=False),
        sa.Column("station_scope", sa.String(32), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("assigned_by", sa.String(128), nullable=True),
        sa.PrimaryKeyConstraint("assignment_id"),
        sa.UniqueConstraint("user_id", "role_id", "station_scope",
                            name="uq_user_role_scope"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"])


def downgrade() -> None:
    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_table("users")
    op.drop_table("station_config")
    op.drop_table("station_connections")
    op.drop_table("ai_predictions")
    op.drop_table("resupply_line_items")
    op.drop_table("resupply_manifests")
    op.drop_table("maintenance_events")
    op.drop_table("assets")
