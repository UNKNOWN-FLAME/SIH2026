import logging
import math
import random

class FuelModel:
    """
    Simulates Maitri Station's Fuel Logistics & Transfer Systems:
    - 165,000 L Outdoor Bulk Fuel Tank Farm (Aviation Turbine Fuel Jet A-1 / Polar Diesel)
    - Transfer pipeline with electrical heat-tracing (prevents waxing at -35°C)
    - Duplex Transfer Pumps (Pump-A Duty, Pump-B Standby)
    - Fuel sediment and water trap separator
    - 2,500 L Indoor Day Tank feeding the DG sets and Oil-Fired Heating Boilers
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # 165,000 L Bulk Farm
        self.main_farm_level_L = 138400.0
        self.main_farm_capacity_L = 165000.0
        
        # 2,500 L Powerhouse Day Tank
        self.day_tank_level_L = 2150.0
        self.day_tank_capacity_L = 2500.0
        
        # Thermal & Viscosity Physics (Jet A-1 / ATF)
        self.fuel_temp_c = -14.0
        self.viscosity_cSt = 3.2
        self.heat_trace_active = True
        self.heat_trace_kw = 4.0
        
        # Duplex Transfer Pumping
        self.pump_a_active = False
        self.pump_b_active = False
        self.transfer_flow_L_s = 0.0
        
        self.filter_dp_bar = 0.25
        self.electrical_demand_kw = 0.0
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("FUEL_MAIN_FARM_LEAK", "Outdoor bulk storage tank rupture (5 L/s loss)")
        fm.register_spof("FUEL_LINE_HEAT_TRACE_FAIL", "Transfer line heat-trace failure (Fuel waxing risk)")
        fm.register_spof("FUEL_PUMP_A_FAIL", "Primary fuel transfer pump motor burn")
        fm.register_spof("FUEL_PUMP_B_FAIL", "Standby fuel transfer pump failure")
        fm.register_spof("FUEL_FILTER_WATER_CLOG", "Ice crystal / water contamination clogging fuel filter")
        fm.register_spof("FUEL_DAY_TANK_LEAK", "Indoor 2,500 L day tank rupture")
        fm.register_spof("FUEL_DAY_TANK_SENSOR_STUCK", "Day tank level float sensor stuck reading false 1800 L")

    def calculate_viscosity(self, temp_c: float) -> float:
        # Jet A-1 is fluid down to -47°C; waxing begins below -30°C
        if temp_c <= -47.0:
            return 1000.0 # Gelled solid
        if temp_c > 15.0:
            return 2.1
        return 2.1 + math.exp(-0.095 * (temp_c + 18.0))

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        amb_temp = env.get("ambient_temperature_c", -15.0)
        
        fm = self.fault_manager
        main_leak = fm.is_fault_active("FUEL_MAIN_FARM_LEAK")
        ht_fail = fm.is_fault_active("FUEL_LINE_HEAT_TRACE_FAIL")
        pump_a_fail = fm.is_fault_active("FUEL_PUMP_A_FAIL")
        pump_b_fail = fm.is_fault_active("FUEL_PUMP_B_FAIL")
        filter_clog = fm.is_fault_active("FUEL_FILTER_WATER_CLOG")
        day_leak = fm.is_fault_active("FUEL_DAY_TANK_LEAK")
        sensor_stuck = fm.is_fault_active("FUEL_DAY_TANK_SENSOR_STUCK")
        
        # 0. Power Grid Check
        grid_status = state.get("power", {}).get("grid_status", "NOMINAL")
        has_power = (grid_status != "BLACKOUT")
        
        # 1. Pipeline Thermal & Viscosity Physics
        if ht_fail == 0 and has_power:
            self.heat_trace_active = True
            self.electrical_demand_kw = self.heat_trace_kw
            target_fuel_temp = -5.0 # Pre-heater keeps it above -10°C
        else:
            self.heat_trace_active = False
            self.electrical_demand_kw = 0.0
            target_fuel_temp = amb_temp
            
        # Fuel pipe thermal mass
        self.fuel_temp_c += (target_fuel_temp - self.fuel_temp_c) * min(1.0, (dt / 3600.0))
        self.viscosity_cSt = self.calculate_viscosity(self.fuel_temp_c)
        is_fuel_gelled = (self.viscosity_cSt > 200.0)
        
        # 2. Total Fuel Consumption (DGs + Boilers + Vehicles)
        dg_burn_L_hr = state.get("power", {}).get("total_fuel_consumption_L_hr", 18.5)
        boiler_burn_L_hr = state.get("hvac", {}).get("boiler_fuel_flow_L_hr", 12.0)
        vehicle_burn_L = state.get("vehicles", {}).get("fuel_requested_L", 0.0)
        
        total_burn_L_s = ((dg_burn_L_hr + boiler_burn_L_hr) / 3600.0)
        self.day_tank_level_L = max(0.0, self.day_tank_level_L - (total_burn_L_s * dt) - vehicle_burn_L)
        
        if day_leak > 0:
            self.day_tank_level_L = max(0.0, self.day_tank_level_L - (0.6 * dt))
            
        if main_leak > 0:
            self.main_farm_level_L = max(0.0, self.main_farm_level_L - (5.0 * dt))
            
        # 3. Automated Duplex Fuel Transfer Logic
        # Day tank refills when level < 1000 L, stops at 2400 L
        can_pump = (
            not is_fuel_gelled 
            and has_power 
            and self.main_farm_level_L > 500.0
        )
        
        needs_fuel = (self.day_tank_level_L < 1000.0)
        
        if needs_fuel and can_pump:
            if pump_a_fail == 0:
                self.pump_a_active = True
                self.pump_b_active = False
            elif pump_b_fail == 0:
                self.pump_a_active = False
                self.pump_b_active = True # Standby failover
            else:
                self.pump_a_active = False
                self.pump_b_active = False
        elif self.day_tank_level_L >= 2400.0 or not can_pump:
            self.pump_a_active = False
            self.pump_b_active = False
            
        if (self.pump_a_active or self.pump_b_active) and can_pump:
            base_transfer_rate = 1.2 # 1.2 L/s
            if filter_clog > 0:
                base_transfer_rate *= 0.35
                self.filter_dp_bar = 2.4
            else:
                self.filter_dp_bar = 0.25 + random.gauss(0, 0.01)
                
            self.transfer_flow_L_s = base_transfer_rate
            self.electrical_demand_kw += 1.8 # 1.8 kW pump motor
            
            # Transfer fuel from main farm to day tank
            transferred = self.transfer_flow_L_s * dt
            self.main_farm_level_L = max(0.0, self.main_farm_level_L - transferred)
            self.day_tank_level_L = min(self.day_tank_capacity_L, self.day_tank_level_L + transferred)
        else:
            self.transfer_flow_L_s = 0.0
            
        # 4. Station Autonomy Forecast (Days)
        daily_burn_litres = max(100.0, (dg_burn_L_hr + boiler_burn_L_hr) * 24.0)
        autonomy_days = round(self.main_farm_level_L / daily_burn_litres, 1)
        
        reported_day_tank = 1800.0 if sensor_stuck > 0 else self.day_tank_level_L
        
        fuel_telemetry = {
            "main_farm_level_L": round(self.main_farm_level_L, 1),
            "main_farm_capacity_L": self.main_farm_capacity_L,
            "main_farm_pct": round((self.main_farm_level_L / self.main_farm_capacity_L) * 100.0, 1),
            "autonomy_days": autonomy_days,
            "day_tank_level_L": round(self.day_tank_level_L, 1),
            "reported_day_tank_L": round(reported_day_tank, 1),
            "day_tank_pct": round((self.day_tank_level_L / self.day_tank_capacity_L) * 100.0, 1),
            "fuel_temp_c": round(self.fuel_temp_c, 1),
            "viscosity_cSt": round(self.viscosity_cSt, 2),
            "trace_heating_online": self.heat_trace_active,
            "transfer_pump_status": {
                "pump_a": "RUNNING" if self.pump_a_active else ("FAILED" if pump_a_fail > 0 else "STANDBY"),
                "pump_b": "RUNNING" if self.pump_b_active else ("FAILED" if pump_b_fail > 0 else "STANDBY")
            },
            "transfer_flow_L_s": round(self.transfer_flow_L_s, 2),
            "filter_dp_bar": round(self.filter_dp_bar, 2),
            "daily_burn_rate_L_day": round(daily_burn_litres, 1),
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        
        state["fuel"] = fuel_telemetry
        return fuel_telemetry
