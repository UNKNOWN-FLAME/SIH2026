import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { usePredictionsV2, useWeatherEnsemble } from '../hooks/usePredictiveAI'
import { useSensors } from '../hooks/useSensors'

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
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 52, gap: 3 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', height: `${Math.max(4, (v / max) * 48)}px`, background: i === data.length - 1 ? barColor : `${barColor}66`, borderRadius: '2px 2px 0 0', transition: 'height 0.4s' }} />
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
    id: 'fuel', title: 'Fuel Depletion Forecast', subtitle: 'Linear extrapolation · 7-day burn trend',
    icon: 'local_gas_station', accentColor: '#ea580c', modelName: 'FuelDepletion',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToCritical ?? p.val)}`, unit: 'days to 30% level' }),
    sub1Label: 'Days to Empty', sub1Value: (p) => `${Math.round(p.data.daysToEmpty ?? 0)} days`,
    sub2Label: 'Forecasted Burn', sub2Value: (p) => `${Math.round(p.data.forecastedBurnDay7 ?? 0)} L/day`,
    sparkData: (p) => { const base = p.data.daysToEmpty ?? 100; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * (p.data.forecastedBurnDay7 ?? 1240) / 1000)) },
    actions: {
      WARNING: ['Place resupply vessel order immediately — minimum 45-day lead time required', 'Reduce non-critical generator loads by 10% to extend autonomy', 'Notify NCPOR Goa logistics team of projected depletion date'],
      CRITICAL: ['EMERGENCY RESUPPLY: Contact NCPOR HQ Director immediately', 'Activate Station Order 7B — mandatory fuel rationing begins now', 'Shed all non-life-support electrical loads', 'Broadcast emergency SBD Iridium message to NCPOR Goa'],
    },
  },
  {
    id: 'energy', title: 'Energy Load Prediction', subtitle: 'Heating Degree-Days method · crew + climate',
    icon: 'bolt', accentColor: '#7c3aed', modelName: 'EnergyLoad',
    formatValue: (p) => ({ main: `${Math.round(p.data.load_kw ?? p.val)}`, unit: 'kW predicted load' }),
    sub1Label: 'Grid Margin', sub1Value: (p) => { const d = p.data.deficit ?? 0; return d > 0 ? `−${Math.round(d)} kW deficit` : `+${Math.round(Math.abs(d))} kW surplus` },
    sub2Label: 'Status', sub2Value: (p) => (p.data.deficit ?? 0) > 0 ? 'OVER CAPACITY' : 'WITHIN LIMITS',
    sparkData: () => [162, 168, 172, 175, 170, 165, 160],
    actions: {
      WARNING: ['Switch laboratory and workshop loads to off-peak hours', 'Pre-warm backup generator DG-2 for supplemental dispatch', 'Monitor battery SoC — avoid dropping below 60%'],
      CRITICAL: ['ACTIVATE LOAD-SHEDDING: Immediately disconnect non-essential circuits', 'Start DG-2 in parallel with DG-1 for combined output', 'Notify station commander — grid reliability at risk', 'Defer all high-power experiments and equipment charging'],
    },
  },
  {
    id: 'generator', title: 'Generator Remaining Life', subtitle: 'Weibull hazard model · β=2.2, η=4500h',
    icon: 'engineering', accentColor: '#0284c7', modelName: 'GeneratorRUL',
    formatValue: (p) => ({ main: `${Math.round(p.data.RUL_hours ?? p.val)}`, unit: 'hours remaining' }),
    sub1Label: 'Reliability Target', sub1Value: () => '90% confidence',
    sub2Label: 'Hrs Since Overhaul', sub2Value: () => '2,180 hrs',
    sparkData: (p) => { const base = p.data.RUL_hours ?? 2300; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 24)) },
    actions: {
      WARNING: ['Schedule DG-1 overhaul within the next 7 days', 'Verify DG-2 is in full operational readiness as standby primary', 'Increase vibration and oil-pressure monitoring frequency to every 4 hours'],
      CRITICAL: ['STOP DG-1: Shutdown risk is imminent — switch to DG-2 immediately', 'Emergency engineering inspection of DG-1 bearings and lube system', 'Alert NCPOR Goa for replacement parts on next cargo flight', 'Implement single-genset power rationing protocol'],
    },
  },
  {
    id: 'blizzard', title: 'Blizzard Probability', subtitle: 'Logistic model · wind + pressure + humidity',
    icon: 'severe_cold', accentColor: '#0369a1', modelName: 'BlizzardProb',
    formatValue: (p) => ({ main: `${(p.data.blizzard_prob_pct ?? p.val).toFixed(1)}`, unit: '% probability' }),
    sub1Label: 'Wind Input', sub1Value: () => '35 km/h',
    sub2Label: 'dP/dt Input', sub2Value: () => '−1.2 hPa/hr',
    sparkData: (p) => { const base = p.data.blizzard_prob_pct ?? 40; return [base * 0.6, base * 0.75, base * 0.9, base, base * 1.1, base * 0.95, base * 0.7].map(v => Math.min(100, Math.max(0, v))) },
    actions: {
      WARNING: ['Secure all outdoor equipment, vehicles, and antenna mounts', 'Brief all personnel on Blizzard Protocol B — no lone outdoor work', 'Pre-position emergency thermal suits at all exit points', 'Check HF radio backup and confirm antenna integrity'],
      CRITICAL: ['STATION LOCKDOWN: All outdoor operations immediately suspended', 'Account for all personnel — enforce 2-person buddy system', 'Activate HF backup radio — VSAT antenna stowed for protection', 'Operate in emergency heating mode — conserve fuel reserves'],
    },
  },
  {
    id: 'water', title: 'Water Supply Sustainability', subtitle: 'Snowmelt vs. crew consumption model',
    icon: 'water_drop', accentColor: '#0891b2', modelName: 'WaterSustainability',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToRefillNeeded ?? p.val)}`, unit: 'days until refill' }),
    sub1Label: 'Net Daily Change', sub1Value: (p) => `${(p.data.netDailyChange ?? 0).toFixed(1)} L/day`,
    sub2Label: 'Current Volume', sub2Value: () => '15,000 L',
    sparkData: (p) => { const base = p.data.daysToRefillNeeded ?? 60; return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 2)) },
    actions: {
      WARNING: ['Activate snow-melt unit at full capacity to maximise input rate', 'Reduce crew water allocation — limit showers to 2 min/person/day', 'Identify and repair any leaks in the distribution system'],
      CRITICAL: ['WATER EMERGENCY: Activate emergency ration mode — essential use only', 'All snow-melt units at maximum capacity immediately', 'Suspend all non-drinking water uses (cleaning, experiments)', 'Notify NCPOR Goa — request emergency water delivery on next aircraft'],
    },
  },
  {
    id: 'structural', title: 'Structural Load Assessment', subtitle: 'Snow load + wind pressure vs. design limit',
    icon: 'domain', accentColor: '#475569', modelName: 'StructuralStress',
    formatValue: (p) => ({ main: `${(p.data.stressPercent ?? p.val).toFixed(1)}`, unit: '% of safe limit' }),
    sub1Label: 'Total Load', sub1Value: (p) => `${(p.data.totalLoad ?? 0).toFixed(2)} kPa`,
    sub2Label: 'Design Limit', sub2Value: () => '6.0 kPa',
    sparkData: (p) => { const base = p.data.stressPercent ?? 45; return Array.from({ length: 7 }, (_, i) => Math.min(100, base + i * 2.5)) },
    actions: {
      WARNING: ['Deploy snow-clearing team to roof structures and satellite dish mounts', 'Activate de-icing cable network on all load-bearing roof sections', 'Inspect structural connections at foundation level for cracking'],
      CRITICAL: ['STRUCTURAL ALERT: Evacuate personnel from affected modules immediately', 'Mandatory engineering inspection before re-entry is permitted', 'Contact NCPOR HQ structural team for emergency consultation', 'Activate secondary accommodation — restrict habitation to safe modules'],
    },
  },
]

