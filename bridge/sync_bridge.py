import time
import json
import sqlite3
import urllib.request
import uuid
import os
from datetime import datetime, timezone, timedelta

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "backend", "cloud.db")
SIMULATOR_URL = "http://127.0.0.1:8001/state"
REPORT_DIR = os.path.join(PROJECT_ROOT, "reports")

os.makedirs(REPORT_DIR, exist_ok=True)

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def fetch_simulator_state():
    try:
        req = urllib.request.Request(SIMULATOR_URL)
        with urllib.request.urlopen(req, timeout=2) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return None

def generate_pdf_report(state, sim_time, conn, real_time_now, event_log):
    inventory = state.get("inventory", {})
    current_faults = state.get("faults", {})
    env = state.get("environment", {})
    pwr = state.get("power", {})
    fuel = state.get("fuel", {})
    water = state.get("water", {})
    
    had_critical_events = any(e['type'] == 'FAULT_DETECTED' for e in event_log)
    risk_level = "CRITICAL" if (current_faults or pwr.get("grid_status") == "BLACKOUT") else ("WARNING" if had_critical_events else "NOMINAL")
        
    report_id = str(uuid.uuid4())
    filename = f"NCPOR_RCA_Report_{sim_time.strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(REPORT_DIR, filename)
    
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    normal_style = styles['Normal']
    
    warning_style = ParagraphStyle('Warning', parent=styles['Normal'], textColor=colors.red, fontName='Helvetica-Bold')
    success_style = ParagraphStyle('Success', parent=styles['Normal'], textColor=colors.green, fontName='Helvetica-Bold')
    info_style = ParagraphStyle('Info', parent=styles['Normal'], textColor=colors.HexColor("#0284c7"))
    
    story = []
    
    # 1. Header
    story.append(Paragraph("BHARATI STATION: 3-HOUR COMPREHENSIVE REPORT", title_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"<b>Report ID:</b> {report_id}", normal_style))
    story.append(Paragraph(f"<b>End Timestamp (Simulator Time):</b> {sim_time.strftime('%Y-%m-%d %H:%M:%S UTC')}", normal_style))
    story.append(Paragraph(f"<b>Period Overall Status:</b> {risk_level}", warning_style if risk_level != "NOMINAL" else success_style))
    story.append(Spacer(1, 24))
    
    # 2. Critical Events Timeline
    story.append(Paragraph("1. Critical Events Timeline (Last 3 Hours)", styles['Heading2']))
    if event_log:
        data = [["Time", "Event Type", "Description"]]
        for event in event_log:
            data.append([event['time'], event['type'], event['desc']])
            
        t = Table(data, colWidths=[80, 120, 250])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#dc2626") if had_critical_events else colors.HexColor("#0b3b60")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#fef2f2") if had_critical_events else colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No critical events or faults occurred in the last 3 hours. Smooth operations.", success_style))
        
    story.append(Spacer(1, 24))
    
    # 3. Comprehensive Telemetry Snapshot
    story.append(Paragraph("2. Station Comprehensive Telemetry Snapshot", styles['Heading2']))
    
    chp1 = pwr.get("generators", {}).get("CHP-1", {})
    wind_kmh = env.get('wind_speed_ms', 0.0) * 3.6
    grid_status = pwr.get("grid_status", "NOMINAL")
    grid_voltage = pwr.get("grid_voltage", 0.0)
    grid_freq = pwr.get("grid_frequency", 0.0)
    
    telemetry_data = [
        ["Domain", "Metric", "Current Value", "Status"],
        ["Environment", "Ambient Temperature", f"{env.get('ambient_temperature_c', 0.0):.1f} °C", "NOMINAL"],
        ["Environment", "Wind Speed", f"{wind_kmh:.1f} km/h", "NOMINAL"],
        ["Power Grid", "Active Load (Gen 1)", f"{chp1.get('load_kw', 0.0):.1f} kW", "NOMINAL" if chp1.get("state") != "FAULT_SHUTDOWN" else "FAULT"],
        ["Power Grid", "Total Station Load", f"{pwr.get('total_load_kw', 0.0):.1f} kW", "NOMINAL"],
        ["Power Grid", "Grid Voltage / Freq", f"{grid_voltage:.1f}V / {grid_freq:.1f}Hz", "NOMINAL" if grid_status != "BLACKOUT" else "BLACKOUT"],
        ["Fuel Storage", "Main Farm Level", f"{fuel.get('main_farm_level_L', 0.0):.0f} L", "NOMINAL"],
        ["Water Systems", "Fresh Water Tank", f"{water.get('tank_level_L', 0.0):.0f} L", "NOMINAL"],
        ["Logistics", "Food Stock Remaining", f"{inventory.get('food_stock_kg', 0.0):.1f} kg", "NOMINAL"],
        ["Logistics", "Active Mechanic Repairs", f"{len(inventory.get('active_repairs', []))} Personnel", "NOMINAL"]
    ]
    
    t_tel = Table(telemetry_data, colWidths=[100, 150, 120, 80])
    t_tel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(t_tel)
    
    story.append(Spacer(1, 16))
    story.append(Paragraph("<i>Actionable Advice for NCPOR Goa HQ:</i> Please review the timeline and telemetry above. Any resolved faults indicate spare parts consumption. Replenish utilized assets on the next upcoming resupply manifest.", info_style))
    
    doc.build(story)
    
    cursor = conn.cursor()
    prediction_json = json.dumps({
        "event_log": event_log,
        "active_faults": current_faults,
        "report_file": filepath,
        "filename": filename
    })
    
    cursor.execute("""
        INSERT INTO ai_predictions 
        (prediction_id, station_id, model_name, target_metric, predicted_for_date, risk_level, predicted_json, confidence, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (report_id, "bharati", "3hr_anomaly_reporter", "station_health", sim_time.isoformat(), risk_level, prediction_json, 0.99, real_time_now))
    conn.commit()
    
    return filepath

def purge_old_data(conn, current_sim_time):
    cutoff_time = (current_sim_time - timedelta(days=3)).isoformat()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sensor_readings WHERE station_id = 'bharati' AND timestamp_utc < ?", (cutoff_time,))
    conn.commit()

def main():
    print("Starting Sync Bridge: 3-Hour Interval + Comprehensive Telemetry + 3-Day Retention")
    conn = get_db_connection()
    last_synced_time = None
    previous_faults = {}
    previous_grid_status = "NOMINAL"
    event_log = []
    
    while True:
        state = fetch_simulator_state()
        if not state:
            time.sleep(1)
            continue
            
        sim_time_str = state.get("timestamp")
        if not sim_time_str:
            time.sleep(1)
            continue
            
        sim_time = datetime.fromisoformat(sim_time_str.replace("Z", "+00:00"))
        
        if last_synced_time is None:
            last_synced_time = sim_time
            print(f"Baseline Time Locked: {sim_time}")
            
        # TRACK EVENTS (This runs every second to catch fast-forwarded anomalies)
        current_faults = state.get("faults", {})
        
        # Grid Status Tracking
        current_grid_status = state.get("power", {}).get("grid_status", "NOMINAL")
        if current_grid_status != previous_grid_status:
            if current_grid_status == "BLACKOUT":
                event_log.append({
                    "time": sim_time.strftime('%H:%M:%S'),
                    "type": "FAULT_DETECTED",
                    "desc": "CRITICAL: Complete Station Power BLACKOUT!"
                })
            elif previous_grid_status == "BLACKOUT":
                event_log.append({
                    "time": sim_time.strftime('%H:%M:%S'),
                    "type": "FAULT_RESOLVED",
                    "desc": "Power Grid Restored / Generators Online."
                })
            previous_grid_status = current_grid_status
        
        # Fault Tracking
        for f, severity in current_faults.items():
            if f not in previous_faults:
                event_log.append({
                    "time": sim_time.strftime('%H:%M:%S'),
                    "type": "FAULT_DETECTED",
                    "desc": f"Anomaly Triggered: {f} (Severity {severity:.2f})"
                })
        
        for f in previous_faults:
            if f not in current_faults:
                event_log.append({
                    "time": sim_time.strftime('%H:%M:%S'),
                    "type": "FAULT_RESOLVED",
                    "desc": f"Repaired/Resolved: {f}"
                })
                
        previous_faults = current_faults.copy()
        
        delta_seconds = (sim_time - last_synced_time).total_seconds()
        
        # GENERATE REPORT EXACTLY EVERY 3 SIMULATION HOURS
        if delta_seconds >= 10800:
            real_time_now = datetime.now(timezone.utc).isoformat()
            
            try:
                # --- TELEMETRY SYNC ---
                env = state.get("environment", {})
                pwr = state.get("power", {})
                fuel = state.get("fuel", {})
                chp1 = pwr.get("generators", {}).get("CHP-1", {})
                
                fuel_level = fuel.get("main_farm_level_L", 0)
                fuel_pct = min(100.0, max(0.0, (fuel_level / 350000.0) * 100))
                
                readings = [
                    ("bharati", "bharati.weather.aws1.temperature", "weather", "temperature", env.get("ambient_temperature_c", -10.0), "°C", "NOMINAL", "bharati.weather.aws1", real_time_now, False),
                    ("bharati", "bharati.weather.aws1.wind_speed", "weather", "wind_speed", env.get("wind_speed_ms", 0.0) * 3.6, "km/h", "NOMINAL", "bharati.weather.aws1", real_time_now, False),
                    ("bharati", "bharati.generator.gen1.kw_output", "energy", "kw_output", chp1.get("load_kw", 0.0), "kW", "NOMINAL", "bharati.generator.gen1", real_time_now, False),
                    ("bharati", "bharati.generator.gen1.fuel_pct", "energy", "fuel_pct", fuel_pct, "%", "NOMINAL", "bharati.generator.gen1", real_time_now, False)
                ]
                
                cursor = conn.cursor()
                cursor.executemany("""
                    INSERT INTO sensor_readings 
                    (station_id, sensor_id, domain, metric_name, value, unit, quality, asset_id, timestamp_utc, is_aggregate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, readings)
                
                # --- GENERATE REAL PDF REPORT WITH EVENT TIMELINE ---
                pdf_path = generate_pdf_report(state, sim_time, conn, real_time_now, event_log)
                
                cursor.execute("UPDATE station_connections SET last_heartbeat_at = ?, link_state = 'UP', services_healthy = 1 WHERE station_id = 'bharati'", (real_time_now,))
                
                # --- CLEANUP OLD DB DATA ---
                purge_old_data(conn, sim_time)
                
                print(f"[{real_time_now}] 3-Hour Sync Complete! Generated PDF with {len(event_log)} events.")
                
                # Reset for next 3 hours
                last_synced_time = sim_time
                event_log = [] # Clear the event log for the next 3-hour window
                
            except Exception as e:
                import traceback
                traceback.print_exc()
                conn.rollback()
                
        time.sleep(1)

if __name__ == "__main__":
    import sys
    if "--generate-now" in sys.argv:
        # On-demand generation
        print("Running on-demand PDF generation...")
        import urllib.request
        import json
        from datetime import datetime, timezone
        
        try:
            state = json.loads(urllib.request.urlopen("http://127.0.0.1:8001/state").read().decode())
            sim_time = datetime.fromisoformat(state["timestamp"].replace("Z", "+00:00"))
        except Exception as e:
            print(f"Failed to reach simulator: {e}")
            sys.exit(1)
            
        conn = get_db_connection()
        pdf_path = generate_pdf_report(state, sim_time, conn, datetime.now(timezone.utc).isoformat(), [{"time": sim_time.strftime('%H:%M:%S'), "type": "USER_TRIGGERED", "desc": "Manual on-demand report generation"}])
        print(f"ON_DEMAND_PDF:{pdf_path}")
        conn.close()
    else:
        main()
