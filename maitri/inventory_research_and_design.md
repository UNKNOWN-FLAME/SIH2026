# Maitri Station Ultra-Realistic Inventory & Asset Reliability Design

## 1. Physical Architecture: Weibull Asset Reliability & Life-Support Inventory
In the isolated environment of East Antarctica, there is **zero resupply** between March and November when ships cannot penetrate the pack ice and flights are grounded.

The **Maitri Inventory & Asset Reliability Model** manages:
1. **Dynamic Weibull Equipment Reliability**:
   - Every rotating machine (DG alternator bearings, fuel transfer pumps, lake intake pumps, boiler blowers) follows a 2-parameter Weibull failure distribution:
     $$F(t) = 1 - \exp\left( -\left(\frac{t}{\eta}\right)^\beta \right)$$
     Where $\beta > 1$ models wear-out phase aging under polar thermal stress.
2. **Automated MTTR (Mean Time to Repair) Work Order Dispatch**:
   - When a fault is triggered or a component reaches high anomaly thresholds, an automated work order is dispatched to the station engineering team.
   - Repair consumes spare parts (e.g. `SPARE_INJECTOR_SET`, `SPARE_PUMP_SEAL`, `SPARE_TRACE_CABLE`) and takes realistic time ($\text{MTTR} \sim 30\text{--}180$ minutes) based on blizzard weather conditions.
3. **Critical Consumables & Autonomy Tracking**:
   - **Fuel Autonomy**: Calculated dynamically from live aggregate burn (DG sets + Boilers + Vehicles).
   - **Food & Provisions**: Total calories and balanced nutrition for 25 winter crew / 65 summer crew.
   - **Polar Medicine & Life Support**: Trauma supplies, antibiotics, oxygen cylinder reserves, frostbite medication.

---

## 2. Inventory Catalog & Spares Registry

| Category | Item Code | Initial Stock | Minimum Safe Threshold | Daily Consumption Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Fuel** | `FUEL_JET_A1_LITRES` | 165,000 L | 35,000 L (Emergency Winter Buffer) | Dynamic (~1,200–1,800 L/day) |
| **Spares** | `SPARE_DG_INJECTORS` | 12 units | 3 units | On failure / maintenance |
| **Spares** | `SPARE_WATER_PUMP_SEALS`| 8 units | 2 units | On failure / wear |
| **Spares** | `SPARE_TRACE_HEAT_CABLE_M`| 150 m | 50 m | On pipeline freeze damage |
| **Rations**| `FOOD_RATION_DAYS` | 450 days | 120 days | 1.0 day/day |
| **Medical**| `MEDICAL_O2_CYLINDERS` | 18 cylinders | 4 cylinders | As needed |
