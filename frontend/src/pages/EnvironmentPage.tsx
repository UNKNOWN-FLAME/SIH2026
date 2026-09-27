import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useSensors } from '../hooks/useSensors'

type StationId = 'maitri' | 'bharati'
type TabType = 'overview' | 'atmosphere' | 'glaciology' | 'seismic' | 'ocean'
type MetricView = 'temp_wind' | 'pressure' | 'humidity' | 'solar'

const STATIONS: Record<StationId, { name: string; coords: string; elevation: string; region: string; type: string }> = {
  maitri: {
    name: 'Maitri Research Station',
    coords: '70°45′S, 11°44′E',
    elevation: '130m ASL',
    region: 'Schirmacher Oasis, Queen Maud Land',
    type: 'Inland Oasis Valley (Dry Rock / Ice Edge)',
  },
  bharati: {
    name: 'Bharati Research Station',
    coords: '69°24′S, 76°11′E',
    elevation: '35m ASL',
    region: 'Larsemann Hills, Prydz Bay',
    type: 'Coastal Promontory (Oceanic Fast-Ice)',
  },
}

type SensorRow = { sensor_id: string; latest_value: number | null }

function sv(sensors: SensorRow[] | undefined, keyword: string, fallback: number): number {
  if (!sensors) return fallback
  const found = sensors.find((x) => x.sensor_id.toLowerCase().includes(keyword.toLowerCase()))
  return found?.latest_value ?? fallback
}

function fmt(v: number | null | undefined, decimals = 1, fallback = '—'): string {
  if (v === null || v === undefined || isNaN(v)) return fallback
  return v.toFixed(decimals)
}

// Calculate Antarctic Wind Chill Temperature (WMO formula)
function computeWindChill(tempC: number, windKmh: number): number {
  if (windKmh < 5) return tempC
  return 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16)
}

function MetCard({
  label,
  value,
  unit,
  icon,
  color,
  sub,
  secondary,
}: {
  label: string
  value: string | number
  unit: string
  icon: string
  color: string
  sub?: string
  secondary?: string
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 90,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3.5, height: '100%', background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginLeft: 6 }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>
          {icon}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginLeft: 6, margin: '4px 0 2px 6px' }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{value}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{unit}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: 6, fontSize: 9.5 }}>
        {sub && <span style={{ color: '#475569', fontWeight: 600 }}>{sub}</span>}
        {secondary && <span style={{ color, fontWeight: 800 }}>{secondary}</span>}
      </div>
    </div>
  )
}

