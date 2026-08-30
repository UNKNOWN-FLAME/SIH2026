#!/usr/bin/env python3
"""
VajraX — Pure-Python Standalone Dev Server
============================================
Zero external dependencies. Uses ONLY Python standard library.
Works with any Python 3.8+ on any machine.

Run:   python3 dev_server.py
Open:  http://localhost:5173  (frontend, start separately)
       http://localhost:8200  (API)

Login: admin / admin123
"""
import base64
import hashlib
import hmac
import json
import time
import uuid
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional
from urllib.parse import urlparse, parse_qs

# ─────────────────────────────────────────────────────────────────────────────
# MINIMAL JWT — pure stdlib
# ─────────────────────────────────────────────────────────────────────────────
JWT_SECRET  = "dev_secret_key_vajrax_2026"
JWT_EXP_SEC = 3600

def _b64url_enc(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_dec(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def jwt_create(payload: dict) -> str:
    h = _b64url_enc(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    b = _b64url_enc(json.dumps(payload).encode())
    sig = hmac.new(JWT_SECRET.encode(), f"{h}.{b}".encode(), hashlib.sha256).digest()
    return f"{h}.{b}.{_b64url_enc(sig)}"

def jwt_decode(token: str) -> Optional[dict]:
    try:
        h, b, sig = token.split(".")
        expected = hmac.new(JWT_SECRET.encode(), f"{h}.{b}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_dec(sig), expected):
            return None
        payload = json.loads(_b64url_dec(b))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY STORE
# ─────────────────────────────────────────────────────────────────────────────
def _hash(pw: str) -> str:
    return "sha:" + hashlib.sha256(pw.encode()).hexdigest()

USERS = {
    "admin": {
        "user_id": "uid-admin-001", "username": "admin",
        "email": "admin@vajrax.ncpor.gov.in",
        "_pw": _hash("admin123"), "roles": ["ADMIN"],
        "is_active": True, "created_at": "2026-01-01T00:00:00Z",
    },
    "operator": {
        "user_id": "uid-op-001", "username": "operator",
        "email": "operator@vajrax.ncpor.gov.in",
        "_pw": _hash("operator123"), "roles": ["OPERATOR"],
        "is_active": True, "created_at": "2026-01-01T00:00:00Z",
    },
}

REFRESH_TOKENS: dict = {}  # token → user_id

NOW = datetime.now(timezone.utc).isoformat()

STATIONS = {
    "maitri": {
        "station_id": "maitri", "display_name": "Maitri Research Station",
        "link_state": "UP", "last_heartbeat_at": NOW,
        "queue_depth_bytes": 0, "open_critical_alerts": 1, "open_high_alerts": 2,
        "services_healthy": True, "minutes_since_heartbeat": 1,
    },
    "bharati": {
        "station_id": "bharati", "display_name": "Bharati Research Station",
        "link_state": "DEGRADED", "last_heartbeat_at": NOW,
        "queue_depth_bytes": 1024, "open_critical_alerts": 0, "open_high_alerts": 1,
        "services_healthy": True, "minutes_since_heartbeat": 5,
    },
}

SENSORS = {
    "maitri": [
        {"station_id":"maitri","sensor_id":"maitri.weather.ext.temperature","domain":"weather","latest_value":-18.4,"latest_unit":"°C","latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.weather.ext.wind_speed",  "domain":"weather","latest_value":32.1, "latest_unit":"km/h","latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.weather.ext.wind_dir",    "domain":"weather","latest_value":247.0,"latest_unit":"°",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.weather.ext.pressure",    "domain":"weather","latest_value":983.2,"latest_unit":"hPa", "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.weather.ext.solar_rad",   "domain":"weather","latest_value":142.0,"latest_unit":"W/m²","latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.energy.gen1.load",        "domain":"energy", "latest_value":84.0, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.energy.solar.output",     "domain":"energy", "latest_value":23.5, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.energy.battery.storage",  "domain":"energy", "latest_value":67.2, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"maitri","sensor_id":"maitri.energy.fuel.fuel_pct",    "domain":"energy", "latest_value":42.0, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
    ],
    "bharati": [
        {"station_id":"bharati","sensor_id":"bharati.weather.ext.temperature","domain":"weather","latest_value":-12.1,"latest_unit":"°C", "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.weather.ext.wind_speed", "domain":"weather","latest_value":18.7, "latest_unit":"km/h","latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.weather.ext.wind_dir",   "domain":"weather","latest_value":192.0,"latest_unit":"°",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.weather.ext.pressure",   "domain":"weather","latest_value":991.0,"latest_unit":"hPa", "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.weather.ext.solar_rad",  "domain":"weather","latest_value":98.0, "latest_unit":"W/m²","latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.energy.gen1.load",       "domain":"energy", "latest_value":71.0, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.energy.solar.output",    "domain":"energy", "latest_value":18.0, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.energy.battery.storage", "domain":"energy", "latest_value":81.5, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
        {"station_id":"bharati","sensor_id":"bharati.energy.fuel.fuel_pct",   "domain":"energy", "latest_value":61.0, "latest_unit":"%",   "latest_ts":NOW,"readings_count_24h":1440},
    ],
}

ALERTS = [
    {"alert_id":"alert-001","station_id":"maitri","severity":"CRITICAL","domain":"energy","asset_id":"gen1","triggered_at":"2026-08-30T01:00:00Z","description":"Generator 1 load exceeding 80% threshold — sustained for 2 hours","ack_state":"OPEN","acknowledged_by":None,"acknowledged_at":None,"resolved_at":None,"black_box_activated":True,"synced_to_cloud":True,"duration_open_s":7200},
    {"alert_id":"alert-002","station_id":"maitri","severity":"HIGH","domain":"weather","asset_id":None,"triggered_at":"2026-08-30T02:00:00Z","description":"Wind speed 32 km/h — approaching storm threshold of 35 km/h","ack_state":"OPEN","acknowledged_by":None,"acknowledged_at":None,"resolved_at":None,"black_box_activated":False,"synced_to_cloud":True,"duration_open_s":3600},
    {"alert_id":"alert-003","station_id":"maitri","severity":"HIGH","domain":"energy","asset_id":"fuel-tank-1","triggered_at":"2026-08-30T03:00:00Z","description":"Diesel fuel level at 42% — resupply recommended within 30 days","ack_state":"ACKNOWLEDGED","acknowledged_by":"admin","acknowledged_at":"2026-08-30T03:15:00Z","resolved_at":None,"black_box_activated":False,"synced_to_cloud":True,"duration_open_s":1800},
    {"alert_id":"alert-004","station_id":"bharati","severity":"HIGH","domain":"network","asset_id":None,"triggered_at":"2026-08-30T00:00:00Z","description":"Satellite uplink degraded — packet loss 15%","ack_state":"OPEN","acknowledged_by":None,"acknowledged_at":None,"resolved_at":None,"black_box_activated":False,"synced_to_cloud":True,"duration_open_s":14400},
]

ANALYTICS = {
    "maitri":  {"station_id":"maitri", "period_hours":24,"avg_values":{"temperature":-18.2,"wind_speed":29.4,"load":81.3,"fuel_pct":43.5},"min_values":{"temperature":-22.1,"wind_speed":12.0,"load":71.0,"fuel_pct":42.0},"max_values":{"temperature":-14.3,"wind_speed":38.5,"load":91.2,"fuel_pct":45.0},"reading_counts":{"temperature":1440,"wind_speed":1440,"load":1440,"fuel_pct":1440}},
    "bharati": {"station_id":"bharati","period_hours":24,"avg_values":{"temperature":-11.8,"wind_speed":17.2,"load":68.5,"fuel_pct":62.1},"min_values":{"temperature":-15.0,"wind_speed":8.0, "load":60.0,"fuel_pct":61.0},"max_values":{"temperature":-8.5, "wind_speed":25.0,"load":78.0,"fuel_pct":63.5},"reading_counts":{"temperature":1440,"wind_speed":1440,"load":1440,"fuel_pct":1440}},
}

# ─────────────────────────────────────────────────────────────────────────────
# HTTP REQUEST HANDLER
# ─────────────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path}  →  {args[1]}")

    def _send(self, code: int, data, content_type="application/json"):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8") if not isinstance(data, bytes) else data
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code: int, msg: str):
        self._send(code, {"detail": msg})

    def _body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(length)) if length else {}
        except Exception:
            return {}

    def _auth(self) -> Optional[dict]:
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        return jwt_decode(header[7:])

    def do_OPTIONS(self):
        self._send(204, b"", "text/plain")

    def do_GET(self):    self._route("GET")
    def do_POST(self):   self._route("POST")
    def do_DELETE(self): self._route("DELETE")

    def _route(self, method: str):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")
        qs     = parse_qs(parsed.query)

        def qp(k, default=None):
            return qs.get(k, [default])[0]

        # ── Health ────────────────────────────────────────────────────────────
        if method == "GET" and path == "/health":
            return self._send(200, {"status": "ok", "service": "vajrax-cloud-dev",
                                    "stations": list(STATIONS.keys())})

        if method == "GET" and path == "/api/v1/hq/health":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            return self._send(200, {"status": "ok"})

        # ── Auth: login ───────────────────────────────────────────────────────
        if method == "POST" and path == "/api/v1/auth/token":
            body = self._body()
            uname = body.get("username", "")
            user  = USERS.get(uname)
            if not user or user["_pw"] != _hash(body.get("password", "")):
                return self._err(401, "Invalid credentials")
            payload = {
                "sub": user["user_id"], "uname": uname, "roles": user["roles"],
                "exp": int(time.time()) + JWT_EXP_SEC, "iat": int(time.time()),
                "jti": str(uuid.uuid4()),
            }
            token   = jwt_create(payload)
            refresh = str(uuid.uuid4())
            REFRESH_TOKENS[refresh] = user["user_id"]
            return self._send(200, {
                "access_token": token, "token_type": "bearer",
                "expires_in": JWT_EXP_SEC, "refresh_token": refresh,
            })

        # ── Auth: refresh ─────────────────────────────────────────────────────
        if method == "POST" and path == "/api/v1/auth/refresh":
            body = self._body()
            rt   = body.get("refresh_token", "")
            uid  = REFRESH_TOKENS.get(rt)
            if not uid: return self._err(401, "Invalid refresh token")
            user = next((u for u in USERS.values() if u["user_id"] == uid), None)
            if not user: return self._err(401, "User not found")
            payload = {"sub": uid, "uname": user["username"], "roles": user["roles"],
                       "exp": int(time.time()) + JWT_EXP_SEC, "iat": int(time.time()), "jti": str(uuid.uuid4())}
            return self._send(200, {"access_token": jwt_create(payload), "token_type": "bearer", "expires_in": JWT_EXP_SEC})

        # ── Auth: logout ──────────────────────────────────────────────────────
        if method == "POST" and path == "/api/v1/auth/logout":
            body = self._body()
            REFRESH_TOKENS.pop(body.get("refresh_token", ""), None)
            return self._send(200, {"detail": "Logged out"})

        # ── Auth: me ──────────────────────────────────────────────────────────
        if method == "GET" and path == "/api/v1/auth/me":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            user = USERS.get(u.get("uname", ""))
            if not user: return self._err(404, "User not found")
            return self._send(200, {k: v for k, v in user.items() if k != "_pw"})

        # ── Auth: list users ──────────────────────────────────────────────────
        if method == "GET" and path == "/api/v1/auth/users":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            if "ADMIN" not in u.get("roles", []): return self._err(403, "Admin required")
            return self._send(200, [{k: v for k, v in usr.items() if k != "_pw"} for usr in USERS.values()])

        # ── HQ: dashboard ─────────────────────────────────────────────────────
        if method == "GET" and path == "/api/v1/hq/dashboard":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            open_a   = [a for a in ALERTS if a["ack_state"] == "OPEN"]
            critical = [a for a in open_a if a["severity"] == "CRITICAL"]
            high     = [a for a in open_a if a["severity"] == "HIGH"]
            return self._send(200, {
                "stations": list(STATIONS.values()),
                "total_open_critical": len(critical),
                "total_open_high": len(high),
                "total_open_alerts": len(open_a),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            })

        # ── HQ: stations list ─────────────────────────────────────────────────
        if method == "GET" and path == "/api/v1/hq/stations":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            return self._send(200, list(STATIONS.values()))

        # ── HQ: station status ────────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/stations/([^/]+)/status", path)
        if m and method == "GET":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            sid = m.group(1)
            s = STATIONS.get(sid)
            if not s: return self._err(404, f"Station {sid!r} not found")
            return self._send(200, s)

        # ── HQ: sensors ───────────────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/stations/([^/]+)/sensors", path)
        if m and method == "GET":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            sid     = m.group(1)
            domain  = qp("domain")
            sensors = SENSORS.get(sid, [])
            if domain:
                sensors = [s for s in sensors if s["domain"] == domain]
            return self._send(200, sensors)

        # ── HQ: single sensor ─────────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/stations/([^/]+)/sensors/(.+)", path)
        if m and method == "GET":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            sid, sensor_id = m.group(1), m.group(2)
            sensors = SENSORS.get(sid, [])
            s = next((s for s in sensors if s["sensor_id"] == sensor_id), None)
            if not s: return self._err(404, f"Sensor {sensor_id!r} not found")
            return self._send(200, s)

        # ── HQ: analytics ─────────────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/stations/([^/]+)/analytics", path)
        if m and method == "GET":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            sid = m.group(1)
            a = ANALYTICS.get(sid)
            if not a: return self._err(404, f"Station {sid!r} not found")
            ph = int(qp("period_hours", "24"))
            return self._send(200, {**a, "period_hours": ph})

        # ── HQ: alerts list ───────────────────────────────────────────────────
        if method == "GET" and path == "/api/v1/hq/alerts":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            items = list(ALERTS)
            if qp("station_id"): items = [a for a in items if a["station_id"] == qp("station_id")]
            if qp("ack_state"):  items = [a for a in items if a["ack_state"]  == qp("ack_state")]
            if qp("severity"):   items = [a for a in items if a["severity"]   == qp("severity")]
            if qp("domain"):     items = [a for a in items if a["domain"]     == qp("domain")]
            page      = int(qp("page", "1"))
            page_size = int(qp("page_size", "20"))
            total     = len(items)
            start     = (page - 1) * page_size
            return self._send(200, {"total": total, "page": page, "page_size": page_size, "items": items[start:start + page_size]})

        # ── HQ: single alert ──────────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/alerts/([^/]+)", path)
        if m and method == "GET":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            aid = m.group(1)
            a = next((a for a in ALERTS if a["alert_id"] == aid), None)
            if not a: return self._err(404, f"Alert {aid!r} not found")
            return self._send(200, a)

        # ── HQ: acknowledge alert ─────────────────────────────────────────────
        m = re.fullmatch(r"/api/v1/hq/alerts/([^/]+)/acknowledge", path)
        if m and method == "POST":
            u = self._auth()
            if not u: return self._err(401, "Not authenticated")
            aid = m.group(1)
            a = next((a for a in ALERTS if a["alert_id"] == aid), None)
            if not a: return self._err(404, f"Alert {aid!r} not found")
            a["ack_state"]       = "ACKNOWLEDGED"
            a["acknowledged_by"] = u.get("uname", "unknown")
            a["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
            return self._send(200, a)

        # ── 404 ───────────────────────────────────────────────────────────────
        self._err(404, f"Route not found: {method} {path}")


# ─────────────────────────────────────────────────────────────────────────────
# START SERVER
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    PORT = 8200
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print("\n" + "=" * 58)
    print("  VajraX Dev Server  (pure Python — no pip needed)")
    print("=" * 58)
    print(f"  Backend API : http://localhost:{PORT}")
    print(f"  Frontend    : http://localhost:5173")
    print()
    print("  Login: admin / admin123")
    print("=" * 58)
    print("  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
