import api from './client'

// ── Types ────────────────────────────────────────────────────────────────────

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

export interface DashboardSummaryOut {
  stations: StationStatus[]
  total_open_critical: number
  total_open_high: number
  total_open_alerts: number
  generated_at: string
}
export type DashboardData = DashboardSummaryOut

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
  alert_counts_by_severity: Record<string, number>
  total_readings: number
  avg_readings_per_hour: number
  open_alerts_total: number
}

export interface InventoryItem {
  item_id: string
  station_id: string
  category: string
  name: string
  quantity: number
  unit: string
  min_safety_threshold: number | null
  daily_burn_rate: number | null
  days_remaining: number | null
  last_updated: string | null
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL'
}

export interface AssetOut {
  asset_id: string
  station_id: string
  asset_type: string
  name: string
  latitude: number | null
  longitude: number | null
  elevation_m: number | null
  status: string
  commissioned_at: string | null
}

export interface ResupplyLineItem {
  line_item_id: string
  item_name: string
  quantity_delivered: number
  unit: string
}

export interface ResupplyManifest {
  manifest_id: string
  station_id: string
  expedition_name: string | null
  voyage_year: number
  ship_name: string | null
  departure_date: string | null
  arrival_window_start: string | null
  arrival_window_end: string | null
  status: 'PLANNED' | 'IN_TRANSIT' | 'DELIVERED'
  notes: string | null
  line_items: ResupplyLineItem[]
}

export interface AIPrediction {
  prediction_id: string
  station_id: string
  model_name: string
  target_metric: string
  predicted_value: number | null
  confidence_lower: number | null
  confidence_upper: number | null
  risk_level: string
  predicted_for_date: string | null
  generated_at: string
}

