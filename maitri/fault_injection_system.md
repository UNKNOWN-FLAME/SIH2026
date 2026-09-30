# Maitri Station Fault Injection System & SPOF Master Catalog

## 1. Overview & Architecture
The **Maitri Fault Injection System** ("God Mode Controller") is a centralized registry enabling operators, developers, and ML training pipelines to inject single points of failure (SPOFs), multi-point cascaded emergencies, and gradual equipment degradation states into the Maitri Digital Twin.

It exposes:
1. **Dynamic Registration**: Each subsystem registers its physical failure modes on startup.
2. **Severity Control**: Faults accept a severity parameter ($0.0 \le \sigma \le 1.0$), scaling the physical degradation (e.g., partial pump wear vs catastrophic seizure).
3. **State Snapshot Engine**: Allows saving and loading complete simulation states for reproducible AI testing.

---

## 2. Complete Maitri Station SPOF Catalog (Master Table)

| Domain | Fault ID | Type | Target Subsystem & Consequence |
| :--- | :--- | :--- | :--- |
| **Water** | `WATER_TRACE_HEAT_FAIL` | Environmental | 250m overland pipe trace heater trips; pipe freezes at 0°C within 45 min. |
| **Water** | `WATER_LAKE_PUMP_FAIL` | Mechanical | Submerged Lake Priyadarshini intake pump failure; zero water intake. |
| **Water** | `WATER_ICE_INTAKE_CHOKE`| Physical | Lake surface ice sheet (up to 2.2m) reaches intake strainer; cavitation. |
| **Water** | `WATER_SEDIMENT_CLOG` | Gradual | Glacial meltwater rock flour clogs pre-filters; $\Delta P > 2.5$ bar. |
| **Water** | `WATER_UV_STERILIZER_FAIL`| Optical | UV-C disinfection lamp burnout; biological contamination risk. |
| **Water** | `WATER_TANK_LEAK` | Structural | Rupture in indoor 20,000 L potable water storage tank; 0.8 L/s loss. |
| **Power** | `DG1_INJECTOR_FOULING` | Gradual | Carbon coking on DG-1 nozzles; high vibration, 20% fuel burn increase. |
| **Power** | `DG1_FUEL_PUMP_WEAR` | Gradual | Common rail pump pressure loss; inability to hold >65 kW load. |
| **Power** | `DG1_AIR_FILTER_BLIZZARD_CLOG`| Air Intake | Blowing snow clogs intake louvers; rich combustion, EGT >620°C. |
| **Power** | `DG1_TURBO_BEARING_FAIL` | Mechanical | Turbocharger bearing seizure; loss of boost, engine stalls under load. |
| **Power** | `DG1_COOLANT_LEAK` | Thermal | Radiator hose burst; coolant temp >105°C; emergency engine shutdown. |
| **Power** | `DG1_RADIATOR_FAN_FAIL` | Mechanical | Cooling fan belt snaps; slow progressive overheat under load. |
| **Power** | `DG1_AVR_FAILURE` | Electrical | Automatic Voltage Regulator failure; wild 340V–470V bus voltage swings. |
| **Power** | `DG1_ALTERNATOR_BEARING_WEAR`| Mechanical | Alternator drive bearing degradation; vibration >10 mm/s. |
| **Power** | `DG2_FAIL_TO_START` | Starting | Hot-standby starting solenoid failure; station blackout if DG-1 trips. |
| **Power** | `SOLAR_INVERTER_TRIP` | Renewable | 25 kW Solar PV rooftop inverter trip; full load transferred to DG set. |
| **HVAC** | `BOILER_FLAMEOUT` | Combustion | Oil heating burner nozzle clog or electrode fault; hydronic loop cools. |
| **HVAC** | `BOILER_FUEL_SOLENOID_FAIL` | Fuel Valve | Oil boiler fuel supply solenoid jams closed; boiler lockout. |
| **HVAC** | `HVAC_CIRC_PUMP_A_FAIL` | Hydronic Pump | Primary hot water circulation pump trip; auto-switch to Pump B. |
| **HVAC** | `HVAC_CIRC_PUMP_B_FAIL` | Hydronic Pump | Standby pump failure; complete loss of station heating distribution. |
| **HVAC** | `HVAC_BLIZZARD_DAMPER_FREEZE`| Actuator | Fresh air damper frozen open in 40 m/s blizzard; AHU coil freezes. |
| **HVAC** | `HVAC_AHU_BLOWER_FAIL` | Air Handling | Ventilation blower motor trip; indoor CO2 levels exceed 1800 PPM. |
| **HVAC** | `HVAC_THERMOSTAT_DRIFT` | Sensor Drift | Thermostat reads +6°C too high; false heating throttle, room freezes. |
| **Fuel** | `FUEL_MAIN_FARM_LEAK` | Bulk Storage | Outdoor bulk storage tank rupture; loss of 5 L/s, autonomy drops. |
| **Fuel** | `FUEL_LINE_HEAT_TRACE_FAIL` | Electrical | Outdoor fuel line trace heater trips; fuel gels below -30°C. |
| **Fuel** | `FUEL_PUMP_A_FAIL` | Transfer Pump | Primary transfer pump failure; auto-switch to standby Pump B. |
| **Fuel** | `FUEL_PUMP_B_FAIL` | Transfer Pump | Standby pump failure; total loss of fuel transfer to day tank. |
| **Fuel** | `FUEL_DAY_TANK_LEAK` | Storage | Indoor 2,500 L day tank rupture; fire hazard and engine starvation. |
| **Wastewater** | `STP_AERATION_HEATER_FAIL` | Biological | Biological STP immersion heater trips; bacteria die below 8°C. |
| **Wastewater** | `STP_BLOWER_FAIL` | Aeration | Aeration air compressor failure; dissolved oxygen drops, anaerobic stench. |
| **Comms** | `SATCOM_RADOME_ICING` | RF Link | Wet snow/ice accumulation on satellite radome; C/N drops by 8 dB. |
| **Comms** | `SATCOM_TRACKING_DESYNC` | Mechanical | Azimuth/Elevation antenna motor desync in high winds; packet loss >40%. |
| **Vehicle** | `VEHICLE_BLOCK_HEATER_DISCONNECT` | Thermal | 230V plug-in engine block heater unplugged; engine cold-soaks at -35°C. |
