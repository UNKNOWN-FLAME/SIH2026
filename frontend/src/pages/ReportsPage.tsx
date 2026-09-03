import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'

type ReportType = 'daily' | 'monthly' | 'incident' | 'scientific' | 'audit'

const REPORT_DATA: Record<ReportType, Array<{ id: string; title: string; station: string; date: string; author: string; pages: number; classification: string; status: string; format: string }>> = {
  daily: [
    { id: 'DR-2026-0902', title: 'Station Operations Daily Bulletin — 02 Sep 2026', station: 'Both Stations', date: '2026-09-02', author: 'Station Commander', pages: 8, classification: 'OFFICIAL', status: 'PUBLISHED', format: 'PDF' },
    { id: 'DR-2026-0901', title: 'Station Operations Daily Bulletin — 01 Sep 2026', station: 'Both Stations', date: '2026-09-01', author: 'Station Commander', pages: 8, classification: 'OFFICIAL', status: 'PUBLISHED', format: 'PDF' },
    { id: 'DR-2026-0831', title: 'Station Operations Daily Bulletin — 31 Aug 2026', station: 'Both Stations', date: '2026-08-31', author: 'Station Commander', pages: 7, classification: 'OFFICIAL', status: 'PUBLISHED', format: 'PDF' },
    { id: 'DR-2026-0830', title: 'Station Operations Daily Bulletin — 30 Aug 2026', station: 'Both Stations', date: '2026-08-30', author: 'Station Commander', pages: 8, classification: 'OFFICIAL', status: 'ARCHIVED', format: 'PDF' },
  ],
  monthly: [
    { id: 'MR-2026-08', title: 'August 2026 — Comprehensive Station Report', station: 'Both Stations', date: '2026-09-01', author: 'Station Director', pages: 48, classification: 'RESTRICTED', status: 'PUBLISHED', format: 'PDF' },
    { id: 'MR-2026-07', title: 'July 2026 — Comprehensive Station Report', station: 'Both Stations', date: '2026-08-01', author: 'Station Director', pages: 52, classification: 'RESTRICTED', status: 'PUBLISHED', format: 'PDF' },
    { id: 'MR-2026-06', title: 'June 2026 — Comprehensive Station Report', station: 'Both Stations', date: '2026-07-01', author: 'Station Director', pages: 45, classification: 'RESTRICTED', status: 'ARCHIVED', format: 'PDF' },
  ],
  incident: [
    { id: 'IR-2026-004', title: 'Satellite Link Outage — Bharati Station, 18 Aug 2026', station: 'Bharati', date: '2026-08-19', author: 'Communications Officer', pages: 12, classification: 'SENSITIVE', status: 'CLOSED', format: 'PDF' },
    { id: 'IR-2026-003', title: 'Generator DG-1 Temporary Shutdown — Maitri, 12 Jul 2026', station: 'Maitri', date: '2026-07-13', author: 'Chief Engineer', pages: 18, classification: 'OFFICIAL', status: 'CLOSED', format: 'PDF' },
    { id: 'IR-2026-002', title: 'Crew Medical Incident — Maitri, 08 Jun 2026', station: 'Maitri', date: '2026-06-09', author: 'Medical Officer', pages: 6, classification: 'CONFIDENTIAL', status: 'CLOSED', format: 'PDF' },
  ],
  scientific: [
    { id: 'SR-2026-012', title: 'Upper Atmosphere Ozone Depletion Study — 45th ISEA', station: 'Both', date: '2026-08-30', author: 'Dr. R. Sharma, NPL', pages: 34, classification: 'PUBLIC', status: 'PEER REVIEW', format: 'PDF' },
    { id: 'SR-2026-011', title: 'Schirmacher Oasis Glacial Retreat — 2021-2026 Observations', station: 'Maitri', date: '2026-08-15', author: 'Dr. P. Nair, GSI', pages: 62, classification: 'PUBLIC', status: 'PUBLISHED', format: 'PDF' },
    { id: 'SR-2026-010', title: 'Southern Ocean Primary Productivity — Winter Campaign 2026', station: 'Bharati', date: '2026-07-28', author: 'Dr. K. Menon, NIO', pages: 41, classification: 'PUBLIC', status: 'PUBLISHED', format: 'PDF' },
  ],
  audit: [
    { id: 'AR-2026-02', title: 'Q2 2026 Systems & Safety Compliance Audit', station: 'Both Stations', date: '2026-08-01', author: 'NCPOR Internal Audit', pages: 28, classification: 'RESTRICTED', status: 'COMPLETED', format: 'PDF' },
    { id: 'AR-2026-01', title: 'Q1 2026 Financial & Operations Audit', station: 'Both Stations', date: '2026-05-01', author: 'CAG / NCPOR', pages: 35, classification: 'RESTRICTED', status: 'COMPLETED', format: 'PDF' },
  ],
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<ReportType>('daily')
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null)

  const tabs: { id: ReportType; label: string; icon: string; count: number }[] = [
    { id: 'daily', label: 'Daily Bulletins', icon: 'today', count: REPORT_DATA.daily.length },
    { id: 'monthly', label: 'Monthly Reports', icon: 'calendar_month', count: REPORT_DATA.monthly.length },
    { id: 'incident', label: 'Incident Reports', icon: 'report', count: REPORT_DATA.incident.length },
    { id: 'scientific', label: 'Scientific Publications', icon: 'science', count: REPORT_DATA.scientific.length },
    { id: 'audit', label: 'Audit & Compliance', icon: 'fact_check', count: REPORT_DATA.audit.length },
  ]

  const reports = REPORT_DATA[activeTab].filter(r =>
    !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleDownload(r: typeof reports[0]) {
    setDownloadMsg(`[${new Date().toLocaleTimeString('en-GB')}] Download initiated: ${r.id} — ${r.title} (${r.pages} pages, ${r.format})`)
    setTimeout(() => setDownloadMsg(null), 4000)
  }

  function getClassColor(cls: string) {
    if (cls === 'CONFIDENTIAL' || cls === 'SENSITIVE') return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
    if (cls === 'RESTRICTED') return { color: '#d97706', bg: '#fef3c7', border: '#fde68a' }
    if (cls === 'OFFICIAL') return { color: '#0b3b60', bg: '#f0f9ff', border: '#bae6fd' }
    return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }
  }

  function getStatusColor(status: string) {
    if (status === 'PUBLISHED' || status === 'COMPLETED' || status === 'CLOSED') return '#16a34a'
    if (status === 'PEER REVIEW') return '#7c3aed'
    if (status === 'ARCHIVED') return '#64748b'
    return '#d97706'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Home</button>
                <span>›</span><span style={{ color: '#ea580c', fontWeight: 800 }}>Official Reports</span>
              </div>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>REF: NCPOR/REPORTS/GIGW/2026 | CLASSIFIED PORTAL</span>
            </div>

            <div style={{ background: '#0b3b60', color: '#fff', padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>📄 OFFICIAL REPORTS — NCPOR DOCUMENT MANAGEMENT SYSTEM</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>GIGW 3.0 Compliant • NIC Secure Document Repository • All reports digitally signed</div>
              </div>
              <div style={{ fontSize: 10, color: '#ff9933', fontWeight: 700, background: 'rgba(255,153,51,0.1)', padding: '4px 12px', border: '1px solid rgba(255,153,51,0.3)' }}>
                🔒 OFFICIAL PORTAL ACCESS
              </div>
            </div>

            {downloadMsg && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 14px', marginBottom: 10, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                {downloadMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', border: `2px solid ${activeTab === tab.id ? '#0b3b60' : '#e2e8f0'}`, background: activeTab === tab.id ? '#0b3b60' : '#fff', color: activeTab === tab.id ? '#fff' : '#475569', cursor: 'pointer', fontWeight: activeTab === tab.id ? 800 : 600, fontSize: 11, transition: 'all 0.15s' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div>{tab.label}</div>
                    <div style={{ fontSize: 9, opacity: 0.7 }}>{tab.count} documents</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#64748b' }}>search</span>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by report ID, title or keyword..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'Inter', color: '#1e293b' }} />
              {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>}
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{reports.length} results</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8 }}>search_off</span>
                  No reports found matching your query.
                </div>
              ) : reports.map(r => {
                const cls = getClassColor(r.classification)
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ flexShrink: 0, width: 44, height: 52, background: '#0b3b60', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20 }}>description</span>
                      <span style={{ color: '#ff9933', fontSize: 7, fontWeight: 800 }}>{r.format}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, color: '#0b3b60', fontSize: 11 }}>{r.id}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: cls.color, background: cls.bg, padding: '1px 6px', border: `1px solid ${cls.border}` }}>{r.classification}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: getStatusColor(r.status) }}>● {r.status}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 12, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#64748b' }}>
                        <span>📍 {r.station}</span>
                        <span>📅 {r.date}</span>
                        <span>✍️ {r.author}</span>
                        <span>📃 {r.pages} pages</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleDownload(r)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0b3b60', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>Download
                      </button>
                      <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', color: '#0b3b60', border: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>View
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px', marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 8, letterSpacing: '0.05em' }}>DOCUMENT MANAGEMENT SYSTEM INFO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 10 }}>
                {[{ label: 'Repository', value: 'NIC Secure Cloud Storage', icon: 'cloud' },{ label: 'Encryption', value: 'AES-256 at rest & transit', icon: 'lock' },{ label: 'Digital Signatures', value: 'PKI / eSign (MeITY)', icon: 'verified' },{ label: 'Retention Policy', value: 'Daily: 90d • Monthly: 10yr', icon: 'history' }].map(info => (
                  <div key={info.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0b3b60' }}>{info.icon}</span>
                    <div><div style={{ fontWeight: 700, color: '#0b3b60' }}>{info.label}</div><div style={{ color: '#64748b' }}>{info.value}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
