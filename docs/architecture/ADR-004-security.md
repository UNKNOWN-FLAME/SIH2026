# ADR-004: Authentication & Security Architecture

**Date:** 2026-08-29  
**Status:** Accepted  
**Authors:** VajraX Team  
**Affected systems:** Edge Backend, Cloud Backend, HQ Dashboard API

---

## Context

VajraX operates in two distinct security environments:

1. **Edge (Antarctic station)** — runs on a local network inside the research station. Physically isolated. May have no internet for weeks. Must authenticate crew members with **zero dependency on any remote service**.

2. **Cloud (NCPOR HQ, Goa)** — internet-connected. Hosts the HQ Dashboard API consumed by operations managers, scientists, and administrators. Standard HTTPS + JWT model is appropriate.

These different environments require different authentication strategies.

---

## Decisions

### D1 — Edge: Offline Pre-Provisioned API Keys

**Chosen:** Pre-shared API keys embedded in station YAML config (`local_api_keys`).

**Format:** `ROLE.hex_secret` where hex_secret is 32 random bytes (256-bit entropy).

**Validation:** Constant-time HMAC comparison (`hmac.compare_digest`) to prevent timing attacks.

**Rationale:**
- Works fully offline — no token server, no network call
- Rotated manually at each resupply expedition (∼once/year in Antarctica)
- Simple enough for station crew to manage over a serial terminal
- Role hierarchy embedded in key: `CREW < OPERATOR < ADMIN`

**Rejected alternatives:**
- **mTLS client certs** — complex to rotate at a remote station; CA infrastructure required
- **JWT with local signing** — adds key management overhead with no benefit over pre-shared keys for a closed station LAN
- **No auth** — rejected; the Edge API controls safety-critical operations (manual alert resolution, inventory updates)

**Key generation:** `python3 -c "from edge.auth.local_auth import generate_api_key; print(generate_api_key('OPERATOR'))"`

**Rotation procedure:** Generate new keys → update YAML → `docker-compose restart edge` (no downtime for sensors).

---

### D2 — Cloud: HS256 JWT with Refresh Token Rotation

**Chosen:** JWT access tokens (1-hour expiry) + opaque UUID refresh tokens (7-day, stored in Redis).

**Algorithm:** HS256 (HMAC-SHA256). For production, upgrade to RS256 with a HSM-stored private key.

**Secret source:** `CLOUD_JWT_SECRET` environment variable (injected by Docker secrets / Kubernetes secret).

**Token claims:**
```json
{
  "sub":   "<user_id>",
  "uname": "<username>",
  "roles": ["OPERATOR"],
  "exp":   1756400000,
  "iat":   1756396400,
  "jti":   "<uuid4>"
}
```

**Refresh token revocation:** Stored as Redis keys (`cloud:refresh_token:<uuid>`) with TTL. `/logout` deletes the key → instant revocation without a revocation list.

**Rationale:**
- Standard approach for web APIs; well-understood by operations teams
- Short access token lifetime (1h) limits blast radius if a token is leaked over satellite
- Refresh tokens in Redis allow instant revocation when a staff member leaves NCPOR
- `jti` (JWT ID) in access tokens enables future revocation list support if needed

**Rejected alternatives:**
- **Session cookies** — incompatible with REST API clients and mobile dashboards
- **OAuth2 with external IdP** — adds dependency on an internet service; HQ must also work during partial outages

---

### D3 — Role-Based Access Control (RBAC)

**Edge roles** (enforced at Edge API level):

| Role     | Can access                                          |
|----------|-----------------------------------------------------|
| CREW     | GET all endpoints (read-only)                      |
| OPERATOR | CREW + acknowledge alerts, resolve alerts, update inventory |
| ADMIN    | OPERATOR + future: config push, sync control        |

**Cloud roles** (enforced at HQ API level):

| Role      | Can access                                                    |
|-----------|---------------------------------------------------------------|
| VIEWER    | GET all dashboard endpoints (read-only)                       |
| OPERATOR  | VIEWER + acknowledge alerts from HQ                          |
| ADMIN     | OPERATOR + user management, station config entries            |
| SCIENTIST | VIEWER + sensor history, analytics (scoped for research access)|

---

### D4 — Transport Security

- **Edge → Station crew** (LAN): HTTP is acceptable for local-only LAN access. TLS optional but recommended.
- **Edge → Cloud** (satellite): MQTT over TLS (port 8883). Dev: plain MQTT via toxiproxy on port 18883/18884.
- **Cloud → HQ users** (internet): HTTPS enforced by HSTS header (`max-age=31536000; includeSubDomains`).
- **MQTT wire integrity**: Every SyncEnvelope is Ed25519-signed at the Edge. The Cloud receiver verifies before processing. This prevents replay attacks and tampering even if the MQTT broker is compromised.

---

### D5 — Audit Logging

All Cloud API requests are logged via `AuditLogMiddleware`:
- Every request: `cloud.audit.request` — method, path, status, duration, username, IP, request_id
- Every mutation (POST/PATCH/PUT/DELETE on `/api/v1/*`): `cloud.audit.mutation` at WARNING level

Logs flow into the structured JSON pipeline (structlog). In production, ship to a SIEM (e.g., Elastic Stack or Splunk) for compliance and forensics.

Edge mutations (alert acknowledge/resolve) are logged by the alert engine service and the API router.

---

## Security Properties

| Threat                          | Mitigation                                                   |
|---------------------------------|--------------------------------------------------------------|
| Replay attack (satellite)       | Ed25519 signature over zstd-compressed payload; timestamp in envelope |
| MQTT tampering                  | Ed25519 signature; Cloud rejects on verification failure     |
| Edge key theft                  | Keys rotated at resupply; HMAC comparison prevents brute-force |
| JWT interception (HQ)           | 1h access token lifetime; HSTS; refresh token revocation     |
| Timing attack on key comparison | `hmac.compare_digest` in `KeyStore.lookup()`                |
| CSRF on Cloud API               | REST + Bearer tokens are CSRF-immune (no cookie auth)        |
| Clickjacking                    | `X-Frame-Options: DENY`                                     |
| MIME sniffing                   | `X-Content-Type-Options: nosniff`                           |
| Sensitive data caching          | `Cache-Control: no-store` on all `/api/` responses          |

---

## Open Items (Future)

- [ ] Upgrade Cloud JWT to RS256 with HSM-stored key (Phase 9 — Production Hardening)
- [ ] Add `jti` revocation list in Redis for immediate access token invalidation
- [ ] mTLS for MQTT in production (mosquitto + station client certs)
- [ ] Rate limiting on Cloud auth endpoints (prevent brute-force on `/api/v1/auth/token`)
- [ ] Station key provisioning automation for new expedition deployments
