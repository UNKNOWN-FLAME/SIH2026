# VajraX — Top-level Makefile
# Usage: make <target>

.PHONY: help dev dev-down dev-clean certs \
        migrate-edge-maitri migrate-edge-bharati migrate-cloud migrate-all \
        test test-unit test-integration test-all test-e2e test-e2e-persistent \
        proto-gen keygen-edge keygen-cloud openapi-export lint type-check \
        keygen-dev-all clean

COMPOSE_DEV  := docker compose -f infra/compose/docker-compose.dev.yml
COMPOSE_TEST := docker compose -f infra/compose/docker-compose.test.yml

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-32s\033[0m %s\n", $$1, $$2}'

# --------------------------------------------------------------------------
# Infrastructure
# --------------------------------------------------------------------------

dev:  ## Start all dev infrastructure (DBs, Redis, Mosquitto, MinIO)
	$(COMPOSE_DEV) up -d
	@echo "Dev infrastructure started. Run 'make migrate-all' to apply migrations."

dev-down:  ## Stop and remove dev containers (preserves volumes)
	$(COMPOSE_DEV) down

dev-clean:  ## Stop dev containers and DELETE all data volumes
	$(COMPOSE_DEV) down -v

certs:  ## Generate dev self-signed TLS certificates (dev only)
	@echo "Generating dev certificates..."
	bash infra/certs/dev/gen_certs.sh

# --------------------------------------------------------------------------
# Database migrations
# --------------------------------------------------------------------------

migrate-edge-maitri:  ## Run Edge schema migrations for Maitri
	MIGRATION_TARGET=edge DATABASE_URL=postgresql://vajrax_edge:edge_secret_dev@localhost:5433/vajrax_edge \
	  python -m alembic -c shared/db/alembic.ini upgrade head

migrate-edge-bharati:  ## Run Edge schema migrations for Bharati
	MIGRATION_TARGET=edge DATABASE_URL=postgresql://vajrax_edge:edge_secret_dev@localhost:5434/vajrax_edge \
	  python -m alembic -c shared/db/alembic.ini upgrade head

migrate-cloud:  ## Run Cloud schema migrations
	MIGRATION_TARGET=cloud DATABASE_URL=postgresql://vajrax_cloud:cloud_secret_dev@localhost:5435/vajrax_cloud \
	  python -m alembic -c shared/db/alembic.ini upgrade head

migrate-all: migrate-edge-maitri migrate-edge-bharati migrate-cloud  ## Run all migrations
	@echo "All migrations applied."

# --------------------------------------------------------------------------
# Protobuf code generation
# --------------------------------------------------------------------------

proto-gen:  ## Generate Python bindings from .proto files (requires protoc + betterproto)
	@echo "Generating Protobuf Python bindings..."
	mkdir -p shared/schemas/proto_generated
	python -m grpc_tools.protoc \
	  -I proto \
	  -I $(shell python -c "import grpc_tools; import os; print(os.path.dirname(grpc_tools.__file__))")/_proto \
	  --python_betterproto_out=shared/schemas/proto_generated \
	  proto/*.proto
	@echo "Protobuf bindings written to shared/schemas/proto_generated/"

# --------------------------------------------------------------------------
# Key management
# --------------------------------------------------------------------------

keygen-edge:  ## Generate Ed25519 keypair for a station (STATION=maitri|bharati)
	@STATION=$${STATION:-maitri}; \
	echo "Generating Ed25519 keypair for station: $$STATION"; \
	mkdir -p keys; \
	python3 -c "\
from shared.crypto.signing import generate_station_keypair; \
import os; \
priv, pub = generate_station_keypair(); \
open('keys/$${STATION}_private.pem','wb').write(priv); \
open('keys/$${STATION}_public.pem','wb').write(pub); \
print('Written: keys/$${STATION}_private.pem  keys/$${STATION}_public.pem')"

keygen-cloud-jwt:  ## Generate a random CLOUD_JWT_SECRET (copy to .env or Docker secret)
	@python3 -c "import secrets; print('CLOUD_JWT_SECRET=' + secrets.token_hex(32))"

keygen-edge-apikey:  ## Generate an Edge API key (ROLE=CREW|OPERATOR|ADMIN)
	@ROLE=$${ROLE:-OPERATOR}; \
	python3 -c "from edge.auth.local_auth import generate_api_key; print(generate_api_key('$${ROLE}'))"

keygen-dev-all:  ## Generate dev keypairs for both stations
	$(MAKE) keygen-edge STATION=maitri
	$(MAKE) keygen-edge STATION=bharati
	@echo "Keypairs written to keys/. Copy public keys to Cloud server."

# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

test-unit:  ## Run unit tests only
	python -m pytest tests/unit/ -v

test-integration:  ## Run integration tests only
	python -m pytest tests/integration/ -v

test-all:  ## Run ALL tests (unit + integration) — Phase 8 full suite
	python -m pytest tests/unit/ tests/integration/ -v --tb=short
	@echo ""
	@python -m pytest tests/unit/ tests/integration/ --co -q 2>/dev/null | tail -1

test-e2e:  ## Run end-to-end tests (ephemeral volumes — clean on each run)
	$(COMPOSE_TEST) up -d
	python -m pytest tests/e2e/ -v
	$(COMPOSE_TEST) down -v

test-e2e-persistent:  ## Run e2e tests preserving volumes (for debugging)
	$(COMPOSE_TEST) up -d
	python -m pytest tests/e2e/ -v

test: test-all  ## Default: run full test suite

# --------------------------------------------------------------------------
# Code quality
# --------------------------------------------------------------------------

lint:  ## Run ruff linter
	python -m ruff check . --fix

type-check:  ## Run mypy type checker
	python -m mypy shared/ edge/ cloud/ simulator/ --ignore-missing-imports

# --------------------------------------------------------------------------
# API documentation export
# --------------------------------------------------------------------------

openapi-export:  ## Export OpenAPI spec for Edge and Cloud backends to docs/
	@echo "Exporting Edge OpenAPI spec..."
	@mkdir -p docs/api
	@STATION_ID=maitri DATABASE_URL=sqlite+aiosqlite:///dev.db REDIS_URL=redis://localhost:6380/0 \
	  python3 -c "\
import json, os; \
os.environ.update({'STATION_ID':'maitri','DATABASE_URL':'sqlite+aiosqlite:///dev.db','REDIS_URL':'redis://localhost:6380'}); \
from edge.main import app; \
open('docs/api/edge_openapi.json','w').write(json.dumps(app.openapi(), indent=2)); \
print('Edge OpenAPI → docs/api/edge_openapi.json')" 2>/dev/null || echo "(Run with live DB for full schema)"
	@echo "Exporting Cloud OpenAPI spec..."
	@CLOUD_JWT_SECRET=export-only DATABASE_URL=sqlite+aiosqlite:///dev.db REDIS_URL=redis://localhost:6382/0 \
	  python3 -c "\
import json, os; \
os.environ.update({'CLOUD_JWT_SECRET':'export-only','DATABASE_URL':'sqlite+aiosqlite:///dev.db','REDIS_URL':'redis://localhost:6382'}); \
from cloud.main import create_app; \
app = create_app(); \
open('docs/api/cloud_openapi.json','w').write(json.dumps(app.openapi(), indent=2)); \
print('Cloud OpenAPI → docs/api/cloud_openapi.json')" 2>/dev/null || echo "(Run with live DB for full schema)"

# --------------------------------------------------------------------------
# Cleanup
# --------------------------------------------------------------------------

clean:  ## Remove Python cache files and temp artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -f dev.db
