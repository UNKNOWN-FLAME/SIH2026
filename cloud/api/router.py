"""HQ Dashboard REST API — Phase 5.

All endpoints are under /api/v1/hq/ and provide a global view across
both Antarctic research stations for the NCPOR HQ operations team.

Endpoints:
  GET  /api/v1/hq/dashboard                       Global summary
  GET  /api/v1/hq/stations                        All station statuses
  GET  /api/v1/hq/stations/{station_id}/status    Single station status
  GET  /api/v1/hq/alerts                          Paginated alerts (all stations)
  GET  /api/v1/hq/alerts/{alert_id}               Alert detail
  PATCH /api/v1/hq/alerts/{alert_id}/acknowledge  Acknowledge alert from HQ
  GET  /api/v1/hq/stations/{station_id}/sensors   Latest sensor readings
  GET  /api/v1/hq/stations/{station_id}/sensors/{sensor_id}  Sensor history
  GET  /api/v1/hq/stations/{station_id}/analytics 24h analytics
  GET  /api/v1/hq/health                          Health check
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.models.cloud import StationConnection
from shared.db.models.edge import Alert, SensorReading
from shared.utils.time import utcnow
from cloud.api.schemas import (
    AlertAcknowledgeIn,
    AlertOut,
    AnalyticsOut,
    DashboardSummaryOut,
    PaginatedResponse,
    SensorSummaryOut,
    StationConnectionOut,
)
from cloud.auth.deps import get_current_user, require_operator
from cloud.config import get_config
from cloud.deps import get_db_session

log = structlog.get_logger(__name__)

# All HQ endpoints require a valid JWT — applied at router level
router = APIRouter(
    prefix="/api/v1/hq",
    tags=["hq-dashboard"],
    dependencies=[Depends(get_current_user)],
)


_STATION_DISPLAY = {
    "maitri": "Maitri Research Station",
    "bharati": "Bharati Research Station",
}


def _station_display(station_id: str) -> str:
    return _STATION_DISPLAY.get(station_id, station_id.title())


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardSummaryOut)
async def get_dashboard(
    session: AsyncSession = Depends(get_db_session),
) -> DashboardSummaryOut:
    """Return global health summary across all stations."""
    cfg = get_config()
    station_outs = []
    total_critical = total_high = total_open = 0

    for sid in cfg.station_ids:
        conn_result = await session.execute(
            select(StationConnection).where(StationConnection.station_id == sid)
        )
        conn = conn_result.scalar_one_or_none()

        # Count open alerts
        for sev, target in [("CRITICAL", "critical"), ("HIGH", "high")]:
            cnt_result = await session.execute(
                select(func.count(Alert.alert_id))
                .where(Alert.station_id == sid)
                .where(Alert.severity == sev)
                .where(Alert.ack_state != "RESOLVED")
            )
            n = cnt_result.scalar_one() or 0
            if sev == "CRITICAL":
                total_critical += n
            else:
                total_high += n

        total_result = await session.execute(
            select(func.count(Alert.alert_id))
            .where(Alert.station_id == sid)
            .where(Alert.ack_state != "RESOLVED")
        )
        total_open += total_result.scalar_one() or 0

        if conn:
            minutes_since = None
            if conn.last_heartbeat_at:
                delta = utcnow() - conn.last_heartbeat_at.replace(tzinfo=timezone.utc)
                minutes_since = delta.total_seconds() / 60
            station_outs.append(StationConnectionOut(
                station_id=sid,
                display_name=_station_display(sid),
                link_state=conn.link_state,
                last_heartbeat_at=conn.last_heartbeat_at,
                queue_depth_bytes=conn.queue_depth_bytes,
                open_critical_alerts=conn.open_critical_alerts,
                open_high_alerts=conn.open_high_alerts,
                services_healthy=conn.services_healthy,
                minutes_since_heartbeat=minutes_since,
            ))
        else:
            station_outs.append(StationConnectionOut(
                station_id=sid,
                display_name=_station_display(sid),
                link_state="DOWN",
                last_heartbeat_at=None,
                queue_depth_bytes=None,
                open_critical_alerts=None,
                open_high_alerts=None,
                services_healthy=None,
                minutes_since_heartbeat=None,
            ))

    return DashboardSummaryOut(
        stations=station_outs,
        total_open_critical=total_critical,
        total_open_high=total_high,
        total_open_alerts=total_open,
        generated_at=utcnow(),
    )


# ---------------------------------------------------------------------------
# Stations
# ---------------------------------------------------------------------------

@router.get("/stations", response_model=List[StationConnectionOut])
async def list_stations(
    session: AsyncSession = Depends(get_db_session),
) -> List[StationConnectionOut]:
    result = await session.execute(select(StationConnection))
    rows = result.scalars().all()
    out = []
    for r in rows:
        minutes_since = None
        if r.last_heartbeat_at:
            delta = utcnow() - r.last_heartbeat_at.replace(tzinfo=timezone.utc)
            minutes_since = delta.total_seconds() / 60
        out.append(StationConnectionOut(
            station_id=r.station_id,
            display_name=_station_display(r.station_id),
            link_state=r.link_state,
            last_heartbeat_at=r.last_heartbeat_at,
            queue_depth_bytes=r.queue_depth_bytes,
            open_critical_alerts=r.open_critical_alerts,
            open_high_alerts=r.open_high_alerts,
            services_healthy=r.services_healthy,
            minutes_since_heartbeat=minutes_since,
        ))
    return out


@router.get("/stations/{station_id}/status", response_model=StationConnectionOut)
async def get_station_status(
    station_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> StationConnectionOut:
    result = await session.execute(
        select(StationConnection).where(StationConnection.station_id == station_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Station {station_id!r} not found")
    minutes_since = None
    if row.last_heartbeat_at:
        delta = utcnow() - row.last_heartbeat_at.replace(tzinfo=timezone.utc)
        minutes_since = delta.total_seconds() / 60
    return StationConnectionOut(
        station_id=row.station_id,
        display_name=_station_display(row.station_id),
        link_state=row.link_state,
        last_heartbeat_at=row.last_heartbeat_at,
        queue_depth_bytes=row.queue_depth_bytes,
        open_critical_alerts=row.open_critical_alerts,
        open_high_alerts=row.open_high_alerts,
        services_healthy=row.services_healthy,
        minutes_since_heartbeat=minutes_since,
    )


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=PaginatedResponse)
async def list_alerts(
    station_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    ack_state: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse:
    q = select(Alert)
    if station_id:
        q = q.where(Alert.station_id == station_id)
    if severity:
        q = q.where(Alert.severity == severity.upper())
    if ack_state:
        q = q.where(Alert.ack_state == ack_state.upper())

    total = (await session.execute(
        select(func.count()).select_from(q.subquery())
    )).scalar_one() or 0

    q = q.order_by(Alert.triggered_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await session.execute(q)).scalars().all()

    return PaginatedResponse(
        total=total, page=page, page_size=page_size,
        items=[AlertOut.model_validate(r) for r in rows],
    )


@router.get("/alerts/{alert_id}", response_model=AlertOut)
async def get_alert(
    alert_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> AlertOut:
    result = await session.execute(select(Alert).where(Alert.alert_id == alert_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Alert {alert_id!r} not found")
    return AlertOut.model_validate(row)


@router.patch("/alerts/{alert_id}/acknowledge", response_model=AlertOut)
async def acknowledge_alert(
    alert_id: str,
    body: AlertAcknowledgeIn,
    session: AsyncSession = Depends(get_db_session),
    _op: dict = Depends(require_operator),
) -> AlertOut:
    result = await session.execute(select(Alert).where(Alert.alert_id == alert_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Alert {alert_id!r} not found")
    if row.ack_state == "RESOLVED":
        raise HTTPException(409, "Alert already resolved")
    row.ack_state = "ACKNOWLEDGED"
    row.acknowledged_by = body.acknowledged_by
    row.acknowledged_at = utcnow()
    await session.commit()
    await session.refresh(row)
    log.info("cloud.api.alert_acknowledged", alert_id=alert_id, by=body.acknowledged_by)
    return AlertOut.model_validate(row)


# ---------------------------------------------------------------------------
# Sensors
# ---------------------------------------------------------------------------

@router.get("/stations/{station_id}/sensors", response_model=List[SensorSummaryOut])
async def get_latest_sensors(
    station_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> List[SensorSummaryOut]:
    """Latest reading + 24h count per sensor for one station."""
    cutoff_24h = utcnow() - timedelta(hours=24)
    cutoff_5m = utcnow() - timedelta(minutes=5)

    # Latest value per sensor (last 5 min)
    latest_subq = (
        select(
            SensorReading.sensor_id,
            func.max(SensorReading.timestamp_utc).label("max_ts"),
        )
        .where(SensorReading.station_id == station_id)
        .where(SensorReading.timestamp_utc >= cutoff_5m)
        .group_by(SensorReading.sensor_id)
        .subquery()
    )
    latest_result = await session.execute(
        select(SensorReading)
        .join(
            latest_subq,
            (SensorReading.sensor_id == latest_subq.c.sensor_id)
            & (SensorReading.timestamp_utc == latest_subq.c.max_ts),
        )
    )
    latest_rows = {r.sensor_id: r for r in latest_result.scalars().all()}

    # 24h count per sensor
    count_result = await session.execute(
        select(SensorReading.sensor_id, func.count(SensorReading.id).label("cnt"))
        .where(SensorReading.station_id == station_id)
        .where(SensorReading.timestamp_utc >= cutoff_24h)
        .group_by(SensorReading.sensor_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    out = []
    for sensor_id, r in latest_rows.items():
        out.append(SensorSummaryOut(
            station_id=station_id,
            sensor_id=sensor_id,
            domain=r.domain,
            latest_value=r.value,
            latest_unit=r.unit,
            latest_ts=r.timestamp_utc,
            readings_count_24h=counts.get(sensor_id, 0),
        ))
    return sorted(out, key=lambda x: x.sensor_id)


@router.get("/stations/{station_id}/sensors/{sensor_id}", response_model=List[dict])
async def get_sensor_history(
    station_id: str,
    sensor_id: str,
    hours: float = Query(24.0, ge=0.1, le=720.0),
    session: AsyncSession = Depends(get_db_session),
) -> List[dict]:
    cutoff = utcnow() - timedelta(hours=hours)
    result = await session.execute(
        select(SensorReading)
        .where(SensorReading.station_id == station_id)
        .where(SensorReading.sensor_id == sensor_id)
        .where(SensorReading.timestamp_utc >= cutoff)
        .order_by(SensorReading.timestamp_utc)
        .limit(10000)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(404, f"No data for sensor {sensor_id!r}")
    return [
        {
            "timestamp_utc": r.timestamp_utc.isoformat(),
            "value": r.value,
            "unit": r.unit,
            "quality": r.quality,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/stations/{station_id}/analytics", response_model=AnalyticsOut)
async def get_analytics(
    station_id: str,
    hours: float = Query(24.0, ge=1.0, le=720.0),
    session: AsyncSession = Depends(get_db_session),
) -> AnalyticsOut:
    cutoff = utcnow() - timedelta(hours=hours)
    alert_counts: dict = {}
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        cnt = (await session.execute(
            select(func.count(Alert.alert_id))
            .where(Alert.station_id == station_id)
            .where(Alert.severity == sev)
            .where(Alert.triggered_at >= cutoff)
        )).scalar_one() or 0
        alert_counts[sev] = cnt

    open_total = (await session.execute(
        select(func.count(Alert.alert_id))
        .where(Alert.station_id == station_id)
        .where(Alert.ack_state != "RESOLVED")
    )).scalar_one() or 0

    total_readings = (await session.execute(
        select(func.count(SensorReading.id))
        .where(SensorReading.station_id == station_id)
        .where(SensorReading.timestamp_utc >= cutoff)
    )).scalar_one() or 0

    return AnalyticsOut(
        station_id=station_id,
        period_hours=hours,
        alert_counts_by_severity=alert_counts,
        total_readings=total_readings,
        avg_readings_per_hour=total_readings / max(hours, 1),
        open_alerts_total=open_total,
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "service": "cloud-hq-api", "version": "1.0.0"}
