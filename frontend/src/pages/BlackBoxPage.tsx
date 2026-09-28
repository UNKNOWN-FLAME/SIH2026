import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import TopNav from '../components/layout/TopNav'
import Footer from '../components/layout/Footer'
import emblemOfIndia from '../assets/emblem_of_india.svg'

type StationId = 'maitri' | 'bharati'

interface IncidentConfig {
  id: string
  stationId: StationId
  stationName: string
  incidentName: string
  incidentDate: string
  sitrepNumber: string
}

const INCIDENTS: Record<StationId, IncidentConfig> = {
  maitri: {
    id: 'BB-MAITRI-2026-0924-01',
    stationId: 'maitri',
    stationName: 'Maitri Research Station',
    incidentName: 'DG-1 Fuel Line Freeze & Full Station Power Blackout',
    incidentDate: '24 Sep 2026 • 02:40 UTC (08:10 IST)',
    sitrepNumber: 'NCPOR/SITREP/45-ISEA/MAI/2026-W37',
  },
  bharati: {
    id: 'BB-BHARATI-2026-0922-02',
    stationId: 'bharati',
    stationName: 'Bharati Research Station',
    incidentName: 'Larsemann Habitat HVAC Damper Jam & Thermal Coil Overload',
    incidentDate: '22 Sep 2026 • 18:15 UTC (23:45 IST)',
    sitrepNumber: 'NCPOR/SITREP/45-ISEA/BHA/2026-W37',
  },
}

interface TelemetryPoint {
  offsetHours: number // -5.0 to +5.0 relative to blackout
  label: string // e.g. "T-02:30", "T=00:00", "T+01:45"
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
  vibrationRms: number
  status: 'PRE_INCIDENT' | 'BLACKOUT_TRIP' | 'RECOVERY'
}

