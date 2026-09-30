# Maitri Station Ultra-Realistic Water Management System & Fault Catalog Plan

## 1. Physical Architecture: Lake Priyadarshini Freshwater System
Unlike Bharati Station, which relies on seawater desalination via Reverse Osmosis (RO), **Maitri Station is located beside Lake Priyadarshini (Zub Lake)**, an inland glacial freshwater lake in the Schirmacher Oasis.

The station draws fresh potable water directly from the lake. However, operating a freshwater pipeline in Antarctica presents severe physical challenges:
* In polar winter (May to September), Lake Priyadarshini develops an ice sheet between **1.5 to 2.2 meters thick**.
* The intake pump is suspended at a depth of ~4 to 6 meters where water remains liquid at +1.0°C to +3.8°C due to water density anomalies.
* The water must be conveyed across **250 meters of rocky polar terrain** via an insulated, electrically heat-traced pipeline.
* **The Catastrophic Failure Risk:** If electrical trace heating fails during winter blizzards (-30°C to -38°C), stagnant or low-velocity water in the 250m pipe freezes solid in **less than 45 minutes**, rupturing the pipe and severing the station's entire water lifeline.

---

## 2. Mathematical Modeling & Physics

### A. Lake Ice Growth Dynamics (Stefan's Equation)
The thickness of the lake ice layer $h_{ice}$ is modeled via Stefan's Law:
$$h_{ice}(t) = \sqrt{\frac{2 k_{ice}}{\rho_{ice} L_f} \int (T_f - T_{amb}) \, dt}$$
Where:
- $k_{ice} = 2.22 \, \text{W/(m}\cdot\text{K)}$ (Thermal conductivity of ice)
- $\rho_{ice} = 917 \, \text{kg/m}^3$ (Density of ice)
- $L_f = 334{,}000 \, \text{J/kg}$ (Latent heat of fusion)
- $T_f = 0.0^\circ\text{C}$ (Freezing point)
- $T_{amb}$ is the real-time ambient temperature from the Environment model.

### B. 250m Overland Pipeline Thermal Mass & Heat Tracing
The pipeline water temperature $T_{pipe}$ follows dynamic thermal balance:
$$\frac{dT_{pipe}}{dt} = \frac{P_{trace} - U_{pipe} A (T_{pipe} - T_{amb}) - \dot{m} C_p (T_{pipe} - T_{intake})}{m_{water} C_p + m_{pipe} C_{pipe}}$$
Where:
- $P_{trace} = 12.0 \, \text{kW}$ when trace heating is energized.
- $U_{pipe} = 0.35 \, \text{W/(m}^2\cdot\text{K)}$ (Polyurethane foam insulation rating).
- If $T_{pipe} \le 0.0^\circ\text{C}$, latent ice crystallization begins. If ice volume fraction exceeds 85%, hydraulic resistance jumps to infinity (pipeline blocked).

### C. Potable Water Storage & Multi-Stage Filtration
- **Storage:** 20,000 L twin indoor insulated stainless steel storage tanks.
- **Sediment & Sand Filtration:** Dual multimedia pre-filters remove glacial rock flour and particulate silt.
- **UV Sterilization Chamber:** Dual UV-C (254 nm) lamps ensure zero bacterial growth before distribution to the kitchen, medical dispensary, and living quarters.
- **Domestic Consumption:** Scaled dynamically to crew headcount (25 in winter = ~2,500 L/day; 65 in summer = ~6,500 L/day).

---

## 3. Exhaustive Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Type | Physical Impact & Telemetry Symptoms |
| :--- | :--- | :--- |
| **`WATER_TRACE_HEAT_FAIL`** | Environmental / Electrical | Trace heating cable breaker trips. In sub-zero temperatures, pipeline skin temperature rapidly drops. If unaddressed, leads to complete pipeline freeze and burst. |
| **`WATER_LAKE_PUMP_FAIL`** | Mechanical | Submerged lake intake pump motor burns out or seizes. Intake flow drops to 0.0 L/s; station tanks begin depleting without replenishment. |
| **`WATER_ICE_INTAKE_CHOKE`** | Physical / Glaciological | Extreme winter ice expansion reaches the intake strainer bell-mouth. Pumping cavitation occurs, suction pressure drops sharply, intake flow drops by 70%. |
| **`WATER_SEDIMENT_CLOG`** | Gradual Degradation | Summer glacial meltwater introduces excessive rock flour into the lake. Pre-filter differential pressure ($\Delta P$) spikes from 0.3 bar to >2.5 bar. |
| **`WATER_UV_STERILIZER_FAIL`**| Optical / Electrical | UV-C ballast failure or lamp burnout. UV intensity drops below $16 \, \text{mJ/cm}^2$, triggering biological contamination warning. |
| **`WATER_TANK_LEAK`** | Mechanical / Structural | Rupture or gasket failure in the 20,000 L indoor potable tank. Water level drops by 0.8 L/s, flooding the utility bilge. |
| **`WATER_BOILER_CALORIFIER_FAIL`** | Thermal / Hydronic | Domestic hot water heat exchanger tube leak. Potable hot water temperature drops below 45°C, creating hygiene risk. |
| **`WATER_PIPE_BURST`** | Catastrophic | Structural pipe rupture caused by frozen ice expansion after trace heat failure. Massive pressure loss, zero delivery to station. |
