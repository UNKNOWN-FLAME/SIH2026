import { useSensors } from '../../hooks/useSensors'
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

  const windSpd  = find(sensors, 'wind_speed')
  const windDir  = find(sensors, 'wind_dir')
  const pressure = find(sensors, 'pressure')
  const solarRad = find(sensors, 'solar_rad')

  const METRICS = [
    { label: 'WIND SPD',  value: fmtVal(windSpd,  1, 'km/h') },
    { label: 'DIRECTION', value: fmtVal(windDir,   0, '°') },
    { label: 'PRESSURE',  value: fmtVal(pressure,  0, 'hPa') },
    { label: 'SOLAR RAD', value: fmtVal(solarRad,  0, 'W/m²') },
  ]

  return (
    <div style={{ gridColumn: 'span 4', background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px', display: 'flex', flexDirection: 'column', minHeight: 180, position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096', paddingBottom: 6, borderBottom: '1px solid #45464c', marginBottom: 6, position: 'relative', zIndex: 2, background: 'rgba(28,43,60,0.85)' }}>
        METEOROLOGICAL MAST
      </div>

      {/* Background photo */}
      <div style={{ position: 'absolute', inset: 0, top: 32, opacity: 0.35, pointerEvents: 'none' }}>
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1NMgCQZYDL9LJxivgN6DWTDxiIerTZXDsfldQfWDUEibUFFFqO1uNzqZPt_Pd6Lj7dIY9JC-ii1sSFC6nwMaRvtzQPmXrg4mZKJ6lAPxauSV0O9V0qlrU9pb1fcWJ1JSosnh3gLu33F8XyjJcarHKXgKbM_6Lh_AmKPIC227fG90W2j6VRv1B2tXZo8wKG_gl9yGmFt9Ii5NvhKJSIvnZ1l04CS3woImALca8VhyhJmc_p1VrBWKu2Q"
          alt="Meteorological Mast" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Data overlay */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', background: 'rgba(13,28,45,0.9)', backdropFilter: 'blur(6px)', border: '1px solid #45464c', padding: '8px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {METRICS.map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: '#909096' }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#d4e4fa', fontFamily: 'Inter', marginTop: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
