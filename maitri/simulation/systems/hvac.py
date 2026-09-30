import logging
import math
import random

class MaitriOilBoiler:
    """
    Simulates a 150 kW thermal oil-fired heating boiler in the Maitri Boiler Room.
    Burns ATF/Polar diesel to generate 80°C hot water for the station hydronic radiator loop.
    """
    def __init__(self, unit_id: str, capacity_kw: float, fault_manager):
        self.unit_id = unit_id
        self.capacity_kw = capacity_kw # 150 kW thermal
        self.is_firing = True
        self.firing_rate_pct = 60.0
        
        self.water_supply_temp_c = 80.0
        self.water_return_temp_c = 65.0
        self.flue_gas_temp_c = 180.0
        self.fuel_consumption_L_hr = 12.0
        
        self.fault_manager = fault_manager
        
    def step(self, thermal_demand_kw: float, return_temp_c: float, dt: int):
        fm = self.fault_manager
        flameout = fm.is_fault_active("BOILER_FLAMEOUT")
        solenoid_fail = fm.is_fault_active("BOILER_FUEL_SOLENOID_FAIL")
        
        if flameout > 0 or solenoid_fail > 0 or not self.is_firing:
            self.is_firing = False
            self.firing_rate_pct = 0.0
            self.fuel_consumption_L_hr = 0.0
            self.flue_gas_temp_c = max(20.0, self.flue_gas_temp_c - (0.5 * dt))
            # Water cools down toward return temperature
            self.water_supply_temp_c += (return_temp_c - self.water_supply_temp_c) * min(1.0, 0.02 * dt)
            return 0.0
            
        # Modulating burner: 30% to 100% firing rate
        target_firing = max(30.0, min(100.0, (thermal_demand_kw / self.capacity_kw) * 100.0))
        self.firing_rate_pct += (target_firing - self.firing_rate_pct) * min(1.0, 0.1 * dt)
        
        # Fuel consumption: ~10 L/hr at 100 kW thermal (LHV ~36.5 MJ/L, 84% eff)
        actual_output_kw = (self.firing_rate_pct / 100.0) * self.capacity_kw
        self.fuel_consumption_L_hr = (actual_output_kw / (36.5 * 1000.0 / 3600.0 * 0.84))
        
        self.flue_gas_temp_c = 140.0 + (0.6 * self.firing_rate_pct) + random.gauss(0, 1.5)
        self.water_return_temp_c = return_temp_c
        self.water_supply_temp_c = return_temp_c + (actual_output_kw / 5.5) + random.gauss(0, 0.3)
        self.water_supply_temp_c = min(92.0, self.water_supply_temp_c) # Safety limit
        
        return actual_output_kw


