import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStation } from '../context/StationContext'
import { emergencyAudio } from '../utils/emergencyAudio'
import { injectAnomaly, type AnomalyInjectionResult } from '../api/hq'
import { useQueryClient } from '@tanstack/react-query'
import emblemOfIndia from '../assets/emblem_of_india.svg'

// ── Types & Constants ──────────────────────────────────────────────────────────

interface AnomalyHazardPreset {
  id: string
  name: string
  nameHi?: string
  code: string
  category: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  icon: string
  description: string
  localImpact: string
  sensorsAffected: string[]
  suggestedAction: string
  estimated_duration_s?: number
}

const SEV_STYLE: Record<string, { bg: string; border: string; color: string; badge: string; badgeFg: string }> = {
  CRITICAL: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', badge: '#b91c1c', badgeFg: '#fff' },
  HIGH: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', badge: '#ea580c', badgeFg: '#fff' },
  MEDIUM: { bg: '#fefce8', border: '#fde68a', color: '#92400e', badge: '#ca8a04', badgeFg: '#fff' },
  LOW: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', badge: '#16a34a', badgeFg: '#fff' },
}

function getSevStyle(sev: string) {
  return SEV_STYLE[sev] ?? SEV_STYLE['LOW']
}

const HAZARD_PRESETS: AnomalyHazardPreset[] = [
  {
    id: 'blizzard',
    name: 'Polar Blizzard Event',
    nameHi: 'ध्रुवीय बर्फीला तूफान',
    code: 'HAZ-MET-01',
    category: 'METEOROLOGICAL',
    severity: 'HIGH',
    icon: 'ac_unit',
    description: 'Category-4 polar blizzard with sustained winds > 100 km/h, visibility < 50 m, temp drop -12°C.',
    localImpact: 'Wind sensors spike, snow gauges buried, VSAT margin drops by -8 dB.',
    sensorsAffected: ['WIND_SPEED (104.2 km/h)', 'VISIBILITY (42 m)', 'VSAT_SNR (4.2 dB)'],
    suggestedAction: 'Deploy station crew for sensor inspection, increase heating load on generator.',
    estimated_duration_s: 4,
  },
  {
    id: 'generator_failure',
    name: 'Primary Generator Failure',
    nameHi: 'मुख्य जनरेटर विफलता',
    code: 'HAZ-PWR-01',
    category: 'POWER',
    severity: 'CRITICAL',
    icon: 'bolt',
    description: 'Primary diesel generator trips. Station switches to battery bank and auto-cranks DG-2.',
    localImpact: 'Primary load drops to 0 kW. Battery bank discharges at 2.8%/hr. Non-essential loads shed.',
    sensorsAffected: ['DG1_LOAD (0.0 kW)', 'BATT_SOC (88.4%)', 'GEN_HALL_TEMP (58.2°C)'],
    suggestedAction: 'Engineer crew to Generator Hall, verify DG-2 auto-transfer and fuel pressure.',
    estimated_duration_s: 4,
  },
  {
    id: 'water_line_freeze',
    name: 'Lake Priyadarshini Water Line Ice-Plug',
    nameHi: 'प्रियदर्शिनी झील जल पाइपलाइन बर्फ अवरोध',
    code: 'HAZ-HYD-01',
    category: 'LIFE SUPPORT',
    severity: 'HIGH',
    icon: 'water_damage',
    description: 'Priyadarshini water pipeline pressure drop from 3.8 bar to 0.1 bar. Sub-zero ice blockage detected.',
    localImpact: 'Potable water supply to Main Living Habitat severed. Melt tank reserve: 4.2 hours.',
    sensorsAffected: ['PRIYA_FLOW_RATE (0.0 L/m)', 'PIPE_SECTOR4_TEMP (-4.1°C)', 'MELT_TANK_LVL (71%)'],
    suggestedAction: 'Activate 48V Emergency Trace-Heating Booster on Sector 4 pipeline.',
    estimated_duration_s: 3,
  },
  {
    id: 'habitat_fire_alarm',
    name: 'Habitat Fire & Smoke Trigger',
    nameHi: 'आवास क्षेत्र धूम्र एवं अग्नि अलार्म',
    code: 'HAZ-SAF-01',
    category: 'CREW SAFETY',
    severity: 'CRITICAL',
    icon: 'local_fire_department',
    description: 'Optical smoke detector in Berthing Module B detects 88% obscuration. Temperature rises to 44.8°C.',
    localImpact: 'Local station emergency siren sounds at 110 dB. Automated fire dampers isolated.',
    sensorsAffected: ['SMOKE_DENS_ZONE_B (88%)', 'ZONE_B_TEMP (44.8°C)', 'FIRE_DAMPER_12 (CLOSED)'],
    suggestedAction: 'Trigger N2 gas fire suppression in Zone B and isolate electrical sub-feed.',
    estimated_duration_s: 5,
  },
  {
    id: 'earthquake',
    name: 'Seismic / Ice-Quake Event',
    nameHi: 'भूकंपीय / हिम-कंप घटना',
    code: 'HAZ-GEO-01',
    category: 'SEISMIC',
    severity: 'CRITICAL',
    icon: 'vibration',
    description: 'Ml 3.8 ice-quake directly beneath station foundation. Peak ground velocity > 12 mm/s.',
    localImpact: 'Seismic PGV spikes to 14.2 mm/s. Foundation strain gauge reaches 228 micro-strain.',
    sensorsAffected: ['SEISMIC_PGV (14.2 mm/s)', 'FOUNDATION_STRAIN (228 ue)', 'GLACIER_SPEED (38 cm/d)'],
    suggestedAction: 'Inspect structural foundation pillars and halt outdoor glacier activities.',
    estimated_duration_s: 5,
  },
  {
    id: 'iot_mass_offline',
    name: 'Mass IoT Sensor Outage',
    nameHi: 'सेंसर बस विफलता (60% ऑफलाइन)',
    code: 'HAZ-COM-01',
    category: 'COMMUNICATIONS',
    severity: 'HIGH',
    icon: 'sensors_off',
    description: 'Sensor bus failure or PoE switch reboot causing 60% of telemetry nodes to drop offline.',
    localImpact: 'Critical telemetry gaps appear. Edge black-box switches to store-and-forward mode.',
    sensorsAffected: ['BUS_NODES_ONLINE (40%)', 'POE_SWITCH_A (FAULT)', 'PACKET_LOSS (58.4%)'],
    suggestedAction: 'Reboot sensor network switch Node A/B, inspect physical cable runs.',
    estimated_duration_s: 4,
  },
  {
    id: 'vsat_link_loss',
    name: 'VSAT Satellite Link Loss',
    nameHi: 'वी-सैट उपग्रह संपर्क विच्छेद',
    code: 'HAZ-COM-02',
    category: 'COMMUNICATIONS',
    severity: 'HIGH',
    icon: 'satellite_alt',
    description: 'Complete carrier drop on primary GSAT-7 VSAT dish. Station enters Autonomous Island Mode.',
    localImpact: 'Cloud sync suspended. All raw 1Hz frames buffered into local NVMe SSD ring buffer.',
    sensorsAffected: ['VSAT_CARRIER (0.0 Mbps)', 'GSAT7_LOCK (LOST)', 'EDGE_BUFFER_ACTIVE (TRUE)'],
    suggestedAction: 'Check antenna tracking servo, lock local buffer, prepare Protobuf sync.',
    estimated_duration_s: 4,
  },
  {
    id: 'fuel_critical_low',
    name: 'Fuel Reserve Critical Low',
    nameHi: 'डीजल ईंधन भंडार संकट स्तर',
    code: 'HAZ-LOG-01',
    category: 'FUEL',
    severity: 'HIGH',
    icon: 'local_gas_station',
    description: 'Station Arctic-grade diesel reserve drops below 30% emergency survival threshold.',
    localImpact: 'Reserve drops to 38,200 Litres (91 days survival). Mandatory fuel rationing activates.',
    sensorsAffected: ['DIESEL_TANK_LVL (28.6%)', 'DAYS_SURVIVAL (91 Days)', 'BURN_RATE (420 L/d)'],
    suggestedAction: 'Activate Station Fuel Rationing Order 7B, notify NCPOR Goa logistics.',
    estimated_duration_s: 3,
  },
  {
    id: 'hvac_failure',
    name: 'HVAC / Thermal Trip',
    nameHi: 'एचवीएसी तापीय विफलता',
    code: 'HAZ-LIF-01',
    category: 'LIFE SUPPORT',
    severity: 'CRITICAL',
    icon: 'thermostat',
    description: 'Primary HVAC blower motor jam in habitat. Indoor temperatures drop rapidly toward freezing.',
    localImpact: 'Living module temperature drops from +21°C toward +4°C. CO2 concentration climbs.',
    sensorsAffected: ['HABITAT_TEMP (+8.2°C)', 'CO2_LEVEL (890 ppm)', 'BLOWER_FAN_RPM (0)'],
    suggestedAction: 'Engage emergency glycol hydronic loop backup and auxiliary air blowers.',
    estimated_duration_s: 4,
  },
  {
    id: 'solar_flare_radiation',
    name: 'Solar Flare Radiation Surge',
    nameHi: 'सौर ज्वाला विकिरण उछाल',
    code: 'HAZ-ENV-01',
    category: 'SPACE WEATHER',
    severity: 'MEDIUM',
    icon: 'wb_sunny',
    description: 'Class-M solar flare causes extreme UV index spike and ionospheric HF radio blackout.',
    localImpact: 'UV index spikes to 8.4 UVI. GPS positioning error degrades to +/-85 meters.',
    sensorsAffected: ['UV_INDEX (8.4 UVI)', 'SOLAR_IRRADIANCE (1180 W/m2)', 'GPS_DOP (14.2)'],
    suggestedAction: 'Mandate UV protective suits for outdoor work, switch comms to shielded cable.',
    estimated_duration_s: 3,
  },
]

