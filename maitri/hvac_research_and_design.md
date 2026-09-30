# Maitri Station Ultra-Realistic Heating & HVAC System Design

## 1. Architectural Reality: Dedicated Oil-Fired Boilers & Hydronic Radiators
Unlike Bharati Station's modern building envelope and unified CHP heat-recovery loops, **Maitri Station relies on a dedicated Boiler House** operating oil-fired heating boilers as the primary thermal life-support system.

### A. The Core Heating Architecture
1. **Central Boiler Plant**:
   - Houses **2x Oil-Fired Hot Water Boilers** (Burners rated 150 kW thermal each, operating in Duty/Standby).
   - The burners consume Antarctic-grade special low-pour fuel / ATF from the station Day Tank.
   - Main supply water temperature is maintained at **80°C**, returning at **65°C**.
2. **Station Hydronic Radiator Network**:
   - Hot water is continuously circulated by dual hydronic pumps (Duty/Standby) through steel and copper piping across the stilt-supported station blocks.
   - Heats the Living Quarters, Mess/Galley, Medical Room, Science Labs, and Officer Cabins via hydronic panel radiators with thermostatic radiator valves (TRVs).
3. **Air Handling Unit (AHU) & Ventilation**:
   - Fresh outdoor air is drawn through an intake louver, heated via a hydronic heating coil, and distributed throughout communal spaces to control CO2 and moisture.
   - Damper actuators modulate fresh air intake vs recirculated air based on CO2 sensors and outside blizzard conditions.
4. **Domestic Hot Water (DHW) Calorifiers**:
   - 1,500 L insulated storage calorifier heated via internal coil to 60°C to eliminate *Legionella pneumophila* bacteria.
5. **Emergency Electric Resistance Heating**:
   - If the oil boiler experiences a flameout or fuel feed failure during a -35°C blizzard, emergency 3 kW/5 kW electric duct and space heaters activate automatically from the DG power grid to prevent indoor room temperatures from plummeting to freezing levels.

---

## 2. Advanced Thermodynamic Modeling & Physics

### A. Structural Building Thermal Balance
The station's indoor temperature $T_{in}$ evolves according to dynamic heat loss:
$$C_{building} \frac{dT_{in}}{dt} = Q_{radiators} + Q_{aux\_electric} + Q_{occupants} - \sum U_i A_i (T_{in} - T_{amb}) - \dot{m}_{vent} C_{p,air} (T_{in} - T_{amb})$$
Where:
- $C_{building} = 18{,}500 \, \text{kJ/K}$ (Thermal mass of the steel/wood insulated structure).
- $\sum U_i A_i \approx 3.2 \, \text{kW/K}$ (Total station thermal conductance, factoring stilt exposure to cold wind under the floor).
- $Q_{occupants} \approx 25 \times 120 \, \text{W} = 3.0 \, \text{kW}$ metabolic sensible heat.

### B. Oil-Fired Boiler Thermal Generation & Fuel Burn
When the boiler is firing:
$$Q_{boiler} = \dot{V}_{boiler\_fuel} \cdot \text{LHV}_{fuel} \cdot \eta_{boiler}$$
Where:
- $\text{LHV}_{fuel} \approx 36.5 \, \text{MJ/L}$ (ATF / Polar Diesel lower heating value).
- $\eta_{boiler} \approx 84\%$ (Combustion efficiency).
- Boiler modulates firing rate (30% to 100%) to maintain primary hydronic supply header at $80^\circ\text{C} \pm 2^\circ\text{C}$.

### C. Domestic Hot Water (DHW) Calorifier Dynamics
$$V_{dhw} \rho C_p \frac{dT_{dhw}}{dt} = Q_{coil} - \dot{m}_{dhw\_use} C_p (T_{dhw} - T_{potable\_in})$$
If $T_{dhw} < 55^\circ\text{C}$, the SCADA triggers a `LEGIONELLA_RISK` sanitary alarm.

---

## 3. Exhaustive HVAC Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Category | Physical Mechanism & Telemetry Symptoms |
| :--- | :--- | :--- |
| **`BOILER_FLAMEOUT`** | Thermal / Fuel | Burner nozzle clogging or ignition electrode failure. Boiler flame trips; hydronic supply temp rapidly drops from 80°C toward ambient; station indoor temp begins exponential decay. |
| **`BOILER_FUEL_SOLENOID_FAIL`** | Valve / Electrical | Fuel supply solenoid valve fails closed. Burner fuel starvation; boiler enters lockout state; requires manual reset. |
| **`HVAC_CIRC_PUMP_A_FAIL`** | Hydronic Pump | Primary hot water circulation pump motor trip. Flow drops momentarily to 0 L/s; standby pump B auto-starts; differential pressure restored. |
| **`HVAC_CIRC_PUMP_B_FAIL`** | Hydronic Pump | If injected while Pump A is degraded, total hydronic circulation loss occurs; radiators cool down; boiler overheats locally. |
| **`HVAC_PIPE_BURST_LEAK`** | Fluid Mechanical | Rupture in station hot water distribution pipe due to thermal cycling. Hydronic loop pressure drops below 0.5 bar; circulation pumps trip on low pressure. |
| **`HVAC_BLIZZARD_DAMPER_FREEZE`**| Actuator / Ice | Intake damper frozen stuck open during 40 m/s blizzard. Excessive sub-zero air enters AHU; heating coil freezes; room temp drops precipitously. |
| **`HVAC_AHU_BLOWER_FAIL`** | Air Handling | Ventilation blower fan belt snaps or VFD fails. Zero forced air circulation; living block CO2 levels rise steadily (>1800 PPM). |
| **`HVAC_THERMOSTAT_DRIFT`** | Sensor Poisoning | Living zone thermostat drifts +6°C higher than true temperature. Controller mistakenly throttles heating; crew experiences severe cold while SCADA reads "21°C". |
| **`HVAC_DHW_CALORIFIER_FAIL`** | Sanitary / Thermal | Thermostatic mixing valve failure on hot water tank. Domestic hot water drops below 48°C; biological hygiene hazard declared. |
