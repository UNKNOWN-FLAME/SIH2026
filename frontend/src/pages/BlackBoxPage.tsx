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
import SubsystemBlueprintHUD from '../components/telemetry/SubsystemBlueprintHUD'
import ArchivedGazetteModal from '../components/telemetry/ArchivedGazetteModal'
import emblemOfIndia from '../assets/emblem_of_india.svg'

type StationId = 'maitri' | 'bharati'

interface IncidentConfig {
  id: string
  stationId: StationId
  stationName: string
  title: string
  timeString: string
  rootCause: string
  hash: string
  sensorDeltas: {
    sensor: string
    nominal: string
    trip: string
    recovered: string
    unit: string
  }[]
}

const INCIDENTS: Record<StationId, IncidentConfig> = {
  maitri: {
    id: 'BB-MAITRI-2026-0924-01',
    stationId: 'maitri',
    stationName: 'Maitri Research Station',
    title: 'DG-1 Diesel Fuel Line Freezing & Thermal Stalling',
    timeString: '24 Sep 2026 • 02:40 UTC',
    rootCause:
      'Katabatic blizzard (-38.4°C, 108 km/h wind) induced thermal trace heater line B open-circuit. Paraffin wax solidification starved DG-1 injectors, triggering an automatic safety stall.',
    hash: 'SHA256:7f8b92c4e1a056d39fa451b68ce92d4f8a123e7b',
    sensorDeltas: [
      { sensor: 'DG-1 Generator Output', nominal: '84.2 kW', trip: '0.0 kW (STALL)', recovered: '82.0 kW (DG-2)', unit: 'kW' },
      { sensor: 'Fuel Feeder Pressure', nominal: '4.2 Bar', trip: '0.3 Bar (FREEZE)', recovered: '3.9 Bar (Aux Feed)', unit: 'Bar' },
      { sensor: 'Vibration Harmonics', nominal: '1.2 mm/s', trip: '8.4 mm/s (KNOCK)', recovered: '0.0 mm/s', unit: 'mm/s' },
      { sensor: 'Habitat Living Temp', nominal: '+21.4°C', trip: '+16.8°C', recovered: '+20.5°C', unit: '°C' },
    ],
  },
  bharati: {
    id: 'BB-BHARATI-2026-0922-02',
    stationId: 'bharati',
    stationName: 'Bharati Research Station',
    title: 'Larsemann Habitat HVAC Intake Damper Jam & Thermal Surge',
    timeString: '22 Sep 2026 • 18:15 UTC',
    rootCause:
      '115 km/h ice-laden blizzard jammed fresh-air damper 100% open. Sub-zero airflow overwhelmed heating coil loop A, tripping emergency thermal circuit breaker.',
    hash: 'SHA256:3a1c9e88d2f00b7415a782ef9104dc4a675e2199',
    sensorDeltas: [
      { sensor: 'HVAC Air Supply Temp', nominal: '+22.1°C', trip: '-4.2°C (SURGE)', recovered: '+21.0°C (Backup)', unit: '°C' },
      { sensor: 'Heating Loop Current', nominal: '38.4 A', trip: '68.2 A (OVERLOAD)', recovered: '41.0 A', unit: 'A' },
      { sensor: 'Damper Actuator Position', nominal: '30% Open', trip: '100% Jammed', recovered: 'Manual Sealed', unit: '%' },
      { sensor: 'Habitat Living Temp', nominal: '+21.0°C', trip: '+14.2°C', recovered: '+20.8°C', unit: '°C' },
    ],
  },
}

interface TelemetryPoint {
  offsetHours: number // -5.0 to +5.0
  label: string // e.g. "T-02:30"
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
  vibrationRms: number
  phase: 'NOMINAL' | 'DRIFT' | 'TRIP' | 'RECOVERY'
}

