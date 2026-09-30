import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
import json
from datetime import datetime, timedelta
from simulation.engine import SimulationEngine

def generate_history(days: int = 7, interval_seconds: int = 300, output_csv: str = "maitri_historical_telemetry.csv"):
    """
    Generates high-resolution multi-day synthetic telemetry dataset for Maitri Station ML training.
    """
    print(f"Generating {days} days of Maitri telemetry (interval: {interval_seconds}s)...")
    engine = SimulationEngine(use_real_clock=False, time_acceleration=interval_seconds)
    engine.current_time = datetime(2026, 6, 1, 0, 0, 0) # Polar winter start
    engine.last_sim_time = engine.current_time
    
    total_steps = int((days * 86400) / interval_seconds)
    
    out_path = os.path.join(os.path.dirname(__file__), "synthetic", output_csv)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    headers = [
        "timestamp",
        "station",
        "ambient_temperature_c",
        "wind_speed_ms",
        "solar_radiation_wm2",
        "lake_water_temp_c",
        "lake_ice_thickness_m",
        "total_station_load_kw",
        "solar_pv_kw",
        "dg1_state",
        "dg1_load_kw",
        "dg1_coolant_temp_c",
        "dg1_oil_pressure_bar",
        "dg1_vibration_mms",
        "dg_fuel_consumption_L_hr",
        "boiler_firing_rate_pct",
        "boiler_fuel_flow_L_hr",
        "hydronic_supply_temp_c",
        "hydronic_return_temp_c",
        "living_zone_temp_c",
        "indoor_co2_ppm",
        "pipeline_250m_temp_c",
        "pipeline_trace_heating_kw",
        "potable_tank_litres",
        "main_fuel_farm_litres",
        "day_tank_litres",
        "fuel_viscosity_cSt",
        "fuel_autonomy_days",
        "stp_aeration_temp_c",
        "stp_effluent_bod_mg_l",
        "satcom_cn_db",
        "satcom_latency_ms",
        "satcom_packet_loss_pct"
    ]
    
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for step in range(total_steps):
            state = engine.step()
            env = state.get("environment", {})
            lake = env.get("lake_priyadarshini", {})
            pwr = state.get("power", {})
            dg1 = pwr.get("generators", {}).get("DG-1", {})
            hvac = state.get("hvac", {})
            water = state.get("water", {})
            fuel = state.get("fuel", {})
            stp = state.get("wastewater", {})
            comms = state.get("communication", {}).get("satellite_link", {})
            
            row = [
                state.get("timestamp"),
                "MAITRI",
                env.get("ambient_temperature_c"),
                env.get("wind_speed_ms"),
                env.get("solar_radiation_wm2"),
                lake.get("water_temp_c"),
                lake.get("ice_thickness_m"),
                pwr.get("total_station_load_kw"),
                pwr.get("solar_pv", {}).get("current_output_kw"),
                dg1.get("state"),
                dg1.get("load_kw"),
                dg1.get("coolant_temp_c"),
                dg1.get("oil_pressure_bar"),
                dg1.get("vibration_mms"),
                pwr.get("total_fuel_consumption_L_hr"),
                hvac.get("boiler_firing_rate_pct"),
                hvac.get("boiler_fuel_flow_L_hr"),
                hvac.get("primary_supply_temp_c"),
                hvac.get("primary_return_temp_c"),
                hvac.get("living_zone_temp_c"),
                hvac.get("indoor_co2_ppm"),
                water.get("pipeline_250m", {}).get("water_temp_c"),
                water.get("electrical_demand_kw"),
                water.get("potable_storage_litres"),
                fuel.get("main_farm_level_L"),
                fuel.get("day_tank_level_L"),
                fuel.get("viscosity_cSt"),
                fuel.get("autonomy_days"),
                stp.get("aeration_tank_temp_c"),
                stp.get("effluent_bod_mg_l"),
                comms.get("carrier_to_noise_db"),
                comms.get("latency_ms"),
                comms.get("packet_loss_pct")
            ]
            writer.writerow(row)
            
    print(f"Dataset successfully created at: {out_path} ({total_steps} records)")

if __name__ == "__main__":
    generate_history(days=7, interval_seconds=300)
