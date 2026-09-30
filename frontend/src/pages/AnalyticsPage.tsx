import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { usePredictionsV2 } from '../hooks/usePredictiveAI'

// ── Types ─────────────────────────────────────────────────────────────────────

type StationId = 'maitri' | 'bharati'
type RiskLevel = 'NOMINAL' | 'WARNING' | 'CRITICAL'

interface Prediction {
  model_name: string
  metric: string
  val: number
  risk: RiskLevel
  data: Record<string, number>
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function riskColor(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#dc2626'
  if (risk === 'WARNING')  return '#d97706'
  return '#16a34a'
}

function riskBg(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#fef2f2'
  if (risk === 'WARNING')  return '#fffbeb'
  return '#f0fdf4'
}

function riskBorder(risk: RiskLevel) {
  if (risk === 'CRITICAL') return '#fecaca'
  if (risk === 'WARNING')  return '#fde68a'
  return '#bbf7d0'
}

// ── Spark bar (CSS only, no canvas) ─────────────────────────────────────────

function SparkBars({ data, accentColor, risk }: { data: number[]; accentColor: string; risk: RiskLevel }) {
  const max = Math.max(...data, 1)
  const barColor = risk === 'CRITICAL' ? '#dc2626' : risk === 'WARNING' ? '#d97706' : accentColor
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 52, gap: 3 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div
            style={{
              width: '100%',
              height: `${Math.max(4, (v / max) * 48)}px`,
              background: i === data.length - 1 ? barColor : `${barColor}66`,
              borderRadius: '2px 2px 0 0',
              transition: 'height 0.4s',
            }}
          />
          <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>D+{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

// ── Risk pill ────────────────────────────────────────────────────────────────

function RiskPill({ risk }: { risk: RiskLevel }) {
  const icons: Record<RiskLevel, string> = { NOMINAL: '✓', WARNING: '⚠', CRITICAL: '!' }
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        padding: '2px 8px',
        background: riskBg(risk),
        color: riskColor(risk),
        border: `1px solid ${riskBorder(risk)}`,
        borderRadius: 3,
        letterSpacing: '0.04em',
      }}
    >
      {icons[risk]} {risk}
    </span>
  )
}

// ── Metric value display ─────────────────────────────────────────────────────

function BigValue({ value, unit, risk }: { value: string; unit?: string; risk: RiskLevel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 28, fontWeight: 900, color: riskColor(risk), lineHeight: 1 }}>
        {value}
      </span>
      {unit && (
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{unit}</span>
      )}
    </div>
  )
}

// ── Immediate action box ─────────────────────────────────────────────────────

