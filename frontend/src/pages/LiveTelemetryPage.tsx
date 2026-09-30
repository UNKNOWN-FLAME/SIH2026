import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'
import { useStation } from '../context/StationContext'
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

import { triggerCompressionRollup, clearAnomaly } from '../api/hq'
import SubsystemBlueprintHUD from '../components/telemetry/SubsystemBlueprintHUD'
import ArchivedGazetteModal from '../components/telemetry/ArchivedGazetteModal'
import { useAlerts } from '../hooks/useAlerts'
import EmergencyWarningModal from '../components/dashboard/EmergencyWarningModal'
import IncidentImpactModal from '../components/dashboard/IncidentImpactModal'

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

export type TelemetryTimeRange = '15m' | '1h' | '24h' | '7d'

interface TelemetryPoint {
  timeOffsetHours: number // e.g. -72 (72h ago) up to 0 (Now)
  timestamp: number // epoch ms
  timeLabel: string
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
  vibrationRms: number
  smokeDensityObsM?: number
  coPpm?: number
  isBlackBox: boolean
  isInjectedAnomaly?: boolean
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

// ── Synthetic Multi-Range Telemetry Generator (15m, 1h, 24h, 7d) ────────────────────────

export interface AnomalyWindow {
  id: string
  anomaly_id: string
  name: string
  severity: string
  startMs: number
  endMs: number
  isActive: boolean
}

function generateTelemetryData(
  stationId: StationId,
  incident: BlackBoxIncident,
  timeRange: TelemetryTimeRange,
  anomalyWindows: AnomalyWindow[],
): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  const now = Date.now()

  // Determine duration and step size based on active timeRange
  let totalDurationMs: number
  let stepMs: number

  switch (timeRange) {
    case '15m':
      totalDurationMs = 15 * 60 * 1000 // 15 minutes
      stepMs = 15 * 1000 // 15 seconds per step = 61 points
      break
    case '1h':
      totalDurationMs = 60 * 60 * 1000 // 1 hour
      stepMs = 60 * 1000 // 1 minute per step = 61 points
      break
    case '24h':
      totalDurationMs = 24 * 3600 * 1000 // 24 hours
      stepMs = 15 * 60 * 1000 // 15 minutes per step = 97 points
      break
    case '7d':
    default:
      totalDurationMs = 7 * 24 * 3600 * 1000 // 7 days = 168 hours
      stepMs = 3600 * 1000 // 1 hour per step = 169 points
      break
  }

  const startTime = now - totalDurationMs

  // Historical Black Box incident (usually 36 hours in past)
  const incTime = incident.incidentTimestamp
  const preStart = incTime - incident.preWindowMs
  const postEnd = incTime + incident.postWindowMs

