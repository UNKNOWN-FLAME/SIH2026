import { useSensors } from '../../hooks/useSensors'
import { useDigitalTwin } from '../../hooks/useDigitalTwin'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'
import type { SensorSummary } from '../../api/hq'

interface Props { stationId: string }

function find(sensors: SensorSummary[] | undefined, key: string) {
  return sensors?.find(s => s.sensor_id.includes(key))
}

export default function MetMastCard({ stationId }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: sensors } = useSensors(stationId, 'weather')
  const { data: dt } = useDigitalTwin(stationId)
  const { t } = useLanguage()

  const isMaitri = stationId === 'maitri'

  const anomalyImpact = getCardAnomalyImpact('metmast', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const windSpdSensor = find(sensors, 'wind_speed')
  const windDirSensor = find(sensors, 'wind_dir')
  const pressureSensor = find(sensors, 'pressure')
  const solarRadSensor = find(sensors, 'solar_rad') || find(sensors, 'radiation')

  // Dynamic values combining database sensors & real-time digital twin physics
  const windSpdVal = windSpdSensor?.latest_value ?? (dt?.environment?.wind_speed_ms ? dt.environment.wind_speed_ms * 3.6 : (isMaitri ? 20.9 : 17.3))
  const windDirVal = windDirSensor?.latest_value ?? (isMaitri ? 168 : 68)
  const windDirSub = isMaitri ? `${windDirVal.toFixed(0)}° SSE Azimuth` : `${windDirVal.toFixed(0)}° ENE Azimuth`
  const pressureVal = pressureSensor?.latest_value ?? dt?.environment?.atmospheric_pressure_hpa ?? dt?.environment?.pressure_hpa ?? (isMaitri ? 968.1 : 963.9)
  const solarRadVal = solarRadSensor?.latest_value ?? dt?.environment?.solar_radiation_wm2 ?? (isMaitri ? 0 : 41)

  const awsId = isMaitri ? 'IMD-AWS-01 (Maitri)' : 'IMD-AWS-02 (Bharati)'
  const locationSub = isMaitri ? 'Schirmacher Oasis (117m ASL)' : 'Larsemann Promontory (35m ASL)'

  const metrics = [
    {
      icon: 'air',
      label: t('met.wind_speed'),
      value: `${windSpdVal.toFixed(1)} km/h`,
      sub: windSpdVal > 60 ? 'Strong Katabatic' : windSpdVal > 30 ? 'Moderate Breeze' : 'Gentle Polar',
      color: windSpdVal > 60 ? '#ea580c' : '#0b3b60',
    },
    {
      icon: 'explore',
      label: t('met.direction'),
      value: `${windDirVal.toFixed(0)}°`,
      sub: windDirSub,
      color: '#0b3b60',
    },
    {
      icon: 'speed',
      label: t('met.pressure'),
      value: `${pressureVal.toFixed(0)} hPa`,
      sub: pressureVal < 980 ? 'Low Polar Cell' : 'Normal Barometric',
      color: '#0b3b60',
    },
    {
      icon: 'wb_sunny',
      label: t('met.solar_rad'),
      value: `${solarRadVal.toFixed(0)} W/m²`,
      sub: 'Daylight Insolation',
      color: '#ea580c',
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
            {t('met.title')} (10M MAST)
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
          {awsId}
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

      {/* Official Calibration Strip */}
      <div
        style={{
          background: '#f1f5f9',
          borderTop: '1px solid #e2e8f0',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 8.5,
          color: '#475569',
        }}
      >
        <span>● {locationSub} • Ultrasonic Heated Anemometer</span>
        <span style={{ color: '#15803d', fontWeight: 700 }}>✓ WMO-IMD Certified</span>
      </div>
    </div>
  )
}