function ActionBox({ risk, actions }: { risk: RiskLevel; actions: { WARNING: string[]; CRITICAL: string[] } }) {
  if (risk === 'NOMINAL') return null
  const steps = actions[risk] || []
  return (
    <div
      style={{
        background: riskBg(risk),
        border: `1px solid ${riskBorder(risk)}`,
        borderLeft: `4px solid ${riskColor(risk)}`,
        padding: '10px 14px',
        marginTop: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: riskColor(risk),
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {risk === 'CRITICAL' ? 'emergency' : 'warning'}
        </span>
        {risk === 'CRITICAL' ? 'CRITICAL — Immediate Action Required' : 'Action Advisory'}
      </div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ fontSize: 11, color: '#334155', marginBottom: 4, lineHeight: 1.5, fontWeight: 600 }}>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Prediction card ───────────────────────────────────────────────────────────

interface PanelConfig {
  id: string
  title: string
  subtitle: string
  icon: string
  accentColor: string
  modelName: string
  formatValue: (pred: Prediction) => { main: string; unit: string }
  sub1Label: string
  sub1Value: (pred: Prediction) => string
  sub2Label: string
  sub2Value: (pred: Prediction) => string
  sparkData: (pred: Prediction) => number[]
  actions: { WARNING: string[]; CRITICAL: string[] }
}

function PredictionCard({
  config,
  pred,
  loading,
}: {
  config: PanelConfig
  pred: Prediction | undefined
  loading: boolean
}) {
  const risk: RiskLevel = pred?.risk ?? 'NOMINAL'
  const sparkData = pred ? config.sparkData(pred) : [50, 52, 54, 56, 58, 60, 62]
  const fmtVal = pred ? config.formatValue(pred) : { main: '—', unit: '' }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: `3px solid ${config.accentColor}`,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: `${config.accentColor}18`,
              border: `1px solid ${config.accentColor}33`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: config.accentColor }}>
              {config.icon}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{config.title}</div>
            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>{config.subtitle}</div>
          </div>
        </div>
        <RiskPill risk={risk} />
      </div>

      {/* Main metric */}
      <div>
        {loading ? (
          <div style={{ fontSize: 22, fontWeight: 900, color: '#94a3b8' }}>Loading…</div>
        ) : (
          <BigValue value={fmtVal.main} unit={fmtVal.unit} risk={risk} />
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              {config.sub1Label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>
              {pred ? config.sub1Value(pred) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              {config.sub2Label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>
              {pred ? config.sub2Value(pred) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Spark bars */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
          7-Day Projection
        </div>
        <SparkBars data={sparkData} accentColor={config.accentColor} risk={risk} />
      </div>

      {/* Immediate action box */}
      {pred && <ActionBox risk={risk} actions={config.actions} />}
    </div>
  )
}

// ── Top KPI strip card ────────────────────────────────────────────────────────

function KpiStrip({
  label,
  value,
  unit,
  risk,
  icon,
}: {
  label: string
  value: string
  unit: string
  risk: RiskLevel
  icon: string
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: `3px solid ${riskColor(risk)}`,
        padding: '10px 14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: riskColor(risk) }}>
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: riskColor(risk), lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{unit}</div>
    </div>
  )
}

// ── Panel configs ─────────────────────────────────────────────────────────────

const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: 'fuel',
    title: 'Fuel Depletion Forecast',
    subtitle: 'Linear extrapolation · 7-day burn trend',
    icon: 'local_gas_station',
    accentColor: '#ea580c',
    modelName: 'FuelDepletion',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToCritical ?? p.val)}`, unit: 'days to 30% level' }),
    sub1Label: 'Days to Empty',
    sub1Value: (p) => `${Math.round(p.data.daysToEmpty ?? 0)} days`,
    sub2Label: 'Forecasted Burn',
    sub2Value: (p) => `${Math.round(p.data.forecastedBurnDay7 ?? 0)} L/day`,
    sparkData: (p) => {
      const base = p.data.daysToEmpty ?? 100
      return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * (p.data.forecastedBurnDay7 ?? 1240) / 1000))
    },
    actions: {
      WARNING: [
        'Place resupply vessel order immediately — minimum 45-day lead time required',
        'Reduce non-critical generator loads by 10% to extend autonomy',
        'Notify NCPOR Goa logistics team of projected depletion date',
      ],
      CRITICAL: [
        'EMERGENCY RESUPPLY: Contact NCPOR HQ Director immediately',
        'Activate Station Order 7B — mandatory fuel rationing begins now',
        'Shed all non-life-support electrical loads',
        'Broadcast emergency SBD Iridium message to NCPOR Goa',
      ],
    },
  },
  {
    id: 'energy',
    title: 'Energy Load Prediction',
    subtitle: 'Heating Degree-Days method · crew + climate',
    icon: 'bolt',
    accentColor: '#7c3aed',
    modelName: 'EnergyLoad',
    formatValue: (p) => ({ main: `${Math.round(p.data.load_kw ?? p.val)}`, unit: 'kW predicted load' }),
    sub1Label: 'Grid Margin',
    sub1Value: (p) => {
      const d = p.data.deficit ?? 0
      return d > 0 ? `−${Math.round(d)} kW deficit` : `+${Math.round(Math.abs(d))} kW surplus`
    },
    sub2Label: 'Status',
    sub2Value: (p) => (p.data.deficit ?? 0) > 0 ? 'OVER CAPACITY' : 'WITHIN LIMITS',
    sparkData: () => [162, 168, 172, 175, 170, 165, 160],
    actions: {
      WARNING: [
        'Switch laboratory and workshop loads to off-peak hours',
        'Pre-warm backup generator DG-2 for supplemental dispatch',
        'Monitor battery SoC — avoid dropping below 60%',
      ],
      CRITICAL: [
        'ACTIVATE LOAD-SHEDDING: Immediately disconnect non-essential circuits',
        'Start DG-2 in parallel with DG-1 for combined output',
        'Notify station commander — grid reliability at risk',
        'Defer all high-power experiments and equipment charging',
      ],
    },
  },
  {
    id: 'generator',
    title: 'Generator Remaining Life',
    subtitle: 'Weibull hazard model · β=2.2, η=4500h',
    icon: 'engineering',
    accentColor: '#0284c7',
    modelName: 'GeneratorRUL',
    formatValue: (p) => ({ main: `${Math.round(p.data.RUL_hours ?? p.val)}`, unit: 'hours remaining' }),
    sub1Label: 'Reliability Target',
    sub1Value: () => '90% confidence',
    sub2Label: 'Hrs Since Overhaul',
    sub2Value: () => '2,180 hrs',
    sparkData: (p) => {
      const base = p.data.RUL_hours ?? 2300
      return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 24))
    },
    actions: {
      WARNING: [
        'Schedule DG-1 overhaul within the next 7 days',
        'Verify DG-2 is in full operational readiness as standby primary',
        'Increase vibration and oil-pressure monitoring frequency to every 4 hours',
      ],
      CRITICAL: [
        'STOP DG-1: Shutdown risk is imminent — switch to DG-2 immediately',
        'Emergency engineering inspection of DG-1 bearings and lube system',
        'Alert NCPOR Goa for replacement parts on next cargo flight',
        'Implement single-genset power rationing protocol',
      ],
    },
  },
  {
    id: 'blizzard',
    title: 'Blizzard Probability',
    subtitle: 'Logistic model · wind + pressure + humidity',
    icon: 'severe_cold',
    accentColor: '#0369a1',
    modelName: 'BlizzardProb',
    formatValue: (p) => ({ main: `${(p.data.blizzard_prob_pct ?? p.val).toFixed(1)}`, unit: '% probability' }),
    sub1Label: 'Wind Input',
    sub1Value: () => '35 km/h',
    sub2Label: 'dP/dt Input',
    sub2Value: () => '−1.2 hPa/hr',
    sparkData: (p) => {
      const base = p.data.blizzard_prob_pct ?? 40
      return [base * 0.6, base * 0.75, base * 0.9, base, base * 1.1, base * 0.95, base * 0.7].map(v =>
        Math.min(100, Math.max(0, v))
      )
    },
    actions: {
      WARNING: [
        'Secure all outdoor equipment, vehicles, and antenna mounts',
        'Brief all personnel on Blizzard Protocol B — no lone outdoor work',
        'Pre-position emergency thermal suits at all exit points',
        'Check HF radio backup and confirm antenna integrity',
      ],
      CRITICAL: [
        'STATION LOCKDOWN: All outdoor operations immediately suspended',
        'Account for all personnel — enforce 2-person buddy system',
        'Activate HF backup radio — VSAT antenna stowed for protection',
        'Operate in emergency heating mode — conserve fuel reserves',
      ],
    },
  },
  {
    id: 'water',
    title: 'Water Supply Sustainability',
    subtitle: 'Snowmelt vs. crew consumption model',
    icon: 'water_drop',
    accentColor: '#0891b2',
    modelName: 'WaterSustainability',
    formatValue: (p) => ({ main: `${Math.round(p.data.daysToRefillNeeded ?? p.val)}`, unit: 'days until refill' }),
    sub1Label: 'Net Daily Change',
    sub1Value: (p) => `${(p.data.netDailyChange ?? 0).toFixed(1)} L/day`,
    sub2Label: 'Current Volume',
    sub2Value: () => '15,000 L',
    sparkData: (p) => {
      const base = p.data.daysToRefillNeeded ?? 60
      return Array.from({ length: 7 }, (_, i) => Math.max(0, base - i * 2))
    },
    actions: {
      WARNING: [
        'Activate snow-melt unit at full capacity to maximise input rate',
        'Reduce crew water allocation — limit showers to 2 min/person/day',
        'Identify and repair any leaks in the distribution system',
      ],
      CRITICAL: [
        'WATER EMERGENCY: Activate emergency ration mode — essential use only',
        'All snow-melt units at maximum capacity immediately',
        'Suspend all non-drinking water uses (cleaning, experiments)',
        'Notify NCPOR Goa — request emergency water delivery on next aircraft',
      ],
    },
  },
  {
    id: 'structural',
    title: 'Structural Load Assessment',
    subtitle: 'Snow load + wind pressure vs. design limit',
    icon: 'domain',
    accentColor: '#475569',
    modelName: 'StructuralStress',
    formatValue: (p) => ({ main: `${(p.data.stressPercent ?? p.val).toFixed(1)}`, unit: '% of safe limit' }),
    sub1Label: 'Total Load',
    sub1Value: (p) => `${(p.data.totalLoad ?? 0).toFixed(2)} kPa`,
    sub2Label: 'Design Limit',
    sub2Value: () => '6.0 kPa',
    sparkData: (p) => {
      const base = p.data.stressPercent ?? 45
      return Array.from({ length: 7 }, (_, i) => Math.min(100, base + i * 2.5))
    },
    actions: {
      WARNING: [
        'Deploy snow-clearing team to roof structures and satellite dish mounts',
        'Activate de-icing cable network on all load-bearing roof sections',
        'Inspect structural connections at foundation level for cracking',
      ],
      CRITICAL: [
        'STRUCTURAL ALERT: Evacuate personnel from affected modules immediately',
        'Mandatory engineering inspection before re-entry is permitted',
        'Contact NCPOR HQ structural team for emergency consultation',
        'Activate secondary accommodation — restrict habitation to safe modules',
      ],
    },
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { stationId, setStationId } = useStation()
  const activeStation = stationId as StationId

  const { data: v2Data, isLoading, error } = usePredictionsV2(activeStation)

  const preds = useMemo((): Prediction[] => {
    if (!v2Data?.predictions) return []
    return v2Data.predictions as Prediction[]
  }, [v2Data])

  const getPred = (name: string) => preds.find((p) => p.model_name === name)

  // Derived per-model predictions
  const fuelPred    = getPred('FuelDepletion')
  const energyPred  = getPred('EnergyLoad')
  const genPred     = getPred('GeneratorRUL')
  const blizzPred   = getPred('BlizzardProb')
  const waterPred   = getPred('WaterSustainability')
  const structPred  = getPred('StructuralStress')

  const predMap: Record<string, Prediction | undefined> = {
    fuel: fuelPred, energy: energyPred, generator: genPred,
    blizzard: blizzPred, water: waterPred, structural: structPred,
  }

  // Compute system-wide risk summary
  const allRisks = preds.map((p) => p.risk)
  const criticalCount = allRisks.filter((r) => r === 'CRITICAL').length
  const warningCount  = allRisks.filter((r) => r === 'WARNING').length
  const overallStatus: RiskLevel = criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'NOMINAL'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          activeStation={activeStation}
          onSwitchStation={() => setStationId(activeStation === 'maitri' ? 'bharati' : 'maitri')}
        />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px 20px' }}>

            {/* Breadcrumb */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '5px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}
                >
                  Home
                </button>
                <span>›</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>Polar Operations</span>
                <span>›</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>Predictive Analytics</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    background: overallStatus === 'CRITICAL' ? '#fef2f2' : overallStatus === 'WARNING' ? '#fffbeb' : '#f0fdf4',
                    color: riskColor(overallStatus),
                    border: `1px solid ${riskBorder(overallStatus)}`,
                    padding: '2px 8px',
                    borderRadius: 2,
                  }}
                >
                  {overallStatus === 'NOMINAL' ? '✓' : '⚠'} SYSTEM: {overallStatus}
                  {criticalCount > 0 && ` · ${criticalCount} CRITICAL`}
                  {warningCount > 0 && ` · ${warningCount} WARNING`}
                </span>
              </div>
            </div>

            {/* Page hero banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0b3b60 0%, #1e4d78 60%, #0b3b60 100%)',
                color: '#ffffff',
                padding: '14px 20px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#ff9933' }}>monitoring</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.02em' }}>
                      PREDICTIVE ANALYTICS ENGINE — {activeStation.toUpperCase()} STATION
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Deterministic algorithm suite · 6 predictive models · Results updated on demand and persisted to DB
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Fuel Depletion', 'Energy Load', 'Generator RUL', 'Blizzard Risk', 'Water Supply', 'Structural Stress'].map((t) => (
                    <span key={t} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '2px 7px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                {(['maitri', 'bharati'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStationId(s)}
                    style={{
                      background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)',
                      border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.25)',
                      color: '#ffffff',
                      padding: '6px 16px',
                      fontWeight: 900,
                      fontSize: 11,
                      cursor: 'pointer',
                      borderRadius: 3,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {s === 'maitri' ? '🏔️ MAITRI' : '🌊 BHARATI'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Error / Loading banner ── */}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#b91c1c', fontWeight: 700 }}>
                ⚠ Prediction engine offline — backend connection failed. Retry or check NCPOR HQ data link.
              </div>
            )}

            {/* ── KPI summary strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
              <KpiStrip
                label="Fuel Critical In"
                value={fuelPred ? `${Math.round(fuelPred.data.daysToCritical ?? fuelPred.val)}d` : '—'}
                unit="days to 30% level"
                risk={fuelPred?.risk ?? 'NOMINAL'}
                icon="local_gas_station"
              />
              <KpiStrip
                label="Predicted Load"
                value={energyPred ? `${Math.round(energyPred.data.load_kw ?? energyPred.val)}kW` : '—'}
                unit={(energyPred?.data.deficit ?? 0) > 0 ? 'OVER CAPACITY' : 'within limits'}
                risk={energyPred?.risk ?? 'NOMINAL'}
                icon="bolt"
              />
              <KpiStrip
                label="Generator RUL"
                value={genPred ? `${Math.round(genPred.data.RUL_hours ?? genPred.val)}h` : '—'}
                unit="hours of useful life"
                risk={genPred?.risk ?? 'NOMINAL'}
                icon="engineering"
              />
              <KpiStrip
                label="Blizzard Probability"
                value={blizzPred ? `${(blizzPred.data.blizzard_prob_pct ?? blizzPred.val).toFixed(0)}%` : '—'}
                unit="next 6-hour window"
                risk={blizzPred?.risk ?? 'NOMINAL'}
                icon="severe_cold"
              />
              <KpiStrip
                label="Water Days Left"
                value={waterPred ? `${Math.round(waterPred.data.daysToRefillNeeded ?? waterPred.val)}d` : '—'}
                unit="until refill needed"
                risk={waterPred?.risk ?? 'NOMINAL'}
                icon="water_drop"
              />
              <KpiStrip
                label="Structural Load"
                value={structPred ? `${(structPred.data.stressPercent ?? structPred.val).toFixed(0)}%` : '—'}
                unit="of 6.0 kPa design limit"
                risk={structPred?.risk ?? 'NOMINAL'}
                icon="domain"
              />
            </div>

            {/* ── Last computed timestamp ── */}
            {v2Data?.generated_at && (
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                Predictions computed: {new Date(v2Data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                &nbsp;·&nbsp; Station: {activeStation.toUpperCase()}
                &nbsp;·&nbsp; {preds.length} models evaluated
              </div>
            )}

            {/* ── Loading state ── */}
            {isLoading && (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#0b3b60', display: 'block', marginBottom: 10 }}>monitoring</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Running prediction algorithms…</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Computing 6 deterministic models for {activeStation.toUpperCase()} station</div>
              </div>
            )}

            {/* ── 6 Prediction Cards Grid ── */}
            {!isLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 12 }}>
                {PANEL_CONFIGS.map((config) => (
                  <PredictionCard
                    key={config.id}
                    config={config}
                    pred={predMap[config.id]}
                    loading={isLoading}
                  />
                ))}
              </div>
            )}

            {/* ── System Assessment Summary ── */}
            {!isLoading && preds.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderTop: `3px solid ${riskColor(overallStatus)}`,
                  padding: '14px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: riskColor(overallStatus) }}>
                      {overallStatus === 'NOMINAL' ? 'check_circle' : overallStatus === 'WARNING' ? 'warning' : 'emergency'}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>System Status Assessment</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{activeStation.toUpperCase()} Station · All 6 predictive models evaluated</div>
                    </div>
                  </div>
                  <RiskPill risk={overallStatus} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {preds.map((p) => (
                    <div
                      key={p.model_name}
                      style={{
                        padding: '5px 10px',
                        background: riskBg(p.risk),
                        border: `1px solid ${riskBorder(p.risk)}`,
                        fontSize: 10,
                        fontWeight: 700,
                        color: riskColor(p.risk),
                        borderRadius: 3,
                      }}
                    >
                      {p.model_name.replace(/([A-Z])/g, ' $1').trim()}: {p.risk}
                    </div>
                  ))}
                </div>
                {overallStatus === 'NOMINAL' && (
                  <div style={{ marginTop: 10, fontSize: 10.5, color: '#166534', fontWeight: 700 }}>
                    ✓ All predictive models indicate nominal station health. No immediate action required.
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
