import api from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardData {
  total_stations: number
  online_stations: number
  total_open_alerts: number
  critical_alerts: number
  high_alerts: number
  generated_at: string
}

export interface StationStatus {
  station_id: string
  display_name: string
  link_state: 'UP' | 'DEGRADED' | 'DOWN'
  last_heartbeat_at: string | null
  queue_depth_bytes: number | null
  open_critical_alerts: number | null
  open_high_alerts: number | null
  services_healthy: boolean | null
  minutes_since_heartbeat: number | null
}

export interface AlertOut {
  alert_id: string
  station_id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  domain: string
  asset_id: string | null
  triggered_at: string
  description: string
  ack_state: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  black_box_activated: boolean
  synced_to_cloud: boolean
  duration_open_s: number
}

export interface PaginatedAlerts {
  items: AlertOut[]
  total: number
  page: number
  page_size: number
}

export interface SensorSummary {
  station_id: string
  sensor_id: string
  domain: string
  latest_value: number | null
  latest_unit: string | null
  latest_ts: string | null
  readings_count_24h: number
}

export interface AnalyticsOut {
  station_id: string
  period_hours: number
  avg_values: Record<string, number>
  min_values: Record<string, number>
  max_values: Record<string, number>
  reading_counts: Record<string, number>
}

export interface HealthOut {
  status: string
  station_id?: string
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /hq/dashboard — global summary */
export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/hq/dashboard')
  return data
}

/** GET /hq/health */
export async function getHealth(): Promise<HealthOut> {
  const { data } = await api.get<HealthOut>('/hq/health')
  return data
}

/** GET /hq/stations */
export async function getStations(): Promise<StationStatus[]> {
  const { data } = await api.get<StationStatus[]>('/hq/stations')
  return data
}

/** GET /hq/stations/{station_id}/status */
export async function getStationStatus(stationId: string): Promise<StationStatus> {
  const { data } = await api.get<StationStatus>(`/hq/stations/${stationId}/status`)
  return data
}

/** GET /hq/alerts */
export async function getAlerts(params?: {
  station_id?: string
  ack_state?: string
  domain?: string
  severity?: string
  page?: number
  page_size?: number
}): Promise<PaginatedAlerts> {
  const { data } = await api.get<PaginatedAlerts>('/hq/alerts', { params })
  return data
}

/** GET /hq/stations/{station_id}/sensors */
export async function getSensors(
  stationId: string,
  domain?: string,
): Promise<SensorSummary[]> {
  const { data } = await api.get<SensorSummary[]>(
    `/hq/stations/${stationId}/sensors`,
    { params: domain ? { domain } : undefined },
  )
  return data
}

/** GET /hq/stations/{station_id}/sensors/{sensor_id} */
export async function getSensor(
  stationId: string,
  sensorId: string,
): Promise<SensorSummary> {
  const { data } = await api.get<SensorSummary>(
    `/hq/stations/${stationId}/sensors/${encodeURIComponent(sensorId)}`,
  )
  return data
}

/** GET /hq/stations/{station_id}/analytics */
export async function getAnalytics(
  stationId: string,
  periodHours = 24,
): Promise<AnalyticsOut> {
  const { data } = await api.get<AnalyticsOut>(
    `/hq/stations/${stationId}/analytics`,
    { params: { period_hours: periodHours } },
  )
  return data
}

/** POST /hq/alerts/{alert_id}/acknowledge */
export async function acknowledgeAlert(alertId: string, note?: string): Promise<AlertOut> {
  const { data } = await api.post<AlertOut>(`/hq/alerts/${alertId}/acknowledge`, {
    note: note ?? 'Acknowledged via dashboard',
  })
  return data
}