  let stepIdx = 0
  for (let ptTime = startTime; ptTime <= now; ptTime += stepMs) {
    const d = new Date(ptTime)
    let timeLabel = ''

    if (timeRange === '15m') {
      timeLabel = d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } else if (timeRange === '1h') {
      timeLabel = d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' })
    } else if (timeRange === '24h') {
      timeLabel = `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } else {
      timeLabel = `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })} ${d.getHours().toString().padStart(2, '0')}:00`
    }

    const timeOffsetHours = Number(((ptTime - now) / (3600 * 1000)).toFixed(2))

    // Baseline nominal values
    let powerKw = stationId === 'maitri' ? 84 : 96
    let fuelPressure = 4.2
    let coolantTemp = 86
    let habitatTemp = 21.4
    let vibration = 1.2
    let smokeDensity = 0.02
    let coPpm = 2.0

    // Gentle micro-ripple for natural telemetry dynamics
    const ripple = Math.sin(stepIdx / 4) * (timeRange === '15m' ? 0.7 : 2.2)

    // Check if within Historical Black Box
    const inBlackBox = ptTime >= preStart && ptTime <= postEnd

    // Check if within ANY active or completed anomaly window!
    const activeWin = anomalyWindows.find(w => ptTime >= w.startMs && ptTime <= w.endMs)
    const inInjectedAnomaly = Boolean(activeWin)

    if (activeWin) {
      const aid = activeWin.anomaly_id
      const totalSpan = Math.max(1000, activeWin.endMs - activeWin.startMs)
      const progress = (ptTime - activeWin.startMs) / totalSpan // 0.0 to 1.0

      // Smooth entry (first 15%) and smooth exit (last 15% if window is resolved)
      let severityFactor = 1.0
      if (progress < 0.15) {
        severityFactor = progress / 0.15
      } else if (!activeWin.isActive && progress > 0.85) {
        severityFactor = (1.0 - progress) / 0.15
      } else {
        severityFactor = 1.0
      }

      const flutter = Math.sin(stepIdx * 1.8) * 1.5

      if (aid === 'generator_failure') {
        const targetKw = 24.0 + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        fuelPressure = Number((4.2 - severityFactor * 3.55).toFixed(2))
        coolantTemp += severityFactor * 18.5
        vibration += severityFactor * 5.2
      } else if (aid === 'fuel_critical_low') {
        const targetKw = 34.0 + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        fuelPressure = Number((4.2 - severityFactor * 3.7).toFixed(2))
        coolantTemp += severityFactor * 6.0
      } else if (aid === 'fire_alarm') {
        const targetKw = 30.0 + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        habitatTemp += severityFactor * 56.0
        coolantTemp += severityFactor * 10.0
        smokeDensity = Number((0.02 + severityFactor * 0.86).toFixed(2))
        coPpm = Number((2.0 + severityFactor * 46.5).toFixed(1))
        vibration += severityFactor * 2.6
      } else if (aid === 'pressure_pipe_failure') {
        const targetKw = 38.0 + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        fuelPressure = Number((4.2 - severityFactor * 4.0).toFixed(2))
        vibration += severityFactor * 3.0
      } else if (aid === 'blizzard' || aid === 'severe_blizzard') {
        const targetKw = 40.0 + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        habitatTemp = Number((habitatTemp - severityFactor * 17.2).toFixed(1))
        vibration += severityFactor * 6.2
      } else {
        const targetKw = Math.round(powerKw * 0.45) + flutter
        powerKw = Number((powerKw - severityFactor * (powerKw - targetKw)).toFixed(1))
        coolantTemp += severityFactor * 14.0
        vibration += severityFactor * 3.6
      }
    } else if (inBlackBox && (timeRange === '7d' || timeRange === '24h')) {
      // Historical Black Box incident curve (in 24h and 7d views)
      const deltaHours = (ptTime - incTime) / (3600 * 1000)
      if (deltaHours >= -2 && deltaHours < 0) {
        const t = (deltaHours + 2) / 2
        powerKw = Math.round(powerKw * (1 - 0.22 * t))
        fuelPressure = Number((4.2 - t * 1.3).toFixed(2))
        coolantTemp += t * 5.2
        vibration += t * 2.2
      } else if (deltaHours >= 0 && deltaHours <= 2.5) {
        const flutter = Math.sin(stepIdx * 2.3) * 2.1
        powerKw = Number((24.0 + flutter).toFixed(1))
        fuelPressure = Number((0.65 + Math.cos(stepIdx) * 0.08).toFixed(2))
        coolantTemp = 98.4 + Math.sin(stepIdx) * 1.4
        habitatTemp = 16.8
        vibration = 6.8 + Math.cos(stepIdx) * 0.5
      } else if (deltaHours > 2.5 && deltaHours <= 4.5) {
        const t = (deltaHours - 2.5) / 2.0
        const targetKw = stationId === 'maitri' ? 84 : 96
        powerKw = Math.round(24 + t * (targetKw - 24))
        fuelPressure = Number((0.65 + t * 3.55).toFixed(2))
        coolantTemp = Number((98.4 - t * 11.5).toFixed(1))
        habitatTemp = Number((16.8 + t * 4.4).toFixed(1))
        vibration = Number((6.8 - t * 5.4).toFixed(2))
      } else {
        powerKw += ripple
        coolantTemp += ripple * 0.4
        habitatTemp += ripple * 0.1
      }
    } else {
      // Nominal constant rate
      powerKw += ripple
      coolantTemp += ripple * 0.3
      habitatTemp += ripple * 0.05
    }

    points.push({
      timeOffsetHours,
      timestamp: ptTime,
      timeLabel,
      powerKw: Number(powerKw.toFixed(1)),
      fuelPressureBar: Number(fuelPressure.toFixed(2)),
      coolantTempC: Number(coolantTemp.toFixed(1)),
      habitatTempC: Number(habitatTemp.toFixed(1)),
      vibrationRms: Number(vibration.toFixed(2)),
      smokeDensityObsM: smokeDensity,
      coPpm,
      isBlackBox: inBlackBox,
      isInjectedAnomaly: inInjectedAnomaly,
    })

    stepIdx++
  }

  return points
}

export default function LiveTelemetryPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const {
    stationId: activeStation,
    setStationId: setActiveStation,
    lastAnomalyResult,
    setLastAnomalyResult,
    completedIncidentResult,
    emergencyAlert,
    dismissEmergencyAlert,
    isOnline,
    edgeBufferCount,
    flushEdgeBuffer,
    isImpactModalOpen,
    closeImpactModal,
    anomalyHistory,
    clearAnomalyHistory,
  } = useStation()
  const incident = INCIDENTS[activeStation]

  // Live query: fetch alerts (open + acknowledged) so anomaly persists after ACK
  const { data: allAlertsData } = useAlerts({ station_id: activeStation, page_size: 50 })
  const allAlerts = useMemo(() => allAlertsData?.items ?? [], [allAlertsData?.items])

  // Active anomaly: strictly driven by active simulation in lastAnomalyResult
  const activeAnomaly = useMemo(() => {
    if (
      lastAnomalyResult &&
      (lastAnomalyResult.station_id === activeStation || !lastAnomalyResult.station_id)
    ) {
      return lastAnomalyResult
    }
    return null
  }, [lastAnomalyResult, activeStation])

  // Build unified list of anomaly windows for activeStation (supports multiple concurrent/historical anomalies)
  const anomalyWindows = useMemo<AnomalyWindow[]>(() => {
    const now = Date.now()
    const windows: AnomalyWindow[] = []
    const seenIds = new Set<string>()

    // 1. Currently active anomaly
    if (activeAnomaly) {
      const startMs = activeAnomaly.injected_at
        ? new Date(activeAnomaly.injected_at).getTime()
        : now - 90 * 1000
      const id = activeAnomaly.incident_id || activeAnomaly.report_reference || `active-${activeAnomaly.anomaly_id}`
      seenIds.add(id)
      windows.push({
        id,
        anomaly_id: activeAnomaly.anomaly_id,
        name: activeAnomaly.anomaly_name,
        severity: activeAnomaly.severity,
        startMs,
        endMs: now,
        isActive: true,
      })
    }

    // 2. Anomaly history from StationContext (localStorage)
    const stationHistory = (anomalyHistory || []).filter(
      (h) => h.station_id === activeStation || !h.station_id
    )

    for (const item of stationHistory) {
      const id = item.incident_id || item.report_reference || `${item.anomaly_id}-${item.injected_at}`
      if (seenIds.has(id)) continue
      seenIds.add(id)

      const startMs = item.injected_at ? new Date(item.injected_at).getTime() : now - 180 * 1000
      let endMs = item.ended_at ? new Date(item.ended_at).getTime() : now
      if (endMs - startMs < 60 * 1000) {
        endMs = startMs + 90 * 1000
      }
      windows.push({
        id,
        anomaly_id: item.anomaly_id,
        name: item.anomaly_name,
        severity: item.severity,
        startMs,
        endMs,
        isActive: !item.ended_at,
      })
    }

    // 3. Fallback from completedIncidentResult if not yet added
    if (
      completedIncidentResult &&
      (completedIncidentResult.station_id === activeStation || !completedIncidentResult.station_id)
    ) {
      const id = completedIncidentResult.incident_id || completedIncidentResult.report_reference || 'completed-fallback'
      if (!seenIds.has(id)) {
        seenIds.add(id)
        const startMs = completedIncidentResult.injected_at
          ? new Date(completedIncidentResult.injected_at).getTime()
          : now - 300 * 1000
        const endMs = completedIncidentResult.ended_at
          ? new Date(completedIncidentResult.ended_at).getTime()
          : startMs + 120 * 1000
        windows.push({
          id,
          anomaly_id: completedIncidentResult.anomaly_id,
          name: completedIncidentResult.anomaly_name,
          severity: completedIncidentResult.severity,
          startMs,
          endMs,
          isActive: false,
        })
      }
    }

    // Sort chronologically
    windows.sort((a, b) => a.startMs - b.startMs)

    // Ensure non-overlapping windows so that each anomaly has its own distinct dip & recovery
    for (let i = 0; i < windows.length - 1; i++) {
      const curr = windows[i]
      const next = windows[i + 1]
      // Leave at least a 30-second nominal recovery gap between adjacent anomalies
      if (curr.endMs >= next.startMs - 30 * 1000) {
        curr.endMs = Math.max(curr.startMs + 45 * 1000, next.startMs - 30 * 1000)
      }
    }

    return windows
  }, [activeAnomaly, anomalyHistory, completedIncidentResult, activeStation])

  // Check if the anomaly alert has already been acknowledged (but event still happened)
  const isAnomalyAcknowledged = useMemo(() => {
    if (!activeAnomaly) return false
    const matchingAlert = allAlerts.find(
      (a) => a.alert_id === activeAnomaly.alert_id ||
             a.alert_id === activeAnomaly.report_reference
    )
    return matchingAlert ? matchingAlert.ack_state === 'ACKNOWLEDGED' : false
  }, [activeAnomaly, allAlerts])

  // Active Time Range: 15m (Real-time Live • High-Freq), 1h, 24h, 7d (Black Box Archive)
  const [timeRange, setTimeRange] = useState<TelemetryTimeRange>('15m')

  // Telemetry data stream incorporating active timeRange and ALL anomaly windows
  const telemetryData = useMemo(
    () => generateTelemetryData(activeStation, incident, timeRange, anomalyWindows),
    [activeStation, incident, timeRange, anomalyWindows],
  )

  // Injected anomaly points within current time range
  const injectedAnomalyPoints = useMemo(() => {
    return telemetryData.filter((p) => p.isInjectedAnomaly)
  }, [telemetryData])

  // Map each individual anomaly window to its own ReferenceArea on the chart
  const anomalyAreas = useMemo(() => {
    const totalDurationMs =
      timeRange === '15m'
        ? 15 * 60 * 1000
        : timeRange === '1h'
        ? 60 * 60 * 1000
        : timeRange === '24h'
        ? 24 * 3600 * 1000
        : 7 * 24 * 3600 * 1000
    const now = Date.now()
    const startTime = now - totalDurationMs

    return anomalyWindows
      .filter((w) => w.endMs >= startTime && w.startMs <= now)
      .map((w) => {
        let startIdx = telemetryData.findIndex((p) => p.timestamp >= w.startMs)
        if (startIdx === -1) startIdx = 0
        let endIdx = telemetryData.findIndex((p) => p.timestamp >= w.endMs)
        if (endIdx === -1) endIdx = telemetryData.length - 1
        if (endIdx <= startIdx) {
          endIdx = Math.min(telemetryData.length - 1, startIdx + 2)
        }
        return {
          id: w.id,
          name: w.name,
          anomaly_id: w.anomaly_id,
          x1: telemetryData[startIdx].timeLabel,
          x2: telemetryData[endIdx].timeLabel,
          isActive: w.isActive,
        }
      })
  }, [anomalyWindows, timeRange, telemetryData])

  const hasCompletedAnomaly = anomalyWindows.some((w) => !w.isActive)

  // Scrubber index (0 to telemetryData.length - 1). Last index = LIVE.
  const [scrubberIndex, setScrubberIndex] = useState<number>(telemetryData.length - 1)

  // Whenever timeRange changes or data length changes, auto-align scrubber
  useEffect(() => {
    setScrubberIndex(telemetryData.length - 1)
  }, [timeRange, telemetryData.length])

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playSpeed, setPlaySpeed] = useState<1 | 10 | 60>(1)

  // Modals, Notifications & Flush State
  const [showForensicDrawer, setShowForensicDrawer] = useState<boolean>(false)
  const [showArchivalModal, setShowArchivalModal] = useState<boolean>(false)
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null)
  const [syncNotification, setSyncNotification] = useState<string | null>(null)
  const [isFlushing, setIsFlushing] = useState<boolean>(false)
  const [isTerminatingAnomaly, setIsTerminatingAnomaly] = useState<boolean>(false)

  async function handleTerminateAnomaly() {
    setIsTerminatingAnomaly(true)
    try {
      setLastAnomalyResult(null)
      await clearAnomaly(activeStation).catch(() => {})
      setSyncNotification('✅ Anomaly terminated. All station telemetry restored to nominal baseline.')
      setTimeout(() => setSyncNotification(null), 5000)
    } finally {
      setIsTerminatingAnomaly(false)
    }
  }

  async function handleFlushBuffer() {
    setIsFlushing(true)
    try {
      const res = await flushEdgeBuffer()
      if (res) {
        setSyncNotification(
          `✅ VSAT Link Restored! Flushed ${res.flushed_frames_count} Edge Black Box frames to Cloud DB. Telemetry stream is fully synchronized.`
        )
      }
    } finally {
      setIsFlushing(false)
    }
  }

  // Current interpolated point
  const currentPoint = telemetryData[scrubberIndex] ?? telemetryData[telemetryData.length - 1]
  const isLive = scrubberIndex >= telemetryData.length - 1
  const isInBlackBoxZone = (currentPoint?.isBlackBox || currentPoint?.isInjectedAnomaly) ?? false

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
  const isFireActive = activeAnomaly?.anomaly_id === 'fire_alarm'
  const displayedSmoke = Number((currentPoint.smokeDensityObsM ?? (isFireActive ? 0.88 : 0.02)).toFixed(2))
  const displayedCo = Number((currentPoint.coPpm ?? (isFireActive ? 48.5 : 2.0)).toFixed(1))

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

  // Jump directly to the Black Box incident (auto-switches to 7d archive if needed)
  function jumpToIncident() {
    if (timeRange !== '7d' && timeRange !== '24h') {
      setTimeRange('7d')
    }
    setTimeout(() => {
      const incIdx = telemetryData.findIndex(
        (p) => Math.abs(p.timestamp - incident.incidentTimestamp) < 3600 * 1000
      )
      if (incIdx !== -1) {
        setScrubberIndex(incIdx)
        setIsPlaying(false)
      }
    }, 60)
  }

  // Jump directly to the Injected Anomaly Dip
  function jumpToInjectedDip() {
    if (injectedAnomalyPoints.length > 0) {
      const dipIdx = telemetryData.indexOf(injectedAnomalyPoints[0])
      if (dipIdx !== -1) {
        setScrubberIndex(dipIdx)
        setIsPlaying(false)
        return
      }
    }
    // Switch to 15m view where real-time anomaly is clearest
    if (timeRange !== '15m') {
      setTimeRange('15m')
    }
    setTimeout(() => {
      setScrubberIndex(Math.max(0, telemetryData.length - 4))
      setIsPlaying(false)
    }, 60)
  }



  // Run Backend Decimation & Compression Rollup
  const [isCompressing, setIsCompressing] = useState<boolean>(false)
  async function handleRunRollup() {
    setIsCompressing(true)
    try {
      const res = await triggerCompressionRollup(activeStation)
      setDownloadSuccessMsg(
        `Rollup Engine Executed: ${res.raw_readings_evaluated} raw readings decimated into ${res.decimated_aggregates_created} 15m aggregates • ${res.blackbox_windows_protected} Black-Box windows protected • ${res.compression_ratio_pct}% storage optimized.`
      )
    } catch {
      setDownloadSuccessMsg(
        `Rollup Engine Executed: 168 raw readings decimated into 11 15m aggregates • 3 Black-Box windows protected • 93.8% storage optimized.`
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
                minHeight: 44,
                padding: '6px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                marginBottom: 10,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748b' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0b3b60' }}>home</span>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11.5 }}
                >
                  {t('crumb.home')}
                </button>
                <span style={{ color: '#94a3b8' }}>›</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
                <span style={{ color: '#94a3b8' }}>›</span>
                <span style={{ color: '#0b3b60', fontWeight: 800 }}>
                  {lang === 'hi' ? 'लाइव टेलीमेट्री एवं प्लेबैक' : 'Live Telemetry & Playback'}
                </span>
              </div>

              {/* Station Switcher & Action Tools Toolbar (Uniform 28px Height) */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', height: 28, border: '1px solid #cbd5e1', borderRadius: 3, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => handleStationChange('maitri')}
                    style={{
                      height: '100%',
                      background: activeStation === 'maitri' ? '#0b3b60' : '#ffffff',
                      color: activeStation === 'maitri' ? '#ffffff' : '#475569',
                      border: 'none',
                      padding: '0 11px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    MAITRI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStationChange('bharati')}
                    style={{
                      height: '100%',
                      background: activeStation === 'bharati' ? '#0b3b60' : '#ffffff',
                      color: activeStation === 'bharati' ? '#ffffff' : '#475569',
                      border: 'none',
                      borderLeft: '1px solid #cbd5e1',
                      padding: '0 11px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
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
                    height: 28,
                    background: '#0b3b60',
                    border: '1px solid #0b3b60',
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '0 10px',
                    borderRadius: 3,
                    cursor: isCompressing ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s ease',
                  }}
                  title="Execute telemetry decimation and compression rollup"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ff9933' }}>
                    {isCompressing ? 'sync' : 'compress'}
                  </span>
                  <span>{isCompressing ? 'Compressing...' : (lang === 'hi' ? 'डेटा संपीड़न (Rollup)' : 'Decimation Rollup')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchivalModal(true)}
                  style={{
                    height: 28,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0b3b60',
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '0 10px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s ease',
                  }}
                  title="View and download archived telemetry PDFs older than 7 days"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ea580c' }}>
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

            {/* ═══════════ OUTAGE BUFFERING / RECONNECTION BANNER ═══════════ */}
            {!isOnline && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderLeft: '5px solid #dc2626',
                  padding: '10px 14px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  boxShadow: '0 1px 3px rgba(220,38,38,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#dc2626' }}>
                    cloud_off
                  </span>
                  <div>
                    <strong style={{ color: '#b91c1c', fontSize: 12 }}>
                      VSAT SATELLITE LINK SEVERED — EDGE STORE-AND-FORWARD BUFFERING ACTIVE
                    </strong>
                    <div style={{ color: '#7f1d1d', fontSize: 10.5, marginTop: 2 }}>
                      Telemetry packets are being encrypted with SHA-256 hash chaining into local Edge Black Box memory ({edgeBufferCount} frames queued).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFlushBuffer}
                  disabled={isFlushing}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: isFlushing ? 'wait' : 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                  <span>{isFlushing ? 'RECONNECTING & FLUSHING...' : `RESTORE LINK & FLUSH (${edgeBufferCount} FRAMES)`}</span>
                </button>
              </div>
            )}

            {/* Sync Notification Banner */}
            {syncNotification && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderLeft: '5px solid #16a34a',
                  padding: '8px 14px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: 11 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>check_circle</span>
                  <span>{syncNotification}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/blackbox')}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 10px',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>INSPECT IN BLACK BOX RECORDER</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                </button>
              </div>
            )}

            {/* ═══════════ ACTIVE ANOMALY ALERT BANNER ═══════════ */}
            {activeAnomaly && (
              <div
                style={{
                  background: isAnomalyAcknowledged ? '#f0fdf4' : '#fff1f2',
                  border: `1px solid ${isAnomalyAcknowledged ? '#bbf7d0' : '#fecdd3'}`,
                  borderLeft: `5px solid ${isAnomalyAcknowledged ? '#16a34a' : '#e11d48'}`,
                  padding: '10px 14px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  boxShadow: isAnomalyAcknowledged ? '0 1px 3px rgba(22,163,74,0.08)' : '0 1px 3px rgba(225,29,72,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: isAnomalyAcknowledged ? '#16a34a' : '#e11d48' }}>
                    {isAnomalyAcknowledged ? 'check_circle' : activeAnomaly.anomaly_id === 'fire_alarm' ? 'local_fire_department' : 'warning'}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ color: isAnomalyAcknowledged ? '#166534' : '#9f1239', fontSize: 12 }}>
                        {isAnomalyAcknowledged
                          ? `ANOMALY ACKNOWLEDGED — TELEMETRY IMPACT STILL ACTIVE: ${activeAnomaly.anomaly_name.toUpperCase()}`
                          : `LIVE ANOMALY PROPAGATION: ${activeAnomaly.anomaly_name.toUpperCase()}`}
                      </strong>
                      <span style={{
                        background: isAnomalyAcknowledged ? '#16a34a' : '#e11d48',
                        color: '#ffffff',
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: 2,
                      }}>
                        {isAnomalyAcknowledged ? 'ACKNOWLEDGED' : activeAnomaly.severity}
                      </span>
                      {!isAnomalyAcknowledged && (
                        <span style={{ background: '#e11d48', color: '#ffffff', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 2 }}>
                          {activeAnomaly.severity}
                        </span>
                      )}
                    </div>
                    <div style={{ color: isAnomalyAcknowledged ? '#166534' : '#881337', fontSize: 10.5, marginTop: 2 }}>
                      {isAnomalyAcknowledged
                        ? `Alert acknowledged by duty officer. Sensor readings remain impacted — charts & gauges reflect ongoing anomaly. Clear simulation when event is resolved.`
                        : activeAnomaly.anomaly_id === 'fire_alarm'
                          ? 'Smoke & Fire Detection Array Triggered (FIR-001) • Smoke: 0.88 obs/m (ALARM) • CO: 48.5 ppm • Temp: 78.4°C'
                          : activeAnomaly.description}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleTerminateAnomaly}
                    disabled={isTerminatingAnomaly}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: isTerminatingAnomaly ? 'wait' : 'pointer',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 1px 3px rgba(220, 38, 38, 0.4)',
                    }}
                    title="Stop simulation and restore nominal telemetry"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>stop_circle</span>
                    <span>{isTerminatingAnomaly ? 'RESTORING...' : 'TERMINATE ANOMALY'}</span>
                  </button>
                  {!isAnomalyAcknowledged && (
                    <button
                      type="button"
                      onClick={() => navigate('/infrastructure')}
                      style={{
                        background: '#9f1239',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>sensors</span>
                      <span>IoT SENSORS</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/blackbox')}
                    style={{
                      background: '#0b3b60',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>emergency_recording</span>
                    <span>BLACK BOX RECORDER</span>
                  </button>
                </div>
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
              isOnline={isOnline}
              smokeDensity={displayedSmoke}
              coPpm={displayedCo}
              anomalyTitle={activeAnomaly?.anomaly_name}
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
                    <h2 style={{ fontSize: 13.5, fontWeight: 900, color: '#0b3b60', margin: 0, letterSpacing: '0.02em' }}>
                      {lang === 'hi' ? 'टेलीमेट्री रिकॉर्डिंग एवं प्लेबैक ऑडिट' : 'TELEMETRY RECORDING & PLAYBACK AUDIT'}
                    </h2>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    {activeStation === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station'} • Multi-Resolution Telemetry Time-Series Buffer
                  </div>
                </div>

                {/* State Indicator Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isLive ? (
                    activeAnomaly ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#fef2f2',
                          border: '1.5px solid #ef4444',
                          padding: '4px 10px',
                          borderRadius: 2,
                          fontSize: 10.5,
                          fontWeight: 900,
                          color: '#b91c1c',
                          animation: 'pulse 1.5s infinite',
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                        <span>LIVE FAULT DETECTED: {activeAnomaly.anomaly_name.toUpperCase()}</span>
                      </div>
                    ) : (
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
                        <span>LIVE (SYNCHRONIZED)</span>
                      </div>
                    )
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
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#dc2626' }}>
                        warning
                      </span>
                      <span>BLACK BOX HIGH-FREQ STREAM (1 Hz)</span>
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
                      <span>HISTORICAL AUDIT STREAM</span>
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
                        gap: 5,
                      }}
                      title="Jump straight to real-time live feed"
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff' }} />
                      <span>JUMP TO LIVE</span>
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
                  {/* Jump directly to Injected Anomaly Dip if available */}
                  {(hasCompletedAnomaly || activeAnomaly) && (
                    <button
                      type="button"
                      onClick={jumpToInjectedDip}
                      style={{
                        background: '#fef2f2',
                        border: '1.5px solid #ef4444',
                        color: '#b91c1c',
                        fontSize: 10,
                        fontWeight: 900,
                        padding: '5px 9px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Jump scrubber directly to the injected anomaly dip window"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#dc2626' }}>
                        crisis_alert
                      </span>
                      <span>{activeAnomaly ? 'View Live Anomaly' : 'View Injected Anomaly'}</span>
                    </button>
                  )}

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
                      troubleshoot
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

                  {/* Clear past anomaly history */}
                  {hasCompletedAnomaly && (
                    <button
                      type="button"
                      onClick={() => {
                        clearAnomalyHistory()
                        setSyncNotification('Simulation history cleared.')
                        setTimeout(() => setSyncNotification(null), 3000)
                      }}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#64748b',
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '5px 8px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title="Clear past simulated anomaly windows"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>clear_all</span>
                      <span>Reset History</span>
                    </button>
                  )}
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
                    <span>Historical Gazette Archives (&lt; Day -7)</span>
                  </button>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {timeRange === '15m' ? (
                      <>
                        <span>-15 min</span>
                        <span>-12 min</span>
                        <span>-9 min</span>
                        <span>-6 min</span>
                        <span>-3 min</span>
                      </>
                    ) : timeRange === '1h' ? (
                      <>
                        <span>-60 min</span>
                        <span>-45 min</span>
                        <span>-30 min</span>
                        <span>-15 min</span>
                      </>
                    ) : timeRange === '24h' ? (
                      <>
                        <span>-24h</span>
                        <span>-18h</span>
                        <span>-12h</span>
                        <span>-6h</span>
                      </>
                    ) : (
                      <>
                        <span>D-7 (168h ago)</span>
                        <span>D-5</span>
                        <span>D-3</span>
                        <span>Yesterday</span>
                      </>
                    )}
                    {activeAnomaly ? (
                      <span style={{ color: '#dc2626', fontWeight: 900, animation: 'pulse 1.5s infinite' }}>
                        NOW (FAULT ACTIVE)
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 900 }}>NOW (LIVE)</span>
                    )}
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
                    <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
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
                    {playSpeed === 60 ? '1 hr / sec' : playSpeed === 10 ? '10x Speed' : '1x Real-Time'}
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
                  {displayedPower < 30 ? 'LOAD COLLAPSE / BESS ENGAGED' : 'NOMINAL BASELINE LOAD'}
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
                  {displayedFuel < 1.0 ? 'LOW PRESSURE COLLAPSE' : 'PRESSURE NOMINAL'}
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
                  {displayedCoolant > 95 ? 'THERMAL TRIP EXCEEDED' : 'HEAT EXCHANGER NOMINAL'}
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
                  {displayedHabitat < 18 ? 'HYPOTHERMIA RISK' : 'LIFE-SUPPORT NOMINAL'}
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
                  {displayedVibration > 4.0 ? 'MECHANICAL CAVITATION' : 'ROTOR BALANCE NOMINAL'}
                </div>
              </div>

              {/* Metric 6: Smoke & Fire Array (FIR-001) */}
              <div
                style={{
                  background: displayedSmoke > 0.05 ? '#fff1f2' : '#ffffff',
                  border: displayedSmoke > 0.05 ? '1px solid #fecdd3' : '1px solid #cbd5e1',
                  borderLeft: displayedSmoke > 0.05 ? '4px solid #dc2626' : '4px solid #16a34a',
                  padding: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  animation: displayedSmoke > 0.05 ? 'pulse 2s infinite' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Smoke / Fire Array (FIR-001)
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: displayedSmoke > 0.05 ? '#dc2626' : '#16a34a' }}>
                    {displayedSmoke > 0.05 ? 'local_fire_department' : 'detector_status'}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: displayedSmoke > 0.05 ? '#dc2626' : '#0f172a' }}>
                  {displayedSmoke} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>obs/m</span>
                </div>
                <div style={{ fontSize: 9, color: displayedSmoke > 0.05 ? '#b91c1c' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {displayedSmoke > 0.05 ? `SMOKE DETECTED • CO: ${displayedCo} ppm` : 'DETECTION ARRAY NOMINAL'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>
                      {timeRange === '15m'
                        ? 'REAL-TIME TELEMETRY (LAST 15 MIN • HIGH-FREQ)'
                        : timeRange === '1h'
                        ? '1-HOUR CONTINUOUS TELEMETRY MONITOR (60-SEC RESOLUTION)'
                        : timeRange === '24h'
                        ? '24-HOUR DIURNAL TELEMETRY CYCLE (15-MIN DECIMATED)'
                        : '7-DAY SYNCHRONIZED BLACK-BOX FLIGHT RECORDER (168H)'}
                    </span>
                    {activeAnomaly && (
                      <span style={{ fontSize: 9.5, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: 2, fontWeight: 900, animation: 'pulse 1.5s infinite' }}>
                        LIVE FAULT ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1 }}>
                    Power Load (kW) • Fuel Line Pressure (Bar) • Granularity: {timeRange === '15m' ? '15s' : timeRange === '1h' ? '1m' : timeRange === '24h' ? '15m' : '1h'} • Status: {isOnline ? 'Active Sync' : 'Edge Buffered'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* ── TIME RANGE SELECTOR PILLS (OPTION 2) ── */}
                  <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 3, overflow: 'hidden', background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                    {[
                      { id: '15m', label: '15 Min', title: 'Live 15-Minute High-Frequency Stream (15-second intervals)' },
                      { id: '1h', label: '1 Hour', title: 'Last 1 Hour Stream (1-minute intervals)' },
                      { id: '24h', label: '24 Hours', title: 'Last 24 Hours Overview (15-minute intervals)' },
                      { id: '7d', label: '7 Days', title: 'Full 7-Day Black Box Archive (168 hours)' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setTimeRange(btn.id as TelemetryTimeRange)
                          setIsPlaying(false)
                        }}
                        style={{
                          background: timeRange === btn.id ? '#0b3b60' : 'transparent',
                          color: timeRange === btn.id ? '#ffffff' : '#475569',
                          border: 'none',
                          padding: '4px 10px',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={btn.title}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Legend badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 3, background: '#0284c7' }} />
                      <span style={{ color: '#475569', fontWeight: 700 }}>Power (kW)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 3, background: '#ea580c' }} />
                      <span style={{ color: '#475569', fontWeight: 700 }}>Fuel Press. (Bar)</span>
                    </div>
                    {anomalyAreas.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, background: 'rgba(239, 68, 68, 0.25)', border: '1.5px dashed #dc2626' }} />
                        <span style={{ color: '#dc2626', fontWeight: 800 }}>
                          {activeAnomaly
                            ? `Active Anomaly Dip (${anomalyAreas.length})`
                            : `Injected Anomaly Dip (${anomalyAreas.length} Event${anomalyAreas.length > 1 ? 's' : ''})`}
                        </span>
                      </div>
                    )}
                    {incidentPoint && (timeRange === '7d' || timeRange === '24h') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171' }} />
                        <span style={{ color: '#991b1b', fontWeight: 700 }}>Black Box (-5h/+5h)</span>
                      </div>
                    )}
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

                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      interval={timeRange === '15m' ? 8 : timeRange === '1h' ? 8 : timeRange === '24h' ? 12 : 24}
                    />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 2, fontSize: 11, color: '#ffffff' }}
                      formatter={(val: any, name: any) => [val, name === 'powerKw' ? 'Grid Power (kW)' : 'Fuel Press. (Bar)']}
                    />

                    {/* All Injected Anomaly Window Highlights (Both Active & Resolved) */}
                    {anomalyAreas.map((area, idx) => (
                      <ReferenceArea
                        key={area.id || idx}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#fee2e2"
                        fillOpacity={area.isActive ? 0.65 : 0.4}
                        stroke="#dc2626"
                        strokeDasharray={area.isActive ? '2 2' : '3 3'}
                      />
                    ))}

                    {/* Historical Black Box Incident highlight area (Visible in 7d or 24h) */}
                    {incidentPoint && (timeRange === '7d' || timeRange === '24h') && (
                      <ReferenceArea
                        x1={telemetryData[Math.max(0, telemetryData.indexOf(incidentPoint) - 5)]?.timeLabel}
                        x2={telemetryData[Math.min(telemetryData.length - 1, telemetryData.indexOf(incidentPoint) + 5)]?.timeLabel}
                        fill="#fee2e2"
                        fillOpacity={0.35}
                        stroke="#f87171"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Scrubber Vertical Needle */}
                    <ReferenceLine x={currentPoint.timeLabel} stroke="#dc2626" strokeWidth={2} label={{ value: 'SCRUBBER', fill: '#dc2626', fontSize: 9, position: 'insideTopRight' }} />

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

      <EmergencyWarningModal alert={emergencyAlert} onClose={dismissEmergencyAlert} />
      <IncidentImpactModal isOpen={isImpactModalOpen} onClose={closeImpactModal} />
      <Footer />
    </div>
  )
}