export default function EnvironmentPage() {
  const navigate = useNavigate()
  const [activeStation, setActiveStation] = useState<StationId>('maitri')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [metricView, setMetricView] = useState<MetricView>('temp_wind')
  const [hoveredHour, setHoveredHour] = useState<number | null>(12)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const svgRef = useRef<SVGSVGElement | null>(null)


  const otherStation: StationId = activeStation === 'maitri' ? 'bharati' : 'maitri'
  const st = STATIONS[activeStation]
  const otherSt = STATIONS[otherStation]

  // ── Live sensor queries from Backend ──────────────────────────────────────
  const { data: weatherSensors } = useSensors(activeStation, 'weather')
  const { data: seismicSensors } = useSensors(activeStation, 'seismic')
  const { data: oceanSensors } = useSensors(activeStation, 'ocean')
  const { data: glaciologySensors } = useSensors(activeStation, 'glaciology')
  const { data: otherWeather } = useSensors(otherStation, 'weather')

  // Real readings mapped from live database
  const isM = activeStation === 'maitri'
  const temp = sv(weatherSensors, 'temperature', isM ? -15.5 : -12.1)
  const wind = sv(weatherSensors, 'wind_speed', isM ? 26.0 : 19.0)
  const windDir = sv(weatherSensors, 'wind_dir', isM ? 121.0 : 127.0)
  const humidity = sv(weatherSensors, 'humidity', isM ? 48.0 : 49.0)
  const pressure = sv(weatherSensors, 'pressure', isM ? 960.0 : 950.0)
  const snowfall = sv(weatherSensors, 'snowfall', isM ? 0.0 : 0.0)
  const radiation = sv(weatherSensors, 'radiation', isM ? 95.0 : 110.0)
  const seismicPgv = sv(seismicSensors, 'pgv', isM ? 0.12 : 0.08)
  const magnitude = sv(seismicSensors, 'magnitude', isM ? 0.8 : 0.6)
  const iceThickness = sv(glaciologySensors, 'ice_thickness', isM ? 1.85 : 2.15)
  const glacierFlow = sv(glaciologySensors, 'flow_rate', isM ? 1.22 : 0.95)
  const sst = sv(oceanSensors, 'sst', -1.82)
  const oceanSalinity = sv(oceanSensors, 'salinity', 34.65)
  const seaIceExtent = sv(oceanSensors, 'ice_extent', 92.4)
  const waveHeight = sv(oceanSensors, 'wave_height', 4.15)

  // Other station metrics for live comparison
  const otherTemp = sv(otherWeather, 'temperature', isM ? -12.1 : -15.5)
  const otherWind = sv(otherWeather, 'wind_speed', isM ? 19.0 : 26.0)


  // Derived polar physical calculations
  const windChill = computeWindChill(temp, wind)
  const dewPoint = temp - (100 - humidity) / 5
  const windKnots = wind * 0.539957

  // Blizzard Risk Index: Calculated based on wind speed, temperature, and fresh snowfall
  const blizzardRisk = useMemo(() => {
    if (wind >= 70 || (wind >= 55 && temp <= -25)) {
      return {
        level: 'CRITICAL BLIZZARD',
        color: '#dc2626',
        bg: '#fef2f2',
        border: '#fca5a5',
        icon: 'warning',
        action: 'Level-3 Blizzard Lockdown: All outdoor travel suspended. Lifeline tethers armed.',
        frostbiteMin: '< 5 min',
      }
    }
    if (wind >= 50 || temp <= -32) {
      return {
        level: 'HIGH WIND / SEVERE COLD',
        color: '#ea580c',
        bg: '#fff7ed',
        border: '#fdba74',
        icon: 'air',
        action: 'Katabatic Surge Advisory: Dual-person tethered teams only. GPS beacons required.',
        frostbiteMin: '10-15 min',
      }
    }
    if (wind >= 35) {
      return {
        level: 'MODERATE POLAR BREEZE',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd',
        icon: 'info',
        action: 'Nominal Operations: Full polar thermal suits mandatory for external fieldwork.',
        frostbiteMin: '25-30 min',
      }
    }
    return {
      level: 'CALM / NOMINAL',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      icon: 'check_circle',
      action: 'Clear Polar Skies: Ideal window for solar array servicing and traverse operations.',
      frostbiteMin: '> 45 min',
    }
  }, [wind, temp])

  // Auto-scan playback through the 24 hours
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setHoveredHour((prev) => ((prev ?? 0) + 1) % 24)
    }, 800)
    return () => clearInterval(interval)
  }, [isPlaying])

  // ── 24-Hour Diurnal Curve (Multi-Metric Dynamic Polar Model) ──────────────
  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const hour = (i + 1) % 24
      const tSine = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 2.8
      const wSine = Math.cos(((hour - 4) / 24) * 2 * Math.PI) * 11
      const pSine = Math.sin(((hour - 12) / 24) * 2 * Math.PI) * 4.2
      const hSine = Math.cos(((hour - 6) / 24) * 2 * Math.PI) * 8.5
      const sSine = Math.max(0, Math.sin(((hour - 4) / 16) * Math.PI) * (radiation * 1.35))

      const hTemp = Number((temp + tSine).toFixed(1))
      const hWind = Math.max(14, Number((wind + wSine).toFixed(1)))
      const hGust = Number((hWind * 1.28).toFixed(1))
      const hPres = Number((pressure + pSine).toFixed(1))
      const hHum = Math.min(100, Math.max(20, Number((humidity + hSine).toFixed(1))))
      const hSol = Math.round(sSine)
      const hChill = computeWindChill(hTemp, hWind)

      return {
        hour: `${String(hour).padStart(2, '0')}:00`,
        hourNum: hour,
        temp: hTemp,
        wind: hWind,
        gust: hGust,
        pressure: hPres,
        humidity: hHum,
        solar: hSol,
        chill: hChill,
      }
    })
  }, [temp, wind, pressure, humidity, radiation])

  // SVG Chart bounds
  const minT = Math.min(...hourlyData.map((d) => d.temp)) - 2
  const maxT = Math.max(...hourlyData.map((d) => d.temp)) + 2
  const maxW = Math.max(...hourlyData.map((d) => d.gust)) + 10
  const minP = Math.min(...hourlyData.map((d) => d.pressure)) - 3
  const maxP = Math.max(...hourlyData.map((d) => d.pressure)) + 3
  const minH = Math.max(0, Math.min(...hourlyData.map((d) => d.humidity)) - 5)
  const maxH = Math.min(100, Math.max(...hourlyData.map((d) => d.humidity)) + 5)
  const maxS = Math.max(10, ...hourlyData.map((d) => d.solar)) + 20

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const idx = Math.min(23, Math.max(0, Math.round(xRatio * 23)))
    setHoveredHour(idx)
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Met Overview', icon: 'thermostat' },
    { id: 'atmosphere', label: 'Atmosphere', icon: 'air' },
    { id: 'glaciology', label: 'Glaciology', icon: 'ac_unit' },
    { id: 'seismic', label: 'Seismic & Geophysics', icon: 'vibration' },
    { id: 'ocean', label: 'Ocean & Ice', icon: 'waves' },
  ]


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation((s) => (s === 'maitri' ? 'bharati' : 'maitri'))} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            {/* Government Breadcrumb Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10.5,
                color: '#64748b',
                marginBottom: 8,
                padding: '5px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#0b3b60' }}>
                  home
                </span>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 10.5 }}
                >
                  Home
                </button>
                <span>›</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>Scientific Observatories</span>
                <span>›</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>Polar Meteorological & Environment Center</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 9.5,
                    color: '#15803d',
                    fontWeight: 800,
                    background: '#f0fdf4',
                    padding: '2px 8px',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                  IMD AUTO SENSORS LIVE (1 Hz)
                </span>
              </div>
            </div>

            {/* Station Selector & Meteorological Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0b3b60 0%, #1a5276 100%)',
                color: '#ffffff',
                padding: '10px 16px',
                marginBottom: 8,
                borderBottom: '3px solid #ff9933',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.04em' }}>
                    ❄️ {st.name.toUpperCase()} — POLAR ENVIRONMENTAL DIGITAL TWIN
                  </span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      padding: '1px 6px',
                      borderRadius: 2,
                      fontSize: 9.5,
                      fontFamily: 'monospace',
                      color: '#ff9933',
                      fontWeight: 800,
                    }}
                  >
                    WMO-ANT-{isM ? '89001' : '89002'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                  {st.coords} • Elevation: <strong style={{ color: '#ffffff' }}>{st.elevation}</strong> • {st.region}
                </div>
              </div>

              {/* Station Toggle & Comparative Insights */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Micro Comparative Status */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '4px 8px',
                    fontSize: 9.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>{otherSt.name.split(' ')[0]}:</span>
                  <strong style={{ color: '#38bdf8' }}>{fmt(otherTemp)}°C</strong>
                  <span style={{ color: '#cbd5e1' }}>💨 {fmt(otherWind, 0)} km/h</span>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  {(['maitri', 'bharati'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveStation(s)}
                      style={{
                        background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)',
                        border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.2)',
                        color: activeStation === s ? '#0b3b60' : '#ffffff',
                        padding: '4px 14px',
                        fontWeight: 900,
                        fontSize: 10.5,
                        cursor: 'pointer',
                        borderRadius: 2,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '2px solid #cbd5e1',
                marginBottom: 10,
                background: '#ffffff',
                padding: '0 8px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '8px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: activeTab === tab.id ? 800 : 600,
                    color: activeTab === tab.id ? '#0b3b60' : '#64748b',
                    fontSize: 11,
                    borderBottom: activeTab === tab.id ? '2px solid #0b3b60' : '2px solid transparent',
                    marginBottom: -2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                TAB 1: METEOROLOGICAL OVERVIEW (MAIN REAL-TIME WEATHER HUB)
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Extreme Weather & Blizzard Warning Strip (Dynamic Alert) */}
                <div
                  style={{
                    background: blizzardRisk.bg,
                    border: `1px solid ${blizzardRisk.border}`,
                    borderLeft: `4px solid ${blizzardRisk.color}`,
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: blizzardRisk.color, fontSize: 20 }}>
                      {blizzardRisk.icon}
                    </span>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 900, color: blizzardRisk.color, textTransform: 'uppercase' }}>
                        {blizzardRisk.level} • {activeStation.toUpperCase()} AIRSPACE:
                      </span>{' '}
                      <span style={{ fontSize: 10.5, color: '#334155', fontWeight: 600 }}>{blizzardRisk.action}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Frostbite Window: </span>
                      <strong style={{ color: blizzardRisk.color }}>{blizzardRisk.frostbiteMin}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Wind Chill: </span>
                      <strong style={{ color: '#0f172a' }}>{fmt(windChill)}°C</strong>
                    </div>
                  </div>
                </div>

                {/* 8 Primary Live Meteorological Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard
                    label="Air Temperature"
                    value={fmt(temp)}
                    unit="°C"
                    icon="thermostat"
                    color="#3b82f6"
                    sub="2m Surface Sensor"
                    secondary={`Chill: ${fmt(windChill)}°C`}
                  />
                  <MetCard
                    label="Wind Velocity"
                    value={fmt(wind)}
                    unit="km/h"
                    icon="air"
                    color="#0b3b60"
                    sub={`Azimuth: ${Math.round(windDir)}° Katabatic`}
                    secondary={`${fmt(windKnots, 0)} knots`}
                  />
                  <MetCard
                    label="Relative Humidity"
                    value={fmt(humidity, 0)}
                    unit="%"
                    icon="water_drop"
                    color="#06b6d4"
                    sub="Vaisala Capacitive Sensor"
                    secondary={`Dew: ${fmt(dewPoint)}°C`}
                  />
                  <MetCard
                    label="Barometric Pressure"
                    value={fmt(pressure, 1)}
                    unit="hPa"
                    icon="compress"
                    color="#ea580c"
                    sub="Digital Quartz Barometer"
                    secondary={pressure < 985 ? 'Low Polar Trough' : 'Stable Margin'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard
                    label="Solar Irradiance"
                    value={fmt(radiation, 0)}
                    unit="W/m²"
                    icon="light_mode"
                    color="#eab308"
                    sub="Kipp & Zonen Pyranometer"
                    secondary="Polar Summer Flux"
                  />
                  <MetCard
                    label="Snowfall Accumulation"
                    value={fmt(snowfall, 1)}
                    unit="mm/h"
                    icon="ac_unit"
                    color="#0284c7"
                    sub="Optical Laser Disdrometer"
                    secondary="Drift Rate: Active"
                  />
                  <MetCard
                    label="Seismic Ground Velocity"
                    value={fmt(seismicPgv, 3)}
                    unit="mm/s"
                    icon="vibration"
                    color="#7c3aed"
                    sub="Broadband Seismometer"
                    secondary={`Local Quake: M${fmt(magnitude, 1)}`}
                  />
                  <MetCard
                    label="Ice Sheet Thickness"
                    value={fmt(iceThickness, 2)}
                    unit="m"
                    icon="layers"
                    color="#10b981"
                    sub="Ground Penetrating Radar"
                    secondary={`Retreat: ${fmt(glacierFlow, 1)} m/yr`}
                  />
                </div>

                {/* 24-Hour Interactive Meteorological Diurnal Cycle */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '12px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Top Controls & Metric Toggle Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284c7' }}>
                          show_chart
                        </span>
                        24-HOUR INTERACTIVE POLAR DIURNAL CYCLE
                      </div>
                      <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1 }}>
                        Continuous hourly micro-physics • Scrub across timeline or switch telemetry parameter
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* Metric Selectors */}
                      {(
                        [
                          { id: 'temp_wind', label: '🌡️ Temp & Gusts', color: '#0284c7' },
                          { id: 'pressure', label: '⏱️ Pressure', color: '#6366f1' },
                          { id: 'humidity', label: '💧 Humidity', color: '#0891b2' },
                          { id: 'solar', label: '☀️ Solar Flux', color: '#d97706' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMetricView(m.id)}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 9px',
                            background: metricView === m.id ? '#0b3b60' : '#ffffff',
                            color: metricView === m.id ? '#ffffff' : '#334155',
                            border: `1.5px solid ${metricView === m.id ? '#0b3b60' : '#cbd5e1'}`,
                            cursor: 'pointer',
                            borderRadius: 2,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {m.label}
                        </button>
                      ))}

                      {/* Auto-Scan Button */}
                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 10px',
                          background: isPlaying ? '#fef3c7' : '#f0fdf4',
                          color: isPlaying ? '#92400e' : '#15803d',
                          border: `1.5px solid ${isPlaying ? '#fde68a' : '#bbf7d0'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 2,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                        {isPlaying ? 'Scanning' : 'Auto-Scan'}
                      </button>
                    </div>
                  </div>

                  {/* 24-Hour Statistical Summary Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 8,
                      padding: '6px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      marginBottom: 10,
                      fontSize: 10,
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b' }}>24h Low Temp: </span>
                      <strong style={{ color: '#0284c7' }}>{minT.toFixed(1)}°C</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>24h Peak Temp: </span>
                      <strong style={{ color: '#0369a1' }}>{maxT.toFixed(1)}°C</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Peak Katabatic Gust: </span>
                      <strong style={{ color: '#ea580c' }}>{Math.max(...hourlyData.map((d) => d.gust))} km/h</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Mean Pressure: </span>
                      <strong style={{ color: '#4f46e5' }}>{pressure.toFixed(1)} hPa</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Peak Irradiance: </span>
                      <strong style={{ color: '#d97706' }}>{Math.max(...hourlyData.map((d) => d.solar))} W/m²</strong>
                    </div>
                  </div>

                  {/* Interactive SVG Trend Curve with Mouse Crosshair Tracking */}
                  <div style={{ flex: 1, minHeight: 180, position: 'relative' }}>
                    <svg
                      ref={svgRef}
                      width="100%"
                      height="160"
                      viewBox="0 0 900 160"
                      preserveAspectRatio="none"
                      onMouseMove={handleSvgMouseMove}
                      onMouseLeave={() => !isPlaying && setHoveredHour(12)}
                      style={{ overflow: 'visible', cursor: 'crosshair' }}
                    >
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[30, 65, 100, 135].map((y) => (
                        <line key={y} x1="0" y1={y} x2="900" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      ))}

                      {/* 1. Temp & Wind View */}
                      {metricView === 'temp_wind' && (
                        <>
                          <path
                            d={`M 0,160 ${hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.temp - minT) / (maxT - minT)) * 110
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')} L 900,160 Z`}
                            fill="url(#tempGradient)"
                          />
                          <polyline
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.temp - minT) / (maxT - minT)) * 110
                                return `${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')}
                          />
                          <polyline
                            fill="none"
                            stroke="#ea580c"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                            points={hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 150 - (d.gust / maxW) * 110
                                return `${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')}
                          />
                        </>
                      )}

                      {/* 2. Barometric Pressure View */}
                      {metricView === 'pressure' && (
                        <>
                          <path
                            d={`M 0,160 ${hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.pressure - minP) / (maxP - minP)) * 110
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')} L 900,160 Z`}
                            fill="url(#pressureGradient)"
                          />
                          <polyline
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.pressure - minP) / (maxP - minP)) * 110
                                return `${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')}
                          />
                        </>
                      )}

                      {/* 3. Humidity View */}
                      {metricView === 'humidity' && (
                        <>
                          <path
                            d={`M 0,160 ${hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.humidity - minH) / (maxH - minH)) * 110
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')} L 900,160 Z`}
                            fill="url(#humidityGradient)"
                          />
                          <polyline
                            fill="none"
                            stroke="#0891b2"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 140 - ((d.humidity - minH) / (maxH - minH)) * 110
                                return `${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')}
                          />
                        </>
                      )}

                      {/* 4. Solar Radiation View */}
                      {metricView === 'solar' && (
                        <>
                          <path
                            d={`M 0,160 ${hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 150 - (d.solar / maxS) * 125
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')} L 900,160 Z`}
                            fill="url(#solarGradient)"
                          />
                          <polyline
                            fill="none"
                            stroke="#d97706"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hourlyData
                              .map((d, i) => {
                                const x = (i / 23) * 900
                                const y = 150 - (d.solar / maxS) * 125
                                return `${x.toFixed(1)},${y.toFixed(1)}`
                              })
                              .join(' ')}
                          />
                        </>
                      )}

                      {/* Dynamic Crosshair Guide Line on Cursor */}
                      {hoveredHour !== null && (
                        <>
                          <line
                            x1={(hoveredHour / 23) * 900}
                            y1={10}
                            x2={(hoveredHour / 23) * 900}
                            y2={155}
                            stroke="#0b3b60"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            opacity="0.8"
                          />
                          {/* Pulsing Active Node Circle */}
                          {metricView === 'temp_wind' && (
                            <>
                              <circle
                                cx={(hoveredHour / 23) * 900}
                                cy={140 - ((hourlyData[hoveredHour].temp - minT) / (maxT - minT)) * 110}
                                r="6"
                                fill="#ffffff"
                                stroke="#0284c7"
                                strokeWidth="3"
                              />
                              <circle
                                cx={(hoveredHour / 23) * 900}
                                cy={150 - (hourlyData[hoveredHour].gust / maxW) * 110}
                                r="5"
                                fill="#ffffff"
                                stroke="#ea580c"
                                strokeWidth="2.5"
                              />
                            </>
                          )}
                          {metricView === 'pressure' && (
                            <circle
                              cx={(hoveredHour / 23) * 900}
                              cy={140 - ((hourlyData[hoveredHour].pressure - minP) / (maxP - minP)) * 110}
                              r="6"
                              fill="#ffffff"
                              stroke="#4f46e5"
                              strokeWidth="3"
                            />
                          )}
                          {metricView === 'humidity' && (
                            <circle
                              cx={(hoveredHour / 23) * 900}
                              cy={140 - ((hourlyData[hoveredHour].humidity - minH) / (maxH - minH)) * 110}
                              r="6"
                              fill="#ffffff"
                              stroke="#0891b2"
                              strokeWidth="3"
                            />
                          )}
                          {metricView === 'solar' && (
                            <circle
                              cx={(hoveredHour / 23) * 900}
                              cy={150 - (hourlyData[hoveredHour].solar / maxS) * 125}
                              r="6"
                              fill="#ffffff"
                              stroke="#d97706"
                              strokeWidth="3"
                            />
                          )}
                        </>
                      )}
                    </svg>

                    {/* X-Axis Timeline Labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
                      {hourlyData
                        .filter((_, i) => i % 2 === 0)
                        .map((d, i) => (
                          <span
                            key={d.hour}
                            style={{
                              fontWeight: hoveredHour === i * 2 ? 900 : 500,
                              color: hoveredHour === i * 2 ? '#0b3b60' : '#94a3b8',
                            }}
                          >
                            {d.hour}
                          </span>
                        ))}
                    </div>

                    {/* Interactive Telemetry HUD Inspection Tooltip Bar */}
                    {hoveredHour !== null && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 14px',
                          background: 'linear-gradient(135deg, #0b3b60 0%, #1a5276 100%)',
                          color: '#ffffff',
                          fontSize: 11,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          borderLeft: '4px solid #ff9933',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ff9933' }}>
                            schedule
                          </span>
                          <div>
                            Hour: <strong>{hourlyData[hoveredHour].hour} UTC</strong>
                            <span style={{ fontSize: 9.5, color: '#cbd5e1', marginLeft: 6 }}>
                              ({(hourlyData[hoveredHour].hourNum + 5) % 24}:30 IST)
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div>
                            Temp: <strong style={{ color: '#38bdf8' }}>{hourlyData[hoveredHour].temp}°C</strong>
                            <span style={{ fontSize: 9.5, color: '#e0f2fe', marginLeft: 4 }}>
                              (Chill: {hourlyData[hoveredHour].chill.toFixed(0)}°C)
                            </span>
                          </div>

                          <div>
                            Wind: <strong style={{ color: '#ffffff' }}>{hourlyData[hoveredHour].wind} km/h</strong>
                            <span style={{ color: '#fb923c', marginLeft: 4, fontWeight: 700 }}>
                              💨 Gust: {hourlyData[hoveredHour].gust} km/h
                            </span>
                          </div>

                          <div>
                            Pressure: <strong style={{ color: '#c7d2fe' }}>{hourlyData[hoveredHour].pressure} hPa</strong>
                          </div>

                          <div>
                            Humidity: <strong style={{ color: '#99f6e4' }}>{hourlyData[hoveredHour].humidity}%</strong>
                          </div>

                          <div>
                            Solar: <strong style={{ color: '#fde047' }}>{hourlyData[hoveredHour].solar} W/m²</strong>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            background: hourlyData[hoveredHour].wind > 50 ? '#dc2626' : '#15803d',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: 2,
                          }}
                        >
                          {hourlyData[hoveredHour].wind > 50 ? '⚠️ High Katabatic Wind' : '● Operational Window Nominal'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-Time Operational Field Advisories (Bottom Strip) */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderTop: '2px solid #0b3b60',
                    padding: '10px 14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 10,
                  }}
                >
                  <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>🚜 OUTDOOR TRAVERSES</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: wind > 60 ? '#dc2626' : '#16a34a', marginTop: 2 }}>
                      {wind > 60 ? 'RESTRICTED / CODE RED' : 'PERMITTED (TETHER ON)'}
                    </div>
                    <div style={{ fontSize: 8.5, color: '#64748b' }}>PistenBully Snowcat ready</div>
                  </div>
                  <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>🚁 POLAR HELI-SORTIES</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: wind > 45 ? '#ea580c' : '#16a34a', marginTop: 2 }}>
                      {wind > 45 ? 'GROUNDED (KATABATIC)' : 'CLEAR FLIGHT CORRIDOR'}
                    </div>
                    <div style={{ fontSize: 8.5, color: '#64748b' }}>ALH Dhruv Polar Helipad</div>
                  </div>
                  <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>📡 HF/VHF RADIO FLUTTER</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>STABLE PROPAGATION</div>
                    <div style={{ fontSize: 8.5, color: '#64748b' }}>Auroral Absorption: Minimal</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>☀️ POLAR DAY / TWILIGHT</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', marginTop: 2 }}>24-HOUR SUNLIGHT</div>
                    <div style={{ fontSize: 8.5, color: '#64748b' }}>Midnight Solar Array Active</div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 2: ATMOSPHERE & RADIOSONDE SOUNDING
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'atmosphere' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard label="OZONE COLUMN" value="287" unit="DU" icon="layers" color="#7c3aed" sub="Dobson Units — NOAA Polar" />
                  <MetCard label="CO₂ LEVEL" value="412" unit="ppm" icon="co2" color="#16a34a" sub="Mauna Loa Ref: 421 ppm" />
                  <MetCard label="SOLAR RADIATION" value={fmt(radiation, 0)} unit="W/m²" icon="wb_sunny" color="#f59e0b" sub="Global horizontal flux" />
                  <MetCard label="K-INDEX" value="2" unit="(Quiet)" icon="radio" color="#3b82f6" sub="Magnetosphere stability" />
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase' }}>
                      🎈 UPPER AIR SOUNDING PROFILE — IMD WEATHER BALLOON (RADIOSONDE)
                    </div>
                    <span style={{ fontSize: 9.5, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '1px 6px', fontWeight: 700 }}>
                      Ascent 06:00 UTC Synoptic
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, fontSize: 11 }}>
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: 10, padding: '4px 0', borderBottom: '2px solid #0b3b60' }}>
                      ALTITUDE
                    </div>
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: 10, padding: '4px 0', borderBottom: '2px solid #0b3b60' }}>
                      TEMPERATURE
                    </div>
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: 10, padding: '4px 0', borderBottom: '2px solid #0b3b60' }}>
                      WIND VELOCITY
                    </div>
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: 10, padding: '4px 0', borderBottom: '2px solid #0b3b60' }}>
                      PRESSURE
                    </div>
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: 10, padding: '4px 0', borderBottom: '2px solid #0b3b60' }}>
                      HUMIDITY
                    </div>

                    {[
                      { alt: '10,000 m (Stratosphere)', temp: '-56.2°C', wind: '142 km/h WNW', p: '264 hPa', rh: '18%' },
                      { alt: '5,000 m', temp: '-38.7°C', wind: '98 km/h SW', p: '540 hPa', rh: '32%' },
                      { alt: '2,000 m', temp: '-33.1°C', wind: '71 km/h SW', p: '790 hPa', rh: '58%' },
                      { alt: '500 m', temp: '-30.4°C', wind: '54 km/h SSW', p: '920 hPa', rh: '71%' },
                      { alt: 'Surface (AWS Base)', temp: `${fmt(temp)}°C`, wind: `${fmt(wind)} km/h`, p: `${fmt(pressure, 0)} hPa`, rh: `${fmt(humidity, 0)}%` },
                    ].map((l) => [
                      <div key={l.alt + 'a'} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontWeight: 800, color: '#0b3b60', fontSize: 10.5 }}>
                        {l.alt}
                      </div>,
                      <div key={l.alt + 't'} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#0284c7', fontWeight: 800 }}>
                        {l.temp}
                      </div>,
                      <div key={l.alt + 'w'} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700 }}>
                        {l.wind}
                      </div>,
                      <div key={l.alt + 'p'} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                        {l.p}
                      </div>,
                      <div key={l.alt + 'r'} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#06b6d4', fontWeight: 700 }}>
                        {l.rh}
                      </div>,
                    ])}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 3: GLACIOLOGY & CRYOSPHERE
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'glaciology' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard label="ICE THICKNESS" value={fmt(iceThickness, 2)} unit="m" icon="layers" color="#3b82f6" sub="Ground Penetrating Radar" />
                  <MetCard label="GLACIER FLOW RATE" value={fmt(glacierFlow, 2)} unit="m/yr" icon="trending_down" color="#8b5cf6" sub="Retreat velocity" />
                  <MetCard label="SURFACE ALBEDO" value="0.87" unit="" icon="light_mode" color="#f59e0b" sub="Snow surface reflectance" />
                  <MetCard label="SURFACE MASS BALANCE" value="-0.12" unit="m/yr" icon="scale" color="#dc2626" sub="Sublimation loss margin" />
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 12, letterSpacing: '0.04em' }}>
                    🧊 CRYOSPHERE OBSERVATION NETWORK — NCPOR POLAR GLACIOLOGY
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Active Ice Core Sites', value: '3 Boreholes', sub: 'Depths: 12m, 24m, 150m (800yr climate)', icon: 'circle', color: '#16a34a' },
                      { label: 'Permafrost Active Layer', value: '0.42 m', sub: 'Seasonal summer thaw depth', icon: 'terrain', color: '#ea580c' },
                      { label: 'Ice Sheet Surface Velocity', value: `${fmt(glacierFlow, 2)} m/yr`, sub: 'Differential GPS station', icon: 'speed', color: '#3b82f6' },
                      { label: 'NASA ICESat-2 Orbit Pass', value: 'Track 0418', sub: 'Satellite altimeter calibration', icon: 'satellite', color: '#7c3aed' },
                      { label: 'Firn Compaction Density', value: '0.54 g/cm³', sub: 'Sub-surface ice density', icon: 'compress', color: '#0284c7' },
                      { label: 'Crevasse Hazard Index', value: 'LOW RISK', sub: 'Radar scans verified for traverse', icon: 'check_circle', color: '#16a34a' },
                    ].map((item) => (
                      <div key={item.label} style={{ border: '1px solid #e2e8f0', padding: '10px 12px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 22, color: item.color, flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{item.value}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#0b3b60' }}>{item.label}</div>
                          <div style={{ fontSize: 8.5, color: '#64748b' }}>{item.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 4: SEISMIC & MULTI-DEPTH BOREHOLE GROUND TEMPERATURE
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'seismic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Top 4 Seismic KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard
                    label="EARTHQUAKE LEVEL"
                    value={magnitude > 2.0 ? `M${fmt(magnitude, 1)}` : 'Quiet'}
                    unit={magnitude > 2.0 ? 'ML' : ''}
                    icon="vibration"
                    color="#16a34a"
                    sub="No tremors detected in 72h"
                  />
                  <MetCard
                    label="GROUND VIBRATION"
                    value={fmt(seismicPgv, 3)}
                    unit="mm/s"
                    icon="waves"
                    color="#0284c7"
                    sub="Normal background vibration"
                  />
                  <MetCard
                    label="LOCAL GRAVITY"
                    value="-18.4"
                    unit="mGal"
                    icon="swap_vert"
                    color="#7c3aed"
                    sub="Natural polar gravity level"
                  />
                  <MetCard
                    label="COMPASS OFFSET"
                    value="27.3°"
                    unit="East"
                    icon="explore"
                    color="#ea580c"
                    sub="Difference from true North"
                  />
                </div>

                {/* Underground Ice & Ground Temperature Profile Container */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  {/* Banner Header Strip */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #0b3b60 0%, #1a5276 100%)',
                      borderBottom: '2px solid #ff9933',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ff9933' }}>
                          thermostat
                        </span>
                        UNDERGROUND ICE & GROUND TEMPERATURE — {activeStation === 'maitri' ? 'MAITRI BASE (SCHIRMACHER OASIS)' : 'BHARATI BASE (LARSEMANN HILLS)'}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
                        National Centre for Polar and Ocean Research (MoES) • Multi-Depth Cryosphere Monitoring • GIGW 3.0
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          background: 'rgba(255,255,255,0.12)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.2)',
                          padding: '3px 8px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        CONSTANT TEMP: BELOW 11.4 m
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          padding: '3px 8px',
                        }}
                      >
                        • GROUND FULLY FROZEN (STABLE)
                      </span>
                    </div>
                  </div>

                  {/* 6 Multi-Depth Borehole Cards */}
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                      {[
                        { depth: 'Surface (0 m)', temp: '-28.4°C', sub: 'Ground Surface', trend: '• -0.02°C / yr' },
                        { depth: '1.5 m Deep', temp: '-19.8°C', sub: 'Top Soil Layer', trend: '• +0.01°C / yr' },
                        { depth: '5 m Deep', temp: '-14.2°C', sub: 'Frozen Ice & Soil', trend: '• +0.01°C / yr' },
                        { depth: '10 m Deep', temp: '-11.6°C', sub: 'Same Temp Year-Round', trend: '• 0.00°C (Stable)' },
                        { depth: '25 m Deep', temp: '-9.8°C', sub: 'Deep Bedrock Under Ice', trend: '• 0.00°C (Stable)' },
                        { depth: '50 m Deep', temp: '-9.1°C', sub: 'Deep Earth (50m)', trend: '• 0.00°C (Stable)' },
                      ].map((b) => (
                        <div
                          key={b.depth}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            padding: '12px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 118,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 10, color: '#0b3b60', fontWeight: 800, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                              {b.depth}
                            </div>
                            <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', margin: '8px 0 2px', fontFamily: 'Inter, sans-serif' }}>
                              {b.temp}
                            </div>
                            <div style={{ fontSize: 9.5, color: '#64748b' }}>{b.sub}</div>
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#16a34a',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              width: 'fit-content',
                            }}
                          >
                            {b.trend}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Borehole Status Footer Strip */}
                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      padding: '8px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 10,
                      color: '#64748b',
                    }}
                  >
                    <div>
                      Summer Thaw Depth: <strong style={{ color: '#0f172a' }}>0.42 m (Top 42 cm melts in summer)</strong> | Solid Rock Starts At:{' '}
                      <strong style={{ color: '#0f172a' }}>28.5 m deep</strong>
                    </div>
                    <div>
                      Telemetry Interval: <strong style={{ color: '#0f172a' }}>10 mins</strong> • Sensors:{' '}
                      <strong style={{ color: '#16a34a' }}>All 6 Active (Pt100 RTD)</strong> • MoES Verified
                    </div>
                  </div>
                </div>

                {/* Bottom Card: Recent Earthquakes & Ice Tremors */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                    RECENT EARTHQUAKES & ICE TREMORS — SURROUNDING REGION
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Row 1: M2.1 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 900, color: '#ea580c', fontSize: 12 }}>M2.1</span>
                        <span style={{ color: '#334155', fontWeight: 600 }}>640 km NW — Bouvet Island</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ color: '#64748b', fontSize: 10.5 }}>12 km deep</span>
                        <span style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 8px', fontSize: 9.5, fontWeight: 700 }}>
                          Distant Quake
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 10, width: 60, textAlign: 'right' }}>48h ago</span>
                      </div>
                    </div>

                    {/* Row 2: M4.7 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 900, color: '#dc2626', fontSize: 12 }}>M4.7</span>
                        <span style={{ color: '#334155', fontWeight: 600 }}>1,240 km W — Scotia Ridge</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ color: '#64748b', fontSize: 10.5 }}>8 km deep</span>
                        <span style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 8px', fontSize: 9.5, fontWeight: 700 }}>
                          Distant Quake
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 10, width: 60, textAlign: 'right' }}>5 days ago</span>
                      </div>
                    </div>

                    {/* Row 3: M1.4 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#ffffff',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 900, color: '#16a34a', fontSize: 12 }}>M1.4</span>
                        <span style={{ color: '#334155', fontWeight: 600 }}>18 km East — Near station</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ color: '#64748b', fontSize: 10.5 }}>3 km deep</span>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', fontSize: 9.5, fontWeight: 700 }}>
                          Ice Crack
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 10, width: 60, textAlign: 'right' }}>12 days ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 5: SOUTHERN OCEAN & PRYDZ BAY SEA ICE
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'ocean' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <MetCard label="SEA ICE EXTENT" value={fmt(seaIceExtent, 1)} unit="%" icon="waves" color="#06b6d4" sub="Prydz Bay offshore pack" />
                  <MetCard label="OCEAN TEMP (SST)" value={fmt(sst, 2)} unit="°C" icon="thermostat" color="#3b82f6" sub="Sub-freezing polar seawater" />
                  <MetCard label="PRACTICAL SALINITY" value={fmt(oceanSalinity, 1)} unit="PSU" icon="water_drop" color="#7c3aed" sub="CTD sensor calibration" />
                  <MetCard label="SIGNIFICANT WAVE HEIGHT" value={fmt(waveHeight, 1)} unit="m" icon="tsunami" color="#ea580c" sub="Open ocean wave radar" />
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 12, letterSpacing: '0.04em' }}>
                    🌊 SOUTHERN OCEAN ARGO FLOATS & MOORING ARRAY
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { name: 'Argo Float WMO-5906235', lat: '70.1°S', lon: '12.3°E', depth: '1,200m', temp: -1.4, sal: 34.6, status: 'ACTIVE' },
                      { name: 'Argo Float WMO-5906412', lat: '69.8°S', lon: '76.5°E', depth: '2,000m', temp: -1.8, sal: 34.7, status: 'ACTIVE' },
                      { name: 'NCPOR Mooring Array M-03', lat: '70.2°S', lon: '11.9°E', depth: '3,400m', temp: -0.8, sal: 34.9, status: 'ONLINE' },
                    ].map((f) => (
                      <div key={f.name} style={{ border: '1px solid #e2e8f0', padding: '10px 12px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0b3b60' }}>{f.name}</span>
                          <span style={{ fontSize: 8.5, color: '#16a34a', fontWeight: 800 }}>● {f.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9.5 }}>
                          <div>
                            <span style={{ color: '#94a3b8' }}>Lat: </span>
                            <span style={{ fontWeight: 700 }}>{f.lat}</span>
                          </div>
                          <div>
                            <span style={{ color: '#94a3b8' }}>Lon: </span>
                            <span style={{ fontWeight: 700 }}>{f.lon}</span>
                          </div>
                          <div>
                            <span style={{ color: '#94a3b8' }}>Depth: </span>
                            <span style={{ fontWeight: 700 }}>{f.depth}</span>
                          </div>
                          <div>
                            <span style={{ color: '#94a3b8' }}>Temp: </span>
                            <span style={{ fontWeight: 700, color: '#0284c7' }}>{f.temp}°C</span>
                          </div>
                          <div>
                            <span style={{ color: '#94a3b8' }}>Salinity: </span>
                            <span style={{ fontWeight: 700 }}>{f.sal} PSU</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
