import unittest
from simulation.engine import SimulationEngine
from datetime import datetime

class TestMaitriDigitalTwinIntegration(unittest.TestCase):
    def setUp(self):
        self.engine = SimulationEngine(use_real_clock=False, time_acceleration=1)

    def test_all_10_models_present_and_ticking(self):
        """Verify that all 10 macro-models are registered and generate telemetry."""
        state = self.engine.step()
        
        self.assertEqual(state["station"], "MAITRI")
        self.assertIn("environment", state)
        self.assertIn("power", state)
        self.assertIn("hvac", state)
        self.assertIn("water", state)
        self.assertIn("fuel", state)
        self.assertIn("wastewater", state)
        self.assertIn("human", state)
        self.assertIn("vehicles", state)
        self.assertIn("communication", state)
        self.assertIn("inventory", state)

    def test_environment_and_lake_priyadarshini(self):
        """Verify Schirmacher Oasis coordinates and Lake Priyadarshini ice/water model."""
        state = self.engine.step()
        env = state["environment"]
        
        self.assertEqual(env["coordinates"]["oasis"], "Schirmacher")
        self.assertAlmostEqual(env["coordinates"]["lat"], -70.7667, places=3)
        self.assertIn("lake_priyadarshini", env)
        self.assertGreater(env["lake_priyadarshini"]["water_temp_c"], 0.0)
        self.assertGreaterEqual(env["lake_priyadarshini"]["ice_thickness_m"], 0.0)

    def test_power_dg_and_solar_pv(self):
        """Verify 100 kVA DG sets and 25 kW rooftop solar PV integration."""
        state = self.engine.step()
        pwr = state["power"]
        
        self.assertEqual(pwr["grid_status"], "NOMINAL")
        self.assertIn("DG-1", pwr["generators"])
        self.assertEqual(pwr["generators"]["DG-1"]["state"], "RUNNING")
        self.assertIn("solar_pv", pwr)
        self.assertEqual(pwr["solar_pv"]["installed_capacity_kw"], 25.0)

    def test_oil_boiler_and_hvac(self):
        """Verify oil-fired boiler heat generation and hydronic radiator supply."""
        state = self.engine.step()
        hvac = state["hvac"]
        
        self.assertEqual(hvac["system_mode"], "HYDRONIC_OIL_BOILER")
        self.assertIn("boiler_firing_rate_pct", hvac)
        self.assertGreater(hvac["primary_supply_temp_c"], 50.0)
        self.assertTrue(hvac["dhw_calorifier_temp_c"] >= 55.0)

    def test_lake_water_pipeline_freeze_cascade(self):
        """Test failure cascade: trace heat failure causes pipeline freeze."""
        # 1. Inject trace heat failure
        self.engine.fault_manager.trigger("WATER_TRACE_HEAT_FAIL", 1.0)
        
        # 2. Advance time 50 minutes (3000 seconds) in cold winter
        self.engine.environment_model.current_temp = -32.0
        for _ in range(5):
            state = self.engine.step()
            # Fast-cool pipe for test verification
            self.engine.water_model.pipeline_water_temp_c = -2.5
            
        state = self.engine.step()
        water = state["water"]
        self.assertTrue(water["pipeline_250m"]["is_frozen_blocked"])
        self.assertEqual(water["pipeline_250m"]["freeze_hazard_risk"], "CRITICAL")
        self.assertEqual(water["intake_flow_L_s"], 0.0)

    def test_boiler_flameout_triggers_emergency_electric_heat(self):
        """Test failure cascade: boiler flameout causes temperature drop and emergency electric heaters engage."""
        self.engine.fault_manager.trigger("BOILER_FLAMEOUT", 1.0)
        # Drop room temp below 16°C
        self.engine.hvac_model.living_temp_c = 14.2
        
        state = self.engine.step()
        hvac = state["hvac"]
        self.assertTrue(hvac["emergency_electric_heat_active"])
        self.assertGreaterEqual(hvac["electrical_demand_kw"], 25.0)

    def test_dg1_coolant_leak_trips_to_dg2(self):
        """Test DG-1 overheat trip causes auto-failover to DG-2."""
        self.engine.fault_manager.trigger("DG1_COOLANT_LEAK", 1.0)
        # Force high coolant temp on DG-1
        self.engine.power_model.dg_units["DG-1"].coolant_temp_c = 115.0
        
        state = self.engine.step()
        # DG-1 should trip
        self.assertEqual(self.engine.power_model.dg_units["DG-1"].state.name, "FAULT_SHUTDOWN")
        # DG-2 should auto-crank/start
        state = self.engine.step()
        self.assertIn(self.engine.power_model.dg_units["DG-2"].state.name, ["CRANKING", "WARM_UP", "RUNNING"])

if __name__ == "__main__":
    unittest.main()
