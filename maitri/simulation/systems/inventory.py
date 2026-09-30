import logging
import math
import random

class InventoryModel:
    """
    Simulates Maitri Station's Logistics, Spare Parts & Reliability Engineering:
    - 2-Parameter Weibull equipment failure distributions
    - Automated Mean Time to Repair (MTTR) work order dispatch
    - Food rations, polar medicine, and critical consumables tracking
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # Consumables
        self.food_ration_days = 420.0
        self.medical_o2_cylinders = 18
        self.trauma_kits_available = 12
        
        # Spares Inventory
        self.spares_stock = {
            "SPARE_INJECTORS": 12,
            "SPARE_WATER_PUMP_SEALS": 8,
            "SPARE_TRACE_CABLE_M": 150,
            "SPARE_AHU_FAN_BELTS": 6,
            "SPARE_BOILER_NOZZLES": 10,
            "SPARE_AVR_BOARDS": 4,
            "SPARE_STP_HEATER_COILS": 4,
        }
        
        self.active_repairs = []
        
    def dispatch_work_order(self, fault_id: str, state: dict):
        """Dispatches maintenance crew to repair a fault."""
        if any(r["fault_id"] == fault_id for r in self.active_repairs):
            return # Repair already in progress
            
        # Determine spare required & MTTR duration (in simulation seconds)
        mttr_s = 60 # Fast demo resolution (1 minute of sim time)
        spare_key = None
        
        if "INJECTOR" in fault_id: spare_key = "SPARE_INJECTORS"
        elif "WATER" in fault_id or "PUMP" in fault_id: spare_key = "SPARE_WATER_PUMP_SEALS"
        elif "TRACE" in fault_id: spare_key = "SPARE_TRACE_CABLE_M"
        elif "FAN" in fault_id or "BLOWER" in fault_id: spare_key = "SPARE_AHU_FAN_BELTS"
        elif "BOILER" in fault_id: spare_key = "SPARE_BOILER_NOZZLES"
        elif "AVR" in fault_id: spare_key = "SPARE_AVR_BOARDS"
        elif "STP" in fault_id: spare_key = "SPARE_STP_HEATER_COILS"
        
        if spare_key and self.spares_stock.get(spare_key, 0) > 0:
            self.spares_stock[spare_key] -= 1
            logging.info(f"Maitri Inventory: Consumed 1 unit of {spare_key} for {fault_id}")
            
        self.active_repairs.append({
            "fault_id": fault_id,
            "remaining_s": mttr_s,
            "total_s": mttr_s,
            "status": "TECHNICIAN_DISPATCHED"
        })

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        # 1. Food Rations Depletion
        occupants = state.get("human", {}).get("headcount", 25)
        # 25 members consume 1 standard person-day per day
        daily_food_burn = (occupants / 25.0) * (dt / 86400.0)
        self.food_ration_days = max(0.0, self.food_ration_days - daily_food_burn)
        
        # 2. Progress Active Repairs
        finished = []
        for r in self.active_repairs:
            r["remaining_s"] -= dt
            if r["remaining_s"] <= 0:
                self.fault_manager.resolve(r["fault_id"])
                finished.append(r)
                logging.info(f"Maitri Work Order COMPLETE: {r['fault_id']} restored by engineering crew")
                
        for f in finished:
            self.active_repairs.remove(f)
            
        # 3. Dynamic Equipment Reliability (Weibull Anomaly Index)
        operating_hours = state.get("power", {}).get("generators", {}).get("DG-1", {}).get("operating_hours", 120.0)
        # Shape beta=2.2 (wear out), Scale eta=8000 hours
        weibull_hazard = 1.0 - math.exp(-((operating_hours / 8000.0) ** 2.2))
        
        telemetry = {
            "food_rations_remaining_days": round(self.food_ration_days, 1),
            "medical_supplies": {
                "oxygen_cylinders": self.medical_o2_cylinders,
                "trauma_kits": self.trauma_kits_available
            },
            "spare_parts_inventory": self.spares_stock,
            "active_work_orders": len(self.active_repairs),
            "repairs_in_progress": self.active_repairs,
            "dg_weibull_wear_index": round(weibull_hazard, 4)
        }
        
        state["inventory"] = telemetry
        return telemetry
