import logging
import math
import random

class CommunicationModel:
    """
    Simulates Maitri Station's Satcom & Radio Infrastructure:
    - Primary GSAT-7A / VSAT satellite earth station terminal (connecting to NCPOR Goa)
    - Protective aerodynamic radome with snow/rime icing attenuation physics
    - Motorized satellite antenna servo tracking & wind gust pointing drift
    - Tactical HF / VHF transceivers for field traverses and Novolazarevskaya (Novo) Runway relay
    """
    def __init__(self, fault_manager):
        self.fault_manager = fault_manager
        
        # Satellite Link Budget
        self.carrier_to_noise_db = 14.5 # Nominal clear-sky C/N
        self.latency_ms = 620.0        # Geostationary round-trip delay
        self.packet_loss_pct = 0.2
        self.uplink_kbps = 4096.0
        self.downlink_kbps = 8192.0
        self.link_state = "UP"
        
        # Antenna Pedestal
        self.azimuth_deg = 342.5
        self.elevation_deg = 9.8       # Low polar elevation angle
        self.radome_ice_loss_db = 0.0
        
        # Tactical Radios
        self.hf_field_link_ok = True
        self.novo_runway_vhf_ok = True
        
        self.electrical_demand_kw = 2.8 # Radome de-icing & electronics
        self.register_faults()
        
    def register_faults(self):
        fm = self.fault_manager
        fm.register_spof("SATCOM_RADOME_ICING", "Snow / rime ice accumulation on radome (RF attenuation)")
        fm.register_spof("SATCOM_TRACKING_DESYNC", "Antenna servo tracking pointing drift in high winds")
        fm.register_spof("SATCOM_LNB_FAIL", "Low-noise block downconverter electrical burnout")
        fm.register_spof("HF_ANTENNA_MAST_DAMAGE", "High wind snapped HF antenna guy wire")

    def update(self, state: dict, sim_time=None, dt: int = 1):
        if dt <= 0: dt = 1
        
        env = state.get("environment", {})
        wind_speed = env.get("wind_speed_ms", 6.0)
        weather_state = env.get("weather_state", "CLEAR")
        
        fm = self.fault_manager
        icing_fault = fm.is_fault_active("SATCOM_RADOME_ICING")
        tracking_desync = fm.is_fault_active("SATCOM_TRACKING_DESYNC")
        lnb_fail = fm.is_fault_active("SATCOM_LNB_FAIL")
        hf_fail = fm.is_fault_active("HF_ANTENNA_MAST_DAMAGE")
        
        # 0. Power Grid Check
        grid_status = state.get("power", {}).get("grid_status", "NOMINAL")
        has_power = (grid_status != "BLACKOUT")
        
        if not has_power or lnb_fail > 0:
            self.link_state = "DOWN"
            self.carrier_to_noise_db = 0.0
            self.packet_loss_pct = 100.0
            self.latency_ms = 9999.0
            self.electrical_demand_kw = 0.0
            return self._build_telemetry(state)
            
        # 1. Radome Icing Physics
        if icing_fault > 0 or weather_state == "BLIZZARD":
            # Icing attenuation jumps up to 8 dB
            self.radome_ice_loss_db = min(8.5, self.radome_ice_loss_db + (0.05 * dt))
        else:
            self.radome_ice_loss_db = max(0.0, self.radome_ice_loss_db - (0.02 * dt))
            
        # 2. Tracking Servo Drift in High Winds
        pointing_loss_db = 0.0
        if tracking_desync > 0:
            pointing_loss_db = 6.0 * tracking_desync
        elif wind_speed > 25.0:
            # Mechanical wind buffeting
            pointing_loss_db = (wind_speed - 25.0) * 0.15
            
        # 3. Dynamic C/N Calculation
        nominal_cn = 14.5
        self.carrier_to_noise_db = max(2.0, nominal_cn - self.radome_ice_loss_db - pointing_loss_db + random.gauss(0, 0.15))
        
        # Link State Transitions
        if self.carrier_to_noise_db > 10.0:
            self.link_state = "UP"
            self.packet_loss_pct = max(0.1, 0.2 + random.gauss(0, 0.05))
            self.latency_ms = 620.0 + random.gauss(0, 10.0)
        elif self.carrier_to_noise_db > 6.5:
            self.link_state = "DEGRADED"
            self.packet_loss_pct = min(45.0, (10.0 - self.carrier_to_noise_db) * 12.0)
            self.latency_ms = 850.0 + (random.random() * 400.0)
        else:
            self.link_state = "DOWN"
            self.packet_loss_pct = 95.0
            self.latency_ms = 2500.0
            
        # 4. Tactical Field Radios
        self.hf_field_link_ok = (hf_fail == 0)
        self.novo_runway_vhf_ok = (wind_speed < 45.0) # Line of sight ok up to strong storms
        
        self.electrical_demand_kw = 2.8 + (1.5 if self.radome_ice_loss_db > 2.0 else 0.0) # Radome de-icing heater
        
        return self._build_telemetry(state)

    def _build_telemetry(self, state: dict):
        telemetry = {
            "satellite_link": {
                "earth_station": "MAITRI_GSAT7A_VSAT",
                "link_state": self.link_state,
                "carrier_to_noise_db": round(self.carrier_to_noise_db, 2),
                "latency_ms": round(self.latency_ms, 1),
                "packet_loss_pct": round(self.packet_loss_pct, 2),
                "radome_icing_attenuation_db": round(self.radome_ice_loss_db, 2),
                "uplink_kbps": self.uplink_kbps if self.link_state == "UP" else (1024.0 if self.link_state == "DEGRADED" else 0.0),
                "downlink_kbps": self.downlink_kbps if self.link_state == "UP" else (2048.0 if self.link_state == "DEGRADED" else 0.0)
            },
            "tactical_radios": {
                "hf_traverse_network": "ONLINE" if self.hf_field_link_ok else "OFFLINE_MAST_DAMAGED",
                "novo_runway_vhf_relay": "ONLINE" if self.novo_runway_vhf_ok else "DEGRADED_HIGH_WIND"
            },
            "electrical_demand_kw": round(self.electrical_demand_kw, 2)
        }
        state["communication"] = telemetry
        return telemetry
