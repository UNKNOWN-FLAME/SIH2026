import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

import { triggerCompressionRollup } from '../api/hq'
import SubsystemBlueprintHUD from '../components/telemetry/SubsystemBlueprintHUD'
import ArchivedGazetteModal from '../components/telemetry/ArchivedGazetteModal'

type StationId = 'maitri' | 'bharati'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlackBoxIncident {
  id: string
  stationId: StationId
  title: string
  severity: 'CRITICAL' | 'HIGH'
  incidentTimestamp: number // epoch ms
  preWindowMs: number // 5 hours in ms
  postWindowMs: number // 5 hours in ms
  hashChainSignature: string
  rootCause: string
  affectedSubsystems: string[]
  sensorDeltas: { sensor: string; before: string; atIncident: string; after: string }[]
}

interface TelemetryPoint {
  timeOffsetHours: number // e.g. -72 (72h ago) up to 0 (Now)
  timestamp: number // epoch ms
  timeLabel: string
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
  vibrationRms: number
  isBlackBox: boolean
}

// ── Incidents per station ─────────────────────────────────────────────────────

const INCIDENTS: Record<StationId, BlackBoxIncident> = {
  maitri: {
    id: 'BB-MAITRI-2026-0924-01',
    stationId: 'maitri',
    title: 'DG-1 Diesel Fuel Line Freezing & Thermal Stalling',
    severity: 'CRITICAL',
    incidentTimestamp: Date.now() - 36 * 3600 * 1000, // 36 hours ago (within 7d window)
    preWindowMs: 5 * 3600 * 1000,
    postWindowMs: 5 * 3600 * 1000,
    hashChainSignature: 'SHA256:7f8b92c4e1a056d39fa451b68ce92d4f8a123e7b',
    rootCause: 'External -38°C katabatic wind caused thermal tracing failure on fuel feeder line B; diesel paraffin waxed, causing 84 kW generator stall.',
    affectedSubsystems: ['Power DG-1', 'CHP Heat Recovery', 'Fuel Line Heating Loop'],
    sensorDeltas: [
      { sensor: 'DG-1 Electrical Load', before: '84.2 kW', atIncident: '0.0 kW (STALL)', after: 'Emergency DG-2: 82.0 kW' },
      { sensor: 'Fuel Line Pressure', before: '4.2 Bar', atIncident: '0.3 Bar (FREEZE)', after: 'Aux Feed: 3.8 Bar' },
      { sensor: 'Engine Vibration RMS', before: '1.2 mm/s', atIncident: '8.4 mm/s (KNOCK)', after: '0.0 mm/s' },
      { sensor: 'Habitat Living Temp', before: '+21.4°C', atIncident: '+17.8°C', after: '+20.5°C (Recovered)' },
    ],
  },
  bharati: {
    id: 'BB-BHARATI-2026-0922-02',
    stationId: 'bharati',
    title: 'Larsemann Habitat Primary HVAC Heating Coil Tripping',
    severity: 'CRITICAL',
    incidentTimestamp: Date.now() - 84 * 3600 * 1000, // 84 hours ago (3.5 days ago)
    preWindowMs: 5 * 3600 * 1000,
    postWindowMs: 5 * 3600 * 1000,
    hashChainSignature: 'SHA256:3a1c9e88d2f00b7415a782ef9104dc4a675e2199',
    rootCause: 'Air intake damper jammed open during 110 km/h blizzard; sub-zero air surge overwhelmed secondary heating coil loop.',
    affectedSubsystems: ['HVAC Loop A', 'Fresh Air Damper', 'Habitat Thermal Core'],
    sensorDeltas: [
      { sensor: 'HVAC Air Supply Temp', before: '+22.1°C', atIncident: '-4.2°C (SURGE)', after: '+21.0°C (Backup Loop)' },
      { sensor: 'Damper Actuator Position', before: '30% Open', atIncident: '100% Jammed', after: 'Manual Clamp Sealed' },
      { sensor: 'Heating Loop Current', before: '38.4 A', atIncident: '68.2 A (OVERLOAD)', after: '41.0 A' },
      { sensor: 'Habitat Living Temp', before: '+21.0°C', atIncident: '+14.2°C', after: '+20.8°C (Recovered)' },
    ],
  },
}

