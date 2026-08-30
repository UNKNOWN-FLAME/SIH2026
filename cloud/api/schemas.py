"""Pydantic response schemas for the HQ Dashboard REST API (Phase 5)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, computed_field

from shared.utils.time import utcnow

T = TypeVar("T")


class AlertOut(BaseModel):
    alert_id: str
    station_id: str
    severity: str
    domain: str
    asset_id: Optional[str] = None
    triggered_at: datetime
    description: str
    ack_state: str
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    black_box_activated: bool = False
    synced_to_cloud: bool = False

    @computed_field
    @property
    def duration_open_s(self) -> float:
        if self.resolved_at:
            return (self.resolved_at - self.triggered_at).total_seconds()
        return (utcnow() - self.triggered_at).total_seconds()

    model_config = {"from_attributes": True}


class StationConnectionOut(BaseModel):
    station_id: str
    display_name: str
    link_state: str           # UP | DEGRADED | DOWN
    last_heartbeat_at: Optional[datetime] = None
    queue_depth_bytes: Optional[int] = None
    open_critical_alerts: Optional[int] = None
    open_high_alerts: Optional[int] = None
    services_healthy: Optional[bool] = None
    minutes_since_heartbeat: Optional[float] = None

    model_config = {"from_attributes": True}


class SensorSummaryOut(BaseModel):
    station_id: str
    sensor_id: str
    domain: str
    latest_value: Optional[float] = None
    latest_unit: Optional[str] = None
    latest_ts: Optional[datetime] = None
    readings_count_24h: int


class AnalyticsOut(BaseModel):
    station_id: str
    period_hours: float
    alert_counts_by_severity: Dict[str, int]  # CRITICAL/HIGH/MEDIUM/LOW → count
    total_readings: int
    avg_readings_per_hour: float
    open_alerts_total: int


class DashboardSummaryOut(BaseModel):
    stations: List[StationConnectionOut]
    total_open_critical: int
    total_open_high: int
    total_open_alerts: int
    generated_at: datetime


class PaginatedResponse(BaseModel, Generic[T]):
    total: int
    page: int
    page_size: int
    items: List[Any]


class AlertAcknowledgeIn(BaseModel):
    acknowledged_by: str
