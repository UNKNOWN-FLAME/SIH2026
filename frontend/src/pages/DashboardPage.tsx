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
import { useLanguage } from '../context/LanguageContext'

export default function DashboardPage() {
  const [activeStation, setActiveStation] = useState<string>('maitri')
  const [timeRange, setTimeRange] = useState<string>('1H')
  const { t } = useLanguage()

  function toggleStation() {
    setActiveStation(s => s === 'maitri' ? 'bharati' : 'maitri')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={toggleStation} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            {/* Official Government Breadcrumbs Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '5px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
              <span style={{ color: '#0b3b60', fontWeight: 700 }}>{t('crumb.home')}</span>
              <span>&gt;</span>
              <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
              <span>&gt;</span>
              <span style={{ color: '#ea580c', fontWeight: 800 }}>{t('crumb.twin')}</span>
            </div>

            <StationTabs
              active={activeStation}
              onSelect={setActiveStation}
              timeRange={timeRange}
              onTimeRange={setTimeRange}
            />

            {/* Bento Grid */}
            <div className="bento-grid" style={{ minHeight: 'calc(100% - 90px)' }}>

              {/* ── Centre: Schematic (8 col) ── */}
              <SchematicPanel stationId={activeStation} />

              {/* ── Right: Stacked cards (4 col) ── */}
              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <WeatherCard stationId={activeStation} />
                <EnergyCard stationId={activeStation} />
                <ActiveAlerts stationId={activeStation} />
              </div>

              {/* ── Bottom Row (12 col) ── */}
              <MetMastCard stationId={activeStation} />
              <GlacialCard />
              <SeismicCard stationId={activeStation} />

            </div>
          </div>

        </main>
      </div>

      <Footer />
    </div>
  )
}
