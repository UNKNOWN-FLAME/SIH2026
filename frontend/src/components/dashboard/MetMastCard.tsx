import { useSensors } from '../../hooks/useSensors'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function find(sensors: SensorSummary[] | undefined, key: string) {
  return sensors?.find(s => s.sensor_id.includes(key))
}
function fmtVal(s: SensorSummary | undefined, decimals = 1, unit = '') {
  if (!s || s.latest_value == null) return '---'
  return `${s.latest_value.toFixed(decimals)} ${unit}`.trim()
}

export default function MetMastCard({ stationId }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: sensors } = useSensors(stationId, 'weather')
  const { t } = useLanguage()

  const anomalyImpact = getCardAnomalyImpact('metmast', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const windSpd = find(sensors, 'wind_speed')
  const windDir = find(sensors, 'wind_dir')
  const pressure = find(sensors, 'pressure')
  const solarRad = find(sensors, 'solar_rad')

  const metrics = [
    {
      icon: 'air',
      label: t('met.wind_speed'),
      value: fmtVal(windSpd, 1, 'km/h'),
      sub: (windSpd?.latest_value ?? 0) > 30 ? 'High Gusts' : 'Nominal',
      color: (windSpd?.latest_value ?? 0) > 30 ? '#ea580c' : '#0b3b60',
    },
    {
      icon: 'explore',
      label: t('met.direction'),
      value: fmtVal(windDir, 0, '°'),
      sub: 'WSW (247°)',
      color: '#0b3b60',
    },
    {
      icon: 'speed',
      label: t('met.pressure'),
      value: fmtVal(pressure, 0, 'hPa'),
      sub: 'Trend: Steady',
      color: '#0b3b60',
    },
    {
      icon: 'wb_sunny',
      label: t('met.solar_rad'),
      value: fmtVal(solarRad, 0, 'W/m²'),
      sub: 'Irradiance Flux',
      color: '#0b3b60',
    },
  ]

  return (
    <div
      style={{
        width: '100%',
        background: '#ffffff',
        border: isInfected ? '1.5px solid rgba(239, 68, 68, 0.45)' : '1px solid #cbd5e1',
        boxShadow: isInfected
          ? '0 0 10px rgba(239, 68, 68, 0.12)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 185,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Official Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: isInfected ? '2px solid #ef4444' : '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 3,
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: isInfected ? '#f87171' : '#ff9933',
            }}
          >
            {isInfected ? 'warning' : 'cell_tower'}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('met.title')} (10M)
          </span>
          {isInfected && anomalyImpact && (
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fecaca',
                padding: '1px 5px',
                borderRadius: 2,
                border: '1px solid rgba(239, 68, 68, 0.35)',
                letterSpacing: '0.03em',
              }}
            >
              ● {anomalyImpact.tag}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 8.5,
            color: '#ffedd5',
            background: 'rgba(255, 153, 51, 0.25)',
            border: '1px solid rgba(255, 153, 51, 0.5)',
            padding: '1px 6px',
            fontWeight: 800,
            borderRadius: 2,
          }}
        >
          IMD-AWS-01
        </span>
      </div>

      {/* Sensor Grid */}
      <div style={{ flex: 1, padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc' }}>
        {metrics.map(({ icon, label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '7px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>
                {label}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#94a3b8' }}>
                {icon}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: 'Inter', letterSpacing: '-0.01em' }}>
              {value}
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 600, color: '#64748b', marginTop: 1 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
