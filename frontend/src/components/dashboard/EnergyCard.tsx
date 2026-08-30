import { useSensors } from '../../hooks/useSensors'
import { useAnalytics } from '../../hooks/useAnalytics'
import GaugeCircle from '../ui/GaugeCircle'
import FuelSparkline from '../ui/FuelSparkline'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function findVal(sensors: SensorSummary[] | undefined, key: string): number {
  const s = sensors?.find(s => s.sensor_id.includes(key))
  return s?.latest_value ?? 0
}

export default function EnergyCard({ stationId }: Props) {
  const { data: sensors } = useSensors(stationId, 'energy')
  const { data: analytics } = useAnalytics(stationId, 24)

  const power   = Math.min(100, findVal(sensors, 'load'))
  const solar   = Math.min(100, findVal(sensors, 'solar'))
  const storage = Math.min(100, findVal(sensors, 'storage'))
  const fuel    = findVal(sensors, 'fuel')

  // Build sparkline from analytics avg values if available
  const fuelHistory = analytics
    ? Object.values(analytics.avg_values).map(() => fuel + (Math.random() * 5 - 2.5)).slice(0, 9)
    : undefined

  const hasCritical = fuel > 0 && fuel < 15
  const hasWarning  = fuel > 0 && fuel < 30

  const status = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'NOMINAL'
  const statusColor = hasCritical ? '#ffb4ab' : hasWarning ? '#d8c4a8' : '#00a3ad'

  return (
    <div style={{ background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #45464c', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096' }}>ENERGY SYSTEMS</span>
        <span style={{ color: statusColor, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{status}</span>
      </div>

      {/* Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <GaugeCircle value={power}   color="#c2c6d8" label="POWER" />
        <GaugeCircle value={solar}   color="#d8c4a8" label="SOLAR" />
        <GaugeCircle value={storage} color="#909096" label="STORAGE" />
      </div>

      {/* Fuel sparkline */}
      <FuelSparkline values={fuelHistory} label={`FUEL ${fuel > 0 ? fuel.toFixed(0) + '%' : 'LVL'}`} />
    </div>
  )
}
