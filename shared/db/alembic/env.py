"""Alembic environment configuration for VajraX.

Supports two migration targets:
  - MIGRATION_TARGET=edge   → runs Edge schema migrations
  - MIGRATION_TARGET=cloud  → runs Cloud schema migrations
"""
from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Determine migration target
target = os.environ.get("MIGRATION_TARGET", "cloud")

# Import the correct set of models
if target == "edge":
    from shared.db.models.edge import (
        SensorReading, Alert, OutboundQueueItem, BlackBoxFrame,
        InventoryItem, AssetCache, AuditLogEntry, LinkStatusRecord,
    )
else:
    from shared.db.models.cloud import *  # noqa: F401,F403
    from shared.db.models.edge import OutboundQueueItem, AssetCache  # noqa: F401

from shared.db.base import Base

# Alembic Config object from alembic.ini
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ── Inject DATABASE_URL from environment into alembic config ─────────────────
# This is required because alembic.ini has no sqlalchemy.url hardcoded.
# The Makefile passes DATABASE_URL as an env var.
db_url = os.environ.get("DATABASE_URL")
if db_url:
    # Convert asyncpg/aiosqlite URLs to their sync equivalents for alembic
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    db_url = db_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
