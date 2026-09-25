import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  stationId: string
}

export interface HotspotPart {
  id: string
  name: string
  simpleTag: string
  code: string
  subsystem: string
  priority: string
  healthScore: number
  leadOfficer: string
  commissioned: string
  box: { left: number; top: number; width: number; height: number }
  pin: { x: number; y: number }
  status: 'Normal' | 'Running' | 'Online' | 'Active'
  statusColor: string
  about: string
  detailedOverview: string
  stats: Array<{ label: string; value: string; note?: string; good?: boolean }>
  keySpecs: Array<{ label: string; value: string }>
  telemetryChannels: Array<{ name: string; value: string; unit: string; range: string; status: 'Optimal' | 'Normal' | 'Active' }>
  syncStatus: string
  edgeStorage: string
}

const MAITRI_PARTS: HotspotPart[] = [
  {
    id: 'cmd_hub',
    name: 'Main Office & Command Hub',
    simpleTag: 'Central Base',
    code: 'MTR-CMD-01',
    subsystem: 'Central Command, Comms & Tactical Operations',
    priority: 'P1 - Mission Critical',
    healthScore: 99,
    leadOfficer: 'Station Leader / NCPOR Officer',
    commissioned: '1989 (Modernized 2023)',
    box: { left: 43.5, top: 38.5, width: 17, height: 26 },
    pin: { x: 52, y: 51 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Central expedition office, radio room, and emergency safety control.',
    detailedOverview: 'Houses the primary radio communication room, emergency safety interlocking console, meteorological monitoring terminal, and expedition leader tactical desk. Maintains permanent VHF, HF, and satellite connectivity with NCPOR Goa and Indian Navy polar channels.',
    stats: [
      { label: 'Inside Temp', value: '+21.4°C', note: 'Warm & regulated', good: true },
      { label: 'People Inside', value: '14 crew', note: 'On-duty', good: true },
      { label: 'Safety Alarms', value: '100% Safe', note: 'All systems armed', good: true },
      { label: 'Building Health', value: 'Good', note: 'Solid foundations', good: true },
    ],
    keySpecs: [
      { label: 'Thermal Enclosure', value: '150mm sandwich PUF panels with anti-thermal bridge joints' },
      { label: 'Emergency Power', value: 'Dedicated 24V DC battery bank (8-hour runtime reserve)' },
      { label: 'Fire Suppression', value: 'FM-200 Clean Gas Flooding System + multi-sensor smoke detectors' },
      { label: 'Life Safety Interlock', value: 'Direct relay trip to main generator room in case of thermal runaway' },
    ],
    telemetryChannels: [
      { name: 'Cabin Ambient Temp', value: '+21.4', unit: '°C', range: '20.0 - 23.0 °C', status: 'Optimal' },
      { name: 'Relative Humidity', value: '28.5', unit: '%', range: '25.0 - 40.0 %', status: 'Normal' },
      { name: 'CO₂ Concentration', value: '420', unit: 'ppm', range: '< 800 ppm', status: 'Optimal' },
      { name: 'Emergency DC Bus', value: '27.8', unit: 'V', range: '26.0 - 28.5 V', status: 'Optimal' },
    ],
    syncStatus: 'Real-time sync to Cloud Twin (Priority 1 immediate)',
    edgeStorage: 'Buffered in NVMe SSD (Store-and-Forward ready)',
  },
  {
    id: 'habitat_a',
    name: 'Living Rooms & Medical Clinic',
    simpleTag: 'Crew Quarters',
    code: 'MTR-HAB-01',
    subsystem: 'Crew Quarters, Medical Facility & Life Support',
    priority: 'P1 - Life Safety',
    healthScore: 98,
    leadOfficer: 'Station Medical Officer (Dr. A. Sen)',
    commissioned: '1989 (Renovated 2022)',
    box: { left: 20.5, top: 51, width: 18.5, height: 32 },
    pin: { x: 29.5, y: 67 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Heated bedrooms for 25 scientists, doctor clinic, and the Indian Flag.',
    detailedOverview: 'Heated residential complex accommodating up to 25 winter-over expedition personnel. Includes an emergency medical clinic with surgical trauma kit, hyperbaric emergency supplies, telemedicine relay to AIIMS New Delhi, and automated air renewal system.',
    stats: [
      { label: 'Room Temp', value: '+22.0°C', note: 'Heated', good: true },
      { label: 'Fresh Air (CO₂)', value: 'Fresh (420 ppm)', note: 'Clean air', good: true },
      { label: 'Hot Water', value: '+48.5°C', note: 'Running 24/7', good: true },
      { label: 'Beds Occupied', value: '18 of 25 beds', note: '7 spare beds' },
    ],
    keySpecs: [
      { label: 'HVAC Air Renewal', value: 'Dual recirculating air handlers with heat recovery exchangers' },
      { label: 'Hot Water Loop', value: 'Closed glycol secondary heat loop recovered from DG exhaust' },
      { label: 'Bed Capacity', value: '25 polar berths (18 currently occupied by winter-over crew)' },
      { label: 'Clinic Telemedicine', value: 'Encrypted video & vital signs telemetry link to AIIMS' },
    ],
    telemetryChannels: [
      { name: 'Living Quarters Temp', value: '+22.0', unit: '°C', range: '21.0 - 23.5 °C', status: 'Optimal' },
      { name: 'Domestic Hot Water', value: '+48.5', unit: '°C', range: '45.0 - 55.0 °C', status: 'Optimal' },
      { name: 'Fresh Air Exchange', value: '320', unit: 'm³/h', range: '> 280 m³/h', status: 'Normal' },
      { name: 'Airborne Particulate', value: '3.2', unit: 'µg/m³', range: '< 15 µg/m³', status: 'Optimal' },
    ],
    syncStatus: 'High priority life-support telemetry stream',
    edgeStorage: '30-day circular local ring buffer',
  },
  {
    id: 'power_plant',
    name: 'Power Generators (DG-1, 2, 3)',
    simpleTag: 'Electricity',
    code: 'MTR-PWR-03',
    subsystem: 'Primary Diesel-Electric Power Generation Plant',
    priority: 'P1 - Mission Critical',
    healthScore: 97,
    leadOfficer: 'Chief Electrical Engineer',
    commissioned: '2020 Modernization',
    box: { left: 12, top: 34, width: 21, height: 22 },
    pin: { x: 22.5, y: 45 },
    status: 'Running',
    statusColor: '#ea580c',
    about: 'Diesel generator sheds that produce round-the-clock electricity.',
    detailedOverview: 'The lifeline of Maitri Station. Equipped with three 62.5 kVA Kirloskar diesel generator sets operating on automated rotation. Uses Arctic-grade diesel (high cetane, anti-freeze additives). Station engine waste heat is recovered through plate heat exchangers to warm the habitat and melt snow for water.',
    stats: [
      { label: 'Power Produced', value: '84 kW', note: 'Running normal', good: true },
      { label: 'Fuel Consumed', value: '16.4 L / hour', note: 'Normal burn rate' },
      { label: 'Backup Engine', value: 'Ready', note: 'Auto switch on standby', good: true },
      { label: 'Engine Health', value: 'Healthy', note: 'Oil & temp normal', good: true },
    ],
    keySpecs: [
      { label: 'Prime Movers', value: '3x 62.5 kVA Water-Cooled Kirloskar Polar Diesel Gensets' },
      { label: 'Redundancy Mode', value: 'N+2 redundancy (1 running, 1 hot standby, 1 cold reserve)' },
      { label: 'Waste Heat Recovery', value: 'Plate heat exchangers extracting 45 kW thermal power' },
      { label: 'Fuel Filtration', value: 'Dual heated fuel separators with centrifugal moisture trap' },
    ],
    telemetryChannels: [
      { name: 'Active Generator Load', value: '84.2', unit: 'kW', range: '70.0 - 110.0 kW', status: 'Optimal' },
      { name: 'Jacket Water Temp', value: '82.4', unit: '°C', range: '78.0 - 88.0 °C', status: 'Optimal' },
      { name: 'Generator Frequency', value: '50.1', unit: 'Hz', range: '49.8 - 50.2 Hz', status: 'Optimal' },
      { name: 'Oil Pressure', value: '4.2', unit: 'bar', range: '3.5 - 5.0 bar', status: 'Optimal' },
    ],
    syncStatus: 'Sub-second real-time power telemetry to Edge AI engine',
    edgeStorage: 'Black-box trigger active (5 hr pre/post event buffer)',
  },
  {
    id: 'fuel_farm',
    name: 'Fuel Tanks (Winter Diesel)',
    simpleTag: 'Fuel Storage',
    code: 'MTR-POL-01',
    subsystem: 'Polar Diesel & Lubricant Bulk Storage Farm',
    priority: 'P1 - Mission Critical',
    healthScore: 100,
    leadOfficer: 'Logistics & Fuel Officer',
    commissioned: 'Double-walled retrofit 2021',
    box: { left: 75.5, top: 19, width: 18.5, height: 34 },
    pin: { x: 84.5, y: 36 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Insulated steel tanks storing special polar fuel that never freezes.',
    detailedOverview: 'Insulated double-walled bulk fuel storage farm holding specialized low-temperature Aviation Turbine Fuel (ATF-50) and winterized polar diesel. Heated trace-lines prevent wax crystallization at sub-zero temperatures. Monitored for hydrostatic volume and acoustic leak signatures.',
    stats: [
      { label: 'Fuel Left', value: '142,500 Litres', note: '81% full', good: true },
      { label: 'Days Remaining', value: '214 Days', note: 'Safe till next ship', good: true },
      { label: 'Tank Heating', value: 'Active (-2.4°C)', note: 'Stops fuel freezing', good: true },
      { label: 'Leak Check', value: 'Zero Leaks', note: '100% safe', good: true },
    ],
    keySpecs: [
      { label: 'Total Capacity', value: '175,000 Litres across 6 interconnected vertical tanks' },
      { label: 'Current Reserve', value: '142,500 Litres (81.4% capacity — 214 days autonomy)' },
      { label: 'Freeze Protection', value: 'Self-regulating electric trace heating along all manifold pipes' },
      { label: 'Leak Detection', value: 'Acoustic emission probes + inter-wall vacuum pressure sensors' },
    ],
    telemetryChannels: [
      { name: 'Bulk Volume Level', value: '142,500', unit: 'L', range: '> 50,000 L', status: 'Optimal' },
      { name: 'Tank Core Temp', value: '-2.4', unit: '°C', range: '> -15.0 °C', status: 'Normal' },
      { name: 'Hydrostatic Head', value: '3.82', unit: 'm', range: '0.5 - 4.2 m', status: 'Optimal' },
      { name: 'Secondary Vacuum', value: '0.00', unit: 'bar', range: '0.00 bar (Intact)', status: 'Optimal' },
    ],
    syncStatus: 'Synchronized hourly to NCPOR Logistics Command',
    edgeStorage: 'Persistent storage across all outages',
  },
  {
    id: 'vsat_comms',
    name: 'Satellite Dish & Internet Link',
    simpleTag: 'Communication',
    code: 'MTR-COM-01',
    subsystem: 'ISRO GSAT-30 Ku-Band Satellite Communication Earth Station',
    priority: 'P2 - Primary Operational',
    healthScore: 99,
    leadOfficer: 'Telecom & Networking Specialist',
    commissioned: '2021 Tracking Upgrade',
    box: { left: 45.5, top: 2, width: 13.5, height: 38 },
    pin: { x: 52, y: 21 },
    status: 'Online',
    statusColor: '#16a34a',
    about: 'Satellite dish connecting Maitri directly to NCPOR headquarters in Goa.',
    detailedOverview: 'Features a 3.8-meter radome-enclosed Ku-band tracking dish steered towards ISRO GSAT-30 geostationary satellite. Transmits telemetry crushed with Google Protocol Buffers, live CCTV feeds, VoIP telephony, and scientific data to NCPOR Goa.',
    stats: [
      { label: 'Satellite Link', value: 'Online', note: 'ISRO GSAT-30 satellite', good: true },
      { label: 'Signal Strength', value: 'Strong (+14 dB)', note: 'Clear sky', good: true },
      { label: 'Data Compression', value: '93% Saved', note: 'VajraX Protobuf speed', good: true },
      { label: 'Snow De-icer', value: 'Heating On', note: 'Dish clear of ice', good: true },
    ],
    keySpecs: [
      { label: 'Antenna Hardware', value: '3.8m carbon-fiber dish inside heated hydrophobic radome' },
      { label: 'Transponder Link', value: 'ISRO GSAT-30 @ 83° East orbital slot' },
      { label: 'Payload Crushing', value: 'Zstandard + Protobuf binary serialization (-93% reduction)' },
      { label: 'Radome De-Icing', value: 'Automated 3.5 kW forced hot-air blower triggered by wind chill' },
    ],
    telemetryChannels: [
      { name: 'Eb/N0 Signal Margin', value: '+14.2', unit: 'dB', range: '> 8.5 dB', status: 'Optimal' },
      { name: 'Transmit Power (BUC)', value: '16.0', unit: 'W', range: '10.0 - 25.0 W', status: 'Optimal' },
      { name: 'Packet Compression', value: '93.4', unit: '%', range: '> 85.0 %', status: 'Optimal' },
      { name: 'Radome Air Temp', value: '+6.8', unit: '°C', range: '> 2.0 °C', status: 'Normal' },
    ],
    syncStatus: 'Active uplink channel with adaptive bit-rate modulation',
    edgeStorage: 'Store-and-forward queue empty (All synced)',
  },
  {
    id: 'met_mast',
    name: 'Weather Station Tower',
    simpleTag: 'Weather & Wind',
    code: 'MTR-MET-01',
    subsystem: '10m Meteorological & Severe Wind Observation Tower',
    priority: 'P2 - Primary Operational',
    healthScore: 100,
    leadOfficer: 'IMD Polar Meteorologist',
    commissioned: '2023 WMO Certification',
    box: { left: 17, top: 18, width: 5.5, height: 62 },
    pin: { x: 19.5, y: 49 },
    status: 'Active',
    statusColor: '#0284c7',
    about: '10-meter tower measuring polar winds, freezing temperatures, and blizzards.',
    detailedOverview: 'Provides micro-meteorological observations for station safety and aviation operations. Equipped with sonic heated anemometers (resistant to rime icing), barometric pressure sensors, solar pyranometers, and optical visibility sensors for blizzard detection.',
    stats: [
      { label: 'Wind Speed', value: '63 km/h', note: 'Fresh breeze' },
      { label: 'Outside Temp', value: '-18.4°C', note: 'Very Cold' },
      { label: 'Wind Chill', value: '-29°C', note: 'Wear polar jackets' },
      { label: 'Blizzard Warning', value: 'Low Risk', note: 'Clear visibility', good: true },
    ],
    keySpecs: [
      { label: 'Sensors Array', value: 'Vaisala sonic heated anemometers + Campbell Scientific polar logger' },
      { label: 'Structural Rating', value: 'Rated for sustained katabatic winds up to 280 km/h' },
      { label: 'Rime Ice Prevention', value: 'Continuous resistive heating at sensor head (60W continuous)' },
      { label: 'Standard', value: 'WMO Antarctic Baseline Meteorological Network compliant' },
    ],
    telemetryChannels: [
      { name: 'Wind Velocity', value: '63.4', unit: 'km/h', range: '0 - 250 km/h', status: 'Normal' },
      { name: 'Wind Direction', value: '168', unit: '° SSE', range: '0 - 360°', status: 'Normal' },
      { name: 'Ambient Air Temp', value: '-18.4', unit: '°C', range: '-55 to +5 °C', status: 'Normal' },
      { name: 'Barometric Pressure', value: '988.2', unit: 'hPa', range: '940 - 1030 hPa', status: 'Optimal' },
    ],
    syncStatus: 'Real-time 1 Hz feed to Edge AI weather forecasting model',
    edgeStorage: 'Full history saved locally in InfluxDB',
  },
  {
    id: 'east_wing',
    name: 'Dining Hall, Kitchen & Workshop',
    simpleTag: 'Kitchen & Repair',
    code: 'MTR-WNG-02',
    subsystem: 'Dining Mess, Potable Water Melter & Mechanical Workshop',
    priority: 'P2 - Life Support',
    healthScore: 98,
    leadOfficer: 'Catering & Maintenance Supervisor',
    commissioned: 'Modernized 2021',
    box: { left: 56.5, top: 28, width: 25.5, height: 29 },
    pin: { x: 69, y: 42 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Crew dining room, fresh water snow-melter, and mechanical repair shop.',
    detailedOverview: 'Contains the central kitchen, mess hall, dry food cold-stores, snow melting plant for potable water, and heavy equipment maintenance workshop with lathe, welding, and spare parts inventory.',
    stats: [
      { label: 'Drinking Water', value: '9,200 Litres', note: 'Clean melted ice', good: true },
      { label: 'Food Ration', value: '180 Days left', note: 'Plenty in storage', good: true },
      { label: 'Heating Warmth', value: '+48°C water', note: 'Reuses engine heat', good: true },
      { label: 'Fire Safety', value: 'Safe', note: 'Sensors active', good: true },
    ],
    keySpecs: [
      { label: 'Snow Melter Tank', value: 'Glycol heat exchanger tank converting glacier snow (1,200 L/day)' },
      { label: 'Water Purification', value: 'Multi-stage filtration (sediment, activated carbon, UV sterilizer)' },
      { label: 'Food Rations', value: 'Dry, freeze-dried and deep frozen provisions for 180 days' },
      { label: 'Workshop Tools', value: 'MIG/TIG welding, hydraulic press, lathe, and diesel diagnostics' },
    ],
    telemetryChannels: [
      { name: 'Potable Water Level', value: '9,200', unit: 'L', range: '> 4,000 L', status: 'Optimal' },
      { name: 'UV Disinfection Dose', value: '42.0', unit: 'mJ/cm²', range: '> 30.0 mJ/cm²', status: 'Optimal' },
      { name: 'Melt Tank Temp', value: '+38.0', unit: '°C', range: '30.0 - 45.0 °C', status: 'Optimal' },
      { name: 'Kitchen Air Damper', value: 'Nominal', unit: 'state', range: 'Auto-ready', status: 'Optimal' },
    ],
    syncStatus: 'Daily inventory & consumables telemetry to Cloud Twin',
    edgeStorage: 'Local inventory ledger mirrored on Edge node',
  },
  {
    id: 'science_lab',
    name: 'Science & Physics Labs',
    simpleTag: 'Research',
    code: 'MTR-SCI-01',
    subsystem: 'Atmospheric, Geomagnetic & Seismic Research Laboratories',
    priority: 'P3 - Scientific Research',
    healthScore: 100,
    leadOfficer: 'Lead Geoscientist (IIG / NCPOR)',
    commissioned: '2022 Sensor Overhaul',
    box: { left: 35, top: 35, width: 15, height: 20 },
    pin: { x: 42.5, y: 45 },
    status: 'Active',
    statusColor: '#16a34a',
    about: 'Scientific equipment studying polar auroras, ozone layer, and earth magnetism.',
    detailedOverview: 'Multi-disciplinary research labs studying the Antarctic ozone hole (Dobson spectrophotometer), Earth magnetosphere (fluxgate magnetometers), seismology, and auroral emissions. Connected directly to Indian Institute of Geomagnetism (IIG) server nodes.',
    stats: [
      { label: 'Instruments', value: 'All Working', note: 'Clean power supply', good: true },
      { label: 'Earth Magnetism', value: 'Normal (Quiet)', note: 'Steady signal', good: true },
      { label: 'Ground Shaking', value: 'Quiet (<0.01 mm/s)', note: 'No tremors', good: true },
      { label: 'Data Sync', value: 'Continuous', note: 'Live to India labs', good: true },
    ],
    keySpecs: [
      { label: 'Clean Power Bus', value: 'Online double-conversion isolation UPS (THD < 1.5%)' },
      { label: 'Core Instruments', value: 'Fluxgate magnetometer, Brewer/Dobson Ozone meter, broadband seismometer' },
      { label: 'Cryogenic Storage', value: 'Liquid nitrogen dewar for polar biological core samples' },
      { label: 'Scientific Sync', value: 'Edge-to-cloud batch sync queued every 15 minutes' },
    ],
    telemetryChannels: [
      { name: 'Magnetic Field (Z)', value: '44,210', unit: 'nT', range: '40,000 - 50,000 nT', status: 'Optimal' },
      { name: 'Seismic Velocity', value: '0.008', unit: 'mm/s', range: '< 0.05 mm/s', status: 'Optimal' },
      { name: 'Lab UPS Battery', value: '100', unit: '%', range: '> 90 %', status: 'Optimal' },
      { name: 'Sample Freezer Temp', value: '-80.2', unit: '°C', range: '-80 ± 3 °C', status: 'Optimal' },
    ],
    syncStatus: 'High-throughput scientific data pipeline',
    edgeStorage: 'Dual mirrored NVMe array (16 TB capacity)',
  },
  {
    id: 'snow_melt',
    name: 'Underground Ground Heating',
    simpleTag: 'Foundation Care',
    code: 'MTR-FND-01',
    subsystem: 'Sub-Structure Ground Thermal Loop & Pillar Anti-Freeze',
    priority: 'P1 - Structural Integrity',
    healthScore: 99,
    leadOfficer: 'Structural Maintenance Engineer',
    commissioned: '1989 (Hydraulic overhaul 2021)',
    box: { left: 38.5, top: 73, width: 10.5, height: 17 },
    pin: { x: 43.5, y: 81 },
    status: 'Active',
    statusColor: '#16a34a',
    about: 'Pumps warm fluid under the pillars so frozen ice does not harm foundations.',
    detailedOverview: 'Sub-surface circulation loop pumping warm fluid under structural concrete footing pillars. Prevents frost heave and permafrost thawing cycles that could destabilize the building foundation anchors over the Schirmacher Oasis rocky moraine.',
    stats: [
      { label: 'Water Pump Flow', value: '42 Litres / min', note: 'Circulating smooth', good: true },
      { label: 'Water Temp', value: '+35°C', note: 'Warm water loop', good: true },
      { label: 'Ice on Pillars', value: 'Zero ice (0 mm)', note: 'Clean & safe', good: true },
      { label: 'Pumps Status', value: 'Running', note: 'Automatic', good: true },
    ],
    keySpecs: [
      { label: 'Circulation Fluid', value: 'Inhibited food-grade propylene glycol (freeze rating -55°C)' },
      { label: 'Pumps Design', value: 'Dual variable-speed bronze centrifugal circulation pumps' },
      { label: 'Thermal Source', value: 'Low-grade return heat recovered from generator jacket loop' },
      { label: 'Bedrock Monitoring', value: 'Ultrasonic strain gauges on all 16 foundation stilts' },
    ],
    telemetryChannels: [
      { name: 'Glycol Loop Flow', value: '42.5', unit: 'L/min', range: '35.0 - 50.0 L/min', status: 'Optimal' },
      { name: 'Supply Temperature', value: '+35.2', unit: '°C', range: '30.0 - 42.0 °C', status: 'Optimal' },
      { name: 'Pillar Base Frost', value: '0.0', unit: 'mm', range: '< 2.0 mm', status: 'Optimal' },
      { name: 'Anchor Stilt Stress', value: '14.2', unit: 'MPa', range: '< 45.0 MPa', status: 'Optimal' },
    ],
    syncStatus: 'Continuous foundation structural telemetry',
    edgeStorage: 'Local anomaly detector running 24/7',
  },
]

const BHARATI_PARTS: HotspotPart[] = [
  {
    id: 'bhr_entrance',
    name: 'Main Base Entrance & Airlock',
    simpleTag: 'Main Entrance',
    code: 'BHR-ENT-01',
    subsystem: 'Aerodynamic Thermal Airlock & Station Commander Office',
    priority: 'P1 - Mission Critical',
    healthScore: 100,
    leadOfficer: 'Bharati Station Commander',
    commissioned: '2012 (Continuous Operation)',
    box: { left: 45.0, top: 38.0, width: 14.0, height: 35.0 },
    pin: { x: 52, y: 52 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Heated central airlock, entrance stairs, and expedition management offices.',
    detailedOverview: 'The main entry portal of Bharati Station, built using an aerodynamic profile raised on stilts to prevent snowdrifts from accumulating around the base. Features a dual-door vacuum-seal airlock to minimize heat loss during crew entry in blizzard conditions.',
    stats: [
      { label: 'Inside Temp', value: '+20.8°C', note: 'Warm & regulated', good: true },
      { label: 'Station Crew', value: '22 scientists', note: 'Living on-site', good: true },
      { label: 'Structure Health', value: '100% Nominal', note: 'Aerodynamic steel', good: true },
      { label: 'Air Pressure', value: '1,014 hPa', note: 'Normal sealed air', good: true },
    ],
    keySpecs: [
      { label: 'Airlock System', value: 'Dual interlocking pneumatic doors with radiant infrared heaters' },
      { label: 'Aerodynamic Skin', value: 'Wind-tunnel tested wrap-around stainless steel casing' },
      { label: 'Foundation Stilts', value: '24 heavy-duty steel columns anchored into Larsemann granite' },
      { label: 'Thermal U-Value', value: 'U-value 0.12 W/m²K (advanced extreme polar insulation)' },
    ],
    telemetryChannels: [
      { name: 'Airlock Vestibule', value: '+14.2', unit: '°C', range: '10.0 - 16.0 °C', status: 'Optimal' },
      { name: 'Interior Station Temp', value: '+20.8', unit: '°C', range: '20.0 - 22.5 °C', status: 'Optimal' },
      { name: 'Stilt Aerodynamic Drag', value: '0.32', unit: 'Cd', range: '< 0.40 Cd', status: 'Optimal' },
      { name: 'Airlock Seal Pressure', value: '1,014', unit: 'hPa', range: '1000 - 1030 hPa', status: 'Optimal' },
    ],
    syncStatus: 'Real-time telemetry link to NCPOR Goa Cloud Twin',
    edgeStorage: 'Zero uncommitted buffer entries',
  },
  {
    id: 'bhr_habitat',
    name: 'Living Rooms & Medical ICU (Left Wing)',
    simpleTag: 'Living Quarters',
    code: 'BHR-HAB-01',
    subsystem: 'Crew Quarters, Medical ICU & Life Support (Left Wing)',
    priority: 'P1 - Life Safety',
    healthScore: 99,
    leadOfficer: 'Medical Specialist & Life Support Officer',
    commissioned: '2012 (Continuous)',
    box: { left: 18.0, top: 47.0, width: 30.0, height: 32.0 },
    pin: { x: 34, y: 60 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Modern living quarters for 47 crew members, surgery room, and the Indian Flag.',
    detailedOverview: 'State-of-the-art living module designed for 47 polar scientists and logistics personnel. Features sound-insulated sleeping quarters, gymnasium, surgical theater with oxygen concentrators, and computerized climate control.',
    stats: [
      { label: 'Bedroom Temp', value: '+21.5°C', note: 'Thermostat heated', good: true },
      { label: 'Fresh Air (CO₂)', value: 'Fresh (410 ppm)', note: 'Continuous filtered', good: true },
      { label: 'Beds Occupied', value: '22 of 47 beds', note: '25 spare berths' },
      { label: 'Fire Safety', value: '100% Safe', note: 'Automated fog mist', good: true },
    ],
    keySpecs: [
      { label: 'Capacity', value: '47 berths across 24 modular insulated cabins' },
      { label: 'Medical ICU', value: 'Automated external defibrillator, surgical suite, telemedicine link' },
      { label: 'Air Renewal', value: 'Variable air volume (VAV) system with HEPA filtration' },
      { label: 'Fire Suppression', value: 'High-pressure water mist (Hi-Fog) system (zero toxic gas)' },
    ],
    telemetryChannels: [
      { name: 'Cabin Ambient Temp', value: '+21.5', unit: '°C', range: '20.0 - 23.0 °C', status: 'Optimal' },
      { name: 'Indoor CO₂ Level', value: '410', unit: 'ppm', range: '< 600 ppm', status: 'Optimal' },
      { name: 'Berth Occupancy', value: '22 / 47', unit: 'beds', range: 'Max 47', status: 'Normal' },
      { name: 'Water Mist Pressure', value: '140', unit: 'bar', range: '130 - 150 bar', status: 'Optimal' },
    ],
    syncStatus: 'High priority life-support telemetry stream',
    edgeStorage: 'Encrypted local medical & occupancy record storage',
  },
  {
    id: 'bhr_lounge',
    name: 'Dining Mess & Panoramic Lounge (Right Wing)',
    simpleTag: 'Dining & Lounge',
    code: 'BHR-LNG-01',
    subsystem: 'Panoramic Lounge, Mess & Desalination Plant (Right Wing)',
    priority: 'P2 - Primary Operational',
    healthScore: 98,
    leadOfficer: 'Catering & Water Engineer',
    commissioned: '2012 (Continuous)',
    box: { left: 54.0, top: 49.0, width: 28.0, height: 27.0 },
    pin: { x: 68, y: 58 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'Dining hall and triple-glazed panoramic lounge looking out over Prydz Bay ocean.',
    detailedOverview: 'Provides crew dining, recreation, and a floor-to-ceiling panoramic view of Prydz Bay and the Southern Ocean. Below the lounge is Bharati reverse osmosis desalination plant converting seawater into pristine drinking water.',
    stats: [
      { label: 'Lounge Temp', value: '+21.0°C', note: 'Heated ocean view', good: true },
      { label: 'Drinking Water', value: '14,000 Litres', note: 'Desalinated clean water', good: true },
      { label: 'Food Ration', value: '240 Days left', note: 'Ample nutrition storage', good: true },
      { label: 'Window Heaters', value: 'Active', note: 'Zero frost on glass', good: true },
    ],
    keySpecs: [
      { label: 'Panoramic Glazing', value: 'Triple-layered heated argon-gas filled polar insulated glass' },
      { label: 'Desalination Unit', value: 'Twin seawater reverse osmosis (RO) racks producing 3,000 L/day' },
      { label: 'Thermal Window Film', value: 'Conductive heating layer keeping pane clear of frost at -40°C' },
      { label: 'Food Rations', value: 'Dry and frozen supplies for 240 days with automated inventory tracking' },
    ],
    telemetryChannels: [
      { name: 'Lounge Temperature', value: '+21.0', unit: '°C', range: '20.0 - 22.5 °C', status: 'Optimal' },
      { name: 'Drinking Water Storage', value: '14,000', unit: 'L', range: '> 5,000 L', status: 'Optimal' },
      { name: 'Desalination Permeate', value: '180', unit: 'L/h', range: '150 - 200 L/h', status: 'Optimal' },
      { name: 'Water Purity (TDS)', value: '42.0', unit: 'ppm', range: '< 100 ppm', status: 'Optimal' },
    ],
    syncStatus: 'Periodic resource utilization stream to Cloud Twin',
    edgeStorage: 'Store-and-forward buffered',
  },
  {
    id: 'bhr_labs',
    name: 'Ocean & Atmospheric Science Labs',
    simpleTag: 'Science Labs',
    code: 'BHR-LAB-01',
    subsystem: 'Integrated Oceanographic, Glaciological & Atmospheric Labs',
    priority: 'P2 - Scientific Mission',
    healthScore: 100,
    leadOfficer: 'Chief Scientist (Bharati Expedition)',
    commissioned: '2023 Lab Modernization',
    box: { left: 30.0, top: 38.0, width: 44.0, height: 16.0 },
    pin: { x: 44, y: 44 },
    status: 'Active',
    statusColor: '#16a34a',
    about: 'Specialized laboratories studying polar marine biology, glaciology, and atmosphere.',
    detailedOverview: 'Houses world-class marine biology, glaciology, and meteorological research labs. Directly monitors sea-ice dynamics, ice shelf calving, paleoclimatology ice core analysis, and space weather phenomena.',
    stats: [
      { label: 'Instruments', value: 'All Online', note: 'Clean power bus', good: true },
      { label: 'Seismic Wave', value: '< 0.02 mm/s', note: 'Ultra-quiet bedrock', good: true },
      { label: 'Ocean Sensor', value: 'Active Probe', note: 'Prydz Bay sea data', good: true },
      { label: 'Data Relay', value: 'Live to Goa', note: 'Continuous feed', good: true },
    ],
    keySpecs: [
      { label: 'Scientific Equipment', value: 'Mass spectrometers, gas chromatographs, ultra-pure water units' },
      { label: 'Seismic Pier', value: 'Isolated reinforced concrete bedrock pier decoupled from station vibrations' },
      { label: 'Clean Rooms', value: 'ISO Class 6 laminar flow hoods for environmental sample handling' },
      { label: 'Data Backbone', value: 'Gigabit optical network feeding localized Edge AI inference engine' },
    ],
    telemetryChannels: [
      { name: 'Seismic Ground Velocity', value: '0.012', unit: 'mm/s', range: '< 0.05 mm/s', status: 'Optimal' },
      { name: 'Clean Room Air Purity', value: 'Class 6', unit: 'ISO', range: 'Class 6 or better', status: 'Optimal' },
      { name: 'Scientific Power Bus', value: '18.4', unit: 'kW', range: '12.0 - 25.0 kW', status: 'Optimal' },
      { name: 'Ice Core Freezer', value: '-82.0', unit: '°C', range: '-80 ± 2 °C', status: 'Optimal' },
    ],
    syncStatus: 'High-speed scientific data stream',
    edgeStorage: 'Local 32TB scientific cluster storage',
  },
  {
    id: 'bhr_fuel',
    name: 'Bulk Fuel Silos (Winter Arctic Fuel)',
    simpleTag: 'Fuel Tanks',
    code: 'BHR-POL-01',
    subsystem: 'Double-Walled Arctic Grade Fuel Silos & Pumping Station',
    priority: 'P1 - Mission Critical',
    healthScore: 99,
    leadOfficer: 'Logistics Officer',
    commissioned: '2012 (Continuous)',
    box: { left: 73.0, top: 31.0, width: 16.0, height: 26.0 },
    pin: { x: 81, y: 42 },
    status: 'Normal',
    statusColor: '#16a34a',
    about: 'High-grade stainless steel fuel silos holding freeze-proof polar fuel.',
    detailedOverview: 'State-of-the-art vertical steel silos housing anti-gel polar diesel. Equipped with nitrogen ullage blanketing to prevent explosive vapor accumulation and trace-heated distribution lines to generator halls.',
    stats: [
      { label: 'Fuel Reserve', value: '185,000 Litres', note: '78% capacity', good: true },
      { label: 'Days Remaining', value: '280 Days', note: 'Safe till next ship', good: true },
      { label: 'Fuel Core Temp', value: '-1.5°C', note: 'Trace heated', good: true },
      { label: 'Leak Sensors', value: 'Zero Leaks', note: 'Environment safe', good: true },
    ],
    keySpecs: [
      { label: 'Storage Capacity', value: '240,000 Litres across insulated stainless silos' },
      { label: 'Current Reserve', value: '185,000 Litres (77.1% full — 280 days operational autonomy)' },
      { label: 'Vapor Blanketing', value: 'Inert nitrogen gas pad system preventing condensation & oxidation' },
      { label: 'Leak Detection', value: 'Continuous interstitial vacuum monitoring with optical hydrocarbon sensors' },
    ],
    telemetryChannels: [
      { name: 'Total Fuel Volume', value: '185,000', unit: 'L', range: '> 60,000 L', status: 'Optimal' },
      { name: 'Fuel Core Temperature', value: '-1.5', unit: '°C', range: '> -10.0 °C', status: 'Normal' },
      { name: 'Silo Nitrogen Blanket', value: '12.4', unit: 'mbar', range: '10.0 - 15.0 mbar', status: 'Optimal' },
      { name: 'Hydrocarbon Leakage', value: '0.0', unit: 'ppm', range: '0.0 ppm (Zero)', status: 'Optimal' },
    ],
    syncStatus: 'Synchronized with NCPOR Goa Fuel Optimization Engine',
    edgeStorage: 'Immutable edge audit log',
  },
  {
    id: 'bhr_satellite',
    name: 'High-Speed Satellite Towers (GSAT-30)',
    simpleTag: 'Satellite Link',
    code: 'BHR-COM-01',
    subsystem: 'High-Speed Ku/Ka-Band Tracking Earth Station & NCPOR Backbone',
    priority: 'P1 - Mission Critical',
    healthScore: 100,
    leadOfficer: 'Satellite Telecom Engineer',
    commissioned: 'Dual Radome Upgrade 2021',
    box: { left: 47.0, top: 15.0, width: 12.0, height: 28.0 },
    pin: { x: 54, y: 27 },
    status: 'Online',
    statusColor: '#16a34a',
    about: 'Dedicated high-speed satellite dish masts linking Bharati to NCPOR Goa.',
    detailedOverview: 'Dual tracking radomes providing continuous gigabit uplink to GSAT-30 and fallback LEO polar constellations. Feeds live Digital Twin telemetry, synchronized InfluxDB time-series records, and high-resolution video streams.',
    stats: [
      { label: 'Satellite Link', value: 'Online (Fast)', note: 'Ku-Band dish active', good: true },
      { label: 'Signal Strength', value: 'Strong (+16 dB)', note: 'Clear sky margin', good: true },
      { label: 'Bandwidth Saved', value: '94% Saved', note: 'VajraX Protobuf speed', good: true },
      { label: 'ISRO Tracking', value: 'Connected', note: 'GSAT-30 relay', good: true },
    ],
    keySpecs: [
      { label: 'Tracking Antennas', value: 'Dual 4.5m tracking Ku/Ka-band antennas inside rigid radomes' },
      { label: 'Protobuf Crushing', value: 'Real-time sensor telemetry compressed by 94% using Google Protobuf' },
      { label: 'Edge Buffer Reserve', value: 'Local SSD buffer holds up to 180 days of sensor data during blackout' },
      { label: 'Cryptographic Security', value: 'Hardware security module (HSM) + Ed25519 digital signatures' },
    ],
    telemetryChannels: [
      { name: 'Carrier-to-Noise Ratio', value: '+16.4', unit: 'dB', range: '> 10.0 dB', status: 'Optimal' },
      { name: 'Uplink Throughput', value: '8.4', unit: 'Mbps', range: '2.0 - 15.0 Mbps', status: 'Optimal' },
      { name: 'Protobuf Compression', value: '94.1', unit: '%', range: '> 85.0 %', status: 'Optimal' },
      { name: 'Sync Queue Depth', value: '0', unit: 'pending', range: '0 pending (Clear)', status: 'Optimal' },
    ],
    syncStatus: 'Active primary uplink (Sub-second latency)',
    edgeStorage: 'Fully synchronized with NCPOR Cloud Twin',
  },
  {
    id: 'bhr_metmast',
    name: 'Weather & Wind Mast',
    simpleTag: 'Weather Mast',
    code: 'BHR-MET-01',
    subsystem: 'Coastal Antarctic Meteorological Observation Tower',
    priority: 'P2 - Primary Operational',
    healthScore: 99,
    leadOfficer: 'IMD Station Meteorologist',
    commissioned: '2022 Heated Mast Upgrade',
    box: { left: 18.0, top: 16.0, width: 6.0, height: 38.0 },
    pin: { x: 21, y: 33 },
    status: 'Active',
    statusColor: '#0284c7',
    about: 'Tower measuring polar coastal winds, temperatures, blizzards, and sea fog.',
    detailedOverview: 'Monitors coastal polar weather conditions in Prydz Bay, tracking katabatic winds descending from the Antarctic ice sheet, maritime humidity, atmospheric pressure, and solar radiation balance.',
    stats: [
      { label: 'Wind Velocity', value: '44 km/h', note: 'Moderate breeze' },
      { label: 'Outside Temp', value: '-12.1°C', note: 'Coastal Antarctic cold' },
      { label: 'Air Humidity', value: '65%', note: 'Oceanic air' },
      { label: 'Blizzard Alert', value: 'Clear / Safe', note: 'Good visibility', good: true },
    ],
    keySpecs: [
      { label: 'Wind Sensors', value: 'Ultrasonic heated 3D wind velocity sensors (no moving parts to freeze)' },
      { label: 'Radiation Suite', value: 'Kipp & Zonen net radiometer measuring upward and downward flux' },
      { label: 'Katabatic Warning', value: 'Automated early alert triggered when barometric drop > 3 hPa/hour' },
      { label: 'Operational Limit', value: 'Operates up to 300 km/h hurricane-force polar storms' },
    ],
    telemetryChannels: [
      { name: 'Wind Velocity', value: '44.2', unit: 'km/h', range: '0 - 250 km/h', status: 'Normal' },
      { name: 'Ambient Air Temp', value: '-12.1', unit: '°C', range: '-45 to +5 °C', status: 'Normal' },
      { name: 'Relative Humidity', value: '65.2', unit: '%', range: '20 - 95 %', status: 'Normal' },
      { name: 'Barometric Trend', value: '1,008', unit: 'hPa', range: '950 - 1040 hPa', status: 'Optimal' },
    ],
    syncStatus: 'Direct feed into Edge AI Anomaly & Storm Predictor',
    edgeStorage: 'High-density InfluxDB buffer',
  },
  {
    id: 'bhr_snowcat',
    name: 'PistenBully Snow Vehicle & Crew',
    simpleTag: 'Expedition Crew',
    code: 'BHR-LOG-01',
    subsystem: 'PistenBully Polar Tracked Vehicles & Ground Expedition Unit',
    priority: 'P2 - Logistics & Field Safety',
    healthScore: 97,
    leadOfficer: 'Vehicle Workshop & Traverse Lead',
    commissioned: '2023 Vehicle Overhaul',
    box: { left: 58.0, top: 70.0, width: 12.0, height: 16.0 },
    pin: { x: 64, y: 76 },
    status: 'Active',
    statusColor: '#ea580c',
    about: 'Heavy-tracked snowcat polar vehicle and expedition crew on the ground.',
    detailedOverview: 'Tracks the station heavy polar traverse fleet including PistenBully snowcats, cranes, and snowmobiles. Real-time satellite GPS tracking with crew panic beacons and emergency survival gear for traverses over ice sheets.',
    stats: [
      { label: 'Vehicle Engine', value: 'Running', note: 'Heated cabin', good: true },
      { label: 'Crew Outside', value: '4 Scientists', note: 'Polar suits equipped', good: true },
      { label: 'GPS Sync', value: 'Active', note: 'Satellite tracking', good: true },
      { label: 'Mission', value: 'Field Survey', note: 'Nominal operation', good: true },
    ],
    keySpecs: [
      { label: 'Vehicle Fleet', value: '2x PistenBully 300 Polar + 4x Ski-Doo Tundra snowmobiles' },
      { label: 'Survival Gear', value: 'Each vehicle carries 4-person polar survival tent, 14 days rations, satellite phone' },
      { label: 'Cabin Climate', value: 'Independent diesel air heater (Webasto) with insulated survival cell' },
      { label: 'Navigation System', value: 'Dual differential GPS + ground-penetrating radar for crevasse detection' },
    ],
    telemetryChannels: [
      { name: 'Engine Oil Temp', value: '+84.0', unit: '°C', range: '75.0 - 95.0 °C', status: 'Optimal' },
      { name: 'Cabin Temperature', value: '+18.5', unit: '°C', range: '15.0 - 22.0 °C', status: 'Optimal' },
      { name: 'Field Crew on Duty', value: '4', unit: 'crew', range: 'All beacons active', status: 'Normal' },
      { name: 'Crevasse Radar', value: 'Scanning', unit: 'state', range: 'Safe terrain', status: 'Optimal' },
    ],
    syncStatus: 'Mobile satellite telemetry beacon channel',
    edgeStorage: 'Traverse GPS path logged on Edge server',
  },
  {
    id: 'bhr_ocean',
    name: 'Prydz Bay Ocean & Coastal Ice Shelf',
    simpleTag: 'Prydz Bay Ocean',
    code: 'BHR-OCN-01',
    subsystem: 'Prydz Bay Oceanographic Monitoring & Fast-Ice Stability Array',
    priority: 'P3 - Environmental Monitoring',
    healthScore: 100,
    leadOfficer: 'Physical Oceanographer (NCPOR)',
    commissioned: '2022 Mooring Deployment',
    box: { left: 57.0, top: 24.0, width: 33.0, height: 12.0 },
    pin: { x: 74, y: 29 },
    status: 'Active',
    statusColor: '#0284c7',
    about: 'Antarctic Southern Ocean waters monitored for ice shelf stability and marine ecology.',
    detailedOverview: 'Sub-sea sensor moorings and shore-mounted radars continuously recording coastal water temperature, salinity, tide levels, and sea-ice thickness to safeguard research vessels (like MV Vasiliy Golovnin) during resupply voyages.',
    stats: [
      { label: 'Sea Water Temp', value: '-1.8°C', note: 'Near freezing point' },
      { label: 'Ice Pack Extent', value: '4.2 km offshore', note: 'Stable sea ice', good: true },
      { label: 'Tide Height', value: '0.8 m', note: 'Normal ocean tide', good: true },
      { label: 'Water Salinity', value: '34.1 PSU', note: 'Typical polar sea', good: true },
    ],
    keySpecs: [
      { label: 'Sub-Sea Mooring', value: 'Acoustic Doppler Current Profiler (ADCP) measuring ocean currents' },
      { label: 'Ice Shelf Radar', value: 'Interferometric radar monitoring ice tongue calving fissures' },
      { label: 'Marine Ecological Probe', value: 'Fluorometer measuring chlorophyll and polar phytoplankton blooms' },
      { label: 'Resupply Safety', value: 'Automated ship navigation fairway depth and ice pack reporting' },
    ],
    telemetryChannels: [
      { name: 'Sea Surface Temp', value: '-1.8', unit: '°C', range: '-1.9 to +1.0 °C', status: 'Normal' },
      { name: 'Sea Ice Pack Extent', value: '4.2', unit: 'km', range: '1.0 - 15.0 km', status: 'Optimal' },
      { name: 'Water Salinity', value: '34.1', unit: 'PSU', range: '33.5 - 35.0 PSU', status: 'Optimal' },
      { name: 'Tide Height', value: '0.82', unit: 'm', range: '0.0 - 2.5 m', status: 'Optimal' },
    ],
    syncStatus: 'Synchronized with Global Ocean Observing System (GOOS)',
    edgeStorage: 'Edge oceanographic time-series buffer',
  },
]

export default function SchematicPanel({ stationId }: Props) {
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [showAllPins, setShowAllPins] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isMaitri = stationId === 'maitri'
  const activePartsList = isMaitri ? MAITRI_PARTS : BHARATI_PARTS

  // If a modal is open, selectedPart holds it; hoveredPart only shows when modal is closed
  const selectedPart = activePartsList.find((p) => p.id === selectedPartId) ?? null
  const hoveredPart = !selectedPartId && hoveredPartId ? activePartsList.find((p) => p.id === hoveredPartId) ?? null : null

  const handleSelectPart = (id: string) => {
    setSelectedPartId(id)
  }

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPartId(null)
      }
    }
    if (selectedPartId) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPartId])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 380,
        overflow: 'hidden',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
            }
          : {}),
      }}
    >
      {/* ── Subsystems Filter / Quick Select Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: '#f8fafc',
          borderBottom: '1px solid #cbd5e1',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase', marginRight: 4 }}>
          Buildings:
        </span>

        {activePartsList.map((part) => {
          const isHovered = hoveredPartId === part.id
          const isSelected = selectedPartId === part.id
          return (
            <button
              key={part.id}
              onMouseEnter={() => setHoveredPartId(part.id)}
              onMouseLeave={() => setHoveredPartId(null)}
              onClick={() => handleSelectPart(part.id)}
              title={`Click to open detailed modal for ${part.name}`}
              style={{
                background: isSelected ? '#0b3b60' : isHovered ? '#f1f5f9' : '#ffffff',
                color: isSelected ? '#ffffff' : isHovered ? '#0b3b60' : '#334155',
                border: isSelected ? '1px solid #0b3b60' : '1px solid #cbd5e1',
                borderBottom: isSelected ? '2px solid #ff9933' : '1px solid #cbd5e1',
                padding: '3px 7px',
                fontSize: 10,
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 2,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#ff9933' : '#15803d' }} />
              <span>{part.simpleTag}</span>
            </button>
          )
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <button
            onClick={() => setShowAllPins((v) => !v)}
            title="Toggle pin markers"
            style={{
              background: showAllPins ? '#e0f2fe' : '#ffffff',
              border: showAllPins ? '1px solid #0284c7' : '1px solid #cbd5e1',
              color: showAllPins ? '#0369a1' : '#64748b',
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {showAllPins ? 'visibility' : 'visibility_off'}
            </span>
            <span>{showAllPins ? 'Markers' : 'Hidden'}</span>
          </button>

          <button
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span>{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>
        </div>
      </div>

      {/* ── Aerial Image Canvas ── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: '#0f172a',
          overflow: 'hidden',
          minHeight: 320,
          display: 'flex',
        }}
      >
        <img
          src={isMaitri ? '/maitri_station.jpg' : '/bharati_station.jpg'}
          alt={`${stationId} aerial digital twin view`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 42%',
            display: 'block',
          }}
          loading="eager"
        />

        {/* ── Interactive Bounding Boxes ── */}
        {activePartsList.map((part) => {
          const isHovered = hoveredPartId === part.id
          const isSelected = selectedPartId === part.id
          const isActive = isHovered || isSelected

          return (
            <div
              key={part.id}
              onMouseEnter={() => setHoveredPartId(part.id)}
              onMouseLeave={() => setHoveredPartId(null)}
              onClick={() => handleSelectPart(part.id)}
              title={`Click to open full details of ${part.name}`}
              style={{
                position: 'absolute',
                left: `${part.box.left}%`,
                top: `${part.box.top}%`,
                width: `${part.box.width}%`,
                height: `${part.box.height}%`,
                cursor: 'pointer',
                zIndex: isActive ? 30 : 20,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  border: isActive ? '2px solid #ff9933' : '1px dashed transparent',
                  background: isActive ? 'rgba(11, 59, 96, 0.35)' : 'transparent',
                  boxShadow: isActive ? '0 0 14px rgba(255, 153, 51, 0.7), inset 0 0 10px rgba(255, 153, 51, 0.25)' : 'none',
                  position: 'relative',
                  borderRadius: 2,
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -18,
                      left: 0,
                      background: '#0b3b60',
                      color: '#ffffff',
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '1px 6px',
                      whiteSpace: 'nowrap',
                      borderLeft: '2px solid #ff9933',
                    }}
                  >
                    {part.simpleTag} (Click for details)
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* ── Visual Pins on the Station ── */}
        {showAllPins &&
          activePartsList.map((part) => {
            const isHovered = hoveredPartId === part.id
            const isSelected = selectedPartId === part.id
            const isActive = isHovered || isSelected

            return (
              <div
                key={`pin-${part.id}`}
                onMouseEnter={() => setHoveredPartId(part.id)}
                onMouseLeave={() => setHoveredPartId(null)}
                onClick={() => handleSelectPart(part.id)}
                title={`Click to open details: ${part.name}`}
                style={{
                  position: 'absolute',
                  left: `${part.pin.x}%`,
                  top: `${part.pin.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 35 : 22,
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    className="pulse-dot"
                    style={{
                      position: 'absolute',
                      width: isActive ? 22 : 18,
                      height: isActive ? 22 : 18,
                      borderRadius: '50%',
                      background: '#38bdf8',
                      opacity: isActive ? 0.85 : 0.45,
                    }}
                  />
                  <div
                    style={{
                      width: isActive ? 14 : 11,
                      height: isActive ? 14 : 11,
                      borderRadius: '50%',
                      background: '#38bdf8',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
                    }}
                  />
                </div>
              </div>
            )
          })}

        {/* ── Normal Hover Card (Shows on hover when modal is NOT open) ── */}
        {hoveredPart && (
          <div
            style={{
              position: 'absolute',
              right: hoveredPart.pin.x > 60 ? `${100 - hoveredPart.box.left + 2}%` : 'auto',
              left: hoveredPart.pin.x <= 60 ? `${hoveredPart.box.left + hoveredPart.box.width + 1.5}%` : 'auto',
              top: `${Math.max(6, Math.min(48, hoveredPart.box.top - 4))}%`,
              zIndex: 45,
              width: 255,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderLeft: '4px solid #ff9933',
              boxShadow: '0 6px 18px rgba(11, 59, 96, 0.16)',
              color: '#0f172a',
              pointerEvents: 'none',
              padding: '10px 12px',
              borderRadius: 2,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#ff9933', textTransform: 'uppercase' }}>
                {hoveredPart.simpleTag}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#15803d',
                  background: '#f0fdf4',
                  padding: '1px 5px',
                  border: '1px solid #bbf7d0',
                }}
              >
                ● {hoveredPart.status}
              </span>
            </div>

            {/* Simple Title */}
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#0b3b60', lineHeight: 1.2, marginBottom: 4 }}>
              {hoveredPart.name}
            </div>

            {/* Easy one-line explanation */}
            <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.35, marginBottom: 8 }}>
              {hoveredPart.about}
            </div>

            {/* 4 Clean Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
              {hoveredPart.stats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '4px 6px',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#64748b' }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>{s.value}</div>
                  {s.note && (
                    <div style={{ fontSize: 8.5, color: s.good ? '#15803d' : '#64748b', fontWeight: 600 }}>
                      {s.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 6, fontSize: 9, color: '#0284c7', fontWeight: 700, textAlign: 'right' }}>
              👆 Click for full detailed specs
            </div>
          </div>
        )}

        {/* ── Bottom Subtle Legend ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 8,
            zIndex: 15,
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1px solid #cbd5e1',
            borderLeft: '3px solid #138808',
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: 800,
            color: '#0b3b60',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: '#138808' }}>●</span>
          <span>
            {isMaitri
              ? 'Maitri Station (70°S, 11°E) • Click on any section to open detailed pop-up dialog'
              : 'Bharati Station, Larsemann Hills (69°S, 76°E) • Click on any section to open detailed pop-up dialog'}
          </span>
        </div>
      </div>

      {/* ── Detailed Pop-up Modal (Opens on Click, Portal with Backdrop Blur) ── */}
      {selectedPart && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setSelectedPartId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: 520,
              borderRadius: 6,
              border: '2px solid #0b3b60',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0b3b60',
                borderBottom: '3px solid #ff9933',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ff9933' }}>
                  domain
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.02em' }}>
                      {selectedPart.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8.5,
                        background: 'rgba(255,255,255,0.15)',
                        color: '#f8fafc',
                        padding: '1px 5px',
                        borderRadius: 2,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {selectedPart.code}
                    </span>
                    <span
                      style={{
                        fontSize: 8.5,
                        color: '#86efac',
                        background: 'rgba(22, 163, 74, 0.25)',
                        border: '1px solid rgba(134, 239, 172, 0.4)',
                        padding: '1px 5px',
                        borderRadius: 2,
                        fontWeight: 700,
                      }}
                    >
                      ● {selectedPart.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#cbd5e1', marginTop: 1 }}>
                    {isMaitri ? 'Maitri Base' : 'Bharati Base'} • {selectedPart.subsystem}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPartId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close (Esc)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  close
                </span>
              </button>
            </div>

            {/* Modal Body - Minimal & Clean */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9, background: '#f8fafc' }}>
              {/* Short 1-Line Description Box */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #0284c7',
                  borderRadius: 3,
                  padding: '6px 9px',
                  fontSize: 10,
                  color: '#334155',
                  lineHeight: 1.35,
                }}
              >
                {selectedPart.about || selectedPart.detailedOverview}
              </div>

              {/* 4 Key Status Metrics (Single Compact Row) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                {selectedPart.stats.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: '2.5px solid #0b3b60',
                      borderRadius: 3,
                      padding: '4px 6px',
                    }}
                  >
                    <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', marginTop: 1 }}>
                      {s.value}
                    </div>
                    {s.note && (
                      <div style={{ fontSize: 7.5, color: s.good ? '#15803d' : '#64748b', fontWeight: 600 }}>
                        {s.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Live IoT Sensors (Compact 4-column single row) */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  padding: '7px 9px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    📊 Live Sensors
                  </span>
                  <span style={{ fontSize: 7.5, color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1px 4px', borderRadius: 2, fontWeight: 700 }}>
                    1 Hz Live Feed
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  {selectedPart.telemetryChannels.map((tc, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 3,
                        padding: '4px 5px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: 8, color: '#475569', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tc.name}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                        {tc.value} <span style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>{tc.unit}</span>
                      </div>
                      <div style={{ fontSize: 7, color: '#16a34a', fontWeight: 800, marginTop: 1 }}>
                        ● {tc.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimal Key Specs Pill Strip */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 3,
                  padding: '5px 8px',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                  fontSize: 8.5,
                  color: '#475569',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ color: '#0b3b60', fontWeight: 800 }}>⚡ Specs:</strong>
                {selectedPart.keySpecs.slice(0, 3).map((spec, i) => (
                  <span
                    key={i}
                    style={{
                      background: '#f1f5f9',
                      padding: '2px 5px',
                      borderRadius: 2,
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                    }}
                  >
                    <strong>{spec.label}:</strong> {spec.value.length > 28 ? spec.value.slice(0, 25) + '...' : spec.value}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer (Compact) */}
            <div
              style={{
                padding: '7px 14px',
                background: '#f1f5f9',
                borderTop: '1px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 9.5,
                color: '#64748b',
              }}
            >
              <span>Himantar Digital Twin • Health: <strong style={{ color: '#16a34a' }}>{selectedPart.healthScore}% Nominal</strong></span>
              <button
                type="button"
                onClick={() => setSelectedPartId(null)}
                style={{
                  background: '#0b3b60',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 3,
                  padding: '4px 12px',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#082b47')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0b3b60')}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
