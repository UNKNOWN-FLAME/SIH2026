import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { usePredictionsV2, useWeatherEnsemble } from '../hooks/usePredictiveAI'
import { useSensors } from '../hooks/useSensors'
import { generateWeatherMissionReportPDF } from '../utils/pdfGenerator'

// ── Types ─────────────────────────────────────────────────────────────────────

type StationId = 'maitri' | 'bharati'
type RiskLevel = 'NOMINAL' | 'WARNING' | 'CRITICAL'
type PageTab = 'predictions' | 'weather'

interface Prediction {
  model_name: string
  metric: string
  val: number
  risk: RiskLevel
  data: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeWindChill(tempC: number, windKmh: number): number {
  if (windKmh < 5) return tempC
  return 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16)
}

function riskColor(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#dc2626'
  if (risk === 'WARNING') return '#d97706'
  return '#16a34a'
}
function riskBg(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#fef2f2'
  if (risk === 'WARNING') return '#fffbeb'
  return '#f0fdf4'
}
function riskBorder(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#fecaca'
  if (risk === 'WARNING') return '#fde68a'
  return '#bbf7d0'
}

// ── Spark bars (CSS only) ─────────────────────────────────────────────────────

function SparkBars({ data, accentColor, risk }: { data: number[]; accentColor: string; risk: RiskLevel }) {
  const max = Math.max(...data, 1)
  const barColor = risk === 'CRITICAL' ? '#dc2626' : risk === 'WARNING' ? '#d97706' : accentColor
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 56, gap: 3 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', height: `${Math.max(6, (v / max) * 52)}px`, background: i === data.length - 1 ? barColor : `${barColor}99`, borderRadius: '2px 2px 0 0', transition: 'height 0.4s' }} />
          <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>D+{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

function RiskPill({ risk }: { risk: RiskLevel }) {
  const icons: Record<RiskLevel, string> = { NOMINAL: '✓', WARNING: '⚠', CRITICAL: '!' }
  return (
    <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 8px', background: riskBg(risk), color: riskColor(risk), border: `1px solid ${riskBorder(risk)}`, borderRadius: 3, letterSpacing: '0.04em' }}>
      {icons[risk]} {risk}
    </span>
  )
}

function ActionBox({ risk, actions }: { risk: RiskLevel; actions: { WARNING: string[]; CRITICAL: string[] } }) {
  if (risk === 'NOMINAL') return null
  const steps = actions[risk] || []
  return (
    <div style={{ background: riskBg(risk), border: `1px solid ${riskBorder(risk)}`, borderLeft: `4px solid ${riskColor(risk)}`, padding: '10px 14px', marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: riskColor(risk), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{risk === 'CRITICAL' ? 'emergency' : 'warning'}</span>
        {risk === 'CRITICAL' ? 'CRITICAL — Immediate Action Required' : 'Action Advisory'}
      </div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ fontSize: 11, color: '#334155', marginBottom: 4, lineHeight: 1.5, fontWeight: 600 }}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

// ── KPI strip card ────────────────────────────────────────────────────────────

function KpiStrip({ label, value, unit, risk, icon }: { label: string; value: string; unit: string; risk: RiskLevel; icon: string }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: `3px solid ${riskColor(risk)}`, padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: riskColor(risk) }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: riskColor(risk), lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{unit}</div>
    </div>
  )
}

// ── Prediction panel config ───────────────────────────────────────────────────

interface PanelConfig {
  id: string; title: string; subtitle: string; icon: string; accentColor: string; modelName: string
  formatValue: (p: Prediction) => { main: string; unit: string }
  sub1Label: string; sub1Value: (p: Prediction) => string
  sub2Label: string; sub2Value: (p: Prediction) => string
  sparkData: (p: Prediction) => number[]
  actions: { WARNING: string[]; CRITICAL: string[] }
}

const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: 'fuel', title: 'Fuel Depletion Forecast', subtitle: '7-Day Burn Rate Extrapolation',
    icon: 'local_gas_station', accentColor: '#ea580c', modelName: 'FuelDepletion',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToCritical ?? p.val)}`, unit: 'days to 30% reserve' }),
    sub1Label: 'Days to Empty', sub1Value: (p) => `${Math.round(p.data.daysToEmpty ?? 0)} days`,
    sub2Label: 'Projected Burn', sub2Value: (p) => `${Math.round(p.data.forecastedBurnDay7 ?? 0)} L/day`,
    sparkData: (p) => { const base = p.data.daysToEmpty ?? 100; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * (p.data.forecastedBurnDay7 ?? 1240) / 1000)) },
    actions: {
      WARNING: ['Issue resupply order to NCPOR logistics (45-day sea transit window)', 'Curtail non-essential heating & auxiliary generator circuits by 10%', 'Transmit daily burn variance report to NCPOR Mission Control'],
      CRITICAL: ['Enforce Station Order 7B: Strict fuel rationing across all quarters', 'Shed non-life-support loads; consolidate crew into insulated Zone A', 'Alert NCPOR Director for emergency air-drop fuel flight logistics', 'Operate main generators at peak-efficiency load factor only'],
    },
  },
  {
    id: 'energy', title: 'Energy Load Prediction', subtitle: 'Thermal Degree-Days & Microgrid Model',
    icon: 'bolt', accentColor: '#7c3aed', modelName: 'EnergyLoad',
    formatValue: (p) => ({ main: `${Math.round(p.data.load_kw ?? p.val)}`, unit: 'kW predicted demand' }),
    sub1Label: 'Grid Margin', sub1Value: (p) => { const d = p.data.deficit ?? 0; return d > 0 ? `−${Math.round(d)} kW deficit` : `+${Math.round(Math.abs(d))} kW reserve` },
    sub2Label: 'Status', sub2Value: (p) => (p.data.deficit ?? 0) > 0 ? 'OVER CAPACITY' : 'WITHIN LIMITS',
    sparkData: () => [162, 168, 172, 175, 170, 165, 160],
    actions: {
      WARNING: ['Shift scientific lab heating and heavy battery charging to off-peak hours', 'Pre-warm backup generator DG-2 block heater for rapid grid dispatch', 'Maintain main battery bank State of Charge (SoC) above 65%'],
      CRITICAL: ['Immediate load-shedding: Disconnect auxiliary workshops and non-critical labs', 'Synchronize DG-2 to main bus for parallel load sharing', 'Notify Station Commander of imminent electrical reserve breach', 'Suspend all outdoor field science equipment charging'],
    },
  },
  {
    id: 'generator', title: 'Generator Remaining Life', subtitle: 'Weibull Degradation & Bearing Model',
    icon: 'engineering', accentColor: '#0284c7', modelName: 'GeneratorRUL',
    formatValue: (p) => ({ main: `${Math.round(p.data.RUL_hours ?? p.val)}`, unit: 'hours useful life' }),
    sub1Label: 'Confidence', sub1Value: () => '94% Weibull fit',
    sub2Label: 'Operating Hours', sub2Value: () => '2,180 hrs',
    sparkData: (p) => { const base = p.data.RUL_hours ?? 2300; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 24)) },
    actions: {
      WARNING: ['Schedule DG-1 bearing & lube overhaul within the next 7 days', 'Verify DG-2 automatic transfer switch (ATS) and fuel prime readiness', 'Increase vibration sensor polling from 1h to 15m intervals'],
      CRITICAL: ['Shutdown DG-1 immediately; transfer base electrical load to DG-2', 'Perform non-destructive inspection of alternator bearings and injectors', 'Requisition expedited replacement filters and injectors from NCPOR Goa', 'Enforce single-genset conservation protocol across station'],
    },
  },
  {
    id: 'blizzard', title: 'Blizzard Probability', subtitle: 'Synoptic Logistic Storm Classifier',
    icon: 'severe_cold', accentColor: '#0369a1', modelName: 'BlizzardProb',
    formatValue: (p) => ({ main: `${(p.data.blizzard_prob_pct ?? p.val).toFixed(1)}`, unit: '% blizzard probability' }),
    sub1Label: 'Wind Input', sub1Value: () => '35 km/h',
    sub2Label: 'Barometer Gradient', sub2Value: () => '−1.2 hPa/hr',
    sparkData: (p) => { const base = p.data.blizzard_prob_pct ?? 40; return [base * 0.6, base * 0.75, base * 0.9, base, base * 1.1, base * 0.95, base * 0.7].map(v => Math.min(100, Math.max(0, v))) },
    actions: {
      WARNING: ['Lash down external scientific sensors, solar mounts, and sledges', 'Mandatory 2-person buddy system and Level-2 thermal PPE for transit', 'Verify HF radio link and satellite transceiver emergency power reserves', 'Stage emergency blizzard rations at remote observation huts'],
      CRITICAL: ['Level-3 Station Lockdown: All exterior transit strictly prohibited', 'Lock all module egress doors; transit allowed only via lifeline guide ropes', 'Stow Ku-band satellite tracking dish to 90° survival position', 'Operate HVAC in internal circulation mode to prevent drift silt intake'],
    },
  },
  {
    id: 'water', title: 'Water Sustainability', subtitle: 'Cryo-Melt Yield vs. Crew Demand',
    icon: 'water_drop', accentColor: '#0891b2', modelName: 'WaterSustainability',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToRefillNeeded ?? p.val)}`, unit: 'days supply buffer' }),
    sub1Label: 'Net Balance', sub1Value: (p) => `${(p.data.netDailyChange ?? 0).toFixed(1)} L/day`,
    sub2Label: 'Tank Storage', sub2Value: () => '15,000 L',
    sparkData: (p) => { const base = p.data.daysToRefillNeeded ?? 60; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 2)) },
    actions: {
      WARNING: ['Operate snowmelt heat exchanger at full thermal capacity', 'Limit crew hygiene water allocation to 2 minutes per personnel per day', 'Inspect pipeline trace heating along freshwater delivery lines'],
      CRITICAL: ['Emergency Water Rationing: Potable cooking and hydration only', 'Maximize waste-heat snowmelt units to 100% emergency duty cycle', 'Halt all non-essential sanitation, cleaning, and chemical lab testing', 'Alert NCPOR HQ for emergency water logistics contingency'],
    },
  },
  {
    id: 'structural', title: 'Structural Load Assessment', subtitle: 'Drift Pack & Wind Pressure Vector',
    icon: 'domain', accentColor: '#475569', modelName: 'StructuralStress',
    formatValue: (p) => ({ main: `${(p.data.stressPercent ?? p.val).toFixed(1)}`, unit: '% of design threshold' }),
    sub1Label: 'Combined Load', sub1Value: (p) => `${(p.data.totalLoad ?? 0).toFixed(2)} kPa`,
    sub2Label: 'Safety Limit', sub2Value: () => '6.0 kPa',
    sparkData: (p) => { const base = p.data.stressPercent ?? 45; return Array.from({ length: 7 }, (_, i) => Math.min(100, base + i * 2.5)) },
    actions: {
      WARNING: ['Deploy PistenBully snow clearing blade to leeward drift accumulators', 'Energize thermal de-icing cables along load-bearing roof purlins', 'Inspect exterior steel foundation turnbuckles and guy-wires'],
      CRITICAL: ['Evacuate non-essential personnel from high-stress container modules', 'Perform immediate laser alignment survey of foundation stilt columns', 'Tension backup steel mooring cables to withstand katabatic gusts', 'Submit structural telemetry incident log to NCPOR Structural Engineering'],
    },
  },
]

