import { useSensors } from '../../hooks/useSensors'
import { useLanguage } from '../../context/LanguageContext'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function fmt(s: SensorSummary | undefined, unit = '') {
  if (!s || s.latest_value == null) return '---'
  return `${s.latest_value.toFixed(1)}${unit}`
}

export default function WeatherCard({ stationId }: Props) {
  const { data: maitriSensors } = useSensors('maitri', 'weather')
  const { data: bharatiSensors } = useSensors('bharati', 'weather')
  const { t } = useLanguage()

  const find = (sensors: SensorSummary[] | undefined, key: string) =>
    sensors?.find(s => s.sensor_id.includes(key))

  const mTemp = find(maitriSensors, 'temp')
  const mWind = find(maitriSensors, 'wind_speed')
  const mWDir = find(maitriSensors, 'wind_dir')
  const bTemp = find(bharatiSensors, 'temp')
  const bWind = find(bharatiSensors, 'wind_speed')
  const bWDir = find(bharatiSensors, 'wind_dir')

  const isMaitriActive = stationId === 'maitri'

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
      {/* Official Government Card Header Strip */}
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
            thermostat
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('weather.title')}
          </span>
        </div>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            background: 'rgba(255, 153, 51, 0.2)',
            border: '1px solid #ff9933',
            color: '#ffedd5',
            padding: '1px 6px',
          }}
        >
          IMD METEOROLOGY
        </span>
      </div>

      <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Maitri */}
        <div
          style={{
            padding: '8px 10px',
            background: isMaitriActive ? '#f0f9ff' : '#f8fafc',
            border: isMaitriActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: isMaitriActive ? '#0369a1' : '#475569' }}>
              {t('station.maitri')}
            </span>
            {isMaitriActive && (
              <span style={{ fontSize: 7.5, fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '1px 4px' }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {fmt(mTemp, '°')}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>C</span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569' }}>
            {t('weather.wind')}: <span style={{ color: '#0f172a' }}>{fmt(mWind, ' km/h')}</span> {mWDir ? `(${mWDir.latest_value?.toFixed(0)}°)` : ''}
          </div>
        </div>

        {/* Bharati */}
        <div
          style={{
            padding: '8px 10px',
            background: !isMaitriActive ? '#f0f9ff' : '#f8fafc',
            border: !isMaitriActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: !isMaitriActive ? '#0369a1' : '#475569' }}>
              {t('station.bharati')}
            </span>
            {!isMaitriActive && (
              <span style={{ fontSize: 7.5, fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '1px 4px' }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {fmt(bTemp, '°')}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>C</span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569' }}>
            {t('weather.wind')}: <span style={{ color: '#0f172a' }}>{fmt(bWind, ' km/h')}</span> {bWDir ? `(${bWDir.latest_value?.toFixed(0)}°)` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