class HVACModel:
    """
    Simulates Maitri Station's central heating and ventilation systems:
    - 2x Dedicated Oil-Fired Heating Boilers (Duty / Standby)
    - Primary Hydronic Radiator Loop (80°C supply, 65°C return)
    - Air Handling Unit (AHU) with fresh air damper and CO2 control
    - Domestic Hot Water (DHW) Calorifier (1,500 L, 60°C)
    - Emergency Electric Resistance Heaters
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # Dual Oil Boilers
        self.boilers = {
            "Boiler-1": MaitriOilBoiler("B1", 150.0, fault_manager),
            "Boiler-2": MaitriOilBoiler("B2", 150.0, fault_manager),
        }
        self.boilers["Boiler-1"].is_firing = True
        self.boilers["Boiler-2"].is_firing = False # Standby
        
        # Hydronic Circulation
        self.primary_supply_temp_c = 80.0
        self.primary_return_temp_c = 65.0
        self.pump_a_active = True
        self.pump_b_active = False
        self.loop_flow_L_s = 4.2
        self.loop_pressure_bar = 2.4
        
        # Building Thermal Zones
        self.living_temp_c = 21.0
        self.labs_temp_c = 20.0
        self.powerhouse_temp_c = 18.0
        self.station_co2_ppm = 520.0
        
        # Domestic Hot Water (DHW)
        self.dhw_tank_temp_c = 60.5
        
        # Emergency Electric Heat
        self.emergency_electric_kw = 0.0
        self.electrical_demand_kw = 4.5 # Pumps & AHU blower
        
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("BOILER_FLAMEOUT", "Oil boiler flameout (electrode / fuel blockage)")
        fm.register_spof("BOILER_FUEL_SOLENOID_FAIL", "Boiler fuel solenoid stuck closed")
        fm.register_spof("HVAC_CIRC_PUMP_A_FAIL", "Primary hydronic circulation pump failure")
        fm.register_spof("HVAC_CIRC_PUMP_B_FAIL", "Standby hydronic circulation pump failure")
        fm.register_spof("HVAC_PIPE_BURST_LEAK", "Hydronic distribution pipe burst / pressure loss")
        fm.register_spof("HVAC_BLIZZARD_DAMPER_FREEZE", "Fresh air intake damper frozen wide open")
        fm.register_spof("HVAC_AHU_BLOWER_FAIL", "Air handling blower failure, CO2 buildup")
        fm.register_spof("HVAC_THERMOSTAT_DRIFT", "Living room thermostat drifts +6°C false high")
        fm.register_spof("HVAC_DHW_CALORIFIER_FAIL", "Domestic hot water calorifier heat exchanger fail")

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        amb_temp = env.get("ambient_temperature_c", -15.0)
        wind_speed = env.get("wind_speed_ms", 6.0)
        occupants = state.get("human", {}).get("headcount", 25)
        
        fm = self.fault_manager
        pump_a_fail = fm.is_fault_active("HVAC_CIRC_PUMP_A_FAIL")
        pump_b_fail = fm.is_fault_active("HVAC_CIRC_PUMP_B_FAIL")
        pipe_leak = fm.is_fault_active("HVAC_PIPE_BURST_LEAK")
        damper_freeze = fm.is_fault_active("HVAC_BLIZZARD_DAMPER_FREEZE")
        blower_fail = fm.is_fault_active("HVAC_AHU_BLOWER_FAIL")
        stat_drift = fm.is_fault_active("HVAC_THERMOSTAT_DRIFT")
        dhw_fail = fm.is_fault_active("HVAC_DHW_CALORIFIER_FAIL")
        
        # 1. Hydronic Circulation Pumps Management
        if pump_a_fail > 0:
            self.pump_a_active = False
            # Standby auto-engage
            if pump_b_fail == 0:
                self.pump_b_active = True
                self.loop_flow_L_s = 4.2
            else:
                self.pump_b_active = False
                self.loop_flow_L_s = 0.0 # Total circulation loss
        else:
            self.pump_a_active = True
            self.pump_b_active = False
            self.loop_flow_L_s = 4.2
            
        if pipe_leak > 0:
            self.loop_pressure_bar = max(0.2, self.loop_pressure_bar - (0.1 * dt))
            self.loop_flow_L_s = max(0.5, self.loop_flow_L_s * 0.4)
        else:
            self.loop_pressure_bar = 2.4 + random.gauss(0, 0.02)
            
        # 2. Thermal Demand Calculation (Heat loss through stilt building envelope)
        # Delta T = 20 - amb_temp. In extreme winter (-35°C), Delta T = 55°C
        delta_t = max(0.0, 20.0 - amb_temp)
        # Wind chill infiltration factor
        wind_factor = 1.0 + (wind_speed / 40.0)
        thermal_loss_kw = (delta_t * 1.8 * wind_factor)
        
        # Extra cold draft if blizzard damper is frozen open
        if damper_freeze > 0:
            thermal_loss_kw += 45.0
            
        # 3. Boiler Operation & Fuel Burn
        active_boiler = self.boilers["Boiler-1"]
        if not active_boiler.is_firing and fm.is_fault_active("BOILER_FLAMEOUT") == 0:
            # Try standby boiler if B1 tripped
            active_boiler = self.boilers["Boiler-2"]
            active_boiler.is_firing = True
            
        boiler_heat_kw = active_boiler.step(thermal_loss_kw, self.primary_return_temp_c, dt)
        self.primary_supply_temp_c = active_boiler.water_supply_temp_c
        
        # Return temp cools down proportional to heat dissipated in radiators
        if self.loop_flow_L_s > 0:
            heat_extracted_kw = min(boiler_heat_kw, thermal_loss_kw)
            self.primary_return_temp_c = max(amb_temp, self.primary_supply_temp_c - (heat_extracted_kw / 5.5))
        else:
            self.primary_return_temp_c = max(amb_temp, self.primary_return_temp_c - (0.05 * dt))
            
        # 4. Indoor Room Temperature Physics (Thermal Inertia)
        target_indoor = 21.0
        effective_heat_in = boiler_heat_kw if self.loop_flow_L_s > 1.0 else 5.0
        
        # Emergency Electric Heaters kick in if temperature falls below 16°C
        self.emergency_electric_kw = 0.0
        if self.living_temp_c < 16.0:
            self.emergency_electric_kw = 25.0 # 25 kW electrical grid draw
            effective_heat_in += self.emergency_electric_kw
            
        net_heat_flow = effective_heat_in - thermal_loss_kw
        # Station thermal mass: ~18,500 kJ/K (takes ~3-4 hours to freeze)
        temp_delta = (net_heat_flow * dt) / 18500.0
        self.living_temp_c = max(amb_temp, self.living_temp_c + temp_delta)
        self.labs_temp_c = max(amb_temp, self.living_temp_c - 1.2)
        self.powerhouse_temp_c = max(5.0, 16.0 + (active_boiler.firing_rate_pct * 0.08))
        
        # Thermostat sensing (poisoned if sensor drift active)
        displayed_temp = self.living_temp_c + (6.0 if stat_drift > 0 else 0.0)
        
        # 5. Domestic Hot Water (DHW Calorifier)
        if dhw_fail > 0 or self.primary_supply_temp_c < 55.0:
            self.dhw_tank_temp_c = max(20.0, self.dhw_tank_temp_c - (0.05 * dt))
        else:
            self.dhw_tank_temp_c += (60.0 - self.dhw_tank_temp_c) * min(1.0, 0.04 * dt)
            
        # 6. Air Handling & CO2 Physics
        if blower_fail > 0:
            # CO2 rises without fresh air circulation (occupants exhale ~1.0 kg/day)
            self.station_co2_ppm = min(3200.0, self.station_co2_ppm + (0.45 * occupants * dt / 60.0))
        else:
            # Balanced ventilation holds 500-650 PPM
            target_co2 = 450.0 + (occupants * 6.5)
            self.station_co2_ppm += (target_co2 - self.station_co2_ppm) * min(1.0, 0.05 * dt)
            
        # Electrical consumption: Circulation pumps (2.2 kW) + AHU fan (2.3 kW) + Emergency heat
        self.electrical_demand_kw = (2.2 if self.loop_flow_L_s > 0 else 0.0) + (2.3 if blower_fail == 0 else 0.0) + self.emergency_electric_kw
        
        hvac_telemetry = {
            "system_mode": "HYDRONIC_OIL_BOILER",
            "active_boiler": "Boiler-1" if self.boilers["Boiler-1"].is_firing else ("Boiler-2" if self.boilers["Boiler-2"].is_firing else "NONE"),
            "boiler_firing_rate_pct": round(active_boiler.firing_rate_pct, 1),
            "boiler_fuel_flow_L_hr": round(active_boiler.fuel_consumption_L_hr, 2),
            "primary_supply_temp_c": round(self.primary_supply_temp_c, 1),
            "primary_return_temp_c": round(self.primary_return_temp_c, 1),
            "loop_flow_L_s": round(self.loop_flow_L_s, 2),
            "loop_pressure_bar": round(self.loop_pressure_bar, 2),
            "pump_status": {
                "pump_a": "RUNNING" if self.pump_a_active else "STOPPED",
                "pump_b": "RUNNING" if self.pump_b_active else "STANDBY"
            },
            "living_zone_temp_c": round(self.living_temp_c, 2),
            "displayed_thermostat_c": round(displayed_temp, 2),
            "laboratories_temp_c": round(self.labs_temp_c, 2),
            "powerhouse_temp_c": round(self.powerhouse_temp_c, 2),
            "indoor_co2_ppm": round(self.station_co2_ppm, 1),
            "dhw_calorifier_temp_c": round(self.dhw_tank_temp_c, 1),
            "legionella_safe": self.dhw_tank_temp_c >= 55.0,
            "emergency_electric_heat_active": self.emergency_electric_kw > 0.0,
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        
        state["hvac"] = hvac_telemetry
        return hvac_telemetry
