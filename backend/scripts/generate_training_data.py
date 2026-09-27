"""Data Synthesis Pipeline for Himantar Predictive AI Suite.

Generates high-fidelity training datasets combining:
1. Thermodynamic Antarctic microgrid load transfer functions (HVAC, life support, generator curves).
2. Multi-channel mechanical telemetry with realistic fault injections (bearing wear, oil loss, coolant overheat).
"""
import os
import math
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "backend", "data")
os.makedirs(DATA_DIR, exist_ok=True)

np.random.seed(42)
random.seed(42)


def generate_microgrid_energy_dataset(num_samples: int = 15000) -> str:
    """Generate comprehensive hourly energy demand and renewable generation dataset."""
    start_time = datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc)
    records = []

    for i in range(num_samples):
        ts = start_time + timedelta(hours=i)
        day_of_year = ts.timetuple().tm_yday
        hour = ts.hour
        month = ts.month

        # Polar seasonality: Winter in July (day 180-220), Summer in January (day 1-45)
        # Seasonal base temperature in Queen Maud Land / Larsemann Hills
        is_polar_summer = month in [11, 12, 1, 2]
        is_polar_winter = month in [5, 6, 7, 8]

        season_temp_base = -12.0 if is_polar_summer else (-28.0 if is_polar_winter else -20.0)
        diurnal_temp = math.cos(math.radians((hour - 14) * 15)) * 3.5
        storm_cold_snap = -12.0 if (random.random() < 0.12) else 0.0
        ambient_temp_c = round(season_temp_base + diurnal_temp + storm_cold_snap + np.random.normal(0, 1.8), 2)

        # Wind speed (Katabatic surges in winter)
        base_wind = 18.0 if is_polar_winter else 12.0
        gust_factor = random.uniform(1.0, 3.2) if (random.random() < 0.18) else 1.0
        wind_speed_kmh = max(2.0, round((base_wind + np.random.normal(0, 4.0)) * gust_factor, 1))
        wind_speed_ms = round(wind_speed_kmh / 3.6, 2)

        # Solar radiation: 24h daylight in summer, 0 in winter
        if is_polar_winter:
            solar_radiation_wm2 = 0.0
        elif is_polar_summer:
            # Midnight sun with dip at 00:00
            solar_elevation = math.sin(math.radians((hour - 6) * 15))
            solar_radiation_wm2 = max(25.0, round(280.0 + solar_elevation * 160.0 + np.random.normal(0, 15), 1))
        else:
            # Spring/Autumn normal day/night
            if 6 <= hour <= 18:
                solar_elevation = math.sin(math.radians((hour - 6) * 15))
                solar_radiation_wm2 = max(0.0, round(solar_elevation * 380.0 + np.random.normal(0, 20), 1))
            else:
                solar_radiation_wm2 = 0.0

        # Station occupancy (Summer campaigns have ~35 crew, winter wintering team has ~24)
        crew_count = 35 if is_polar_summer else 24

        # --- Physical Load Calculations ---
        # 1. Base life support & equipment (constant baseline)
        base_load_kw = 45.0 + (crew_count * 1.2)

        # 2. Activity spike (cooking, lab equipment, lighting in morning and evening)
        diurnal_activity = 0.0
        if 7 <= hour <= 9:
            diurnal_activity = 28.0
        elif 12 <= hour <= 14:
            diurnal_activity = 22.0
        elif 18 <= hour <= 21:
            diurnal_activity = 32.0
        else:
            diurnal_activity = 4.0

        # 3. HVAC & Freeze Protection (Thermodynamic loss proportional to delta-T)
        delta_t = max(0.0, 18.0 - ambient_temp_c)  # Station kept at +18°C
        hvac_heat_loss_kw = delta_t * 2.85  # Thermal loss coefficient
        hvac_electrical_load_kw = delta_t * 1.45  # Electric heaters, circulation pumps, vehicle block heaters

        total_electrical_load_kw = round(base_load_kw + diurnal_activity + hvac_electrical_load_kw + np.random.normal(0, 2.5), 1)

        # 4. Renewable Generation Physics
        # Solar PV: 50kW installed array, efficiency factor ~18%
        solar_gen_kw = round(min(45.0, (solar_radiation_wm2 / 1000.0) * 50.0 * 0.88), 1)

        # Wind Turbine: 30kW installed capacity
        if wind_speed_ms < 3.5:
            wind_gen_kw = 0.0
        elif wind_speed_ms > 25.0:
            wind_gen_kw = 0.0  # Cut-out safety feathering
        elif wind_speed_ms >= 12.0:
            wind_gen_kw = 28.5  # Rated power
        else:
            # Cubic power curve
            wind_gen_kw = round(28.5 * ((wind_speed_ms - 3.5) / (12.0 - 3.5)) ** 2.6, 1)

        # 5. Generator Dispatch & Fuel Consumption
        renewable_total_kw = solar_gen_kw + wind_gen_kw
        generator_load_kw = max(20.0, total_electrical_load_kw - renewable_total_kw)

        # Specific fuel consumption curve (BSFC ~ 0.245 - 0.280 L/kWh depending on load fraction)
        bsfc = 0.245 if generator_load_kw > 100 else 0.278
        fuel_flow_L_hr = round(generator_load_kw * bsfc, 2)

        records.append({
            "timestamp": ts.isoformat(),
            "month": month,
            "hour": hour,
            "ambient_temp_c": ambient_temp_c,
            "wind_speed_kmh": wind_speed_kmh,
            "wind_speed_ms": wind_speed_ms,
            "solar_radiation_wm2": solar_radiation_wm2,
            "crew_count": crew_count,
            "solar_gen_kw": solar_gen_kw,
            "wind_gen_kw": wind_gen_kw,
            "total_load_kw": total_electrical_load_kw,
            "generator_load_kw": generator_load_kw,
            "fuel_flow_L_hr": fuel_flow_L_hr,
        })

    df = pd.DataFrame(records)
    csv_path = os.path.join(DATA_DIR, "microgrid_energy_train.csv")
    df.to_csv(csv_path, index=False)
    print(f"[OK] Generated {len(df)} energy records -> {csv_path}")
    return csv_path


