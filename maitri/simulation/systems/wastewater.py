import logging
import math
import random

class WastewaterModel:
    """
    Simulates Maitri Station's Wastewater Treatment & Sanitation System:
    - Biological Sewage Treatment Plant (STP) with electric immersion heating
    - Extended aeration tank (requires >10°C to sustain biological bacteria)
    - Clarifier settling tank & UV tertiary disinfection
    - Incinerator toilets for solid waste reduction to sterile ash
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # Aeration Tank Physical & Bio State
        self.aeration_tank_temp_c = 14.5
        self.immersion_heater_active = True
        self.heater_kw = 4.5
        
        self.dissolved_oxygen_mg_l = 3.8
        self.biomass_health_pct = 95.0
        self.effluent_bod_mg_l = 12.0 # Compliant < 20 mg/L
        
        # STP Hydraulic Tanks
        self.raw_influent_tank_L = 1200.0
        self.treated_effluent_tank_L = 800.0
        
        # Incinerator Toilets
        self.incinerator_active = False
        self.incinerator_chamber_temp_c = 780.0
        self.incinerator_kw = 0.0
        
        self.electrical_demand_kw = 0.0
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("STP_AERATION_HEATER_FAIL", "STP electric immersion heater failure (Biomass freezes)")
        fm.register_spof("STP_BLOWER_FAIL", "Aeration compressor failure (Dissolved oxygen drops)")
        fm.register_spof("STP_DISCHARGE_PUMP_FAIL", "Treated effluent discharge pump seizure")
        fm.register_spof("INCINERATOR_TOILET_COIL_FAIL", "Incinerator toilet heating coil burnout")

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        amb_temp = env.get("ambient_temperature_c", -15.0)
        occupants = state.get("human", {}).get("headcount", 25)
        
        fm = self.fault_manager
        heater_fail = fm.is_fault_active("STP_AERATION_HEATER_FAIL")
        blower_fail = fm.is_fault_active("STP_BLOWER_FAIL")
        discharge_fail = fm.is_fault_active("STP_DISCHARGE_PUMP_FAIL")
        incin_fail = fm.is_fault_active("INCINERATOR_TOILET_COIL_FAIL")
        
        # 0. Power Grid Check
        grid_status = state.get("power", {}).get("grid_status", "NOMINAL")
        has_power = (grid_status != "BLACKOUT")
        
        self.electrical_demand_kw = 0.0
        
        # 1. Biological Tank Thermal Physics
        # If heater dies, tank cools toward freezing ambient
        if heater_fail == 0 and has_power:
            self.immersion_heater_active = True
            self.electrical_demand_kw += self.heater_kw
            target_temp = 16.0
        else:
            self.immersion_heater_active = False
            target_temp = max(0.0, amb_temp + 12.0) # Unheated insulated room
            
        self.aeration_tank_temp_c += (target_temp - self.aeration_tank_temp_c) * min(1.0, (dt / 7200.0))
        
        # 2. Biological Kinetics & Aeration
        if blower_fail > 0 or not has_power:
            # Compressor failed: DO collapses rapidly
            self.dissolved_oxygen_mg_l = max(0.1, self.dissolved_oxygen_mg_l - (0.05 * dt))
        else:
            self.dissolved_oxygen_mg_l = 3.8 + random.gauss(0, 0.1)
            self.electrical_demand_kw += 1.5 # Aeration blower draw
            
        # Bacterial health drops if too cold or hypoxic
        if self.aeration_tank_temp_c < 10.0 or self.dissolved_oxygen_mg_l < 1.0:
            self.biomass_health_pct = max(10.0, self.biomass_health_pct - (0.08 * dt))
            # Treatment failure: BOD spikes
            self.effluent_bod_mg_l = min(180.0, self.effluent_bod_mg_l + (0.5 * dt))
        else:
            self.biomass_health_pct = min(100.0, self.biomass_health_pct + (0.02 * dt))
            self.effluent_bod_mg_l = max(8.0, self.effluent_bod_mg_l - (0.1 * dt))
            
        # 3. Influent Inflow & Treatment Flow
        # Inflow: approx 85 L/person/day
        inflow_L_s = (occupants * 85.0) / 86400.0
        self.raw_influent_tank_L = min(3000.0, self.raw_influent_tank_L + (inflow_L_s * dt))
        
        # Treat and discharge
        if discharge_fail == 0 and has_power:
            treated_L_s = min(inflow_L_s * 1.1, self.raw_influent_tank_L / 100.0)
            self.raw_influent_tank_L = max(0.0, self.raw_influent_tank_L - (treated_L_s * dt))
            self.treated_effluent_tank_L = min(1500.0, self.treated_effluent_tank_L + (treated_L_s * dt))
            if self.treated_effluent_tank_L > 1000.0:
                self.treated_effluent_tank_L -= (0.5 * dt) # Discharging
                self.electrical_demand_kw += 1.2 # Discharge pump
                
        # 4. Incinerator Toilet Cycle
        if incin_fail > 0:
            self.incinerator_active = False
            self.incinerator_kw = 0.0
            self.incinerator_chamber_temp_c = max(20.0, self.incinerator_chamber_temp_c - (0.8 * dt))
        else:
            # Cycles periodically
            self.incinerator_active = True
            self.incinerator_kw = 2.4 # 2.4 kW incineration draw
            self.electrical_demand_kw += self.incinerator_kw
            self.incinerator_chamber_temp_c = 780.0 + random.gauss(0, 10)
            
        wastewater_telemetry = {
            "stp_mode": "EXTENDED_AERATION",
            "aeration_tank_temp_c": round(self.aeration_tank_temp_c, 1),
            "immersion_heater_online": self.immersion_heater_active,
            "dissolved_oxygen_mg_l": round(self.dissolved_oxygen_mg_l, 2),
            "biomass_health_pct": round(self.biomass_health_pct, 1),
            "effluent_bod_mg_l": round(self.effluent_bod_mg_l, 1),
            "madrid_protocol_compliant": (self.effluent_bod_mg_l <= 25.0) and (self.biomass_health_pct > 50.0),
            "raw_influent_tank_L": round(self.raw_influent_tank_L, 1),
            "incinerator_toilet": {
                "active": self.incinerator_active,
                "chamber_temp_c": round(self.incinerator_chamber_temp_c, 1),
                "power_kw": self.incinerator_kw
            },
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        
        state["wastewater"] = wastewater_telemetry
        return wastewater_telemetry
