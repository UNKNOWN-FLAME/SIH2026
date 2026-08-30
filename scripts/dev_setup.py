#!/usr/bin/env python3
"""
VajraX Dev Bootstrap — creates vajrax_dev.db with all tables + seed data.
Run ONCE before starting the backend (no Docker required):

    cd /Users/mohakbansal/Documents/VajraX
    DATABASE_URL=sqlite+aiosqlite:///vajrax_dev.db PYTHONPATH=. python3 scripts/dev_setup.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Must be set BEFORE importing any models
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///vajrax_dev.db")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    from shared.db.async_base import get_async_engine
    from shared.db.base import Base
    from shared.db.models import cloud, edge  # noqa: F401 — registers all models
    from shared.db.models.cloud import User, Role, UserRole
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from sqlalchemy import select

    engine = get_async_engine()

    # ── Create all tables ─────────────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ All DB tables created in vajrax_dev.db")

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        # ── Seed admin user ───────────────────────────────────────────────────
        existing = await session.execute(
            select(User).where(User.username == "admin")
        )
        admin_user = existing.scalar_one_or_none()

        if admin_user is None:
            # Hash password using bcrypt (same as the auth system)
            try:
                import bcrypt
                pw_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
            except ImportError:
                # Fallback: use passlib if bcrypt not directly available
                from passlib.context import CryptContext
                ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
                pw_hash = ctx.hash("admin123")

            admin_user = User(
                user_id=str(uuid.uuid4()),
                username="admin",
                email="admin@vajrax.ncpor.gov.in",
                hashed_password=pw_hash,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(admin_user)
            await session.flush()
            print("✓ Admin user created  (username: admin / password: admin123)")
        else:
            print("✓ Admin user already exists")

        # ── Seed ADMIN role ───────────────────────────────────────────────────
        role_result = await session.execute(
            select(Role).where(Role.role_name == "ADMIN")
        )
        admin_role = role_result.scalar_one_or_none()
        if admin_role is None:
            admin_role = Role(
                role_id=str(uuid.uuid4()),
                role_name="ADMIN",
                description="Full system access",
            )
            session.add(admin_role)
            await session.flush()

        # Seed OPERATOR role
        op_result = await session.execute(
            select(Role).where(Role.role_name == "OPERATOR")
        )
        op_role = op_result.scalar_one_or_none()
        if op_role is None:
            op_role = Role(
                role_id=str(uuid.uuid4()),
                role_name="OPERATOR",
                description="Station operator access",
            )
            session.add(op_role)
            await session.flush()

        # ── Assign ADMIN role to admin user ───────────────────────────────────
        ur_result = await session.execute(
            select(UserRole)
            .where(UserRole.user_id == admin_user.user_id)
            .where(UserRole.role_id == admin_role.role_id)
        )
        if ur_result.scalar_one_or_none() is None:
            session.add(UserRole(
                assignment_id=str(uuid.uuid4()),
                user_id=admin_user.user_id,
                role_id=admin_role.role_id,
                assigned_at=datetime.now(timezone.utc),
            ))

        await session.commit()
        print("✓ Roles seeded (ADMIN, OPERATOR)")

    await engine.dispose()
    print()
    print("=" * 60)
    print("✅  Dev setup complete!")
    print("=" * 60)
    print()
    print("Now start the backend in a NEW terminal:")
    print()
    print("  cd /Users/mohakbansal/Documents/VajraX")
    print("  export DATABASE_URL=sqlite+aiosqlite:///vajrax_dev.db")
    print("  export PYTHONPATH=.")
    print("  export CLOUD_JWT_SECRET=dev_secret_key_vajrax_2026")
    print("  uvicorn cloud.main:app --port 8200 --reload")
    print()
    print("Then start the frontend in ANOTHER terminal:")
    print()
    print("  cd /Users/mohakbansal/Documents/VajraX/frontend")
    print("  npm run dev")
    print()
    print("Open: http://localhost:5173")
    print("Login: admin / admin123")


if __name__ == "__main__":
    asyncio.run(main())