// ── Prediction card ────────────────────────────────────────────────────────────

function PredictionCard({ config, pred }: { config: PanelConfig; pred: Prediction | undefined }) {
  const risk: RiskLevel = pred?.risk ?? 'NOMINAL'
  const sparkData = pred ? config.sparkData(pred) : [50, 52, 54, 56, 58, 60, 62]
  const fmtVal = pred ? config.formatValue(pred) : { main: '—', unit: '' }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderTop: `3px solid ${config.accentColor}`,
        borderRadius: 4,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: `${config.accentColor}14`,
              border: `1px solid ${config.accentColor}33`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: config.accentColor }}>{config.icon}</span>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', letterSpacing: '0.01em' }}>{config.title}</div>
            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>{config.subtitle}</div>
          </div>
        </div>
        <RiskPill risk={risk} />
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: riskColor(risk), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtVal.main}
          </span>
          {fmtVal.unit && <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{fmtVal.unit}</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.sub1Label}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', marginTop: 1 }}>{pred ? config.sub1Value(pred) : '—'}</div>
          </div>
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
            <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.sub2Label}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', marginTop: 1 }}>{pred ? config.sub2Value(pred) : '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          {/* <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>7-Day Forecast Vector</span> */}
          {/* <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Deterministic Run</span> */}
        </div>
        <SparkBars data={sparkData} accentColor={config.accentColor} risk={risk} />
      </div>

      {pred && <ActionBox risk={risk} actions={config.actions} />}
    </div>
  )
}


// ── 7-Day weather forecast card ───────────────────────────────────────────────

interface ForecastDay {
  name: string; dateStr: string; icon: string; desc: string; temp: number
  minTemp: number; maxTemp: number; wind: number; gust: number; chill: number
  snowProb: number; pres: number; solar: number; synoptic: string
  safetyStatus: 'ALL CLEAR' | 'CAUTION' | 'STORM WARNING'
  heliStatus: 'APPROVED' | 'STANDBY' | 'NO-GO'
  offset: number
}

