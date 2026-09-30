import time
import os
import sys
import json
from datetime import datetime
from simulation.engine import SimulationEngine

# ANSI Color Codes
class C:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def clear_console():
    os.system('cls' if os.name == 'nt' else 'clear')

def format_value(v):
    if isinstance(v, float):
        return f"{v:,.2f}"
    return str(v)

def print_module_dynamic(title, data_dict, color):
    print(f"{color}{C.BOLD}>> {title.upper()} MODULE TELEMETRY <<{C.RESET}")
    if not data_dict:
        print("  [No telemetry available]")
        return
        
    def walk_dict(d, indent=2):
        for k, v in d.items():
            k_str = str(k).replace("_", " ").title()
            if isinstance(v, dict):
                print(" " * indent + f"{C.BOLD}[{k_str}]{C.RESET}")
                walk_dict(v, indent + 4)
            else:
                unit = ""
                k_low = k.lower()
                if "temp" in k_low or "chill" in k_low: unit = " °C"
                elif "kw" in k_low or "power" in k_low: unit = " kW"
                elif "l_s" in k_low or "flow" in k_low: unit = " L/s"
                elif "wm2" in k_low or "radiation" in k_low: unit = " W/m²"
                elif "pct" in k_low or "percent" in k_low: unit = " %"
                elif "ppm" in k_low: unit = " PPM"
                elif "bar" in k_low or "pressure" in k_low: unit = " bar"
                elif "ms" in k_low and "speed" in k_low: unit = " m/s"
                elif "mms" in k_low or "vibration" in k_low: unit = " mm/s"
                
                val_str = format_value(v)
                print(" " * indent + f"{k_str:<32} : {C.CYAN}{val_str}{unit}{C.RESET}")

    walk_dict(data_dict)
    print("-" * 80)

def main():
    print(f"{C.CYAN}Initializing Ultra-High Fidelity 10-Module Maitri Digital Twin...{C.RESET}")
    engine = SimulationEngine(use_real_clock=True, time_acceleration=1)
    
    try:
        while True:
            # Check for incoming fault injection requests from UI or CLI
            pending_file = os.path.join(os.path.dirname(__file__), "pending_faults.json")
            try:
                if os.path.exists(pending_file):
                    with open(pending_file, "r") as f:
                        lines = f.readlines()
                    os.remove(pending_file)
                    for line in lines:
                        if line.strip():
                            req = json.loads(line)
                            if req.get("is_work_order"):
                                engine.inventory_model.dispatch_work_order(req["fault_id"], engine.state)
                            else:
                                engine.fault_manager.trigger(req["fault_id"], req.get("severity", 1.0))
            except Exception: pass
            
            state = engine.step()
            
            # Dump live state for external SCADA UI and API consumption
            state_file = os.path.join(os.path.dirname(__file__), "current_state.json")
            try:
                with open(state_file, "w") as f:
                    json.dump(state, f, indent=2)
            except Exception: pass
            
            clear_console()
            
            print(f"{C.BOLD}{C.CYAN}" + "="*80)
            print(f"       MAITRI STATION DIGITAL TWIN - REAL-TIME TELEMETRY ENGINE (SCHIRMACHER)       ")
            print("="*80 + f"{C.RESET}")
            print(f"{C.YELLOW}System Timestamp:{C.RESET} {state.get('timestamp')}  |  {C.YELLOW}Engine Tick:{C.RESET} {engine.tick_count}\n")
            
            if "environment" in state: print_module_dynamic("Schirmacher Oasis Environment", state["environment"], C.CYAN)
            if "power" in state: print_module_dynamic("100 kVA DG Sets & Solar PV Grid", state["power"], C.YELLOW)
            if "hvac" in state: print_module_dynamic("Oil Boilers & Hydronic Heating", state["hvac"], C.BLUE)
            if "water" in state: print_module_dynamic("Lake Priyadarshini & 250m Pipeline", state["water"], C.CYAN)
            if "fuel" in state: print_module_dynamic("Bulk Fuel Farm (165k L) & Day Tank", state["fuel"], C.RED)
            if "wastewater" in state: print_module_dynamic("Biological STP & Incinerator", state["wastewater"], C.GREEN)
            if "human" in state: print_module_dynamic("Expedition Crew Demographics", state["human"], C.MAGENTA)
            if "vehicles" in state: print_module_dynamic("PistenBully Fleet & Block Heaters", state["vehicles"], C.BLUE)
            if "communication" in state: print_module_dynamic("GSAT-7A Satcom & HF Radio", state["communication"], C.CYAN)
            if "inventory" in state: print_module_dynamic("Spares & Weibull Reliability", state["inventory"], C.YELLOW)
            
            # Active Alarms
            faults = state.get("faults", {})
            print(f"{C.RED}{C.BOLD}>> ACTIVE ALARMS & FAULT STATUS <<{C.RESET}")
            if not faults:
                print(f"  {C.GREEN}[SYSTEM NOMINAL] All 10 Maitri subsystems healthy.{C.RESET}")
            else:
                for f, sev in faults.items():
                    print(f"  {C.RED}>> CRITICAL ALARM: {f} | Severity: {sev}{C.RESET}")
                    
            print(f"\n{C.BOLD}" + "="*80 + f"{C.RESET}")
            print(f"{C.YELLOW}Press CTRL+C to halt simulation.{C.RESET}")
            
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        print(f"\n{C.RED}Maitri simulation halted.{C.RESET}")
        sys.exit(0)

if __name__ == "__main__":
    main()
