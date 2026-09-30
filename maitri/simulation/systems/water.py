import logging
import math
import random

class WaterModel:
    """
    Simulates Maitri Station's Freshwater Supply & Life-Support System:
    - Lake Priyadarshini (Zub Lake) submerged pumping station
    - 250-meter overland insulated pipeline with electrical trace-heating
    - Lake ice dynamics (ice thickness up to 2.2m in winter)
    - Dual sediment pre-filters & UV-C germicidal sterilization
    - 20,000 L indoor potable water storage tanks
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # 250m Overland Pipeline Thermal Physics
        self.pipeline_length_m = 250.0
        self.pipeline_water_temp_c = 4.2
        self.trace_heating_active = True
        self.trace_heater_kw = 12.0 # 12 kW electrical trace heating
        self.pipeline_frozen_solid = False
        
        # Lake Priyadarshini Intake
        self.lake_pump_running = False
        self.intake_flow_L_s = 0.0
        
        # Filtration & Disinfection
        self.sediment_filter_dp_bar = 0.35 # Normal clean pressure drop
        self.uv_intensity_pct = 100.0
        self.water_quality_safe = True
        
        # Indoor Potable Water Storage
        self.potable_tank_L = 16800.0
        self.tank_capacity_L = 20000.0
        
        self.electrical_demand_kw = 0.0
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("WATER_TRACE_HEAT_FAIL", "250m pipeline electrical trace heater trip (Rapid freezing risk)")
        fm.register_spof("WATER_LAKE_PUMP_FAIL", "Submerged lake intake pump motor burn / seizure")
        fm.register_spof("WATER_ICE_INTAKE_CHOKE", "Lake surface ice expansion choking intake strainer")
        fm.register_spof("WATER_SEDIMENT_CLOG", "Glacial melt rock flour clogging pre-filters (High DP)")
        fm.register_spof("WATER_UV_STERILIZER_FAIL", "UV-C germicidal sterilization lamp burnout")
        fm.register_spof("WATER_TANK_LEAK", "Rupture in indoor 20,000 L potable water storage tank")

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        amb_temp = env.get("ambient_temperature_c", -15.0)
        lake_water_temp = env.get("lake_priyadarshini", {}).get("water_temp_c", 2.4)
        lake_ice_thick = env.get("lake_priyadarshini", {}).get("ice_thickness_m", 1.2)
        occupants = state.get("human", {}).get("headcount", 25)
        
        fm = self.fault_manager
        trace_fail = fm.is_fault_active("WATER_TRACE_HEAT_FAIL")
        pump_fail = fm.is_fault_active("WATER_LAKE_PUMP_FAIL")
        ice_choke = fm.is_fault_active("WATER_ICE_INTAKE_CHOKE")
        sediment_clog = fm.is_fault_active("WATER_SEDIMENT_CLOG")
        uv_fail = fm.is_fault_active("WATER_UV_STERILIZER_FAIL")
        tank_leak = fm.is_fault_active("WATER_TANK_LEAK")
        
        # 0. Power Grid Check
        grid_status = state.get("power", {}).get("grid_status", "NOMINAL")
        has_power = (grid_status != "BLACKOUT")
        
        # 1. Pipeline Electrical Trace-Heating Physics
        # Polyurethane insulated pipe: Thermal mass ~250m * 15 kg/m * 4.18 kJ/(kg*K) ~ 15,675 kJ/K
        if trace_fail == 0 and has_power:
            self.trace_heating_active = True
            # Trace heater injects +12 kW heat along the 250m line
            heat_in_kw = self.trace_heater_kw
            self.electrical_demand_kw = self.trace_heater_kw
        else:
            self.trace_heating_active = False
            heat_in_kw = 0.0
            self.electrical_demand_kw = 0.0
            
        # Conductance to cold Antarctic air: U*A ~ 0.35 W/(m2*K) * 250m * pi * 0.1m ~ 27.5 W/K = 0.0275 kW/K
        heat_loss_kw = 0.0275 * (self.pipeline_water_temp_c - amb_temp)
        net_pipe_heat = heat_in_kw - heat_loss_kw
        
        # Pipeline temperature dynamics
        temp_delta = (net_pipe_heat * dt) / 156.75 # Time constant ~ 40 minutes to freeze if trace fails
        self.pipeline_water_temp_c = max(amb_temp, self.pipeline_water_temp_c + temp_delta)
        
        # Ice freezing check: water freezes at 0.0°C
        if self.pipeline_water_temp_c <= 0.0:
            self.pipeline_frozen_solid = True
            self.pipeline_water_temp_c = min(0.0, self.pipeline_water_temp_c)
        else:
            self.pipeline_frozen_solid = False
            
        # 2. Station Consumption & Replenishment Logic
        # 25 winter crew: ~2,500 L/day (0.029 L/s); 65 summer: ~6,500 L/day (0.075 L/s)
        consumption_L_s = (occupants * 100.0) / 86400.0
        if tank_leak > 0:
            consumption_L_s += 0.85 # Tank rupture draining into bilge
            
        self.potable_tank_L = max(0.0, self.potable_tank_L - (consumption_L_s * dt))
        
        # Pump kicks in when storage drops below 14,000 L, stops at 19,500 L
        can_pump = (
            not self.pipeline_frozen_solid 
            and pump_fail == 0 
            and has_power
        )
        
        if self.potable_tank_L < 14000.0 and can_pump:
            self.lake_pump_running = True
        elif self.potable_tank_L >= 19500.0 or not can_pump:
            self.lake_pump_running = False
            
        # 3. Pumping Hydraulic Physics
        if self.lake_pump_running and can_pump:
            base_flow = 1.6 # 1.6 L/s delivery
            if ice_choke > 0:
                # Strainer cavitation / choking
                base_flow *= 0.25
            if sediment_clog > 0:
                base_flow *= 0.60
                
            self.intake_flow_L_s = base_flow
            self.electrical_demand_kw += 3.5 # 3.5 kW pump electrical draw
            
            # Flowing lake water warms the pipeline towards lake temperature (+2.4°C)
            self.pipeline_water_temp_c += (lake_water_temp - self.pipeline_water_temp_c) * min(1.0, 0.08 * dt)
            
            # Fill storage tank
            self.potable_tank_L = min(self.tank_capacity_L, self.potable_tank_L + (self.intake_flow_L_s * dt))
        else:
            self.intake_flow_L_s = 0.0
            
        # 4. Filtration & UV Disinfection
        if sediment_clog > 0:
            self.sediment_filter_dp_bar = min(3.2, self.sediment_filter_dp_bar + (0.01 * dt))
        else:
            self.sediment_filter_dp_bar = 0.35 + random.gauss(0, 0.01)
            
        if uv_fail > 0:
            self.uv_intensity_pct = 0.0
            self.water_quality_safe = False
        else:
            self.uv_intensity_pct = 98.5 + random.gauss(0, 0.5)
            self.water_quality_safe = True
            self.electrical_demand_kw += 0.4 # UV ballast draw
            
        water_telemetry = {
            "source": "LAKE_PRIYADARSHINI",
            "potable_storage_litres": round(self.potable_tank_L, 1),
            "potable_storage_pct": round((self.potable_tank_L / self.tank_capacity_L) * 100.0, 1),
            "lake_pump_status": "PUMPING" if self.lake_pump_running else "STANDBY",
            "intake_flow_L_s": round(self.intake_flow_L_s, 2),
            "pipeline_250m": {
                "water_temp_c": round(self.pipeline_water_temp_c, 2),
                "trace_heating_online": self.trace_heating_active,
                "is_frozen_blocked": self.pipeline_frozen_solid,
                "freeze_hazard_risk": "CRITICAL" if self.pipeline_water_temp_c < 1.0 else ("ELEVATED" if self.pipeline_water_temp_c < 2.5 else "NOMINAL")
            },
            "sediment_filter_dp_bar": round(self.sediment_filter_dp_bar, 2),
            "uv_disinfection": {
                "uv_intensity_pct": round(self.uv_intensity_pct, 1),
                "potable_certified": self.water_quality_safe
            },
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        
        state["water"] = water_telemetry
        return water_telemetry
