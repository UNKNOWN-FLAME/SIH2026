import type { AnomalyInjectionResult } from '../api/hq'

export interface CardAnomalyImpact {
  isInfected: boolean
  tag: string
  severity: string
  details?: string
  affectedMetrics?: string[]
}

/**
 * Determines whether a given dashboard card or subsystem is affected/infected
 * by the currently active simulation anomaly.
 */
export function getCardAnomalyImpact(
  cardType: 'energy' | 'weather' | 'metmast' | 'seismic' | 'glacial' | 'groundlink' | 'schematic',
  lastAnomaly: AnomalyInjectionResult | null,
  activeStation: string
): CardAnomalyImpact | null {
  if (!lastAnomaly) return null

  // If the anomaly specifies a station and doesn't match active station, skip
  if (lastAnomaly.station_id && lastAnomaly.station_id !== activeStation) {
    return null
  }

  const aid = (lastAnomaly.anomaly_id || '').toLowerCase()
  const cat = (lastAnomaly.category || '').toLowerCase()
  const sev = lastAnomaly.severity || 'CRITICAL'

  switch (cardType) {
    case 'energy':
      if (
        aid.includes('generator') ||
        aid.includes('fuel') ||
        aid.includes('power') ||
        aid.includes('blizzard') ||
        aid.includes('fire') ||
        aid.includes('hvac') ||
        aid.includes('solar') ||
        aid.includes('pipe') ||
        cat.includes('power') ||
        cat.includes('energy')
      ) {
        return {
          isInfected: true,
          tag: aid.includes('generator')
            ? 'DG-1 TRIP & LOAD SHED'
            : aid.includes('fuel')
              ? 'FUEL CRITICAL RESERVE'
              : aid.includes('blizzard')
                ? 'EXTREME HEATING DEMAND'
                : aid.includes('fire')
                  ? 'GRID FIRE ISOLATION'
                  : 'POWER SYSTEM COMPROMISED',
          severity: sev,
          details: 'Generator & electrical microgrid telemetry impacted by active anomaly.',
          affectedMetrics: ['Primary Generator', 'Battery Storage', 'Fuel Pressure'],
        }
      }
      break

    case 'weather':
      if (
        aid.includes('blizzard') ||
        aid.includes('storm') ||
        aid.includes('weather') ||
        aid.includes('wind') ||
        aid.includes('cold') ||
        cat.includes('weather') ||
        cat.includes('environment')
      ) {
        return {
          isInfected: true,
          tag: 'BLIZZARD SENSOR SURGE',
          severity: sev,
          details: 'Catastrophic blizzard winds and polar chill factor deviation.',
          affectedMetrics: ['Ambient Temp', 'Wind Speed', 'Wind Chill'],
        }
      }
      break

    case 'metmast':
      if (
        aid.includes('blizzard') ||
        aid.includes('wind') ||
        aid.includes('solar') ||
        aid.includes('storm') ||
        cat.includes('weather')
      ) {
        return {
          isInfected: true,
          tag: 'MET-MAST OVER-RANGE',
          severity: sev,
          details: 'Tower anemometers and pressure transducers reporting extreme deviation.',
          affectedMetrics: ['Wind Speed', 'Solar Radiation', 'Barometric Pressure'],
        }
      }
      break

    case 'seismic':
      if (
        aid.includes('earthquake') ||
        aid.includes('seismic') ||
        aid.includes('tremor') ||
        cat.includes('seismic')
      ) {
        return {
          isInfected: true,
          tag: 'TECTONIC SHOCKWAVE ACTIVE',
          severity: sev,
          details: 'Broadband seismometers detecting severe subsurface vibration.',
          affectedMetrics: ['Ground Acceleration', 'Harmonic Resonance'],
        }
      }
      break

    case 'glacial':
      if (
        aid.includes('glacial') ||
        aid.includes('crevasse') ||
        aid.includes('ice') ||
        aid.includes('earthquake')
      ) {
        return {
          isInfected: true,
          tag: 'GLACIAL RIFT EXPANSION',
          severity: sev,
          details: 'Ice shelf displacement sensors registering active crevasse widening.',
          affectedMetrics: ['GPR Displacement', 'Life Support Pipe'],
        }
      }
      break

    case 'groundlink':
      if (
        aid.includes('vsat') ||
        aid.includes('comm') ||
        aid.includes('solar') ||
        aid.includes('radio')
      ) {
        return {
          isInfected: true,
          tag: 'SATCOM LINK DEGRADED',
          severity: sev,
          details: 'ISRO GSAT uplink experiencing ionospheric & RF attenuation.',
          affectedMetrics: ['Uplink SNR', 'Packet Latency'],
        }
      }
      break

    case 'schematic':
      return {
        isInfected: true,
        tag: `${lastAnomaly.anomaly_name.toUpperCase()} FAULT PROPAGATING`,
        severity: sev,
        details: 'Facility 3D spatial nodes reflecting active failure progression.',
      }
  }

  return null
}
