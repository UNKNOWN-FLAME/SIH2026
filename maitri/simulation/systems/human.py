import logging
import math
import random

class HumanAssetModel:
    """
    Simulates Maitri Station's Expedition Crew Demographics & Physiology:
    - 25 Winter-over personnel / up to 65 Summer expedition members
    - Metabolic heat output (120W - 220W per person)
    - Metabolic water demand (100 L/person/day)
    - Respiratory oxygen consumption and CO2 exhalation
    - Polar cold stress & wind-chill safety monitoring
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        self.winter_headcount = 25
        self.summer_headcount = 65
        self.current_headcount = 25
        
        self.crew_metabolic_heat_kw = 3.0
        self.crew_health_index_pct = 98.0
        self.cold_stress_risk = "NOMINAL"
        
    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        month = sim_time.month if sim_time else 6
        # Summer season has expanded crew in camp huts
        if month in [11, 12, 1, 2]:
            self.current_headcount = self.summer_headcount
        else:
            self.current_headcount = self.winter_headcount
            
        env = state.get("environment", {})
        wind_chill = env.get("wind_chill_c", -25.0)
        
        # Cold stress advisory based on Madrid Protocol guidelines
        if wind_chill < -45.0:
            self.cold_stress_risk = "CRITICAL_FROSTBITE_IMMOBILIZED"
        elif wind_chill < -32.0:
            self.cold_stress_risk = "HIGH_RESTRICTED_EXPOSURE"
        elif wind_chill < -20.0:
            self.cold_stress_risk = "MODERATE_THERMAL_GEAR_MANDATORY"
        else:
            self.cold_stress_risk = "NOMINAL"
            
        # Total metabolic sensible heat injected into station
        self.crew_metabolic_heat_kw = round(self.current_headcount * 0.12, 2)
        
        living_temp = state.get("hvac", {}).get("living_zone_temp_c", 21.0)
        co2_ppm = state.get("hvac", {}).get("indoor_co2_ppm", 550.0)
        
        # Health index affected if indoor temp drops below 12°C or CO2 > 2000 PPM
        if living_temp < 12.0 or co2_ppm > 2000.0:
            self.crew_health_index_pct = max(40.0, self.crew_health_index_pct - (0.05 * dt))
        else:
            self.crew_health_index_pct = min(100.0, self.crew_health_index_pct + (0.02 * dt))
            
        telemetry = {
            "headcount": self.current_headcount,
            "expedition_season": "SUMMER_CAMPAIGN" if self.current_headcount > 25 else "WINTER_OVER_ISOLATION",
            "crew_metabolic_heat_kw": self.crew_metabolic_heat_kw,
            "crew_health_index_pct": round(self.crew_health_index_pct, 1),
            "outside_cold_stress_advisory": self.cold_stress_risk,
            "daily_potable_water_demand_L": self.current_headcount * 100.0,
            "daily_food_ration_consumption": self.current_headcount * 1.0
        }
        
        state["human"] = telemetry
        return telemetry
