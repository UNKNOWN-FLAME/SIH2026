import math
import random
import logging
from enum import Enum

class DGState(Enum):
    OFF = 0
    CRANKING = 1
    WARM_UP = 2
    SYNCING = 3
    RUNNING = 4
    COOLDOWN = 5
    FAULT_SHUTDOWN = 6

class PolarDGUnit:
    """
    Simulates a heavy-duty polar 100 kVA diesel generator set (Kirloskar / Cummins)
    with radiator fan cooling, turbocharger, common rail injection, and Stamford alternator.
    """
    def __init__(self, unit_id: str, capacity_kva: float, fault_manager):
        self.unit_id = unit_id
        self.capacity_kva = capacity_kva
        self.max_kw = capacity_kva * 0.8  # 80 kW continuous active power
        
        self.state = DGState.OFF
        self.timer = 0
        self.operating_hours = 0.0
        
        # --- Thermodynamics & Physical Variables ---
        self.rpm = 0.0
        self.current_load_kw = 0.0
        
        # Fuel System
        self.fuel_flow_L_hr = 0.0
        self.fuel_rail_pressure_bar = 0.0
        self.bsfc = 0.26 # L/kWh
        
        # Air & Turbocharger
        self.boost_pressure_bar = 1.0
        self.air_to_fuel_ratio = 21.0
        self.exhaust_gas_temp_c = 25.0
        
        # Cooling System (Heavy Radiator)
        self.coolant_temp_c = 20.0
        self.radiator_fan_running = False
        
        # Lubrication
        self.oil_pressure_bar = 0.0
        self.oil_temp_c = 20.0
        
        # Alternator & Electrical
        self.voltage = 0.0
        self.frequency = 0.0
        self.stator_temp_c = 20.0
        self.vibration_mms = 0.0
        
        self.fault_manager = fault_manager
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        uid = self.unit_id
        fm.register_spof(f"{uid}_INJECTOR_FOULING", "Carbon coking on injector tips")
        fm.register_spof(f"{uid}_FUEL_PUMP_WEAR", "Common rail injection pump pressure loss")
        fm.register_spof(f"{uid}_AIR_FILTER_BLIZZARD_CLOG", "Blowing snow clogging intake air louvers")
        fm.register_spof(f"{uid}_TURBO_BEARING_FAIL", "Turbocharger bearing failure, loss of boost")
        fm.register_spof(f"{uid}_COOLANT_LEAK", "Radiator hose rupture, rapid coolant loss")
        fm.register_spof(f"{uid}_RADIATOR_FAN_FAIL", "Radiator fan belt snap, progressive overheat")
        fm.register_spof(f"{uid}_AVR_FAILURE", "Automatic Voltage Regulator failure, voltage swings")
        fm.register_spof(f"{uid}_ALTERNATOR_BEARING_WEAR", "Drive bearing wear, high vibration")
        fm.register_spof(f"{uid}_FAIL_TO_START", "Starting motor / solenoid failure")

    def _apply_faults_and_physics(self, dt: int):
        load_pct = max(0.01, self.current_load_kw / self.max_kw)
        fm = self.fault_manager
        uid = self.unit_id
        
        # 1. Fuel system physics
        fuel_pump_wear = fm.is_fault_active(f"{uid}_FUEL_PUMP_WEAR")
        injector_foul = fm.is_fault_active(f"{uid}_INJECTOR_FOULING")
        
        self.fuel_rail_pressure_bar = 1200.0 * (1.0 - (fuel_pump_wear * 0.45)) + random.gauss(0, 4)
        
        # BSFC curve: inefficient at low loads
        if load_pct < 0.25: self.bsfc = 0.42
        elif load_pct < 0.50: self.bsfc = 0.32
        elif load_pct < 0.80: self.bsfc = 0.27
        else: self.bsfc = 0.25
        
        self.bsfc *= (1.0 + (injector_foul * 0.25))
        self.fuel_flow_L_hr = self.current_load_kw * self.bsfc
        
        # 2. Air & Turbocharger physics
        filter_clog = fm.is_fault_active(f"{uid}_AIR_FILTER_BLIZZARD_CLOG")
        turbo_fail = fm.is_fault_active(f"{uid}_TURBO_BEARING_FAIL")
        
        target_boost = 1.0 + (1.4 * load_pct)
        if turbo_fail > 0: target_boost = 1.0 # Loss of forced induction
        self.boost_pressure_bar = target_boost * (1.0 - (filter_clog * 0.45))
        
        # Air to Fuel Ratio (Rich vs Lean)
        self.air_to_fuel_ratio = 21.0 * (self.boost_pressure_bar / target_boost) / (1.0 + injector_foul)
        
        # Exhaust Gas Temp (EGT) spikes when rich
        base_egt = 280.0 + (240.0 * load_pct)
        rich_penalty = max(0, 18.0 - self.air_to_fuel_ratio) * 45.0
        self.exhaust_gas_temp_c = base_egt + rich_penalty + (filter_clog * 120.0) + random.gauss(0, 2)
        
        # 3. Cooling system physics
        coolant_leak = fm.is_fault_active(f"{uid}_COOLANT_LEAK")
        fan_fail = fm.is_fault_active(f"{uid}_RADIATOR_FAN_FAIL")
        
        if coolant_leak > 0:
            # Overheats rapidly
            self.coolant_temp_c = min(130.0, self.coolant_temp_c + (1.5 * dt))
        elif fan_fail > 0:
            # Slow overheat without fan draft
            self.coolant_temp_c = min(115.0, self.coolant_temp_c + (0.2 * dt))
        else:
            # Radiator thermostat holds 82°C-88°C
            target_coolant = 82.0 + (6.0 * load_pct)
            self.coolant_temp_c += (target_coolant - self.coolant_temp_c) * min(1.0, 0.05 * dt)
            
        self.radiator_fan_running = (self.coolant_temp_c > 80.0) and (fan_fail == 0)
        
        # 4. Lubrication
        self.oil_pressure_bar = 4.5 * (self.rpm / 1500.0) + random.gauss(0, 0.08)
        self.oil_temp_c = self.coolant_temp_c - 5.0
        
        # 5. Electrical Alternator physics
        avr_fail = fm.is_fault_active(f"{uid}_AVR_FAILURE")
        bearing_wear = fm.is_fault_active(f"{uid}_ALTERNATOR_BEARING_WEAR")
        
        if avr_fail > 0:
            self.voltage = 415.0 + random.choice([-75.0, 65.0]) + random.gauss(0, 15)
        else:
            self.voltage = 415.0 + random.gauss(0, 1.2)
            
        self.frequency = 50.0 * (self.rpm / 1500.0) + random.gauss(0, 0.05)
        self.stator_temp_c = 40.0 + (45.0 * load_pct) + (bearing_wear * 30.0)
        
        base_vib = 1.8 + (1.2 * load_pct)
        self.vibration_mms = base_vib + (injector_foul * 4.5) + (bearing_wear * 8.5) + random.gauss(0, 0.1)

    def step(self, target_kw: float, dt: int):
        self.current_load_kw = max(0.0, min(self.max_kw, target_kw))
        fm = self.fault_manager
        uid = self.unit_id
        
        # Check fail-to-start
        if fm.is_fault_active(f"{uid}_FAIL_TO_START") > 0 and self.state in [DGState.OFF, DGState.CRANKING]:
            self.state = DGState.FAULT_SHUTDOWN
            return
            
        if self.state == DGState.RUNNING:
            self.rpm = 1500.0 + random.gauss(0, 1.5)
            self.operating_hours += (dt / 3600.0)
            self._apply_faults_and_physics(dt)
            
            # Emergency automatic shutdown conditions
            if self.coolant_temp_c > 108.0 or self.oil_pressure_bar < 1.2:
                logging.critical(f"EMERGENCY TRIP on {self.unit_id}! Coolant={self.coolant_temp_c:.1f}°C, Oil={self.oil_pressure_bar:.1f}bar")
                self.state = DGState.FAULT_SHUTDOWN
        elif self.state == DGState.CRANKING:
            self.rpm = min(1500.0, self.rpm + (300.0 * dt))
            if self.rpm >= 1500.0: self.state = DGState.WARM_UP
        elif self.state == DGState.WARM_UP:
            self.rpm = 1500.0
            self.timer += dt
            if self.timer >= 10:
                self.timer = 0
                self.state = DGState.RUNNING
        elif self.state == DGState.FAULT_SHUTDOWN:
            self.rpm = max(0.0, self.rpm - (400.0 * dt))
            self.current_load_kw = 0.0
            self.voltage = 0.0
            self.frequency = 0.0
        elif self.state == DGState.OFF:
            self.rpm = 0.0
            self.current_load_kw = 0.0
            self.voltage = 0.0
            self.frequency = 0.0

    def start(self):
        if self.state == DGState.OFF:
            self.state = DGState.CRANKING

    def stop(self):
        self.state = DGState.OFF


