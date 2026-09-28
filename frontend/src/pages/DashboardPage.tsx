import { useState } from 'react'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import StationTabs from '../components/dashboard/StationTabs'
import SchematicPanel from '../components/dashboard/SchematicPanel'
import WeatherCard from '../components/dashboard/WeatherCard'
import EnergyCard from '../components/dashboard/EnergyCard'
import ActiveAlerts from '../components/dashboard/ActiveAlerts'
import MetMastCard from '../components/dashboard/MetMastCard'
import GlacialCard from '../components/dashboard/GlacialCard'
import SeismicCard from '../components/dashboard/SeismicCard'
import GroundLinkCard from '../components/dashboard/GroundLinkCard'
import AnomalyInjector from '../components/dashboard/AnomalyInjector'
import { useLanguage } from '../context/LanguageContext'
import { useStation } from '../context/StationContext'

export default function DashboardPage() {
  const { stationId: activeStation, setStationId: setActiveStation, isOnline, edgeBufferCount, flushEdgeBuffer } = useStation()
  const [timeRange, setTimeRange] = useState<string>('1H')
  const { t } = useLanguage()

  function toggleStation() {
    setActiveStation(activeStation === 'maitri' ? 'bharati' : 'maitri')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={toggleStation} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '8px 12px 20px 12px' }}>
            {/* Official Government Breadcrumbs Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10.5,
                color: '#64748b',
                marginBottom: 8,
                padding: '4px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#0b3b60' }}>home</span>
                <span style={{ color: '#0b3b60', fontWeight: 700 }}>{t('crumb.home')}</span>
                <span>&gt;</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
                <span>&gt;</span>
                <span style={{ color: '#0b3b60', fontWeight: 800 }}>{t('crumb.twin')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isOnline ? (
                  <span style={{ fontSize: 9.5, color: '#15803d', background: '#dcfce7', padding: '2px 8px', fontWeight: 800, border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    🟢 VSAT UPLINK LIVE (CONNECTED)
                  </span>
                ) : (
                  <span style={{ fontSize: 9.5, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', fontWeight: 900, border: '1px solid #fca5a5', borderRadius: 2 }}>
                    🔴 VSAT SEVERED • EDGE BUFFER ACTIVE ({edgeBufferCount} FRAMES)
                  </span>
                )}
              </div>
            </div>

            {/* Offline Edge Buffer Warning Banner if VSAT link is severed */}
            {!isOnline && (
              <div
                style={{
                  background: 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 100%)',
                  border: '1px solid #ef4444',
                  color: '#ffffff',
                  padding: '10px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  borderRadius: 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#fca5a5', animation: 'pulse 1.5s infinite' }}>
                    satellite_alt
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.02em' }}>
                      AUTONOMOUS EDGE MODE ACTIVE: VSAT SATELLITE LINK SEVERED
                    </div>
                    <div style={{ fontSize: 10.5, color: '#fee2e2', marginTop: 1 }}>
                      Live telemetry transmission halted. Telemetry & sensor readings are currently diverted to local <strong>Edge Black Box Ring Buffer ({edgeBufferCount} frames stored with SHA-256 hash chains)</strong>.
                    </div>
                  </div>
                </div>
                <button
                  onClick={flushEdgeBuffer}
                  style={{
                    background: '#ffffff',
                    border: 'none',
                    color: '#991b1b',
                    fontWeight: 900,
                    fontSize: 11,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
                  RESTORE LINK & SYNC TO HQ
                </button>
              </div>
            )}

            {/* ── ANOMALY INJECTION BANNER ─────────────────────────────── */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
                border: '1px solid #4338ca',
                borderLeft: '5px solid #dc2626',
                padding: '12px 18px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
                boxShadow: '0 4px 16px rgba(220, 38, 38, 0.18)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle pattern overlay */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '18px 18px', pointerEvents: 'none' }} />

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                  <span style={{ fontSize: 22 }}>🧪</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
                      ANOMALY SIMULATION MODULE
                    </div>
                    <div style={{ fontSize: 10, color: '#a5b4fc', marginTop: 1 }}>
                      Stress-test station resilience by injecting simulated environmental and system anomalies
                      to validate sensor response, data integrity, and failover protocols.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {['Blizzard', 'Earthquake', 'Generator Failure', 'Sensor Outage', 'VSAT Loss', '+7 more'].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.1)',
                        color: '#c7d2fe',
                        padding: '2px 7px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 3,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <AnomalyInjector activeStation={activeStation} />
              </div>
            </div>

            <StationTabs
              active={activeStation}
              onSelect={setActiveStation}
              timeRange={timeRange}
              onTimeRange={setTimeRange}
            />

            {/* Bento Grid */}
            <div className="bento-grid">
              {/* ── Centre: Schematic (responsive cols) ── */}
              <div className="bento-schematic">
                <SchematicPanel stationId={activeStation} />
              </div>

              {/* ── Right: Stacked cards (responsive cols) ── */}
              <div className="bento-side-stack">
                <GroundLinkCard stationId={activeStation} />
                <WeatherCard stationId={activeStation} />
                <EnergyCard stationId={activeStation} />
                <ActiveAlerts key={activeStation} stationId={activeStation} />
              </div>

              {/* ── Bottom Row ── */}
              <div className="bento-bottom-card">
                <MetMastCard stationId={activeStation} />
              </div>
              <div className="bento-bottom-card">
                <GlacialCard stationId={activeStation} />
              </div>
              <div className="bento-bottom-card">
                <SeismicCard stationId={activeStation} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