def generate_equipment_anomaly_dataset(num_samples: int = 20000) -> str:
    """Generate multi-channel equipment sensor readings with injected mechanical faults."""
    records = []

    # 95% nominal samples, 5% anomalous samples
    for i in range(num_samples):
        is_anomaly = (random.random() < 0.05)
        fault_type = "NOMINAL"

        # Baseline Nominal Physics for 100kVA Cummins / Kirloskar Polar Diesel Generator
        vibration_rms = np.random.normal(0.045, 0.012)
        coolant_temp = np.random.normal(88.0, 2.5)
        oil_pressure = np.random.normal(4.85, 0.18)
        oil_viscosity = np.random.normal(95.0, 2.0)
        fuel_rail_pressure = np.random.normal(1210.0, 18.0)
        exhaust_temp = np.random.normal(410.0, 15.0)
        battery_temp = np.random.normal(21.0, 1.5)

        if is_anomaly:
            scenario = random.choice([
                "BEARING_WEAR",
                "COOLANT_OVERHEAT",
                "OIL_PRESSURE_DROP",
                "FUEL_LINE_WAX_CLOG",
                "BATTERY_THERMAL_RUNAWAY",
            ])
            fault_type = scenario

            if scenario == "BEARING_WEAR":
                # Heavy harmonic vibration on Z-axis
                vibration_rms = float(np.random.uniform(1.2, 3.8))
            elif scenario == "COOLANT_OVERHEAT":
                # Thermostat stuck or glycol leakage
                coolant_temp = float(np.random.uniform(103.0, 118.0))
            elif scenario == "OIL_PRESSURE_DROP":
                # Pump seal degradation or viscosity loss
                oil_pressure = float(np.random.uniform(1.8, 2.9))
                oil_viscosity = float(np.random.uniform(60.0, 75.0))
            elif scenario == "FUEL_LINE_WAX_CLOG":
                # Fuel freezing / paraffin wax crystallization
                fuel_rail_pressure = float(np.random.uniform(650.0, 890.0))
                exhaust_temp = float(np.random.uniform(490.0, 580.0))  # lean burn spike
            elif scenario == "BATTERY_THERMAL_RUNAWAY":
                # Internal cell short in cold-room battery bank
                battery_temp = float(np.random.uniform(46.0, 68.0))

        records.append({
            "vibration_rms_z": round(max(0.01, vibration_rms), 4),
            "coolant_temp_c": round(coolant_temp, 2),
            "oil_pressure_bar": round(max(0.5, oil_pressure), 2),
            "oil_viscosity_pct": round(oil_viscosity, 1),
            "fuel_rail_pressure_bar": round(max(300.0, fuel_rail_pressure), 1),
            "exhaust_gas_temp_c": round(exhaust_temp, 1),
            "battery_temp_c": round(battery_temp, 1),
            "is_anomaly": 1 if is_anomaly else 0,
            "fault_type": fault_type,
        })

    df = pd.DataFrame(records)
    csv_path = os.path.join(DATA_DIR, "equipment_anomaly_train.csv")
    df.to_csv(csv_path, index=False)
    print(f"[OK] Generated {len(df)} anomaly sensor records ({df['is_anomaly'].sum()} anomalous) -> {csv_path}")
    return csv_path


if __name__ == "__main__":
    print("[INFO] Synthesizing Antarctic Station Training Datasets...")
    generate_microgrid_energy_dataset(15000)
    generate_equipment_anomaly_dataset(20000)
    print("[SUCCESS] Dataset generation completed successfully!")