function WeatherDayCard({ day, isSelected, onClick }: { day: ForecastDay; isSelected: boolean; onClick: () => void }) {
  const statusBg = day.safetyStatus === 'ALL CLEAR' ? '#f0fdf4' : day.safetyStatus === 'CAUTION' ? '#fef3c7' : '#fee2e2'
  const statusColor = day.safetyStatus === 'ALL CLEAR' ? '#15803d' : day.safetyStatus === 'CAUTION' ? '#92400e' : '#b91c1c'
  const statusBorder = day.safetyStatus === 'ALL CLEAR' ? '#86efac' : day.safetyStatus === 'CAUTION' ? '#fde047' : '#fca5a5'
  const statusLabel = day.safetyStatus === 'ALL CLEAR' ? '✓ ALL CLEAR' : day.safetyStatus === 'CAUTION' ? '⚠ CAUTION' : '⊗ LOCKDOWN'
  const iconColor = day.icon === 'sunny' ? '#f59e0b' : day.icon === 'storm' || day.icon === 'cyclone' ? '#ea580c' : '#0284c7'

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)' : '#ffffff',
        border: isSelected ? '2.5px solid #0b3b60' : '1px solid #cbd5e1',
        padding: '14px 12px', minHeight: 240, cursor: 'pointer', position: 'relative',
        display: 'flex', flexDirection: 'column', borderRadius: 4, transition: 'all 0.2s',
        boxShadow: isSelected ? '0 8px 20px rgba(11,59,96,0.16)' : '0 1px 4px rgba(0,0,0,0.05)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
      }}
    >
      {isSelected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#0b3b60', borderRadius: '2px 2px 0 0' }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: isSelected ? '#0b3b60' : '#0f172a' }}>{day.name}</div>
        <span style={{ fontSize: 9.5, color: isSelected ? '#0369a1' : '#64748b', background: isSelected ? '#e0f2fe' : '#f1f5f9', fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{day.dateStr}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', margin: '6px 0 8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: iconColor }}>{day.icon}</span>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#334155', marginTop: 3, lineHeight: 1.2, minHeight: 25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day.desc}</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {day.temp.toFixed(1)}°<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>C</span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, display: 'flex', justifyContent: 'center', gap: 6 }}>
          <span>L: <strong style={{ color: '#0284c7' }}>{day.minTemp.toFixed(0)}°</strong></span>
          <span>•</span>
          <span>H: <strong style={{ color: '#ea580c' }}>{day.maxTemp.toFixed(0)}°</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '4px 6px', fontSize: 9.5, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>air</span>{day.wind} km/h
          </span>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>💨 {Math.round(day.gust)}</span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '4px 6px', fontSize: 9.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#475569' }}>❄️ Snow Risk</span>
            <span style={{ color: day.snowProb > 70 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>{day.snowProb}%</span>
          </div>
          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
            <div style={{ height: '100%', width: `${day.snowProb}%`, background: day.snowProb > 70 ? '#dc2626' : day.snowProb > 40 ? '#f59e0b' : '#10b981' }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, padding: '4px 6px', borderRadius: 3, textAlign: 'center', background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
          {statusLabel}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { stationId, setStationId } = useStation()
  const activeStation = stationId as StationId

  const [pageTab, setPageTab] = useState<PageTab>('weather')
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [selectedHourIdx, setSelectedHourIdx] = useState(12)
  const [stormSim, setStormSim] = useState(false)

  // Prediction data
  const { data: v2Data, isLoading: predLoading, error: predError, refetch: refetchPredictions } = usePredictionsV2(activeStation)

  // Weather data
  const { data: weatherSensors } = useSensors(activeStation, 'weather')
  const { data: weatherEnsData } = useWeatherEnsemble(activeStation)

  const isM = activeStation === 'maitri'
  const liveTemp = (weatherSensors ?? []).find((s) => s.sensor_id.includes('temperature'))?.latest_value ?? (isM ? -15.5 : -12.1)
  const liveWind = (weatherSensors ?? []).find((s) => s.sensor_id.includes('wind_speed'))?.latest_value ?? (isM ? 26.0 : 19.0)
  const stormMultiplier = stormSim ? 1.32 : 1.0

  // 7-day forecast computation (same algorithm as original)
  const forecast7Day: ForecastDay[] = useMemo(() => {
    const today = new Date()
    const daysMeta = [
      { name: 'Today', offset: 0, dT: 0, dW: 0, icon: liveWind * stormMultiplier > 55 ? 'storm' : 'ac_unit', desc: liveWind * stormMultiplier > 55 ? 'Blizzard Surge' : 'Polar Snow Flurry', p: 75, solar: 280, pres: 986, synoptic: 'High-latitude polar air mass over Queen Maud Land. Local katabatic gradient active off the polar plateau.' },
      { name: 'Tomorrow', offset: 1, dT: -2.8, dW: 16, icon: 'storm', desc: 'Katabatic Surge', p: 90, solar: 180, pres: 978, synoptic: 'Severe cyclonic trough migrating from Weddell Sea. Sharp pressure drop with katabatic gusts peaking near 65 km/h.' },
      { name: 'D+2', offset: 2, dT: -1.2, dW: -6, icon: 'partly_cloudy_day', desc: 'Cold Clearing', p: 35, solar: 390, pres: 994, synoptic: 'Post-frontal cold sector stabilization. Cloud cover dissipating with high UV index and excellent visibility.' },
      { name: 'D+3', offset: 3, dT: +2.1, dW: -18, icon: 'sunny', desc: 'Optimal Polar Sun', p: 10, solar: 440, pres: 1002, synoptic: 'Antarctic high ridge dominating inland coast. Calm winds, zero drift, ideal window for heavy scientific fieldwork.' },
      { name: 'D+4', offset: 4, dT: +0.8, dW: +4, icon: 'cloud', desc: 'Ice Fog / Stratus', p: 40, solar: 290, pres: 991, synoptic: 'Moist maritime air advection into Schirmacher Oasis. Stratocumulus layer lowering to 800 ft AGL with ice fog.' },
      { name: 'D+5', offset: 5, dT: -4.2, dW: +24, icon: 'cyclone', desc: 'Polar Low Storm', p: 95, solar: 110, pres: 969, synoptic: 'Deep mesocyclone tracking eastward along Antarctic perimeter. Extreme blizzard hazard and severe rotor turbulence.' },
      { name: 'D+6', offset: 6, dT: -1.8, dW: -8, icon: 'ac_unit', desc: 'Drifting Snow', p: 55, solar: 320, pres: 985, synoptic: 'Residual snow drift settling. Wind speeds moderating back to seasonal baselines.' },
    ]

    return daysMeta.map((d) => {
      const targetDate = new Date(today.getTime() + d.offset * 24 * 60 * 60 * 1000)
      const dateStr = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const weekdayShort = targetDate.toLocaleDateString('en-US', { weekday: 'short' })
      const weekdayLong = targetDate.toLocaleDateString('en-US', { weekday: 'long' })
      const computedName = d.offset === 0 ? `Today (${weekdayShort})` : d.offset === 1 ? `Tomorrow (${weekdayShort})` : weekdayLong

      const ensDay = (weatherEnsData as { days?: { temp: number; gust: number; blizzard_prob_pct: number; solar_wm2: number; pressure_hpa: number; synoptic?: string }[] })?.days?.[d.offset]
      const dayTemp = ensDay ? ensDay.temp : Number((liveTemp + d.dT - (stormSim ? 2.5 : 0)).toFixed(1))
      const dayGust = ensDay ? ensDay.gust : Number((Math.max(12, (liveWind + d.dW) * stormMultiplier) * 1.33).toFixed(1))
      const dayWind = Number((dayGust / 1.33).toFixed(1))
      const dayChill = Number(computeWindChill(dayTemp, dayWind).toFixed(1))
      const daySnowP = ensDay ? ensDay.blizzard_prob_pct : Math.min(100, Math.round(d.p * (stormSim ? 1.2 : 1.0)))
      const daySolar = ensDay ? ensDay.solar_wm2 : d.solar
      const dayPres = ensDay ? ensDay.pressure_hpa : d.pres
      const daySynoptic = ensDay?.synoptic || d.synoptic

      let safetyStatus: 'ALL CLEAR' | 'CAUTION' | 'STORM WARNING' = 'ALL CLEAR'
      let heliStatus: 'APPROVED' | 'STANDBY' | 'NO-GO' = 'APPROVED'
      if (dayGust >= 60 || daySnowP >= 80) { safetyStatus = 'STORM WARNING'; heliStatus = 'NO-GO' }
      else if (dayGust >= 40 || daySnowP >= 50) { safetyStatus = 'CAUTION'; heliStatus = 'STANDBY' }

      return {
        ...d, name: computedName, dateStr, temp: dayTemp,
        minTemp: Number((dayTemp - 3.4).toFixed(1)), maxTemp: Number((dayTemp + 2.6).toFixed(1)),
        wind: dayWind, gust: dayGust, chill: dayChill, snowProb: daySnowP,
        solar: daySolar, pres: dayPres, synoptic: daySynoptic, safetyStatus, heliStatus,
      }
    })
  }, [liveTemp, liveWind, stormMultiplier, stormSim, weatherEnsData])

  const selectedDay = forecast7Day[selectedDayIdx] ?? forecast7Day[0]

  // Hourly data for selected day
  const hourlyData = useMemo(() => {
    const baseT = selectedDay.temp
    const baseW = selectedDay.wind
    return Array.from({ length: 24 }).map((_, hour) => {
      const tSine = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 3.2
      const wSine = Math.cos(((hour - 4) / 24) * 2 * Math.PI) * 12
      const sSine = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * (selectedDay.solar || 300)
      const hTemp = Number((baseT + tSine).toFixed(1))
      const hWind = Math.max(12, Number((baseW + wSine).toFixed(1)))
      const hGust = Number((hWind * 1.34).toFixed(1))
      const hChill = Number(computeWindChill(hTemp, hWind).toFixed(1))
      const hSnow = Math.round(Math.max(5, Math.min(100, selectedDay.snowProb + Math.sin(hour / 3) * 18)))
      const hSolar = Math.round(sSine)
      const hPres = Number(((selectedDay.pres || 988) - Math.sin(hour / 4) * 5).toFixed(1))
      let safety: 'SAFE' | 'CAUTION' | 'RESTRICTED' | 'NO-GO' = 'SAFE'
      if (hGust >= 65 || hSnow >= 80) safety = 'NO-GO'
      else if (hGust >= 45 || hSnow >= 55) safety = 'RESTRICTED'
      else if (hGust >= 30) safety = 'CAUTION'
      let conditionDesc = 'Clear Polar Sky'
      let icon = 'sunny'
      if (hGust >= 65 || hSnow >= 75) { conditionDesc = 'Severe Blizzard'; icon = 'cyclone' }
      else if (hGust >= 45 || hSnow >= 50) { conditionDesc = 'Blowing Katabatic Snow'; icon = 'storm' }
      else if (hSnow >= 30) { conditionDesc = 'Drifting Flurry'; icon = 'ac_unit' }
      else if (hSolar < 50) { conditionDesc = 'Deep Polar Night'; icon = 'bedtime' }
      else { conditionDesc = 'Low-Angle Sun'; icon = 'partly_cloudy_day' }
      return {
        hourIdx: hour,
        hour: `${String(hour).padStart(2, '0')}:00`,
        temp: hTemp,
        wind: hWind,
        gust: hGust,
        chill: hChill,
        snowProb: hSnow,
        solar: hSolar,
        pressure: hPres,
        condition: conditionDesc,
        icon,
        activitySafety: safety,
      }
    })
  }, [selectedDay])

  const activeHour = hourlyData[selectedHourIdx] ?? hourlyData[12]

  const handleDownloadWeatherSITREP = () => {
    generateWeatherMissionReportPDF({
      stationId: activeStation,
      forecast7Day: forecast7Day.map(d => ({
        day: d.name,
        date: d.dateStr,
        highTemp: d.maxTemp,
        lowTemp: d.minTemp,
        condition: d.desc,
        windSpeed: d.wind,
        windGust: d.gust,
        snowProb: d.snowProb,
        blizzardRisk: d.safetyStatus === 'STORM WARNING' ? 'HIGH / ACTIVE' : d.safetyStatus === 'CAUTION' ? 'MODERATE' : 'LOW',
        pressure: d.pres,
        solarHours: Math.round((d.solar / 450) * 12),
        uvIndex: d.solar > 350 ? 4 : 2,
        summary: d.synoptic,
      })),
      hourlyData: hourlyData.map(h => ({
        hour: h.hour,
        temp: h.temp,
        condition: h.condition,
        wind: h.wind,
        gust: h.gust,
        windChill: h.chill,
        blizzardRisk: h.snowProb,
        pressure: h.pressure,
        solarOffset: h.solar,
        activitySafety: h.activitySafety,
      })),
      selectedDay: {
        day: selectedDay.name,
        date: selectedDay.dateStr,
        highTemp: selectedDay.maxTemp,
        lowTemp: selectedDay.minTemp,
        condition: selectedDay.desc,
        windSpeed: selectedDay.wind,
        windGust: selectedDay.gust,
        blizzardRisk: selectedDay.safetyStatus === 'STORM WARNING' ? 'HIGH' : selectedDay.safetyStatus === 'CAUTION' ? 'MODERATE' : 'LOW',
        summary: selectedDay.synoptic,
      },
    })
  }

  // Dynamic hazard profile customized to the selected day's exact numerical forecast
  const dayThreat = useMemo(() => {
    const d = forecast7Day[selectedDayIdx] ?? forecast7Day[0]
    if (selectedDayIdx === 0) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: d.safetyStatus,
        risk: Math.min(95, Math.round(55 * stormMultiplier)),
        severityColor: d.safetyStatus === 'STORM WARNING' ? '#dc2626' : '#ea580c',
        image: '/threats/turbine.jpg',
        title: 'Active Katabatic Drift & Wind Chill Inversion',
        tags: [`🌡️ ${d.temp}°C Temp`, `💨 ${Math.round(d.gust)} km/h Gust`, `🥶 ${Math.round(d.chill)}°C Chill`, `❄️ ${d.snowProb}% Drift`],
        problems: [
          'Wind chill plunging rapidly; frostbite exposure threshold <15 mins outside.',
          'Drifting snow accumulating around exterior electrical junction boxes.',
        ],
        actions: [
          'Level-2 thermal PPE mandatory for all exterior station personnel.',
          'Maintain emergency heated PistenBully vehicle on warm-idle standby.',
        ],
        heli: d.heliStatus,
        traverse: d.heliStatus === 'NO-GO' ? 'SUSPENDED' : d.heliStatus === 'STANDBY' ? 'CAUTION' : 'OPTIMAL',
      }
    } else if (selectedDayIdx === 1) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'STORM WARNING',
        risk: Math.min(98, Math.round(94 * stormMultiplier)),
        severityColor: '#dc2626',
        image: '/threats/blizzard.jpg',
        title: 'Severe Whiteout Blizzard & Katabatic Gale Surge',
        tags: [`📉 ${d.pres} hPa (Drop)`, `💨 ${Math.round(d.gust)} km/h Peak Gust`, `🥶 ${Math.round(d.chill)}°C Chill`, '❄️ <5m Visibility'],
        problems: [
          'Whiteout with zero visibility (<5m); severe spatial disorientation hazard.',
          'Wind turbine overspeed trip risk (>185 RPM) & Ku-band VSAT tracking drift.',
        ],
        actions: [
          'Level-3 Station Lockdown: Exterior transit strictly via fixed lifeline guide ropes.',
          'Auto-feather turbine blades; lock VSAT dish to 90° survival stow position.',
        ],
        heli: 'NO-GO',
        traverse: 'SUSPENDED',
      }
    } else if (selectedDayIdx === 2) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'CAUTION',
        risk: 38,
        severityColor: '#0284c7',
        image: '/threats/turbine.jpg',
        title: 'Post-Frontal Freeze & Apron Black Ice',
        tags: [`📈 ${d.pres} hPa (Rising)`, `💨 ${Math.round(d.wind)} km/h Wind`, `🥶 ${Math.round(d.chill)}°C Chill`, '☀️ High UV Glare'],
        problems: [
          'Flash-freeze apron black ice across helipad perimeter and metal gangways.',
          'High UV reflection off fresh snow sheet causing temporary snow blindness.',
        ],
        actions: [
          'Apply coarse grit/salt across helipad apron and primary station gangways.',
          'Category-4 polar sunglasses mandatory for all outside technical crews.',
        ],
        heli: 'STANDBY',
        traverse: 'CAUTION',
      }
    } else if (selectedDayIdx === 3) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'ALL CLEAR',
        risk: 12,
        severityColor: '#16a34a',
        image: '/threats/traverse.jpg',
        title: 'Optimal Weather Window (Calm High-Pressure Ridge)',
        tags: [`☀️ ${d.solar} W/m² Solar`, `💨 ${Math.round(d.wind)} km/h Gentle`, `🌡️ ${d.temp}°C Mild`, '🛡️ Minimal Hazard'],
        problems: [
          'Nominal atmospheric conditions; weekly peak in environmental stability.',
          'Minor optical refraction on exterior telemetry camera lenses.',
        ],
        actions: [
          'Green Flag: Optimal window for overland logistics, fueling, and field science.',
          'Perform preventive maintenance on exterior wind turbines and solar PV arrays.',
        ],
        heli: 'APPROVED',
        traverse: 'OPTIMAL',
      }
    } else if (selectedDayIdx === 4) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'CAUTION',
        risk: 74,
        severityColor: '#ea580c',
        image: '/threats/traverse.jpg',
        title: 'Tropospheric Ice Fog & Flat Light Crevasse Risk',
        tags: [`🌫️ 800ft Ceiling`, `🕳️ Crevasse Risk`, `💨 ${Math.round(d.wind)} km/h`, '📡 VSAT Loss +4.8dB'],
        problems: [
          'Flat light conceals 30m crevasse snow bridges beyond safety perimeter.',
          'Moist maritime air advection induces rime icing on radomes and microwave dishes.',
        ],
        actions: [
          'Suspend overland PistenBully traverse beyond 3 km station safety perimeter.',
          'Energize radome quartz heating de-icers 2 hours prior to satellite passes.',
        ],
        heli: 'STANDBY',
        traverse: 'SUSPENDED',
      }
    } else if (selectedDayIdx === 5) {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'STORM WARNING',
        risk: 96,
        severityColor: '#dc2626',
        image: '/threats/blizzard.jpg',
        title: 'Deep Mesocyclone Low & Diesel Fuel Line Gelling',
        tags: [`📉 969 hPa Deep Low`, `💨 ${Math.round(d.gust)} km/h Gust`, `🥶 -42°C Skin Chill`, '❄️ 95% Snow Blizzard'],
        problems: [
          'HSD fuel lines wax crystallization near pour point (-24°C); starvation risk.',
          'Violent gale gusts cause severe vibration on antenna masts and roof cowls.',
        ],
        actions: [
          'Engage 100% duty cycle electric heat-tracing on exterior fuel pipelines.',
          'Switch station microgrid to dual-generator load sharing; secure outer hatches.',
        ],
        heli: 'NO-GO',
        traverse: 'SUSPENDED',
      }
    } else {
      return {
        label: `${d.name} (${d.dateStr})`,
        statusText: 'CAUTION',
        risk: 48,
        severityColor: '#0284c7',
        image: '/threats/traverse.jpg',
        title: 'Post-Storm Snow Drift Silt & Intake Obstruction',
        tags: [`❄️ Heavy Drift Snow`, `💨 ${Math.round(d.wind)} km/h Moderating`, `🌡️ ${d.temp}°C`, '🚜 Snow Clearing'],
        problems: [
          'Heavy 2-meter snow drifts accumulating against generator intake louvers.',
          'Containerized storage doors and emergency egress hatches packed with snow.',
        ],
        actions: [
          'Deploy PistenBully snow blade crew for prioritized clearance of air intakes.',
          'Inspect structural stay wires and communications masts for drift slack.',
        ],
        heli: 'STANDBY',
        traverse: 'CAUTION',
      }
    }
  }, [forecast7Day, selectedDayIdx, stormMultiplier])



  // Localized deterministic algorithmic predictions (synchronous baseline fallback)
  const fallbackPredictions = useMemo((): Prediction[] => {
    const isMaitri = activeStation === 'maitri'
    const crew = isMaitri ? 24 : 32
    const fuelRemaining = isMaitri ? 138400 : 210500
    const capacity = isMaitri ? 165000 : 250000

    // 1. Fuel Depletion Forecast
    const burnHistory = [1210, 1280, 1190, 1320, 1260, 1240, 1250]
    const slope = (burnHistory[6] - burnHistory[0]) / 6
    const forecastedBurnDay7 = burnHistory[6] + slope * 7
    const daysToEmpty = fuelRemaining / Math.max(1, forecastedBurnDay7)
    const daysToCritical = (fuelRemaining - capacity * 0.30) / Math.max(1, forecastedBurnDay7)
    const resupplyUrgencyScore = (1 - daysToEmpty / 120) * 100
    const fuelRisk: RiskLevel = daysToCritical < 60 ? 'CRITICAL' : daysToCritical < 90 ? 'WARNING' : 'NOMINAL'

    // 2. Energy Load Prediction
    const T_ambient = isMaitri ? -22.0 : -17.0
    const wind_kmh = 35.0
    const HDD = Math.max(0, 18 - T_ambient)
    const load_kw = 120 + 2.8 * HDD + 1.5 * crew + 0.3 * wind_kmh
    const capacity_kw = 250.0
    const deficit = load_kw - capacity_kw
    const energyRisk: RiskLevel = deficit > 20 ? 'CRITICAL' : deficit > 0 ? 'WARNING' : 'NOMINAL'

    // 3. Generator Health Score (RUL)
    const beta = 2.2
    const eta = 4500
    const reliability_target = 0.90
    const RUL_hours_total = eta * Math.pow(-Math.log(reliability_target), 1 / beta)
    const hours_used = 2180
    const remaining = RUL_hours_total - hours_used
    const genRisk: RiskLevel = remaining < 500 ? 'CRITICAL' : remaining < 800 ? 'WARNING' : 'NOMINAL'

    // 4. Blizzard Probability
    const dP_dt = 1.2
    const humidity = 65
    const z = 0.042 * wind_kmh + 0.18 * Math.abs(dP_dt) + 0.015 * humidity - 3.2
    const P_blizzard = 1 / (1 + Math.exp(-z))
    const blizz_prob = P_blizzard * 100
    const blizzRisk: RiskLevel = blizz_prob > 75 ? 'CRITICAL' : blizz_prob > 50 ? 'WARNING' : 'NOMINAL'

    // 5. Water Supply Sustainability
    const currentVolume = 15000
    const snowmeltRate = Math.max(0, (T_ambient + 10) * 0.8)
    const usage = crew * 25
    const netDailyChange = snowmeltRate - usage
    const daysToRefillNeeded = currentVolume / Math.max(1, Math.abs(netDailyChange))
    const waterRisk: RiskLevel = daysToRefillNeeded < 30 ? 'CRITICAL' : daysToRefillNeeded < 45 ? 'WARNING' : 'NOMINAL'

    // 6. Structural Stress Prediction
    const snowDensity = 300
    const snowDepth = 1.5
    const snowLoad_kPa = (snowDensity * snowDepth * 9.81) / 1000
    const wind_ms = wind_kmh / 3.6
    const windPressure_kPa = (0.5 * 1.293 * Math.pow(wind_ms, 2) * 1.3) / 1000
    const totalLoad = snowLoad_kPa + windPressure_kPa
    const safeThreshold = 6.0
    const stressPercent = (totalLoad / safeThreshold) * 100
    const structRisk: RiskLevel = stressPercent > 85 ? 'CRITICAL' : stressPercent > 70 ? 'WARNING' : 'NOMINAL'

    return [
      {
        model_name: 'FuelDepletion',
        metric: 'daysToCritical',
        val: Number(daysToCritical.toFixed(2)),
        risk: fuelRisk,
        data: {
          daysToEmpty: Number(daysToEmpty.toFixed(1)),
          daysToCritical: Number(daysToCritical.toFixed(1)),
          resupplyUrgencyScore: Number(resupplyUrgencyScore.toFixed(1)),
          forecastedBurnDay7: Number(forecastedBurnDay7.toFixed(1)),
        },
      },
      {
        model_name: 'EnergyLoad',
        metric: 'load_kw',
        val: Number(load_kw.toFixed(2)),
        risk: energyRisk,
        data: {
          load_kw: Number(load_kw.toFixed(1)),
          deficit: Number(deficit.toFixed(1)),
        },
      },
      {
        model_name: 'GeneratorRUL',
        metric: 'RUL_hours',
        val: Number(Math.max(0, remaining).toFixed(2)),
        risk: genRisk,
        data: {
          RUL_hours: Number(remaining.toFixed(1)),
        },
      },
      {
        model_name: 'BlizzardProb',
        metric: 'blizzard_prob_pct',
        val: Number(blizz_prob.toFixed(2)),
        risk: blizzRisk,
        data: {
          blizzard_prob_pct: Number(blizz_prob.toFixed(1)),
        },
      },
      {
        model_name: 'WaterSustainability',
        metric: 'daysToRefillNeeded',
        val: Number(daysToRefillNeeded.toFixed(2)),
        risk: waterRisk,
        data: {
          daysToRefillNeeded: Number(daysToRefillNeeded.toFixed(1)),
          netDailyChange: Number(netDailyChange.toFixed(1)),
        },
      },
      {
        model_name: 'StructuralStress',
        metric: 'stressPercent',
        val: Number(stressPercent.toFixed(2)),
        risk: structRisk,
        data: {
          stressPercent: Number(stressPercent.toFixed(1)),
          totalLoad: Number(totalLoad.toFixed(2)),
        },
      },
    ]
  }, [activeStation])

  // Prediction data: prefer live HQ backend inference; fallback gracefully if offline/syncing
  const preds = useMemo((): Prediction[] => {
    if (v2Data?.predictions && Array.isArray(v2Data.predictions) && v2Data.predictions.length > 0) {
      return v2Data.predictions as Prediction[]
    }
    return fallbackPredictions
  }, [v2Data, fallbackPredictions])

  const getPred = (name: string) => preds.find((p) => p.model_name === name)
  const fuelPred = getPred('FuelDepletion'); const energyPred = getPred('EnergyLoad')
  const genPred = getPred('GeneratorRUL'); const blizzPred = getPred('BlizzardProb')
  const waterPred = getPred('WaterSustainability'); const structPred = getPred('StructuralStress')
  const predMap: Record<string, Prediction | undefined> = { fuel: fuelPred, energy: energyPred, generator: genPred, blizzard: blizzPred, water: waterPred, structural: structPred }

  const allRisks = preds.map((p) => p.risk)
  const criticalCount = allRisks.filter((r) => r === 'CRITICAL').length
  const warningCount = allRisks.filter((r) => r === 'WARNING').length
  const overallStatus: RiskLevel = criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'NOMINAL'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setStationId(activeStation === 'maitri' ? 'bharati' : 'maitri')} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px 20px' }}>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10, padding: '5px 12px', background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Home</button>
                <span>›</span><span style={{ color: '#0b3b60', fontWeight: 600 }}>Polar Operations</span>
                <span>›</span><span style={{ color: '#ea580c', fontWeight: 800 }}>Predictive Analytics</span>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, background: riskBg(overallStatus), color: riskColor(overallStatus), border: `1px solid ${riskBorder(overallStatus)}`, padding: '2px 8px', borderRadius: 2 }}>
                {overallStatus === 'NOMINAL' ? '✓' : '⚠'} SYSTEM: {overallStatus}
                {criticalCount > 0 && ` · ${criticalCount} CRITICAL`}
                {warningCount > 0 && ` · ${warningCount} WARNING`}
              </span>
            </div>

            {/* Mission Command Header */}
            <div
              style={{
                background: '#0b3b60',
                border: '1px solid #072a45',
                borderBottom: '2px solid #ff9933',
                color: '#ffffff',
                padding: '10px 16px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                boxShadow: '0 2px 6px rgba(11,59,96,0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'rgba(255, 153, 51, 0.15)',
                    border: '1px solid #ff9933',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ff9933' }}>
                    radar
                  </span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 900, letterSpacing: '0.04em', color: '#ffffff' }}>
                      {activeStation === 'maitri' ? 'MAITRI BASE' : 'BHARATI BASE'} — PREDICTIVE TELEMETRY
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 2,
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid #10b981',
                        color: '#a7f3d0',
                        letterSpacing: '0.04em',
                      }}
                    >
                      ● LIVE INFERENCE
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 2 }}>
                    NCPOR Polar Operations · {activeStation === 'maitri' ? "70°45'S, 11°44'E " : "69°24'S, 76°11'E "} · Synoptic Cycle: 06:00 UTC
                  </div>
                </div>
              </div>

              {/* Station Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15, 23, 42, 0.4)', padding: '3px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
                {(['maitri', 'bharati'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStationId(s)}
                    style={{
                      background: activeStation === s ? '#ff9933' : 'transparent',
                      border: 'none',
                      color: activeStation === s ? '#0b3b60' : '#cbd5e1',
                      padding: '5px 14px',
                      fontWeight: 900,
                      fontSize: 10.5,
                      cursor: 'pointer',
                      borderRadius: 3,
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s ease',
                      boxShadow: activeStation === s ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {s === 'maitri' ? ' MAITRI' : ' BHARATI'}
                  </button>
                ))}
              </div>
            </div>

            {/* Segmented Tab Switcher */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 12,
                background: '#ffffff',
                padding: '6px',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              {[
                { id: 'weather' as PageTab, label: '7-Day Synoptic Weather Forecast', icon: 'cloudy_snowing', badge: '7 DAYS • 24H SLIDER' },
                { id: 'predictions' as PageTab, label: 'Predictive Algorithm Suite', icon: 'analytics', badge: '6 DETERMINISTIC MODELS' },
              ].map((t) => {
                const isActive = pageTab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setPageTab(t.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '9px 16px',
                      border: isActive ? '1px solid #0b3b60' : '1px solid transparent',
                      background: isActive ? '#0b3b60' : '#f8fafc',
                      cursor: 'pointer',
                      borderRadius: 3,
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 4px rgba(11,59,96,0.18)' : 'none',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 17,
                        color: isActive ? '#38bdf8' : '#64748b',
                      }}
                    >
                      {t.icon}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: isActive ? '#ffffff' : '#334155',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {t.label}
                    </span>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 2,
                        background: isActive ? 'rgba(56, 189, 248, 0.2)' : '#e2e8f0',
                        color: isActive ? '#7dd3fc' : '#64748b',
                        border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : 'none',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {t.badge}
                    </span>
                  </button>
                )
              })}
            </div>


            {/* ─────────────────────── WEATHER FORECAST TAB (FIRST) ─────────────────── */}
            {pageTab === 'weather' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 1. Forecast header & controls */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284c7' }}>calendar_month</span>
                      7-DAY SYNOPTIC POLAR FORECAST (CLICK ANY DAY TO INSPECT)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 9.5, color: '#64748b' }}>
                        Anchored to Live Sensors ({liveTemp.toFixed(1)}°C, {liveWind} km/h)
                      </span>
                      <button
                        type="button"
                        onClick={() => setStormSim((s) => !s)}
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '4px 10px',
                          background: stormSim ? '#fee2e2' : '#f8fafc',
                          color: stormSim ? '#b91c1c' : '#475569',
                          border: `1.5px solid ${stormSim ? '#f87171' : '#cbd5e1'}`,
                          cursor: 'pointer',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                        title="Simulate +30% Polar Storm Surge across all predictive neural models"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: stormSim ? '#b91c1c' : '#64748b' }}>
                          {stormSim ? 'cyclone' : 'tune'}
                        </span>
                        {stormSim ? '⚠️ Blizzard Surge Active (+30%)' : 'Simulate Storm (+30%)'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. 7-Day Synoptic Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
                  {forecast7Day.map((day, idx) => (
                    <WeatherDayCard
                      key={day.name}
                      day={day}
                      isSelected={selectedDayIdx === idx}
                      onClick={() => setSelectedDayIdx(idx)}
                    />
                  ))}
                </div>

                {/* 3. 24-Hour Upcoming Hourly Timeline & Slider */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header Banner with SITREP Download */}
                  <div
                    style={{
                      background: '#0b3b60',
                      color: '#ffffff',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#38bdf8' }}>
                          schedule
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.03em' }}>
                            24-HOUR UPCOMING HOURLY WEATHER TIMELINE & SLIDER
                          </span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              background: '#ff9933',
                              color: '#0b3b60',
                              padding: '2px 8px',
                              borderRadius: 3,
                            }}
                          >
                            {selectedDay.name} • {selectedDay.dateStr}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 2 }}>
                          Atmospheric Progression for {activeStation === 'maitri' ? "Maitri Base (70°45'S, 11°44'E)" : "Bharati Base (69°24'S, 76°11'E)"} • Expected: <strong style={{ color: '#fff' }}>{selectedDay.desc}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleDownloadWeatherSITREP}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'linear-gradient(135deg, #138808 0%, #15803d 100%)',
                          color: '#ffffff',
                          border: '1px solid #166534',
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: 10.5,
                          borderRadius: 3,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          transition: 'all 0.15s ease',
                        }}
                        title="Download official Government Gazette formatted Weather & Safety SITREP PDF"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#fef08a' }}>
                          verified
                        </span>
                        <span>📥 Download Weather SITREP (Govt Format)</span>
                      </button>
                    </div>
                  </div>

                  {/* Slider Strip & Hourly Ribbon */}
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Interactive Slider Control Strip */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>
                            tune
                          </span>
                          TIMELINE SLIDER:
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            background: '#0b3b60',
                            color: '#ffffff',
                            padding: '3px 10px',
                            borderRadius: 12,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {activeHour.hour} UTC • {activeHour.temp}°C ({activeHour.condition})
                        </span>
                      </div>

                      {/* Range Slider for immediate scrubbing */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, maxWidth: 420 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>00:00</span>
                        <input
                          type="range"
                          min={0}
                          max={23}
                          step={1}
                          value={selectedHourIdx}
                          onChange={(e) => setSelectedHourIdx(Number(e.target.value))}
                          style={{
                            flex: 1,
                            cursor: 'pointer',
                            accentColor: '#0b3b60',
                            height: 6,
                          }}
                          title="Slide to scrub across 24 hours of forecast"
                        />
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>23:00</span>
                      </div>

                      {/* Step Navigation Buttons */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedHourIdx((idx) => Math.max(0, idx - 1))}
                          disabled={selectedHourIdx <= 0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: selectedHourIdx <= 0 ? '#f1f5f9' : '#ffffff',
                            color: selectedHourIdx <= 0 ? '#94a3b8' : '#0b3b60',
                            border: '1px solid #cbd5e1',
                            padding: '4px 10px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: selectedHourIdx <= 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_back</span>
                          Prev Hour
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedHourIdx((idx) => Math.min(23, idx + 1))}
                          disabled={selectedHourIdx >= 23}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: selectedHourIdx >= 23 ? '#f1f5f9' : '#ffffff',
                            color: selectedHourIdx >= 23 ? '#94a3b8' : '#0b3b60',
                            border: '1px solid #cbd5e1',
                            padding: '4px 10px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: selectedHourIdx >= 23 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Next Hour
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                        </button>
                      </div>
                    </div>

                    {/* Single continuous horizontally scrollable slider strip */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284c7' }}>
                            view_carousel
                          </span>
                          24-HOUR HOURLY PROGRESSION (CLICK ANY CARD OR USE SLIDER ABOVE)
                        </div>
                        <span style={{ fontSize: 9.5, color: '#64748b' }}>
                          Scroll horizontally or click card to inspect
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          overflowX: 'auto',
                          padding: '4px 2px 10px 2px',
                          scrollBehavior: 'smooth',
                        }}
                      >
                        {hourlyData.map((h) => {
                          const isFocused = selectedHourIdx === h.hourIdx
                          const safBg = h.activitySafety === 'SAFE' ? '#dcfce7' : h.activitySafety === 'CAUTION' ? '#fef3c7' : '#fee2e2'
                          const safColor = h.activitySafety === 'SAFE' ? '#15803d' : h.activitySafety === 'CAUTION' ? '#d97706' : '#b91c1c'
                          return (
                            <div
                              key={h.hour}
                              onClick={() => setSelectedHourIdx(h.hourIdx)}
                              style={{
                                minWidth: 108,
                                width: 108,
                                flexShrink: 0,
                                background: isFocused ? 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)' : '#ffffff',
                                border: isFocused ? '2.5px solid #0284c7' : '1px solid #cbd5e1',
                                borderRadius: 4,
                                padding: '10px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                position: 'relative',
                                boxShadow: isFocused ? '0 6px 16px rgba(2, 132, 199, 0.22)' : '0 1px 3px rgba(0,0,0,0.03)',
                                transform: isFocused ? 'translateY(-2px)' : 'none',
                                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            >
                              {isFocused && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 3,
                                    background: '#0284c7',
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2,
                                  }}
                                />
                              )}

                              <span style={{ fontSize: 10, fontWeight: 900, color: isFocused ? '#0369a1' : '#475569' }}>
                                {h.hour} UTC
                              </span>

                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: 24,
                                  color: h.icon === 'sunny' ? '#f59e0b' : h.icon === 'cyclone' || h.icon === 'storm' ? '#ea580c' : '#0284c7',
                                  margin: '2px 0',
                                }}
                              >
                                {h.icon}
                              </span>

                              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                {h.temp}°C
                              </span>

                              <div style={{ fontSize: 9, color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '100%' }}>
                                <span>💨 {Math.round(h.wind)} km/h</span>
                                <span style={{ color: h.gust >= 55 ? '#dc2626' : '#ea580c', fontWeight: 800 }}>
                                  ⚡ {Math.round(h.gust)}
                                </span>
                                <span>🥶 {h.chill}°C</span>
                              </div>

                              <div style={{ width: '100%', marginTop: 2 }}>
                                <span
                                  style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    fontSize: 8.5,
                                    fontWeight: 800,
                                    padding: '2px 4px',
                                    borderRadius: 2,
                                    background: safBg,
                                    color: safColor,
                                  }}
                                >
                                  {h.activitySafety}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Hourly Diagnostic Focus */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #0284c7',
                        borderRadius: 4,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0b3b60' }}>
                            analytics
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            HOURLY DIAGNOSTIC FOCUS: {activeHour.hour} UTC • {selectedDay.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              background: '#0b3b60',
                              color: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: 3,
                            }}
                          >
                            {activeHour.condition}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: '#64748b' }}>Flight Sortie Status:</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: 3,
                              background: activeHour.activitySafety === 'SAFE' ? '#dcfce7' : activeHour.activitySafety === 'CAUTION' ? '#fef3c7' : '#fee2e2',
                              color: activeHour.activitySafety === 'SAFE' ? '#15803d' : activeHour.activitySafety === 'CAUTION' ? '#d97706' : '#b91c1c',
                            }}
                          >
                            {activeHour.activitySafety === 'SAFE' ? 'FLIGHT APPROVED' : activeHour.activitySafety === 'CAUTION' ? 'FLIGHT STANDBY' : 'FLIGHT GROUNDED'}
                          </span>
                        </div>
                      </div>

                      {/* 6 Parameter Badges */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>TEMPERATURE</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{activeHour.temp}°C</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>WIND CHILL</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>{activeHour.chill}°C</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>SUSTAINED WIND</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{Math.round(activeHour.wind)} km/h</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>PEAK GUST</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: activeHour.gust >= 55 ? '#dc2626' : '#ea580c', marginTop: 2 }}>⚡ {Math.round(activeHour.gust)} km/h</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>BLIZZARD PROB</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: activeHour.snowProb > 70 ? '#dc2626' : '#16a34a', marginTop: 2 }}>❄️ {activeHour.snowProb}%</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '7px 9px' }}>
                          <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>BAROMETER</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{activeHour.pressure} hPa</div>
                        </div>
                      </div>

                      {/* Operational Directive in English */}
                      <div
                        style={{
                          background: activeHour.activitySafety === 'NO-GO' ? '#fef2f2' : activeHour.activitySafety === 'RESTRICTED' ? '#fff7ed' : '#f0fdf4',
                          border: `1px solid ${activeHour.activitySafety === 'NO-GO' ? '#fecaca' : activeHour.activitySafety === 'RESTRICTED' ? '#fed7aa' : '#bbf7d0'}`,
                          borderRadius: 3,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 10.5,
                          color: activeHour.activitySafety === 'NO-GO' ? '#991b1b' : activeHour.activitySafety === 'RESTRICTED' ? '#9a3412' : '#166534',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          {activeHour.activitySafety === 'NO-GO' ? 'emergency' : activeHour.activitySafety === 'RESTRICTED' ? 'warning' : 'verified_user'}
                        </span>
                        <span>
                          <strong>Operational Directive ({activeHour.hour} UTC): </strong>
                          {activeHour.activitySafety === 'NO-GO'
                            ? 'GALE WARNING & SEVERE BLIZZARD: Outdoor traverse prohibited. Exterior personnel must anchor to fixed station lifelines. Helicopter and drone sorties strictly suspended.'
                            : activeHour.activitySafety === 'RESTRICTED'
                              ? 'KATABATIC ACCELERATION ADVISORY: Strong gravity drainage winds and blowing snow reducing visibility. Outdoor work permitted only with Level-2 thermal PPE in tethered two-person teams.'
                              : 'NOMINAL ATMOSPHERIC CONDITIONS: Weather stable within safe operational parameters. Field traverses, scientific measurements, fuel transfer, and routine exterior maintenance approved.'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Photo-Rich AI Future Hazards & Problem Predictor (Linked to Selected Day) */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      background: '#0b3b60',
                      color: '#ffffff',
                      padding: '9px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, letterSpacing: '0.03em' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#38bdf8' }}>
                        psychology
                      </span>
                      AI FUTURE HAZARD PREDICTOR & INCIDENT PREVENTION PROTOCOL
                    </div>
                    <span style={{ fontSize: 9.5, color: '#93c5fd' }}>
                      Linked to Forecast Day: <strong>{dayThreat.label}</strong>
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(280px, 340px) 1fr',
                      minHeight: 220,
                    }}
                  >
                    {/* Left Column: Photo Banner */}
                    <div style={{ position: 'relative', minHeight: 200, background: '#0f172a', overflow: 'hidden' }}>
                      <img
                        src={dayThreat.image}
                        alt={dayThreat.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          filter: 'brightness(0.92)',
                        }}
                      />
                      {/* Vignette Gradient */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.92) 100%)',
                        }}
                      />
                      {/* Floating Badges */}
                      <div style={{ position: 'absolute', top: 9, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 3,
                            background: 'rgba(15, 23, 42, 0.85)',
                            color: '#f8fafc',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                          }}
                        >
                          📅 {dayThreat.label}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderRadius: 3,
                            background: dayThreat.severityColor,
                            color: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {dayThreat.risk}% RISK • {dayThreat.statusText}
                        </span>
                      </div>

                      {/* Bottom Title on Image */}
                      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                          {dayThreat.title}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Predicted Problems & Suggestions */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between' }}>
                      {/* Row 1: Trigger Badges */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {dayThreat.tags.map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '2px 8px',
                              background: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              borderRadius: 3,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* Row 2: Predicted Problems */}
                      <div
                        style={{
                          background: '#fff7ed',
                          border: '1px solid #ffedd5',
                          borderRadius: 4,
                          padding: '8px 12px',
                          fontSize: 10.5,
                          color: '#9a3412',
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#c2410c', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                          <span>Predicted Operational Problems:</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {dayThreat.problems.map((p, idx) => (
                            <li key={idx} style={{ fontWeight: 600 }}>{p}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Row 3: Action Protocol / Suggestions */}
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #dcfce7',
                          borderRadius: 4,
                          padding: '8px 12px',
                          fontSize: 10.5,
                          color: '#166534',
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontWeight: 900, color: '#15803d', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                          <span>Mandatory Station Protocol / AI Action Advisory:</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {dayThreat.actions.map((a, idx) => (
                            <li key={idx} style={{ fontWeight: 600 }}>{a}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Row 4: Mission Clearance Badges */}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 2, borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Helipad Air Sortie: <strong style={{ color: dayThreat.heli === 'NO-GO' ? '#dc2626' : dayThreat.heli === 'STANDBY' ? '#d97706' : '#16a34a' }}>{dayThreat.heli}</strong>
                        </div>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Overland Traverse: <strong style={{ color: dayThreat.traverse === 'SUSPENDED' ? '#dc2626' : dayThreat.traverse === 'CAUTION' ? '#d97706' : '#16a34a' }}>{dayThreat.traverse}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────── PREDICTIONS TAB (SECOND) ───────────────────────── */}
            {pageTab === 'predictions' && (
              <>
                {predError && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', padding: '9px 14px', marginBottom: 12, fontSize: 11, color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#d97706' }}>sync_problem</span>
                      <span>HQ link syncing · Localized deterministic algorithm baseline active for {activeStation.toUpperCase()}.</span>
                    </div>
                    <button
                      onClick={() => refetchPredictions()}
                      style={{
                        background: '#0b3b60',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>refresh</span>
                      Retry Link
                    </button>
                  </div>
                )}

                {/* KPI strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <KpiStrip label="Fuel Critical In" value={fuelPred ? `${Math.round(fuelPred.data.daysToCritical ?? fuelPred.val)}d` : '—'} unit="days to 30% level" risk={fuelPred?.risk ?? 'NOMINAL'} icon="local_gas_station" />
                  <KpiStrip label="Predicted Load" value={energyPred ? `${Math.round(energyPred.data.load_kw ?? energyPred.val)}kW` : '—'} unit={(energyPred?.data.deficit ?? 0) > 0 ? 'OVER CAPACITY' : 'within limits'} risk={energyPred?.risk ?? 'NOMINAL'} icon="bolt" />
                  <KpiStrip label="Generator RUL" value={genPred ? `${Math.round(genPred.data.RUL_hours ?? genPred.val)}h` : '—'} unit="hours of useful life" risk={genPred?.risk ?? 'NOMINAL'} icon="engineering" />
                  <KpiStrip label="Blizzard Probability" value={blizzPred ? `${(blizzPred.data.blizzard_prob_pct ?? blizzPred.val).toFixed(0)}%` : '—'} unit="next 6-hour window" risk={blizzPred?.risk ?? 'NOMINAL'} icon="severe_cold" />
                  <KpiStrip label="Water Days Left" value={waterPred ? `${Math.round(waterPred.data.daysToRefillNeeded ?? waterPred.val)}d` : '—'} unit="until refill needed" risk={waterPred?.risk ?? 'NOMINAL'} icon="water_drop" />
                  <KpiStrip label="Structural Load" value={structPred ? `${(structPred.data.stressPercent ?? structPred.val).toFixed(0)}%` : '—'} unit="of 6.0 kPa design limit" risk={structPred?.risk ?? 'NOMINAL'} icon="domain" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#0b3b60' }}>schedule</span>
                    <span>
                      {v2Data?.generated_at
                        ? `Live HQ Inference: ${new Date(v2Data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                        : `Deterministic Algorithmic Baseline active · ${activeStation.toUpperCase()} Base`}
                      {' · '}<strong>{preds.length} models evaluated</strong>
                    </span>
                  </div>

                  {predLoading && (
                    <span style={{ fontSize: 9.5, color: '#0284c7', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, animation: 'spin 1s linear infinite' }}>sync</span>
                      Syncing live models…
                    </span>
                  )}
                </div>

                {/* 6 Deterministic Model Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
                  {PANEL_CONFIGS.map((config) => <PredictionCard key={config.id} config={config} pred={predMap[config.id]} />)}
                </div>

                {preds.length > 0 && (
                  <div style={{ marginTop: 14, background: '#ffffff', border: '1px solid #e2e8f0', borderTop: `3px solid ${riskColor(overallStatus)}`, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: riskColor(overallStatus) }}>{overallStatus === 'NOMINAL' ? 'check_circle' : overallStatus === 'WARNING' ? 'warning' : 'emergency'}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>System Status Assessment</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{activeStation.toUpperCase()} Station · All 6 predictive models evaluated</div>
                        </div>
                      </div>
                      <RiskPill risk={overallStatus} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {preds.map((p) => (
                        <div key={p.model_name} style={{ padding: '5px 10px', background: riskBg(p.risk), border: `1px solid ${riskBorder(p.risk)}`, fontSize: 10, fontWeight: 700, color: riskColor(p.risk), borderRadius: 3 }}>
                          {p.model_name.replace(/([A-Z])/g, ' $1').trim()}: {p.risk}
                        </div>
                      ))}
                    </div>
                    {overallStatus === 'NOMINAL' && <div style={{ marginTop: 10, fontSize: 10.5, color: '#166534', fontWeight: 700 }}>✓ All predictive models indicate nominal station health. No immediate action required.</div>}
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
