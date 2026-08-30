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

export default function DashboardPage() {
  const [activeStation, setActiveStation] = useState<string>('maitri')
  const [timeRange, setTimeRange] = useState<string>('1H')

  function toggleStation() {
    setActiveStation(s => s === 'maitri' ? 'bharati' : 'maitri')
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeStation={activeStation} onSwitchStation={toggleStation} />

        <main style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#051424' }}>
          <StationTabs
            active={activeStation}
            onSelect={setActiveStation}
            timeRange={timeRange}
            onTimeRange={setTimeRange}
          />

          {/* Bento Grid */}
          <div className="bento-grid" style={{ height: 'calc(100% - 48px)' }}>

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
        </main>
      </div>

      <Footer />
    </div>
  )
}
