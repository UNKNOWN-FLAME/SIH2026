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
import EmergencyWarningModal from '../components/dashboard/EmergencyWarningModal'
import ActiveAnomalyBanner from '../components/dashboard/ActiveAnomalyBanner'
import IncidentImpactModal from '../components/dashboard/IncidentImpactModal'
import BlackoutSyncReportModal from '../components/dashboard/BlackoutSyncReportModal'
import OfflineBlackoutAuditCard from '../components/dashboard/OfflineBlackoutAuditCard'
import GovtTelemetrySyncBanner from '../components/dashboard/GovtTelemetrySyncBanner'
import LiveImpactSideTab from '../components/dashboard/LiveImpactSideTab'
import { useLanguage } from '../context/LanguageContext'
import { useStation } from '../context/StationContext'

export default function DashboardPage() {
  const {
    stationId: activeStation,
    setStationId: setActiveStation,
    isOnline,
    edgeBufferCount,
    flushEdgeBuffer,
    emergencyAlert,
    dismissEmergencyAlert,
    isImpactModalOpen,
    closeImpactModal,
  } = useStation()
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



            <StationTabs
              active={activeStation}
              onSelect={setActiveStation}
              timeRange={timeRange}
              onTimeRange={setTimeRange}
            />

            {/* Live Active Anomaly Alert & Action Banner */}
            <ActiveAnomalyBanner />

            {/* Live GSAT-7 Government Telemetry Synchronization Banner */}
            <GovtTelemetrySyncBanner />

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
                <OfflineBlackoutAuditCard stationId={activeStation} />
              </div>

              {/* ── Operational Grid: Row 2 (3-col balanced cards) ── */}
              <div className="bento-bottom-card">
                <EnergyCard stationId={activeStation} />
              </div>
              <div className="bento-bottom-card">
                <ActiveAlerts key={activeStation} stationId={activeStation} />
              </div>
              <div className="bento-bottom-card">
                <MetMastCard stationId={activeStation} />
              </div>

              {/* ── Scientific & Sensor Grid: Row 3 (2-col wide cards) ── */}
              <div className="bento-bottom-card-half">
                <GlacialCard stationId={activeStation} />
              </div>
              <div className="bento-bottom-card-half">
                <SeismicCard stationId={activeStation} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <Footer />
      <EmergencyWarningModal alert={emergencyAlert} onClose={dismissEmergencyAlert} />
      <IncidentImpactModal isOpen={isImpactModalOpen} onClose={closeImpactModal} />
      <BlackoutSyncReportModal />
      <LiveImpactSideTab />
    </div>
  )
}
