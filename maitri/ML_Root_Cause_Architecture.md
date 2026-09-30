# Maitri Station ML Root Cause Analysis (RCA) & Predictive Architecture

## 1. Machine Learning Multi-Fault Correlation
The primary objective of the high-fidelity Maitri Digital Twin is providing realistic multi-variate telemetry streams for automated Anomaly Detection, Failure Prognostics, and Root Cause Analysis (RCA).

Because subsystems are physically coupled through the Interdependency Engine:
1. **The Lake Freeze Signature**:
   - `WATER_TRACE_HEAT_FAIL` causes pipeline skin temperature to drop below 0°C.
   - Pumping flow rate drops due to viscous ice crystallization.
   - The pump motor current ($I_{pump}$) spikes due to back-pressure resistance.
   - Indoor station water tanks deplete.
   - The ML Root Cause model can distinguish this from a simple pump failure (`WATER_LAKE_PUMP_FAIL`) because pipeline temperature leads flow rate collapse!
2. **The Boiler Flameout Signature**:
   - `BOILER_FLAMEOUT` causes instant drop in boiler flue gas temperature.
   - Hydronic loop return temperature drops within 3 minutes.
   - Emergency electric resistance heaters engage, causing a sudden 30 kW spike in the DG electrical load.
   - The ML model correlates the power spike to heating loss, isolating the root cause to the boiler burner.
3. **The Blizzard Generator Clogging Signature**:
   - High wind speeds (>35 m/s) and sub-zero temperatures (-30°C) from the Environment model cause drift snow ingestion into DG-1 air filters (`DG1_AIR_FILTER_BLIZZARD_CLOG`).
   - Boost pressure falls while EGT spikes.
   - The AI isolates the external environmental trigger vs an internal mechanical injector failure.