export default function StationEdgeConsolePage() {
  const queryClient = useQueryClient()
  const {
    stationId,
    setStationId,
    linkState,
    edgeBufferCount,
    toggleLinkState,
    flushEdgeBuffer,
    emergencyAlert,
    lastAnomalyResult,
    triggerEmergencyAlert,
    dismissEmergencyAlert,
    endAnomalyOnConsole,
  } = useStation()

  // ── Local Interactive Controls State ──
  const [activePreset, setActivePreset] = useState<AnomalyHazardPreset>(HAZARD_PRESETS[0])
  const [hazardSearch, setHazardSearch] = useState<string>('')
  const [hazardFilterSev, setHazardFilterSev] = useState<string>('ALL')
  const [hazardFilterCat, setHazardFilterCat] = useState<string>('ALL')
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false)
  const [isFlushing, setIsFlushing] = useState<boolean>(false)
  const [flushSuccessNotice, setFlushSuccessNotice] = useState<string | null>(null)
  const [activeGenerator, setActiveGenerator] = useState<'DG1' | 'DG2' | 'DG3'>('DG1')
  const [isTraceHeatingOn, setIsTraceHeatingOn] = useState<boolean>(true)
  const [crewStatusNotice, setCrewStatusNotice] = useState<string | null>(null)
  const [currentHash, setCurrentHash] = useState<string>('0x8f3c4e12b7a90dc4')
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')
  const [recentBufferedFrames, setRecentBufferedFrames] = useState<Array<{ id: number; time: string; hash: string; bytes: number }>>([])
  const frameIdRef = useRef<number>(1)

  // Active anomaly on the edge console (persisted so it stays active across reloads until stopped)
  const [activeAnomaly, setActiveAnomaly] = useState<AnomalyInjectionResult | null>(() => {
    try {
      const raw = localStorage.getItem('himantar_edge_active_anomaly')
      if (raw) return JSON.parse(raw)
      const last = localStorage.getItem('himantar_last_anomaly')
      if (last) {
        const parsed = JSON.parse(last)
        if (parsed && !parsed.consoleEnded) return parsed
      }
    } catch { }
    return null
  })

  // Sync with context anomaly updates
  useEffect(() => {
    if (emergencyAlert) {
      setActiveAnomaly(emergencyAlert)
      try {
        localStorage.setItem('himantar_edge_active_anomaly', JSON.stringify(emergencyAlert))
      } catch { }
    } else if (lastAnomalyResult && !lastAnomalyResult.consoleEnded) {
      setActiveAnomaly(lastAnomalyResult)
      try {
        localStorage.setItem('himantar_edge_active_anomaly', JSON.stringify(lastAnomalyResult))
      } catch { }
    } else if (lastAnomalyResult && lastAnomalyResult.consoleEnded) {
      setActiveAnomaly(null)
      try {
        localStorage.removeItem('himantar_edge_active_anomaly')
      } catch { }
    }
  }, [emergencyAlert, lastAnomalyResult])

  // Scroll to anomaly injector section if navigated with hash
  useEffect(() => {
    if (window.location.hash.includes('anomaly-injector')) {
      const el = document.getElementById('anomaly-injector-section')
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 120)
      }
    }
  }, [])

  // Filtered preset hazards list
  const filteredPresets = HAZARD_PRESETS.filter((p) => {
    if (hazardFilterSev !== 'ALL' && p.severity !== hazardFilterSev) return false
    if (hazardFilterCat !== 'ALL' && p.category !== hazardFilterCat) return false
    if (hazardSearch.trim()) {
      const q = hazardSearch.trim().toLowerCase()
      const match =
        p.name.toLowerCase().includes(q) ||
        (p.nameHi && p.nameHi.toLowerCase().includes(q)) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sensorsAffected.some((s) => s.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  // Live Clock (IST & Antarctic UTC)
  useEffect(() => {
    function tick() {
      const now = new Date()
      const istOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      const ist = new Intl.DateTimeFormat('en-IN', istOptions).format(now) + ' IST'
      const utc = now.toISOString().replace('T', ' ').substring(11, 19) + ' UTC'
      setCurrentTimeStr(`${ist} | ${utc}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // Generate SHA-256 block hashes
  useEffect(() => {
    const timer = setInterval(() => {
      const hex = '0123456789abcdef'
      let h = '0x'
      for (let i = 0; i < 16; i++) {
        h += hex[Math.floor(Math.random() * hex.length)]
      }
      setCurrentHash(h)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  // When link is DOWN, push new buffered frames visually into history
  useEffect(() => {
    if (linkState !== 'DOWN') return
    const timer = setInterval(() => {
      const id = frameIdRef.current++
      const now = new Date()
      const timeStr = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')}`
      const hashPart = Math.random().toString(16).substring(2, 10)
      setRecentBufferedFrames((prev) => [
        { id, time: timeStr, hash: `SHA-256: 0x${hashPart}`, bytes: Math.floor(48 + Math.random() * 8) },
        ...prev.slice(0, 14),
      ])
    }, 1000)
    return () => clearInterval(timer)
  }, [linkState])

  // Sound klaxon siren when emergencyAlert changes (suppressed completely when offline blackout)
  useEffect(() => {
    if (emergencyAlert && !isAudioMuted && linkState !== 'DOWN') {
      emergencyAudio.playAlarm(stationId.toUpperCase(), emergencyAlert.anomaly_name, emergencyAlert.severity)
    } else {
      emergencyAudio.stop()
    }
  }, [emergencyAlert, isAudioMuted, stationId, linkState])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleInjectPreset = useCallback(async (preset: AnomalyHazardPreset) => {
    try {
      setActivePreset(preset)
      const res: AnomalyInjectionResult = await injectAnomaly(preset.id, stationId).catch(() => ({
        status: 'INJECTED',
        anomaly_id: preset.id,
        anomaly_name: preset.name,
        station_id: stationId,
        category: preset.category,
        severity: preset.severity,
        description: preset.description,
        impacts: [preset.localImpact, ...preset.sensorsAffected],
        recovery_steps: [preset.suggestedAction, 'Verify redundant systems', 'Acknowledge on-ice alert'],
        injected_at: new Date().toISOString(),
        report_reference: `NCPOR/SITREP/${stationId.toUpperCase()}/${preset.code}`,
        pdf_download_ready: true,
        pdf_download_url: '#',
        simulation_note: 'Simulated on-ice hardware failure. Local edge buffer active.',
      }))

      setActiveAnomaly(res)
      try {
        localStorage.setItem('himantar_edge_active_anomaly', JSON.stringify(res))
      } catch { }

      triggerEmergencyAlert(res)
      if (linkState === 'DOWN') {
        setCrewStatusNotice(`[LOCAL BUFFER ACTIVE] ${preset.name} recorded to NVMe buffer. Goa HQ offline due to link blackout.`)
      } else {
        setCrewStatusNotice(`[EMERGENCY TELEMETRY] ${preset.name} injected. GSAT-7 binary frame transmitted to Goa HQ.`)
      }
    } catch (e) {
      console.error('Failed to inject anomaly:', e)
    }
  }, [stationId, linkState, triggerEmergencyAlert])

  const handleClearAnomaly = useCallback(async () => {
    try {
      setActiveAnomaly(null)
      try {
        localStorage.removeItem('himantar_edge_active_anomaly')
      } catch { }
      await endAnomalyOnConsole(stationId)
      dismissEmergencyAlert()
      emergencyAudio.stop()
      setCrewStatusNotice('[STATUS NOMINAL] Hazard concluded on station. Nominal baseline restored. Goa HQ synchronized.')
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      console.error('Failed to clear anomaly:', e)
    }
  }, [stationId, endAnomalyOnConsole, dismissEmergencyAlert, queryClient])

  const handleSeverLink = useCallback(async () => {
    if (linkState === 'UP') {
      await toggleLinkState()
      setCrewStatusNotice('[LINK SEVERED] GSAT-7 carrier disconnected. Autonomous on-ice mode engaged. Writing to SSD buffer.')
    }
  }, [linkState, toggleLinkState])

  const handleRestoreAndFlush = useCallback(async () => {
    setIsFlushing(true)
    const initialBuffer = edgeBufferCount || 92
    setCrewStatusNotice(`[UPLINK ACQUIRED] Flushing ${initialBuffer} queued binary Protobuf frames to Goa HQ...`)

    let current = initialBuffer
    const stepInterval = setInterval(() => {
      current = Math.max(0, current - Math.ceil(initialBuffer / 10))
      if (current === 0) {
        clearInterval(stepInterval)
        flushEdgeBuffer().then((res) => {
          setIsFlushing(false)
          setFlushSuccessNotice(`Protobuf synchronization complete: ${res?.flushed_frames_count || initialBuffer} frames flushed with SHA-256 chain integrity verified.`)
          setCrewStatusNotice('[SYNC VERIFIED] Dual-twin parity 100%. Station telemetry synchronized with Goa HQ.')
          setTimeout(() => setFlushSuccessNotice(null), 6000)
        })
      }
    }, 120)
  }, [edgeBufferCount, flushEdgeBuffer])

  // Calculations for bandwidth saving
  const rawJsonBytes = (edgeBufferCount || 0) * 884
  const crushedProtobufBytes = (edgeBufferCount || 0) * 52
  const kbSaved = ((rawJsonBytes - crushedProtobufBytes) / 1024).toFixed(1)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        color: '#1e293b',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── TIER 1: NATIONAL TRICOLOUR ACCENT STRIPE ── */}
      <div className="tricolour-ribbon" />

      {/* ── TIER 1B: GOVERNMENT OF INDIA OFFICIAL TOP ACCESSIBILITY & CITIZEN BAR ── */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #cbd5e1',
          padding: '4px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#334155',
          flexWrap: 'wrap',
          gap: '4px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Mini Indian Flag Emblem */}
          <div
            style={{
              width: 18,
              height: 12,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #94a3b8',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#FFFFFF', position: 'relative' }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#0B3B60', margin: 'auto' }} />
            </div>
            <div style={{ flex: 1, background: '#138808' }} />
          </div>

          <span style={{ fontWeight: 700, color: '#0f172a', letterSpacing: '0.02em', fontSize: 11 }}>
            Government of India
          </span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ color: '#334155', fontWeight: 600, fontSize: 11 }}>
            Ministry of Earth Sciences (MoES)
          </span>
          <span style={{ color: '#cbd5e1' }} className="hidden md:inline">•</span>
          <span style={{ color: '#0369a1', fontWeight: 700, fontSize: 11 }} className="hidden md:inline">
            National Centre for Polar and Ocean Research (NCPOR)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0b3b60', fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ea580c' }}>schedule</span>
            <span>{currentTimeStr || 'IST / UTC'}</span>
          </div>

          {/* <div
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#0369a1',
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            GIGW 3.0 COMPLIANT
          </div> */}
        </div>
      </div>

      {/* ── TIER 2: THE ICONIC OFFICIAL WHITE GOVERNMENT MASTHEAD ── */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '2px solid #FF9933',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left: Official Emblem & Research Centre Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Official Emblem of India */}
          <div
            style={{
              width: 34,
              height: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src={emblemOfIndia}
              alt="National Emblem of India"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* Official NCPOR Circular Seal */}
          <img
            src="/ncpor_logo.png"
            alt="NCPOR Seal"
            style={{ height: 42, width: 42, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />

          <div style={{ height: 38, width: 1, background: '#e2e8f0', margin: '0 2px' }} className="hidden sm:block" />

          {/* Ministry & System Title */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              National Centre for Polar and Ocean Research (NCPOR)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#072a44', letterSpacing: '-0.01em' }}>
                HIMANTAR
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: '#f0fdf4',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: 3,
                  border: '1px solid #bbf7d0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {/* <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} /> */}
                {/* <span>ON-ICE RUGGED EDGE CONSOLE (LAN 192.168.1.10)</span> */}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
              {stationId === 'maitri'
                ? 'Maitri Research Station, Antarctica (70°45\'S, 11°44\'E)'
                : 'Bharati Research Station, Antarctica (69°24\'S, 76°11\'E)'} • 44th Indian Scientific Expedition to Antarctica (44-ISEA)
            </div>
          </div>
        </div>

        {/* Right: Station Switcher, VSAT Status & Switch to Goa HQ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Station Selector */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              padding: 2,
            }}
          >
            <button
              onClick={() => setStationId('maitri')}
              style={{
                background: stationId === 'maitri' ? '#0b3b60' : 'transparent',
                color: stationId === 'maitri' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'all 0.15s ease',
              }}
            >
              MAITRI BASE
            </button>
            <button
              onClick={() => setStationId('bharati')}
              style={{
                background: stationId === 'bharati' ? '#0b3b60' : 'transparent',
                color: stationId === 'bharati' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'all 0.15s ease',
              }}
            >
              BHARATI BASE
            </button>
          </div>

          {/* GSAT-7 VSAT Status Indicator */}
          {linkState === 'UP' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#15803d',
                padding: '5px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
              }}
              title="VSAT Telemetry stream is CONNECTED via GSAT-7 military satellite carrier"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
              <span>GSAT-7 UPLINK STREAMING</span>
              <span style={{ fontSize: 9.5, color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: 2, fontWeight: 800 }}>
                14.2 GHz • 620ms
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#fef2f2',
                border: '1px solid #f87171',
                color: '#b91c1c',
                padding: '5px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 800,
                boxShadow: '0 0 10px rgba(220, 38, 38, 0.25)',
              }}
              title="VSAT satellite link is severed! Station running in Autonomous Edge Mode. Storing to local SSD."
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'ping 1s infinite' }} />
              <span>SATELLITE OUTAGE • AUTONOMOUS EDGE MODE</span>
              <span style={{ fontSize: 9.5, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 2, fontWeight: 800 }}>
                {edgeBufferCount} FRAMES BUFFERED
              </span>
            </div>
          )}

          {/* Audio Siren Toggle */}
          <button
            onClick={() => {
              setIsAudioMuted(!isAudioMuted)
              if (!isAudioMuted) emergencyAudio.stop()
            }}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: isAudioMuted ? '#64748b' : '#ea580c',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isAudioMuted ? 'volume_off' : 'notifications_active'}</span>
            <span>{isAudioMuted ? 'SIREN MUTED' : 'SIREN ARMED'}</span>
          </button>

          {/* Back to Goa HQ Link */}
          <Link
            to="/"
            style={{
              background: '#0b3b60',
              border: '1px solid #07253d',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
            title="Return to National Centre for Polar & Ocean Research Goa Headquarters Dashboard"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dashboard</span>
            <span>HQ COMMAND</span>
          </Link>
        </div>
      </header>

      {/* Live Announcement Banner (if any active notice) */}
      {crewStatusNotice && (
        <div
          style={{
            background: linkState === 'DOWN' ? '#fef2f2' : '#f0fdf4',
            borderBottom: `1px solid ${linkState === 'DOWN' ? '#fca5a5' : '#86efac'}`,
            color: linkState === 'DOWN' ? '#991b1b' : '#166534',
            padding: '7px 18px',
            fontSize: 11.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>campaign</span>
            <span>{crewStatusNotice}</span>
          </div>
          <button
            onClick={() => setCrewStatusNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTENT GRID ── */}
      <main
        style={{
          flex: 1,
          padding: '16px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 16,
        }}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN (Cols 1-5): LOCAL BLACK-BOX SSD & PROTOBUF STREAM
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 1: Local NVMe SSD Buffer Engine */}
          <div
            style={{
              background: '#ffffff',
              border: linkState === 'DOWN' ? '2px solid #ef4444' : '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              position: 'relative',
            }}
          >
            {/* Offline badge tag */}
            {linkState === 'DOWN' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderBottomLeftRadius: 6,
                  letterSpacing: '0.04em',
                }}
              >
                ● LOCAL RING BUFFER LOCKED
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0b3b60' }}>folder_managed</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '-0.01em' }}>
                  LOCAL STORAGE ENGINE
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Path: <code style={{ color: '#0369a1' }}>/data/edge_ring_buffer.db</code> (NVMe RAID-1 SSD)
                </div>
              </div>
            </div>

            {/* Storage Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {/* Buffered Count */}
              <div
                style={{
                  background: linkState === 'DOWN' ? '#fff7ed' : '#f8fafc',
                  border: `1px solid ${linkState === 'DOWN' ? '#fdba74' : '#e2e8f0'}`,
                  borderRadius: 6,
                  padding: '10px 12px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  BUFFERED FRAMES
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: linkState === 'DOWN' ? '#ea580c' : '#15803d',
                    fontFamily: 'monospace',
                    marginTop: 3,
                  }}
                >
                  {edgeBufferCount} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>frames</span>
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 3 }}>
                  10-Hour Circular FIFO (1Hz)
                </div>
              </div>

              {/* Bandwidth Savings */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  BANDWIDTH SAVINGS
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0b3b60', fontFamily: 'monospace', marginTop: 3 }}>
                  94.1% <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>saved</span>
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 3 }}>
                  {kbSaved} KiB saved via Protobuf
                </div>
              </div>
            </div>

            {/* Cryptographic Hash Chain Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '9px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5 }}>
                <span style={{ color: '#0b3b60', fontWeight: 800, letterSpacing: '0.03em', fontSize: 10 }}>
                  CRYPTOGRAPHIC AUDIT CHAIN
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#15803d',
                    fontWeight: 800,
                    background: '#dcfce7',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 9.5,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                  <span>SHA-256 LOCKED</span>
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  padding: '5px 8px',
                  marginTop: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>BLOCK:</span>
                  <code style={{ fontSize: 10.5, color: '#0369a1', fontWeight: 800, fontFamily: 'monospace' }}>
                    {currentHash}
                  </code>
                </div>
                <span style={{ fontSize: 9, color: '#0369a1', fontWeight: 800, background: '#e0f2fe', padding: '1px 5px', borderRadius: 2 }}>
                  LIVE HASH
                </span>
              </div>
              <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 5 }}>
                Station Key: <code style={{ color: '#0b3b60', fontWeight: 600 }}>pub_maitri_9f14b2...valid (Ed25519)</code>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {linkState === 'UP' ? (
                <button
                  onClick={handleSeverLink}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
                    border: '1px solid #7f1d1d',
                    color: '#ffffff',
                    padding: '9px 14px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    boxShadow: '0 2px 6px rgba(185, 28, 28, 0.25)',
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s ease',
                  }}
                  title="Simulate VSAT satellite outage caused by Antarctic storm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>satellite_alt</span>
                  <span>SIMULATE OUTAGE</span>
                </button>
              ) : (
                <button
                  onClick={handleRestoreAndFlush}
                  disabled={isFlushing}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #0b3b60 0%, #0369a1 100%)',
                    border: '1px solid #07253d',
                    color: '#ffffff',
                    padding: '9px 14px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: isFlushing ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    boxShadow: '0 2px 8px rgba(11, 59, 96, 0.3)',
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: isFlushing ? 'spin 1s linear infinite' : 'none' }}>
                    {isFlushing ? 'sync' : 'satellite_alt'}
                  </span>
                  <span>{isFlushing ? 'FLUSHING VIA PROTOBUF...' : 'RESTORE VSAT & FLUSH TO HQ'}</span>
                </button>
              )}
            </div>

            {flushSuccessNotice && (
              <div
                style={{
                  marginTop: 10,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '6px 10px',
                  borderRadius: 4,
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {flushSuccessNotice}
              </div>
            )}
          </div>

          {/* Card 2: Binary Protobuf Inspector (Hex Dump) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 14,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0b3b60', letterSpacing: '0.02em' }}>
                RAW PROTOBUF SERIALIZER (1Hz STREAM)
              </div>
              <span style={{ fontSize: 9.5, color: '#15803d', fontWeight: 800, background: '#dcfce7', padding: '1px 6px', borderRadius: 2 }}>
                17:1 COMPRESSION RATIO
              </span>
            </div>

            {/* Binary Hex Frame Dump */}
            <div
              style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                color: '#38bdf8',
                borderRadius: 6,
                padding: '10px 12px',
                fontSize: 10,
                lineHeight: 1.6,
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: 6,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'ping 2s infinite' }} />
                  <span style={{ color: '#94a3b8', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em' }}>
                    FRAME #08249 • BINARY PROTOBUF
                  </span>
                </div>
                <span style={{ color: '#38bdf8', fontSize: 9.5, fontWeight: 700 }}>
                  52 BYTES (-94.1% vs JSON)
                </span>
              </div>
              <code style={{ wordBreak: 'break-all', letterSpacing: '0.05em' }}>
                08 a4 03 10 9c 01 1a 08 4d 41 49 54 52 49 5f 30 20 d8 01 28 88 02 32 10 70 77 72 2e 64 67 31 2e 63 6f 6f 6c 61 6e 74 38 64 40 c8 01 4a 08 30 78 38 66 33 63
              </code>
            </div>

            {/* Recent Disk Frame Records */}
            <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 800, marginBottom: 6 }}>
              RECENT DISK FRAMES ({recentBufferedFrames.length} captured):
            </div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                padding: 6,
                maxHeight: 140,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {recentBufferedFrames.length === 0 ? (
                <div
                  style={{
                    color: '#64748b',
                    fontSize: 10.5,
                    textAlign: 'center',
                    padding: '12px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#16a34a' }}>check_circle</span>
                  <span>Buffer empty. All frames streaming directly to GSAT-7 carrier.</span>
                </div>
              ) : (
                recentBufferedFrames.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 10,
                      padding: '3px 6px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 3,
                    }}
                  >
                    <span style={{ color: '#ea580c', fontWeight: 800, fontFamily: 'monospace' }}>FRAME #{f.id}</span>
                    <span style={{ color: '#64748b' }}>{f.time}</span>
                    <span style={{ color: '#0369a1', fontFamily: 'monospace' }}>{f.hash}</span>
                    <span style={{ color: '#15803d', fontWeight: 800 }}>{f.bytes} B</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN (Cols 6-12): ANOMALY INJECTOR & SURVIVAL CONTROLS
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 3: Ground-Zero Anomaly Injector Panel */}
          <div
            id="anomaly-injector-section"
            style={{
              background: '#ffffff',
              border: emergencyAlert ? '2px solid #ef4444' : '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 16,
              boxShadow: emergencyAlert ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#dc2626' }}>crisis_alert</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', letterSpacing: '-0.01em' }}>
                    ANOMALY INJECTOR (ON GROUND)
                  </div>
                  {/* <div style={{ fontSize: 10, color: '#64748b' }}>
                    Hardware-layer fault injection & sensor resilience testing
                  </div> */}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {emergencyAlert && (
                  <button
                    onClick={handleClearAnomaly}
                    style={{
                      background: '#15803d',
                      border: '1px solid #166534',
                      color: '#ffffff',
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                    <span>CLEAR ACTIVE HAZARD</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 16,
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  value={hazardSearch}
                  onChange={(e) => setHazardSearch(e.target.value)}
                  placeholder="Search 10 station anomalies (name, code, subsystem, sensor)..."
                  style={{
                    width: '100%',
                    padding: '6px 28px 6px 32px',
                    fontSize: 11,
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                />
                {hazardSearch && (
                  <button
                    onClick={() => setHazardSearch('')}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                )}
              </div>

              {/* Severity Filter Buttons */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => {
                  const isSelected = hazardFilterSev === sev
                  const count = sev === 'ALL' ? HAZARD_PRESETS.length : HAZARD_PRESETS.filter((p) => p.severity === sev).length
                  const bg = isSelected
                    ? sev === 'CRITICAL'
                      ? '#b91c1c'
                      : sev === 'HIGH'
                        ? '#ea580c'
                        : sev === 'MEDIUM'
                          ? '#d97706'
                          : '#0b3b60'
                    : '#f8fafc'
                  const color = isSelected ? '#ffffff' : '#334155'
                  const border = isSelected
                    ? '1px solid transparent'
                    : sev === 'CRITICAL'
                      ? '1px solid #fecaca'
                      : sev === 'HIGH'
                        ? '1px solid #fed7aa'
                        : sev === 'MEDIUM'
                          ? '1px solid #fde68a'
                          : '1px solid #cbd5e1'

                  return (
                    <button
                      key={sev}
                      onClick={() => setHazardFilterSev(sev)}
                      style={{
                        background: bg,
                        color,
                        border,
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 9.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {sev} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Category Dropdown Filter */}
              <select
                value={hazardFilterCat}
                onChange={(e) => setHazardFilterCat(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: 10,
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">ALL CATEGORIES ({HAZARD_PRESETS.length})</option>
                {Array.from(new Set(HAZARD_PRESETS.map((p) => p.category))).sort().map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({HAZARD_PRESETS.filter((p) => p.category === cat).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Status Sub-strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 9.5, color: '#64748b' }}>
              <span>
                <strong>{filteredPresets.length}</strong> of <strong>{HAZARD_PRESETS.length}</strong> anomalies available
              </span>
              <span style={{ color: '#0369a1', fontWeight: 700 }}>
                Selected: {activePreset.name} ({activePreset.code})
              </span>
            </div>

            {/* All Hazard Preset Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 10,
                marginBottom: 12,
                maxHeight: 440,
                overflowY: 'auto',
                padding: '2px',
              }}
            >
              {filteredPresets.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '36px 12px', color: '#64748b', fontSize: 11 }}>
                  No anomalies match the current search or filters. Click 'ALL' to view all anomalies.
                </div>
              ) : (
                filteredPresets.map((a) => {
                  const isSelected = activePreset.id === a.id
                  const isActive = Boolean(
                    (activeAnomaly && activeAnomaly.anomaly_id === a.id) ||
                    (emergencyAlert && emergencyAlert.anomaly_id === a.id) ||
                    (lastAnomalyResult && !lastAnomalyResult.consoleEnded && lastAnomalyResult.anomaly_id === a.id)
                  )
                  const sev = getSevStyle(a.severity)

                  return (
                    <div
                      key={a.id}
                      onClick={() => setActivePreset(a)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setActivePreset(a)}
                      style={{
                        border: isActive
                          ? '2px solid #ef4444'
                          : isSelected
                            ? `2px solid ${sev.badge}`
                            : '1px solid #e2e8f0',
                        background: isActive ? '#fff1f2' : '#ffffff',
                        borderRadius: 8,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isActive
                          ? '0 0 16px rgba(239, 68, 68, 0.25)'
                          : isSelected
                            ? `0 0 0 2px ${sev.badge}22, 0 4px 12px rgba(15, 23, 42, 0.08)`
                            : '0 1px 3px rgba(15, 23, 42, 0.03)',
                        outline: 'none',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 104,
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected && !isActive) {
                          const el = e.currentTarget as HTMLElement
                          el.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.08)'
                          el.style.borderColor = '#cbd5e1'
                          el.style.transform = 'translateY(-1px)'
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected && !isActive) {
                          const el = e.currentTarget as HTMLElement
                          el.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.03)'
                          el.style.borderColor = '#e2e8f0'
                          el.style.transform = 'none'
                        }
                      }}
                    >
                      {/* Top Section: Icon, Anomaly Name, Code & Severity Badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: sev.bg,
                              border: `1px solid ${sev.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: sev.color }}>
                              {a.icon}
                            </span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 800,
                                color: '#0f172a',
                                lineHeight: 1.25,
                                letterSpacing: '-0.01em',
                              }}
                              title={a.name}
                            >
                              {a.name}
                            </div>
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                              }}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#475569' }}>{a.code}</span>
                              <span>•</span>
                              <span style={{ color: sev.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.category}</span>
                            </div>
                          </div>
                        </div>

                        {/* Severity Badge */}
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            padding: '2px 7px',
                            background: sev.badge,
                            color: '#ffffff',
                            borderRadius: 10,
                            letterSpacing: '0.04em',
                            flexShrink: 0,
                            boxShadow: `0 1px 3px ${sev.badge}30`,
                          }}
                        >
                          {a.severity}
                        </span>
                      </div>

                      {/* Middle: Sensor Impact Preview */}
                      <div
                        style={{
                          fontSize: 9.5,
                          color: '#64748b',
                          margin: '8px 0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#f8fafc',
                          padding: '3px 6px',
                          borderRadius: 3,
                          border: '1px solid #f1f5f9',
                          overflow: 'hidden',
                        }}
                        title={a.localImpact}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>sensors</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.sensorsAffected.slice(0, 2).join(' • ')}
                        </span>
                      </div>

                      {/* Bottom Status Row with Direct Inject Button */}
                      <div
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 9.5,
                        }}
                      >
                        <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>timer</span>
                          <span>~{a.estimated_duration_s ?? 4}s duration</span>
                        </div>

                        {isActive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleClearAnomaly()
                            }}
                            style={{
                              background: '#dc2626',
                              border: '1px solid #b91c1c',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
                              animation: 'pulse 1.5s infinite',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>stop_circle</span>
                            <span>STOP FAULT</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActivePreset(a)
                              handleInjectPreset(a)
                            }}
                            style={{
                              background: isSelected ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : '#fef2f2',
                              border: isSelected ? '1px solid #991b1b' : '1px solid #fecaca',
                              color: isSelected ? '#ffffff' : '#b91c1c',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: isSelected ? '0 2px 5px rgba(220, 38, 38, 0.3)' : '0 1px 2px rgba(220, 38, 38, 0.08)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dc2626'
                              e.currentTarget.style.color = '#ffffff'
                              e.currentTarget.style.borderColor = '#b91c1c'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#fef2f2'
                                e.currentTarget.style.color = '#b91c1c'
                                e.currentTarget.style.borderColor = '#fecaca'
                              }
                            }}
                            title={`Simulate ${a.name} hardware fault`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
                            <span>INJECT FAULT</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Active Anomaly Notification & Direct Stop Control */}
            {Boolean(activeAnomaly || (lastAnomalyResult && !lastAnomalyResult.consoleEnded) || emergencyAlert) && (() => {
              const currentActive = activeAnomaly || (lastAnomalyResult && !lastAnomalyResult.consoleEnded ? lastAnomalyResult : null) || emergencyAlert
              if (!currentActive) return null

              return (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #ef4444',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#dc2626' }}>emergency</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>ACTIVE ANOMALY: {currentActive.anomaly_name}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            padding: '1px 6px',
                            borderRadius: 3,
                          }}
                        >
                          SIMULATING
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#7f1d1d', marginTop: 2 }}>
                        Station telemetry reflecting active fault. Click button to end anomaly and restore nominal baseline.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleClearAnomaly}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: '0.03em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>stop_circle</span>
                    <span>STOP / END ANOMALY</span>
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Card 4: On-Ice Survival & Life-Support Systems */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0369a1' }}>shield</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '-0.01em' }}>
                    ON-ICE SURVIVAL & LIFE-SUPPORT SUBSYSTEMS
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>
                    Critical habitat telemetry & expedition resources
                  </div>
                </div>
              </div>

              <span style={{ fontSize: 10, color: '#047857', fontWeight: 700, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 3 }}>
                ALL SYSTEMS NOMINAL
              </span>
            </div>

            {/* 4 Minimal Subsystem Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {/* Tile 1: Water Line */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#0369a1' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>water_drop</span>
                    <span>Water Supply</span>
                  </span>
                  <button
                    onClick={() => setIsTraceHeatingOn((v) => !v)}
                    title="Click to toggle trace heating on/off"
                    style={{
                      fontSize: 9.5,
                      background: isTraceHeatingOn ? '#dcfce7' : '#fee2e2',
                      color: isTraceHeatingOn ? '#166534' : '#991b1b',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isTraceHeatingOn ? 'HEAT ON' : 'HEAT OFF'}
                  </button>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  14,200 L <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>(71% Melt)</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Line Temp: <strong style={{ color: '#15803d' }}>+4.2°C</strong> • Flow: <strong>28.4 L/m</strong>
                </div>
              </div>

              {/* Tile 2: Power Gen */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#c2410c' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                    <span>Power Generation</span>
                  </span>
                  <button
                    onClick={() => setActiveGenerator((g) => (g === 'DG1' ? 'DG2' : g === 'DG2' ? 'DG3' : 'DG1'))}
                    title="Click to switch generator (DG1 / DG2 / DG3)"
                    style={{
                      fontSize: 9.5,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ACTIVE: {activeGenerator}
                  </button>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  84.2 kW <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>(70% Load)</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Fuel Reserve: <strong style={{ color: '#15803d' }}>142,000 L</strong> • <strong>50 Hz</strong>
                </div>
              </div>

              {/* Tile 3: Habitat Thermal */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#be185d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>thermostat</span>
                    <span>Habitat Thermal</span>
                  </span>
                  <span style={{ fontSize: 9.5, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                    BOILER #2
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>
                  +21.4°C <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>(Indoor)</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Outside: <strong style={{ color: '#0284c7' }}>-31.8°C</strong> • Glycol: <strong>68.5°C</strong>
                </div>
              </div>

              {/* Tile 4: Crew & Life Support */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#7e22ce' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>groups</span>
                    <span>Station Crew</span>
                  </span>
                  <span style={{ fontSize: 9.5, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                    O₂: 20.9%
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  25 on Ice <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>(All Healthy)</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Rations: <strong style={{ color: '#15803d' }}>184 Days</strong> • CO₂: <strong>420 ppm</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── TIER 4: OFFICIAL GOI & NCPOR FOOTER ── */}
      <footer
        style={{
          background: '#0b3b60',
          color: '#ffffff',
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div className="tricolour-bottom" />

        {/* Quick Links */}
        <div
          style={{
            background: '#082842',
            borderBottom: '1px solid #0f3d63',
            padding: '6px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 10.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ffedd5', fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ffedd5' }}>link</span>
            <span>Official Government Portals:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a href="https://www.moes.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              Ministry of Earth Sciences (MoES)
            </a>
            <a href="https://ncpor.res.in" target="_blank" rel="noopener noreferrer" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              NCPOR Polar Research
            </a>
            <a href="https://mausam.imd.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              IMD Mausam
            </a>
            <a href="https://www.digitalindia.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              Digital India
            </a>
          </div>
        </div>

        {/* Copyright & Technical Ownership */}
        <div
          style={{
            background: '#072138',
            padding: '8px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 10,
            color: '#cbd5e1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/ncpor_logo.png" alt="NCPOR Logo" style={{ height: 26, width: 26, objectFit: 'contain' }} />
            <div>
              <span style={{ fontWeight: 800, color: '#ffffff' }}>
                © 2026 राष्ट्रीय ध्रुवीय एवं समुद्री अनुसंधान केंद्र (NCPOR)
              </span>
              <span style={{ color: '#64748b', margin: '0 6px' }}>|</span>
              <span>पृथ्वी विज्ञान मंत्रालय, भारत सरकार</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#86efac', fontWeight: 800 }}>● LAN 192.168.1.10 ONLINE</span>
            <span>•</span>
            <span>Himantar Dual-Twin v3.02</span>
            <span>•</span>
            {/* <span style={{ background: '#0b3b60', color: '#ff9933', padding: '1px 6px', borderRadius: 2, fontWeight: 800, border: '1px solid #1e3a5f' }}>
              GIGW 3.0 VERIFIED
            </span> */}
          </div>
        </div>
      </footer>
    </div>
  )
}
