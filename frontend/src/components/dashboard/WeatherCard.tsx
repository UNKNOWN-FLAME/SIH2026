import { useSensors } from '../../hooks/useSensors'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function fmt(s: SensorSummary | undefined, unit = '') {
  if (!s || s.latest_value == null) return '---'
  return `${s.latest_value.toFixed(1)}${unit}`
}

function computeChill(temp: number | null | undefined, wind: number | null | undefined): string {
  if (temp == null || wind == null) return '---'
  if (wind < 5) return `${temp.toFixed(0)}°C`
  const chill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(wind, 0.16) + 0.3965 * temp * Math.pow(wind, 0.16)
  return `${Math.round(chill)}°C`
}

export default function WeatherCard({ stationId }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: maitriSensors } = useSensors('maitri', 'weather')
  const { data: bharatiSensors } = useSensors('bharati', 'weather')
  const { t } = useLanguage()

  const anomalyImpact = getCardAnomalyImpact('weather', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

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
        border: isInfected ? '1.5px solid rgba(239, 68, 68, 0.45)' : '1px solid #cbd5e1',
        boxShadow: isInfected
          ? '0 0 10px rgba(239, 68, 68, 0.12)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Official Government Card Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: isInfected ? '2px solid #ef4444' : '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 15,
              color: isInfected ? '#f87171' : '#ff9933',
            }}
          >
            {isInfected ? 'warning' : 'thermostat'}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('weather.title')}
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

      <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {/* Maitri */}
        <div
          style={{
            padding: '6px 8px',
            background: isMaitriActive ? '#f0f9ff' : '#f8fafc',
            border: isMaitriActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
            borderRadius: 2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: isMaitriActive ? '#0369a1' : '#475569' }}>
              {t('station.maitri')}
            </span>
            {isMaitriActive && (
              <span style={{ fontSize: 7, fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '1px 4px', borderRadius: 2 }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {fmt(mTemp, '°')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>C</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#475569', lineHeight: 1.25 }}>
            {t('weather.wind')}: <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmt(mWind, ' km/h')}</span>{mWDir?.latest_value != null ? ` (${mWDir.latest_value.toFixed(0)}°)` : ''}
          </div>
          <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>
            Chill: <strong style={{ color: '#0284c7' }}>{computeChill(mTemp?.latest_value, mWind?.latest_value)}</strong> • Clear
          </div>
        </div>

        {/* Bharati */}
        <div
          style={{
            padding: '6px 8px',
            background: !isMaitriActive ? '#f0f9ff' : '#f8fafc',
            border: !isMaitriActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
            borderRadius: 2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: !isMaitriActive ? '#0369a1' : '#475569' }}>
              {t('station.bharati')}
            </span>
            {!isMaitriActive && (
              <span style={{ fontSize: 7, fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '1px 4px', borderRadius: 2 }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {fmt(bTemp, '°')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>C</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#475569', lineHeight: 1.25 }}>
            {t('weather.wind')}: <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmt(bWind, ' km/h')}</span>{bWDir?.latest_value != null ? ` (${bWDir.latest_value.toFixed(0)}°)` : ''}
          </div>
          <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>
            Chill: <strong style={{ color: '#0284c7' }}>{computeChill(bTemp?.latest_value, bWind?.latest_value)}</strong> • Snow
          </div>
        </div>
      </div>
    </div>
  )
}
