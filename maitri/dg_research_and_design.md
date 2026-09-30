# Maitri Station Ultra-Realistic Power Generation System (DG Sets & Solar PV)

## 1. Architectural Reality: Independent DG Sets (No Modern CHP)
At Bharati Station, power and thermal management are unified in modern Combined Heat and Power (CHP) containerized modules. 

In **Maitri Station**, the electrical and heating architectures are structurally separated:
1. **Powerhouse Generator Shed**: Houses **3x 100 kVA Polar Diesel Generator (DG) sets** (typically Kirloskar / Cummins / Caterpillar engines coupled to Stamford alternators).
   - Unlike Bharati's high-efficiency integrated CHP, these are traditional heavy-duty polar industrial generators with heavy radiator cooling fans.
   - Operating configuration: **1 Duty, 1 Hot Standby, 1 Maintenance / Cold Reserve** (N+1 redundancy).
   - Electrical output: 415V 3-Phase, 230V Single-Phase, 50 Hz.
2. **Supplemental Renewable Generation**:
   - In recent expeditions, NCPOR installed a **25 kWp Solar Photovoltaic (PV) array** on the container roofs and laboratory rooftops to offset fuel burn during the continuous 24-hour sunlight of the polar summer (November to February).
   - An experimental polar wind turbine generator (5 kW).
3. **Station Switchboard & Battery UPS**:
   - Central Automatic Transfer Switch (ATS) to manage generator transitions.
   - Lead-acid / Gel Battery Bank UPS (60 kVA / 30 minutes autonomy) protecting the satellite earth station, life-support controllers, and scientific instruments during DG changeover.

---

## 2. Advanced Mathematical Physics Modeling

### A. Polar Diesel Engine Combustion & Efficiency
For each generator unit, the electrical power output $P_{elec}$ and fuel consumption $\dot{m}_{fuel}$ are modeled through a dynamic Brake Specific Fuel Consumption (BSFC) curve:
$$\text{BSFC}(L) = \text{BSFC}_{rated} \cdot \left[1 + 0.45(1 - L)^2\right] \quad (g/\text{kWh})$$
Where:
- $L = \frac{P_{actual}}{P_{max}}$ is the generator load factor.
- At low loads ($L < 0.30$), efficiency collapses, causing fuel unburned accumulation (wet stacking risk in polar conditions!).
- Fuel flow rate:
$$\dot{V}_{fuel} = \frac{P_{actual} \cdot \text{BSFC}(L)}{\rho_{fuel} \cdot 1000} \cdot (1 + \delta_{injector}) \quad (\text{L/hr})$$
Where $\delta_{injector}$ represents nozzle carbon fouling.

### B. Turbocharger & Combustion Dynamics
- **Exhaust Gas Temperature (EGT)**: The primary diagnostic indicator of combustion health. 
$$T_{egt} = T_{ambient} + 280 + 260 \cdot L + \Delta T_{rich}$$
If the intake air filter clogs with blowing drift snow, Air-to-Fuel Ratio (AFR) drops below stoichiometric levels, causing unburned fuel to combust in the exhaust manifold, triggering an EGT spike up to 650°C.
- **Boost Pressure**:
$$P_{boost} = P_{atm} + 1.4 \cdot L \cdot (1 - \delta_{filter}) \quad (\text{bar})$$

### C. Solar PV Array Generation (Schirmacher Solar Model)
During polar summer, the 25 kWp solar array contributes substantial clean power:
$$P_{solar}(t) = \eta_{inv} \cdot A_{array} \cdot \eta_{pv} \cdot G(t) \cdot [1 - \gamma_{temp}(T_{cell} - 25)]$$
Where:
- $G(t)$ is incident global solar radiation from the Schirmacher Oasis environment model.
- Because ambient temperatures are cold (-2°C to +3°C in summer), solar panel efficiency increases due to the negative temperature coefficient $\gamma_{temp} = -0.004 / ^\circ\text{C}$!

### D. Alternator & AVR Dynamics
- Output voltage $V_{bus}$ is governed by the Automatic Voltage Regulator (AVR) PID loop maintaining 415V $\pm$ 1.5%.
- Shaft vibration $Vib_{rms}$ (nominal 1.8–2.5 mm/s) indicates bearing wear, misalignment, or cylinder misfire.

---

## 3. Exhaustive Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Category | Physical Mechanism & Telemetry Symptoms |
| :--- | :--- | :--- |
| **`DG1_INJECTOR_FOULING`** | Fuel System | Carbon coking on injector tips. Engine runs rough; vibration rises from 2.1 to 6.8 mm/s; fuel consumption increases by 20%. |
| **`DG1_FUEL_PUMP_WEAR`** | Fuel System | High-pressure injection pump internal wear. Rail pressure drops from 1200 bar to 800 bar; engine cannot sustain loads above 65 kW. |
| **`DG1_AIR_FILTER_BLIZZARD_CLOG`** | Air Intake | Blowing snow accumulates in the external air louvers. Boost pressure drops, mixture runs rich, EGT spikes dangerously (>620°C). |
| **`DG1_TURBO_BEARING_FAIL`** | Mechanical | Turbocharger shaft seizure. Loss of boost; engine stalls if load exceeds 40 kW; thick black smoke emitted. |
| **`DG1_COOLANT_LEAK`** | Thermal / Cooling | Radiator hose rupture. Jacket water coolant drops rapidly; coolant temp spikes above 105°C; emergency safety trip activates. |
| **`DG1_RADIATOR_FAN_FAIL`** | Electrical / Mech | Radiator cooling fan belt snaps. Inadequate air draft across the radiator core; engine slowly overheats under load. |
| **`DG1_OIL_PRESSURE_DROP`** | Lubrication | Lube oil pump cavitation or severe leak. Oil pressure drops below 1.5 bar; auto-shutdown within 15 seconds to prevent crankshaft seizure. |
| **`DG1_AVR_FAILURE`** | Electrical | Automatic Voltage Regulator failure. Bus voltage fluctuates erratically between 340V and 470V; trips main circuit breakers. |
| **`DG1_ALTERNATOR_BEARING_WEAR`**| Mechanical | Alternator drive bearing degradation. Vibration spikes up to 12 mm/s; stator winding temperature creeps above 115°C. |
| **`DG2_FAIL_TO_START`** | Starting System | Hot-standby generator starting motor solenoid or battery fails. If DG-1 trips, black start delay occurs, station enters blackout. |
| **`SOLAR_INVERTER_TRIP`** | Renewable | Solar rooftop inverter fault. Solar generation instantly drops to 0 kW, transferring full load onto running DG set. |
| **`BUSBAR_PHASE_IMBALANCE`** | Electrical | Severe phase load imbalance (>30% difference between phases). Causes neutral current rise and alternator overheating. |
