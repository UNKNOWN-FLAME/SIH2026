import { useSensors } from '../../hooks/useSensors'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import GaugeCircle from '../ui/GaugeCircle'
import type { SensorSummary } from '../../api/hq'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'

interface Props { stationId: string }

function findVal(sensors: SensorSummary[] | undefined, key: string): number {
  const s = sensors?.find(s => s.sensor_id.includes(key))
  return s?.latest_value ?? 0
}

export default function EnergyCard({ stationId }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: sensors } = useSensors(stationId, 'energy')
  const { t } = useLanguage()

  const anomalyImpact = getCardAnomalyImpact('energy', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const aid = lastAnomalyResult?.anomaly_id
  const isGenAnomaly = aid === 'generator_failure'
  const isFuelAnomaly = aid === 'fuel_critical_low'
  const isBlizzardAnomaly = aid === 'blizzard'
  const isFireAnomaly = aid === 'fire_alarm'
  const isHvacAnomaly = aid === 'hvac_failure'
  const isSolarAnomaly = aid === 'solar_flare_radiation'

  const rawPower = findVal(sensors, 'load')
  let power = Math.min(100, rawPower || 78)
  if (isGenAnomaly) power = 28 // DG-1 tripped, DG-2 running critical circuits only
  else if (isBlizzardAnomaly) power = 96 // Extreme heating & trace line demand
  else if (isFireAnomaly) power = 35 // Non-essential electrical isolation
  else if (isHvacAnomaly) power = 92 // Backup electric resistance heaters active

  let solar = Math.min(100, findVal(sensors, 'solar') || 14)
  if (isBlizzardAnomaly) solar = 0 // Polar blizzard blackout
  else if (isSolarAnomaly) solar = 95 // Solar irradiance surge

  let storage = Math.min(100, findVal(sensors, 'storage') || 88)
  if (isGenAnomaly) storage = 38 // Rapid battery bank discharge
  else if (isFireAnomaly) storage = 64
  else if (isBlizzardAnomaly) storage = 72

  const rawFuel = findVal(sensors, 'fuel')
  const fuel = isFuelAnomaly ? 18.2 : (rawFuel || 76)

  const hasCritical = isGenAnomaly || isFuelAnomaly || isFireAnomaly || (fuel > 0 && fuel < 15)
  const hasWarning = isBlizzardAnomaly || isHvacAnomaly || (fuel > 0 && fuel < 30)

  let status = 'NOMINAL'
  if (isGenAnomaly) status = 'DG-1 TRIP'
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

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              {t('energy.fuel')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, fontFamily: 'Inter' }}>
              {fuel > 0 ? `${fuel.toFixed(0)}%` : '42%'} ({fuel > 0 ? Math.round(fuel * 920).toLocaleString() : '38,640'} L)
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div
              style={{
                width: `${fuel > 0 ? fuel : 42}%`,
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
                  ? '~38 Days (Critical)'
                  : isGenAnomaly
                    ? 'DG-2 Active (DG-1 Tripped)'
                    : isBlizzardAnomaly
                      ? 'High Winter Draw'
                      : '~48 Days Reserve'}
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
              Burn Rate: {isFuelAnomaly ? 'Rationing' : isGenAnomaly ? 'Single DG' : isBlizzardAnomaly ? 'High (+45%)' : 'Nominal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