// ── Prediction card ────────────────────────────────────────────────────────────

function PredictionCard({ config, pred }: { config: PanelConfig; pred: Prediction | undefined }) {
  const risk: RiskLevel = pred?.risk ?? 'NOMINAL'
  const sparkData = pred ? config.sparkData(pred) : [50, 52, 54, 56, 58, 60, 62]
  const fmtVal = pred ? config.formatValue(pred) : { main: '—', unit: '' }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: `3px solid ${config.accentColor}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: `${config.accentColor}18`, border: `1px solid ${config.accentColor}33`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: config.accentColor }}>{config.icon}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{config.title}</div>
            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>{config.subtitle}</div>
          </div>
        </div>
        <RiskPill risk={risk} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: riskColor(risk), lineHeight: 1 }}>{fmtVal.main}</span>
          {fmtVal.unit && <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{fmtVal.unit}</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{config.sub1Label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>{pred ? config.sub1Value(pred) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{config.sub2Label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>{pred ? config.sub2Value(pred) : '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>7-Day Projection</div>
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

  const [pageTab, setPageTab] = useState<PageTab>('predictions')
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [stormSim, setStormSim] = useState(false)
  const [forecastView, setForecastView] = useState<'7day' | 'hourly'>('7day')

  // Prediction data
  const { data: v2Data, isLoading: predLoading, error: predError } = usePredictionsV2(activeStation)

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
      return { hour: `${String(hour).padStart(2, '0')}:00`, temp: hTemp, wind: hWind, gust: hGust, chill: hChill, snowProb: hSnow, solar: hSolar, pressure: hPres, condition: conditionDesc, icon, activitySafety: safety }
    })
  }, [selectedDay])

  // Prediction data
  const preds = useMemo((): Prediction[] => (!v2Data?.predictions ? [] : v2Data.predictions as Prediction[]), [v2Data])
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

            {/* Hero banner */}
            <div style={{ background: 'linear-gradient(135deg, #0b3b60 0%, #1e4d78 60%, #0b3b60 100%)', color: '#ffffff', padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#ff9933' }}>monitoring</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.02em' }}>PREDICTIVE ANALYTICS ENGINE — {activeStation.toUpperCase()} STATION</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Deterministic algorithm suite · 6 predictive models · 7-day synoptic polar forecast</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Fuel Depletion', 'Energy Load', 'Generator RUL', 'Blizzard Risk', 'Water Supply', 'Structural Stress', '7-Day Weather'].map((t) => (
                    <span key={t} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '2px 7px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3 }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                {(['maitri', 'bharati'] as const).map((s) => (
                  <button key={s} onClick={() => setStationId(s)} style={{ background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)', border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.25)', color: '#ffffff', padding: '6px 16px', fontWeight: 900, fontSize: 11, cursor: 'pointer', borderRadius: 3, letterSpacing: '0.06em' }}>
                    {s === 'maitri' ? '🏔️ MAITRI' : '🌊 BHARATI'}
                  </button>
                ))}
              </div>
            </div>

            {/* Page-level tab switcher */}
            <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', marginBottom: 12, background: '#ffffff', padding: '0 8px' }}>
              {[
                { id: 'predictions' as PageTab, label: '📊 Predictive Algorithms', icon: 'analytics' },
                { id: 'weather' as PageTab, label: '🌨 7-Day Synoptic Forecast', icon: 'cloudy_snowing' },
              ].map((t) => (
                <button key={t.id} onClick={() => setPageTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: pageTab === t.id ? 800 : 600, color: pageTab === t.id ? '#0b3b60' : '#64748b', fontSize: 12, borderBottom: pageTab === t.id ? '2px solid #0b3b60' : '2px solid transparent', marginBottom: -2 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* ───────────────────────── PREDICTIONS TAB ───────────────────────── */}
            {pageTab === 'predictions' && (
              <>
                {predError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#b91c1c', fontWeight: 700 }}>
                    ⚠ Prediction engine offline — backend connection failed. Retry or check NCPOR HQ data link.
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

                {v2Data?.generated_at && (
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                    Predictions computed: {new Date(v2Data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {preds.length} models evaluated
                  </div>
                )}

                {predLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#0b3b60', display: 'block', marginBottom: 10 }}>monitoring</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Running prediction algorithms…</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Computing 6 deterministic models for {activeStation.toUpperCase()} station</div>
                  </div>
                )}

                {!predLoading && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
                    {PANEL_CONFIGS.map((config) => <PredictionCard key={config.id} config={config} pred={predMap[config.id]} />)}
                  </div>
                )}

                {!predLoading && preds.length > 0 && (
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

            {/* ─────────────────────── WEATHER FORECAST TAB ─────────────────── */}
            {pageTab === 'weather' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Forecast header & controls */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284c7' }}>calendar_month</span>
                      {forecastView === '7day' ? '7-DAY SYNOPTIC POLAR FORECAST (CLICK ANY DAY TO INSPECT)' : '24-HOUR HOURLY MICRO-FORECAST'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9.5, color: '#64748b' }}>Anchored to Live Sensors ({liveTemp.toFixed(1)}°C, {liveWind} km/h)</span>
                      <div style={{ display: 'flex', border: '1.5px solid #0b3b60', borderRadius: 2, overflow: 'hidden' }}>
                        {(['7day', 'hourly'] as const).map((v) => (
                          <button key={v} onClick={() => setForecastView(v)} style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', background: forecastView === v ? '#0b3b60' : '#ffffff', color: forecastView === v ? '#ffffff' : '#0b3b60', border: 'none', cursor: 'pointer' }}>
                            {v === '7day' ? '7-Day' : '24-Hr'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setStormSim((s) => !s)} style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', background: stormSim ? '#fee2e2' : '#f8fafc', color: stormSim ? '#b91c1c' : '#475569', border: `1.5px solid ${stormSim ? '#f87171' : '#cbd5e1'}`, cursor: 'pointer', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: stormSim ? '#b91c1c' : '#64748b' }}>{stormSim ? 'cyclone' : 'tune'}</span>
                        {stormSim ? '⚠️ Storm Surge Active (+30%)' : 'Simulate Storm (+30%)'}
                      </button>
                    </div>
                  </div>
                </div>

                {forecastView === '7day' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
                    {forecast7Day.map((day, idx) => (
                      <WeatherDayCard key={day.name} day={day} isSelected={selectedDayIdx === idx} onClick={() => setSelectedDayIdx(idx)} />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Selected day synoptic info */}
                    <div style={{ background: '#0b3b60', color: '#ffffff', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800 }}>{selectedDay.name.toUpperCase()} — {selectedDay.desc}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{selectedDay.synoptic}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 10 }}>
                          <div><span style={{ color: '#94a3b8' }}>Temp: </span><strong>{selectedDay.temp.toFixed(1)}°C</strong></div>
                          <div><span style={{ color: '#94a3b8' }}>Wind: </span><strong>{selectedDay.wind} km/h</strong></div>
                          <div><span style={{ color: '#94a3b8' }}>Pressure: </span><strong>{selectedDay.pres} hPa</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* Hourly cards */}
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', paddingBottom: 4 }}>
                        {hourlyData.map((h, i) => {
                          const safBg = h.activitySafety === 'NO-GO' ? '#fee2e2' : h.activitySafety === 'RESTRICTED' ? '#fef3c7' : h.activitySafety === 'CAUTION' ? '#fffbeb' : '#f0fdf4'
                          const safColor = h.activitySafety === 'NO-GO' ? '#b91c1c' : h.activitySafety === 'RESTRICTED' ? '#92400e' : h.activitySafety === 'CAUTION' ? '#92400e' : '#15803d'
                          const iconColor2 = h.icon === 'sunny' || h.icon === 'partly_cloudy_day' ? '#f59e0b' : h.icon === 'cyclone' || h.icon === 'storm' ? '#ea580c' : '#0284c7'
                          return (
                            <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 8px', width: 88, textAlign: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{h.hour} UTC</div>
                              <span className="material-symbols-outlined" style={{ fontSize: 22, color: iconColor2 }}>{h.icon}</span>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{h.temp.toFixed(1)}°C</div>
                              <div style={{ fontSize: 9.5, color: '#475569', marginTop: 2 }}>💨 {h.wind} km/h</div>
                              <div style={{ fontSize: 9.5, color: '#f59e0b', fontWeight: 700 }}>⚡ {Math.round(h.gust)}</div>
                              <div style={{ fontSize: 9, color: '#0284c7', marginTop: 2 }}>❄ {h.chill.toFixed(1)}°C</div>
                              <div style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 0', marginTop: 4, background: safBg, color: safColor, borderRadius: 3 }}>{h.activitySafety}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Hourly diagnostic focus */}
                    {(() => {
                      const h = hourlyData[12]
                      return (
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60' }}>HOURLY DIAGNOSTIC FOCUS: 12:00 UTC · {selectedDay.name.split(' ')[0].toUpperCase()}</div>
                            <span style={{ fontSize: 10, fontWeight: 800, background: h.activitySafety === 'NO-GO' ? '#fee2e2' : '#fef3c7', color: h.activitySafety === 'NO-GO' ? '#b91c1c' : '#92400e', padding: '3px 10px', borderRadius: 3, border: `1px solid ${h.activitySafety === 'NO-GO' ? '#fca5a5' : '#fde68a'}` }}>
                              {h.activitySafety}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                            {[
                              { label: 'TEMPERATURE', value: `${h.temp.toFixed(1)}°C` },
                              { label: 'WIND CHILL', value: `${h.chill.toFixed(1)}°C`, accent: '#0284c7' },
                              { label: 'SUSTAINED WIND', value: `${h.wind} km/h` },
                              { label: 'PEAK GUST', value: `${Math.round(h.gust)} km/h`, accent: '#f59e0b' },
                              { label: 'BLIZZARD PROB', value: `${h.snowProb}%`, accent: h.snowProb > 50 ? '#dc2626' : '#d97706' },
                              { label: 'BAROMETER', value: `${h.pressure} hPa` },
                            ].map((m) => (
                              <div key={m.label}>
                                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: m.accent ?? '#0f172a', marginTop: 4 }}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                          {h.snowProb > 50 && (
                            <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #d97706', padding: '8px 12px', fontSize: 10, color: '#92400e', fontWeight: 700 }}>
                              ⚠ Operational Advisory (12:00 UTC): High blizzard probability — all outdoor activities require Level-2 thermal PPE and buddy-system compliance.
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </>
                )}

                {/* Day selector quick-nav for hourly view */}
                {forecastView === 'hourly' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {forecast7Day.map((day, idx) => (
                      <button key={idx} onClick={() => setSelectedDayIdx(idx)} style={{ padding: '5px 12px', background: selectedDayIdx === idx ? '#0b3b60' : '#ffffff', color: selectedDayIdx === idx ? '#ffffff' : '#334155', border: `1px solid ${selectedDayIdx === idx ? '#0b3b60' : '#cbd5e1'}`, fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 3 }}>
                        {day.name} — {day.temp.toFixed(1)}°C
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
