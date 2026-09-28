import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStation } from '../../context/StationContext'
import { addShipmentRequisition, getShipmentRequisitions, type RequisitionItem } from '../../utils/shipmentRequisitions'
import { generateIncidentDamageAssessmentPDF } from '../../utils/pdfGenerator'

interface AnomalyDataModel {
  title: string
  subsystem: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  energyLossKwh: number
  powerSpikeKw: number
  normalPowerKw: number
  anomalyPowerKw: number
  fuelLossLitres: number
  normalFuelBurnLh: number
  anomalyFuelBurnLh: number
  financialLossInr: number
  carbonFootprintKg: number
  dataLossMb: number
  packetsDelayed: number
  tempVarianceC: number
  downtimeHours: number
  impactsByDepartment: {
    dept: string
    icon: string
    color: string
    badge: string
    summary: string
    details: string
  }[]
  actionChecklist: {
    step: string
    desc: string
    urgency: 'IMMEDIATE' | 'HIGH' | 'ROUTINE'
  }[]
  shipmentRecommendations: {
    id: string
    name: string
    sku: string
    category: RequisitionItem['category']
    quantity: number
    unit: string
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'
    reason: string
  }[]
}

function getAnomalyModel(anomalyId: string, stationId: string): AnomalyDataModel {
  const aid = (anomalyId || '').toLowerCase()

  if (aid.includes('generator') || aid.includes('power') || aid.includes('solar_inverter')) {
    return {
      title: 'Power Generation Failure & Grid Load Surge',
      subsystem: 'Diesel Generator #1 & Electrical Busbar',
      severity: 'CRITICAL',
      energyLossKwh: 340,
      powerSpikeKw: 88.5,
      normalPowerKw: 42.0,
      anomalyPowerKw: 88.5,
      fuelLossLitres: 92,
      normalFuelBurnLh: 18.5,
      anomalyFuelBurnLh: 38.2,
      financialLossInr: 68400,
      carbonFootprintKg: 242,
      dataLossMb: 0.8,
      packetsDelayed: 18,
      tempVarianceC: -4.2,
      downtimeHours: 4.5,
      impactsByDepartment: [
        {
          dept: 'Power & Grid Engineering',
          icon: 'bolt',
          color: '#dc2626',
          badge: 'PRIMARY BREACH',
          summary: 'DG-1 Breaker Tripped, High Harmonic Distortion',
          details: 'Automatic emergency cutover to DG-2 auxiliary bus completed. Alternator winding temperature spiked to 104°C, causing 340 kWh of excess load shedding and phase imbalance.',
        },
        {
          dept: 'Habitation & Life Support',
          icon: 'thermostat',
          color: '#ea580c',
          badge: 'MODERATE LOSS',
          summary: 'Cabin Thermal Heat Loop Throttled',
          details: 'Living quarter heating curtailed by 35% to protect critical medical bay and emergency communications power circuits.',
        },
        {
          dept: 'Telecom & Ground Link',
          icon: 'satellite_alt',
          color: '#ca8a04',
          badge: 'STANDBY MODE',
          summary: 'GSAT-30 Transmitter in Low-Power Fallback',
          details: 'Satellite high-power amplifier scaled down to 400W standby mode; non-critical video telemetry deferred.',
        },
        {
          dept: 'Logistics & Fuel Stores',
          icon: 'local_gas_station',
          color: '#b91c1c',
          badge: 'DRAIN DETECTED',
          summary: '92L Emergency Fuel Burned',
          details: 'Unscheduled fuel surge consumed 92L Arctic Diesel ATF-50. Fuel reserve run-time reduced by 4 days until next resupply.',
        },
      ],
      actionChecklist: [
        { step: '1. Lockout & Tagout DG-1', desc: 'Isolate main circuit breaker and verify alternator insulation resistance.', urgency: 'IMMEDIATE' },
        { step: '2. Transfer Non-Essential Loads to Solar Microgrid', desc: 'Deploy battery BESS buffer to relieve DG-2 auxiliary generator.', urgency: 'IMMEDIATE' },
        { step: '3. Inspect Fuel Injection Filters', desc: 'Check for wax clogging or fuel line cavitation under sub-zero suction.', urgency: 'HIGH' },
        { step: '4. Requisition Critical Spares for Next Vessel Shipment', desc: 'Add fuel filters, AVR regulator, and replacement fuel drums to manifest.', urgency: 'HIGH' },
      ],
      shipmentRecommendations: [
        {
          id: `req-gen-filter-${stationId}`,
          name: 'Heavy-Duty Fuel Injection Filter Set (DG-400)',
          sku: 'SP-DG400-FLT',
          category: 'Mechanical Spares',
          quantity: 2,
          unit: 'Sets',
          priority: 'CRITICAL',
          reason: 'Replacement for fouled primary generator injection filters',
        },
        {
          id: `req-gen-fuel-${stationId}`,
          name: 'Arctic Diesel Bio-Blend ATF-50 (-55°C Pour Point)',
          sku: 'FL-ATF50-200L',
          category: 'Fuel',
          quantity: 200,
          unit: 'Litres',
          priority: 'CRITICAL',
          reason: 'Emergency burn reserve replenishment for upcoming wintering',
        },
        {
          id: `req-gen-avr-${stationId}`,
          name: 'Digital Automatic Voltage Regulator (AVR-800)',
          sku: 'EL-AVR-800D',
          category: 'Electrical Spares',
          quantity: 1,
          unit: 'Unit',
          priority: 'HIGH',
          reason: 'Buffer spare for surge suppression on generator alternator',
        },
        {
          id: `req-gen-oil-${stationId}`,
          name: 'Synthetic Low-Temp Engine Oil (0W-40 Polar)',
          sku: 'LB-0W40-POLAR',
          category: 'Mechanical Spares',
          quantity: 40,
          unit: 'Litres',
          priority: 'MEDIUM',
          reason: 'Complete engine flush and lube renewal post-overheat trip',
        },
      ],
    }
  }

  if (aid.includes('vsat') || aid.includes('comm') || aid.includes('satellite') || aid.includes('iot_gateway')) {
    return {
      title: 'VSAT Satellite Link Loss & Ground Blackout',
      subsystem: 'ISRO GSAT-30 Ku-Band Antenna & Radome',
      severity: 'CRITICAL',
      energyLossKwh: 120,
      powerSpikeKw: 46.2,
      normalPowerKw: 42.0,
      anomalyPowerKw: 46.2,
      fuelLossLitres: 16,
      normalFuelBurnLh: 18.5,
      anomalyFuelBurnLh: 21.0,
      financialLossInr: 42800,
      carbonFootprintKg: 44,
      dataLossMb: 24.5,
      packetsDelayed: 184,
      tempVarianceC: 0.0,
      downtimeHours: 3.2,
      impactsByDepartment: [
        {
          dept: 'Telecom & Ground Link',
          icon: 'satellite_alt',
          color: '#dc2626',
          badge: 'OFFLINE',
          summary: 'GSAT-30 Ku-Band High-Gain Carrier Lost',
          details: 'Gimbal tracking motor stalled due to sub-zero icing; zero downlink to NCPOR Goa. Emergency Iridium SBD ping activated as 128-byte lifeline.',
        },
        {
          dept: 'HQ Command & Operations (NCPOR)',
          icon: 'apartment',
          color: '#ea580c',
          badge: 'DELAYED SYNC',
          summary: 'Live Mission Control Telemetry Paused',
          details: '24.5 MB telemetry queue buffered in SQLite edge storage. Video surveillance, weather radar upload, and remote drone feeds temporarily frozen.',
        },
        {
          dept: 'Scientific Research & Labs',
          icon: 'science',
          color: '#ca8a04',
          badge: 'EDGE QUEUED',
          summary: 'Atmospheric & Seismic Packets Cached Locally',
          details: 'Zero scientific data lost thanks to Himantar VajraX Protobuf buffer; all records preserved for bulk uplink once dish locks.',
        },
        {
          dept: 'Power & Infrastructure',
          icon: 'bolt',
          color: '#64748b',
          badge: 'HEATER DRAW',
          summary: 'Radome De-Icer Continuous Draw (+4.2 kW)',
          details: 'Antenna heating elements drawing emergency power to thaw elevation drive worm gear.',
        },
      ],
      actionChecklist: [
        { step: '1. Initiate Radome Heating Boost Cycle', desc: 'Switch antenna de-icing heaters to maximum 5.5 kW defrost mode for 30 minutes.', urgency: 'IMMEDIATE' },
        { step: '2. Verify SQLite Edge Buffer Integrity', desc: 'Ensure edge storage write-rate is unthrottled and retention threshold is valid.', urgency: 'IMMEDIATE' },
        { step: '3. Perform Manual Dish Azimuth Calibration', desc: 'Send technician with safety harness to inspect antenna alignment pins.', urgency: 'HIGH' },
        { step: '4. Requisition Weatherproof RF Spares', desc: 'Order replacement LNB receiver and coaxial feedline for next expedition cargo vessel.', urgency: 'HIGH' },
      ],
      shipmentRecommendations: [
        {
          id: `req-vsat-lnb-${stationId}`,
          name: 'ISRO GSAT Ku-Band Low Noise Block (LNB) Receiver',
          sku: 'TC-LNB-KU-01',
          category: 'Telecom & IT',
          quantity: 1,
          unit: 'Unit',
          priority: 'CRITICAL',
          reason: 'Replacement for weather-degraded antenna receiver head',
        },
        {
          id: `req-vsat-cable-${stationId}`,
          name: 'RG-213 Low-Loss Polar Weatherproof Coaxial Cable (50m)',
          sku: 'TC-CBL-RG213-50M',
          category: 'Telecom & IT',
          quantity: 2,
          unit: 'Reels',
          priority: 'HIGH',
          reason: 'Replace frost-cracked antenna feedline cable run',
        },
        {
          id: `req-vsat-modem-${stationId}`,
          name: 'Satellite Indoor Unit (IDU) Demodulator Card',
          sku: 'TC-MDM-IDU-X',
          category: 'Telecom & IT',
          quantity: 1,
          unit: 'Unit',
          priority: 'MEDIUM',
          reason: 'Redundancy backup for mission control communication rack',
        },
        {
          id: `req-vsat-seal-${stationId}`,
          name: 'Sub-Zero Silicone Radome Weather Sealant Kit',
          sku: 'SP-SEAL-RDM-02',
          category: 'Mechanical Spares',
          quantity: 4,
          unit: 'Kits',
          priority: 'MEDIUM',
          reason: 'Environmental moisture barrier for antenna dome housing',
        },
      ],
    }
  }

  if (aid.includes('fuel') || aid.includes('leak')) {
    return {
      title: 'Main Fuel Delivery Line Leak & Pressure Drop',
      subsystem: 'Fuel Transfer Manifold & Day Tank Supply',
      severity: 'CRITICAL',
      energyLossKwh: 260,
      powerSpikeKw: 44.0,
      normalPowerKw: 42.0,
      anomalyPowerKw: 44.0,
      fuelLossLitres: 125,
      normalFuelBurnLh: 18.5,
      anomalyFuelBurnLh: 46.0,
      financialLossInr: 96250,
      carbonFootprintKg: 328,
      dataLossMb: 0.2,
      packetsDelayed: 6,
      tempVarianceC: -1.5,
      downtimeHours: 2.8,
      impactsByDepartment: [
        {
          dept: 'Logistics & Fuel Stores',
          icon: 'local_gas_station',
          color: '#dc2626',
          badge: 'CRITICAL LEAK',
          summary: '125L Arctic Diesel Escaped to Secondary Containment',
          details: 'Pressure fell from 3.8 bar to 1.9 bar in Sector-B pipeline. Secondary double-wall containment prevented oasis contamination.',
        },
        {
          dept: 'Power Engineering',
          icon: 'bolt',
          color: '#ea580c',
          badge: 'RE-ROUTED',
          summary: 'Generator Supply Switched to Emergency Day Tank',
          details: 'DG fuel suction rerouted. Available uninterrupted run-time dropped by 58 hours until manifold repair.',
        },
        {
          dept: 'Environmental Safety',
          icon: 'eco',
          color: '#16a34a',
          badge: 'SUMP CONTAINED',
          summary: 'Zero Soil Contamination Detected',
          details: 'Hydrocarbon absorbent pads deployed in containment sump; Arctic treaty environmental compliance protocol initiated.',
        },
      ],
      actionChecklist: [
        { step: '1. Close Emergency Fuel Shutoff Valve V-04', desc: 'Isolate Sector-B delivery line immediately.', urgency: 'IMMEDIATE' },
        { step: '2. Switch Suction to Auxiliary Reserve Day Tank', desc: 'Verify fuel pressure recovers to nominal 3.5 bar.', urgency: 'IMMEDIATE' },
        { step: '3. Deploy Spill Containment Boom Kit', desc: 'Recover pooled fuel in secondary stainless containment pan.', urgency: 'HIGH' },
        { step: '4. Add Arctic Fuel Hose & Replacement Drums to Shipment', desc: 'Requisition new -50°C rated hoses and fuel drums.', urgency: 'HIGH' },
      ],
      shipmentRecommendations: [
        {
          id: `req-fuel-hose-${stationId}`,
          name: 'Arctic Reinforced Double-Braid Fuel Transfer Hose (2-Inch, -55°C)',
          sku: 'FL-HSE-2IN-55C',
          category: 'Mechanical Spares',
          quantity: 2,
          unit: 'Hoses',
          priority: 'CRITICAL',
          reason: 'Direct replacement for ruptured high-pressure transfer line',
        },
        {
          id: `req-fuel-drum-${stationId}`,
          name: 'Arctic Diesel Bio-Blend ATF-50 (200L Steel Drum)',
          sku: 'FL-DRUM-200L-ATF',
          category: 'Fuel',
          quantity: 2,
          unit: 'Drums',
          priority: 'CRITICAL',
          reason: 'Direct replenish of 125L lost fuel and safety reserve margin',
        },
        {
          id: `req-fuel-spill-${stationId}`,
          name: 'Hydrocarbon Absorbent Chemical Spill Kit (100L Capacity)',
          sku: 'SF-SPL-100L-HYD',
          category: 'Safety',
          quantity: 2,
          unit: 'Kits',
          priority: 'HIGH',
          reason: 'Restock consumed environmental spill containment inventory',
        },
      ],
    }
  }

  if (aid.includes('blizzard') || aid.includes('freeze') || aid.includes('weather')) {
    return {
      title: 'Severe Katabatic Blizzard & Met Sensor Freeze',
      subsystem: 'Meteorological Mast & Exterior HVAC Intake',
      severity: 'CRITICAL',
      energyLossKwh: 210,
      powerSpikeKw: 56.4,
      normalPowerKw: 42.0,
      anomalyPowerKw: 56.4,
      fuelLossLitres: 48,
      normalFuelBurnLh: 18.5,
      anomalyFuelBurnLh: 28.5,
      financialLossInr: 39500,
      carbonFootprintKg: 126,
      dataLossMb: 1.4,
      packetsDelayed: 44,
      tempVarianceC: -8.5,
      downtimeHours: 6.0,
      impactsByDepartment: [
        {
          dept: 'Meteorology & Earth Science',
          icon: 'ac_unit',
          color: '#dc2626',
          badge: 'ICE-LOCKED',
          summary: 'Met-Mast Cup Anemometer Rime-Iced',
          details: 'Wind speeds exceeding 148 km/h packed wet snow into sensor bearings, clamping mechanical wind readings.',
        },
        {
          dept: 'Station Safety & Operations',
          icon: 'warning',
          color: '#ea580c',
          badge: 'CONDITION RED',
          summary: 'Outdoor Mobility Prohibited (0m Visibility)',
          details: 'All outdoor transit suspended; lifeline guide ropes iced over. Personnel restricted to core habitation modules.',
        },
        {
          dept: 'Power & Grid Systems',
          icon: 'bolt',
          color: '#ca8a04',
          badge: '+14.4 kW LOAD',
          summary: 'Exterior Heat Tracing Running at 100%',
          details: 'Emergency de-icing heating coils drawing 210 kWh excess power to keep intake louvers and sewer pipes flowing.',
        },
      ],
      actionChecklist: [
        { step: '1. Declare Station Condition Red (Blizzard Lockout)', desc: 'Sound indoor horn and ensure all perimeter airlocks are sealed.', urgency: 'IMMEDIATE' },
        { step: '2. Engage Heat Trace Override on Met Tower', desc: 'Apply maximum 48V de-icing voltage to anemometer and temperature shield.', urgency: 'IMMEDIATE' },
        { step: '3. Verify Solar Inverter Protection Breakers', desc: 'Isolate snow-drift covered exterior PV panels to prevent reverse leakage.', urgency: 'HIGH' },
        { step: '4. Requisition Ultrasonic Heated Weather Sensors', desc: 'Add solid-state heated anemometer to upcoming voyage cargo.', urgency: 'HIGH' },
      ],
      shipmentRecommendations: [
        {
          id: `req-met-anemometer-${stationId}`,
          name: 'Ultrasonic Heated Solid-State Anemometer (No Moving Parts)',
          sku: 'SC-MET-ANM-HEAT',
          category: 'Scientific',
          quantity: 1,
          unit: 'Unit',
          priority: 'CRITICAL',
          reason: 'Ice-immune wind sensor upgrade for extreme Katabatic gales',
        },
        {
          id: `req-met-heat-cable-${stationId}`,
          name: 'Industrial Self-Regulating Heat Trace Cable (100m Spool)',
          sku: 'EL-HT-CBL-100M',
          category: 'Electrical Spares',
          quantity: 2,
          unit: 'Spools',
          priority: 'HIGH',
          reason: 'Defrost heating reinforcement for exterior pipework and louvers',
        },
        {
          id: `req-met-anchor-${stationId}`,
          name: 'High-Tensile Stainless Met-Mast Guy Wire & Turnbuckle Kit',
          sku: 'ME-GUY-SS-M16',
          category: 'Mechanical Spares',
          quantity: 4,
          unit: 'Sets',
          priority: 'MEDIUM',
          reason: 'Structural reinforcement against storm wind gust vibrations',
        },
      ],
    }
  }

  // Fallback for Fire / HVAC / Earthquake / Default
  return {
    title: 'Emergency Subsystem Disruption & Safety Trip',
    subsystem: 'Central Infrastructure & Core Facility',
    severity: 'HIGH',
    energyLossKwh: 180,
    powerSpikeKw: 52.0,
    normalPowerKw: 42.0,
    anomalyPowerKw: 52.0,
    fuelLossLitres: 38,
    normalFuelBurnLh: 18.5,
    anomalyFuelBurnLh: 26.5,
    financialLossInr: 34200,
    carbonFootprintKg: 99,
    dataLossMb: 1.1,
    packetsDelayed: 24,
    tempVarianceC: -2.8,
    downtimeHours: 3.0,
    impactsByDepartment: [
      {
        dept: 'Station Engineering',
        icon: 'build',
        color: '#dc2626',
        badge: 'FAULT ISOLATED',
        summary: 'Primary Circuit Trip & Failover Triggered',
        details: 'Subsystem automated safety interlock engaged. Auxiliary reserves took over the load with minor transient disturbance.',
      },
      {
        dept: 'Habitation & Crew Quarters',
        icon: 'apartment',
        color: '#ea580c',
        badge: 'MONITORED',
        summary: 'Safety Interlocks Active',
        details: 'Atmospheric and thermal parameters continuously monitored by Himantar edge intelligence; crew alerted.',
      },
      {
        dept: 'Logistics & Re-supply',
        icon: 'inventory_2',
        color: '#2563eb',
        badge: 'AUDIT REQUIRED',
        summary: 'Inventory Draw Tracked',
        details: 'Spare fuses and backup fluids consumed during emergency response; logged for upcoming voyage requisition.',
      },
    ],
    actionChecklist: [
      { step: '1. Verify Diagnostic Sensor Readouts', desc: 'Cross-examine Himantar IoT telemetry with physical gauges.', urgency: 'IMMEDIATE' },
      { step: '2. Execute Station Standard Operating Procedure (SOP-4)', desc: 'Restore primary telemetry link and clear secondary warning flags.', urgency: 'IMMEDIATE' },
      { step: '3. Queue Replenishment Requisitions', desc: 'Add replacement consumables and buffer components to next shipment manifest.', urgency: 'HIGH' },
    ],
    shipmentRecommendations: [
      {
        id: `req-gen-spares-${stationId}`,
        name: 'Station Electrical Overhaul Fuse & Breaker Replenishment Kit',
        sku: 'EL-FUSE-KIT-415V',
        category: 'Electrical Spares',
        quantity: 2,
        unit: 'Kits',
        priority: 'HIGH',
        reason: 'Restock fast-acting protection fuses consumed during trip',
      },
      {
        id: `req-gen-fluids-${stationId}`,
        name: 'Polar Glycol Heat Exchange Fluid (-60°C Blend, 25L)',
        sku: 'LS-GLY-60C-25L',
        category: 'Life Support',
        quantity: 2,
        unit: 'Canisters',
        priority: 'HIGH',
        reason: 'Maintain thermal heating loop buffer margin',
      },
      {
        id: `req-gen-sensor-${stationId}`,
        name: 'Industrial PT100 Sub-Zero Temperature Sensor Probe',
        sku: 'SC-PT100-POLAR',
        category: 'Scientific',
        quantity: 2,
        unit: 'Units',
        priority: 'MEDIUM',
        reason: 'Replace calibration-drifted diagnostic sensor',
      },
    ],
  }
}