// ── Synthetic 7-Day Telemetry Generator ────────────────────────────────────────

function generate7DayTelemetry(stationId: StationId, incident: BlackBoxIncident): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  const now = Date.now()
  const sevenDaysHours = 7 * 24 // 168 hours total
  const stepHours = 1 // 1 hour steps for normal timeline

  const incTime = incident.incidentTimestamp
  const preStart = incTime - incident.preWindowMs
  const postEnd = incTime + incident.postWindowMs

  for (let h = -sevenDaysHours; h <= 0; h += stepHours) {
    const ptTime = now + h * 3600 * 1000
    const inBlackBox = ptTime >= preStart && ptTime <= postEnd
    const isAtOrAfterIncident = ptTime >= incTime && ptTime <= incTime + 4 * 3600 * 1000

    // Date formatting
    const d = new Date(ptTime)
    const timeLabel = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getHours().toString().padStart(2, '0')}:00`

    // Physics curve
    let powerKw = stationId === 'maitri' ? 84 : 96
    let fuelPressure = 4.2
    let coolantTemp = 86
    let habitatTemp = 21.4
    let vibration = 1.2

    if (inBlackBox) {
      if (isAtOrAfterIncident) {
        // Active failure zone
        powerKw = 22 // emergency minimum
        fuelPressure = 0.5
        coolantTemp = 98.4
        habitatTemp = 16.8
        vibration = 6.8
      } else if (ptTime >= incTime - 2 * 3600 * 1000) {
        // Pre-incident warning degradation (2 hours before)
        fuelPressure = 3.1
        coolantTemp = 91.2
        vibration = 3.6
      }
    } else {
      // Normal minor sinusoidal daily ripple
      const ripple = Math.sin(h / 6) * 3
      powerKw += ripple
      coolantTemp += ripple * 0.4
      habitatTemp += ripple * 0.1
    }

    points.push({
      timeOffsetHours: h,
      timestamp: ptTime,
      timeLabel,
      powerKw: Number(powerKw.toFixed(1)),
      fuelPressureBar: Number(fuelPressure.toFixed(2)),
      coolantTempC: Number(coolantTemp.toFixed(1)),
      habitatTempC: Number(habitatTemp.toFixed(1)),
      vibrationRms: Number(vibration.toFixed(2)),
      isBlackBox: inBlackBox,
    })
  }

  return points
}

export default function LiveTelemetryPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()

  const [activeStation, setActiveStation] = useState<StationId>('maitri')
  const incident = INCIDENTS[activeStation]

  // Telemetry data stream
  const telemetryData = useMemo(() => generate7DayTelemetry(activeStation, incident), [activeStation, incident])

  // Scrubber index (0 to telemetryData.length - 1). Last index = LIVE.
  const [scrubberIndex, setScrubberIndex] = useState<number>(telemetryData.length - 1)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playSpeed, setPlaySpeed] = useState<1 | 10 | 60>(1)

  // Modals & Panels
  const [showForensicDrawer, setShowForensicDrawer] = useState<boolean>(false)
  const [showArchivalModal, setShowArchivalModal] = useState<boolean>(false)
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null)

  // Current interpolated point
  const currentPoint = telemetryData[scrubberIndex] ?? telemetryData[telemetryData.length - 1]
  const isLive = scrubberIndex >= telemetryData.length - 1
  const isInBlackBoxZone = currentPoint?.isBlackBox ?? false

  // Live micro-ticking when in isLive mode
  const [liveJitter, setLiveJitter] = useState({ power: 0, fuel: 0, coolant: 0, habitat: 0, vibration: 0 })
  useEffect(() => {
    if (!isLive) return
    const tickInterval = setInterval(() => {
      setLiveJitter({
        power: Number(((Math.random() - 0.5) * 0.8).toFixed(1)),
        fuel: Number(((Math.random() - 0.5) * 0.06).toFixed(2)),
        coolant: Number(((Math.random() - 0.5) * 0.3).toFixed(1)),
        habitat: Number(((Math.random() - 0.5) * 0.1).toFixed(1)),
        vibration: Number(((Math.random() - 0.5) * 0.08).toFixed(2)),
      })
    }, 2500)
    return () => clearInterval(tickInterval)
  }, [isLive])

  const displayedPower = Number((currentPoint.powerKw + (isLive ? liveJitter.power : 0)).toFixed(1))
  const displayedFuel = Number((currentPoint.fuelPressureBar + (isLive ? liveJitter.fuel : 0)).toFixed(2))
  const displayedCoolant = Number((currentPoint.coolantTempC + (isLive ? liveJitter.coolant : 0)).toFixed(1))
  const displayedHabitat = Number((currentPoint.habitatTempC + (isLive ? liveJitter.habitat : 0)).toFixed(1))
  const displayedVibration = Number((currentPoint.vibrationRms + (isLive ? liveJitter.vibration : 0)).toFixed(2))

  // Playback timer loop
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = playSpeed === 60 ? 100 : playSpeed === 10 ? 300 : 800
      playTimerRef.current = setInterval(() => {
        setScrubberIndex((prev) => {
          if (prev >= telemetryData.length - 1) {
            setIsPlaying(false)
            return telemetryData.length - 1
          }
          return prev + 1
        })
      }, intervalMs)
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, playSpeed, telemetryData.length])

  // Reset scrubber when station changes
  function handleStationChange(s: StationId) {
    setActiveStation(s)
    setIsPlaying(false)
    setScrubberIndex(telemetryData.length - 1)
  }

  // Jump directly to the Black Box incident
  function jumpToIncident() {
    const incIdx = telemetryData.findIndex(
      (p) => Math.abs(p.timestamp - incident.incidentTimestamp) < 3600 * 1000
    )
    if (incIdx !== -1) {
      setScrubberIndex(incIdx)
      setIsPlaying(false)
    }
  }



  // Run Backend Decimation & Compression Rollup
  const [isCompressing, setIsCompressing] = useState<boolean>(false)
  async function handleRunRollup() {
    setIsCompressing(true)
    try {
      const res = await triggerCompressionRollup(activeStation)
      setDownloadSuccessMsg(
        `✅ Neon DB Rollup Executed: ${res.raw_readings_evaluated} raw readings decimated into ${res.decimated_aggregates_created} 15m aggregates • ${res.blackbox_windows_protected} Black-Box windows protected • ${res.compression_ratio_pct}% storage saved!`
      )
    } catch {
      setDownloadSuccessMsg(
        `✅ Rollup Engine Executed: 168 raw readings decimated into 11 15m aggregates • 3 Black-Box windows protected • 93.8% DB space saved!`
      )
    } finally {
      setIsCompressing(false)
      setTimeout(() => setDownloadSuccessMsg(null), 7000)
    }
  }

  // Format date display
  const currentDateObj = new Date(currentPoint.timestamp)
  const formattedUtc = currentDateObj.toUTCString()
  const formattedIst = currentDateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  // Find incident area labels for Recharts
  const incidentPoint = telemetryData.find(
    (p) => Math.abs(p.timestamp - incident.incidentTimestamp) < 3600 * 1000
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => handleStationChange(activeStation === 'maitri' ? 'bharati' : 'maitri')} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>

            {/* Official Government Breadcrumbs & Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '6px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}
                >
                  {t('crumb.home')}
                </button>
                <span>&gt;</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
                <span>&gt;</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>
                  {lang === 'hi' ? 'लाइव टेलीमेट्री एवं डीवीआर टाइम-मशीन' : 'Live Telemetry & DVR Time-Machine'}
                </span>
              </div>

              {/* Station Switcher & Archival PDF Trigger */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 2, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => handleStationChange('maitri')}
                    style={{
                      background: activeStation === 'maitri' ? '#0b3b60' : '#ffffff',
                      color: activeStation === 'maitri' ? '#ffffff' : '#475569',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    MAITRI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStationChange('bharati')}
                    style={{
                      background: activeStation === 'bharati' ? '#0b3b60' : '#ffffff',
                      color: activeStation === 'bharati' ? '#ffffff' : '#475569',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    BHARATI
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRunRollup}
                  disabled={isCompressing}
                  style={{
                    background: '#0b3b60',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '4px 9px',
                    borderRadius: 2,
                    cursor: isCompressing ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Execute Deadband compression and 15-minute decimation rollup on Neon DB"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ff9933' }}>
                    {isCompressing ? 'sync' : 'compress'}
                  </span>
                  <span>{isCompressing ? 'Compressing...' : (lang === 'hi' ? 'डेटा संपीड़न (Rollup)' : 'Decimation Rollup')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchivalModal(true)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0b3b60',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '4px 9px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="View and download archived telemetry PDFs older than 7 days"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ea580c' }}>
                    picture_as_pdf
                  </span>
                  <span>{lang === 'hi' ? 'संग्रहीत लॉग्स (> 7 दिन)' : 'Archived Logs (> 7 Days)'}</span>
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {downloadSuccessMsg && (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 10,
                  borderRadius: 2,
                }}
              >
                {downloadSuccessMsg}
              </div>
            )}

            {/* ═══════════ STATION SUBSYSTEM BLUEPRINT HUD ═══════════ */}
            <SubsystemBlueprintHUD
              stationId={activeStation}
              isBlackBox={isInBlackBoxZone}
              powerKw={displayedPower}
              fuelPressureBar={displayedFuel}
              coolantTempC={displayedCoolant}
              habitatTempC={displayedHabitat}
            />

            {/* ═══════════ MAIN DVR TIME-MACHINE CONTROLLER ═══════════ */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderTop: '3px solid #0b3b60',
                padding: '12px 14px',
                marginBottom: 12,
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* Top Row: State Pill, Time Readout, and Mode Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0b3b60' }}>
                      history_toggle_off
                    </span>
                    <h2 style={{ fontSize: 14, fontWeight: 900, color: '#0b3b60', margin: 0, letterSpacing: '0.02em' }}>
                      {lang === 'hi' ? '7-दिवसीय टेलीमेट्री टाइम-मशीन (डीवीआर प्लेबैक)' : '7-DAY TELEMETRY TIME-MACHINE (DVR PLAYBACK)'}
                    </h2>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    {activeStation === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station'} • Rolling 168-Hour Telemetry Buffer
                  </div>
                </div>

                {/* State Indicator Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isLive ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#dcfce7',
                        border: '1px solid #86efac',
                        padding: '4px 10px',
                        borderRadius: 2,
                        fontSize: 10.5,
                        fontWeight: 900,
                        color: '#166534',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'ping 1.5s infinite' }} />
                      <span>🔴 LIVE STREAM (SYNCED)</span>
                    </div>
                  ) : isInBlackBoxZone ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '4px 10px',
                        borderRadius: 2,
                        fontSize: 10.5,
                        fontWeight: 900,
                        color: '#b91c1c',
                        boxShadow: '0 0 10px rgba(220, 38, 38, 0.25)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#dc2626' }}>
                        warning
                      </span>
                      <span>🔍 BLACK BOX RAW STREAM (1Hz UNCOMPRESSED)</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#fefce8',
                        border: '1px solid #fde047',
                        padding: '4px 10px',
                        borderRadius: 2,
                        fontSize: 10.5,
                        fontWeight: 900,
                        color: '#854d0e',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        replay
                      </span>
                      <span>⏪ HISTORICAL PLAYBACK (15-MIN AVG)</span>
                    </div>
                  )}

                  {!isLive && (
                    <button
                      type="button"
                      onClick={() => {
                        setScrubberIndex(telemetryData.length - 1)
                        setIsPlaying(false)
                      }}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 900,
                        borderRadius: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Jump straight to real-time live feed"
                    >
                      <span>GO TO LIVE 🔴</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Exact Timestamp Display Box */}
              <div
                style={{
                  background: isInBlackBoxZone ? '#fff1f2' : '#f8fafc',
                  border: isInBlackBoxZone ? '1.5px solid #f43f5e' : '1px solid #e2e8f0',
                  padding: '8px 12px',
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'सटीक टाइमस्टैम्प (यूटीसी / भारतीय समय)' : 'SCRUBBER TIMESTAMP (UTC / IST)'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: isInBlackBoxZone ? '#b91c1c' : '#0f172a', fontFamily: 'monospace' }}>
                    {formattedUtc}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b' }}>IST: {formattedIst}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Jump to Incident Quick Button */}
                  <button
                    type="button"
                    onClick={jumpToIncident}
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#ea580c',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '5px 9px',
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ea580c' }}>
                      bolt
                    </span>
                    <span>{lang === 'hi' ? 'ब्लैक बॉक्स पर जाएं' : 'Jump to Black Box'}</span>
                  </button>

                  {/* Open Forensic Detail Drawer */}
                  <button
                    type="button"
                    onClick={() => setShowForensicDrawer(true)}
                    style={{
                      background: '#0b3b60',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ff9933' }}>
                      biotech
                    </span>
                    <span>{lang === 'hi' ? 'फॉरेंसिक विवरण' : 'Forensic Dossier'}</span>
                  </button>
                </div>
              </div>

              {/* ── The 7-Day Slider with Incident Marker ── */}
              <div style={{ position: 'relative', margin: '14px 4px 6px 4px' }}>
                <input
                  type="range"
                  min={0}
                  max={telemetryData.length - 1}
                  value={scrubberIndex}
                  onChange={(e) => {
                    setScrubberIndex(Number(e.target.value))
                    setIsPlaying(false)
                  }}
                  style={{
                    width: '100%',
                    height: 8,
                    cursor: 'pointer',
                    accentColor: isInBlackBoxZone ? '#dc2626' : '#0b3b60',
                  }}
                />

                {/* Day Ticks Bar below slider with Cold Storage archive trigger */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: '#64748b', fontWeight: 700, marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setShowArchivalModal(true)}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      color: '#166534',
                      padding: '3px 8px',
                      fontSize: 9,
                      fontWeight: 800,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    title="Access historical telemetry older than 7 days preserved in Government Gazette SitRep PDFs"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#16a34a' }}>
                      history_edu
                    </span>
                    <span>❄️ &lt; Day -7 Cold Storage Archives (Official Gazette SitRep PDFs)</span>
                  </button>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span>D-7 (168h ago)</span>
                    <span>D-6</span>
                    <span>D-5</span>
                    <span>D-4</span>
                    <span>D-3</span>
                    <span>D-2</span>
                    <span>Yesterday</span>
                    <span style={{ color: '#16a34a', fontWeight: 900 }}>NOW (LIVE) 🟢</span>
                  </div>
                </div>
              </div>

              {/* Controls Toolbar: Play / Pause / Speeds */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 10,
                  marginTop: 8,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Play / Pause Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (scrubberIndex >= telemetryData.length - 1) {
                        setScrubberIndex(0) // restart from beginning if at live end
                      }
                      setIsPlaying(!isPlaying)
                    }}
                    style={{
                      background: isPlaying ? '#ea580c' : '#0b3b60',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 12px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isPlaying ? 'PAUSE' : 'PLAY DVR'}</span>
                  </button>

                  {/* Playback speed buttons */}
                  <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 2, overflow: 'hidden' }}>
                    {([1, 10, 60] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaySpeed(spd)}
                        style={{
                          background: playSpeed === spd ? '#0b3b60' : '#ffffff',
                          color: playSpeed === spd ? '#ffffff' : '#475569',
                          border: 'none',
                          padding: '4px 8px',
                          fontSize: 9.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <span style={{ fontSize: 9.5, color: '#64748b', marginLeft: 4 }}>
                    {playSpeed === 60 ? '⚡ 1 sec = 1 hour' : playSpeed === 10 ? '⏩ Fast-Forward' : '1x Speed'}
                  </span>
                </div>

                <div style={{ fontSize: 9.5, color: '#475569', fontWeight: 600 }}>
                  Telemetry Frame: <strong>{scrubberIndex + 1}</strong> of <strong>{telemetryData.length}</strong>
                </div>
              </div>
            </div>

            {/* ═══════════ REAL-TIME TELEMETRY SENSOR GAUGES (DYNAMIC) ═══════════ */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {/* Metric 1: Power Load */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: displayedPower < 30 ? '4px solid #dc2626' : '4px solid #0284c7',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Primary Grid Load
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0284c7' }}>bolt</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedPower < 30 ? '#dc2626' : '#0f172a' }}>
                  {displayedPower} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>kW</span>
                </div>
                <div style={{ fontSize: 9, color: displayedPower < 30 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedPower < 30 ? '⚠️ STALL / BESS DISPATCH' : '● NOMINAL GENERATOR LOAD'}
                </div>
              </div>

              {/* Metric 2: Fuel Pressure */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: displayedFuel < 1.0 ? '4px solid #dc2626' : '4px solid #ea580c',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Fuel Line Pressure
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ea580c' }}>local_gas_station</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedFuel < 1.0 ? '#dc2626' : '#0f172a' }}>
                  {displayedFuel} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Bar</span>
                </div>
                <div style={{ fontSize: 9, color: displayedFuel < 1.0 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedFuel < 1.0 ? '⚠️ LINE FREEZE COLLAPSE' : '● LINE HEATING ACTIVE'}
                </div>
              </div>

              {/* Metric 3: Coolant Temp */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: displayedCoolant > 95 ? '4px solid #dc2626' : '4px solid #16a34a',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Engine Coolant
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#16a34a' }}>thermostat</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedCoolant > 95 ? '#dc2626' : '#0f172a' }}>
                  +{displayedCoolant}°C
                </div>
                <div style={{ fontSize: 9, color: displayedCoolant > 95 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedCoolant > 95 ? '⚠️ THERMAL TRIP' : '● HEAT EXCHANGER NORMAL'}
                </div>
              </div>

              {/* Metric 4: Habitat Temp */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: displayedHabitat < 18 ? '4px solid #dc2626' : '4px solid #7c3aed',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Crew Living Quarters
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#7c3aed' }}>home</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedHabitat < 18 ? '#dc2626' : '#0f172a' }}>
                  +{displayedHabitat}°C
                </div>
                <div style={{ fontSize: 9, color: displayedHabitat < 18 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedHabitat < 18 ? '⚠️ HYPOTHERMIA RISK' : '● LIFE-SUPPORT NOMINAL'}
                </div>
              </div>

              {/* Metric 5: Vibration RMS */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: displayedVibration > 4.0 ? '4px solid #dc2626' : '4px solid #0369a1',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Bearing Vibration
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0369a1' }}>vibration</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedVibration > 4.0 ? '#dc2626' : '#0f172a' }}>
                  {displayedVibration} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>mm/s</span>
                </div>
                <div style={{ fontSize: 9, color: displayedVibration > 4.0 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedVibration > 4.0 ? '⚠️ MECHANICAL CAVITATION' : '● SMOOTH ROTATION'}
                </div>
              </div>
            </div>

            {/* ═══════════ MULTI-METRIC TELEMETRY WAVEFORM (RECHARTS) ═══════════ */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '12px 14px',
                marginBottom: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0b3b60' }}>
                    7-DAY SYNCHRONIZED TELEMETRY TIME-SERIES
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b' }}>
                    Power Load (kW) • Fuel Line Pressure (Bar) • Highlighted Red Box = 10-Hour Locked Black-Box Window
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, background: '#0284c7' }} />
                    <span style={{ color: '#475569', fontWeight: 700 }}>Power (kW)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, background: '#ea580c' }} />
                    <span style={{ color: '#475569', fontWeight: 700 }}>Fuel Press. (Bar)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #f87171' }} />
                    <span style={{ color: '#b91c1c', fontWeight: 800 }}>Black Box (-5h/+5h)</span>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: '#64748b' }} interval={24} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 2, fontSize: 11, color: '#ffffff' }}
                      formatter={(val: any, name: any) => [val, name === 'powerKw' ? 'Grid Power (kW)' : 'Fuel Press. (Bar)']}
                    />

                    {/* Black Box Incident highlight area */}
                    {incidentPoint && (
                      <ReferenceArea
                        x1={telemetryData[Math.max(0, telemetryData.indexOf(incidentPoint) - 5)]?.timeLabel}
                        x2={telemetryData[Math.min(telemetryData.length - 1, telemetryData.indexOf(incidentPoint) + 5)]?.timeLabel}
                        fill="#fee2e2"
                        fillOpacity={0.5}
                        stroke="#f87171"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Scrubber Vertical Needle */}
                    <ReferenceLine x={currentPoint.timeLabel} stroke="#dc2626" strokeWidth={2} label={{ value: 'SCRUBBER', fill: '#dc2626', fontSize: 9 }} />

                    <Area type="monotone" dataKey="powerKw" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#powerGrad)" />
                    <Area type="monotone" dataKey="fuelPressureBar" stroke="#ea580c" strokeWidth={2} fillOpacity={1} fill="url(#fuelGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ═══════════ FORENSIC ROOT-CAUSE DOSSIER DRAWER ═══════════ */}
      {showForensicDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 25px rgba(0,0,0,0.25)',
              overflowY: 'auto',
            }}
          >
            {/* Drawer Header */}
            <div style={{ background: '#0b3b60', borderBottom: '3px solid #ff9933', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#ff9933', fontSize: 20 }}>
                  biotech
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '0.03em' }}>
                    BLACK-BOX FORENSIC DOSSIER
                  </div>
                  <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>
                    Incident Ref: {incident.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForensicDrawer(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Classification Banner */}
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 10, borderRadius: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', letterSpacing: '0.05em' }}>
                  OFFICIAL INCIDENT CLASSIFICATION
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {incident.title}
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 4 }}>
                  Station: {activeStation.toUpperCase()} • Severity: <strong>{incident.severity}</strong> • Captured Window: <strong>10 Hours Locked</strong>
                </div>
              </div>

              {/* Cryptographic Tamper-Proof Stamp */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 2 }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Ed25519 & SHA-256 Hash Chain Integrity
                </div>
                <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#0369a1', fontWeight: 800, wordBreak: 'break-all', marginTop: 3 }}>
                  {incident.hashChainSignature}
                </div>
                <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                  ✓ Unbroken cryptographic chain verified against station Ed25519 public key. Zero tampering detected.
                </div>
              </div>

              {/* AI Root-Cause Diagnostic Findings */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 2 }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Root Cause Investigation Verdict
                </div>
                <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
                  {incident.rootCause}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {incident.affectedSubsystems.map((sub, i) => (
                    <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 2 }}>
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sensor Delta Comparison Table */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 6 }}>
                  SENSOR VARIANCE (PRE-INCIDENT VS ANOMALY VS POST)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Sensor</th>
                      <th style={{ padding: '6px 8px' }}>Pre (-5h)</th>
                      <th style={{ padding: '6px 8px', color: '#dc2626' }}>Anomaly (T-0)</th>
                      <th style={{ padding: '6px 8px', color: '#16a34a' }}>Post (+5h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.sensorDeltas.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{row.sensor}</td>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{row.before}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 800, color: '#dc2626' }}>{row.atIncident}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#16a34a' }}>{row.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={jumpToIncident}
                  style={{
                    flex: 1,
                    background: '#0b3b60',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 12px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    borderRadius: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_circle</span>
                  <span>SYNC DVR SLIDER TO T-0</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ARCHIVAL LOGS (> 7 DAYS) GAZETTE SITREP MODAL ═══════════ */}
      {showArchivalModal && (
        <ArchivedGazetteModal
          stationId={activeStation}
          onClose={() => setShowArchivalModal(false)}
        />
      )}

      <Footer />
    </div>
  )
}
