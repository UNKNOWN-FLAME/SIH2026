# Maitri Station Hybrid Generative & Live Telemetry Architecture

## 1. Hybrid Synthetic-Physical Methodology
To achieve production-grade realism, Maitri's digital twin employs a **hybrid data synthesis pipeline**:
1. **Live Ground Truth Meteorological Pull**:
   - Ingests real-time ambient temperature, pressure, wind velocity, and relative humidity for Schirmacher Oasis coordinates (**-70.7667°S, 11.7333°E**) via Open-Meteo polar feeds.
2. **Markov Weather State Transitions**:
   - Augments live weather with seasonal Markov chains capturing extreme katabatic wind gusts (surging from the polar plateau between 04:00 and 09:00 local time) and sudden polar blizzards.
3. **Deterministic Multi-Physics Solver**:
   - Feeds live meteorology into the 10 interconnected sub-models (Lake Priyadarshini water pipeline, oil-fired heating boilers, 100 kVA DG sets, fuel viscosity, and vehicle fleet).
4. **Telemetry Serialization & Export**:
   - Automatically streams structured JSON payloads to `current_state.json` and REST endpoints for HQ SCADA dashboards and AI training.
