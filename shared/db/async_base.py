"""Async SQLAlchemy engine and session factory for VajraX services.

Extends shared/db/base.py (synchronous) with an async engine for the
Edge and Cloud FastAPI services, which run on asyncio event loops.

Usage:
    from shared.db.async_base import get_async_engine, get_async_session

    engine = get_async_engine(database_url)
    async with get_async_session(engine) as session:
        result = await session.execute(select(SensorReading))
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def get_async_engine(database_url: str | None = None, echo: bool = False) -> AsyncEngine:
    """Create an async SQLAlchemy engine.

    Converts a standard postgresql:// URL to postgresql+asyncpg://.
    Supports sqlite+aiosqlite:// for local dev without Docker.
    """
    url = database_url or os.environ["DATABASE_URL"]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    if "sqlite" in url:
        # SQLite does not support connection pools — use StaticPool for async
        from sqlalchemy.pool import StaticPool
        return create_async_engine(
            url,
            echo=echo,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    return create_async_engine(
        url,
        echo=echo,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


def get_async_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


@asynccontextmanager
async def get_async_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Async context manager yielding a DB session."""
    factory = get_async_session_factory(engine)
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