export interface HealthOut {
  status: string
  service?: string
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardSummaryOut> {
  const { data } = await api.get<DashboardSummaryOut>('/hq/dashboard')
  return data
}

export async function getHealth(): Promise<HealthOut> {
  const { data } = await api.get<HealthOut>('/hq/health')
  return data
}

export async function getStations(): Promise<StationStatus[]> {
  const { data } = await api.get<StationStatus[]>('/hq/stations')
  return data
}

export async function getStationStatus(stationId: string): Promise<StationStatus> {
  const { data } = await api.get<StationStatus>(`/hq/stations/${stationId}/status`)
  return data
}

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

export async function getAlert(alertId: string): Promise<AlertOut> {
  const { data } = await api.get<AlertOut>(`/hq/alerts/${alertId}`)
  return data
}

export async function acknowledgeAlert(alertId: string, note?: string): Promise<AlertOut> {
  const { data } = await api.patch<AlertOut>(`/hq/alerts/${alertId}/acknowledge`, {
    acknowledged_by: note ?? 'HQ Operator',
  })
  return data
}

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

export async function getSensorHistory(
  stationId: string,
  sensorId: string,
  hours = 24,
): Promise<Array<{ timestamp_utc: string; value: number; unit: string; quality: string }>> {
  const { data } = await api.get(
    `/hq/stations/${stationId}/sensors/${encodeURIComponent(sensorId)}`,
    { params: { hours } },
  )
  return data
}

export async function getAnalytics(
  stationId: string,
  periodHours = 24,
): Promise<AnalyticsOut> {
  const { data } = await api.get<AnalyticsOut>(
    `/hq/stations/${stationId}/analytics`,
    { params: { hours: periodHours } },
  )
  return data
}

export async function getInventory(
  stationId: string,
  category?: string,
): Promise<InventoryItem[]> {
  const { data } = await api.get<InventoryItem[]>(
    `/hq/stations/${stationId}/inventory`,
    { params: category ? { category } : undefined },
  )
  return data
}

export async function getAssets(
  stationId: string,
  assetType?: string,
): Promise<AssetOut[]> {
  const { data } = await api.get<AssetOut[]>(
    `/hq/stations/${stationId}/assets`,
    { params: assetType ? { asset_type: assetType } : undefined },
  )
  return data
}

export async function getResupply(stationId?: string): Promise<ResupplyManifest[]> {
  const { data } = await api.get<ResupplyManifest[]>(
    '/hq/resupply',
    { params: stationId ? { station_id: stationId } : undefined },
  )
  return data
}

export async function getPredictions(stationId: string): Promise<AIPrediction[]> {
  const { data } = await api.get<AIPrediction[]>(
    `/hq/stations/${stationId}/predictions`,
  )
  return data
}

export async function getReportData(
  reportType: string,
  stationId?: string,
): Promise<Record<string, unknown>> {
  const { data } = await api.get<Record<string, unknown>>('/hq/report', {
    params: { report_type: reportType, ...(stationId ? { station_id: stationId } : {}) },
  })
  return data
}

export async function downloadReportFile(
  reportType: string,
  stationId?: string,
): Promise<{ filename: string; content: string }> {
  const { data } = await api.get<{ filename: string; content: string }>(
    '/hq/report/download',
    { params: { report_type: reportType, ...(stationId ? { station_id: stationId } : {}) } },
  )
  return data
}

// ── 3-Hour RCA Station PDF Reports ───────────────────────────────────────────

export interface StationReportMeta {
  has_report: boolean
  prediction_id: string | null
  station_id: string
  risk_level?: string
  target_metric?: string
  model_name?: string
  generated_at?: string | null
  predicted_for_date?: string | null
  filename?: string | null
  file_exists?: boolean
  event_count?: number
  download_url?: string | null
  message?: string
}

export interface StationReportListItem {
  prediction_id: string
  station_id: string
  risk_level: string
  generated_at: string | null
  predicted_for_date: string | null
  filename: string | null
  event_count: number
  download_url: string
}

export async function getLatestReportMeta(stationId: string = 'bharati'): Promise<StationReportMeta> {
  const { data } = await api.get<StationReportMeta>('/hq/reports/latest/metadata', {
    params: { station_id: stationId },
  })
  return data
}

export async function downloadLatestPdfReport(stationId: string = 'bharati'): Promise<string> {
  const response = await api.get('/hq/reports/latest/download', {
    params: { station_id: stationId },
    responseType: 'blob',
  })

  // Extract filename from Content-Disposition header if available
  const cd = response.headers['content-disposition'] || ''
  let filename = `NCPOR_Report_${stationId}.pdf`
  const match = cd.match(/filename=["']?([^"';]+)["']?/)
  if (match && match[1]) {
    filename = match[1]
  }

  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return filename
}

export async function downloadPdfReportById(predictionId: string, fallbackName?: string): Promise<string> {
  const response = await api.get(`/hq/reports/${predictionId}/download`, {
    responseType: 'blob',
  })

  const cd = response.headers['content-disposition'] || ''
  let filename = fallbackName || `NCPOR_Report_${predictionId}.pdf`
  const match = cd.match(/filename=["']?([^"';]+)["']?/)
  if (match && match[1]) {
    filename = match[1]
  }

  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return filename
}

export async function listStationPdfReports(stationId: string = 'bharati', limit: number = 10): Promise<StationReportListItem[]> {
  const { data } = await api.get<StationReportListItem[]>('/hq/reports/list', {
    params: { station_id: stationId, limit },
  })
  return data
}

// ── Logistics Audit Summary ───────────────────────────────────────────────────

export interface AuditItemDetail {
  item_id: string
  name: string
  current_stock: number
  unit: string
  reorder_qty: number
  min_safe: number
  daily_use: string
  days_left: number
  status: 'SAFE' | 'WARNING' | 'CRITICAL'
}

export interface CategoryAudit {
  last_verified_by: string
  last_verified_at: string
  verified: boolean
  pending_maitri: boolean
  pending_bharati: boolean
}

export interface LogisticsCategoryData {
  total_items: number
  items: AuditItemDetail[]
  audit: CategoryAudit
}

export interface LogisticsAuditSummary {
  station_id: string
  categories: {
    food: LogisticsCategoryData
    fuel: LogisticsCategoryData
    medical: LogisticsCategoryData
    spares: LogisticsCategoryData
  }
  generated_at: string
  data_source: string
}

export async function getLogisticsAuditSummary(
  stationId: string,
): Promise<LogisticsAuditSummary> {
  const { data } = await api.get<LogisticsAuditSummary>(
    '/hq/logistics/audit-summary',
    { params: { station_id: stationId } },
  )
  return data
}

// ── IoT Sensor Registry ───────────────────────────────────────────────────────

export interface SensorParameter {
  key: string
  label: string
  value: number | string
  unit: string
  normal_range: string
}

export interface IoTSensor {
  sensor_id: string
  name: string
  category: string
  icon: string
  state: 'online' | 'offline'
  location: string
  parameters: SensorParameter[]
}

export interface IoTCategory {
  key: string
  label: string
  icon: string
}

export interface IoTSensorResponse {
  station_id: string
  sensors: IoTSensor[]
  total: number
  online: number
  offline: number
  categories: IoTCategory[]
  generated_at: string
  data_source: string
}

export async function getIoTSensors(
  stationId: string,
  category?: string,
  state?: string,
): Promise<IoTSensorResponse> {
  const { data } = await api.get<IoTSensorResponse>('/hq/iot/sensors', {
    params: {
      station_id: stationId,
      ...(category ? { category } : {}),
      ...(state ? { state } : {}),
    },
  })
  return data
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

export interface ChatQueryOut {
  response: string
}

export async function sendChatQuery(query: string): Promise<ChatQueryOut> {
  const { data } = await api.post<ChatQueryOut>('/hq/chat', { query })
  return data
}

// ── Telemetry & Black Box Rollup API ─────────────────────────────────────────

export interface CompressionRollupResult {
  station_id: string
  executed_at: string
  status: string
  safe_ring_buffer_hours: number
  raw_readings_evaluated: number
  decimated_aggregates_created: number
  raw_readings_pruned: number
  archived_records_over_7d: number
  blackbox_windows_protected: number
  estimated_kb_saved: number
  compression_ratio_pct: number
}

export async function triggerCompressionRollup(stationId: string): Promise<CompressionRollupResult> {
  const { data } = await api.post<CompressionRollupResult>(`/hq/stations/${stationId}/telemetry/compress-rollup`)
  return data
}

export async function getStationBlackBoxRollupIncidents(stationId: string): Promise<any[]> {
  const { data } = await api.get<any[]>(`/hq/stations/${stationId}/blackbox/incidents`)
  return data
}

export async function getTelemetryTimeline(stationId: string, hours = 168): Promise<any> {
  const { data } = await api.get<any>(`/hq/stations/${stationId}/telemetry/timeline`, { params: { hours } })
  return data
}

// ── Predictive AI & ML APIs ───────────────────────────────────────────────────

export interface MicrogridHourlyPoint {
  hour_offset: number
  time_label: string
  clock: string
  load_kw: number
  solar_kw: number
  wind_kw: number
  gen_kw: number
  battery_soc_pct: number
}

export interface EnergyForecastOut {
  station_id: string
  generated_at: string
  model_type: string
  model_r2: number
  current_load_kw: number
  current_solar_kw: number
  current_wind_kw: number
  current_battery_soc: number
  hourly_timeline: MicrogridHourlyPoint[]
}

export interface FuelHorizon {
  label: string
  val: string
  icon: string
}

export interface FuelForecastOut {
  station_id: string
  remaining_litres: number
  capacity_litres: number
  fuel_pct: number
  daily_burn_litres: number
  days_of_autonomy: number
  resupply_date: string
  trend: string
  burn_history_7d: number[]
  burn_labels: string[]
  model_confidence_pct: number
  horizons: FuelHorizon[]
}

export interface AnomalyLogItem {
  id: string
  time: string
  sensor: string
  value: string
  baseline: string
  deviation: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'MONITORING' | 'RESOLVED'
  model: string
}

export interface EquipmentAnomaliesOut {
  station_id: string
  anomalies_today: number
  model_accuracy_pct: number
  false_positive_rate_pct: number
  sensors_monitored: number
  logs: AnomalyLogItem[]
}

export interface MaintenanceItem {
  id: string
  asset: string
  task: string
  due: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  trigger: string
  confidence: number
}

export interface PredictiveMaintenanceOut {
  station_id: string
  upcoming_7d: number
  overdue: number
  ai_recommendations: number
  mtbf_dg1_hours: number
  schedule: MaintenanceItem[]
}

export interface WeatherDayEnsemble {
  name: string
  offset: number
  date: string
  temp: number
  gust: number
  blizzard_prob_pct: number
  solar_wm2: number
  pressure_hpa: number
  safety_status: 'OPTIMAL' | 'ADVISORY' | 'CAUTION' | 'NO-GO'
  icon: string
  synoptic: string
}

export interface WeatherEnsembleOut {
  station_id: string
  generated_at: string
  model_ensemble: string
  days: WeatherDayEnsemble[]
}

export async function getEnergyForecast(stationId: string): Promise<EnergyForecastOut> {
  const { data } = await api.get<EnergyForecastOut>(`/hq/stations/${stationId}/analytics/energy-forecast`)
  return data
}

export async function getFuelForecast(stationId: string): Promise<FuelForecastOut> {
  const { data } = await api.get<FuelForecastOut>(`/hq/stations/${stationId}/analytics/fuel-forecast`)
  return data
}

export async function getEquipmentAnomalies(stationId: string): Promise<EquipmentAnomaliesOut> {
  const { data } = await api.get<EquipmentAnomaliesOut>(`/hq/stations/${stationId}/analytics/anomalies`)
  return data
}

export async function getMaintenanceSchedule(stationId: string): Promise<PredictiveMaintenanceOut> {
  const { data } = await api.get<PredictiveMaintenanceOut>(`/hq/stations/${stationId}/analytics/maintenance-schedule`)
  return data
}

export async function getWeatherEnsemble(stationId: string): Promise<WeatherEnsembleOut> {
  const { data } = await api.get<WeatherEnsembleOut>(`/hq/stations/${stationId}/analytics/weather-ensemble`)
  return data
}

// ── Anomaly Injection Engine ──────────────────────────────────────────────────

export interface AnomalyDefinition {
  id: string
  name: string
  icon: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: string
  description: string
  estimated_duration_s: number
  impacts: string[]
  recovery_steps: string[]
}

export interface AnomalyRegistryOut {
  anomalies: AnomalyDefinition[]
  total: number
  generated_at: string
}

export interface AnomalyInjectionResult {
  status: string
  anomaly_id: string
  anomaly_name: string
  station_id: string
  severity: string
  category: string
  description: string
  impacts: string[]
  recovery_steps: string[]
  injected_at: string
  ended_at?: string
  report_reference: string
  incident_id?: string
  alert_id?: string | null
  connected?: boolean
  edge_buffered?: boolean
  buffered_frames_count?: number
  message?: string
  pdf_download_ready: boolean
  pdf_download_url: string
  simulation_note: string
}

export interface LinkStateResponse {
  station_id: string
  link_state: 'UP' | 'DOWN' | 'DEGRADED'
  edge_buffer_count: number
  is_online: boolean
}

export interface SyncBufferResponse {
  synced: boolean
  flushed_frames_count: number
  chain_verified: boolean
  sha256_verification?: string
  station_id: string
  incident_id?: string
  message: string
}

export interface BlackBoxIncidentItem {
  id: string
  station_id: 'maitri' | 'bharati'
  title: string
  severity: 'CRITICAL' | 'HIGH'
  incident_timestamp: string
  pre_window_hours: number
  post_window_hours: number
  hash_chain_signature: string
  root_cause: string
  affected_subsystems: string[]
  sitrep_number: string
  sensor_deltas: Array<{ sensor: string; before: string; atIncident: string; after: string }>
}

export interface BlackBoxIncidentsResponse {
  total: number
  incidents: BlackBoxIncidentItem[]
}

export async function getAnomalyRegistry(): Promise<AnomalyRegistryOut> {
  const { data } = await api.get<AnomalyRegistryOut>('/hq/anomaly/registry')
  return data
}

export async function injectAnomaly(
  anomalyId: string,
  stationId: string,
): Promise<AnomalyInjectionResult> {
  const { data } = await api.post<AnomalyInjectionResult>('/hq/anomaly/inject', null, {
    params: { anomaly_id: anomalyId, station_id: stationId },
  })
  return data
}

export async function clearAnomaly(
  stationId: string,
): Promise<{ status: string; station_id: string; message: string }> {
  const { data } = await api.post<{ status: string; station_id: string; message: string }>(
    '/hq/anomaly/clear',
    null,
    { params: { station_id: stationId } },
  )
  return data
}

export async function getStationLinkState(stationId: string): Promise<LinkStateResponse> {
  const { data } = await api.get<LinkStateResponse>(`/hq/stations/${stationId}/link-state`)
  return data
}

export async function setStationLinkState(
  stationId: string,
  linkState: 'UP' | 'DOWN',
): Promise<LinkStateResponse> {
  const { data } = await api.post<LinkStateResponse>(`/hq/stations/${stationId}/link-state`, null, {
    params: { link_state: linkState },
  })
  return data
}

export async function syncEdgeBuffer(stationId: string): Promise<SyncBufferResponse> {
  const { data } = await api.post<SyncBufferResponse>(`/hq/stations/${stationId}/sync-edge-buffer`)
  return data
}

export async function getBlackBoxIncidents(stationId?: string): Promise<BlackBoxIncidentsResponse> {
  const { data } = await api.get<BlackBoxIncidentsResponse>('/hq/blackbox/incidents', {
    params: stationId ? { station_id: stationId } : undefined,
  })
  return data
}


export interface PredictionV2 {
  model_name: string
  metric: string
  val: number
  risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'DEFICIT'
  data: any
}

export interface PredictionsV2Out {
  station_id: string
  generated_at: string
  predictions: PredictionV2[]
}

export async function getPredictionsV2(stationId: string): Promise<PredictionsV2Out> {
  const { data } = await api.get<PredictionsV2Out>(`/hq/stations/${stationId}/analytics/predictions-v2`)
  return data
}

// ── Bharati Digital Twin & Physics Telemetry ─────────────────────────────────

export interface DigitalTwinStateOut {
  station: string
  timestamp: string
  status?: string
  environment: {
    state?: string
    katabatic_active?: boolean
    ambient_temperature_c: number
    wind_chill_c: number
    wind_speed_ms: number
    pressure_hpa: number
    humidity_percent: number
    solar_radiation_wm2: number
  }
  power: {
    grid_status: string
    grid_voltage: number
    grid_frequency: number
    total_load_kw: number
    total_thermal_supplied_kw: number
    total_fuel_consumption_L_hr?: number
    generators: Record<string, {
      state: string
      load_kw: number
      rpm?: number
      voltage?: number
      oil_pressure_bar?: number
      oil_viscosity_pct?: number
      coolant_temp_c?: number
      fuel_flow_L_hr?: number
      fuel_rail_pressure_bar?: number
      exhaust_gas_temp_c?: number
      vibration_mms?: number
      thermal_output_kw?: number
      operating_hours?: number
    }>
  }
  fuel: {
    main_farm_level_L: number
    day_tank_level_L: number
    autonomy_days: number
    fuel_temp_c?: number
    viscosity_cSt?: number
    pumps?: Record<string, any>
    electrical_demand_kw?: number
  }
  water: {
    tank_level_L: number
    is_running?: boolean
    intake_pipe_temp_c?: number
    intake_blocked?: boolean
    permeate_tds_ppm?: number
    tank_tds_ppm?: number
    tank_ph?: number
    electrical_demand_kw?: number
  }
  wastewater?: {
    greywater_tank_L?: number
    technical_water_tank_L?: number
    blackwater_tank_L?: number
    mbr_tank_L?: number
    bacteria_health_pct?: number
    pathogen_alarm?: boolean
    discharge_frozen?: boolean
  }
  hvac?: {
    total_heat_demand_kw?: number
    total_electrical_demand_kw?: number
    glycol_supply_temp_c?: number
    glycol_return_temp_c?: number
    glycol_pressure_bar?: number
    dhw_tank_temp_c?: number
    zones?: Record<string, {
      temp_c: number
      perceived_temp_c?: number
      heat_demand_kw?: number
      ahu?: Record<string, any>
    }>
  }
  human?: {
    occupancy: number
    pmv?: number
    fatigue_index?: number
    hrp?: number
    co2_l_s?: number
  }
  vehicles?: {
    fleet: Record<string, {
      state: string
      speed_kmh?: number
      fuel_level_L?: number
      engine_block_temp_c?: number
      battery_temp_c?: number
      cabin_temp_c?: number
    }>
  }
  communication?: {
    status?: string
    geo_link_status?: string
    geo_bandwidth_mbps?: number
    leo_pass_active?: boolean
    leo_timer_s?: number
    san_used_gb?: number
    san_capacity_gb?: number
    san_utilization_pct?: number
  }
  inventory?: {
    food_stock_kg?: number
    pharma?: Record<string, any>
    spares?: Record<string, any>
    active_repairs?: any[]
  }
  faults?: Record<string, any>
}

export async function getDigitalTwinState(stationId: string): Promise<DigitalTwinStateOut> {
  const { data } = await api.get<DigitalTwinStateOut>(`/hq/stations/${stationId}/digital-twin`)
  return data
}

export async function triggerDigitalTwinFault(
  stationId: string,
  faultId: string,
  severity = 1.0,
): Promise<{ status: string; message: string }> {
  const { data } = await api.post(`/hq/stations/${stationId}/digital-twin/fault`, null, {
    params: { fault_id: faultId, severity },
  })
  return data
}

export async function dispatchDigitalTwinWorkOrder(
  stationId: string,
  faultId: string,
): Promise<{ status: string; message: string }> {
  const { data } = await api.post(`/hq/stations/${stationId}/digital-twin/repair`, null, {
    params: { fault_id: faultId },
  })
  return data
}

