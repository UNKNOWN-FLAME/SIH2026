import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'

export default function EnergyPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [activeStation, setActiveStation] = useState<'maitri' | 'bharati'>('maitri')
  const [activeTab, setActiveTab] = useState<'overview' | 'generators' | 'fuel' | 'microgrid' | 'prediction'>('overview')
  
  // Interactive Simulation Controls
  const [ambientTemp, setAmbientTemp] = useState<number>(-28)
  const [crewOccupancy, setCrewOccupancy] = useState<number>(24)
  const [selectedGen, setSelectedGen] = useState<number>(1)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Derived Values
  const baseLoad = activeStation === 'maitri' ? 142 : 185
  const tempFactor = Math.max(0, (-ambientTemp - 15) * 1.8)
  const occupancyFactor = (crewOccupancy - 20) * 1.2
  const currentTotalLoad = Math.round(baseLoad + tempFactor + occupancyFactor)

  const solarGen = ambientTemp > -35 ? (activeStation === 'maitri' ? 18.5 : 34.0) : 0
  const windGen = activeStation === 'maitri' ? 24.2 : 16.8
  const batterySoC = activeStation === 'maitri' ? 91 : 96
  const genOutput = Math.max(0, currentTotalLoad - solarGen - windGen)

  const fuelRemainingLitres = activeStation === 'maitri' ? 138400 : 210500
  const totalCapacityLitres = activeStation === 'maitri' ? 165000 : 250000
  const fuelPct = Math.round((fuelRemainingLitres / totalCapacityLitres) * 100)

  // Burn rate: roughly 0.28 L per kWh
  const hourlyBurnLitres = (genOutput * 0.28).toFixed(1)
  const dailyBurnLitres = Math.round(parseFloat(hourlyBurnLitres) * 24)
  const daysOfAutonomy = Math.round(fuelRemainingLitres / (dailyBurnLitres || 1))

  function triggerGenAction(genId: number, action: string) {
    setActionMessage(`[${new Date().toLocaleTimeString('en-GB')}] ⚙️ Dispatch Command: Generator DG-${genId} -> ${action.toUpperCase()} signal transmitted to station microgrid PLC.`)
    setTimeout(() => setActionMessage(null), 5000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation(s => s === 'maitri' ? 'bharati' : 'maitri')} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            {/* Breadcrumb Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '6px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}
                >
                  {t('crumb.home')}
                </button>
                <span>&gt;</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
                <span>&gt;</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>
                  {lang === 'hi' ? 'ऊर्जा एवं हाइब्रिड माइक्रोग्रिड प्रबंधन' : 'Energy Systems & Polar Microgrid Command'}
                </span>
              </div>

              {/* Station Switcher Pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setActiveStation('maitri')}
                  style={{
                    background: activeStation === 'maitri' ? '#0b3b60' : '#ffffff',
                    color: activeStation === 'maitri' ? '#ffffff' : '#0b3b60',
                    border: '1px solid #0b3b60',
                    padding: '3px 10px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  मैत्री (Maitri Microgrid)
                </button>
                <button
                  onClick={() => setActiveStation('bharati')}
                  style={{
                    background: activeStation === 'bharati' ? '#0b3b60' : '#ffffff',
                    color: activeStation === 'bharati' ? '#ffffff' : '#0b3b60',
                    border: '1px solid #0b3b60',
                    padding: '3px 10px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  भारती (Bharati Microgrid)
                </button>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {actionMessage && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                <span>{actionMessage}</span>
              </div>
            )}

            {/* Top Microgrid KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 12 }}>
              {/* KPI 1: Active Station Load */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0b3b60', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'कुल स्टेशन विद्युत भार' : 'TOTAL STATION LOAD'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0b3b60' }}>bolt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#0b3b60' }}>{currentTotalLoad}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>kW / 300 kW Peak</span>
                </div>
                <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 700, marginTop: 4 }}>
                  Grid Capacity Utilization: {Math.round((currentTotalLoad / 300) * 100)}%
                </div>
              </div>

              {/* KPI 2: Generation Mix */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #16a34a', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'नवीकरणीय ऊर्जा योगदान' : 'RENEWABLE OFFSET'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>eco</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{(solarGen + windGen).toFixed(1)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>kW Generated</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                  ☀️ Solar: {solarGen} kW • 💨 Wind: {windGen} kW
                </div>
              </div>

              {/* KPI 3: Fuel Reserves & Autonomy */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #ea580c', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'डीजल ईंधन भंडार व स्वायत्तता' : 'FUEL RESERVES & AUTONOMY'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ea580c' }}>local_gas_station</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{daysOfAutonomy}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>Days Autonomy</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                  Stock: <strong>{(fuelRemainingLitres / 1000).toFixed(1)}k L</strong> ({fuelPct}%) • Burn: <strong>{hourlyBurnLitres} L/hr</strong>
                </div>
              </div>

              {/* KPI 4: Power Quality & Grid Health */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0284c7', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'ग्रिड आवृत्ति एवं वोल्टेज' : 'GRID BUS STABILITY'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>electrical_services</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>50.02 Hz</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>415V / 230V</span>
                </div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                  THD &lt; 2.1% • Power Factor: 0.96 Lagging
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #cbd5e1', marginBottom: 12, background: '#ffffff', padding: '4px 8px 0 8px' }}>
              {[
                { id: 'overview', label: lang === 'hi' ? '📊 माइक्रोग्रिड फ्लो आरेख' : '📊 Microgrid Single-Line Flow', icon: 'account_tree' },
                { id: 'generators', label: lang === 'hi' ? '⚙️ डीजल जनरेटर बे (DG 1-4)' : '⚙️ Generator Fleet (DG 1-4)', icon: 'manufacturing' },
                { id: 'fuel', label: lang === 'hi' ? '🛢️ आर्कटिक ईंधन भंडारण टैंक' : '🛢️ Fuel Farm & Arctic Tanks', icon: 'propane_tank' },
                { id: 'prediction', label: lang === 'hi' ? '🧠 एआई ईंधन खपत व सिमुलेशन' : '🧠 AI Fuel Burn Predictor', icon: 'psychology' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: activeTab === tab.id ? '#0b3b60' : 'transparent',
                    color: activeTab === tab.id ? '#ffffff' : '#475569',
                    border: 'none',
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    padding: '8px 14px',
                    fontSize: 11.5,
                    fontWeight: activeTab === tab.id ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ═══════════ TAB 1: MICROGRID FLOW & SINGLE-LINE DIAGRAM ═══════════ */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
                {/* Visual Animated Single-Line Diagram */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', margin: 0 }}>
                        {activeStation.toUpperCase()} STATION HYBRID MICROGRID POWER FLOW (415V AC SYNCHRONIZED BUS)
                      </h3>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        Automated Load Dispatch • BESS Peak Shaving • Renewable Priority Integration
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px' }}>
                      BUS SYNCHRONIZED
                    </span>
                  </div>

                  <div style={{ position: 'relative', width: '100%', height: 360, background: '#091522', borderRadius: 4, overflow: 'hidden' }}>
                    <svg viewBox="0 0 700 360" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <linearGradient id="busGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#0284c7" />
                          <stop offset="50%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                      </defs>

                      {/* Central Synchronized AC Bus Bar */}
                      <rect x="180" y="170" width="340" height="14" rx="2" fill="url(#busGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                      <text x="350" y="181" fill="#0f172a" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="Inter">
                        MAIN 415V 3-PHASE SYNCHRONIZED STATION BUS
                      </text>

                      {/* Power Sources (Top Row) */}
                      {/* Source 1: Diesel Genset 1 & 2 */}
                      <g transform="translate(100, 60)">
                        <rect x="-65" y="-30" width="130" height="55" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Inter">⛽ DIESEL GENSET 1</text>
                        <text x="0" y="6" fill="#fbbf24" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="Inter">{genOutput.toFixed(1)} kW</text>
                        <text x="0" y="18" fill="#94a3b8" fontSize="8" textAnchor="middle">1500 RPM • Online</text>
                        {/* Power flow line to bus */}
                        <line x1="0" y1="25" x2="120" y2="110" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                        </line>
                      </g>

                      {/* Source 2: Solar PV Array */}
                      <g transform="translate(350, 60)">
                        <rect x="-60" y="-30" width="120" height="55" rx="3" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Inter">☀️ SOLAR PV ARRAY</text>
                        <text x="0" y="6" fill="#34d399" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="Inter">{solarGen} kW</text>
                        <text x="0" y="18" fill="#94a3b8" fontSize="8" textAnchor="middle">Inverter Active</text>
                        {/* Power flow line to bus */}
                        <line x1="0" y1="25" x2="0" y2="110" stroke="#10b981" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                        </line>
                      </g>

                      {/* Source 3: Wind Turbines */}
                      <g transform="translate(580, 60)">
                        <rect x="-65" y="-30" width="130" height="55" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Inter">💨 WIND TURBINES</text>
                        <text x="0" y="6" fill="#7dd3fc" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="Inter">{windGen} kW</text>
                        <text x="0" y="18" fill="#94a3b8" fontSize="8" textAnchor="middle">Pitch Controlled</text>
                        {/* Power flow line to bus */}
                        <line x1="0" y1="25" x2="-130" y2="110" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                        </line>
                      </g>

                      {/* Battery Storage (BESS) Side-Tie */}
                      <g transform="translate(60, 177)">
                        <rect x="-45" y="-25" width="90" height="50" rx="3" fill="#1e293b" stroke="#8b5cf6" strokeWidth="1.5" />
                        <text x="0" y="-8" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">🔋 BESS BANK</text>
                        <text x="0" y="8" fill="#c084fc" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="Inter">{batterySoC}% SoC</text>
                        <text x="0" y="18" fill="#94a3b8" fontSize="7.5" textAnchor="middle">Float Standby</text>
                        {/* Bidirectional tie line */}
                        <line x1="45" y1="0" x2="120" y2="0" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4,4" />
                      </g>

                      {/* Distribution Feeders (Bottom Row) */}
                      {/* Feeder 1: Life Support & Habitat HVAC */}
                      <g transform="translate(130, 290)">
                        <line x1="90" y1="-106" x2="0" y2="-30" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                        </line>
                        <rect x="-55" y="-30" width="110" height="52" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1.2" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">🏥 LIFE SUPPORT</text>
                        <text x="0" y="4" fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Inter">{Math.round(currentTotalLoad * 0.42)} kW</text>
                        <text x="0" y="16" fill="#64748b" fontSize="7.5" textAnchor="middle">HVAC & Oxygen</text>
                      </g>

                      {/* Feeder 2: Science Laboratories & Radars */}
                      <g transform="translate(280, 290)">
                        <line x1="40" y1="-106" x2="0" y2="-30" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                        </line>
                        <rect x="-55" y="-30" width="110" height="52" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1.2" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">🔬 LABS & MET</text>
                        <text x="0" y="4" fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Inter">{Math.round(currentTotalLoad * 0.28)} kW</text>
                        <text x="0" y="16" fill="#64748b" fontSize="7.5" textAnchor="middle">Clean Power Bus</text>
                      </g>

                      {/* Feeder 3: Water Melting & Sewage Treatment */}
                      <g transform="translate(430, 290)">
                        <line x1="-40" y1="-106" x2="0" y2="-30" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                        </line>
                        <rect x="-55" y="-30" width="110" height="52" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1.2" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">💧 WATER MELTER</text>
                        <text x="0" y="4" fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Inter">{Math.round(currentTotalLoad * 0.18)} kW</text>
                        <text x="0" y="16" fill="#64748b" fontSize="7.5" textAnchor="middle">Lake Boiler Pump</text>
                      </g>

                      {/* Feeder 4: Communications & VSAT */}
                      <g transform="translate(580, 290)">
                        <line x1="-90" y1="-106" x2="0" y2="-30" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,5">
                          <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                        </line>
                        <rect x="-55" y="-30" width="110" height="52" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1.2" />
                        <text x="0" y="-12" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">📡 SATCOM & IT</text>
                        <text x="0" y="4" fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Inter">{Math.round(currentTotalLoad * 0.12)} kW</text>
                        <text x="0" y="16" fill="#64748b" fontSize="7.5" textAnchor="middle">UPS Backed (2h)</text>
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Right Side: Microgrid Controls & Power Factor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', marginBottom: 8 }}>
                      POWER BALANCE SUMMARY
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>Primary Diesel Output:</span>
                        <strong style={{ color: '#0f172a' }}>{genOutput.toFixed(1)} kW</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>Renewable Penetration:</span>
                        <strong style={{ color: '#16a34a' }}>{Math.round(((solarGen + windGen) / currentTotalLoad) * 100)}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>BESS State of Charge:</span>
                        <strong style={{ color: '#8b5cf6' }}>{batterySoC}% (Normal)</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>CO₂ Emission Offset:</span>
                        <strong style={{ color: '#16a34a' }}>48.2 kg/day</strong>
                      </div>
                    </div>
                  </div>

                  {/* Microgrid Automation Mode */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 6 }}>
                      DISPATCH AUTOMATION MODE
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>
                      Currently operating under <strong>Autonomous Polar Microgrid Mode (APMM)</strong> with automatic spinning reserve management.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => triggerGenAction(1, 'Auto-Sync Optimize')}
                        style={{ background: '#0b3b60', color: '#ffffff', border: 'none', padding: '6px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', borderRadius: 2 }}
                      >
                        Auto-Optimize Load
                      </button>
                      <button
                        onClick={() => triggerGenAction(selectedGen, 'Manual Override')}
                        style={{ background: '#ffffff', color: '#0b3b60', border: '1px solid #0b3b60', padding: '6px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', borderRadius: 2 }}
                      >
                        Override Mode
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════ TAB 2: GENERATOR FLEET (DG 1-4) ═══════════ */}
            {activeTab === 'generators' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {[
                  { id: 1, name: 'DG-1 (Kirloskar 100 kVA)', status: 'RUNNING (LEAD)', kw: Math.round(genOutput * 0.65), rpm: 1500, coolant: 82, oilPress: 4.8, egt: 410, fuelLhr: 18.2 },
                  { id: 2, name: 'DG-2 (Kirloskar 100 kVA)', status: genOutput > 70 ? 'RUNNING (LAG)' : 'STANDBY (WARMED)', kw: genOutput > 70 ? Math.round(genOutput * 0.35) : 0, rpm: genOutput > 70 ? 1500 : 0, coolant: 64, oilPress: genOutput > 70 ? 4.7 : 0, egt: genOutput > 70 ? 385 : 45, fuelLhr: genOutput > 70 ? 12.1 : 0 },
                  { id: 3, name: 'DG-3 (Kirloskar 100 kVA)', status: 'STANDBY (AUTO-START)', kw: 0, rpm: 0, coolant: 58, oilPress: 0, egt: 28, fuelLhr: 0 },
                  { id: 4, name: 'DG-4 (Emergency Backup)', status: 'COLD STANDBY', kw: 0, rpm: 0, coolant: 42, oilPress: 0, egt: 22, fuelLhr: 0 },
                ].map((gen) => {
                  const isRunning = gen.status.includes('RUNNING')
                  return (
                    <div
                      key={gen.id}
                      onClick={() => setSelectedGen(gen.id)}
                      style={{
                        background: '#ffffff',
                        border: selectedGen === gen.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        borderTop: isRunning ? '4px solid #16a34a' : '4px solid #94a3b8',
                        padding: 14,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60' }}>{gen.name}</div>
                          <div style={{ fontSize: 9.5, color: '#64748b' }}>Serial: KRL-ANT-2024-0{gen.id}</div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', background: isRunning ? '#dcfce7' : '#f1f5f9', color: isRunning ? '#15803d' : '#64748b', borderRadius: 2 }}>
                          {gen.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 10 }}>
                        <div style={{ background: '#f8fafc', padding: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#64748b', fontSize: 10 }}>Electrical Output</div>
                          <div style={{ fontWeight: 900, color: isRunning ? '#0284c7' : '#94a3b8', fontSize: 14 }}>{gen.kw} kW</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#64748b', fontSize: 10 }}>Engine Speed</div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{gen.rpm} RPM</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#64748b', fontSize: 10 }}>Coolant Temp</div>
                          <div style={{ fontWeight: 800, color: gen.coolant > 85 ? '#dc2626' : '#0f172a' }}>{gen.coolant} °C</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#64748b', fontSize: 10 }}>Oil Pressure</div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{gen.oilPress} bar</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => triggerGenAction(gen.id, isRunning ? 'Stop / Transition to Standby' : 'Start / Synchronize')}
                          style={{
                            flex: 1,
                            background: isRunning ? '#fee2e2' : '#dcfce7',
                            color: isRunning ? '#991b1b' : '#166534',
                            border: `1px solid ${isRunning ? '#fca5a5' : '#86efac'}`,
                            padding: '5px 8px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {isRunning ? 'Stop Unit' : 'Start & Sync'}
                        </button>
                        <button
                          onClick={() => triggerGenAction(gen.id, 'Self-Diagnostic Routine')}
                          style={{
                            background: '#ffffff',
                            color: '#0b3b60',
                            border: '1px solid #cbd5e1',
                            padding: '5px 8px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Self-Test
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ═══════════ TAB 3: FUEL FARM & ARCTIC STORAGE ═══════════ */}
            {activeTab === 'fuel' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {[
                  { id: 'T1', name: 'Tank 1 — Powerhouse Day Tank', capacity: 5000, current: 4350, temp: 12, status: 'HEATED & FILTERED' },
                  { id: 'T2', name: 'Tank 2 — Arctic Bulk Storage A', capacity: 75000, current: 63200, temp: 6, status: 'NOMINAL' },
                  { id: 'T3', name: 'Tank 3 — Arctic Bulk Storage B', capacity: 75000, current: 59100, temp: 5, status: 'NOMINAL' },
                  { id: 'T4', name: 'Tank 4 — Emergency Survival Reserve', capacity: 10000, current: 9800, temp: 8, status: 'LOCKED / RESTRICTED' },
                ].map((tank) => {
                  const pct = Math.round((tank.current / tank.capacity) * 100)
                  return (
                    <div key={tank.id} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 900, color: '#0b3b60' }}>{tank.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: 2 }}>
                          {tank.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0' }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{tank.current.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>/ {tank.capacity.toLocaleString()} Litres ({pct}%)</span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ height: 10, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct > 30 ? '#0284c7' : '#ea580c' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#475569' }}>
                        <span>Trace Heating: <strong>{tank.temp} °C (Anti-freeze)</strong></span>
                        <span>Water Bottom: <strong>0.00% (Clean)</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ═══════════ TAB 4: AI FUEL BURN PREDICTOR ═══════════ */}
            {activeTab === 'prediction' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14 }}>
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', marginTop: 0, marginBottom: 6 }}>
                    🧠 AI POLAR THERMAL & MICROGRID BURN PREDICTION MODEL
                  </h3>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 14 }}>
                    Interactive neural estimation of daily diesel consumption based on external polar weather severity and station crew size.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                    {/* Control 1: Temperature */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>
                        <span>Ambient Blizzard Temperature</span>
                        <span style={{ color: '#0284c7', fontSize: 13 }}>{ambientTemp} °C</span>
                      </div>
                      <input
                        type="range"
                        min="-55"
                        max="-5"
                        value={ambientTemp}
                        onChange={(e) => setAmbientTemp(parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                        <span>-55°C (Extreme Polar Blizzard)</span>
                        <span>-5°C (Polar Summer)</span>
                      </div>
                    </div>

                    {/* Control 2: Occupancy */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>
                        <span>Active Crew & Expedition Scientists</span>
                        <span style={{ color: '#0284c7', fontSize: 13 }}>{crewOccupancy} Personnel</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="60"
                        value={crewOccupancy}
                        onChange={(e) => setCrewOccupancy(parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                        <span>10 (Winter Core)</span>
                        <span>60 (Summer Peak Expansion)</span>
                      </div>
                    </div>
                  </div>

                  {/* Prediction Highlights */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#f8fafc', padding: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Projected Load</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0b3b60' }}>{currentTotalLoad} kW</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Daily Fuel Burn</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#ea580c' }}>{dailyBurnLitres} L/day</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Estimated Autonomy</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#16a34a' }}>{daysOfAutonomy} Days</div>
                    </div>
                  </div>
                </div>

                {/* Resupply Mission Tracker */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', marginTop: 0, marginBottom: 8 }}>
                    🚢 EXPEDITION RESUPPLY PROJECTION
                  </h4>
                  <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                    Scheduled Resupply Ship: <strong>MV Vasiliy Golovnin (Chartered Polar Vessel)</strong>
                  </div>

                  <div style={{ background: '#f0f9ff', padding: 10, border: '1px solid #bae6fd', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 800 }}>ETA at Polar Ice Edge:</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#0b3b60', marginTop: 2 }}>68 Days Remaining</div>
                    <div style={{ fontSize: 9.5, color: '#0369a1', marginTop: 4 }}>
                      Fuel margin at current burn rate: <strong>+{(daysOfAutonomy - 68)} days safety surplus</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Security Status: <strong>NCPOR Logistics Directorate Verified</strong>
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
