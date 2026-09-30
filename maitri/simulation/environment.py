import random
import logging
import math
from datetime import datetime

class EnvironmentModel:
    """
    High-Fidelity Environmental & Meteorological Model for Maitri Station.
    Simulates the microclimate of the Schirmacher Oasis, Queen Maud Land (-70.7667°S, 11.7333°E, 117m ASL).
    Features:
    - Rocky oasis thermal inertia & bedrock albedo
    - Lake Priyadarshini water temperature and winter surface ice growth (Stefan's equation)
    - Solar geometry at 70.77°S (24h polar day in summer, 60 days polar night in winter)
    - Katabatic wind cascades surging off the polar continental ice sheet
    """
    def __init__(self):
        # 1. Empirical Monthly Profiles for Schirmacher Oasis (IMD & NCPOR Meteorological Records)
        # Note: Rock oasis exhibits slightly higher summer diurnal range (+2.5°C) than coastal Bharati.
        self.monthly_profiles = {
            1:  {"mean": -1.5,  "diurnal_amp": 2.5, "base_wind": 4.5},  # Peak Summer (24h sun)
            2:  {"mean": -4.5,  "diurnal_amp": 2.2, "base_wind": 5.5},
            3:  {"mean": -9.5,  "diurnal_amp": 2.0, "base_wind": 7.5},  # Freeze begins
            4:  {"mean": -14.5, "diurnal_amp": 1.5, "base_wind": 9.5},
            5:  {"mean": -17.5, "diurnal_amp": 1.2, "base_wind": 12.0}, # Polar night onset (~May 19)
            6:  {"mean": -18.5, "diurnal_amp": 0.8, "base_wind": 11.5}, # Deep Polar Night
            7:  {"mean": -19.5, "diurnal_amp": 0.8, "base_wind": 13.0}, # Coldest month
            8:  {"mean": -19.0, "diurnal_amp": 1.0, "base_wind": 12.0}, # Sun returns (~Jul 22)
            9:  {"mean": -17.0, "diurnal_amp": 1.4, "base_wind": 11.0},
            10: {"mean": -13.0, "diurnal_amp": 1.8, "base_wind": 9.0},  # Spring transition
            11: {"mean": -6.5,  "diurnal_amp": 2.2, "base_wind": 6.5},  # Polar day onset (~Nov 18)
            12: {"mean": -2.5,  "diurnal_amp": 2.5, "base_wind": 4.8}   # Summer solstice
        }
        
        self.current_state = "CLEAR"
        
        # 2. Seasonal Markov Chain Transition Matrices (Schirmacher Oasis)
        self.transition_matrices = {
            "SUMMER": { # Dec, Jan, Feb
                "CLEAR":     {"CLEAR": 0.82, "CLOUDY": 0.12, "HIGH_WIND": 0.05, "BLIZZARD": 0.01},
                "CLOUDY":    {"CLEAR": 0.35, "CLOUDY": 0.55, "HIGH_WIND": 0.09, "BLIZZARD": 0.01},
                "HIGH_WIND": {"CLEAR": 0.25, "CLOUDY": 0.20, "HIGH_WIND": 0.53, "BLIZZARD": 0.02},
                "BLIZZARD":  {"CLEAR": 0.40, "CLOUDY": 0.10, "HIGH_WIND": 0.50, "BLIZZARD": 0.00}
            },
            "WINTER": { # May, Jun, Jul, Aug, Sep
                "CLEAR":     {"CLEAR": 0.55, "CLOUDY": 0.15, "HIGH_WIND": 0.22, "BLIZZARD": 0.08},
                "CLOUDY":    {"CLEAR": 0.12, "CLOUDY": 0.55, "HIGH_WIND": 0.20, "BLIZZARD": 0.13},
                "HIGH_WIND": {"CLEAR": 0.05, "CLOUDY": 0.10, "HIGH_WIND": 0.50, "BLIZZARD": 0.35},
                "BLIZZARD":  {"CLEAR": 0.00, "CLOUDY": 0.08, "HIGH_WIND": 0.28, "BLIZZARD": 0.64}
            },
            "TRANSITION": { # Mar, Apr, Oct, Nov
                "CLEAR":     {"CLEAR": 0.72, "CLOUDY": 0.16, "HIGH_WIND": 0.10, "BLIZZARD": 0.02},
                "CLOUDY":    {"CLEAR": 0.22, "CLOUDY": 0.58, "HIGH_WIND": 0.16, "BLIZZARD": 0.04},
                "HIGH_WIND": {"CLEAR": 0.12, "CLOUDY": 0.18, "HIGH_WIND": 0.58, "BLIZZARD": 0.12},
                "BLIZZARD":  {"CLEAR": 0.02, "CLOUDY": 0.18, "HIGH_WIND": 0.45, "BLIZZARD": 0.35}
            }
        }
        
        # 3. Physical State Modifiers
        self.state_physics = {
            "CLEAR":     {"pressure_offset": 6.0,  "wind_mult": 1.0, "temp_offset": 0.0},
            "CLOUDY":    {"pressure_offset": -4.0, "wind_mult": 1.2, "temp_offset": 1.5}, # Cloud infrared blanket
            "HIGH_WIND": {"pressure_offset": -16.0,"wind_mult": 2.4, "temp_offset": -2.5},
            "BLIZZARD":  {"pressure_offset": -38.0,"wind_mult": 4.2, "temp_offset": -7.5} # Severe polar low
        }
        
        self.current_temp = -15.5
        self.current_wind = 6.0
        self.current_pressure = 988.0
        self.current_humidity = 58.0
        
        # Lake Priyadarshini Glaciology
        self.lake_water_temp_c = 2.4    # Liquid water at bottom of lake
        self.lake_ice_thickness_m = 1.2 # Mid-winter ice thickness
        
        self.LATITUDE = -70.7667
        self.LONGITUDE = 11.7333
        self.last_eval_time = None
        self.demo_override_temp = None

    def trigger_demo_event(self, target_temp: float):
        self.demo_override_temp = target_temp

    def release_demo_event(self):
        self.demo_override_temp = None

    def get_season(self, month: int) -> str:
        if month in [12, 1, 2]: return "SUMMER"
        if month in [5, 6, 7, 8, 9]: return "WINTER"
        return "TRANSITION"

    def evaluate_markov_chain(self, sim_time: datetime):
        if self.last_eval_time is None:
            self.last_eval_time = sim_time
            return
            
        if (sim_time - self.last_eval_time).total_seconds() >= 3600:
            self.last_eval_time = sim_time
            season = self.get_season(sim_time.month)
            matrix = self.transition_matrices[season]
            
            rand = random.random()
            cumulative = 0.0
            for next_state, prob in matrix[self.current_state].items():
                cumulative += prob
                if rand <= cumulative:
                    if next_state != self.current_state:
                        logging.info(f"[{season}] MAITRI WEATHER SHIFT: {self.current_state} -> {next_state}")
                        self.current_state = next_state
                    break

    def calculate_solar_radiation(self, sim_time: datetime) -> float:
        """Astronomical solar radiation solver for 70.77°S."""
        day_of_year = sim_time.timetuple().tm_yday
        hour = sim_time.hour + (sim_time.minute / 60.0) + (sim_time.second / 3600.0)
        
        declination = 23.45 * math.sin(math.radians(360.0 * (284 + day_of_year) / 365.0))
        # Longitude correction for local solar time (11.73°E -> ~+47 min from UTC)
        local_solar_hour = (hour + (self.LONGITUDE / 15.0)) % 24.0
        hour_angle = 15.0 * (local_solar_hour - 12.0)
        
        lat_rad = math.radians(self.LATITUDE)
        dec_rad = math.radians(declination)
        ha_rad = math.radians(hour_angle)
        
        sin_elevation = math.sin(lat_rad) * math.sin(dec_rad) + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
        elevation = math.degrees(math.asin(sin_elevation))
        
        if elevation <= 0: return 0.0
        
        cloud_factor = {"CLEAR": 1.0, "CLOUDY": 0.42, "HIGH_WIND": 0.78, "BLIZZARD": 0.08}[self.current_state]
        radiation = 1050.0 * sin_elevation * cloud_factor
        return max(0.0, radiation)

    def calculate_wind_chill(self, temp_c: float, wind_ms: float) -> float:
        wind_kmh = wind_ms * 3.6
        if temp_c >= 10.0 or wind_kmh <= 4.8: return temp_c
        return 13.12 + 0.6215 * temp_c - 11.37 * (wind_kmh**0.16) + 0.3965 * temp_c * (wind_kmh**0.16)

    def update_lake_ice(self, ambient_temp_c: float, dt: int):
        """
        Stefan's Ice Growth Equation for Lake Priyadarshini:
        h^2 = h0^2 + (2 * k / (rho * L)) * Integral(T_freeze - T_ambient) dt
        """
        # Freezing point of fresh water is 0.0°C (unlike seawater -1.8°C!)
        if ambient_temp_c < 0.0:
            # Freezing degree seconds
            fds = (0.0 - ambient_temp_c) * dt
            # 2 * k / (rho * L) approx 1.45e-8 m^2 / (s * °C)
            k_growth = 1.45e-8
            new_h_sq = (self.lake_ice_thickness_m ** 2) + (k_growth * fds)
            self.lake_ice_thickness_m = min(2.4, math.sqrt(max(0.0, new_h_sq)))
        else:
            # Summer melting rate: ~1.5 cm / day when temp > 0°C
            melt_rate_m_s = (1.5e-2 / 86400.0) * ambient_temp_c
            self.lake_ice_thickness_m = max(0.0, self.lake_ice_thickness_m - (melt_rate_m_s * dt))

        # Bottom lake water remains liquid due to 4°C density maximum
        self.lake_water_temp_c = max(0.8, min(3.8, 3.8 - (self.lake_ice_thickness_m * 1.2)))

    def update(self, state: dict, sim_time: datetime, dt: int = 1):
        if dt <= 0: dt = 1
        self.evaluate_markov_chain(sim_time)
        
        month_profile = self.monthly_profiles[sim_time.month]
        base_temp = month_profile["mean"]
        base_wind = month_profile["base_wind"]
        
        # Diurnal temperature cycle (amplified by rock albedo in Schirmacher Oasis)
        hour = sim_time.hour + (sim_time.minute / 60.0)
        diurnal_offset = month_profile["diurnal_amp"] * math.sin(math.radians((hour - 8.0) * 15.0))
        
        # Katabatic wind surges off polar ice cap (common between 04:00 and 09:00)
        katabatic_active = False
        katabatic_boost = 0.0
        if 4 <= sim_time.hour <= 9:
            day_seed = sim_time.year * 1000 + sim_time.timetuple().tm_yday
            random.seed(day_seed)
            if random.random() < 0.35: # 35% probability in Schirmacher
                katabatic_active = True
                katabatic_boost = 11.5 # +11.5 m/s gusting
                
        # State modifiers
        modifiers = self.state_physics[self.current_state]
        target_temp = base_temp + diurnal_offset + modifiers["temp_offset"]
        target_wind = (base_wind * modifiers["wind_mult"]) + (katabatic_boost if katabatic_active else 0.0)
        target_pressure = 988.0 + modifiers["pressure_offset"]
        
        if self.demo_override_temp is not None:
            target_temp = self.demo_override_temp
            
        # Thermal inertia of air and rock oasis
        alpha = min(1.0, 0.001 * dt)
        self.current_temp += (target_temp - self.current_temp) * alpha
        self.current_wind += (target_wind - self.current_wind) * (alpha * 2.0)
        self.current_pressure += (target_pressure - self.current_pressure) * alpha
        
        # Lake Priyadarshini ice dynamics
        self.update_lake_ice(self.current_temp, dt)
        
        solar_rad = self.calculate_solar_radiation(sim_time)
        wind_chill = self.calculate_wind_chill(self.current_temp, self.current_wind)
        
        env_telemetry = {
            "station": "MAITRI",
            "coordinates": {"lat": self.LATITUDE, "lon": self.LONGITUDE, "oasis": "Schirmacher"},
            "ambient_temperature_c": round(self.current_temp, 2),
            "wind_chill_c": round(wind_chill, 2),
            "wind_speed_ms": round(self.current_wind, 2),
            "wind_speed_kmh": round(self.current_wind * 3.6, 2),
            "atmospheric_pressure_hpa": round(self.current_pressure, 1),
            "relative_humidity_pct": round(self.current_humidity, 1),
            "solar_radiation_wm2": round(solar_rad, 1),
            "weather_state": self.current_state,
            "katabatic_active": katabatic_active,
            "lake_priyadarshini": {
                "water_temp_c": round(self.lake_water_temp_c, 2),
                "ice_thickness_m": round(self.lake_ice_thickness_m, 3),
                "is_frozen_over": self.lake_ice_thickness_m > 0.05
            }
        }
        
        state["environment"] = env_telemetry
        return env_telemetry
