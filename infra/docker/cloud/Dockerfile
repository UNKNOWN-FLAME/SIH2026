FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi "uvicorn[standard]" "sqlalchemy[asyncio]" asyncpg alembic \
    pydantic pyyaml httpx structlog "redis[hiredis]" cryptography \
    zstandard aiomqtt websockets

COPY . .

EXPOSE 8200
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD curl -f http://localhost:8200/health || exit 1

CMD ["uvicorn", "cloud.main:app", "--host", "0.0.0.0", "--port", "8200", "--workers", "1"]
