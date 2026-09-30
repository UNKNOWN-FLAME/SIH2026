import { useSensors } from '../../hooks/useSensors'
import { useDigitalTwin } from '../../hooks/useDigitalTwin'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import GaugeCircle from '../ui/GaugeCircle'
import type { SensorSummary } from '../../api/hq'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'

interface Props { stationId: string }

function findVal(sensors: SensorSummary[] | undefined, key: string): number | null {
  const s = sensors?.find(s => s.sensor_id.includes(key))
  return s?.latest_value ?? null
}

export default function EnergyCard({ stationId }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: sensors } = useSensors(stationId, 'energy')
  const { data: dt } = useDigitalTwin(stationId)
  const { t } = useLanguage()

  const isMaitri = stationId === 'maitri'

  const anomalyImpact = getCardAnomalyImpact('energy', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const aid = lastAnomalyResult?.anomaly_id
  const isGenAnomaly = aid === 'generator_failure'
  const isFuelAnomaly = aid === 'fuel_critical_low'
  const isBlizzardAnomaly = aid === 'blizzard'
  const isFireAnomaly = aid === 'fire_alarm'
  const isHvacAnomaly = aid === 'hvac_failure'
  const isSolarAnomaly = aid === 'solar_flare_radiation'

  // Total station capacities & specs
  const maxFuelCapacityL = isMaitri ? 165000 : 250000
  const gensetModel = isMaitri ? 'DG-1 (100kVA Kirloskar)' : 'CHP-1 (Co-Gen Microgrid)'
  const backupModel = isMaitri ? 'DG-2 Hot Standby' : 'CHP-2 Peak Assist'

  // Dynamic Power Load calculation
  const rawSensorPower = findVal(sensors, 'load')
  const dtPowerLoadKw = dt?.power?.total_station_load_kw ?? dt?.power?.total_load_kw
  const basePowerLoadKw = dtPowerLoadKw ?? rawSensorPower ?? (isMaitri ? 84.2 : 38.5)

  // Normalize to gauge percentage (Maitri 100kVA, Bharati 120kW CHP)
  const ratedCapacityKw = isMaitri ? 100 : 120
  let power = Math.min(100, Math.round((basePowerLoadKw / ratedCapacityKw) * 100))

  if (isGenAnomaly) power = 28 // Primary tripped, secondary on critical circuits
  else if (isBlizzardAnomaly) power = 96 // Extreme trace line heating
  else if (isFireAnomaly) power = 35 // Electrical isolation
  else if (isHvacAnomaly) power = 92 // Electric resistance heaters active

  // Solar PV percentage
  const rawSolar = findVal(sensors, 'solar')
  let solar = Math.min(100, rawSolar ?? (isMaitri ? 12 : 24))
  if (isBlizzardAnomaly) solar = 0 // Polar blizzard blackout
  else if (isSolarAnomaly) solar = 95 // Solar irradiance surge

  // Battery Storage SOC
  const rawStorage = findVal(sensors, 'storage')
  let storage = Math.min(100, rawStorage ?? (dt?.power?.battery_ups?.soc_percent ?? (isMaitri ? 89 : 94)))
  if (isGenAnomaly) storage = 38 // Rapid battery bank discharge
  else if (isFireAnomaly) storage = 64
  else if (isBlizzardAnomaly) storage = 72

  // Fuel Storage Calculation
  const rawFuelPct = findVal(sensors, 'fuel')
  const dtFuelLitres = dt?.fuel?.main_farm_level_L
  let fuelLitres = dtFuelLitres ?? (isMaitri ? 142500 : 210000)
  if (isMaitri && fuelLitres > maxFuelCapacityL) {
    fuelLitres = 142500
  }
  let fuelPct = rawFuelPct ?? Math.min(100, Math.round((fuelLitres / maxFuelCapacityL) * 100))

  if (isFuelAnomaly) {
    fuelPct = 18.2
    fuelLitres = Math.round(maxFuelCapacityL * 0.182)
  }

  // Days remaining calculation
  const dtAutonomy = dt?.fuel?.fuel_autonomy_days ?? dt?.fuel?.autonomy_days
  const autonomyDays = isFuelAnomaly
    ? 38
    : (dtAutonomy && dtAutonomy > 0 ? Math.round(dtAutonomy) : (isMaitri ? 214 : 240))

  const hasCritical = isGenAnomaly || isFuelAnomaly || isFireAnomaly || (fuelPct > 0 && fuelPct < 15)
  const hasWarning = isBlizzardAnomaly || isHvacAnomaly || (fuelPct > 0 && fuelPct < 30)

  let status = 'NOMINAL'
  if (isGenAnomaly) status = isMaitri ? 'DG-1 TRIP' : 'CHP-1 TRIP'
  else if (isFuelAnomaly) status = 'FUEL CRITICAL'
  else if (isFireAnomaly) status = 'FIRE ISOLATE'
  else if (isBlizzardAnomaly) status = 'BLIZZARD LOAD'
  else if (isHvacAnomaly) status = 'HVAC LOAD'
  else if (isSolarAnomaly) status = 'SOLAR SURGE'
  else if (lastAnomalyResult) status = `${lastAnomalyResult.severity} ALERT`
  else if (hasCritical) status = 'CRITICAL'
  else if (hasWarning) status = 'WARNING'

  const statusColor = (hasCritical || isGenAnomaly || isFuelAnomaly || isFireAnomaly)
    ? '#dc2626'
    : hasWarning
      ? '#d97706'
      : '#16a34a'

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
      {/* Official Card Header Strip */}
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
            {isInfected ? 'warning' : 'bolt'}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('energy.title')}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, color: '#ffedd5', fontWeight: 700 }}>
            {isMaitri ? 'MAITRI 100kVA' : 'BHARATI CHP'}
          </span>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: isInfected ? '#dc2626' : statusColor,
              background: '#ffffff',
              padding: '1px 6px',
              borderRadius: 2,
              boxShadow: isInfected ? '0 0 6px rgba(239, 68, 68, 0.4)' : 'none',
            }}
          >
            {status}
          </span>
        </div>
      </div>

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Prime Genset Subtitle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 8.5, color: '#475569' }}>
          <span>Primary: <strong style={{ color: '#0b3b60' }}>{gensetModel}</strong></span>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>● {basePowerLoadKw.toFixed(1)} kW Load</span>
        </div>

        {/* Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          <GaugeCircle value={power} color={isGenAnomaly || isBlizzardAnomaly ? '#dc2626' : '#0284c7'} label={t('energy.power')} />
          <GaugeCircle value={solar} color="#ea580c" label={t('energy.solar')} />
          <GaugeCircle value={storage} color={isGenAnomaly ? '#dc2626' : '#16a34a'} label={t('energy.storage')} />
        </div>

        {/* Diesel Fuel Stock Section */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 8px', marginTop: 'auto', borderRadius: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.03em' }}>
              {isMaitri ? 'Maitri Bulk Fuel Farm' : 'Bharati Bulk Fuel Farm'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, fontFamily: 'Inter' }}>
              {fuelPct}% ({fuelLitres.toLocaleString()} L / {(maxFuelCapacityL / 1000).toFixed(0)}k L)
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div
              style={{
                width: `${fuelPct}%`,
                height: '100%',
                background: statusColor,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#64748b' }}>
            <span>
              Reserve:{' '}
              <strong style={{ color: isFuelAnomaly ? '#dc2626' : '#0f172a' }}>
                {isFuelAnomaly
                  ? '~38 Days Emergency Rationing'
                  : isGenAnomaly
                    ? backupModel
                    : isBlizzardAnomaly
                      ? 'Heavy Winter Draw'
                      : `~${autonomyDays} Days Autonomy`}
              </strong>
            </span>
            <span
              style={{
                color: isFuelAnomaly || isGenAnomaly
                  ? '#dc2626'
                  : isBlizzardAnomaly
                    ? '#d97706'
                    : '#16a34a',
                fontWeight: 700,
              }}
            >
              ● {isFuelAnomaly ? 'Forced Rationing' : isGenAnomaly ? 'Backup Rotation' : isBlizzardAnomaly ? 'High (+45%)' : 'Optimal Cogen'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
