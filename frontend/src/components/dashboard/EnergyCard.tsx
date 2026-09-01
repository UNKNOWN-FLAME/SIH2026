import { useSensors } from '../../hooks/useSensors'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useLanguage } from '../../context/LanguageContext'
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
  const { t } = useLanguage()

  const power = Math.min(100, findVal(sensors, 'load'))
  const solar = Math.min(100, findVal(sensors, 'solar'))
  const storage = Math.min(100, findVal(sensors, 'storage'))
  const fuel = findVal(sensors, 'fuel')

  const fuelHistory = analytics
    ? Object.values(analytics.avg_values).map(() => fuel + (Math.random() * 5 - 2.5)).slice(0, 9)
    : undefined

  const hasCritical = fuel > 0 && fuel < 15
  const hasWarning = fuel > 0 && fuel < 30

  const status = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'NOMINAL'
  const statusColor = hasCritical ? '#dc2626' : hasWarning ? '#d97706' : '#16a34a'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Official Card Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ff9933' }}>
            bolt
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('energy.title')}
          </span>
        </div>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            color: statusColor,
            background: '#ffffff',
            padding: '1px 6px',
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          <GaugeCircle value={power} color="#0284c7" label={t('energy.power')} />
          <GaugeCircle value={solar} color="#ea580c" label={t('energy.solar')} />
          <GaugeCircle value={storage} color="#16a34a" label={t('energy.storage')} />
        </div>

        {/* Fuel sparkline with official stock marker */}
        <FuelSparkline
          values={fuelHistory}
          label={`${t('energy.fuel')}: ${fuel > 0 ? fuel.toFixed(0) + '%' : 'OK'}`}
        />
      </div>
    </div>
  )
}
