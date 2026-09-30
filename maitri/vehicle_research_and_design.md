# Maitri Station Ultra-Realistic Polar Vehicle Fleet System Design

## 1. Physical Architecture: Heavy Tracked Fleet & 230V Block Heaters
Transport at Maitri Station operates over ice, snow, and rough rocky moraines of the Schirmacher Oasis:
1. **Tracked Fleet**:
   - **PistenBully 300 Polar**: Heavy-duty tracked snow groomers used for cargo sled towing, crevasse exploration, and fuel drum transport.
   - **Manitou Polar Crane & Bulldozers**: Material handling and heavy cargo unloading.
   - **Ski-Doo Snowmobiles**: Fast tactical mobility for glaciological and lake sampling missions.
2. **The Polar Cold-Soak Challenge (230V Engine Block Heaters)**:
   - At -30°C to -40°C, engine motor oil thickens into molasses, diesel fuel waxes, and 12V/24V lead-acid batteries lose 60% of their chemical cranking amp capacity.
   - All outdoor-parked vehicles must remain connected to **230V Electrical Engine Block & Sump Heaters** powered by the station microgrid whenever not in active service.
   - If a vehicle's block heater is unplugged or loses power during a sub-zero night, the engine "cold-soaks" and cannot be started without hours of external hot-air pre-heating tents.

---

## 2. Mathematical Modeling & Engine Thermodynamics
$$C_{engine} \frac{dT_{eng}}{dt} = P_{block\_heater} - U_{eng} A (T_{eng} - T_{amb})$$
- When plugged in: $P_{block\_heater} = 1.5 \, \text{kW}$ per vehicle, holding engine core temperature at $+20^\circ\text{C}$ to $+35^\circ\text{C}$.
- If unplugged: Engine cools toward $T_{amb}$ with a time constant $\tau \approx 3.5 \, \text{hours}$. If $T_{eng} < -15^\circ\text{C}$, engine cranking attempt fails (cold-start lock).

---

## 3. Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Category | Physical Mechanism & Symptoms |
| :--- | :--- | :--- |
| **`VEHICLE_BLOCK_HEATER_DISCONNECT`**| Electrical | External 230V heating cable disconnected by snowdrift or severed. Engine core cold-soaks to -35°C; emergency traverse vehicle immobilized. |
| **`VEHICLE_HYDRAULIC_HOSE_BURST`** | Fluid Mechanical | Extreme cold causes rubber embrittlement on crane or PistenBully track blade hydraulic lines. Line ruptures at 250 bar; hydraulic fluid spill. |
| **`VEHICLE_FUEL_LINE_ICE_PLUG`** | Fuel System | Trace condensation in vehicle tank freezes into ice crystals in fuel filter bowl. Engine sputters and stalls during fieldwork. |
| **`VEHICLE_ALTERNATOR_BELT_SNAP`** | Mechanical | Frozen drive belt snaps during high-RPM snow clearing. Battery discharges; vehicle stalls in the field. |