function generate10HourWindow(stationId: StationId): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  // Total 10 hours: -5.0 to +5.0 in steps of 0.1 hrs (6 minutes each) -> 101 points
  for (let step = -50; step <= 50; step++) {
    const offset = Math.round(step) / 10
    const absOffset = Math.abs(offset)
    const sign = offset < 0 ? '-' : offset > 0 ? '+' : ' '
    const hours = Math.floor(absOffset)
    const minutes = Math.round((absOffset - hours) * 60)
    const label = `T${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    let powerKw = stationId === 'maitri' ? 84.2 : 96.0
    let fuelPressureBar = 4.2
    let coolantTempC = 86.0
    let habitatTempC = 21.4
    let vibrationRms = 1.2
    let phase: TelemetryPoint['phase'] = 'NOMINAL'

    if (offset < -1.5) {
      // Nominal baseline with tiny ripple
      const ripple = Math.sin(offset * 2) * 0.8
      powerKw += ripple
      coolantTempC += ripple * 0.3
      phase = 'NOMINAL'
    } else if (offset >= -1.5 && offset < 0) {
      // Pre-incident thermal drift (degrading)
      const severity = (offset + 1.5) / 1.5 // 0 -> 1
      powerKw -= severity * 8
      fuelPressureBar -= severity * 1.5
      coolantTempC += severity * 9
      vibrationRms += severity * 2.8
      habitatTempC -= severity * 1.2
      phase = 'DRIFT'
    } else if (offset >= 0 && offset <= 1.2) {
      // Critical trip window
      powerKw = 0.0 // DG-1 stalled
      fuelPressureBar = 0.3 // wax freeze
      coolantTempC = 99.4
      vibrationRms = 8.4 // knock
      habitatTempC = 16.8 // plunge
      phase = 'TRIP'
    } else {
      // Recovery window (emergency DG-2 online)
      const recoveryProgress = Math.min(1, (offset - 1.2) / 1.8) // 0 -> 1
      powerKw = 20 + recoveryProgress * 62.0 // DG-2 ramp up to 82 kW
      fuelPressureBar = 1.5 + recoveryProgress * 2.4 // aux loop to 3.9 Bar
      coolantTempC = 99.4 - recoveryProgress * 12.0 // cooling down
      vibrationRms = Math.max(0.4, 8.4 - recoveryProgress * 8.0)
      habitatTempC = 16.8 + recoveryProgress * 3.7 // restoring to +20.5°C
      phase = 'RECOVERY'
    }

    points.push({
      offsetHours: offset,
      label,
      powerKw: Number(powerKw.toFixed(1)),
      fuelPressureBar: Number(fuelPressureBar.toFixed(2)),
      coolantTempC: Number(coolantTempC.toFixed(1)),
      habitatTempC: Number(habitatTempC.toFixed(1)),
      vibrationRms: Number(vibrationRms.toFixed(2)),
      phase,
    })
  }

  return points
}

export default function BlackBoxPage() {
  const navigate = useNavigate()
  const [stationId, setStationId] = useState<StationId>('maitri')
  const [currentOffset, setCurrentOffset] = useState<number>(0.0) // default to T=0 (Trip Point)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [showGazetteModal, setShowGazetteModal] = useState<boolean>(false)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const incident = INCIDENTS[stationId]
  const telemetryData = useMemo(() => generate10HourWindow(stationId), [stationId])

  // Find the exact closest point to the current scrubber offset
  const currentPoint = useMemo(() => {
    let closest = telemetryData[0]
    let minDiff = 999
    for (const pt of telemetryData) {
      const diff = Math.abs(pt.offsetHours - currentOffset)
      if (diff < minDiff) {
        minDiff = diff
        closest = pt
      }
    }
    return closest
  }, [telemetryData, currentOffset])

  const isTripZone = currentOffset >= -0.2 && currentOffset <= 1.4

  // Handle Play/Pause timer loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentOffset((prev) => {
          const next = Number((prev + 0.1 * playbackSpeed).toFixed(1))
          if (next > 5.0) {
            setIsPlaying(false)
            return 5.0
          }
          return next
        })
      }, 250)
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, playbackSpeed])

  // Keyboard shortcut: ESC to exit full screen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  function handleDownloadJson() {
    const exportPayload = {
      recorderType: 'NCPOR-POLAR-CSMU-BLACKBOX-V3',
      incidentRecord: incident,
      samplingRate: '1Hz Raw Uncompressed Physics Array',
      retentionPolicy: 'EXEMPT_FROM_NEON_ROLLUP_DECIMATION',
      forensicWindowHours: 10,
      cryptographicHash: incident.hash,
      telemetryFrames: telemetryData,
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${incident.id}-1Hz-FORENSIC-BLACKBOX.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#040711',
        color: '#f8fafc',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* ── Top Aerospace Flight Deck Header ── */}
      <header
        style={{
          background: 'linear-gradient(180deg, #091322 0%, #060c16 100%)',
          borderBottom: '1.5px solid #ef4444',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(239, 68, 68, 0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Official Emblem & Black Box Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 44,
              background: '#ffffff',
              borderRadius: 4,
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #cbd5e1',
              flexShrink: 0,
            }}
          >
            <img src={emblemOfIndia} alt="Emblem of India" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: 10.5,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  fontFamily: 'monospace',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffffff',
                    display: 'inline-block',
                    animation: 'pulse 1.4s infinite',
                  }}
                />
                CSMU CRASH RECORDER
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.05em' }}>
                POLAR STATION BLACK BOX
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>National Centre for Polar and Ocean Research (NCPOR)</span>
              <span>•</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>10-Hour High-Density Incident Window [-5h to +5h]</span>
            </div>
          </div>
        </div>

        {/* Center: Station Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              setStationId('maitri')
              setCurrentOffset(0.0)
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              background: stationId === 'maitri' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(15, 23, 42, 0.6)',
              border: stationId === 'maitri' ? '1.5px solid #ef4444' : '1px solid #1e293b',
              color: stationId === 'maitri' ? '#fca5a5' : '#94a3b8',
            }}
          >
            <span>📍 MAITRI (DG-1 Thermal Freeze)</span>
          </button>

          <button
            onClick={() => {
              setStationId('bharati')
              setCurrentOffset(0.0)
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              background: stationId === 'bharati' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(15, 23, 42, 0.6)',
              border: stationId === 'bharati' ? '1.5px solid #ef4444' : '1px solid #1e293b',
              color: stationId === 'bharati' ? '#fca5a5' : '#94a3b8',
            }}
          >
            <span>📍 BHARATI (HVAC Damper Surge)</span>
          </button>
        </div>

        {/* Right: Cryptographic Seal & Exit Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #334155',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 10.5,
              fontFamily: 'monospace',
              color: '#38bdf8',
            }}
          >
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Tamper-Evident Hash Chain</div>
            <div style={{ fontWeight: 700 }}>{incident.hash.slice(0, 24)}... (VERIFIED)</div>
          </div>

          <button
            onClick={() => navigate(-1)}
            title="Press ESC to close"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#dc2626',
              color: '#ffffff',
              border: '1px solid #ef4444',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            <span>CLOSE (ESC)</span>
          </button>
        </div>
      </header>

      {/* ── Main Cockpit Body ── */}
      <main style={{ flex: 1, padding: '16px 22px 30px 22px', maxWidth: 1600, width: '100%', margin: '0 auto' }}>
        {/* Incident Summary Banner */}
        <div
          style={{
            background: isTripZone
              ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.85) 100%)'
              : 'linear-gradient(90deg, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: isTripZone ? '1.5px solid #ef4444' : '1px solid #1e3a5f',
            borderRadius: 6,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontWeight: 900,
                  background: isTripZone ? '#ef4444' : '#0369a1',
                  color: '#ffffff',
                }}
              >
                INCIDENT ID: {incident.id}
              </span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>{incident.title}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>• {incident.timeString}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#cbd5e1', marginTop: 4, maxWidth: 980, lineHeight: 1.4 }}>
              <strong>Root Cause:</strong> {incident.rootCause}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowGazetteModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                background: '#0f294a',
                border: '1px solid #0284c7',
                borderRadius: 4,
                color: '#38bdf8',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
              <span>Statutory Gazette SitRep</span>
            </button>

            <button
              onClick={handleDownloadJson}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 4,
                color: '#f8fafc',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              <span>Export Raw 1Hz JSON</span>
            </button>
          </div>
        </div>

        {/* ── Centerpiece: Zoomed 10-Hour High Density Incident Graph ── */}
        <div
          style={{
            background: '#09111e',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: '16px 20px',
            marginBottom: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 20 }}>timeline</span>
              <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Zoomed 10-Hour Forensic Telemetry Array (T-5.0h to T+5.0h)
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  border: '1px solid #ef4444',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                }}
              >
                100% UNCOMPRESSED PHYSICS
              </span>
            </div>

            {/* Current Scrubbed Value Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                <span style={{ color: '#94a3b8' }}>Scrubbed Point: </span>
                <span
                  style={{
                    color: isTripZone ? '#ef4444' : '#38bdf8',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  {currentPoint.label}
                </span>
                <span style={{ color: '#64748b', marginLeft: 6 }}>
                  ({currentOffset < 0 ? `${Math.abs(currentOffset)}h Before Incident` : currentOffset === 0 ? 'TRIP ONSET' : `${currentOffset}h After Recovery`})
                </span>
              </div>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="vibeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  interval={10}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  domain={[0, 110]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TelemetryPoint
                      return (
                        <div
                          style={{
                            background: '#091322',
                            border: '1px solid #38bdf8',
                            borderRadius: 4,
                            padding: '8px 12px',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#ffffff',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#38bdf8' }}>{data.label}</div>
                          <div>Power Output: <strong>{data.powerKw} kW</strong></div>
                          <div>Fuel Pressure: <strong>{data.fuelPressureBar} Bar</strong></div>
                          <div>Coolant Temp: <strong>{data.coolantTempC} °C</strong></div>
                          <div>Vibration: <strong>{data.vibrationRms} mm/s</strong></div>
                          <div>Habitat Temp: <strong>{data.habitatTempC} °C</strong></div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                {/* Trip Reference Line at T=0 */}
                <ReferenceLine x="T 00:00" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label={{ value: '🚨 TRIP (T=0)', fill: '#ef4444', fontSize: 11, position: 'top', fontWeight: 900 }} />
                {/* Current scrubber position */}
                <ReferenceLine x={currentPoint.label} stroke="#facc15" strokeWidth={2.5} label={{ value: '● CURRENT', fill: '#facc15', fontSize: 10, position: 'insideTopLeft' }} />
                <Area type="monotone" dataKey="powerKw" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#powerGrad)" name="Generator Load (kW)" />
                <Area type="monotone" dataKey="vibrationRms" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#vibeGrad)" name="Vibration (mm/s)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 3 Chronological Phase Labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
            <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0284c7', borderRadius: 4, padding: '6px 10px', fontSize: 10.5 }}>
              <div style={{ color: '#38bdf8', fontWeight: 800 }}>PHASE 1: PRE-INCIDENT DRIFT [T-5.0h to T-1.5h]</div>
              <div style={{ color: '#94a3b8', fontSize: 9.5 }}>Blizzard drop to -38°C; fuel heater tape load degrades.</div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 4, padding: '6px 10px', fontSize: 10.5 }}>
              <div style={{ color: '#f87171', fontWeight: 800 }}>PHASE 2: CRITICAL TRIP & STALL [T-0.5h to T+1.2h]</div>
              <div style={{ color: '#fca5a5', fontSize: 9.5 }}>Paraffin fuel freezing; DG-1 generator stall (84 kW → 0 kW).</div>
            </div>

            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #16a34a', borderRadius: 4, padding: '6px 10px', fontSize: 10.5 }}>
              <div style={{ color: '#4ade80', fontWeight: 800 }}>PHASE 3: FAILOVER RECOVERY [T+1.2h to T+5.0h]</div>
              <div style={{ color: '#86efac', fontSize: 9.5 }}>Aux loop engaged, DG-2 online, habitat stabilized.</div>
            </div>
          </div>

          {/* ── Interactive Playback & Scrubber Controls ── */}
          <div
            style={{
              background: '#040914',
              border: '1px solid #1e293b',
              borderRadius: 6,
              padding: '10px 14px',
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
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
                padding: '6px 16px',
                background: isPlaying ? '#ea580c' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'PAUSE' : 'PLAY REPLAY'}</span>
            </button>

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[0.5, 1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 3,
                    fontSize: 10.5,
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    background: playbackSpeed === speed ? '#38bdf8' : '#0f172a',
                    color: playbackSpeed === speed ? '#040914' : '#94a3b8',
                    border: '1px solid #334155',
                    cursor: 'pointer',
                  }}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Quick Jumps */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setCurrentOffset(-5.0)}
                style={{
                  padding: '4px 8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: 3,
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                ⏪ T-5h (Start)
              </button>

              <button
                onClick={() => setCurrentOffset(0.0)}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1.5px solid #ef4444',
                  color: '#f87171',
                  borderRadius: 3,
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🚨 Jump to Trip (T=0)
              </button>

              <button
                onClick={() => setCurrentOffset(5.0)}
                style={{
                  padding: '4px 8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: 3,
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                ⏩ T+5h (End)
              </button>
            </div>

            {/* Scrubber Range Slider */}
            <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>-5.0h</span>
              <input
                type="range"
                min="-5.0"
                max="5.0"
                step="0.1"
                value={currentOffset}
                onChange={(e) => setCurrentOffset(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: isTripZone ? '#ef4444' : '#38bdf8',
                  cursor: 'pointer',
                  height: 6,
                }}
              />
              <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>+5.0h</span>
            </div>
          </div>
        </div>

        {/* ── Subsystem Blueprint HUD & Sensor Delta Matrix Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 16 }}>
          {/* Left: Synchronized Subsystem Blueprint */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Synchronized Subsystem Polar SCADA Blueprint
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: 'monospace',
                  color: isTripZone ? '#ef4444' : '#38bdf8',
                  fontWeight: 800,
                }}
              >
                STATUS: {currentPoint.phase}
              </div>
            </div>

            <SubsystemBlueprintHUD
              stationId={stationId}
              isBlackBox={isTripZone}
              powerKw={currentPoint.powerKw}
              fuelPressureBar={currentPoint.fuelPressureBar}
              coolantTempC={currentPoint.coolantTempC}
              habitatTempC={currentPoint.habitatTempC}
            />
          </div>

          {/* Right: Live Forensic Delta Comparison Matrix */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Forensic Sensor Matrix (Instantaneous Telemetry at {currentPoint.label})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Card 1: Generator Output */}
              <div
                style={{
                  background: '#09111e',
                  border: currentPoint.powerKw < 30 ? '1.5px solid #ef4444' : '1px solid #1e293b',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Primary Electrical Output</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: currentPoint.powerKw < 30 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace' }}>
                    {currentPoint.powerKw} kW
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10.5 }}>
                  <div style={{ color: '#64748b' }}>Nominal Baseline: 84.2 kW</div>
                  <div style={{ color: currentPoint.powerKw < 30 ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
                    {currentPoint.powerKw < 30 ? 'CRITICAL GENERATOR TRIP' : 'NOMINAL GENERATION'}
                  </div>
                </div>
              </div>

              {/* Card 2: Fuel Line Pressure */}
              <div
                style={{
                  background: '#09111e',
                  border: currentPoint.fuelPressureBar < 1.0 ? '1.5px solid #ef4444' : '1px solid #1e293b',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Fuel Feeder Pressure</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: currentPoint.fuelPressureBar < 1.0 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace' }}>
                    {currentPoint.fuelPressureBar} Bar
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10.5 }}>
                  <div style={{ color: '#64748b' }}>Nominal Baseline: 4.20 Bar</div>
                  <div style={{ color: currentPoint.fuelPressureBar < 1.0 ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
                    {currentPoint.fuelPressureBar < 1.0 ? 'PARAFFIN WAX FREEZING' : 'PRESSURIZED FLOW'}
                  </div>
                </div>
              </div>

              {/* Card 3: Vibration Harmonics */}
              <div
                style={{
                  background: '#09111e',
                  border: currentPoint.vibrationRms > 4.0 ? '1.5px solid #ef4444' : '1px solid #1e293b',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Engine Knock Vibration RMS</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: currentPoint.vibrationRms > 4.0 ? '#ef4444' : '#38bdf8', fontFamily: 'monospace' }}>
                    {currentPoint.vibrationRms} mm/s
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10.5 }}>
                  <div style={{ color: '#64748b' }}>Nominal Baseline: 1.20 mm/s</div>
                  <div style={{ color: currentPoint.vibrationRms > 4.0 ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
                    {currentPoint.vibrationRms > 4.0 ? 'CYLINDER MISFIRE KNOCK' : 'SMOOTH BEARING ROTATION'}
                  </div>
                </div>
              </div>

              {/* Card 4: Living Quarters Habitat Temp */}
              <div
                style={{
                  background: '#09111e',
                  border: currentPoint.habitatTempC < 18.0 ? '1.5px solid #f59e0b' : '1px solid #1e293b',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Living Quarters Habitat Temp</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: currentPoint.habitatTempC < 18.0 ? '#f59e0b' : '#38bdf8', fontFamily: 'monospace' }}>
                    {currentPoint.habitatTempC} °C
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10.5 }}>
                  <div style={{ color: '#64748b' }}>Thermal Target: +21.0°C</div>
                  <div style={{ color: currentPoint.habitatTempC < 18.0 ? '#f59e0b' : '#22c55e', fontWeight: 800 }}>
                    {currentPoint.habitatTempC < 18.0 ? 'HABITAT HEAT LOSS WARN' : 'STABILIZED CLIMATE'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Official Gazette PDF Modal */}
      {showGazetteModal && (
        <ArchivedGazetteModal
          stationId={stationId}
          onClose={() => setShowGazetteModal(false)}
        />
      )}
    </div>
  )
}
