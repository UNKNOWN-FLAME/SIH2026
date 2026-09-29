"""Bharati Digital Twin Service for Himantar Cloud.

Bridges the ultra-high-fidelity 10-module Bharati physics simulator to the FastAPI
Cloud backend and React frontend dashboard:
- Environment & Meteorology
- Power Grid & BESS
- HVAC Thermodynamics & Zone AHUs
- Fuel (ATF) & Viscosity
- Water & RO Desalination
- Wastewater & MBR Bioreactor
- Human Asset & Physiology
- Vehicle Fleet (PistenBully & Snowmobiles)
- Communication Link & SAN
- Inventory & Weibull Asset Reliability
- Real-Time Fault Injection & MTTR Work Order Dispatch
"""
from __future__ import annotations

import os
import sys
import json
import time
import asyncio
import structlog
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = structlog.get_logger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
BHARATI_DIR = os.path.join(PROJECT_ROOT, "bharati")
CURRENT_STATE_FILE = os.path.join(BHARATI_DIR, "current_state.json")
PENDING_FAULTS_FILE = os.path.join(BHARATI_DIR, "pending_faults.json")

if BHARATI_DIR not in sys.path:
    sys.path.insert(0, BHARATI_DIR)

try:
    from simulation.engine import SimulationEngine
except ImportError:
    SimulationEngine = None


class DigitalTwinService:
    _instance: Optional[DigitalTwinService] = None

    def __init__(self):
        self._engine: Optional[Any] = None
        self._last_state: Optional[Dict[str, Any]] = None
        self._last_step_time: float = 0.0
        self._init_engine()

    @classmethod
    def get_instance(cls) -> DigitalTwinService:
        if cls._instance is None:
            cls._instance = DigitalTwinService()
        return cls._instance

    def _init_engine(self):
        if SimulationEngine is not None:
            try:
                self._engine = SimulationEngine(use_real_clock=True, time_acceleration=1)
                log.info("digital_twin.engine_initialized")
            except Exception as exc:
                log.error("digital_twin.engine_init_failed", error=str(exc))

    def get_state(self, station_id: str = "bharati") -> Dict[str, Any]:
        """Returns real-time 10-module telemetry state for the station."""
        sid = station_id.lower()

        # 1. Check if current_state.json was updated by an active run_simulation.py process in last 5s
        if os.path.exists(CURRENT_STATE_FILE):
            try:
                mtime = os.path.getmtime(CURRENT_STATE_FILE)
                if time.time() - mtime < 10.0:
                    with open(CURRENT_STATE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict) and "environment" in data:
                        self._last_state = data
                        return data
            except Exception as exc:
                log.warning("digital_twin.read_current_state_file_failed", error=str(exc))

        # 2. Advance the in-process SimulationEngine step if at least 0.5s has elapsed
        now = time.time()
        if self._engine is not None and (now - self._last_step_time >= 0.5 or self._last_state is None):
            try:
                self._last_state = self._engine.step()
                self._last_step_time = now
                # Persist snapshot so any external watcher stays synchronized
                try:
                    with open(CURRENT_STATE_FILE, "w", encoding="utf-8") as f:
                        json.dump(self._last_state, f)
                except Exception:
                    pass
                return self._last_state
            except Exception as exc:
                log.error("digital_twin.engine_step_failed", error=str(exc))

        if self._last_state is not None:
            return self._last_state

        # 3. Fallback state snapshot if file and engine are both unavailable
        return {
            "station": sid.upper(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "INITIALIZING",
            "environment": {
                "ambient_temperature_c": -16.5,
                "wind_chill_c": -28.2,
                "wind_speed_ms": 12.4,
                "pressure_hpa": 988.5,
                "humidity_percent": 75.0,
                "solar_radiation_wm2": 190.0,
            },
            "power": {
                "grid_status": "NOMINAL",
                "grid_voltage": 400.0,
                "grid_frequency": 50.0,
                "total_load_kw": 145.0,
                "total_thermal_supplied_kw": 180.0,
                "generators": {
                    "CHP-1": {"state": "RUNNING", "load_kw": 85.0, "coolant_temp_c": 88.5, "vibration_mms": 0.05},
                    "CHP-2": {"state": "STANDBY", "load_kw": 60.0, "coolant_temp_c": 84.0, "vibration_mms": 0.04},
                }
            },
            "fuel": {"main_farm_level_L": 210500.0, "day_tank_level_L": 1950.0, "autonomy_days": 165.0},
            "water": {"tank_level_L": 14850.0, "tank_ph": 7.3, "permeate_tds_ppm": 195},
            "faults": {},
        }

    def trigger_fault(self, fault_id: str, severity: float = 1.0, station_id: str = "bharati") -> Dict[str, Any]:
        """Inject physical fault into Bharati Digital Twin."""
        # 1. Trigger in-memory engine
        if self._engine is not None:
            self._engine.fault_manager.trigger(fault_id, severity)

        # 2. Append to pending_faults.json for any standalone runner
        try:
            with open(PENDING_FAULTS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps({"fault_id": fault_id, "severity": severity}) + "\n")
        except Exception:
            pass

        log.info("digital_twin.fault_injected", fault_id=fault_id, severity=severity)
        return {
            "status": "success",
            "station_id": station_id.lower(),
            "fault_id": fault_id,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def dispatch_work_order(self, fault_id: str, station_id: str = "bharati") -> Dict[str, Any]:
        """Dispatch mechanic repair team to clear a fault."""
        success = True
        if self._engine is not None:
            success = self._engine.inventory_model.dispatch_work_order(fault_id, self._engine.state)

        try:
            with open(PENDING_FAULTS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps({"fault_id": fault_id, "is_work_order": True}) + "\n")
        except Exception:
            pass

        return {
            "status": "success" if success else "failed",
            "station_id": station_id.lower(),
            "fault_id": fault_id,
            "message": f"Work order dispatched for {fault_id}" if success else "Work order rejected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_registered_spofs(self) -> List[Dict[str, Any]]:
        """Return list of all registered Single Points of Failure."""
        if self._engine is not None:
            return self._engine.fault_manager.registered_spofs
        return []