class PowerGrid:
    """
    Central Powerhouse Microgrid for Maitri Station:
    - 3x 100 kVA Polar DG Sets (DG-1 Duty, DG-2 Standby, DG-3 Reserve)
    - 25 kW Rooftop Solar PV Array
    - 60 kVA Central Battery UPS
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        self.dg_units = {
            "DG-1": PolarDGUnit("DG1", 100.0, fault_manager),
            "DG-2": PolarDGUnit("DG2", 100.0, fault_manager),
            "DG-3": PolarDGUnit("DG3", 100.0, fault_manager),
        }
        
        # Initial operational configuration
        self.dg_units["DG-1"].state = DGState.RUNNING
        self.dg_units["DG-1"].rpm = 1500.0
        self.dg_units["DG-2"].state = DGState.OFF # Hot Standby
        self.dg_units["DG-3"].state = DGState.OFF # Cold Reserve
        
        # 25 kW Solar PV Array
        self.solar_capacity_kw = 25.0
        self.solar_output_kw = 0.0
        self.solar_inverter_online = True
        
        # Station Battery Bank / UPS
        self.battery_soc_pct = 95.0
        self.grid_status = "NOMINAL"
        
        self.total_station_load_kw = 65.0
        self.total_fuel_consumption_L_hr = 0.0
        
        self.register_faults()

    def register_faults(self):
        self.fault_manager.register_spof("SOLAR_INVERTER_TRIP", "Solar PV rooftop inverter trip")
        self.fault_manager.register_spof("BUSBAR_PHASE_IMBALANCE", "Phase load imbalance on main switchboard")

    def calculate_solar_pv(self, solar_radiation_wm2: float, ambient_temp_c: float) -> float:
        """Calculates real AC output from the 25 kWp solar array."""
        if self.fault_manager.is_fault_active("SOLAR_INVERTER_TRIP") > 0:
            self.solar_inverter_online = False
            return 0.0
            
        self.solar_inverter_online = True
        if solar_radiation_wm2 <= 5.0:
            return 0.0
            
        # Standard test conditions: 1000 W/m² at 25°C
        # Polar cold improves efficiency: +0.4% per °C below 25°C
        temp_coeff = 1.0 + (0.004 * (25.0 - ambient_temp_c))
        raw_kw = (solar_radiation_wm2 / 1000.0) * self.solar_capacity_kw * temp_coeff
        # Inverter efficiency 94%
        return round(min(self.solar_capacity_kw, raw_kw * 0.94), 2)

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        solar_rad = env.get("solar_radiation_wm2", 0.0)
        amb_temp = env.get("ambient_temperature_c", -15.0)
        
        # 1. Aggregate demand from all station subsystems
        base_station_load = 42.0 # Lighting, galley, IT, scientific equipment
        hvac_draw = state.get("hvac", {}).get("electrical_demand_kw", 0.0)
        water_draw = state.get("water", {}).get("electrical_demand_kw", 0.0) # Lake pipeline heat tracing
        fuel_draw = state.get("fuel", {}).get("electrical_demand_kw", 0.0)   # Fuel transfer & trace heat
        stp_draw = state.get("wastewater", {}).get("electrical_demand_kw", 0.0)
        vehicle_draw = state.get("vehicles", {}).get("electrical_demand_kw", 0.0) # Block heaters
        
        self.total_station_load_kw = round(
            base_station_load + hvac_draw + water_draw + fuel_draw + stp_draw + vehicle_draw, 2
        )
        
        # 2. Solar PV generation offset
        self.solar_output_kw = self.calculate_solar_pv(solar_rad, amb_temp)
        net_dg_demand_kw = max(0.0, self.total_station_load_kw - self.solar_output_kw)
        
        # 3. Automatic Generator Management & Failover
        running_units = [u for u in self.dg_units.values() if u.state == DGState.RUNNING]
        
        # Auto-start standby DG-2 if primary trips
        if not running_units:
            if self.dg_units["DG-2"].state == DGState.OFF:
                logging.warning("DG-1 offline! Auto-starting standby DG-2...")
                self.dg_units["DG-2"].start()
                
        # Re-check running units after potential state updates
        running_units = [u for u in self.dg_units.values() if u.state == DGState.RUNNING]
        
        if running_units:
            self.grid_status = "NOMINAL"
            # Share load equally among running generators
            per_unit_load = net_dg_demand_kw / len(running_units)
            for u in self.dg_units.values():
                if u.state == DGState.RUNNING:
                    u.step(per_unit_load, dt)
                else:
                    u.step(0.0, dt)
                    
            # Recharge battery UPS if not at 100%
            self.battery_soc_pct = min(100.0, self.battery_soc_pct + (0.01 * dt))
        else:
            # Complete generator blackout! Battery UPS carries critical load
            self.grid_status = "BLACKOUT_UPS_ACTIVE"
            self.battery_soc_pct = max(0.0, self.battery_soc_pct - (0.05 * dt))
            for u in self.dg_units.values():
                u.step(0.0, dt)
                
        # 4. Total fuel burn
        self.total_fuel_consumption_L_hr = sum(u.fuel_flow_L_hr for u in self.dg_units.values())
        
        primary_dg = self.dg_units["DG-1"] if self.dg_units["DG-1"].state == DGState.RUNNING else self.dg_units["DG-2"]
        
        power_telemetry = {
            "grid_status": self.grid_status,
            "total_station_load_kw": self.total_station_load_kw,
            "net_dg_demand_kw": round(net_dg_demand_kw, 2),
            "solar_pv": {
                "installed_capacity_kw": self.solar_capacity_kw,
                "current_output_kw": self.solar_output_kw,
                "inverter_online": self.solar_inverter_online,
            },
            "battery_ups": {
                "capacity_kva": 60.0,
                "state_of_charge_pct": round(self.battery_soc_pct, 1),
                "supporting_critical_bus": (self.grid_status == "BLACKOUT_UPS_ACTIVE")
            },
            "total_fuel_consumption_L_hr": round(self.total_fuel_consumption_L_hr, 2),
            "generators": {
                name: {
                    "state": u.state.name,
                    "load_kw": round(u.current_load_kw, 2),
                    "load_pct": round((u.current_load_kw / u.max_kw) * 100.0, 1) if u.max_kw > 0 else 0,
                    "rpm": round(u.rpm, 1),
                    "coolant_temp_c": round(u.coolant_temp_c, 1),
                    "oil_pressure_bar": round(u.oil_pressure_bar, 2),
                    "exhaust_gas_temp_c": round(u.exhaust_gas_temp_c, 1),
                    "boost_pressure_bar": round(u.boost_pressure_bar, 2),
                    "fuel_rail_pressure_bar": round(u.fuel_rail_pressure_bar, 1),
                    "fuel_flow_L_hr": round(u.fuel_flow_L_hr, 2),
                    "vibration_mms": round(u.vibration_mms, 2),
                    "voltage_v": round(u.voltage, 1),
                    "frequency_hz": round(u.frequency, 2),
                    "operating_hours": round(u.operating_hours, 1)
                }
                for name, u in self.dg_units.items()
            }
        }
        
        state["power"] = power_telemetry
        return power_telemetry
