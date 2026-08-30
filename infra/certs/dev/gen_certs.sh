#!/usr/bin/env bash
# VajraX Dev Certificate Generator
# Generates self-signed CA + server cert + per-station client certs for mTLS.
# FOR DEVELOPMENT ONLY — never use these certs in production.
#
# Usage: bash infra/certs/dev/gen_certs.sh
# Output: infra/certs/dev/{ca,server,maitri,bharati}.{crt,key}

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUT="$SCRIPT_DIR"

echo "[VajraX] Generating dev certificates in: $OUT"

# --------------------------------------------------------------------------
# 1. Certificate Authority
# --------------------------------------------------------------------------
openssl genrsa -out "$OUT/ca.key" 4096
openssl req -new -x509 -days 3650 -key "$OUT/ca.key" \
  -out "$OUT/ca.crt" \
  -subj "/C=IN/O=VajraX-Dev/CN=VajraX-Dev-CA"
echo "[VajraX] CA certificate: $OUT/ca.crt"

# --------------------------------------------------------------------------
# 2. MQTT Broker (server) certificate
# --------------------------------------------------------------------------
openssl genrsa -out "$OUT/server.key" 2048
openssl req -new -key "$OUT/server.key" \
  -out "$OUT/server.csr" \
  -subj "/C=IN/O=VajraX-Dev/CN=vajrax-mosquitto"
openssl x509 -req -days 365 \
  -in "$OUT/server.csr" \
  -CA "$OUT/ca.crt" \
  -CAkey "$OUT/ca.key" \
  -CAcreateserial \
  -out "$OUT/server.crt" \
  -extfile <(echo 'subjectAltName=DNS:mosquitto-cloud,DNS:localhost,IP:127.0.0.1')
echo "[VajraX] Server certificate: $OUT/server.crt"

# --------------------------------------------------------------------------
# Helper: generate a station client certificate
# --------------------------------------------------------------------------
gen_station_cert() {
  local station="$1"
  openssl genrsa -out "$OUT/${station}.key" 2048
  openssl req -new -key "$OUT/${station}.key" \
    -out "$OUT/${station}.csr" \
    -subj "/C=IN/O=VajraX-Dev/CN=${station}-sync-agent"
  openssl x509 -req -days 365 \
    -in "$OUT/${station}.csr" \
    -CA "$OUT/ca.crt" \
    -CAkey "$OUT/ca.key" \
    -CAcreateserial \
    -out "$OUT/${station}.crt"
  rm "$OUT/${station}.csr"
  echo "[VajraX] Station cert (${station}): $OUT/${station}.crt"
}

gen_station_cert maitri
gen_station_cert bharati

# Cleanup
rm -f "$OUT/server.csr" "$OUT/ca.srl"

echo ""
echo "[VajraX] Dev certificates generated successfully."
echo "         CA:      $OUT/ca.crt"
echo "         Server:  $OUT/server.crt / server.key"
echo "         Maitri:  $OUT/maitri.crt / maitri.key"
echo "         Bharati: $OUT/bharati.crt / bharati.key"
echo ""
echo "WARNING: These are development-only self-signed certificates."
echo "         Do NOT use in production."
