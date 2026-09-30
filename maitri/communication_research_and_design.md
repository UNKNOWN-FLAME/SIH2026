# Maitri Station Ultra-Realistic Communication & Satcom System Design

## 1. Physical Architecture: Satcom Earth Station & Tactical Radio
Maitri Station is physically isolated by thousands of kilometers of ice and ocean. All telemetry, voice communication, emergency search and rescue (SAR), and science data transmission rely on redundant RF channels.

1. **Satellite Earth Station (GSAT-7A / VSAT)**:
   - Primary data link connecting Maitri directly to **NCPOR Headquarters in Goa**.
   - Housed inside an aerodynamic protective **radome** to withstand 180 km/h blizzards.
   - Steerable motorized parabolic reflector tracking geostationary orbital positions at very low elevation angles (~8° to 12° above the horizon) due to polar latitude (-70.77°S).
2. **HF & VHF Tactical Field Radios**:
   - Long-range High Frequency (HF, 3–30 MHz) transceivers for long-range polar field traverse teams, aircraft coordination, and relay to the nearby **Novolazarevskaya Runway (Novo Runway)** located ~12 km away.
   - VHF base station for local station camp handheld radios.
3. **Inter-Station Telemetry Relay**:
   - High-reliability trunk relay connecting Maitri to Bharati Station and the Indian Polar Research network.

---

## 2. Mathematical RF & Attenuation Modeling
The carrier-to-noise ratio ($C/N$) is modeled dynamically:
$$C/N = \text{EIRP}_{sat} + (G/T)_{earth} - \text{FSPL} - A_{radome\_ice} - A_{blizzard} - k \cdot B \quad (\text{dB})$$
Where:
- $\text{FSPL} = 20 \log_{10}(d) + 20 \log_{10}(f) + 92.45$ (Free space path loss).
- $A_{radome\_ice}$: Attenuation from snow and rime ice accumulation on the radome exterior (up to 9 dB attenuation during blizzard icing!).
- $A_{blizzard}$: Atmospheric scattering from blowing snow particles.
- If $C/N$ falls below $6.5 \, \text{dB}$, the demodulator loses carrier lock $\rightarrow$ Link State drops to `DEGRADED` or `DOWN`.

---

## 3. Single Points of Failure (SPOFs) Catalog

| Fault Identifier | Category | Physical Mechanism & Telemetry Symptoms |
| :--- | :--- | :--- |
| **`SATCOM_RADOME_ICING`** | Environmental RF | Wet blowing snow adheres to the radome surface. Signal attenuation increases; C/N drops by 6–9 dB; packet loss spikes to >25%. |
| **`SATCOM_TRACKING_DESYNC`** | Mechanical | High katabatic wind gusts cause antenna servo tracking slip. Pointing angle drifts off boresight; carrier lock drops; latency spikes >1500 ms. |
| **`SATCOM_LNB_FAIL`** | Electronics | Low Noise Block downconverter burns out due to polar static discharge. Complete loss of downlink signal; link transitions to `DOWN`. |
| **`HF_ANTENNA_MAST_DAMAGE`** | Structural | Guy wire snapped by 45 m/s storm winds. HF antenna mast tilts; field traverse communications severed. |
