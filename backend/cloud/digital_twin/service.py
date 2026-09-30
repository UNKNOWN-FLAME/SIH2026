"""Antarctic Research Stations Digital Twin Service for Himantar Cloud.

Bridges the ultra-high-fidelity 10-module physics simulators for both
Bharati and Maitri stations to the FastAPI Cloud backend and React frontend dashboard:
- Environment & Meteorology (Schirmacher Oasis vs Larsemann Hills)
- Power Grid (Maitri 3x 100kVA DG + Solar PV vs Bharati 3x CHP)
- HVAC Thermodynamics (Maitri Oil Boilers vs Bharati CHP Heat Recovery)
- Fuel Farm & Viscosity (Maitri 165k L vs Bharati 250k L)
- Water Lifecycle (Maitri Lake Priyadarshini 250m heat-traced pipe vs Bharati Seawater RO)
- Wastewater (Maitri Heated STP + Incinerator vs Bharati MBR)
- Human Asset & Physiology
- Vehicle Fleet (PistenBully & Snowmobiles with 230V block heaters)
- Satellite Comms & SAN Link
- Inventory & Weibull Asset Reliability
- Real-Time Fault Injection & MTTR Work Order Dispatch
"""
from __future__ import annotations

import os
import sys
import json
import time
import importlib.util
import structlog
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = structlog.get_logger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

STATION_CONFIGS: Dict[str, Dict[str, str]] = {
    "bharati": {
        "dir": os.path.join(PROJECT_ROOT, "bharati"),
        "state_file": os.path.join(PROJECT_ROOT, "bharati", "current_state.json"),
        "faults_file": os.path.join(PROJECT_ROOT, "bharati", "pending_faults.json"),
    },
    "maitri": {
        "dir": os.path.join(PROJECT_ROOT, "maitri"),
        "state_file": os.path.join(PROJECT_ROOT, "maitri", "current_state.json"),
        "faults_file": os.path.join(PROJECT_ROOT, "maitri", "pending_faults.json"),
    },
}


def _load_engine_class(station_key: str, station_dir: str):
    """Dynamically load the SimulationEngine for a specific station to prevent package collisions."""
    engine_path = os.path.join(station_dir, "simulation", "engine.py")
    if not os.path.exists(engine_path):
        return None

    # Purge any previously loaded simulation modules so each station loads its own physics models
    for mod_key in list(sys.modules.keys()):
        if mod_key == "simulation" or mod_key.startswith("simulation."):
            del sys.modules[mod_key]

    saved_path = list(sys.path)
    if station_dir not in sys.path:
        sys.path.insert(0, station_dir)
    try:
        module_name = f"{station_key}_simulation_engine"
        spec = importlib.util.spec_from_file_location(module_name, engine_path)
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)
            return getattr(mod, "SimulationEngine", None)
    except Exception as exc:
        log.error("digital_twin.engine_import_failed", station=station_key, error=str(exc))
        return None
    finally:
        sys.path = saved_path
    return None