function generate10HourReplay(stationId: StationId): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  for (let step = -50; step <= 50; step++) {
    const offset = Math.round(step) / 10
    const absOffset = Math.abs(offset)
    const sign = offset < 0 ? '-' : offset > 0 ? '+' : '='
    const hours = Math.floor(absOffset)
    const minutes = Math.round((absOffset - hours) * 60)
    const label = `T${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    let powerKw = stationId === 'maitri' ? 84.2 : 96.0
    let fuelPressureBar = 4.2
    let coolantTempC = 86.0
    let habitatTempC = 21.4
    let vibrationRms = 1.2
    let status: TelemetryPoint['status'] = 'PRE_INCIDENT'

    if (offset < -1.5) {
      const ripple = Math.sin(offset * 2) * 0.8
      powerKw += ripple
      coolantTempC += ripple * 0.3
      status = 'PRE_INCIDENT'
    } else if (offset >= -1.5 && offset < 0) {
      const severity = (offset + 1.5) / 1.5
      powerKw -= severity * 12
      fuelPressureBar -= severity * 1.6
      coolantTempC += severity * 8
      vibrationRms += severity * 3.2
      habitatTempC -= severity * 1.5
      status = 'PRE_INCIDENT'
    } else if (offset >= 0 && offset <= 1.2) {
      powerKw = 0.0 // Blackout stall
      fuelPressureBar = 0.3 // Line frozen
      coolantTempC = 99.4
      vibrationRms = 8.4
      habitatTempC = 16.8 // Heat plunge
      status = 'BLACKOUT_TRIP'
    } else {
      const rec = Math.min(1, (offset - 1.2) / 1.8)
      powerKw = 25 + rec * 57.0 // Backup generator online
      fuelPressureBar = 1.8 + rec * 2.1
      coolantTempC = 99.4 - rec * 12.0
      vibrationRms = Math.max(0.6, 8.4 - rec * 7.6)
      habitatTempC = 16.8 + rec * 3.7
      status = 'RECOVERY'
    }

    points.push({
      offsetHours: offset,
      label,
      powerKw: Number(powerKw.toFixed(1)),
      fuelPressureBar: Number(fuelPressureBar.toFixed(2)),
      coolantTempC: Number(coolantTempC.toFixed(1)),
      habitatTempC: Number(habitatTempC.toFixed(1)),
      vibrationRms: Number(vibrationRms.toFixed(2)),
      status,
    })
  }
  return points
}

export default function BlackBoxPage() {
  const navigate = useNavigate()
  const [stationId, setStationId] = useState<StationId>('maitri')
  const [playheadOffset, setPlayheadOffset] = useState<number>(0.0) // default to Blackout Event (T=0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const incident = INCIDENTS[stationId]
  const telemetryData = useMemo(() => generate10HourReplay(stationId), [stationId])

  const activePoint = useMemo(() => {
    let closest = telemetryData[0]
    let minDiff = 999
    for (const pt of telemetryData) {
      const diff = Math.abs(pt.offsetHours - playheadOffset)
      if (diff < minDiff) {
        minDiff = diff
        closest = pt
      }
    }
    return closest
  }, [telemetryData, playheadOffset])

  const isTrip = playheadOffset >= 0 && playheadOffset <= 1.2

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setPlayheadOffset((prev) => {
          const next = Number((prev + 0.1 * playbackSpeed).toFixed(1))
          if (next > 5.0) {
            setIsPlaying(false)
            return 5.0
          }
          return next
        })
      }, 300)
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, playbackSpeed])

  // ESC to exit
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') navigate(-1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      {/* Official Government Top Navigation */}
      <TopNav />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '12px 20px 24px 20px', maxWidth: 1540, width: '100%', margin: '0 auto' }}>
        
        {/* Government Breadcrumb Bar */}
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
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#991b1b' }}>e911_emergency</span>
            <span style={{ color: '#0b3b60', fontWeight: 700 }}>HOME</span>
            <span>&gt;</span>
            <span style={{ color: '#0b3b60', fontWeight: 600 }}>POLAR OPERATIONS DIVISION</span>
            <span>&gt;</span>
            <span style={{ color: '#991b1b', fontWeight: 800 }}>BLACK BOX EMERGENCY FLIGHT RECORDER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', fontWeight: 800, border: '1px solid #fecaca', borderRadius: 2 }}>
              INCIDENT ENQUIRY BUFFER • {incident.sitrepNumber}
            </span>
          </div>
        </div>

        {/* ── Official Black Box Incident Banner (Reddish Emergency Government Theme) ── */}
        <div
          style={{
            background: 'linear-gradient(90deg, #fff5f5 0%, #ffffff 100%)',
            border: '1px solid #fecdd3',
            borderLeft: '4px solid #dc2626',
            borderTop: '2px solid #dc2626',
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 1px 3px rgba(220, 38, 38, 0.06)',
          }}
        >
          {/* Left: Station & Incident Identification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 42,
                background: '#ffffff',
                border: '1px solid #fecaca',
                borderRadius: 3,
                padding: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img src={emblemOfIndia} alt="National Emblem of India" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: 2,
                    letterSpacing: '0.06em',
                    fontFamily: 'monospace',
                  }}
                >
                  BLACK BOX RECORDER
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#991b1b' }}>
                  {incident.stationName}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>•</span>
                <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
                  {incident.incidentName}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Recorded Incident Timestamp: <strong style={{ color: '#1e293b' }}>{incident.incidentDate}</strong>
              </div>
            </div>
          </div>

          {/* Center: Incident Station Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', padding: 4, borderRadius: 4, border: '1px solid #fecaca' }}>
            <button
              onClick={() => {
                setStationId('maitri')
                setPlayheadOffset(0.0)
              }}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                background: stationId === 'maitri' ? '#b91c1c' : 'transparent',
                color: stationId === 'maitri' ? '#ffffff' : '#991b1b',
                border: 'none',
                borderRadius: 3,
                transition: 'all 0.15s ease',
              }}
            >
              📍 Maitri: DG-1 Blackout
            </button>
            <button
              onClick={() => {
                setStationId('bharati')
                setPlayheadOffset(0.0)
              }}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                background: stationId === 'bharati' ? '#b91c1c' : 'transparent',
                color: stationId === 'bharati' ? '#ffffff' : '#991b1b',
                border: 'none',
                borderRadius: 3,
                transition: 'all 0.15s ease',
              }}
            >
              📍 Bharati: HVAC Trip
            </button>
          </div>

          {/* Right: Return to Operations Button */}
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: '#991b1b',
              color: '#ffffff',
              border: '1px solid #b91c1c',
              borderRadius: 3,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(153, 27, 27, 0.25)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#7f1d1d')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#991b1b')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            <span>Return to Dashboard</span>
            <span style={{ fontSize: 9.5, opacity: 0.85 }}>(ESC)</span>
          </button>
        </div>

        {/* ── Main Forensic Chart Card (Reddish Government Theme) ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderTop: '3px solid #b91c1c',
            borderRadius: 3,
            padding: '14px 18px',
            marginBottom: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header Bar inside card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #fecdd3' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#b91c1c', fontSize: 18 }}>emergency</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#881337', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                10-Hour Forensic Incident Window [-5h to +5h Relative to Blackout Event]
              </span>
            </div>

            {/* Playhead Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontFamily: 'monospace' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Forensic Playhead:</span>
              <span
                style={{
                  background: isTrip ? '#fee2e2' : '#f1f5f9',
                  color: isTrip ? '#991b1b' : '#0f172a',
                  border: isTrip ? '1px solid #fecaca' : '1px solid #cbd5e1',
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontWeight: 900,
                }}
              >
                {activePoint.label}
              </span>
              <span style={{ color: isTrip ? '#b91c1c' : '#0b3b60', fontWeight: 700 }}>
                {playheadOffset === 0 ? '● BLACKOUT ONSET' : playheadOffset < 0 ? `${Math.abs(playheadOffset)}h Before Blackout` : `${playheadOffset}h After Recovery`}
              </span>
            </div>
          </div>

          {/* Area Chart with abundant top padding so labels are never cut off */}
          <div style={{ height: 260, width: '100%', background: '#fffafa', borderRadius: 4, padding: '6px 10px 0 0', border: '1px solid #f1f5f9' }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* Note: top margin is increased to 32px to ensure label text is completely visible with zero cutoff */}
              <AreaChart data={telemetryData} margin={{ top: 32, right: 15, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerRedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                  interval={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                  domain={[0, 105]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TelemetryPoint
                      return (
                        <div
                          style={{
                            background: '#1c1917',
                            border: '1px solid #b91c1c',
                            color: '#ffffff',
                            borderRadius: 3,
                            padding: '8px 12px',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#f87171' }}>{data.label}</div>
                          <div>Generator Output: <strong>{data.powerKw} kW</strong></div>
                          <div>Fuel Line Pressure: <strong>{data.fuelPressureBar} Bar</strong></div>
                          <div>Habitat Temp: <strong>{data.habitatTempC} °C</strong></div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                {/* Blackout Marker Line - with 32px top margin, this label will NEVER be cut off */}
                <ReferenceLine
                  x="T=00:00"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: '🚨 BLACKOUT ONSET (T=0)', fill: '#b91c1c', fontSize: 11, position: 'top', fontWeight: 900 }}
                />
                {/* Active Playhead Marker */}
                <ReferenceLine
                  x={activePoint.label}
                  stroke="#0b3b60"
                  strokeWidth={2}
                  label={{ value: '▼ PLAYHEAD', fill: '#0b3b60', fontSize: 10, position: 'top', fontWeight: 800 }}
                />
                <Area type="monotone" dataKey="powerKw" stroke="#dc2626" strokeWidth={2.5} fillOpacity={1} fill="url(#powerRedGrad)" name="Generator Load (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Playback Toolbar */}
          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: 3,
              padding: '8px 14px',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                background: isPlaying ? '#ea580c' : '#b91c1c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 3,
                fontWeight: 700,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            {/* Playback Speeds */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 2,
                    fontSize: 10,
                    fontWeight: 700,
                    background: playbackSpeed === speed ? '#991b1b' : '#ffffff',
                    color: playbackSpeed === speed ? '#ffffff' : '#334155',
                    border: '1px solid #fecaca',
                    cursor: 'pointer',
                  }}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Jump to Event */}
            <button
              onClick={() => setPlayheadOffset(0.0)}
              style={{
                padding: '4px 10px',
                background: '#ffffff',
                color: '#991b1b',
                border: '1.5px solid #dc2626',
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🚨 Jump to Blackout (T=0)
            </button>

            {/* Scrubber Range Slider */}
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#991b1b', fontFamily: 'monospace', fontWeight: 700 }}>-5h</span>
              <input
                type="range"
                min="-5.0"
                max="5.0"
                step="0.1"
                value={playheadOffset}
                onChange={(e) => setPlayheadOffset(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#dc2626',
                  cursor: 'pointer',
                  height: 5,
                }}
              />
              <span style={{ fontSize: 10, color: '#991b1b', fontFamily: 'monospace', fontWeight: 700 }}>+5h</span>
            </div>
          </div>
        </div>

        {/* ── Section 2: Sensor Telemetry Cards (Reddish Government Theme) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          {/* Tile 1: Primary Generator */}
          <div
            style={{
              background: '#ffffff',
              border: activePoint.powerKw < 30 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              borderTop: activePoint.powerKw < 30 ? '3px solid #dc2626' : '3px solid #0b3b60',
              borderRadius: 3,
              padding: '12px 14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Primary Generator Output</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.powerKw < 30 ? '#dc2626' : '#0b3b60', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.powerKw} kW
            </div>
            <div style={{ fontSize: 10, color: activePoint.powerKw < 30 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
              {activePoint.powerKw < 30 ? 'CRITICAL GENERATOR TRIP' : 'NOMINAL GENERATION (84 kW)'}
            </div>
          </div>

          {/* Tile 2: Fuel Line Pressure */}
          <div
            style={{
              background: '#ffffff',
              border: activePoint.fuelPressureBar < 1.0 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              borderTop: activePoint.fuelPressureBar < 1.0 ? '3px solid #dc2626' : '3px solid #0b3b60',
              borderRadius: 3,
              padding: '12px 14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Diesel Fuel Line Pressure</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.fuelPressureBar < 1.0 ? '#dc2626' : '#0b3b60', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.fuelPressureBar} Bar
            </div>
            <div style={{ fontSize: 10, color: activePoint.fuelPressureBar < 1.0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
              {activePoint.fuelPressureBar < 1.0 ? 'LINE FREEZE (0.3 Bar)' : 'NORMAL FLOW (4.2 Bar)'}
            </div>
          </div>

          {/* Tile 3: Engine Vibration Harmonics */}
          <div
            style={{
              background: '#ffffff',
              border: activePoint.vibrationRms > 4.0 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              borderTop: activePoint.vibrationRms > 4.0 ? '3px solid #dc2626' : '3px solid #0b3b60',
              borderRadius: 3,
              padding: '12px 14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Engine Knock Vibration</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.vibrationRms > 4.0 ? '#dc2626' : '#0b3b60', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.vibrationRms} mm/s
            </div>
            <div style={{ fontSize: 10, color: activePoint.vibrationRms > 4.0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
              {activePoint.vibrationRms > 4.0 ? 'CYLINDER MISFIRE (8.4 mm/s)' : 'NOMINAL SMOOTH (1.2 mm/s)'}
            </div>
          </div>

          {/* Tile 4: Habitat Temp */}
          <div
            style={{
              background: '#ffffff',
              border: activePoint.habitatTempC < 18.0 ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
              borderTop: activePoint.habitatTempC < 18.0 ? '3px solid #ea580c' : '3px solid #0b3b60',
              borderRadius: 3,
              padding: '12px 14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Living Habitat Temperature</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.habitatTempC < 18.0 ? '#d97706' : '#0b3b60', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.habitatTempC} °C
            </div>
            <div style={{ fontSize: 10, color: activePoint.habitatTempC < 18.0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
              {activePoint.habitatTempC < 18.0 ? 'HEAT LOSS (+16.8°C)' : 'COMFORT RANGE (+21.4°C)'}
            </div>
          </div>
        </div>

        {/* ── Section 3: Subsystem Status Strip (Reddish Government Theme) ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 3,
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#881337', textTransform: 'uppercase', marginBottom: 8 }}>
            Subsystem SCADA Status at {activePoint.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {/* Node 1 */}
            <div style={{ background: '#f8fafc', border: activePoint.powerKw < 30 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>PRIMARY POWER</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.powerKw < 30 ? '#dc2626' : '#0b3b60', marginTop: 2 }}>
                {activePoint.powerKw < 30 ? 'DG-1 TRIP' : 'DG-1 ONLINE'}
              </div>
            </div>

            {/* Node 2 */}
            <div style={{ background: '#f8fafc', border: activePoint.fuelPressureBar < 1.0 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>FUEL FEEDER</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.fuelPressureBar < 1.0 ? '#dc2626' : '#15803d', marginTop: 2 }}>
                {activePoint.fuelPressureBar < 1.0 ? 'LINE FREEZE' : 'PRESSURIZED'}
              </div>
            </div>

            {/* Node 3 */}
            <div style={{ background: '#f8fafc', border: activePoint.coolantTempC > 95 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>COOLANT LOOP</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.coolantTempC > 95 ? '#dc2626' : '#0b3b60', marginTop: 2 }}>
                {activePoint.coolantTempC > 95 ? `${activePoint.coolantTempC}°C OVERHEAT` : `${activePoint.coolantTempC}°C NORMAL`}
              </div>
            </div>

            {/* Node 4 */}
            <div style={{ background: '#f8fafc', border: activePoint.habitatTempC < 18 ? '1px solid #fed7aa' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>LIVING QUARTERS</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.habitatTempC < 18 ? '#d97706' : '#15803d', marginTop: 2 }}>
                {activePoint.habitatTempC < 18 ? 'HEAT LOSS' : 'COMFORTABLE'}
              </div>
            </div>

            {/* Node 5 */}
            <div style={{ background: '#f8fafc', border: isTrip ? '1px solid #fed7aa' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>ISRO GSAT-30 LINK</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: isTrip ? '#d97706' : '#0b3b60', marginTop: 2 }}>
                {isTrip ? 'EDGE BUFFERING' : 'SYNCHRONIZED'}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
