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
import emblemOfIndia from '../assets/emblem_of_india.svg'

type StationId = 'maitri' | 'bharati'

interface IncidentConfig {
  id: string
  stationId: StationId
  stationName: string
  incidentName: string
  incidentDate: string
  hash: string
}

const INCIDENTS: Record<StationId, IncidentConfig> = {
  maitri: {
    id: 'BB-MAITRI-0924',
    stationId: 'maitri',
    stationName: 'Maitri Research Station',
    incidentName: 'Katabatic Blizzard Generator Stall & Power Blackout',
    incidentDate: '24 September 2026 • 02:40 UTC',
    hash: 'SHA256:7f8b92c4...e7b',
  },
  bharati: {
    id: 'BB-BHARATI-0922',
    stationId: 'bharati',
    stationName: 'Bharati Research Station',
    incidentName: 'HVAC Intake Damper Freeze & Habitat Thermal Surge',
    incidentDate: '22 September 2026 • 18:15 UTC',
    hash: 'SHA256:3a1c9e88...199',
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
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0a0f1d',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Bar ── */}
      <header
        style={{
          background: '#070b14',
          borderBottom: '1px solid #1e293b',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Left: Branding & Incident Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 38,
              background: '#ffffff',
              borderRadius: 3,
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img src={emblemOfIndia} alt="India Emblem" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: 2,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              >
                RECORDER REPLAY
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                POLAR STATION BLACK BOX
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>•</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{incident.incidentDate}</span>
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginTop: 2 }}>
              {incident.stationName} — <span style={{ color: '#ef4444' }}>{incident.incidentName}</span>
            </div>
          </div>
        </div>

        {/* Center: Incident Toggle Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', padding: 3, borderRadius: 6, border: '1px solid #1e293b' }}>
          <button
            onClick={() => {
              setStationId('maitri')
              setPlayheadOffset(0.0)
            }}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              background: stationId === 'maitri' ? '#1e293b' : 'transparent',
              color: stationId === 'maitri' ? '#38bdf8' : '#64748b',
              border: 'none',
              borderRadius: 4,
              transition: 'all 0.15s ease',
            }}
          >
            Maitri: DG-1 Blackout
          </button>
          <button
            onClick={() => {
              setStationId('bharati')
              setPlayheadOffset(0.0)
            }}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              background: stationId === 'bharati' ? '#1e293b' : 'transparent',
              color: stationId === 'bharati' ? '#38bdf8' : '#64748b',
              border: 'none',
              borderRadius: 4,
              transition: 'all 0.15s ease',
            }}
          >
            Bharati: HVAC Damper Trip
          </button>
        </div>

        {/* Right: Exit Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
            {incident.hash}
          </span>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1e293b')}
          >
            <span>Exit Replay</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>(ESC)</span>
          </button>
        </div>
      </header>

      {/* ── Main Forensic Deck ── */}
      <main style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1600, width: '100%', margin: '0 auto' }}>
        
        {/* ── Section 1: 10-Hour Incident Timeline Chart ── */}
        <div
          style={{
            background: '#0d1424',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8' }}>
                10-Hour Incident Window (-5h to +5h relative to blackout event)
              </span>
            </div>

            {/* Playhead Time Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>Replay Playhead:</span>
              <span
                style={{
                  background: isTrip ? '#ef4444' : '#0284c7',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontWeight: 900,
                }}
              >
                {activePoint.label}
              </span>
              <span style={{ color: isTrip ? '#f87171' : '#38bdf8', fontWeight: 700 }}>
                {playheadOffset === 0 ? 'BLACKOUT EVENT' : playheadOffset < 0 ? `${Math.abs(playheadOffset)}h Before Blackout` : `${playheadOffset}h After Event`}
              </span>
            </div>
          </div>

          {/* Area Chart */}
          <div style={{ height: 240, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tripGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                  interval={10}
                />
                <YAxis
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                  domain={[0, 105]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TelemetryPoint
                      return (
                        <div
                          style={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: 4,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#ffffff',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#38bdf8' }}>{data.label}</div>
                          <div>Generator Output: <strong>{data.powerKw} kW</strong></div>
                          <div>Fuel Pressure: <strong>{data.fuelPressureBar} Bar</strong></div>
                          <div>Habitat Temp: <strong>{data.habitatTempC} °C</strong></div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                {/* Blackout event onset marker */}
                <ReferenceLine
                  x="T=00:00"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ value: '🚨 BLACKOUT (T=0)', fill: '#ef4444', fontSize: 10.5, position: 'top', fontWeight: 800 }}
                />
                {/* Active Replay Playhead */}
                <ReferenceLine
                  x={activePoint.label}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  label={{ value: '▼ PLAYHEAD', fill: '#38bdf8', fontSize: 9.5, position: 'insideTopRight', fontWeight: 800 }}
                />
                <Area type="monotone" dataKey="powerKw" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#powerGrad)" name="Generator Load (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Playback Toolbar */}
          <div
            style={{
              background: '#080d18',
              border: '1px solid #1e293b',
              borderRadius: 4,
              padding: '8px 14px',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                background: isPlaying ? '#ea580c' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    background: playbackSpeed === speed ? '#38bdf8' : '#1e293b',
                    color: playbackSpeed === speed ? '#0a0f1d' : '#94a3b8',
                    border: 'none',
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
                background: '#450a0a',
                color: '#fca5a5',
                border: '1px solid #dc2626',
                borderRadius: 3,
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🚨 Jump to Blackout (T=0)
            </button>

            {/* Scrub Slider */}
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>-5h</span>
              <input
                type="range"
                min="-5.0"
                max="5.0"
                step="0.1"
                value={playheadOffset}
                onChange={(e) => setPlayheadOffset(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: isTrip ? '#ef4444' : '#38bdf8',
                  cursor: 'pointer',
                  height: 5,
                }}
              />
              <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>+5h</span>
            </div>
          </div>
        </div>

        {/* ── Section 2: Sensor Telemetry Readouts (No Fluff) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {/* Tile 1: Primary Generator */}
          <div
            style={{
              background: '#0d1424',
              border: activePoint.powerKw < 30 ? '1px solid #ef4444' : '1px solid #1e293b',
              borderRadius: 6,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Primary Generator Output</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.powerKw < 30 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.powerKw} kW
            </div>
            <div style={{ fontSize: 10.5, color: activePoint.powerKw < 30 ? '#f87171' : '#22c55e', fontWeight: 700 }}>
              {activePoint.powerKw < 30 ? 'GENERATOR STALL / BLACKOUT' : 'NOMINAL GENERATION (84 kW)'}
            </div>
          </div>

          {/* Tile 2: Fuel Line Pressure */}
          <div
            style={{
              background: '#0d1424',
              border: activePoint.fuelPressureBar < 1.0 ? '1px solid #ef4444' : '1px solid #1e293b',
              borderRadius: 6,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Diesel Fuel Line Pressure</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.fuelPressureBar < 1.0 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.fuelPressureBar} Bar
            </div>
            <div style={{ fontSize: 10.5, color: activePoint.fuelPressureBar < 1.0 ? '#f87171' : '#22c55e', fontWeight: 700 }}>
              {activePoint.fuelPressureBar < 1.0 ? 'LINE FREEZE (0.3 Bar)' : 'NORMAL FLOW (4.2 Bar)'}
            </div>
          </div>

          {/* Tile 3: Engine Vibration Harmonics */}
          <div
            style={{
              background: '#0d1424',
              border: activePoint.vibrationRms > 4.0 ? '1px solid #ef4444' : '1px solid #1e293b',
              borderRadius: 6,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Engine Knock Vibration</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.vibrationRms > 4.0 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.vibrationRms} mm/s
            </div>
            <div style={{ fontSize: 10.5, color: activePoint.vibrationRms > 4.0 ? '#f87171' : '#22c55e', fontWeight: 700 }}>
              {activePoint.vibrationRms > 4.0 ? 'MISFIRE KNOCK (8.4 mm/s)' : 'NOMINAL SMOOTH (1.2 mm/s)'}
            </div>
          </div>

          {/* Tile 4: Habitat Temp */}
          <div
            style={{
              background: '#0d1424',
              border: activePoint.habitatTempC < 18.0 ? '1px solid #f59e0b' : '1px solid #1e293b',
              borderRadius: 6,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Living Quarters Habitat Temp</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.habitatTempC < 18.0 ? '#f59e0b' : '#38bdf8', fontFamily: 'monospace', margin: '4px 0' }}>
              {activePoint.habitatTempC} °C
            </div>
            <div style={{ fontSize: 10.5, color: activePoint.habitatTempC < 18.0 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>
              {activePoint.habitatTempC < 18.0 ? 'HEAT LOSS (+16.8°C)' : 'COMFORT RANGE (+21.4°C)'}
            </div>
          </div>
        </div>

        {/* ── Section 3: Subsystem State Strip (Clean & Compact) ── */}
        <div
          style={{
            background: '#0d1424',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: '12px 18px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
            Subsystem Status at {activePoint.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {/* Node 1 */}
            <div style={{ background: '#070b14', border: '1px solid #1e293b', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>Primary Power</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.powerKw < 30 ? '#ef4444' : '#38bdf8', marginTop: 2 }}>
                {activePoint.powerKw < 30 ? 'DG-1 TRIP' : 'DG-1 ONLINE'}
              </div>
            </div>

            {/* Node 2 */}
            <div style={{ background: '#070b14', border: '1px solid #1e293b', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>Fuel Feeder</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.fuelPressureBar < 1.0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                {activePoint.fuelPressureBar < 1.0 ? 'LINE FREEZE' : 'PRESSURIZED'}
              </div>
            </div>

            {/* Node 3 */}
            <div style={{ background: '#070b14', border: '1px solid #1e293b', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>Coolant Loop</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.coolantTempC > 95 ? '#ef4444' : '#38bdf8', marginTop: 2 }}>
                {activePoint.coolantTempC > 95 ? `${activePoint.coolantTempC}°C OVERHEAT` : `${activePoint.coolantTempC}°C NORMAL`}
              </div>
            </div>

            {/* Node 4 */}
            <div style={{ background: '#070b14', border: '1px solid #1e293b', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>Living Quarters</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.habitatTempC < 18 ? '#f59e0b' : '#22c55e', marginTop: 2 }}>
                {activePoint.habitatTempC < 18 ? 'HEAT LOSS' : 'COMFORTABLE'}
              </div>
            </div>

            {/* Node 5 */}
            <div style={{ background: '#070b14', border: '1px solid #1e293b', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>ISRO GSAT-30</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: isTrip ? '#f59e0b' : '#38bdf8', marginTop: 2 }}>
                {isTrip ? 'OFFLINE (BUFFERING)' : 'SYNCHRONIZED'}
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
