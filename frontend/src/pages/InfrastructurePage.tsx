import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { useIoTSensors } from '../hooks/useIoTSensors'
import type { IoTSensor, SensorParameter, AnomalyInjectionResult } from '../api/hq'

// ── Types ─────────────────────────────────────────────────────────────────────

type StationId = 'maitri' | 'bharati'

// ── Category config (colours + icons) ────────────────────────────────────────

const CAT_META: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  temperature:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '🌡️' },
  pressure:       { color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', emoji: '🔵' },
  fuel:           { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', emoji: '⛽' },
  seismic:        { color: '#92400e', bg: '#fefce8', border: '#fde68a', emoji: '🌍' },
  wildlife:       { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🐧' },
  radiation:      { color: '#ca8a04', bg: '#fefce8', border: '#fef08a', emoji: '☀️' },
  meteorological: { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', emoji: '🌬️' },
  structural:     { color: '#475569', bg: '#f8fafc', border: '#cbd5e1', emoji: '🏗️' },
  air_quality:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', emoji: '💨' },
  oceanographic:  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', emoji: '🌊' },
  fire_safety:    { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', emoji: '🔥' },
  communications: { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', emoji: '📡' },
}

const DEFAULT_META = { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', emoji: '🔌' }

function getCatMeta(cat: string) {
  return CAT_META[cat] ?? DEFAULT_META
}

// ── Anomaly check helper ──────────────────────────────────────────────────────

function isSensorAffected(sensor: IoTSensor, anomaly: AnomalyInjectionResult | null): boolean {
  if (!anomaly) return false
  const cat = sensor.category.toLowerCase()
  const aId = anomaly.anomaly_id.toLowerCase()
  const aCat = (anomaly.category || '').toLowerCase()
  if (aId.includes('blizzard') || aId.includes('wind') || aCat === 'weather') {
    return ['meteorological', 'temperature', 'pressure', 'structural'].includes(cat)
  }
  if (aId.includes('generator') || aId.includes('power') || aId.includes('fuel') || aCat === 'energy') {
    return ['fuel', 'temperature', 'pressure', 'fire_safety'].includes(cat)
  }
  if (aId.includes('earthquake') || aId.includes('seismic') || aCat === 'structural') {
    return ['seismic', 'structural', 'pressure'].includes(cat)
  }
  if (aId.includes('fire') || aCat === 'safety') {
    return ['fire_safety', 'temperature', 'air_quality'].includes(cat)
  }
  return false
}

// ── Infrastructure Physical Zones Definition ──────────────────────────────────

interface InfrastructureZone {
  id: string
  code: string
  name: string
  location: string
  icon: string
  accentColor: string
  categories: string[]
  description: string
  operatingParameters: { label: string; value: string; status: 'NORMAL' | 'ELEVATED' | 'CRITICAL' }[]
}

const MAITRI_ZONES: InfrastructureZone[] = [
  {
    id: 'power_house',
    code: 'Z-01',
    name: 'Power Generation Complex (DG House)',
    location: 'Main Sub-Block A, East Wing',
    icon: 'electric_bolt',
    accentColor: '#ea580c',
    categories: ['fuel', 'temperature', 'pressure', 'fire_safety'],
    description: '3x 125 kVA Marine Diesel Gensets, heated fuel delivery day-tank, automatic failover bus.',
    operatingParameters: [
      { label: 'Active Load', value: '164.2 kW', status: 'NORMAL' },
      { label: 'Fuel Flow Rate', value: '38.4 L/h', status: 'NORMAL' },
      { label: 'DG-1 Coolant Temp', value: '88.5 °C', status: 'NORMAL' },
      { label: 'Fuel Day-Tank Level', value: '86 %', status: 'NORMAL' },
    ],
  },
  {
    id: 'hvac_thermal',
    code: 'Z-02',
    name: 'HVAC & Habitat Thermal Conditioning',
    location: 'Central Spine, Level 1',
    icon: 'thermostat',
    accentColor: '#0284c7',
    categories: ['temperature', 'pressure', 'air_quality'],
    description: 'Fresh air intake pre-heaters, dual-stage glycol heat exchangers, CO2 scrubbers.',
    operatingParameters: [
      { label: 'Habitat Ambient', value: '+21.4 °C', status: 'NORMAL' },
      { label: 'Supply Air Temp', value: '+24.1 °C', status: 'NORMAL' },
      { label: 'CO2 Concentration', value: '460 ppm', status: 'NORMAL' },
      { label: 'Duct Static Pressure', value: '185 Pa', status: 'NORMAL' },
    ],
  },
  {
    id: 'priyadarshini_water',
    code: 'Z-03',
    name: 'Lake Priyadarshini Pumping & Water RO',
    location: 'Water Line Pumphouse, 255m North',
    icon: 'water_drop',
    accentColor: '#0891b2',
    categories: ['temperature', 'pressure', 'oceanographic'],
    description: 'Electrically trace-heated intake siphon from lake Priyadarshini, reverse osmosis filtration, 24kL potable storage.',
    operatingParameters: [
      { label: 'Intake Water Temp', value: '+1.8 °C', status: 'NORMAL' },
      { label: 'Trace Heat Current', value: '28.2 A', status: 'NORMAL' },
      { label: 'Daily Delivery', value: '4,200 L', status: 'NORMAL' },
      { label: 'RO Membrane Flux', value: '98.6 %', status: 'NORMAL' },
    ],
  },
  {
    id: 'renewables_microgrid',
    code: 'Z-04',
    name: 'Clean Energy & Battery Storage (BESS)',
    location: 'South Ridge Sub-Station',
    icon: 'solar_power',
    accentColor: '#16a34a',
    categories: ['temperature', 'radiation'],
    description: '60 kWp Bifacial Solar Array, 20 kW Wind Generator, 200 kWh LiFePO4 battery bank.',
    operatingParameters: [
      { label: 'Solar Output', value: '18.5 kW', status: 'NORMAL' },
      { label: 'Wind Turbine Output', value: '24.2 kW', status: 'NORMAL' },
      { label: 'Battery SoC', value: '91 %', status: 'NORMAL' },
      { label: 'Bus Inverter Frequency', value: '50.02 Hz', status: 'NORMAL' },
    ],
  },
  {
    id: 'satcom_gateway',
    code: 'Z-05',
    name: 'Polar VSAT Radome & Edge SCADA Bus',
    location: 'Station Roof Dome & Comm Room',
    icon: 'satellite_alt',
    accentColor: '#7c3aed',
    categories: ['communications'],
    description: '3.8m C-Band Gyro-Stabilized Dish, Inmarsat BGAN backup, Edge Black Box buffer appliance.',
    operatingParameters: [
      { label: 'C-Band SNR', value: '14.8 dB', status: 'NORMAL' },
      { label: 'Uplink Throughput', value: '2.4 Mbps', status: 'NORMAL' },
      { label: 'Radome Internal Temp', value: '+12.0 °C', status: 'NORMAL' },
      { label: 'Local Black Box Queue', value: '0 Frames', status: 'NORMAL' },
    ],
  },
  {
    id: 'met_mast_rig',
    code: 'Z-06',
    name: '30m Micro-Meteorological Mast',
    location: 'Windward Ridge, 120m West',
    icon: 'air',
    accentColor: '#0369a1',
    categories: ['meteorological', 'radiation', 'temperature', 'pressure'],
    description: 'Multi-level ultrasonic sonic anemometers (10m, 20m, 30m), net pyranometer, baro-transmitters.',
    operatingParameters: [
      { label: '10m Wind Speed', value: '26.0 km/h', status: 'NORMAL' },
      { label: 'Atmospheric Pressure', value: '960.0 hPa', status: 'NORMAL' },
      { label: 'External Ambient', value: '-15.5 °C', status: 'NORMAL' },
      { label: 'Solar Insolation', value: '95 W/m²', status: 'NORMAL' },
    ],
  },
  {
    id: 'structural_seismic',
    code: 'Z-07',
    name: 'Structural Foundation & Bedrock Vault',
    location: 'Permafrost Pylons & Borehole Vault',
    icon: 'foundation',
    accentColor: '#92400e',
    categories: ['seismic', 'structural'],
    description: 'Hydraulic leveling pylons over Schirmacher bedrock, 3-component broadband seismometer, strain gauges.',
    operatingParameters: [
      { label: 'Seismic PGV', value: '0.12 mm/s', status: 'NORMAL' },
      { label: 'Pylon 4B Strain', value: '142 µε', status: 'NORMAL' },
      { label: 'Permafrost Temp (2m)', value: '-8.4 °C', status: 'NORMAL' },
      { label: 'Hydraulic Leveling', value: '0.04° Tilt', status: 'NORMAL' },
    ],
  },
]

const BHARATI_ZONES: InfrastructureZone[] = [
  {
    id: 'habitat_spine',
    code: 'BZ-01',
    name: 'Aerodynamic Habitat Container Complex',
    location: 'Larsemann Promontory Main Deck',
    icon: 'home_work',
    accentColor: '#0b3b60',
    categories: ['temperature', 'pressure', 'air_quality'],
    description: '134 interlocked ISO container modules enclosed in an aerodynamic thermal skin, double-glazed pressurized envelope.',
    operatingParameters: [
      { label: 'Habitat Ambient', value: '+22.0 °C', status: 'NORMAL' },
      { label: 'Envelope Diff Pressure', value: '25 Pa', status: 'NORMAL' },
      { label: 'Indoor Humidity', value: '44 %', status: 'NORMAL' },
      { label: 'Total Occupancy', value: '32 Crew', status: 'NORMAL' },
    ],
  },
  {
    id: 'chp_energy_centre',
    code: 'BZ-02',
    name: 'Energy Central & Combined Heat & Power (CHP)',
    location: 'Ground Level Utility Block',
    icon: 'energy_savings_leaf',
    accentColor: '#ea580c',
    categories: ['fuel', 'temperature', 'pressure', 'fire_safety'],
    description: '3x 160 kVA Scania Gen-sets with exhaust heat recovery loop feeding hydronic radiators throughout station.',
    operatingParameters: [
      { label: 'Total Station Load', value: '218.4 kW', status: 'NORMAL' },
      { label: 'Waste Heat Recovery', value: '64.5 kWt', status: 'NORMAL' },
      { label: 'Radiator Loop Supply', value: '+68.0 °C', status: 'NORMAL' },
      { label: 'Bulk Fuel Level', value: '210,500 L', status: 'NORMAL' },
    ],
  },
  {
    id: 'seawater_desal',
    code: 'BZ-03',
    name: 'Seawater Desalination & Greywater Reclaim',
    location: 'Coastal Intake Module',
    icon: 'waves',
    accentColor: '#1d4ed8',
    categories: ['oceanographic', 'pressure', 'temperature'],
    description: 'Prydz Bay tidal intake, high-pressure RO sea-ice desalination, 80% greywater biological reclamation.',
    operatingParameters: [
      { label: 'Seawater Temp', value: '-1.82 °C', status: 'NORMAL' },
      { label: 'RO System Pressure', value: '55.2 bar', status: 'NORMAL' },
      { label: 'Potable Production', value: '6,400 L/d', status: 'NORMAL' },
      { label: 'Salinity (Permeate)', value: '185 ppm', status: 'NORMAL' },
    ],
  },
  {
    id: 'eos_radome_hub',
    code: 'BZ-04',
    name: '7.3m Earth Observation Satellite (EOS) Radome',
    location: 'High Knoll Radome Point',
    icon: 'radar',
    accentColor: '#7c3aed',
    categories: ['communications'],
    description: 'Primary Indian Remote Sensing (IRS) data downlink station, high-speed dual VSAT carrier, Black Box edge logger.',
    operatingParameters: [
      { label: 'Downlink Throughput', value: '120 Mbps', status: 'NORMAL' },
      { label: 'Tracking Elevation', value: '44.8°', status: 'NORMAL' },
      { label: 'Azimuth Servo Speed', value: '12°/s', status: 'NORMAL' },
      { label: 'Radome De-Ice Heaters', value: 'STANDBY', status: 'NORMAL' },
    ],
  },
  {
    id: 'pylons_structure',
    code: 'BZ-05',
    name: 'Elevated Pylons & Ice-Stilts Infrastructure',
    location: 'Bedrock Elevation Columns',
    icon: 'construction',
    accentColor: '#475569',
    categories: ['structural', 'seismic'],
    description: 'Aerodynamic under-floor air gap on steel stilts preventing snow-drift build up, wind tunnel tested.',
    operatingParameters: [
      { label: 'Underfloor Wind Speed', value: '42 km/h', status: 'NORMAL' },
      { label: 'Pylon Base Stress', value: '28.4 MPa', status: 'NORMAL' },
      { label: 'Snow Drift Clearance', value: '3.8 m', status: 'NORMAL' },
      { label: 'Seismic Acceleration', value: '0.08 mm/s²', status: 'NORMAL' },
    ],
  },
  {
    id: 'coastal_ocean_met',
    code: 'BZ-06',
    name: 'Larsemann Coastal Met & Fast-Ice Station',
    location: 'Prydz Bay Ice Boundary',
    icon: 'tsunami',
    accentColor: '#0284c7',
    categories: ['meteorological', 'oceanographic', 'wildlife'],
    description: 'Acoustic Doppler current profiler, sea-ice thickness acoustic sensors, penguin rookery acoustic monitors.',
    operatingParameters: [
      { label: 'Coastal Wind Speed', value: '19.0 km/h', status: 'NORMAL' },
      { label: 'Fast-Ice Thickness', value: '2.15 m', status: 'NORMAL' },
      { label: 'Tidal Fluctuation', value: '1.4 m', status: 'NORMAL' },
      { label: 'Adélie Colony Activity', value: 'NOMINAL', status: 'NORMAL' },
    ],
  },
]

// ── Sensor Detail Modal ───────────────────────────────────────────────────────

function ParameterRow({ param }: { param: SensorParameter }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '7px 0',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 11,
        gap: 12,
      }}
    >
      <div style={{ color: '#475569', fontWeight: 600, flexShrink: 0 }}>{param.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>
          {typeof param.value === 'number' ? param.value.toLocaleString() : param.value}
          {param.unit && (
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginLeft: 3 }}>
              {param.unit}
            </span>
          )}
        </span>
        <span style={{ fontSize: 9.5, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 2, whiteSpace: 'nowrap' }}>
          {param.normal_range}
        </span>
      </div>
    </div>
  )
}

function SensorDetailModal({
  sensor,
  anomaly,
  onClose,
}: {
  sensor: IoTSensor
  anomaly: AnomalyInjectionResult | null
  onClose: () => void
}) {
  const meta = getCatMeta(sensor.category)
  const isOnline = sensor.state === 'online'
  const catLabel = sensor.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const affected = isSensorAffected(sensor, anomaly)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 520,
          border: `1px solid ${affected ? '#dc2626' : meta.border}`,
          borderTop: `5px solid ${affected ? '#dc2626' : meta.color}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${meta.border}`, background: affected ? '#fef2f2' : meta.bg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: affected ? '#dc2626' : meta.color }}>
                  {sensor.icon}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '2px 8px',
                    background: affected ? '#dc2626' : meta.color,
                    color: '#ffffff',
                    borderRadius: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  {catLabel}
                </span>
                {affected && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 900,
                      padding: '2px 8px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      borderRadius: 2,
                      letterSpacing: '0.04em',
                    }}
                  >
                    🚨 ACTIVE ANOMALY IMPACT
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>
                {sensor.name}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                📍 {sensor.location}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Anomaly Banner */}
        {affected && anomaly && (
          <div
            style={{
              background: '#fff1f2',
              borderBottom: '1px solid #fecdd3',
              padding: '10px 18px',
              fontSize: 11,
              color: '#9f1239',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 2 }}>
              ⚠️ Affected by Live Incident: {anomaly.anomaly_name} ({anomaly.severity})
            </div>
            <div style={{ fontSize: 10, color: '#881337' }}>
              Operational parameters shifted significantly from nominal baseline. Telemetry bus reporting live deviation.
            </div>
          </div>
        )}

        {/* Sensor ID + State Banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 18px',
            background: isOnline ? '#f0fdf4' : '#fef2f2',
            borderBottom: `1px solid ${isOnline ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0369a1' }}>
              {sensor.sensor_id}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isOnline ? '#16a34a' : '#dc2626',
                boxShadow: isOnline ? '0 0 6px #16a34a' : '0 0 6px #dc2626',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: isOnline ? '#15803d' : '#b91c1c',
              }}
            >
              {isOnline ? 'ONLINE — Transmitting on Subsystem Bus' : 'OFFLINE — No data received'}
            </span>
          </div>
        </div>

        {/* Parameters */}
        <div style={{ padding: '14px 18px' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Operational Parameters
          </div>
          {!isOnline && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 11,
                color: '#b91c1c',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>warning</span>
              Sensor offline — values shown are last known readings. Possible causes: blizzard event,
              power failure, or physical damage.
            </div>
          )}
          {sensor.parameters.map((p) => (
            <ParameterRow key={p.key} param={p} />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
            Data source: NCPOR SCADA Telemetry Bus • Real-Time Synchronized
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#0b3b60',
              color: '#ffffff',
              border: 'none',
              padding: '5px 14px',
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sensor Card ───────────────────────────────────────────────────────────────

function SensorCard({
  sensor,
  anomaly,
  onClick,
}: {
  sensor: IoTSensor
  anomaly: AnomalyInjectionResult | null
  onClick: () => void
}) {
  const meta = getCatMeta(sensor.category)
  const isOnline = sensor.state === 'online'
  const catLabel = sensor.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const affected = isSensorAffected(sensor, anomaly)

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        background: '#ffffff',
        border: affected ? '2px solid #dc2626' : `1px solid ${meta.border}`,
        borderTop: affected ? '4px solid #dc2626' : `4px solid ${meta.color}`,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.1s',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        outline: 'none',
        boxShadow: affected ? '0 0 10px rgba(220, 38, 38, 0.25)' : 'none',
      }}
      onMouseOver={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = affected ? '0 0 15px rgba(220, 38, 38, 0.4)' : `0 4px 16px rgba(0,0,0,0.12)`
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseOut={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = affected ? '0 0 10px rgba(220, 38, 38, 0.25)' : 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Category tag + Alert Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            padding: '1px 6px',
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            borderRadius: 2,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {meta.emoji} {catLabel}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {affected && (
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 900,
                padding: '1px 5px',
                background: '#dc2626',
                color: '#ffffff',
                borderRadius: 2,
                letterSpacing: '0.04em',
                animation: 'pulse 1.5s infinite',
              }}
            >
              ALARM
            </span>
          )}

          {/* Online/Offline pill */}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 10,
              background: isOnline ? '#dcfce7' : '#fee2e2',
              color: isOnline ? '#15803d' : '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isOnline ? '#16a34a' : '#dc2626',
                animation: isOnline ? 'pulse 2s infinite' : 'none',
              }}
            />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Icon + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: affected ? '#fee2e2' : meta.bg,
            border: `1px solid ${affected ? '#fca5a5' : meta.border}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: affected ? '#dc2626' : meta.color }}>
            {sensor.icon}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
            {sensor.name}
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
            📍 {sensor.location}
          </div>
        </div>
      </div>

      {/* Sensor ID */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9.5, color: '#0369a1', fontWeight: 700 }}>
          {sensor.sensor_id}
        </span>
        <span style={{ fontSize: 9.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>info</span>
          Parameters ({sensor.parameters.length})
        </span>
      </div>

      {/* Offline overlay warning */}
      {!isOnline && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(254, 242, 242, 0.45)',
            pointerEvents: 'none',
            borderTop: '4px solid #dc2626',
          }}
        />
      )}
    </div>
  )
}

// ── Physical Zone Card (Digital Twin Component) ───────────────────────────────

function PhysicalZoneCard({
  zone,
  anomaly,
  sensors,
  onSelectCategory,
  onSelectSensor,
}: {
  zone: InfrastructureZone
  anomaly: AnomalyInjectionResult | null
  sensors: IoTSensor[]
  onSelectCategory: (cat: string) => void
  onSelectSensor: (sensor: IoTSensor) => void
}) {
  const isZoneAffected = useMemo(() => {
    if (!anomaly) return false
    const aId = anomaly.anomaly_id.toLowerCase()
    if (aId.includes('generator') || aId.includes('power') || aId.includes('fuel')) {
      return zone.id === 'power_house' || zone.id === 'chp_energy_centre'
    }
    if (aId.includes('blizzard') || aId.includes('wind')) {
      return zone.id === 'met_mast_rig' || zone.id === 'hvac_thermal' || zone.id === 'coastal_ocean_met'
    }
    if (aId.includes('earthquake') || aId.includes('seismic')) {
      return zone.id === 'structural_seismic' || zone.id === 'pylons_structure'
    }
    if (aId.includes('fire')) {
      return zone.id === 'power_house' || zone.id === 'chp_energy_centre' || zone.id === 'habitat_spine'
    }
    return false
  }, [anomaly, zone.id])

  const zoneSensors = sensors.filter((s) => zone.categories.includes(s.category))

  return (
    <div
      style={{
        background: '#ffffff',
        border: isZoneAffected ? '2px solid #dc2626' : '1px solid #cbd5e1',
        borderTop: isZoneAffected ? '4px solid #dc2626' : `4px solid ${zone.accentColor}`,
        padding: '16px',
        boxShadow: isZoneAffected ? '0 0 16px rgba(220, 38, 38, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.2s',
      }}
    >
      <div>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: isZoneAffected ? '#fee2e2' : `${zone.accentColor}15`,
                border: `1px solid ${isZoneAffected ? '#fca5a5' : zone.accentColor}`,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: isZoneAffected ? '#dc2626' : zone.accentColor }}
              >
                {zone.icon}
              </span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fontWeight: 900,
                    background: '#f1f5f9',
                    padding: '1px 5px',
                    borderRadius: 2,
                    color: '#475569',
                  }}
                >
                  {zone.code}
                </span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                  {zone.name}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                📍 {zone.location}
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              padding: '3px 8px',
              borderRadius: 3,
              background: isZoneAffected ? '#fee2e2' : '#f0fdf4',
              color: isZoneAffected ? '#b91c1c' : '#15803d',
              border: `1px solid ${isZoneAffected ? '#fecaca' : '#bbf7d0'}`,
              animation: isZoneAffected ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {isZoneAffected ? '🚨 ANOMALY ALERT' : '● NOMINAL'}
          </span>
        </div>

        {/* Anomaly Impact callout */}
        {isZoneAffected && anomaly && (
          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderLeft: '3px solid #dc2626',
              padding: '8px 10px',
              marginBottom: 12,
              fontSize: 10.5,
              color: '#9f1239',
            }}
          >
            <strong>Incident Active: {anomaly.anomaly_name}</strong>
            <div style={{ fontSize: 9.5, color: '#881337', marginTop: 2 }}>
              {anomaly.impacts[0] ?? 'Operational deviations detected in local control loop.'}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, lineHeight: 1.4 }}>
          {zone.description}
        </div>

        {/* Subsystem Live Operating Parameters */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            Subsystem Live Telemetry Bus
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {zone.operatingParameters.map((p, idx) => (
              <div key={idx} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: 4 }}>
                <div style={{ fontSize: 9, color: '#64748b' }}>{p.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isZoneAffected ? '#b91c1c' : '#0f172a' }}>
                  {p.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Installed IoT Sensors in this Zone */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Installed IoT Sensors ({zoneSensors.length})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {zoneSensors.map((s) => {
              const meta = getCatMeta(s.category)
              const aff = isSensorAffected(s, anomaly)
              return (
                <button
                  key={s.sensor_id}
                  onClick={() => onSelectSensor(s)}
                  style={{
                    background: aff ? '#fee2e2' : meta.bg,
                    color: aff ? '#b91c1c' : meta.color,
                    border: `1px solid ${aff ? '#f87171' : meta.border}`,
                    padding: '3px 8px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    borderRadius: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`View ${s.name} parameters`}
                >
                  <span>{meta.emoji}</span>
                  <span>{s.name.split(' ')[0]}</span>
                  {aff && <span style={{ color: '#dc2626', fontWeight: 900 }}>!</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Card Action */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
          Categories: {zone.categories.join(', ')}
        </span>
        <button
          onClick={() => onSelectCategory(zone.categories[0] ?? 'all')}
          style={{
            background: 'none',
            border: 'none',
            color: '#0b3b60',
            fontSize: 10.5,
            fontWeight: 800,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span>View Category</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InfrastructurePage() {
  const navigate = useNavigate()
  const {
    stationId: activeStation,
    setStationId: setActiveStation,
    linkState,
    isOnline,
    edgeBufferCount,
    flushEdgeBuffer,
    lastAnomalyResult,
  } = useStation()

  const [activeTab, setActiveTab] = useState<'twin' | 'registry'>('twin')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedState, setSelectedState] = useState<'all' | 'online' | 'offline'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSensor, setSelectedSensor] = useState<IoTSensor | null>(null)
  const [isFlushing, setIsFlushing] = useState(false)

  const { data: sensorData, isLoading } = useIoTSensors(activeStation)

  const allSensors: IoTSensor[] = sensorData?.sensors ?? []
  const categories = sensorData?.categories ?? []
  const onlineCount = sensorData?.online ?? 0
  const offlineCount = sensorData?.offline ?? 0
  const totalCount = sensorData?.total ?? 0

  const currentZones = activeStation === 'maitri' ? MAITRI_ZONES : BHARATI_ZONES

  // Filtering
  const filtered = allSensors.filter((s) => {
    const catMatch = selectedCategory === 'all' || s.category === selectedCategory
    const stateMatch = selectedState === 'all' || s.state === selectedState
    const searchMatch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sensor_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
    return catMatch && stateMatch && searchMatch
  })

  async function handleFlushBuffer() {
    setIsFlushing(true)
    try {
      await flushEdgeBuffer()
    } finally {
      setIsFlushing(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5); }
          50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(22, 163, 74, 0); }
        }
      `}</style>

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          activeStation={activeStation}
          onSwitchStation={() =>
            setActiveStation(activeStation === 'maitri' ? 'bharati' : 'maitri')
          }
        />

        <main
          id="main-content"
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}
        >
          <div style={{ flex: 1, padding: '10px 14px' }}>

            {/* Breadcrumb */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '6px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}
                >
                  Home
                </button>
                <span>›</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>Polar Operations</span>
                <span>›</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>Infrastructure Digital Twin &amp; IoT Bus</span>
              </div>

              {/* View Switcher Tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setActiveTab('twin')}
                  style={{
                    background: activeTab === 'twin' ? '#0b3b60' : '#f1f5f9',
                    color: activeTab === 'twin' ? '#ffffff' : '#334155',
                    border: 'none',
                    padding: '4px 12px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>apartment</span>
                  <span>INFRASTRUCTURE DIGITAL TWIN</span>
                </button>

                <button
                  onClick={() => setActiveTab('registry')}
                  style={{
                    background: activeTab === 'registry' ? '#0b3b60' : '#f1f5f9',
                    color: activeTab === 'registry' ? '#ffffff' : '#334155',
                    border: 'none',
                    padding: '4px 12px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sensors</span>
                  <span>IOT SENSOR REGISTRY ({totalCount})</span>
                </button>
              </div>
            </div>

            {/* Connection Link State Banner */}
            {!isOnline ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderLeft: '5px solid #dc2626',
                  padding: '10px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#dc2626' }}>
                    cloud_off
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>
                      VSAT SATELLITE LINK SEVERED — AUTONOMOUS EDGE BUFFER ACTIVE
                    </div>
                    <div style={{ fontSize: 10.5, color: '#7f1d1d' }}>
                      IoT sensor telemetry is currently accumulating in the station's Edge Black Box ring buffer ({edgeBufferCount} frames stored with SHA-256 hash chains).
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleFlushBuffer}
                    disabled={isFlushing}
                    style={{
                      background: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 3,
                    }}
                  >
                    {isFlushing ? 'RECONNECTING...' : '⚡ RESTORE LINK & SYNC BUFFER'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderLeft: '5px solid #16a34a',
                  padding: '8px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🟢</span>
                  <div>
                    <strong style={{ color: '#15803d' }}>
                      VSAT LINK ONLINE — REAL-TIME IOT SENSOR STREAM ACTIVE
                    </strong>
                    <span style={{ color: '#166534', marginLeft: 8 }}>
                      Telemetry bus is streaming live directly to HQ Neon DB without buffering. Autonomous Black Box is on standby.
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: '#15803d', fontWeight: 800, fontFamily: 'monospace' }}>
                  LATENCY: 42ms • POLLING: 30s
                </span>
              </div>
            )}

            {/* Active Anomaly Banner */}
            {lastAnomalyResult && (
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderLeft: '5px solid #e11d48',
                  padding: '10px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🚨</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#9f1239' }}>
                      ACTIVE INJECTED INCIDENT: {lastAnomalyResult.anomaly_name} ({lastAnomalyResult.severity})
                    </div>
                    <div style={{ fontSize: 10.5, color: '#881337', marginTop: 2 }}>
                      {lastAnomalyResult.description} • Station: {lastAnomalyResult.station_id.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => navigate('/blackbox')}
                    style={{
                      background: '#be123c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span>
                    <span>BLACK BOX FLIGHT RECORDER</span>
                  </button>
                </div>
              </div>
            )}

            {/* Page Hero Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0b3b60 0%, #1e4d78 60%, #0b3b60 100%)',
                color: '#ffffff',
                padding: '14px 20px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ff9933' }}>domain</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.02em' }}>
                      🏢 ANTARCTIC INFRASTRUCTURE DIGITAL TWIN &amp; IOT BUS
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      {activeStation === 'maitri' ? 'Maitri Research Station (Schirmacher Oasis)' : 'Bharati Research Station (Larsemann Hills)'} • NCPOR / MoES
                    </div>
                  </div>
                </div>
              </div>

              {/* Station Switcher */}
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                {(['maitri', 'bharati'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setActiveStation(s)
                      setSelectedCategory('all')
                      setSelectedState('all')
                      setSearchQuery('')
                    }}
                    style={{
                      background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)',
                      border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.25)',
                      color: '#ffffff',
                      padding: '7px 18px',
                      fontWeight: 900,
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 3,
                      letterSpacing: '0.06em',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s === 'maitri' ? '🏔️ MAITRI' : '🌊 BHARATI'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
              {/* Total */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0b3b60', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOTAL SENSORS</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#0b3b60' }}>sensors</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#0b3b60' }}>{totalCount}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Across {currentZones.length} Physical Zones
                </div>
              </div>

              {/* Online */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #16a34a', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ONLINE</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#16a34a' }}>wifi</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#16a34a' }}>{onlineCount}</div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  ● Transmitting telemetry
                </div>
              </div>

              {/* Offline */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #dc2626', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>OFFLINE / DEVIATION</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#dc2626' }}>wifi_off</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: offlineCount > 0 ? '#dc2626' : '#16a34a' }}>
                  {offlineCount}
                </div>
                <div style={{ fontSize: 10, color: offlineCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                  {offlineCount > 0 ? '⚠️ Sensor attention required' : '✅ All sensors nominal'}
                </div>
              </div>

              {/* Physical Subsystems */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #7c3aed', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PHYSICAL ZONES</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#7c3aed' }}>hub</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed' }}>
                  {currentZones.length}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Digital Twin Modules</div>
              </div>
            </div>

            {/* TAB CONTENT: DIGITAL TWIN VIEW */}
            {activeTab === 'twin' && (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#0b3b60', textTransform: 'uppercase' }}>
                      {activeStation === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station'} — Subsystem Schematic Grid
                    </h3>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                      Interactive visual digital twin mapping physical engineering bays to monitored telemetry buses
                    </div>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 2 }}>
                    NCPOR Digital Twin Core v2.4
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {currentZones.map((zone) => (
                    <PhysicalZoneCard
                      key={zone.id}
                      zone={zone}
                      anomaly={lastAnomalyResult}
                      sensors={allSensors}
                      onSelectCategory={(cat) => {
                        setSelectedCategory(cat)
                        setActiveTab('registry')
                      }}
                      onSelectSensor={(sensor) => setSelectedSensor(sensor)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SENSOR REGISTRY VIEW */}
            {activeTab === 'registry' && (
              <div>
                {/* Filter Bar */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderTop: '3px solid #0b3b60',
                    padding: '12px 16px',
                    marginBottom: 12,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', margin: 0, textTransform: 'uppercase' }}>
                        IoT Sensor Registry — {activeStation === 'maitri' ? 'Maitri' : 'Bharati'} Station
                      </h3>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        Click any sensor card to inspect operational thresholds, min/max limits, and telemetry channels
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', border: '1px solid #bae6fd', borderRadius: 2 }}>
                        NCPOR Telemetry Network
                      </span>
                    </div>
                  </div>

                  {/* Search + State Filter */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#64748b' }}>search</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by sensor name, ID, location, or category..."
                        style={{ flex: 1, border: '1px solid #cbd5e1', padding: '5px 10px', fontSize: 11, outline: 'none' }}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {/* State filter pills */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['all', 'online', 'offline'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedState(s)}
                          style={{
                            background: selectedState === s
                              ? s === 'online' ? '#16a34a' : s === 'offline' ? '#dc2626' : '#0b3b60'
                              : '#f1f5f9',
                            color: selectedState === s ? '#ffffff' : '#334155',
                            border: 'none',
                            padding: '4px 12px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                            borderRadius: 3,
                            textTransform: 'uppercase',
                          }}
                        >
                          {s === 'all' ? `All (${totalCount})` : s === 'online' ? `🟢 Online (${onlineCount})` : `🔴 Offline (${offlineCount})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category chips */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSelectedCategory('all')}
                      style={{
                        background: selectedCategory === 'all' ? '#0b3b60' : '#f1f5f9',
                        color: selectedCategory === 'all' ? '#ffffff' : '#334155',
                        border: 'none',
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: 3,
                      }}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => {
                      const meta = getCatMeta(cat.key)
                      const count = allSensors.filter((s) => s.category === cat.key).length
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setSelectedCategory(cat.key)}
                          style={{
                            background: selectedCategory === cat.key ? meta.color : meta.bg,
                            color: selectedCategory === cat.key ? '#ffffff' : meta.color,
                            border: `1px solid ${meta.border}`,
                            padding: '4px 10px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderRadius: 3,
                          }}
                        >
                          {meta.emoji} {cat.label} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sensor Cards Grid */}
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: 13 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, color: '#0b3b60' }}>
                      sensors
                    </span>
                    Loading sensor registry...
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#64748b', fontSize: 13 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>search_off</span>
                    No sensors match your current filters.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {filtered.map((sensor) => (
                      <SensorCard
                        key={sensor.sensor_id}
                        sensor={sensor}
                        anomaly={lastAnomalyResult}
                        onClick={() => setSelectedSensor(sensor)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Sensor Detail Modal */}
          {selectedSensor && (
            <SensorDetailModal
              sensor={selectedSensor}
              anomaly={lastAnomalyResult}
              onClose={() => setSelectedSensor(null)}
            />
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}
