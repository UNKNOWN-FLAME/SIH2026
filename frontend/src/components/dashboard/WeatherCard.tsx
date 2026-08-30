import { useSensors } from '../../hooks/useSensors'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function fmt(s: SensorSummary | undefined, unit = '') {
  if (!s || s.latest_value == null) return '---'
  return `${s.latest_value.toFixed(1)}${unit}`
}

export default function WeatherCard({ stationId }: Props) {
  const { data: maitriSensors } = useSensors('maitri', 'weather')
  const { data: bharatiSensors } = useSensors('bharati', 'weather')

  const find = (sensors: SensorSummary[] | undefined, key: string) =>
    sensors?.find(s => s.sensor_id.includes(key))

  const mTemp   = find(maitriSensors,  'temp')
  const mWind   = find(maitriSensors,  'wind_speed')
  const mWDir   = find(maitriSensors,  'wind_dir')
  const bTemp   = find(bharatiSensors, 'temp')
  const bWind   = find(bharatiSensors, 'wind_speed')
  const bWDir   = find(bharatiSensors, 'wind_dir')

  const activeOpacity = (id: string) => id === stationId ? '#d4e4fa' : '#909096'

  return (
    <div style={{ background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096', paddingBottom: 8, borderBottom: '1px solid #45464c', marginBottom: 8 }}>
        WEATHER TELEMETRY
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

        {/* Maitri */}
        <div style={{ paddingRight: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: '#909096', marginBottom: 3 }}>MAITRI</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: activeOpacity('maitri'), fontFamily: 'Inter', letterSpacing: '-0.02em' }}>
              {fmt(mTemp, '°')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#d8c4a8' }}>C</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#909096', fontFamily: 'Inter' }}>
            Wind: {fmt(mWind, ' km/h')} {mWDir ? `${mWDir.latest_value?.toFixed(0)}°` : ''}
          </div>
        </div>

        {/* Bharati */}
        <div style={{ paddingLeft: 12, borderLeft: '1px solid #45464c' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: '#909096', marginBottom: 3 }}>BHARATI</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: activeOpacity('bharati'), fontFamily: 'Inter', letterSpacing: '-0.02em' }}>
              {fmt(bTemp, '°')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#909096' }}>C</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#909096', fontFamily: 'Inter' }}>
            Wind: {fmt(bWind, ' km/h')} {bWDir ? `${bWDir.latest_value?.toFixed(0)}°` : ''}
          </div>
        </div>

      </div>
    </div>
  )
}
