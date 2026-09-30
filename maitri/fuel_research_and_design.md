# Maitri Station Ultra-Realistic Fuel Management System Design

## 1. Physical Architecture: 165,000 L Bulk Tank Farm & Day Tank Distribution
In Antarctica, fuel is the single most critical life-support commodity. Without fuel, heating boilers die, generators halt, and the station freezes within hours.

At **Maitri Station**, fuel logistics are structured into a 3-tier safety architecture:
1. **Bulk Fuel Farm (165,000 L)**:
   - Situated outdoors on engineered gravel bunds.
   - Comprises cylindrical steel bulk storage tanks holding Aviation Turbine Fuel (ATF) / Jet A-1 and Polar Diesel (D-A).
   - Jet A-1 has a freezing point of -47°C; however, at temperatures below -30°C, paraffin wax crystals precipitate, drastically increasing viscosity.
2. **Overland Fuel Transfer Lines & Heat-Tracing**:
   - Insulated steel piping connecting the outdoor bulk farm to the Generator House and Boiler Room.
   - Equipped with electrical heat-tracing to maintain fuel temperature above -15°C during transfer, preventing waxing and line clogging.
3. **Duplex Transfer Pumping Station & Day Tank (2,500 L)**:
   - Operating under **Duty / Standby** redundancy (Pump A and Pump B).
   - Fuel passes through duplex sediment strainers and water separators before reaching the **2,500 L indoor Day Tank**.
   - The Day Tank directly supplies fuel to both the 3x 100 kVA DG sets and the 2x Oil-Fired Heating Boilers.

---

## 2. Mathematical Modeling & Fluid Dynamics

### A. Polar Fuel Viscosity Dynamics (Jet A-1 / ATF)
Fuel viscosity $\mu(T)$ follows an exponential temperature relationship:
$$\mu(T) = \mu_0 \cdot \exp\left(-\beta (T - T_0)\right) \quad (\text{cSt})$$
Where:
- At $+15^\circ\text{C}$: $\mu \approx 2.1 \, \text{cSt}$
- At $-20^\circ\text{C}$: $\mu \approx 8.4 \, \text{cSt}$
- At $-40^\circ\text{C}$: $\mu \approx 52.0 \, \text{cSt}$
- Below $-47^\circ\text{C}$: Fuel gels solid ($\mu > 1000 \, \text{cSt}$), causing pump cavitation and complete fuel line blockage.

### B. Fuel Transfer & Mass Balance
$$\frac{dV_{day}}{dt} = Q_{transfer} - \left(\dot{V}_{DG\_burn} + \dot{V}_{boiler\_burn} + \dot{V}_{vehicle\_refuel}\right)$$
- If the Day Tank level drops below $800 \, \text{L}$ (approx. 8 hours of winter reserve), the SCADA automatically triggers transfer pump start.
- Transfer ceases when the Day Tank reaches $2{,}400 \, \text{L}$ (high-level cutoff).

---

## 3. Exhaustive Fuel Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Category | Physical Mechanism & Telemetry Symptoms |
| :--- | :--- | :--- |
| **`FUEL_MAIN_FARM_LEAK`** | Storage | Puncture or seam rupture on outdoor bulk tank. Fuel volume drops at 5 L/s; station autonomy days plummet sharply. |
| **`FUEL_LINE_HEAT_TRACE_FAIL`**| Electrical / Thermal | Outdoor fuel transfer line trace heater breaker trips. At -35°C ambient, fuel gels in the line; transfer flow drops to 0.0 L/s. |
| **`FUEL_PUMP_A_FAIL`** | Pumping | Primary transfer pump motor burns out. Flow drops momentarily; SCADA auto-starts standby Pump B; redundancy lost alarm raised. |
| **`FUEL_PUMP_B_FAIL`** | Pumping | Standby pump failure. If Pump A is also offline, transfer capability is completely lost; day tank depletes in ~24 hours. |
| **`FUEL_FILTER_WATER_CLOG`** | Filtration | Water contamination in bulk fuel forms ice crystals in the pre-filter. Filter differential pressure ($\Delta P$) spikes >2.0 bar. |
| **`FUEL_DAY_TANK_LEAK`** | Structural | Rupture in the indoor 2,500 L day tank. Fuel spills into powerhouse containment sump; emergency fuel shutoff valve trips. |
| **`FUEL_DAY_TANK_SENSOR_STUCK`**| Sensor Poisoning | Float level sensor stuck reading "1800 L". Controller fails to auto-fill; Day Tank runs completely dry, causing simultaneous generator and boiler blackout. |
