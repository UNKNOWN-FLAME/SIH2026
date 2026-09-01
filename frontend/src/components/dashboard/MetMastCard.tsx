import { useSensors } from '../../hooks/useSensors'
import { useLanguage } from '../../context/LanguageContext'
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
  const { data: sensors } = useSensors(stationId, 'weather')
  const { t } = useLanguage()

  const windSpd = find(sensors, 'wind_speed')
  const windDir = find(sensors, 'wind_dir')
  const pressure = find(sensors, 'pressure')
  const solarRad = find(sensors, 'solar_rad')

  const metrics = [
    { label: t('met.wind_speed'), value: fmtVal(windSpd, 1, 'km/h') },
    { label: t('met.direction'), value: fmtVal(windDir, 0, '°') },
    { label: t('met.pressure'), value: fmtVal(pressure, 0, 'hPa') },
    { label: t('met.solar_rad'), value: fmtVal(solarRad, 0, 'W/m²') },
  ]

  return (
    <div
      style={{
        gridColumn: 'span 4',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 185,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Official Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ff9933' }}>
            tower
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('met.title')}
          </span>
        </div>
        <span style={{ fontSize: 8.5, color: '#ffedd5', background: 'rgba(255, 153, 51, 0.25)', padding: '1px 5px', fontWeight: 700 }}>
          MAST-01
        </span>
      </div>

      {/* Background photo */}
      <div style={{ position: 'absolute', inset: 0, top: 34, opacity: 0.18, pointerEvents: 'none' }}>
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1NMgCQZYDL9LJxivgN6DWTDxiIerTZXDsfldQfWDUEibUFFFqO1uNzqZPt_Pd6Lj7dIY9JC-ii1sSFC6nwMaRvtzQPmXrg4mZKJ6lAPxauSV0O9V0qlrU9pb1fcWJ1JSosnh3gLu33F8XyjJcarHKXgKbM_6Lh_AmKPIC227fG90W2j6VRv1B2tXZo8wKG_gl9yGmFt9Ii5NvhKJSIvnZ1l04CS3woImALca8VhyhJmc_p1VrBWKu2Q"
          alt="Meteorological Mast"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Data overlay */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: 'auto',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(4px)',
          borderTop: '1px solid #e2e8f0',
          padding: '8px 10px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {metrics.map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', color: '#64748b' }}>
                {label}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0b3b60', fontFamily: 'Inter', marginTop: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