interface IncidentImpactModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function IncidentImpactModal({ isOpen, onClose }: IncidentImpactModalProps) {
  const navigate = useNavigate()
  const {
    lastAnomalyResult,
    completedIncidentResult,
    setLastAnomalyResult,
    stationId,
    refreshLinkState,
  } = useStation()

  const incidentData = lastAnomalyResult || completedIncidentResult
  const isResolved = !lastAnomalyResult && Boolean(completedIncidentResult)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'losses' | 'departments' | 'actions' | 'shipment'>('losses')

  const anomalyId = incidentData?.anomaly_id || 'generator_failure'
  const model = useMemo(() => getAnomalyModel(anomalyId, stationId), [anomalyId, stationId])

  // Sync already added items from storage on mount
  useEffect(() => {
    const existing = getShipmentRequisitions(stationId)
    const map: Record<string, boolean> = {}
    existing.forEach((item) => {
      map[item.id] = true
    })
    setAddedItems(map)
  }, [stationId, isOpen])

  // Auto-hide toast after 3s
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3200)
    return () => clearTimeout(t)
  }, [toastMessage])

  if (!isOpen || !incidentData) return null

  function handleQuantityChange(id: string, delta: number, currentBase: number) {
    const curr = quantities[id] !== undefined ? quantities[id] : currentBase
    const next = Math.max(1, curr + delta)
    setQuantities((prev) => ({ ...prev, [id]: next }))
  }

  function handleAddToShipment(rec: AnomalyDataModel['shipmentRecommendations'][0]) {
    const qty = quantities[rec.id] !== undefined ? quantities[rec.id] : rec.quantity
    const item: RequisitionItem = {
      id: rec.id,
      name: rec.name,
      sku: rec.sku,
      category: rec.category,
      quantity: qty,
      unit: rec.unit,
      priority: rec.priority,
      reason: rec.reason,
      stationId: stationId === 'bharati' ? 'bharati' : 'maitri',
      addedAt: new Date().toISOString(),
      sourceAnomaly: incidentData?.anomaly_name || model.title,
    }

    addShipmentRequisition(item)
    setAddedItems((prev) => ({ ...prev, [rec.id]: true }))
    setToastMessage(`Added ${qty}x "${rec.name}" to Upcoming Voyage Requisition Manifest!`)
  }

  function handleAddAllToShipment() {
    let count = 0
    model.shipmentRecommendations.forEach((rec) => {
      const qty = quantities[rec.id] !== undefined ? quantities[rec.id] : rec.quantity
      const item: RequisitionItem = {
        id: rec.id,
        name: rec.name,
        sku: rec.sku,
        category: rec.category,
        quantity: qty,
        unit: rec.unit,
        priority: rec.priority,
        reason: rec.reason,
        stationId: stationId === 'bharati' ? 'bharati' : 'maitri',
        addedAt: new Date().toISOString(),
        sourceAnomaly: incidentData?.anomaly_name || model.title,
      }
      addShipmentRequisition(item)
      count++
    })

    const newAdded: Record<string, boolean> = { ...addedItems }
    model.shipmentRecommendations.forEach((r) => {
      newAdded[r.id] = true
    })
    setAddedItems(newAdded)
    setToastMessage(`Successfully queued all ${count} emergency recovery items for Voyage #EXP-44!`)
  }

  function handleDownloadPdf() {
    if (!incidentData) return
    generateIncidentDamageAssessmentPDF({
      stationId,
      anomalyName: incidentData.anomaly_name || model.title,
      anomalyId: incidentData.anomaly_id,
      severity: incidentData.severity || model.severity,
      referenceId: incidentData.report_reference || incidentData.incident_id || 'INC-POLAR-99',
      injectedAt: incidentData.injected_at,
      losses: {
        energyLossKwh: model.energyLossKwh,
        powerSpikeKw: model.powerSpikeKw,
        normalPowerKw: model.normalPowerKw,
        anomalyPowerKw: model.anomalyPowerKw,
        fuelLossLitres: model.fuelLossLitres,
        normalFuelBurnLh: model.normalFuelBurnLh,
        anomalyFuelBurnLh: model.anomalyFuelBurnLh,
        financialLossInr: model.financialLossInr,
        carbonFootprintKg: model.carbonFootprintKg,
        dataLossMb: model.dataLossMb,
        packetsDelayed: model.packetsDelayed,
        tempVarianceC: model.tempVarianceC,
        downtimeHours: model.downtimeHours,
        subsystem: model.subsystem,
      },
      departments: model.impactsByDepartment.map((d) => ({
        dept: d.dept,
        badge: d.badge,
        summary: d.summary,
        details: d.details,
      })),
      actionChecklist: model.actionChecklist,
      shipmentItems: model.shipmentRecommendations.map((r) => {
        const qty = quantities[r.id] !== undefined ? quantities[r.id] : r.quantity
        return {
          name: r.name,
          sku: r.sku,
          category: r.category,
          quantity: qty,
          unit: r.unit,
          priority: r.priority,
          reason: r.reason,
        }
      }),
    })
    setToastMessage('📄 Official Government Damage Assessment PDF Downloaded!')
  }

  function handleTerminateAnomaly() {
    setLastAnomalyResult(null)
    refreshLinkState()
  }

  function handleNavigateToLogistics() {
    onClose()
    navigate('/logistics')
  }

  const allRecommendationsAdded = model.shipmentRecommendations.every((r) => addedItems[r.id])

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .loss-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
        }
      `}</style>

      {/* Main Modal Container */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          border: '2px solid #b91c1c',
          boxShadow: '0 25px 50px -12px rgba(185, 28, 28, 0.35), 0 0 0 1px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: 70,
              right: 20,
              zIndex: 100,
              background: '#064e3b',
              color: '#ecfdf5',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #10b981',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>✅</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Top Header */}
        <div
          style={{
            background: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 50%, #7f1d1d 100%)',
            color: '#ffffff',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #ef4444',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              📊
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.03em' }}>
                  INCIDENT DAMAGE, RESOURCE LOSS & SHIPMENT REQUISITION REPORT
                </span>
                <span
                  style={{
                    background: isResolved ? '#15803d' : '#dc2626',
                    fontSize: 9,
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: 3,
                    border: `1px solid ${isResolved ? '#86efac' : '#fca5a5'}`,
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{isResolved ? '✓' : '⚠️'}</span>
                  <span>{isResolved ? 'ANOMALY RESOLVED & CLOSED' : model.severity}</span>
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: '#fecaca', marginTop: 2 }}>
                Station: <strong>{stationId.toUpperCase()}</strong> • Subsystem: <strong>{model.subsystem}</strong> • Event: <strong>{incidentData.anomaly_name || model.title}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleDownloadPdf}
              style={{
                background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                color: '#ffffff',
                border: '1px solid #86efac',
                padding: '5px 12px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
              title="Export official Government Incident & Shipment Manifest PDF"
            >
              <span>📄</span>
              <span>Download PDF Report</span>
            </button>

            {!isResolved && (
              <button
                onClick={handleTerminateAnomaly}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="End and resolve this active anomaly"
              >
                <span>⏹</span>
                <span>End Anomaly</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: 'none',
                fontSize: 18,
                fontWeight: 900,
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close window (Anomaly remains active)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setActiveTab('losses')}
              style={{
                background: activeTab === 'losses' ? '#ffffff' : 'transparent',
                color: activeTab === 'losses' ? '#b91c1c' : '#475569',
                border: activeTab === 'losses' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderBottom: activeTab === 'losses' ? '2px solid #b91c1c' : 'none',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>⚡</span>
              <span>Loss & Energy Compare</span>
            </button>

            <button
              onClick={() => setActiveTab('departments')}
              style={{
                background: activeTab === 'departments' ? '#ffffff' : 'transparent',
                color: activeTab === 'departments' ? '#b91c1c' : '#475569',
                border: activeTab === 'departments' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderBottom: activeTab === 'departments' ? '2px solid #b91c1c' : 'none',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🏢</span>
              <span>Departmental Impact</span>
            </button>

            <button
              onClick={() => setActiveTab('actions')}
              style={{
                background: activeTab === 'actions' ? '#ffffff' : 'transparent',
                color: activeTab === 'actions' ? '#b91c1c' : '#475569',
                border: activeTab === 'actions' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderBottom: activeTab === 'actions' ? '2px solid #b91c1c' : 'none',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🛠️</span>
              <span>Action Protocol</span>
            </button>

            <button
              onClick={() => setActiveTab('shipment')}
              style={{
                background: activeTab === 'shipment' ? '#ffffff' : '#fef2f2',
                color: activeTab === 'shipment' ? '#b91c1c' : '#dc2626',
                border: activeTab === 'shipment' ? '1px solid #cbd5e1' : '1px solid #fecaca',
                borderBottom: activeTab === 'shipment' ? '2px solid #b91c1c' : 'none',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 900,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📦</span>
              <span>Next Shipment Cargo ({model.shipmentRecommendations.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleNavigateToLogistics}
              style={{
                background: '#0b3b60',
                color: '#ffffff',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>📋</span>
              <span>Open Logistics Hub</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          {/* TAB 1: Losses & Comparative Metrics */}
          {activeTab === 'losses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Top 4 Impact KPI Highlight Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {/* 1. Energy Lost */}
                <div
                  className="loss-card-hover"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #ea580c',
                    borderRadius: 4,
                    padding: '10px 14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      ⚡ Energy Wasted
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 900, color: '#c2410c', background: '#fff7ed', padding: '1px 5px', borderRadius: 2 }}>
                      +{Math.round(((model.anomalyPowerKw - model.normalPowerKw) / model.normalPowerKw) * 100)}% Surge
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#c2410c', marginTop: 4 }}>
                    {model.energyLossKwh} <span style={{ fontSize: 11, fontWeight: 600 }}>kWh</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                    Spike: <strong>{model.powerSpikeKw} kW</strong> (Baseline {model.normalPowerKw} kW)
                  </div>
                </div>

                {/* 2. Fuel Waste */}
                <div
                  className="loss-card-hover"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #dc2626',
                    borderRadius: 4,
                    padding: '10px 14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      ⛽ Fuel Consumed / Lost
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 900, color: '#b91c1c', background: '#fef2f2', padding: '1px 5px', borderRadius: 2 }}>
                      Arctic ATF-50
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#b91c1c', marginTop: 4 }}>
                    {model.fuelLossLitres} <span style={{ fontSize: 11, fontWeight: 600 }}>Litres</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                    Burn rate: <strong>{model.anomalyFuelBurnLh} L/h</strong> (Normal {model.normalFuelBurnLh} L/h)
                  </div>
                </div>

                {/* 3. Financial Loss */}
                <div
                  className="loss-card-hover"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #0284c7',
                    borderRadius: 4,
                    padding: '10px 14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      💰 Estimated Cost Loss
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 900, color: '#0369a1', background: '#f0f9ff', padding: '1px 5px', borderRadius: 2 }}>
                      Fuel + Wear
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0369a1', marginTop: 4 }}>
                    ₹{model.financialLossInr.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                    Carbon: <strong>+{model.carbonFootprintKg} kg CO₂ eq</strong>
                  </div>
                </div>

                {/* 4. Downtime & Telemetry */}
                <div
                  className="loss-card-hover"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #7c3aed',
                    borderRadius: 4,
                    padding: '10px 14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      ⏱️ System Degradation
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 900, color: '#6d28d9', background: '#faf5ff', padding: '1px 5px', borderRadius: 2 }}>
                      Downtime
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#6d28d9', marginTop: 4 }}>
                    ~{model.downtimeHours} <span style={{ fontSize: 11, fontWeight: 600 }}>Hours</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                    Telemetry Buffer: <strong>{model.dataLossMb} MB</strong> ({model.packetsDelayed} packets)
                  </div>
                </div>
              </div>

              {/* Side-by-side Before vs During Anomaly Comparison Table */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: '#0b3b60', color: '#ffffff', padding: '8px 14px', fontSize: 11, fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                  <span>📊 TELEMETRY & SYSTEM RESOURCE COMPARISON (NOMINAL vs ANOMALY)</span>
                  <span style={{ fontSize: 9.5, color: '#93c5fd' }}>Polar Edge Telemetry Model</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>Metric Parameter</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>Nominal Baseline</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>During Active Anomaly</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>Variance / Net Loss</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>⚡ Station Power Grid Load</td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 700 }}>{model.normalPowerKw} kW</td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 800 }}>{model.anomalyPowerKw} kW</td>
                        <td style={{ padding: '8px 12px', color: '#b91c1c', fontWeight: 800 }}>+{Number((model.anomalyPowerKw - model.normalPowerKw).toFixed(1))} kW (+{Math.round(((model.anomalyPowerKw - model.normalPowerKw) / model.normalPowerKw) * 100)}%)</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 800 }}>
                            EXCESS SURGE
                          </span>
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fcfcfd' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>⛽ Fuel Consumption Rate</td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 700 }}>{model.normalFuelBurnLh} L/h</td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 800 }}>{model.anomalyFuelBurnLh} L/h</td>
                        <td style={{ padding: '8px 12px', color: '#b91c1c', fontWeight: 800 }}>+{Number((model.anomalyFuelBurnLh - model.normalFuelBurnLh).toFixed(1))} L/h</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 800 }}>
                            HIGH BURN
                          </span>
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>🌡️ Habitat Thermal Stability</td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 700 }}>+21.0 °C (Nominal)</td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 800 }}>{Number((21.0 + model.tempVarianceC).toFixed(1))} °C</td>
                        <td style={{ padding: '8px 12px', color: '#b91c1c', fontWeight: 800 }}>{model.tempVarianceC} °C Deficit</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 800 }}>
                            COMPROMISED
                          </span>
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fcfcfd' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>📡 Telemetry Buffer Hold</td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 700 }}>0 KB (Live Sync)</td>
                        <td style={{ padding: '8px 12px', color: '#ea580c', fontWeight: 800 }}>{model.dataLossMb} MB Edge Cached</td>
                        <td style={{ padding: '8px 12px', color: '#0284c7', fontWeight: 800 }}>{model.packetsDelayed} Packets Queued</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 800 }}>
                            PROTECTED (VajraX)
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Departmental Impact Matrix */}
          {activeTab === 'departments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
                Breakdown of how this specific anomaly impacted each station department, facility section, and operational wing:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 10 }}>
                {model.impactsByDepartment.map((impact, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderLeft: `4px solid ${impact.color}`,
                      borderRadius: 4,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: impact.color }}>
                          {impact.icon}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                          {impact.dept}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          color: impact.color,
                          background: '#f8fafc',
                          border: `1px solid ${impact.color}40`,
                          padding: '1px 6px',
                          borderRadius: 2,
                        }}
                      >
                        {impact.badge}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b' }}>
                      {impact.summary}
                    </div>

                    <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.45 }}>
                      {impact.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Action Protocol */}
          {activeTab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ fontSize: 11, color: '#92400e' }}>
                  <strong>Immediate Standard Operating Procedure (SOP):</strong> Wintering expedition crew members must follow these steps to isolate the fault and prevent secondary cascading grid failures.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {model.actionChecklist.map((act, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0b3b60' }}>
                        {act.step}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
                        {act.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        background: act.urgency === 'IMMEDIATE' ? '#fef2f2' : '#f0f9ff',
                        color: act.urgency === 'IMMEDIATE' ? '#b91c1c' : '#0369a1',
                        border: `1px solid ${act.urgency === 'IMMEDIATE' ? '#fca5a5' : '#bae6fd'}`,
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {act.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Next Shipment Cargo Requisition */}
          {activeTab === 'shipment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Shipment Header Banner */}
              <div
                style={{
                  background: 'linear-gradient(90deg, #0b3b60 0%, #1e40af 100%)',
                  color: '#ffffff',
                  borderRadius: 4,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>
                    📦 NEXT RESUPPLY SHIPMENT / AIR-DROP REQUISITION MANIFEST
                  </div>
                  <div style={{ fontSize: 10.5, color: '#93c5fd', marginTop: 2 }}>
                    Replenishment parts and supplies required to recover from this anomaly for Voyage <strong>#EXP-44</strong> (NCPOR Goa to {stationId.toUpperCase()}).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleAddAllToShipment}
                    disabled={allRecommendationsAdded}
                    style={{
                      background: allRecommendationsAdded ? '#15803d' : '#22c55e',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: allRecommendationsAdded ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    }}
                  >
                    <span>{allRecommendationsAdded ? '✓' : '➕'}</span>
                    <span>{allRecommendationsAdded ? 'All Added to Manifest' : 'Add All to Next Shipment'}</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {model.shipmentRecommendations.map((rec) => {
                  const isAdded = Boolean(addedItems[rec.id])
                  const currentQty = quantities[rec.id] !== undefined ? quantities[rec.id] : rec.quantity

                  return (
                    <div
                      key={rec.id}
                      style={{
                        background: '#ffffff',
                        border: isAdded ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                        borderRadius: 4,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        boxShadow: isAdded ? '0 0 10px rgba(34, 197, 94, 0.15)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                            {rec.name}
                          </span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontFamily: 'monospace',
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '1px 5px',
                              borderRadius: 2,
                              fontWeight: 700,
                            }}
                          >
                            {rec.sku}
                          </span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 800,
                              background: rec.priority === 'CRITICAL' ? '#fef2f2' : '#f0f9ff',
                              color: rec.priority === 'CRITICAL' ? '#b91c1c' : '#0369a1',
                              border: `1px solid ${rec.priority === 'CRITICAL' ? '#fca5a5' : '#bae6fd'}`,
                              padding: '1px 5px',
                              borderRadius: 2,
                            }}
                          >
                            {rec.priority} PRIORITY
                          </span>
                        </div>

                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                          Category: <strong>{rec.category}</strong> • Reason: <em>{rec.reason}</em>
                        </div>
                      </div>

                      {/* Quantity & Action Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Quantity Counter */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            onClick={() => handleQuantityChange(rec.id, -1, rec.quantity)}
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontWeight: 800,
                              color: '#334155',
                            }}
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span style={{ padding: '0 8px', fontSize: 11, fontWeight: 800, color: '#0f172a', minWidth: 48, textAlign: 'center' }}>
                            {currentQty} {rec.unit}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(rec.id, +1, rec.quantity)}
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontWeight: 800,
                              color: '#334155',
                            }}
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Add to Shipment Button */}
                        <button
                          onClick={() => handleAddToShipment(rec)}
                          style={{
                            background: isAdded ? '#15803d' : '#0b3b60',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            minWidth: 140,
                            justifyContent: 'center',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span>{isAdded ? '✓' : '➕'}</span>
                          <span>{isAdded ? 'Added to Manifest' : 'Add to Shipment'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* View in Logistics Button */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 4,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: '#166534' }}>
                  💡 <strong>Direct Synchronization:</strong> All added items are directly registered into your station's <strong>Logistics & Resupply Module</strong>.
                </div>
                <button
                  onClick={handleNavigateToLogistics}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: 4,
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>📋</span>
                  <span>View All Queued Shipments in Logistics Page</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div
          style={{
            background: '#ffffff',
            borderTop: '1px solid #cbd5e1',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 10.5, color: '#64748b' }}>
            <span>Incident Reference: <strong>{incidentData.report_reference || incidentData.incident_id || 'INC-POLAR-99'}</strong></span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>Status: <strong style={{ color: isResolved ? '#16a34a' : '#dc2626' }}>{isResolved ? 'RESOLVED & AUDITED' : 'ACTIVE SIMULATION'}</strong></span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>Recorded: <strong>{new Date().toLocaleTimeString()}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleDownloadPdf}
              style={{
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }}
              title="Download official Government Incident & Shipment PDF Report"
            >
              <span>📄</span>
              <span>Download PDF</span>
            </button>

            <button
              onClick={() => setActiveTab('shipment')}
              style={{
                background: '#ea580c',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📦</span>
              <span>Next Shipment Requisitions ({model.shipmentRecommendations.length})</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
