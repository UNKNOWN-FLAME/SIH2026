import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useAssets } from '../hooks/useAssets'

type StationId = 'maitri' | 'bharati'
type TabType = 'overview' | 'structural' | 'hvac' | 'comms' | 'safety'

function StatCard({ label, value, unit, icon, color, status }: { label: string; value: string | number; unit?: string; icon: string; color: string; status?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>{icon}</span>
      </div>
      <div style={{ marginLeft: 8, marginTop: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 3 }}>{unit}</span>}
      </div>
      {status && <div style={{ marginLeft: 8, marginTop: 4, fontSize: 10, fontWeight: 700, color: status === 'NOMINAL' ? '#16a34a' : status === 'WARNING' ? '#d97706' : '#dc2626' }}>{status}</div>}
    </div>
  )
}

export default function InfrastructurePage() {
  const navigate = useNavigate()
  const [activeStation, setActiveStation] = useState<StationId>('maitri')
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // ── Live asset data from Neon ─────────────────────────────────────────────
  const { data: assetData } = useAssets(activeStation)

  // Map DB Asset rows → the shape expected by JSX (add sensible fallbacks)
  const buildings = (assetData ?? []).map(a => ({
    id: a.asset_id,
    name: a.name,
    type: a.asset_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    area: a.elevation_m !== null ? `${a.elevation_m}m elev.` : 'N/A',
    floors: 1,
    stress: Math.round(Math.random() * 20 + 5),   // telemetry placeholder
    temp: a.latitude !== null ? Math.round(a.latitude * -0.1) : 0,
    status: (a.status === 'ACTIVE' ? 'NOMINAL' : a.status === 'UNDER_MAINTENANCE' ? 'WARNING' : 'CRITICAL') as 'NOMINAL' | 'WARNING' | 'CRITICAL',
    lastInspection: a.commissioned_at
      ? new Date(a.commissioned_at).toLocaleDateString('en-IN')
      : 'N/A',
  }))

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Twin Overview', icon: 'dashboard' },
    { id: 'structural', label: 'Structural Integrity', icon: 'foundation' },
    { id: 'hvac', label: 'HVAC & Life Support', icon: 'hvac' },
    { id: 'comms', label: 'Communications', icon: 'cell_tower' },
    { id: 'safety', label: 'Safety Systems', icon: 'emergency' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation(s => s === 'maitri' ? 'bharati' : 'maitri')} />
        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Home</button>
                <span>›</span><span style={{ color: '#ea580c', fontWeight: 800 }}>Infrastructure Twin</span>
              </div>
            </div>

            <div style={{ background: '#0b3b60', color: '#fff', padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>🏗️ {activeStation === 'maitri' ? 'MAITRI' : 'BHARATI'} — INFRASTRUCTURE DIGITAL TWIN</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{buildings.length} structures monitored • Real-time structural telemetry via IoT sensors</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['maitri', 'bharati'] as const).map(s => (
                  <button key={s} onClick={() => setActiveStation(s)} style={{ background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)', border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 12px', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>{s.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', marginBottom: 12, background: '#fff', padding: '0 8px' }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === tab.id ? 800 : 600, color: activeTab === tab.id ? '#0b3b60' : '#64748b', fontSize: 11, borderBottom: activeTab === tab.id ? '2px solid #0b3b60' : '2px solid transparent', marginBottom: -2 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  <StatCard label="Total Structures" value={buildings.length} icon="apartment" color="#0b3b60" status="NOMINAL" />
                  <StatCard label="Alerts Active" value={buildings.filter(b => b.status === 'WARNING').length} icon="warning" color="#d97706" status={buildings.some(b => b.status === 'WARNING') ? 'WARNING' : 'NOMINAL'} />
                  <StatCard label="Sensor Nodes" value={activeStation === 'maitri' ? 84 : 136} unit="online" icon="sensors" color="#16a34a" />
                  <StatCard label="Avg Indoor Temp" value={activeStation === 'maitri' ? '18.4' : '19.6'} unit="°C" icon="thermostat" color="#3b82f6" />
                  <StatCard label="Structural Health" value="96.2" unit="%" icon="health_and_safety" color="#16a34a" status="NOMINAL" />
                </div>

                {buildings.some(b => b.status === 'WARNING') && (
                  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: 18 }}>warning</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>STRUCTURAL ADVISORY: {buildings.find(b => b.status === 'WARNING')?.name} — Elevated structural stress detected. Inspection recommended within 48h.</span>
                  </div>
                )}

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#0b3b60', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>BUILDING INVENTORY — NCPOR STRUCTURAL TWIN</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>Last sync: 2 min ago</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          {['Structure ID', 'Building Name', 'Type', 'Floor Area', 'Floors', 'Structural Stress', 'Interior Temp', 'Status', 'Last Inspection'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buildings.map((b, i) => (
                          <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0b3b60' }}>{b.id}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{b.name}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{b.type}</td>
                            <td style={{ padding: '8px 12px' }}>{b.area}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>{b.floors}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: '#e2e8f0', maxWidth: 80 }}>
                                  <div style={{ height: '100%', width: `${b.stress}%`, background: b.stress > 30 ? '#dc2626' : b.stress > 20 ? '#d97706' : '#16a34a' }} />
                                </div>
                                <span style={{ fontWeight: 700, color: b.stress > 30 ? '#dc2626' : b.stress > 20 ? '#d97706' : '#16a34a' }}>{b.stress}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', color: b.temp < 0 ? '#3b82f6' : '#16a34a', fontWeight: 700 }}>{b.temp}°C</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ fontWeight: 800, fontSize: 10, color: b.status === 'NOMINAL' ? '#16a34a' : '#d97706', background: b.status === 'NOMINAL' ? '#f0fdf4' : '#fef3c7', padding: '2px 8px', border: `1px solid ${b.status === 'NOMINAL' ? '#bbf7d0' : '#fde68a'}` }}>{b.status}</span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{b.lastInspection}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'structural' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatCard label="Foundation Load" value="72.4" unit="kN/m²" icon="foundation" color="#0b3b60" status="NOMINAL" />
                  <StatCard label="Wind Load Factor" value="1.82" unit="" icon="air" color="#3b82f6" status="NOMINAL" />
                  <StatCard label="Snow Load" value="3.2" unit="kN/m²" icon="ac_unit" color="#06b6d4" status="NOMINAL" />
                  <StatCard label="Settlement" value="12" unit="mm" icon="height" color="#ea580c" status="NOMINAL" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>STRUCTURAL SENSOR READINGS — KEY POINTS</div>
                    {[{ loc: 'Main Beam — Span Centre', strain: 182, limit: 250, temp: -1.2 },{ loc: 'Corner Column NE', strain: 98, limit: 300, temp: -3.4 },{ loc: 'Roof Truss — West', strain: 213, limit: 250, temp: -8.1 },{ loc: 'Foundation Slab A', strain: 44, limit: 200, temp: -4.2 },{ loc: 'Met Tower Base', strain: 221, limit: 260, temp: -18.2 }].map(s => (
                      <div key={s.loc} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{s.loc}</span>
                          <span style={{ fontWeight: 800, color: s.strain / s.limit > 0.85 ? '#dc2626' : s.strain / s.limit > 0.7 ? '#d97706' : '#16a34a' }}>{s.strain} / {s.limit} μϵ</span>
                        </div>
                        <div style={{ height: 5, background: '#e2e8f0' }}>
                          <div style={{ height: '100%', width: `${(s.strain / s.limit) * 100}%`, background: s.strain / s.limit > 0.85 ? '#dc2626' : s.strain / s.limit > 0.7 ? '#f59e0b' : '#16a34a', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>INSPECTION HISTORY & UPCOMING</div>
                    {[{ date: '2026-08-20', type: 'Routine Structural', inspector: 'Er. S. Kumar', result: 'PASS', next: '2026-11-20' },{ date: '2026-07-15', type: 'Annual Comprehensive', inspector: 'NCPOR Team', result: 'PASS', next: '2027-07-15' },{ date: '2026-05-10', type: 'Foundation Check', inspector: 'CPWD Deputation', result: 'PASS', next: '2027-05-10' },{ date: '2026-08-22', type: 'Met Tower Inspection', inspector: 'Er. P. Nair', result: 'ADVISORY', next: '2026-09-05' }].map(ins => (
                      <div key={ins.date} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontWeight: 800, color: '#0b3b60' }}>{ins.date}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: ins.result === 'PASS' ? '#16a34a' : '#d97706', background: ins.result === 'PASS' ? '#f0fdf4' : '#fef3c7', padding: '1px 6px', border: `1px solid ${ins.result === 'PASS' ? '#bbf7d0' : '#fde68a'}` }}>{ins.result}</span>
                        </div>
                        <div style={{ color: '#475569' }}>{ins.type}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10 }}>{ins.inspector} • Next: {ins.next}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'hvac' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatCard label="Living Quarters Temp" value="18.4" unit="°C" icon="thermostat" color="#16a34a" status="NOMINAL" />
                  <StatCard label="Lab Block Temp" value="20.1" unit="°C" icon="science" color="#3b82f6" status="NOMINAL" />
                  <StatCard label="O₂ Concentration" value="20.9" unit="%" icon="air" color="#06b6d4" status="NOMINAL" />
                  <StatCard label="CO₂ Indoor" value="812" unit="ppm" icon="co2" color="#d97706" status="NOMINAL" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>HVAC UNIT STATUS — {activeStation.toUpperCase()}</div>
                    {[{ name: 'HVAC Unit 1 (Living)', status: 'RUNNING', setpoint: 19, actual: 18.4, mode: 'Heating', efficiency: 94 },{ name: 'HVAC Unit 2 (Labs)', status: 'RUNNING', setpoint: 20, actual: 20.1, mode: 'Heating', efficiency: 91 },{ name: 'HVAC Unit 3 (Generator)', status: 'COOLING', setpoint: 28, actual: 28.6, mode: 'Ventilation', efficiency: 88 },{ name: 'Emergency Backup HVAC', status: 'STANDBY', setpoint: 18, actual: 18.0, mode: 'Standby', efficiency: 0 }].map(h => (
                      <div key={h.name} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ fontWeight: 700 }}>{h.name}</span>
                          <span style={{ fontWeight: 800, fontSize: 10, color: h.status === 'RUNNING' ? '#16a34a' : h.status === 'STANDBY' ? '#64748b' : '#3b82f6', background: '#f8fafc', padding: '1px 6px', border: '1px solid #e2e8f0' }}>{h.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#64748b', marginTop: 4 }}>
                          <span>Setpoint: <strong>{h.setpoint}°C</strong></span>
                          <span>Actual: <strong style={{ color: '#0b3b60' }}>{h.actual}°C</strong></span>
                          <span>Mode: <strong>{h.mode}</strong></span>
                          {h.efficiency > 0 && <span>Eff: <strong style={{ color: '#16a34a' }}>{h.efficiency}%</strong></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>AIR QUALITY & LIFE SUPPORT MONITORING</div>
                    {[{ param: 'Oxygen (O₂)', value: '20.9%', normal: '20.9%', status: 'NOMINAL', icon: 'air' },{ param: 'CO₂ (Indoor)', value: '812 ppm', normal: '<1000 ppm', status: 'NOMINAL', icon: 'co2' },{ param: 'CO (Carbon Monoxide)', value: '2 ppm', normal: '<9 ppm', status: 'NOMINAL', icon: 'warning' },{ param: 'NO₂ (from generators)', value: '0.04 ppm', normal: '<0.1 ppm', status: 'NOMINAL', icon: 'factory' },{ param: 'Relative Humidity', value: '42%', normal: '35-55%', status: 'NOMINAL', icon: 'water_drop' },{ param: 'Particulates (PM2.5)', value: '8 μg/m³', normal: '<25 μg/m³', status: 'NOMINAL', icon: 'blur_on' }].map(a => (
                      <div key={a.param} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748b' }}>{a.icon}</span>
                          <span>{a.param}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{a.value}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>({a.normal})</span>
                          <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 800 }}>✓</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'comms' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatCard label="VSAT Link" value="ACTIVE" icon="satellite_alt" color="#16a34a" status="NOMINAL" />
                  <StatCard label="Link Bandwidth" value={activeStation === 'maitri' ? '2.1' : '4.8'} unit="Mbps" icon="speed" color="#3b82f6" />
                  <StatCard label="Signal Margin" value={activeStation === 'maitri' ? '8.4' : '14.2'} unit="dB" icon="signal_cellular_alt" color="#0b3b60" />
                  <StatCard label="Latency" value={activeStation === 'maitri' ? '640' : '780'} unit="ms" icon="network_ping" color="#ea580c" />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>COMMUNICATIONS SYSTEMS STATUS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {[{ name: 'Primary VSAT (GSAT-14)', type: 'Satellite', freq: 'Ku-band 14/12 GHz', status: 'ACTIVE', uptime: '99.1%', provider: 'ISRO / Inmarsat' },{ name: 'Backup VSAT (Inmarsat)', type: 'Satellite', freq: 'L-band 1.6/1.5 GHz', status: 'STANDBY', uptime: '99.8%', provider: 'Inmarsat' },{ name: 'HF Radio (NCPOR Net)', type: 'HF Radio', freq: '7-22 MHz', status: 'ACTIVE', uptime: '98.2%', provider: 'NCPOR' },{ name: 'Iridium NEXT SBD', type: 'Satellite', freq: 'L-band 1618-1626 MHz', status: 'ACTIVE', uptime: '99.9%', provider: 'Iridium' }].map(c => (
                      <div key={c.name} style={{ border: '1px solid #e2e8f0', padding: '12px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, color: '#0b3b60', fontSize: 11 }}>{c.name}</span>
                          <span style={{ fontWeight: 800, fontSize: 10, color: c.status === 'ACTIVE' ? '#16a34a' : '#64748b', background: c.status === 'ACTIVE' ? '#f0fdf4' : '#f8fafc', padding: '2px 8px', border: `1px solid ${c.status === 'ACTIVE' ? '#bbf7d0' : '#e2e8f0'}` }}>● {c.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                          <div><span style={{ color: '#94a3b8' }}>Type: </span><span style={{ fontWeight: 700 }}>{c.type}</span></div>
                          <div><span style={{ color: '#94a3b8' }}>Uptime: </span><span style={{ fontWeight: 700, color: '#16a34a' }}>{c.uptime}</span></div>
                          <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#94a3b8' }}>Frequency: </span><span style={{ fontWeight: 700 }}>{c.freq}</span></div>
                          <div><span style={{ color: '#94a3b8' }}>Provider: </span><span style={{ fontWeight: 700 }}>{c.provider}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'safety' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatCard label="Fire Systems" value="ALL OK" icon="local_fire_department" color="#16a34a" status="NOMINAL" />
                  <StatCard label="Smoke Detectors" value={activeStation === 'maitri' ? '24/24' : '48/48'} unit="online" icon="detector_smoke" color="#3b82f6" />
                  <StatCard label="Emergency Exits" value="CLEAR" icon="emergency_home" color="#16a34a" status="NOMINAL" />
                  <StatCard label="Last Fire Drill" value="14 days" unit="ago" icon="calendar_month" color="#ea580c" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>FIRE & EMERGENCY DETECTION SYSTEMS</div>
                    {[{ zone: 'Zone A — Living Quarters', detectors: 8, sprinklers: 12, co2: 4, status: 'ALL CLEAR' },{ zone: 'Zone B — Laboratories', detectors: 10, sprinklers: 16, co2: 6, status: 'ALL CLEAR' },{ zone: 'Zone C — Generator Hall', detectors: 4, sprinklers: 8, co2: 12, status: 'ALL CLEAR' },{ zone: 'Zone D — Workshop', detectors: 2, sprinklers: 4, co2: 2, status: 'ALL CLEAR' }].map(z => (
                      <div key={z.zone} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{z.zone}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', border: '1px solid #bbf7d0' }}>{z.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748b' }}>
                          <span>🔔 Smoke: {z.detectors}</span>
                          <span>🚿 Sprinklers: {z.sprinklers}</span>
                          <span>🧯 CO₂ Extinguishers: {z.co2}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>EMERGENCY PROTOCOLS & EQUIPMENT</div>
                    {[{ item: 'Emergency Power Generator', quantity: 2, status: 'READY', lastCheck: '2026-08-28' },{ item: 'Avalanche Rescue Kit', quantity: 3, status: 'READY', lastCheck: '2026-08-15' },{ item: 'Medical Emergency Cabinet', quantity: 2, status: 'READY', lastCheck: '2026-08-20' },{ item: 'EPIRBs (Personal Locators)', quantity: activeStation === 'maitri' ? 28 : 44, status: 'CHARGED', lastCheck: '2026-09-01' },{ item: 'Survival Suits (Polar)', quantity: activeStation === 'maitri' ? 32 : 50, status: 'READY', lastCheck: '2026-08-01' }].map(e => (
                      <div key={e.item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                        <div><div style={{ fontWeight: 700, color: '#1e293b' }}>{e.item}</div><div style={{ fontSize: 9, color: '#94a3b8' }}>Qty: {e.quantity} • Checked: {e.lastCheck}</div></div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', border: '1px solid #bbf7d0' }}>{e.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
