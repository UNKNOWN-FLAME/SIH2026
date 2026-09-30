# Available Data & Real-Time Ingestion Architecture: Maitri Station

## 1. Physical vs Publicly Accessible Data Streams
In polar station digital twinning, certain environmental datasets are publicly observable via satellites and meteorological agencies (IMD / WMO / Open-Meteo), while internal industrial telemetry (DG health, boiler pressure, lake pipeline trace heat, tank volumes) must be computationally simulated with rigorous physics:

| Domain | Real World Source | Simulation Approach in Maitri Digital Twin |
| :--- | :--- | :--- |
| **Meteorology** | IMD Maitri Weather Station / Open-Meteo API | Hybrid Generative: Real GPS (-70.7667°S, 11.7333°E) live weather overlay + Markov Blizzard model |
| **Lake Priyadarshini** | NCPOR Hydrological Reports | Stefan's ice freezing equations + 250m overland pipe thermal balance |
| **Power Grid** | Classified NCPOR SCADA logs | 3x 100 kVA polar DG physics + rooftop Solar PV irradiance integration |
| **Boiler & Heating** | Internal station logbooks | Dual oil boiler thermodynamic combustion + station hydronic radiator balance |
| **Fuel Reserves** | Annual expedition manifests | Dynamic mass-balance burn integration (165,000 L bulk farm + 2,500 L day tank) |
| **Satcom Links** | GSAT-7A telemetry | RF link-budget equations with radome snow attenuation and servo tracking drift |
