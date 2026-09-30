import { useSensors } from '../../hooks/useSensors'
import { useDigitalTwin } from '../../hooks/useDigitalTwin'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }


function computeChill(temp: number | null | undefined, windKmh: number | null | undefined): string {
  if (temp == null || windKmh == null) return '---'
  if (windKmh < 5) return `${temp.toFixed(0)}°C`
  const chill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * temp * Math.pow(windKmh, 0.16)
  return `${Math.round(chill)}°C`
}

export default function WeatherCard({ stationId }: Props) {
  const { lastAnomalyResult, setStationId } = useStation()
  const { data: sensors } = useSensors(stationId, 'weather')
  const { data: dt } = useDigitalTwin(stationId)

  // Also query opposite station for comparison pill
  const otherStationId = stationId === 'maitri' ? 'bharati' : 'maitri'
  const { data: otherDt } = useDigitalTwin(otherStationId)

  const { t } = useLanguage()

  const anomalyImpact = getCardAnomalyImpact('weather', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const find = (sensorsList: SensorSummary[] | undefined, key: string) =>
    sensorsList?.find(s => s.sensor_id.includes(key))

  const isMaitri = stationId === 'maitri'

  // Sensor extraction with Digital Twin fallback
  const tempSensor = find(sensors, 'temp')
  const windSensor = find(sensors, 'wind_speed')
  const windDirSensor = find(sensors, 'wind_dir')
  const pressSensor = find(sensors, 'pressure')
  const solarSensor = find(sensors, 'solar_rad') || find(sensors, 'radiation')

  // Real-time resolved values
  const activeTemp = tempSensor?.latest_value ?? dt?.environment?.ambient_temperature_c ?? (isMaitri ? -24.3 : -14.2)
  const activeWindKmh = windSensor?.latest_value ?? (dt?.environment?.wind_speed_ms ? dt.environment.wind_speed_ms * 3.6 : (isMaitri ? 20.9 : 17.3))
  const activeWindDir = windDirSensor?.latest_value ?? (isMaitri ? 168 : 68)
  const activeWindDirLabel = isMaitri ? 'SSE' : 'ENE'
  const activePressure = pressSensor?.latest_value ?? dt?.environment?.atmospheric_pressure_hpa ?? dt?.environment?.pressure_hpa ?? (isMaitri ? 968.1 : 963.9)
  const activeSolar = solarSensor?.latest_value ?? dt?.environment?.solar_radiation_wm2 ?? (isMaitri ? 0 : 41)
  const activeChill = dt?.environment?.wind_chill_c ? `${Math.round(dt.environment.wind_chill_c)}°C` : computeChill(activeTemp, activeWindKmh)

  // Opposite station snapshot
  const { data: otherSensors } = useSensors(otherStationId, 'weather')
  const otherTempSensor = find(otherSensors, 'temp')
  const otherWindSensor = find(otherSensors, 'wind_speed')
  const otherTemp = otherTempSensor?.latest_value ?? otherDt?.environment?.ambient_temperature_c ?? (isMaitri ? -14.2 : -24.3)
  const otherWindKmh = otherWindSensor?.latest_value ?? (otherDt?.environment?.wind_speed_ms ? otherDt.environment.wind_speed_ms * 3.6 : (isMaitri ? 17.3 : 20.9))

  const stationName = isMaitri ? 'Maitri Research Station' : 'Bharati Research Station'
  const stationLocation = isMaitri ? 'Schirmacher Oasis (70°45′S, 11°44′E)' : 'Larsemann Hills (69°24′S, 76°11′E)'
  const awsId = isMaitri ? 'IMD-AWS-01 (Maitri)' : 'IMD-AWS-02 (Bharati)'

  // Dynamic weather state tag
  const weatherCondition = isInfected
    ? 'BLIZZARD STORM ALERT'
    : activeWindKmh > 70
    ? 'SEVERE KATABATIC GALE'
    : activeWindKmh > 45
    ? 'MODERATE KATABATIC'
    : activeTemp > -10
    ? 'POLAR SUMMER THAW'
    : 'CLEAR POLAR SKY'

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
            borderRadius: 2,
          }}
        >
          {awsId}
        </span>
      </div>

      {/* Active Station Focal Content */}
      <div style={{ padding: '8px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Station Subheader with Coordinates */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ea580c' }}>location_on</span>
              {stationName}
            </div>
            <div style={{ fontSize: 8.5, color: '#64748b', marginLeft: 18 }}>
              {stationLocation}
            </div>
          </div>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 2,
              background: isInfected ? '#fee2e2' : activeWindKmh > 60 ? '#fef3c7' : '#e0f2fe',
              color: isInfected ? '#991b1b' : activeWindKmh > 60 ? '#92400e' : '#0369a1',
              border: `1px solid ${isInfected ? '#fca5a5' : activeWindKmh > 60 ? '#fcd34d' : '#bae6fd'}`,
            }}
          >
            ● {weatherCondition}
          </span>
        </div>

        {/* Hero Temp & Wind Chill Grid */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            padding: '8px 10px',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 10,
            alignItems: 'center',
          }}
        >
          {/* Large Temp Block */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: activeTemp < -20 ? '#1e3a8a' : '#0f172a',
                fontFamily: 'Inter',
                letterSpacing: '-0.03em',
              }}
            >
              {activeTemp > 0 ? `+${activeTemp.toFixed(1)}` : activeTemp.toFixed(1)}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ea580c' }}>°C</span>
            <div style={{ marginLeft: 6, fontSize: 8.5, color: '#64748b', lineHeight: 1.2 }}>
              <div>Wind Chill</div>
              <strong style={{ color: '#0284c7', fontSize: 10.5 }}>{activeChill}</strong>
            </div>
          </div>

          {/* Quick Wind summary */}
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 10, fontSize: 9.5 }}>
            <div style={{ color: '#64748b', fontSize: 8.5, fontWeight: 700 }}>WIND & BEARING</div>
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 12 }}>
              {activeWindKmh.toFixed(1)} <span style={{ fontSize: 9.5, fontWeight: 600 }}>km/h</span>
            </div>
            <div style={{ fontSize: 8.5, color: '#64748b' }}>
              {activeWindDir.toFixed(0)}° {activeWindDirLabel}
            </div>
          </div>
        </div>

        {/* 3 Met Metrics Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 6px', borderRadius: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700 }}>BAROMETER</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginTop: 1 }}>
              {activePressure.toFixed(0)} hPa
            </div>
            <div style={{ fontSize: 7.5, color: activePressure < 980 ? '#dc2626' : '#16a34a' }}>
              {activePressure < 980 ? 'Low Pressure' : 'Normal Pressure'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 6px', borderRadius: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700 }}>SOLAR FLUX</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', marginTop: 1 }}>
              {activeSolar.toFixed(0)} W/m²
            </div>
            <div style={{ fontSize: 7.5, color: '#64748b' }}>
              {activeSolar > 300 ? 'Daylight Insolation' : 'Low Solar'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 6px', borderRadius: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700 }}>MICROCLIMATE</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#0284c7', marginTop: 1 }}>
              {isMaitri ? 'Oasis Moraine' : 'Coastal Prydz'}
            </div>
            <div style={{ fontSize: 7.5, color: '#64748b' }}>
              {isMaitri ? 'Fresh Lake' : 'Polar Sea'}
            </div>
          </div>
        </div>

        {/* Comparison Strip with Opposite Station */}
        <div
          onClick={() => setStationId(otherStationId)}
          style={{
            background: '#f1f5f9',
            border: '1px dashed #cbd5e1',
            borderRadius: 2,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: 8.5,
            color: '#475569',
            transition: 'background 0.15s ease',
          }}
          title={`Click to switch dashboard to ${isMaitri ? 'Bharati' : 'Maitri'}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#0369a1' }}>swap_horiz</span>
            <span>
              {isMaitri ? 'Bharati' : 'Maitri'} live reading:{' '}
              <strong style={{ color: '#0f172a' }}>{otherTemp > 0 ? `+${otherTemp.toFixed(1)}` : otherTemp.toFixed(1)}°C</strong> •{' '}
              <strong style={{ color: '#0f172a' }}>{otherWindKmh.toFixed(1)} km/h</strong>
            </span>
          </div>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#0369a1' }}>
            SWITCH ➔
          </span>
        </div>
      </div>

      {/* Advisory Status Footer */}
      <div
        style={{
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '4px 10px',
          fontSize: 8.5,
          color: '#475569',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>● IMD Polar Advisory: {isMaitri ? 'Oasis Station Nominal' : 'Coastal Operations Active'}</span>
        <span style={{ color: isInfected ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
          {isInfected ? '⚠ Warning Active' : '✓ Certified Clear'}
        </span>
      </div>
    </div>
  )
}
