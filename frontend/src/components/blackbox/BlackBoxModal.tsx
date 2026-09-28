import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStation, type StationId } from '../../context/StationContext'
import { useQuery } from '@tanstack/react-query'
import { getBlackBoxIncidents, type BlackBoxIncidentItem } from '../../api/hq'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import emblemOfIndia from '../../assets/emblem_of_india.svg'

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
  label: string
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
  vibrationRms: number
  status: 'PRE_INCIDENT' | 'BLACKOUT_TRIP' | 'RECOVERY'
}

function generate10HourReplay(stationId: StationId, anomalyId?: string): TelemetryPoint[] {
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
      vibrationRms += severity * (anomalyId === 'earthquake' ? 8.5 : 3.2)
      habitatTempC -= severity * (anomalyId === 'blizzard' ? 5.2 : 1.5)
      status = 'PRE_INCIDENT'
    } else if (offset >= 0 && offset <= 1.2) {
      if (anomalyId === 'earthquake') {
        vibrationRms = 14.8
        powerKw = 42.0
        coolantTempC = 89.0
        habitatTempC = 19.5
      } else if (anomalyId === 'blizzard') {
        powerKw = 68.0
        habitatTempC = 4.2
        fuelPressureBar = 2.1
        vibrationRms = 7.4
      } else {
        powerKw = 0.0 // Blackout stall
        fuelPressureBar = 0.3 // Line frozen
        coolantTempC = 99.4
        vibrationRms = 8.4
        habitatTempC = 16.8 // Heat plunge
      }
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

interface BlackBoxModalProps {
  isOpen?: boolean
  onClose?: () => void
  isStandalonePage?: boolean
}

export default function BlackBoxModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
  isStandalonePage = false,
}: BlackBoxModalProps) {
  const {
    stationId,
    setStationId,
    isOnline,
    edgeBufferCount,
    flushEdgeBuffer,
    lastAnomalyResult,
    isBlackBoxOpen,
    closeBlackBox,
  } = useStation()

  const isOpen = propIsOpen !== undefined ? propIsOpen : isBlackBoxOpen
  const handleClose = propOnClose || closeBlackBox

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedCustomIncident, setSelectedCustomIncident] = useState<BlackBoxIncidentItem | null>(null)
  const [selectedMode, setSelectedMode] = useState<'historical' | 'injected' | 'custom'>(() => {
    return lastAnomalyResult ? 'injected' : 'historical'
  })
  const [flushNotice, setFlushNotice] = useState<string | null>(null)
  const [isFlushing, setIsFlushing] = useState<boolean>(false)

  const { data: bbData } = useQuery({
    queryKey: ['blackbox-incidents', stationId],
    queryFn: () => getBlackBoxIncidents(stationId),
    refetchInterval: 3000,
    enabled: isOpen,
  })

  const backendIncidents = bbData?.incidents ?? []

  async function handleFlush() {
    setIsFlushing(true)
    try {
      const res = await flushEdgeBuffer()
      if (res) {
        setFlushNotice(`✅ Flushed & Synchronized ${res.flushed_frames_count} Edge Frames to Cloud DB! VSAT Link Restored.`)
        if (res.incident_id) {
          const match = backendIncidents.find((i) => i.id === res.incident_id)
          if (match) setSelectedCustomIncident(match)
          setSelectedMode('custom')
        }
        setPlayheadOffset(0.0)
      }
    } finally {
      setIsFlushing(false)
    }
  }

  const [playheadOffset, setPlayheadOffset] = useState<number>(0.0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const incident: IncidentConfig = useMemo(() => {
    if (selectedMode === 'custom' && selectedCustomIncident) {
      return {
        id: selectedCustomIncident.id,
        stationId: (selectedCustomIncident.station_id || stationId) as StationId,
        stationName: (selectedCustomIncident.station_id || stationId) === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station',
        incidentName: `${selectedCustomIncident.title} (${selectedCustomIncident.severity})`,
        incidentDate: `${new Date(selectedCustomIncident.incident_timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${new Date(selectedCustomIncident.incident_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} IST • Flushed Edge Incident`,
        sitrepNumber: selectedCustomIncident.sitrep_number,
      }
    }
    if (selectedMode === 'injected' && lastAnomalyResult) {
      return {
        id: lastAnomalyResult.incident_id || 'BB-INJECTED-ANM',
        stationId: (lastAnomalyResult.station_id || stationId) as StationId,
        stationName: (lastAnomalyResult.station_id || stationId) === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station',
        incidentName: `${lastAnomalyResult.anomaly_name} (${lastAnomalyResult.severity})`,
        incidentDate: `${new Date(lastAnomalyResult.injected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${new Date(lastAnomalyResult.injected_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} IST • Live Injected Incident`,
        sitrepNumber: lastAnomalyResult.report_reference,
      }
    }
    return INCIDENTS[stationId]
  }, [selectedMode, selectedCustomIncident, lastAnomalyResult, stationId])

  const telemetryData = useMemo(() => {
    const anomId = selectedMode === 'injected' ? lastAnomalyResult?.anomaly_id : selectedMode === 'custom' ? 'generator_failure' : undefined
    return generate10HourReplay(stationId, anomId)
  }, [stationId, selectedMode, lastAnomalyResult])

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

  // Playback timer
  useEffect(() => {
    if (isPlaying && isOpen) {
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
  }, [isPlaying, playbackSpeed, isOpen])

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && !isStandalonePage) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [isOpen, isStandalonePage])

  if (!isOpen) return null

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? 0 : '16px 20px',
        backgroundColor: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'blackbox-backdrop-fade 0.26s ease-out forwards',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <style>{`
        @keyframes blackbox-backdrop-fade {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(8px);
          }
        }

        @keyframes blackbox-pop-window {
          0% {
            opacity: 0;
            transform: scale(0.90) translateY(36px);
            filter: drop-shadow(0 0 0 rgba(0,0,0,0));
          }
          65% {
            opacity: 1;
            transform: scale(1.008) translateY(-3px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: drop-shadow(0 25px 50px rgba(0,0,0,0.65));
          }
        }

        @keyframes blackbox-rec-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.25;
            transform: scale(0.85);
          }
        }

        .blackbox-custom-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .blackbox-custom-scroll::-webkit-scrollbar-track {
          background: #e2e8f0;
        }
        .blackbox-custom-scroll::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }
        .blackbox-custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>

      {/* ── BIG POP-UP WINDOW CONTAINER ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Polar Black Box Flight Recorder"
        style={{
          width: isFullscreen ? '100vw' : '95vw',
          maxWidth: isFullscreen ? '100vw' : '1540px',
          height: isFullscreen ? '100vh' : '93vh',
          maxHeight: isFullscreen ? '100vh' : '980px',
          borderRadius: isFullscreen ? 0 : 12,
          background: '#f8fafc',
          border: isFullscreen ? 'none' : '1.5px solid #cbd5e1',
          boxShadow: '0 30px 90px -15px rgba(0, 0, 0, 0.85), 0 0 45px rgba(220, 38, 38, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'blackbox-pop-window 0.34s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          transformOrigin: 'center center',
        }}
      >
        {/* ── HIGH-TECH POP-UP TITLEBAR (Aviation & Tactical HUD Theme) ── */}
        <div
          style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            borderBottom: '2px solid #ea580c',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
            userSelect: 'none',
          }}
        >
          {/* Left: Tactical Badge, REC Light, Station Identification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Blinking Flight Recorder Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(234, 88, 12, 0.15)',
                border: '1px solid #ea580c',
                padding: '4px 9px',
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'blackbox-rec-pulse 1.2s infinite ease-in-out',
                }}
              />
              <span
                style={{
                  color: '#fb923c',
                  fontSize: 10,
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                }}
              >
                BLACK BOX RECORDER
              </span>
            </div>

            {/* Emblem and Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={emblemOfIndia}
                alt="Emblem of India"
                style={{ width: 18, height: 26, objectFit: 'contain', filter: 'brightness(1.8)' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 900, letterSpacing: '0.04em' }}>
                    POLAR TELEMETRY FLIGHT DATA RECORDER
                  </span>
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontFamily: 'monospace',
                    }}
                  >
                    10-HR FORENSIC BUFFER
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10.5, marginTop: 1 }}>
                  NCPOR POLAR FLEET • {incident.sitrepNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Station Switcher Buttons directly in Titlebar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 3,
              gap: 4,
            }}
          >
            <button
              onClick={() => {
                setSelectedMode('historical')
                setStationId('maitri')
                setPlayheadOffset(0.0)
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: stationId === 'maitri' && selectedMode === 'historical' ? '#ea580c' : 'transparent',
                color: stationId === 'maitri' && selectedMode === 'historical' ? '#ffffff' : '#cbd5e1',
                transition: 'all 0.15s ease',
              }}
            >
              📍 MAITRI (DG-1)
            </button>
            <button
              onClick={() => {
                setSelectedMode('historical')
                setStationId('bharati')
                setPlayheadOffset(0.0)
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: stationId === 'bharati' && selectedMode === 'historical' ? '#ea580c' : 'transparent',
                color: stationId === 'bharati' && selectedMode === 'historical' ? '#ffffff' : '#cbd5e1',
                transition: 'all 0.15s ease',
              }}
            >
              📍 BHARATI (HVAC)
            </button>
            {lastAnomalyResult && (
              <button
                onClick={() => {
                  setSelectedMode('injected')
                  setPlayheadOffset(0.0)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 10.5,
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedMode === 'injected' ? '#4f46e5' : 'transparent',
                  color: selectedMode === 'injected' ? '#ffffff' : '#a5b4fc',
                  transition: 'all 0.15s ease',
                }}
              >
                🧪 SIMULATION
              </button>
            )}
          </div>

          {/* Right: Window Controls (Fullscreen & Close Button) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Toggle Fullscreen / Normal Big Pop-Up Window */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? 'Restore Window Size' : 'Maximize Window'}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#e2e8f0',
                padding: '5px 9px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isFullscreen ? 'close_fullscreen' : 'open_in_full'}
              </span>
            </button>

            {/* BIG PROMINENT CLOSE BUTTON */}
            <button
              type="button"
              onClick={handleClose}
              title="Close Black Box Window (ESC)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: '1px solid #b91c1c',
                padding: '6px 14px',
                borderRadius: 5,
                fontSize: 11.5,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 900 }}>✕</span>
              <span>CLOSE</span>
              <span style={{ fontSize: 9.5, opacity: 0.85, fontFamily: 'monospace' }}>(ESC)</span>
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE WINDOW BODY ── */}
        <div
          className="blackbox-custom-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 20px 24px 20px',
            background: '#f1f5f9',
          }}
        >
          {/* Link State / Edge Recording Strip */}
          {isOnline ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderLeft: '5px solid #16a34a',
                padding: '8px 14px',
                marginBottom: 12,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🟢</span>
                <div>
                  <strong style={{ color: '#15803d' }}>
                    VSAT LINK NOMINAL — LIVE HQ REPLICATION SYNCHRONIZED
                  </strong>
                  <span style={{ color: '#166534', marginLeft: 8 }}>
                    Non-volatile flight buffer is active and on standby. You are conducting interactive forensic post-mortem analysis.
                  </span>
                </div>
              </div>
              <div
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '3px 8px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
              >
                SHA-256 INTEGRITY: SEALED
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: '5px solid #dc2626',
                padding: '10px 14px',
                marginBottom: 12,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <div>
                  <strong style={{ color: '#b91c1c' }}>
                    VSAT SATELLITE LINK SEVERED — AUTONOMOUS EDGE BLACK BOX ACTIVELY RECORDING
                  </strong>
                  <span style={{ color: '#7f1d1d', marginLeft: 8 }}>
                    Telemetry frames saved in flash buffer ({edgeBufferCount} frames pending sync).
                  </span>
                </div>
              </div>
              <button
                onClick={handleFlush}
                disabled={isFlushing}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 12px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: isFlushing ? 'wait' : 'pointer',
                  borderRadius: 3,
                }}
              >
                {isFlushing ? 'RECONNECTING & FLUSHING...' : `⚡ RESTORE LINK & FLUSH (${edgeBufferCount} FRAMES)`}
              </button>
            </div>
          )}

          {/* Flush Notification */}
          {flushNotice && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderLeft: '5px solid #16a34a',
                padding: '8px 14px',
                marginBottom: 10,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#166534',
              }}
            >
              <span>{flushNotice}</span>
              <button
                onClick={() => setFlushNotice(null)}
                style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── Official Incident Banner ── */}
          <div
            style={{
              background: 'linear-gradient(90deg, #fff5f5 0%, #ffffff 100%)',
              border: '1px solid #fecdd3',
              borderLeft: '4px solid #dc2626',
              borderTop: '2px solid #dc2626',
              borderRadius: 4,
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
            {/* Station & Incident Identification */}
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
                    INVESTIGATION DOSSIER
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
                  Timestamp: <strong style={{ color: '#1e293b' }}>{incident.incidentDate}</strong>
                </div>
              </div>
            </div>

            {/* Incident Mode Selection Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', padding: 4, borderRadius: 4, border: '1px solid #fecaca', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSelectedMode('historical')
                  setStationId('maitri')
                  setPlayheadOffset(0.0)
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: selectedMode === 'historical' && stationId === 'maitri' ? '#b91c1c' : 'transparent',
                  color: selectedMode === 'historical' && stationId === 'maitri' ? '#ffffff' : '#991b1b',
                  border: 'none',
                  borderRadius: 3,
                }}
              >
                📍 Maitri: DG-1 Trip
              </button>
              <button
                onClick={() => {
                  setSelectedMode('historical')
                  setStationId('bharati')
                  setPlayheadOffset(0.0)
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: selectedMode === 'historical' && stationId === 'bharati' ? '#b91c1c' : 'transparent',
                  color: selectedMode === 'historical' && stationId === 'bharati' ? '#ffffff' : '#991b1b',
                  border: 'none',
                  borderRadius: 3,
                }}
              >
                📍 Bharati: HVAC
              </button>

              {lastAnomalyResult && (
                <button
                  onClick={() => {
                    setSelectedMode('injected')
                    setPlayheadOffset(0.0)
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: 10.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                    background: selectedMode === 'injected' ? '#4338ca' : '#e0e7ff',
                    color: selectedMode === 'injected' ? '#ffffff' : '#3730a3',
                    border: '1px solid #c7d2fe',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>🧪 {lastAnomalyResult.anomaly_name}</span>
                  <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: 2 }}>SIM</span>
                </button>
              )}

              {backendIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => {
                    setSelectedCustomIncident(inc)
                    setSelectedMode('custom')
                    setPlayheadOffset(0.0)
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: 10.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                    background: selectedMode === 'custom' && selectedCustomIncident?.id === inc.id ? '#991b1b' : '#fef2f2',
                    color: selectedMode === 'custom' && selectedCustomIncident?.id === inc.id ? '#ffffff' : '#991b1b',
                    border: '1px solid #fecaca',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>📦 {inc.title.length > 20 ? `${inc.title.slice(0, 20)}...` : inc.title}</span>
                  <span style={{ fontSize: 8.5, background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: 2 }}>{inc.severity}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Main Forensic Replay Chart Card ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderTop: '3px solid #b91c1c',
              borderRadius: 6,
              padding: '14px 18px',
              marginBottom: 12,
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            }}
          >
            {/* Header inside Chart Card */}
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

            {/* Interactive Area Chart */}
            <div style={{ height: 260, width: '100%', background: '#fffafa', borderRadius: 4, padding: '6px 10px 0 0', border: '1px solid #f1f5f9' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData} margin={{ top: 32, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerRedGradModal" x1="0" y1="0" x2="0" y2="1">
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
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: '#f87171' }}>{data.label}</div>
                            <div>Generator Output: <strong>{data.powerKw} kW</strong></div>
                            <div>Fuel Line Pressure: <strong>{data.fuelPressureBar} Bar</strong></div>
                            <div>Coolant Temp: <strong>{data.coolantTempC} °C</strong></div>
                            <div>Living Habitat: <strong>{data.habitatTempC} °C</strong></div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <ReferenceLine
                    x="T=00:00"
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{ value: '🚨 BLACKOUT ONSET (T=0)', fill: '#b91c1c', fontSize: 11, position: 'top', fontWeight: 900 }}
                  />
                  <ReferenceLine
                    x={activePoint.label}
                    stroke="#0b3b60"
                    strokeWidth={2}
                    label={{ value: '▼ PLAYHEAD', fill: '#0b3b60', fontSize: 10, position: 'top', fontWeight: 800 }}
                  />
                  <Area type="monotone" dataKey="powerKw" stroke="#dc2626" strokeWidth={2.5} fillOpacity={1} fill="url(#powerRedGradModal)" name="Generator Load (kW)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Playback Toolbar */}
            <div
              style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 4,
                padding: '8px 14px',
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
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

              <button
                onClick={() => setPlayheadOffset(0.0)}
                style={{
                  padding: '4px 10px',
                  background: '#ffffff',
                  color: '#991b1b',
                  border: '1.5px solid #dc2626',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🚨 Jump to Blackout (T=0)
              </button>

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

          {/* ── Sensor Telemetry Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            {/* Tile 1: Primary Generator */}
            <div
              style={{
                background: '#ffffff',
                border: activePoint.powerKw < 30 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                borderTop: activePoint.powerKw < 30 ? '3px solid #dc2626' : '3px solid #0b3b60',
                borderRadius: 4,
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
                borderRadius: 4,
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

            {/* Tile 3: Engine Knock Vibration */}
            <div
              style={{
                background: '#ffffff',
                border: activePoint.vibrationRms > 4.0 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                borderTop: activePoint.vibrationRms > 4.0 ? '3px solid #dc2626' : '3px solid #0b3b60',
                borderRadius: 4,
                padding: '12px 14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Engine Knock Vibration</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: activePoint.vibrationRms > 4.0 ? '#dc2626' : '#0b3b60', fontFamily: 'monospace', margin: '4px 0' }}>
                {activePoint.vibrationRms} mm/s
              </div>
              <div style={{ fontSize: 10, color: activePoint.vibrationRms > 4.0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                {activePoint.vibrationRms > 4.0 ? 'CYLINDER MISFIRE' : 'NOMINAL SMOOTH'}
              </div>
            </div>

            {/* Tile 4: Habitat Temp */}
            <div
              style={{
                background: '#ffffff',
                border: activePoint.habitatTempC < 18.0 ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                borderTop: activePoint.habitatTempC < 18.0 ? '3px solid #ea580c' : '3px solid #0b3b60',
                borderRadius: 4,
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

          {/* ── Subsystem SCADA Status Strip ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              padding: '12px 16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#881337', textTransform: 'uppercase', marginBottom: 8 }}>
              Subsystem SCADA Status at {activePoint.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              <div style={{ background: '#f8fafc', border: activePoint.powerKw < 30 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>PRIMARY POWER</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.powerKw < 30 ? '#dc2626' : '#0b3b60', marginTop: 2 }}>
                  {activePoint.powerKw < 30 ? 'DG-1 TRIP' : 'DG-1 ONLINE'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: activePoint.fuelPressureBar < 1.0 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>FUEL FEEDER</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.fuelPressureBar < 1.0 ? '#dc2626' : '#15803d', marginTop: 2 }}>
                  {activePoint.fuelPressureBar < 1.0 ? 'LINE FREEZE' : 'PRESSURIZED'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: activePoint.coolantTempC > 95 ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>COOLANT LOOP</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.coolantTempC > 95 ? '#dc2626' : '#0b3b60', marginTop: 2 }}>
                  {activePoint.coolantTempC > 95 ? `${activePoint.coolantTempC}°C OVERHEAT` : `${activePoint.coolantTempC}°C NORMAL`}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: activePoint.habitatTempC < 18 ? '1px solid #fed7aa' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>LIVING QUARTERS</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: activePoint.habitatTempC < 18 ? '#d97706' : '#15803d', marginTop: 2 }}>
                  {activePoint.habitatTempC < 18 ? 'HEAT LOSS' : 'COMFORTABLE'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: isTrip ? '1px solid #fed7aa' : '1px solid #cbd5e1', borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>ISRO GSAT-30 LINK</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isTrip ? '#d97706' : '#0b3b60', marginTop: 2 }}>
                  {isTrip ? 'EDGE BUFFERING' : 'SYNCHRONIZED'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
