import logging
import math
import random

class PolarVehicle:
    def __init__(self, name: str, vehicle_type: str, fault_manager):
        self.name = name
        self.vehicle_type = vehicle_type
        self.fault_manager = fault_manager
        
        self.engine_running = False
        self.block_heater_connected = True
        self.engine_core_temp_c = 28.0 # Kept warm by 230V plug-in heater
        self.fuel_level_L = 180.0
        self.fuel_capacity_L = 220.0
        self.battery_voltage_v = 24.5
        self.hydraulic_pressure_bar = 210.0
        
    def step(self, amb_temp_c: float, dt: int):
        fm = self.fault_manager
        heater_disconnected = fm.is_fault_active("VEHICLE_BLOCK_HEATER_DISCONNECT")
        hose_burst = fm.is_fault_active("VEHICLE_HYDRAULIC_HOSE_BURST")
        ice_plug = fm.is_fault_active("VEHICLE_FUEL_LINE_ICE_PLUG")
        
        # 1. Block Heater Thermal Physics
        if self.block_heater_connected and heater_disconnected == 0 and not self.engine_running:
            target_temp = 28.0
            self.engine_core_temp_c += (target_temp - self.engine_core_temp_c) * min(1.0, (dt / 1800.0))
        elif self.engine_running:
            target_temp = 85.0
            self.engine_core_temp_c += (target_temp - self.engine_core_temp_c) * min(1.0, (dt / 900.0))
        else:
            # Unplugged or heater failed: Cold-soaking towards Antarctic ambient!
            target_temp = amb_temp_c
            self.engine_core_temp_c += (target_temp - self.engine_core_temp_c) * min(1.0, (dt / 7200.0))
            
        # 2. Hydraulic & Fuel Line Faults
        if hose_burst > 0:
            self.hydraulic_pressure_bar = max(0.0, self.hydraulic_pressure_bar - (10.0 * dt))
        else:
            self.hydraulic_pressure_bar = 210.0 + random.gauss(0, 1.5)
            
        if ice_plug > 0 and self.engine_running:
            self.engine_running = False # Engine stalls due to fuel starvation
            
    def get_heater_kw(self) -> float:
        heater_disconnected = self.fault_manager.is_fault_active("VEHICLE_BLOCK_HEATER_DISCONNECT")
        if self.block_heater_connected and heater_disconnected == 0 and not self.engine_running:
            return 1.5 # 1.5 kW per vehicle plug-in block heater
        return 0.0


class VehicleFleet:
    """
    Simulates Maitri Station's Tracked Vehicle & Heavy Equipment Fleet:
    - PistenBully 300 Polar tracked groomer / cargo tow
    - Manitou heavy telescopic crane
    - Ski-Doo polar snowmobiles
    - 230V Engine block and sump heaters (preventing polar cold-soak seizure)
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        self.fleet = {
            "PistenBully-1": PolarVehicle("PB-1", "SNOW_GROOMER", fault_manager),
            "PistenBully-2": PolarVehicle("PB-2", "SNOW_GROOMER", fault_manager),
            "Crane-Manitou": PolarVehicle("Crane", "HEAVY_CRANE", fault_manager),
            "SkiDoo-Alpha":  PolarVehicle("SkiDoo-A", "SNOWMOBILE", fault_manager),
        }
        self.electrical_demand_kw = 0.0
        self.fuel_requested_L = 0.0
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("VEHICLE_BLOCK_HEATER_DISCONNECT", "230V block heater cable disconnected (Cold-soaking)")
        fm.register_spof("VEHICLE_HYDRAULIC_HOSE_BURST", "Extreme cold hydraulic hose burst (Pressure loss)")
        fm.register_spof("VEHICLE_FUEL_LINE_ICE_PLUG", "Water ice crystals plugging fuel filter bowl")

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        amb_temp = env.get("ambient_temperature_c", -15.0)
        
        self.electrical_demand_kw = 0.0
        self.fuel_requested_L = 0.0
        
        fleet_status = {}
        for name, v in self.fleet.items():
            v.step(amb_temp, dt)
            self.electrical_demand_kw += v.get_heater_kw()
            
            can_start = (v.engine_core_temp_c > -12.0)
            fleet_status[name] = {
                "type": v.vehicle_type,
                "engine_running": v.engine_running,
                "block_heater_connected": v.block_heater_connected,
                "engine_core_temp_c": round(v.engine_core_temp_c, 1),
                "ready_for_dispatch": can_start and (v.hydraulic_pressure_bar > 150.0),
                "cold_soak_risk": "CRITICAL" if v.engine_core_temp_c < -15.0 else ("ELEVATED" if v.engine_core_temp_c < 0.0 else "NOMINAL"),
                "fuel_level_L": round(v.fuel_level_L, 1),
                "hydraulic_pressure_bar": round(v.hydraulic_pressure_bar, 1)
            }
            
        telemetry = {
            "fleet_size": len(self.fleet),
            "vehicles": fleet_status,
            "fuel_requested_L": self.fuel_requested_L,
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        
        state["vehicles"] = telemetry
        return telemetry
