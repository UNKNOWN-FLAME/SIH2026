import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from simulation.engine import SimulationEngine

app = FastAPI(
    title="Maitri Station Digital Twin API",
    description="Real-Time Telemetry & Fault Injection API for Maitri Antarctic Research Station",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine(use_real_clock=True, time_acceleration=1)

class FaultRequest(BaseModel):
    fault_id: str
    severity: float = 1.0

class RepairRequest(BaseModel):
    fault_id: str

@app.get("/health")
def health():
    return {"status": "ONLINE", "station": "MAITRI", "oasis": "Schirmacher"}

@app.get("/state")
def get_state():
    """Returns the latest multi-physics state across all 10 Maitri modules."""
    state_file = os.path.join(os.path.dirname(__file__), "current_state.json")
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return json.load(f)
        except Exception: pass
    return engine.step()

@app.post("/fault")
def inject_fault(req: FaultRequest):
    """Inject a physical fault or degradation into the Maitri Digital Twin."""
    if req.fault_id not in engine.fault_manager.registered_spofs:
        raise HTTPException(status_code=400, detail=f"Unknown fault ID: {req.fault_id}")
    engine.fault_manager.trigger(req.fault_id, req.severity)
    
    # Also append to pending_faults.json for standalone runner
    pending_file = os.path.join(os.path.dirname(__file__), "pending_faults.json")
    try:
        with open(pending_file, "a") as f:
            f.write(json.dumps({"fault_id": req.fault_id, "severity": req.severity}) + "\n")
    except Exception: pass
    
    return {"status": "FAULT_TRIGGERED", "fault_id": req.fault_id, "severity": req.severity}

@app.post("/repair")
def repair_fault(req: RepairRequest):
    """Resolve an active fault or dispatch work order."""
    engine.fault_manager.resolve(req.fault_id)
    return {"status": "FAULT_RESOLVED", "fault_id": req.fault_id}

@app.get("/spofs")
def list_spofs():
    """List all registered Single Points of Failure (SPOFs) for Maitri."""
    return engine.fault_manager.registered_spofs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8300)
