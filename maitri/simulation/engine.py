import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import json
import logging
from datetime import datetime, timedelta

from simulation.environment import EnvironmentModel
from simulation.systems.hvac import HVACModel
from simulation.systems.dg_power import PowerGrid
from simulation.systems.fuel import FuelModel
from simulation.systems.water import WaterModel
from simulation.systems.wastewater import WastewaterModel
from simulation.systems.communication import CommunicationModel
from simulation.systems.vehicle import VehicleFleet
from simulation.systems.inventory import InventoryModel
from simulation.systems.human import HumanAssetModel
from simulation.faults import FaultManager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class SimulationEngine:
    """
    Central Interdependency Simulation Engine for Maitri Station Digital Twin.
    Coordinates all 10 physical and logistical macro-models.
    """
    def __init__(self, use_real_clock=True, time_acceleration=1):
        if use_real_clock:
            self.current_time = datetime.utcnow()
        else:
            self.current_time = datetime(2026, 8, 29, 12, 0, 0)
            
        self.time_acceleration = time_acceleration 
        self.last_sim_time = self.current_time
        
        self.state = {
            "station": "MAITRI",
            "timestamp": self.current_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "environment": {}
        }
        
        self.fault_manager = FaultManager()
        self.environment_model = EnvironmentModel()
        self.human_model = HumanAssetModel(self.fault_manager)
        self.vehicle_model = VehicleFleet(self.fault_manager)
        self.hvac_model = HVACModel(self.fault_manager)
        self.power_model = PowerGrid(self.fault_manager)
        self.fuel_model = FuelModel(self.fault_manager)
        self.water_model = WaterModel(self.fault_manager)
        self.wastewater_model = WastewaterModel(self.fault_manager)
        self.communication_model = CommunicationModel(self.fault_manager)
        self.inventory_model = InventoryModel(self.fault_manager)
        
        # Exact execution order ensuring physical conservation laws & dependencies
        self.models = [
            self.environment_model,
            self.human_model,
            self.vehicle_model,
            self.hvac_model,
            self.power_model,
            self.fuel_model,
            self.water_model,
            self.wastewater_model,
            self.communication_model,
            self.inventory_model
        ]
        self.tick_count = 0

    def step(self):
        self.tick_count += 1
        
        # Advance simulation clock
        self.current_time += timedelta(seconds=self.time_acceleration)
        self.state["timestamp"] = self.current_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        dt_seconds = int((self.current_time - self.last_sim_time).total_seconds())
        self.last_sim_time = self.current_time
        
        # Automated dispatch of maintenance work orders for active faults
        for fault_id in list(self.fault_manager.active_faults.keys()):
            if not any(r["fault_id"] == fault_id for r in self.inventory_model.active_repairs):
                self.inventory_model.dispatch_work_order(fault_id, self.state)
                logging.info(f"MAITRI AUTO-DISPATCH: Work order generated for {fault_id}")
                
        # Update all 10 physical sub-models sequentially
        for model in self.models:
            if hasattr(model, 'update'):
                model.update(self.state, sim_time=self.current_time, dt=dt_seconds)
                
        self.state["faults"] = self.fault_manager.active_faults
        return self.state

    def run_realtime(self):
        logging.info("Starting Maitri Station Digital Twin Simulation Engine...")
        try:
            while True:
                current_state = self.step()
                os.system('cls' if os.name == 'nt' else 'clear')
                print(f"--- MAITRI STATION LIVE TELEMETRY (Tick: {self.tick_count} | Speed: {self.time_acceleration}x) ---")
                print(f"Timestamp: {self.state['timestamp']}")
                print(json.dumps(current_state, indent=2))
                time.sleep(1)
        except KeyboardInterrupt:
            logging.info("Maitri simulation stopped by user.")

if __name__ == "__main__":
    engine = SimulationEngine(use_real_clock=True, time_acceleration=1)
    engine.run_realtime()
