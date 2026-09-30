# Maitri Station Human Asset & Crew Life-Support Physiology Design

## 1. Physical Architecture: Expedition Crew Demographics & Metabolism
Station life support is driven entirely by human physiological requirements:
1. **Expedition Headcount**:
   - **Winter-Over Period (March to October)**: Strictly **25 members** (Station Commander, 4 mechanical engineers, 2 electrical/powerhouse engineers, 2 doctors/surgeons, 4 atmospheric/geophysical scientists, 2 IT/comms officers, 2 cooks, 8 support technicians).
   - **Summer Period (November to February)**: Up to **65 members** with arriving glaciologists, field geologists, and logistics replacement personnel living in summer camp huts.
2. **Physiological Consumption & Environmental Coupling**:
   - **Metabolic Heat Generation**: $120 \, \text{W}$ sensible heat per person in resting/normal activity; up to $280 \, \text{W}$ during heavy outdoor shoveling/maintenance. Couplings into the HVAC indoor thermal balance equation.
   - **Potable Water Consumption**: $100 \, \text{L/person/day}$ (drinking, galley cooking, personal hygiene, and laundry). Couplings into the Water Storage model.
   - **Oxygen & CO2 Respiration**: Crew consumes approx. $0.85 \, \text{kg } O_2/\text{day}$ and exhales $1.0 \, \text{kg } CO_2/\text{day}$. If ventilation fan stalls, indoor CO2 climbs from 420 PPM baseline to toxic thresholds (>2,500 PPM).
   - **Cold Stress & Wind Chill Index**: Monitored based on outside ambient and wind speed for field safety advisories (Madrid Protocol safety mandate).
