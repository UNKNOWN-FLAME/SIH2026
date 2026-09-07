# VajraX — Top-level Makefile
# Usage: make <target>
#
# Database targets use Neon PostgreSQL.
# Set CLOUD_DATABASE_URL and EDGE_DATABASE_URL in your .env before running.

.PHONY: help \
        db-migrate-edge db-migrate-cloud db-migrate-all \
        db-reset-edge db-reset-cloud \
        db-setup db-verify \
        proto-gen \
        keygen-edge keygen-cloud-jwt keygen-edge-apikey keygen-dev-all \
        certs \
        run-cloud run-edge \
        test test-unit test-integration test-all \
        openapi-export \
        lint type-check \
        clean

# Load .env so Make can see the variables (optional — services read .env themselves)
ifneq (,$(wildcard .env))
  include .env
  export
endif

ALEMBIC := python -m alembic -c shared/db/alembic.ini
PYTHONPATH_EXPORT := PYTHONPATH=.

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-32s\033[0m %s\n", $$1, $$2}'

# --------------------------------------------------------------------------
# Database — migrations (Neon PostgreSQL)
# --------------------------------------------------------------------------

db-migrate-edge:  ## Apply Edge schema migrations to EDGE_DATABASE_URL (Neon)
	@echo "→ Running Edge migrations (MIGRATION_TARGET=edge)…"
	MIGRATION_TARGET=edge $(PYTHONPATH_EXPORT) $(ALEMBIC) upgrade head
	@echo "✓ Edge migrations done."

db-migrate-cloud:  ## Apply Cloud schema migrations to CLOUD_DATABASE_URL (Neon)
	@echo "→ Running Cloud migrations (MIGRATION_TARGET=cloud)…"
	MIGRATION_TARGET=cloud $(PYTHONPATH_EXPORT) $(ALEMBIC) upgrade head
	@echo "✓ Cloud migrations done."

db-migrate-all: db-migrate-edge db-migrate-cloud  ## Apply all migrations (edge + cloud)
	@echo "✓ All migrations applied."

db-reset-edge:  ## Downgrade Edge DB to base then re-apply migrations (DESTRUCTIVE)
	@echo "⚠  Resetting Edge database…"
	MIGRATION_TARGET=edge $(PYTHONPATH_EXPORT) $(ALEMBIC) downgrade base
	$(MAKE) db-migrate-edge

db-reset-cloud:  ## Downgrade Cloud DB to base then re-apply migrations (DESTRUCTIVE)
	@echo "⚠  Resetting Cloud database…"
	MIGRATION_TARGET=cloud $(PYTHONPATH_EXPORT) $(ALEMBIC) downgrade base
	$(MAKE) db-migrate-cloud

db-setup:  ## Run migrations + seed data via setup_neon.py
	$(PYTHONPATH_EXPORT) python scripts/setup_neon.py

db-verify:  ## Check that all tables and seed data exist (no migrations run)
	$(PYTHONPATH_EXPORT) python scripts/setup_neon.py --verify-only

# --------------------------------------------------------------------------
# Run services locally (no Docker)
# --------------------------------------------------------------------------

run-cloud:  ## Start the Cloud backend on port 8200
	$(PYTHONPATH_EXPORT) uvicorn cloud.main:app --host 0.0.0.0 --port 8200 --reload

run-edge:  ## Start the Edge backend for Maitri on port 8100 (STATION_ID=maitri)
	STATION_ID=maitri $(PYTHONPATH_EXPORT) uvicorn edge.main:app --host 0.0.0.0 --port 8100 --reload

run-edge-bharati:  ## Start the Edge backend for Bharati on port 8101
	STATION_ID=bharati $(PYTHONPATH_EXPORT) uvicorn edge.main:app --host 0.0.0.0 --port 8101 --reload

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
	mkdir -p infra/certs/stations; \
	python3 -c "\
from shared.crypto.signing import generate_station_keypair; \
priv, pub = generate_station_keypair(); \
open('infra/certs/stations/$${STATION}_private.pem','wb').write(priv); \
open('infra/certs/stations/$${STATION}_public.pem','wb').write(pub); \
print('Written: infra/certs/stations/$${STATION}_private.pem')"

keygen-cloud-jwt:  ## Generate a random CLOUD_JWT_SECRET and print it
	@python3 -c "import secrets; print('CLOUD_JWT_SECRET=' + secrets.token_hex(32))"

keygen-edge-apikey:  ## Generate an Edge API key (ROLE=CREW|OPERATOR|ADMIN)
	@ROLE=$${ROLE:-OPERATOR}; \
	python3 -c "from edge.auth.local_auth import generate_api_key; print(generate_api_key('$${ROLE}'))"

keygen-dev-all:  ## Generate dev Ed25519 keypairs for both stations
	$(MAKE) keygen-edge STATION=maitri
	$(MAKE) keygen-edge STATION=bharati
	@echo "Keypairs written to infra/certs/stations/"

certs:  ## Generate dev self-signed TLS certificates
	@echo "Generating dev certificates..."
	bash infra/certs/dev/gen_certs.sh

# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

test-unit:  ## Run unit tests only
	$(PYTHONPATH_EXPORT) python -m pytest tests/unit/ -v

test-integration:  ## Run integration tests only (requires live Neon DB)
	$(PYTHONPATH_EXPORT) python -m pytest tests/integration/ -v

test-all:  ## Run all tests (unit + integration)
	$(PYTHONPATH_EXPORT) python -m pytest tests/unit/ tests/integration/ -v --tb=short

test: test-all  ## Default: run full test suite

# --------------------------------------------------------------------------
# Code quality
# --------------------------------------------------------------------------

lint:  ## Run ruff linter with auto-fix
	python -m ruff check . --fix

type-check:  ## Run mypy type checker
	python -m mypy shared/ edge/ cloud/ simulator/ --ignore-missing-imports

# --------------------------------------------------------------------------
# API documentation export
# --------------------------------------------------------------------------

openapi-export:  ## Export OpenAPI JSON specs for Edge and Cloud backends
	@echo "Exporting Edge OpenAPI spec..."
	@mkdir -p docs/api
	@STATION_ID=maitri EDGE_DATABASE_URL=$$EDGE_DATABASE_URL \
	  python3 -c "\
import json, os, sys; \
os.environ.setdefault('STATION_ID','maitri'); \
sys.path.insert(0,'.'); \
from edge.main import app; \
open('docs/api/edge_openapi.json','w').write(json.dumps(app.openapi(), indent=2)); \
print('Edge OpenAPI → docs/api/edge_openapi.json')"
	@echo "Exporting Cloud OpenAPI spec..."
	@CLOUD_DATABASE_URL=$$CLOUD_DATABASE_URL CLOUD_JWT_SECRET=$${CLOUD_JWT_SECRET:-export-only} \
	  python3 -c "\
import json, os, sys; \
sys.path.insert(0,'.'); \
from cloud.main import create_app; \
app = create_app(); \
open('docs/api/cloud_openapi.json','w').write(json.dumps(app.openapi(), indent=2)); \
print('Cloud OpenAPI → docs/api/cloud_openapi.json')"

# --------------------------------------------------------------------------
# Cleanup
# --------------------------------------------------------------------------

clean:  ## Remove Python cache files and temp build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
