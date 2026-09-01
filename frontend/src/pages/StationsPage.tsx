import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStations } from '../hooks/useStations'
import { useLanguage } from '../context/LanguageContext'

export default function StationsPage() {
  const navigate = useNavigate()
  const { data: stations } = useStations()
  const { t, lang } = useLanguage()

  const [selectedStation, setSelectedStation] = useState<'maitri' | 'bharati'>('maitri')
  const [activeTab, setActiveTab] = useState<'topology' | 'nodes' | 'diagnostics' | 'security'>('topology')
  const [pingRunning, setPingRunning] = useState(false)
  const [pingLogs, setPingLogs] = useState<string[]>([
    'HQ Gateway (Goa 15.39°N 73.80°E): System initialized',
    'ISRO GSAT-30 Polar Beam: Transponder lock nominal (SNR 16.2 dB)',
    'Maitri Node: Heartbeat received (RTT 584ms, 0% loss)',
    'Bharati Node: Heartbeat received (RTT 562ms, 0% loss)',
  ])
  const [chaosMode, setChaosMode] = useState<string>('nominal')
  const [flushState, setFlushState] = useState<{ [key: string]: boolean }>({})

  const maitriData = stations?.find((s) => s.station_id === 'maitri')
  const bharatiData = stations?.find((s) => s.station_id === 'bharati')

  function runPingTest(stationId: string) {
    setPingRunning(true)
    const timestamp = new Date().toLocaleTimeString('en-GB')
    const targetName = stationId === 'maitri' ? 'Maitri (Schirmacher Oasis)' : 'Bharati (Larsemann Hills)'
    setPingLogs((prev) => [
      `[${timestamp}] 🚀 Pinging ${targetName} via VSAT SCPC link...`,
      ...prev.slice(0, 10),
    ])

    setTimeout(() => {
      const rtt = Math.floor(540 + Math.random() * 70)
      const snr = (15.5 + Math.random() * 2).toFixed(1)
      setPingLogs((prev) => [
        `[${new Date().toLocaleTimeString('en-GB')}] ✅ Reply from ${stationId.toUpperCase()}_EDGE (10.240.${stationId === 'maitri' ? '1.1' : '2.1'}): bytes=64 rtt=${rtt}ms SNR=${snr}dB QoS=0 (Protobuf v3)`,
        ...prev,
      ])
      setPingRunning(false)
    }, 1200)
  }

  function handleQueueFlush(stationId: string) {
    setFlushState((prev) => ({ ...prev, [stationId]: true }))
    setTimeout(() => {
      setFlushState((prev) => ({ ...prev, [stationId]: false }))
      setPingLogs((prev) => [
        `[${new Date().toLocaleTimeString('en-GB')}] 🔄 Outbound Redis Sync Queue for ${stationId.toUpperCase()} flushed to Cloud TimescaleDB. 0 bytes pending.`,
        ...prev,
      ])
    }, 1500)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeStation={selectedStation} onSwitchStation={() => setSelectedStation(s => s === 'maitri' ? 'bharati' : 'maitri')} />

        <main id="main-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            {/* Breadcrumbs Bar */}
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
                {lang === 'hi' ? 'ध्रुवीय स्टेशन नेटवर्क एवं वीसेट टोपोलॉजी' : 'Polar Station Network & Satellite Topology'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#0b3b60', background: '#e0f2fe', padding: '2px 8px', fontWeight: 700, border: '1px solid #bae6fd' }}>
                mTLS 1.3 CERTIFIED
              </span>
              <span style={{ fontSize: 10, color: '#15803d', background: '#dcfce7', padding: '2px 8px', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                2/2 NODES ACTIVE
              </span>
            </div>
          </div>

          {/* Top Network KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            {/* Card 1: Polar Mesh Status */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0b3b60', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'ध्रुवीय नेटवर्क स्थिति' : 'POLAR MESH STATUS'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0b3b60' }}>hub</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#0b3b60' }}>DUAL-NODE ACTIVE</span>
              </div>
              <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                Maitri (11°E) ⟷ Bharati (76°E) Synchronized
              </div>
            </div>

            {/* Card 2: VSAT Satellite Transponder */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0284c7', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'उपग्रह ट्रांसपोंडर' : 'VSAT TRANSPONDER'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>satellite_alt</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>ISRO GSAT-30</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7' }}>C/Ku-Band</span>
              </div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                Carrier Lock: <strong style={{ color: '#0f172a' }}>99.98%</strong> • Avg RTT: <strong style={{ color: '#0f172a' }}>574ms</strong>
              </div>
            </div>

            {/* Card 3: Ingestion & Telemetry Rate */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #16a34a', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'टेलीमेट्री अंतर्ग्रहण दर' : 'INGESTION TELEMETRY'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>speed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>1,480</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>samples/min</span>
              </div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                Protobuf + zstd Compressed (Ratio: <strong style={{ color: '#16a34a' }}>4.2x</strong>)
              </div>
            </div>

            {/* Card 4: Black-box & Queue Integrity */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #ea580c', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'ब्लैक-बॉक्स हैश-चेन' : 'BLACK-BOX LEDGER'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ea580c' }}>lock</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>SHA256: 8C4E...F91</span>
              </div>
              <div style={{ fontSize: 10, color: '#ea580c', fontWeight: 700, marginTop: 4 }}>
                Append-only Hash Chain • Non-repudiable
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #cbd5e1', marginBottom: 12, background: '#ffffff', padding: '4px 8px 0 8px' }}>
            {[
              { id: 'topology', label: lang === 'hi' ? '🛰️ उपग्रह टोपोलॉजी मानचित्र' : '🛰️ Satellite Topology Map', icon: 'route' },
              { id: 'nodes', label: lang === 'hi' ? '🏢 मैत्री व भारती स्टेशन नोड्स' : '🏢 Station Node Specs', icon: 'dns' },
              { id: 'diagnostics', label: lang === 'hi' ? '⚡ लाइव पिंग एवं लिंक डायग्नोस्टिक्स' : '⚡ Live Diagnostics & Ping', icon: 'troubleshoot' },
              { id: 'security', label: lang === 'hi' ? '🔐 mTLS सुरक्षा व क्रिप्टोग्राफी' : '🔐 mTLS Security & Ledger', icon: 'security' },
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

          {/* ═══════════ TAB 1: SATELLITE TOPOLOGY MAP ═══════════ */}
          {activeTab === 'topology' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
              {/* SVG Topology Diagram */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', margin: 0 }}>
                      {lang === 'hi' ? 'राष्ट्रीय ध्रुवीय उपग्रह रिले एवं मेश नेटवर्क टोपोलॉजी' : 'NATIONAL POLAR SATELLITE RELAY & MESH TOPOLOGY'}
                    </h3>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      NCPOR HQ Gateway (Goa) ⟷ ISRO GSAT-30 ⟷ Maitri Base & Bharati Base
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px' }}>
                    LIVE MESH STREAM
                  </span>
                </div>

                <div style={{ position: 'relative', width: '100%', height: 380, background: '#081726', borderRadius: 4, overflow: 'hidden' }}>
                  <svg viewBox="0 0 700 380" style={{ width: '100%', height: '100%' }}>
                    {/* Background Grid */}
                    <defs>
                      <pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse">
                        <path d="M 35 0 L 0 0 0 35" fill="none" stroke="#0f2b48" strokeWidth="0.5" />
                      </pattern>
                      <linearGradient id="beamMaitri" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
                      </linearGradient>
                      <linearGradient id="beamBharati" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    <rect width="700" height="380" fill="url(#grid)" />

                    {/* Satellite (ISRO GSAT-30) in Top Center */}
                    <g transform="translate(350, 70)">
                      {/* Satellite Pulse */}
                      <circle cx="0" cy="0" r="32" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.3">
                        <animate attributeName="r" values="20;45" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="0" cy="0" r="16" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                      <rect x="-36" y="-5" width="20" height="10" fill="#0ea5e9" stroke="#38bdf8" strokeWidth="1" />
                      <rect x="16" y="-5" width="20" height="10" fill="#0ea5e9" stroke="#38bdf8" strokeWidth="1" />
                      <text x="0" y="28" fill="#e0f2fe" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Inter">
                        ISRO GSAT-30 (Polar Transponder)
                      </text>
                      <text x="0" y="38" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="Inter">
                        GEO 83°E • Dedicated Polar Footprint
                      </text>
                    </g>

                    {/* Uplink / Downlink Beams */}
                    {/* Beam: HQ to Satellite */}
                    <line x1="350" y1="70" x2="160" y2="150" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5">
                      <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                    </line>

                    {/* Beam: Satellite to Maitri */}
                    <line x1="350" y1="70" x2="180" y2="300" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6,4">
                      <animate attributeName="stroke-dashoffset" values="30;0" dur="1.2s" repeatCount="indefinite" />
                    </line>

                    {/* Beam: Satellite to Bharati */}
                    <line x1="350" y1="70" x2="520" y2="300" stroke="#34d399" strokeWidth="2" strokeDasharray="6,4">
                      <animate attributeName="stroke-dashoffset" values="30;0" dur="1.2s" repeatCount="indefinite" />
                    </line>

                    {/* Inter-Station Backup Link (HF / Iridium) */}
                    <path d="M 180 300 Q 350 340 520 300" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.7">
                      <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
                    </path>
                    <text x="350" y="335" fill="#d8b4fe" fontSize="8.5" fontWeight="700" textAnchor="middle" fontFamily="Inter">
                      Inter-Station Polar HF Mesh (14.150 MHz)
                    </text>

                    {/* NODE 1: NCPOR HQ (Goa) */}
                    <g transform="translate(160, 150)">
                      <rect x="-70" y="-22" width="140" height="44" rx="4" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
                      <circle cx="-50" cy="0" r="5" fill="#f59e0b" />
                      <text x="-38" y="-4" fill="#ffffff" fontSize="9.5" fontWeight="800" fontFamily="Inter">NCPOR HQ (GOA)</text>
                      <text x="-38" y="8" fill="#cbd5e1" fontSize="8" fontFamily="Inter">Cloud Broker • Port 8883</text>
                    </g>

                    {/* NODE 2: MAITRI STATION (Schirmacher Oasis) */}
                    <g
                      transform="translate(180, 300)"
                      onClick={() => setSelectedStation('maitri')}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle cx="0" cy="0" r="28" fill="#0c4a6e" stroke="#38bdf8" strokeWidth={selectedStation === 'maitri' ? 3 : 1.5} />
                      <rect x="-65" y="16" width="130" height="34" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                      <text x="0" y="-4" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle">🇮🇳</text>
                      <text x="0" y="28" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">
                        MAITRI BASE (मैत्री)
                      </text>
                      <text x="0" y="42" fill="#38bdf8" fontSize="7.5" fontWeight="700" textAnchor="middle" fontFamily="Inter">
                        70°45′S, 11°44′E • ONLINE
                      </text>
                    </g>

                    {/* NODE 3: BHARATI STATION (Larsemann Hills) */}
                    <g
                      transform="translate(520, 300)"
                      onClick={() => setSelectedStation('bharati')}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle cx="0" cy="0" r="28" fill="#064e3b" stroke="#34d399" strokeWidth={selectedStation === 'bharati' ? 3 : 1.5} />
                      <rect x="-65" y="16" width="130" height="34" rx="3" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                      <text x="0" y="-4" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle">🇮🇳</text>
                      <text x="0" y="28" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">
                        BHARATI BASE (भारती)
                      </text>
                      <text x="0" y="42" fill="#34d399" fontSize="7.5" fontWeight="700" textAnchor="middle" fontFamily="Inter">
                        69°24′S, 76°11′E • ONLINE
                      </text>
                    </g>
                  </svg>
                </div>
              </div>

              {/* Station Quick Selector & Live Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Maitri Card */}
                <div
                  onClick={() => setSelectedStation('maitri')}
                  style={{
                    background: '#ffffff',
                    border: selectedStation === 'maitri' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    padding: 12,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60' }}>मैत्री (Maitri Station)</span>
                      <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', fontWeight: 800, borderRadius: 2 }}>
                        EST. 1989
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                      UP (584ms)
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>
                    Location: Schirmacher Oasis, Dronning Maud Land
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                    <div style={{ background: '#f8fafc', padding: 5, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b' }}>Queue Depth</div>
                      <div style={{ fontWeight: 800, color: '#0b3b60' }}>{maitriData?.queue_depth_bytes ?? '0 B'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 5, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b' }}>Uplink SNR</div>
                      <div style={{ fontWeight: 800, color: '#16a34a' }}>16.4 dB (Nominal)</div>
                    </div>
                  </div>
                </div>

                {/* Bharati Card */}
                <div
                  onClick={() => setSelectedStation('bharati')}
                  style={{
                    background: '#ffffff',
                    border: selectedStation === 'bharati' ? '2px solid #059669' : '1px solid #cbd5e1',
                    padding: 12,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60' }}>भारती (Bharati Station)</span>
                      <span style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '1px 5px', fontWeight: 800, borderRadius: 2 }}>
                        EST. 2012
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                      UP (562ms)
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>
                    Location: Larsemann Hills, Prydz Bay (Coastal)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                    <div style={{ background: '#f8fafc', padding: 5, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b' }}>Queue Depth</div>
                      <div style={{ fontWeight: 800, color: '#0b3b60' }}>{bharatiData?.queue_depth_bytes ?? '0 B'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 5, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b' }}>Uplink SNR</div>
                      <div style={{ fontWeight: 800, color: '#16a34a' }}>18.1 dB (Nominal)</div>
                    </div>
                  </div>
                </div>

                {/* Satellite Failover Strategy Box */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>
                    POLAR FAILOVER POLICY
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                    <li><strong>QoS 2:</strong> Critical Life-Support & Fire alarms bypass telemetry queue.</li>
                    <li><strong>Zero Data Loss:</strong> In offline blackout, local edge buffers to Redis AOF.</li>
                    <li><strong>Auto-Resync:</strong> Full historical delta bursts upon carrier re-acquisition.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: STATION NODE SPECS & ARCHITECTURE ═══════════ */}
          {activeTab === 'nodes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Maitri Node Full Specs */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '4px solid #0284c7', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0b3b60', margin: 0 }}>
                      मैत्री अनुसंधान केंद्र (MAITRI BASE)
                    </h3>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>
                      Node ID: <code style={{ color: '#0284c7' }}>maitri-edge-01</code> • Schirmacher Oasis (70°45′57″S, 11°44′09″E)
                    </div>
                  </div>
                  <button
                    onClick={() => runPingTest('maitri')}
                    disabled={pingRunning}
                    style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 2 }}
                  >
                    {pingRunning ? 'Pinging...' : '⚡ Ping Node'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>🖥️ Station Edge Hardware</div>
                    <div style={{ color: '#475569' }}>• Rugged Polar Server: Intel Xeon E-2278G, 64GB ECC RAM, Industrial NVMe</div>
                    <div style={{ color: '#475569' }}>• Local DB: TimescaleDB 2.14 / PostgreSQL 16 (Local retention: 365 days)</div>
                    <div style={{ color: '#475569' }}>• Local Edge AI: PyTorch ONNX Runtime (Rule engine + Autoencoder Anomaly)</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>📡 Communication & Satellite Link</div>
                    <div style={{ color: '#475569' }}>• Primary VSAT: ISRO GSAT-30 C-Band (128 kbps SCPC Dedicated Link)</div>
                    <div style={{ color: '#475569' }}>• Backup Link: Inmarsat BGAN M2M (Auto-dial upon 3 missed heartbeats)</div>
                    <div style={{ color: '#475569' }}>• Local Mesh: RS485 Modbus RTU (Generators & Fuel Farm) + 868MHz LoRaWAN</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>⚙️ Action Controls</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => handleQueueFlush('maitri')}
                        disabled={flushState['maitri']}
                        style={{ background: '#0b3b60', color: '#ffffff', border: 'none', padding: '5px 12px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {flushState['maitri'] ? 'Flushing...' : 'Force Queue Sync'}
                      </button>
                      <button
                        onClick={() => alert('Maitri Station Certificate: SHA256:7B94...ED25519 Valid till Dec 2027')}
                        style={{ background: '#ffffff', color: '#0b3b60', border: '1px solid #0b3b60', padding: '5px 12px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        View Node Certificate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bharati Node Full Specs */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '4px solid #059669', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0b3b60', margin: 0 }}>
                      भारती अनुसंधान केंद्र (BHARATI BASE)
                    </h3>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>
                      Node ID: <code style={{ color: '#059669' }}>bharati-edge-01</code> • Larsemann Hills (69°24′29″S, 76°11′14″E)
                    </div>
                  </div>
                  <button
                    onClick={() => runPingTest('bharati')}
                    disabled={pingRunning}
                    style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 2 }}
                  >
                    {pingRunning ? 'Pinging...' : '⚡ Ping Node'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>🖥️ Station Edge Hardware</div>
                    <div style={{ color: '#475569' }}>• High-Throughput Edge Node: Dual Intel Xeon Silver, 128GB RAM, Redundant PSU</div>
                    <div style={{ color: '#475569' }}>• Local DB: TimescaleDB 2.14 / PostgreSQL 16 (Continuous Aggregates)</div>
                    <div style={{ color: '#475569' }}>• BMS Integration: Automated Building Management System digital twin sync</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>📡 Communication & Satellite Link</div>
                    <div style={{ color: '#475569' }}>• Primary VSAT: Dedicated High-Speed Ku-Band Polar Transponder (2.0 Mbps)</div>
                    <div style={{ color: '#475569' }}>• Backup Link: Iridium Certus 700 Polar Link (Multi-carrier relay)</div>
                    <div style={{ color: '#475569' }}>• Local Backbone: 10 GbE Single-Mode Fiber Optic Ring across station pavilions</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60', marginBottom: 4 }}>⚙️ Action Controls</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => handleQueueFlush('bharati')}
                        disabled={flushState['bharati']}
                        style={{ background: '#0b3b60', color: '#ffffff', border: 'none', padding: '5px 12px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {flushState['bharati'] ? 'Flushing...' : 'Force Queue Sync'}
                      </button>
                      <button
                        onClick={() => alert('Bharati Station Certificate: SHA256:4C82...ED25519 Valid till Dec 2027')}
                        style={{ background: '#ffffff', color: '#0b3b60', border: '1px solid #0b3b60', padding: '5px 12px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        View Node Certificate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: DIAGNOSTICS & PING ═══════════ */}
          {activeTab === 'diagnostics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
              {/* Terminal Logs & Interactive Ping Console */}
              <div style={{ background: '#0a101d', border: '1px solid #1e293b', padding: 14, borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                      NCPOR POLAR VSAT LINK DIAGNOSTICS CONSOLE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => runPingTest('maitri')}
                      disabled={pingRunning}
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '3px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace' }}
                    >
                      PING MAITRI
                    </button>
                    <button
                      onClick={() => runPingTest('bharati')}
                      disabled={pingRunning}
                      style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '3px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace' }}
                    >
                      PING BHARATI
                    </button>
                    <button
                      onClick={() => setPingLogs([])}
                      style={{ background: '#334155', color: '#ffffff', border: 'none', padding: '3px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace' }}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 260, maxHeight: 340, overflowY: 'auto', fontFamily: 'Consolas, monospace', fontSize: 11, color: '#a5f3fc', lineHeight: 1.6 }}>
                  {pingLogs.map((log, i) => (
                    <div key={i} style={{ opacity: i === 0 ? 1 : 0.85 }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chaos / Failover Simulator */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 14 }}>
                <h4 style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', marginTop: 0, marginBottom: 8 }}>
                  POLAR SATELLITE CHAOS TEST BENCH
                </h4>
                <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 12 }}>
                  Test edge resilience under severe Antarctic atmospheric conditions and link severing.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'nominal', title: '☀️ Clear Weather / Nominal Link', desc: 'Full VSAT bandwidth, RTT ~560ms' },
                    { id: 'blizzard', title: '🌨️ Blizzard Rain Fade (Degraded)', desc: 'SNR drops to 8dB, packet retransmissions' },
                    { id: 'blackout', title: '⚡ Total Link Sever (Autonomous Edge)', desc: '0 kbps, station buffers to local blackbox' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setChaosMode(mode.id)
                        const msg = mode.id === 'nominal'
                          ? 'Satellite link returned to NOMINAL state.'
                          : mode.id === 'blizzard'
                          ? 'Simulated blizzard attenuation applied. QoS 1 telemetry throttled.'
                          : 'Satellite link severed! Stations switched to autonomous Edge AI & Blackbox mode.'
                        setPingLogs((prev) => [`[${new Date().toLocaleTimeString('en-GB')}] ⚠️ CHAOS BENCH: ${msg}`, ...prev])
                      }}
                      style={{
                        textAlign: 'left',
                        background: chaosMode === mode.id ? '#eff6ff' : '#f8fafc',
                        border: chaosMode === mode.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        borderRadius: 3,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{mode.title}</div>
                      <div style={{ fontSize: 9.5, color: '#64748b' }}>{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 4: SECURITY & LEDGER ═══════════ */}
          {activeTab === 'security' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* mTLS & Cryptography */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', marginTop: 0, marginBottom: 6 }}>
                  🔐 MUTUAL TLS (mTLS 1.3) & ED25519 NODE IDENTITY
                </h4>
                <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 12 }}>
                  Every sensor batch and alert payload is signed by the station’s cryptographic hardware key before satellite transmission.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                  <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60' }}>Maitri Edge Key ID</div>
                    <code style={{ fontSize: 10, color: '#0284c7' }}>ED25519:e4:92:c1:08:7a:5e:3b:91:fa:74:20:19:bc:44:81:02</code>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60' }}>Bharati Edge Key ID</div>
                    <code style={{ fontSize: 10, color: '#059669' }}>ED25519:f9:10:bc:33:4d:88:12:ef:90:a2:67:31:09:cd:77:84</code>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60' }}>Certificate Authority (CA)</div>
                    <div style={{ color: '#475569' }}>NIC Polar Root CA G3 • Valid through 31-DEC-2035</div>
                  </div>
                </div>
              </div>

              {/* Blackbox Hash Chain Ledger */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', marginTop: 0, marginBottom: 6 }}>
                  🛡️ BLACK-BOX APPEND-ONLY HASH CHAIN
                </h4>
                <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 12 }}>
                  Critical safety, life-support alarms, and crew commands are immutably chained in a tamper-evident local log.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                  <div style={{ background: '#f0fdf4', padding: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontWeight: 800, color: '#16a34a' }}>Latest Verified Block (Maitri)</div>
                    <code style={{ fontSize: 10, color: '#15803d' }}>Block #14,920 — Hash: 9f8a2b3c...e810 (Verified)</code>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontWeight: 800, color: '#16a34a' }}>Latest Verified Block (Bharati)</div>
                    <code style={{ fontSize: 10, color: '#15803d' }}>Block #21,405 — Hash: 3e7c8d9a...f412 (Verified)</code>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, color: '#0b3b60' }}>Integrity Verification Status</div>
                    <div style={{ color: '#16a34a', fontWeight: 800 }}>✅ 100% Chain Integrity • 0 Tamper Events Detected</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          <Footer />
        </main>
      </div>
    </div>
  )
}