class DigitalTwinService:
    _instance: Optional[DigitalTwinService] = None

    def __init__(self):
        self._engines: Dict[str, Any] = {}
        self._last_states: Dict[str, Optional[Dict[str, Any]]] = {
            "bharati": None,
            "maitri": None,
        }
        self._last_step_times: Dict[str, float] = {
            "bharati": 0.0,
            "maitri": 0.0,
        }
        self._init_engines()

    @classmethod
    def get_instance(cls) -> DigitalTwinService:
        if cls._instance is None:
            cls._instance = DigitalTwinService()
        return cls._instance

    def _init_engines(self):
        for sid, conf in STATION_CONFIGS.items():
            engine_cls = _load_engine_class(sid, conf["dir"])
            if engine_cls is not None:
                try:
                    self._engines[sid] = engine_cls(use_real_clock=True, time_acceleration=1)
                    log.info("digital_twin.engine_initialized", station=sid)
                except Exception as exc:
                    log.error("digital_twin.engine_init_failed", station=sid, error=str(exc))

    def get_state(self, station_id: str = "bharati") -> Dict[str, Any]:
        """Returns real-time 10-module telemetry state for the station."""
        sid = station_id.lower()
        if sid not in STATION_CONFIGS:
            sid = "bharati"

        conf = STATION_CONFIGS[sid]
        state_file = conf["state_file"]

        # 1. Check if current_state.json was updated by an active standalone process in last 10s
        if os.path.exists(state_file):
            try:
                mtime = os.path.getmtime(state_file)
                if time.time() - mtime < 10.0:
                    with open(state_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict) and "environment" in data:
                        if data.get("station", "").upper() == sid.upper():
                            self._last_states[sid] = data
                            return data
            except Exception as exc:
                log.warning("digital_twin.read_current_state_file_failed", station=sid, error=str(exc))

        # 2. Advance the in-process SimulationEngine step if at least 0.5s has elapsed
        now = time.time()
        engine = self._engines.get(sid)
        if engine is not None and (now - self._last_step_times[sid] >= 0.5 or self._last_states[sid] is None):
            try:
                new_state = engine.step()
                self._last_states[sid] = new_state
                self._last_step_times[sid] = now
                # Persist snapshot so any external watcher stays synchronized
                try:
                    with open(state_file, "w", encoding="utf-8") as f:
                        json.dump(new_state, f, indent=2)
                except Exception:
                    pass
                return new_state
            except Exception as exc:
                log.error("digital_twin.engine_step_failed", station=sid, error=str(exc))

        if self._last_states[sid] is not None:
            return self._last_states[sid]

        # 3. Read cached state_file if exists even if older
        if os.path.exists(state_file):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and "environment" in data:
                    if data.get("station", "").upper() == sid.upper():
                        self._last_states[sid] = data
                        return data
            except Exception:
                pass

        # 4. Fallback state snapshot if file and engine are both unavailable
        return self._generate_fallback_state(sid)

    def _generate_fallback_state(self, sid: str) -> Dict[str, Any]:
        """Generates physics-aligned baseline fallback when uninitialized."""
        is_maitri = sid == "maitri"
        now_iso = datetime.now(timezone.utc).isoformat()
        if is_maitri:
            return {
                "station": "MAITRI",
                "timestamp": now_iso,
                "status": "NOMINAL",
                "environment": {
                    "station": "MAITRI",
                    "ambient_temperature_c": -24.3,
                    "wind_chill_c": -34.8,
                    "wind_speed_ms": 5.8,
                    "wind_speed_kmh": 20.9,
                    "atmospheric_pressure_hpa": 968.1,
                    "relative_humidity_pct": 71.0,
                    "solar_radiation_wm2": 0.0,
                    "lake_priyadarshini": {
                        "water_temp_c": 2.4,
                        "ice_thickness_m": 1.4,
                        "is_frozen_over": True,
                    },
                },
                "power": {
                    "grid_status": "NOMINAL",
                    "total_station_load_kw": 42.0,
                    "solar_pv": {"current_output_kw": 0.0},
                    "battery_ups": {"battery_soc_pct": 98.0},
                    "generators": {
                        "DG-1": {"state": "RUNNING", "load_kw": 42.0, "coolant_temp_c": 86.0, "vibration_mms": 0.05, "oil_pressure_bar": 4.5},
                        "DG-2": {"state": "STANDBY", "load_kw": 0.0, "coolant_temp_c": 45.0, "vibration_mms": 0.0},
                        "DG-3": {"state": "OFF_COLD_RESERVE", "load_kw": 0.0},
                    },
                },
                "hvac": {
                    "boiler_firing_rate_pct": 55.0,
                    "primary_supply_temp_c": 80.0,
                    "primary_return_temp_c": 64.0,
                    "living_zone_temp_c": 21.4,
                    "indoor_co2_ppm": 420.0,
                },
                "fuel": {"main_farm_level_L": 142500.0, "day_tank_litres": 2200.0, "fuel_autonomy_days": 214.0},
                "water": {
                    "potable_storage_litres": 14800.0,
                    "pipeline_250m": {"water_temp_c": 8.5, "is_frozen": False},
                },
                "faults": {},
            }
        else:
            return {
                "station": "BHARATI",
                "timestamp": now_iso,
                "status": "NOMINAL",
                "environment": {
                    "ambient_temperature_c": -14.2,
                    "wind_chill_c": -22.4,
                    "wind_speed_ms": 4.8,
                    "wind_speed_kmh": 17.3,
                    "pressure_hpa": 963.9,
                    "atmospheric_pressure_hpa": 963.9,
                    "humidity_percent": 55.0,
                    "relative_humidity_pct": 55.0,
                    "solar_radiation_wm2": 41.0,
                },
                "power": {
                    "grid_status": "NOMINAL",
                    "grid_voltage": 400.0,
                    "grid_frequency": 50.0,
                    "total_load_kw": 25.0,
                    "total_thermal_supplied_kw": 75.0,
                    "solar_pv": {"current_output_kw": 14.0},
                    "battery_ups": {"battery_soc_pct": 98.0},
                    "generators": {
                        "CHP-1": {"state": "RUNNING", "load_kw": 25.0, "coolant_temp_c": 88.5, "vibration_mms": 0.05},
                        "CHP-2": {"state": "STANDBY", "load_kw": 0.0, "coolant_temp_c": 84.0, "vibration_mms": 0.04},
                    },
                },
                "fuel": {"main_farm_level_L": 210000.0, "day_tank_level_L": 1950.0, "autonomy_days": 240.0, "fuel_autonomy_days": 240.0},
                "water": {"tank_level_L": 14200.0, "potable_storage_litres": 14200.0, "tank_ph": 7.3, "permeate_tds_ppm": 42},
                "faults": {},
            }

    def trigger_fault(self, fault_id: str, severity: float = 1.0, station_id: str = "bharati") -> Dict[str, Any]:
        """Inject physical fault into station's Digital Twin."""
        sid = station_id.lower()
        if sid not in STATION_CONFIGS:
            sid = "bharati"
        conf = STATION_CONFIGS[sid]

        # 1. Trigger in-memory engine
        engine = self._engines.get(sid)
        if engine is not None:
            engine.fault_manager.trigger(fault_id, severity)

        # 2. Append to pending_faults.json for any standalone runner
        try:
            with open(conf["faults_file"], "a", encoding="utf-8") as f:
                f.write(json.dumps({"fault_id": fault_id, "severity": severity}) + "\n")
        except Exception:
            pass

        log.info("digital_twin.fault_injected", station=sid, fault_id=fault_id, severity=severity)
        return {
            "status": "success",
            "station_id": sid,
            "fault_id": fault_id,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def dispatch_work_order(self, fault_id: str, station_id: str = "bharati") -> Dict[str, Any]:
        """Dispatch mechanic repair team to clear a fault."""
        sid = station_id.lower()
        if sid not in STATION_CONFIGS:
            sid = "bharati"
        conf = STATION_CONFIGS[sid]

        success = True
        engine = self._engines.get(sid)
        if engine is not None:
            success = engine.inventory_model.dispatch_work_order(fault_id, engine.state)

        try:
            with open(conf["faults_file"], "a", encoding="utf-8") as f:
                f.write(json.dumps({"fault_id": fault_id, "is_work_order": True}) + "\n")
        except Exception:
            pass

        return {
            "status": "success" if success else "failed",
            "station_id": sid,
            "fault_id": fault_id,
            "message": f"Work order dispatched for {fault_id}" if success else "Work order rejected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_registered_spofs(self, station_id: str = "bharati") -> List[Dict[str, Any]]:
        """Return list of all registered Single Points of Failure for the station."""
        sid = station_id.lower()
        engine = self._engines.get(sid)
        if engine is not None:
            return engine.fault_manager.registered_spofs
        return []
