import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useReport } from '../hooks/useReport'
import { downloadReportFile } from '../api/hq'
import ArchivedGazetteModal from '../components/telemetry/ArchivedGazetteModal'
import { generateOfficialReportPDF } from '../utils/pdfGenerator'

type ReportType = 'daily' | 'monthly' | 'incident' | 'scientific' | 'audit' | 'sitrep'

// ── Types matching backend response ────────────────────────────────────────
interface AlertRow {
  alert_id: string
  severity: string
  domain: string
  description: string
  triggered_at: string
  ack_state: string
}
interface SensorRow {
  sensor_id: string
  domain: string
  value: number
  unit: string
  ts: string
}
interface InventoryRow {
  name: string
  category: string
  quantity: number
  unit: string
  days_remaining: number | null
  status: string
}
interface AssetRow {
  name: string
  asset_type: string
  status: string
}
interface StationInfo {
  display_name: string
  link_state: string
  open_critical_alerts: number
  open_high_alerts: number
  services_healthy: boolean | null
}

// ── Helper colours ──────────────────────────────────────────────────────────
function sevColor(sev: string) {
  if (sev === 'CRITICAL') return '#dc2626'
  if (sev === 'HIGH') return '#d97706'
  if (sev === 'MEDIUM') return '#0b3b60'
  return '#16a34a'
}
function statusColor(s: string) {
  if (s === 'NOMINAL' || s === 'ACTIVE') return '#16a34a'
  if (s === 'WARNING' || s === 'UNDER_MAINTENANCE') return '#d97706'
  return '#dc2626'
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ReportType>('daily')
  const [selectedStation, setSelectedStation] = useState<string>('both')
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const stationId = selectedStation === 'both' ? undefined : selectedStation

  // ── Live DB data via backend ────────────────────────────────────────────
  const { data: reportData, isLoading, error } = useReport(
    activeTab === 'sitrep' ? 'daily' : activeTab,
    stationId,
  )

  const tabs: { id: ReportType; label: string; icon: string; badge?: string }[] = [
    { id: 'daily',      label: 'Daily Ops',           icon: 'today' },
    { id: 'monthly',    label: 'Monthly Summary',      icon: 'calendar_month' },
    { id: 'incident',   label: 'Incident / Alerts',    icon: 'report' },
    { id: 'scientific', label: 'Scientific / Sensors', icon: 'science' },
    { id: 'audit',      label: 'Audit / Inventory',    icon: 'fact_check' },
    { id: 'sitrep',     label: 'Weekly SitReps (>7d)', icon: 'policy', badge: 'GAZETTE PDF' },
  ]

  // Convenience accessors into the report JSON
  const alertSummary = reportData?.alert_summary as {
    counts_by_severity: Record<string, number>
    total_last_30d: number
    recent: AlertRow[]
  } | undefined

  const stationsInfo = reportData?.stations as Record<string, StationInfo> | undefined
  const sensorSummary = reportData?.sensor_summary as Record<string, { readings_24h: number; latest: SensorRow[] }> | undefined
  const inventory = reportData?.inventory as Record<string, InventoryRow[]> | undefined
  const assets = reportData?.assets as Record<string, AssetRow[]> | undefined
  const stationIds = (reportData?.station_ids as string[] | undefined) ?? []

  async function handleDownload() {
    setIsDownloading(true)
    try {
      const result = await downloadReportFile(activeTab, stationId)
      // Trigger browser file download
      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadMsg(`Downloaded: ${result.filename}`)
      setTimeout(() => setDownloadMsg(null), 5000)
    } catch {
      setDownloadMsg('Download failed — please try again')
      setTimeout(() => setDownloadMsg(null), 4000)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Home</button>
                <span>›</span><span style={{ color: '#ea580c', fontWeight: 800 }}>Reports</span>
              </div>
            </div>

            {/* Header */}
            <div style={{ background: '#0b3b60', color: '#fff', padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>OFFICIAL REPORTS — NCPOR DOCUMENT MANAGEMENT SYSTEM</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Station filter */}
                {(['both', 'maitri', 'bharati'] as const).map(s => (
                  <button key={s} onClick={() => setSelectedStation(s)}
                    style={{ background: selectedStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)', border: `2px solid ${selectedStation === s ? '#ff9933' : 'rgba(255,255,255,0.2)'}`, color: '#fff', padding: '4px 10px', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Download notification */}
            {downloadMsg && (
              <div style={{ background: downloadMsg.includes('failed') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${downloadMsg.includes('failed') ? '#fecaca' : '#bbf7d0'}`, padding: '8px 14px', marginBottom: 10, fontSize: 11, fontWeight: 700, color: downloadMsg.includes('failed') ? '#dc2626' : '#16a34a' }}>
                {downloadMsg}
              </div>
            )}

            {/* Report Type Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 10px',
                    border: `2px solid ${activeTab === tab.id ? (tab.id === 'sitrep' ? '#ea580c' : '#0b3b60') : '#e2e8f0'}`,
                    background: activeTab === tab.id ? (tab.id === 'sitrep' ? '#0b3b60' : '#0b3b60') : '#fff',
                    color: activeTab === tab.id ? '#fff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: activeTab === tab.id ? 800 : 600,
                    fontSize: 10.5,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 16,
                      color: tab.id === 'sitrep' ? (activeTab === tab.id ? '#ff9933' : '#ea580c') : undefined,
                    }}
                  >
                    {tab.icon}
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div>{tab.label}</div>
                    {tab.badge && (
                      <div style={{ fontSize: 8.5, color: activeTab === tab.id ? '#ff9933' : '#ea580c', fontWeight: 800 }}>
                        {tab.badge}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* When Weekly SitRep tab is selected: show embedded Government Gazette Viewer */}
            {activeTab === 'sitrep' && (
              <div style={{ marginTop: 4 }}>
                <ArchivedGazetteModal
                  stationId={selectedStation === 'bharati' ? 'bharati' : 'maitri'}
                  inline={true}
                />
              </div>
            )}

            {activeTab !== 'sitrep' && (
              <>

            {/* Loading / Error states */}
            {isLoading && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#64748b' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, color: '#0b3b60' }}>hourglass_empty</span>
                Loading official report telemetry…
              </div>
            )}

            {error && !isLoading && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '14px 16px', color: '#dc2626', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#dc2626' }}>error</span>
                <span>Unable to load report data. Please verify central telemetry server connection.</span>
              </div>
            )}

            {!isLoading && !error && reportData && (
              <>
                {/* Station Status Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stationIds.length}, 1fr)`, gap: 10, marginBottom: 12 }}>
                  {stationIds.map(sid => {
                    const info = stationsInfo?.[sid]
                    if (!info) return null
                    const isUp = info.link_state === 'UP'
                    const isDegraded = info.link_state === 'DEGRADED'
                    return (
                      <div
                        key={sid}
                        style={{
                          background: '#fff',
                          border: '1px solid #cbd5e1',
                          padding: '12px 16px',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 4,
                            height: '100%',
                            background: isUp ? '#16a34a' : isDegraded ? '#d97706' : '#dc2626',
                          }}
                        />
                        <div style={{ marginLeft: 6 }}>
                          {/* Card Top Row: Station Name + Professional Link Status */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.02em' }}>
                                {info.display_name}
                              </div>
                              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600, marginTop: 1 }}>
                                {sid === 'maitri' ? '70°45′S, 11°44′E • Schirmacher Oasis' : '69°24′S, 76°11′E • Larsemann Hills'}
                              </div>
                            </div>

                            {/* Link Status Pill */}
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 8px',
                                borderRadius: 2,
                                background: isUp ? '#f0fdf4' : isDegraded ? '#fffbeb' : '#fef2f2',
                                border: `1px solid ${isUp ? '#86efac' : isDegraded ? '#fde68a' : '#fca5a5'}`,
                                color: isUp ? '#15803d' : isDegraded ? '#b45309' : '#dc2626',
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.03em',
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: isUp ? '#16a34a' : isDegraded ? '#d97706' : '#dc2626',
                                  boxShadow: isUp ? '0 0 0 2px rgba(22, 163, 74, 0.2)' : 'none',
                                }}
                              />
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                {isUp ? 'satellite_alt' : 'cloud_off'}
                              </span>
                              <span>LINK {info.link_state}</span>
                            </div>
                          </div>

                          {/* Card Bottom Row: Structured Critical & High Metric Badges */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 10,
                              paddingTop: 8,
                              borderTop: '1px solid #f1f5f9',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Incidents:
                            </span>

                            {/* Critical Pill */}
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '2px 8px',
                                borderRadius: 2,
                                fontSize: 9.5,
                                fontWeight: 700,
                                background: info.open_critical_alerts > 0 ? '#fef2f2' : '#f8fafc',
                                border: `1px solid ${info.open_critical_alerts > 0 ? '#fca5a5' : '#e2e8f0'}`,
                                color: info.open_critical_alerts > 0 ? '#b91c1c' : '#64748b',
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: 13,
                                  color: info.open_critical_alerts > 0 ? '#dc2626' : '#94a3b8',
                                }}
                              >
                                error
                              </span>
                              <span>CRITICAL:</span>
                              <strong
                                style={{
                                  fontWeight: 800,
                                  color: info.open_critical_alerts > 0 ? '#b91c1c' : '#334155',
                                }}
                              >
                                {info.open_critical_alerts}
                              </strong>
                            </div>

                            {/* High Pill */}
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '2px 8px',
                                borderRadius: 2,
                                fontSize: 9.5,
                                fontWeight: 700,
                                background: info.open_high_alerts > 0 ? '#fffbeb' : '#f8fafc',
                                border: `1px solid ${info.open_high_alerts > 0 ? '#fde68a' : '#e2e8f0'}`,
                                color: info.open_high_alerts > 0 ? '#b45309' : '#64748b',
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: 13,
                                  color: info.open_high_alerts > 0 ? '#d97706' : '#94a3b8',
                                }}
                              >
                                warning
                              </span>
                              <span>HIGH:</span>
                              <strong
                                style={{
                                  fontWeight: 800,
                                  color: info.open_high_alerts > 0 ? '#b45309' : '#334155',
                                }}
                              >
                                {info.open_high_alerts}
                              </strong>
                            </div>

                            {/* System Status Summary */}
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: info.open_critical_alerts === 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: info.open_critical_alerts === 0 ? '#16a34a' : '#dc2626' }}>
                                {info.open_critical_alerts === 0 ? 'verified_user' : 'priority_high'}
                              </span>
                              <span>{info.open_critical_alerts === 0 ? 'Nominal Ops' : 'Action Required'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── DAILY / MONTHLY: Alert Summary + Sensor Readings ── */}
                {(activeTab === 'daily' || activeTab === 'monthly') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Alert KPI row */}
                    <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#0b3b60', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Alert Summary — Last 30 Days (Consolidated Incident Log)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
                          const config: Record<string, { bg: string; border: string; color: string; icon: string }> = {
                            CRITICAL: { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', icon: 'error' },
                            HIGH:     { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: 'warning' },
                            MEDIUM:   { bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1', icon: 'info' },
                            LOW:      { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: 'check_circle' },
                          }
                          const c = config[sev] || { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b', icon: 'info' }
                          return (
                            <div
                              key={sev}
                              style={{
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderRadius: 2,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 9.5, fontWeight: 800, color: c.color, letterSpacing: '0.05em' }}>
                                  {sev}
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: c.color, lineHeight: 1.15, marginTop: 2 }}>
                                  {alertSummary?.counts_by_severity[sev] ?? 0}
                                </div>
                              </div>
                              <span className="material-symbols-outlined" style={{ fontSize: 22, color: c.color, opacity: 0.8 }}>
                                {c.icon}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Latest sensor readings per station */}
                    {stationIds.map(sid => (
                      <div key={sid} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: '0.05em' }}>
                          {sid.toUpperCase()} — LATEST SENSOR READINGS &nbsp;
                          <span style={{ color: '#16a34a' }}>({sensorSummary?.[sid]?.readings_24h ?? 0} readings in last 24h)</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {(sensorSummary?.[sid]?.latest ?? []).map((s: SensorRow) => (
                            <div key={s.sensor_id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px' }}>
                              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>{s.sensor_id.split('.').slice(-2).join(' › ')}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{s.value.toFixed(2)} <span style={{ fontSize: 10, color: '#64748b' }}>{s.unit}</span></div>
                            </div>
                          ))}
                          {(sensorSummary?.[sid]?.latest ?? []).length === 0 && (
                            <div style={{ color: '#94a3b8', fontSize: 11, gridColumn: '1/-1' }}>No recent sensor data — run refresh_sensor_readings.py</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── INCIDENT: Alert List ── */}
                {activeTab === 'incident' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: '0.05em' }}>
                      RECENT ALERTS — LAST 30 DAYS ({alertSummary?.total_last_30d ?? 0} total)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(alertSummary?.recent ?? []).map((a: AlertRow) => (
                        <div key={a.alert_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 800, fontSize: 10, color: sevColor(a.severity), background: '#fff', border: `1px solid ${sevColor(a.severity)}`, padding: '2px 8px', flexShrink: 0 }}>{a.severity}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                              {new Date(a.triggered_at).toLocaleString('en-IN')} &nbsp;•&nbsp; Domain: {a.domain} &nbsp;•&nbsp; {a.ack_state}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(alertSummary?.recent ?? []).length === 0 && (
                        <div style={{ color: '#94a3b8', fontSize: 11, padding: 16, textAlign: 'center' }}>No alerts in the last 30 days.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SCIENTIFIC: Sensor data per domain ── */}
                {activeTab === 'scientific' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {stationIds.map(sid => (
                      <div key={sid} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 12, letterSpacing: '0.05em' }}>
                          {sid.toUpperCase()} — FULL SENSOR DATASET
                        </div>
                        {/* Group by domain */}
                        {['energy', 'weather', 'seismic'].map(domain => {
                          const sensors = (sensorSummary?.[sid]?.latest ?? []).filter((s: SensorRow) => s.domain === domain)
                          if (!sensors.length) return null
                          return (
                            <div key={domain} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#0b3b60', marginBottom: 6, textTransform: 'uppercase' }}>[{domain}]</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                                {sensors.map((s: SensorRow) => (
                                  <div key={s.sensor_id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px' }}>
                                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{s.sensor_id.split('.').slice(-1)[0].replace(/_/g, ' ').toUpperCase()}</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{s.value.toFixed(3)} <span style={{ fontSize: 10, color: '#64748b' }}>{s.unit}</span></div>
                                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{new Date(s.ts).toLocaleTimeString('en-IN')}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── AUDIT: Inventory + Assets ── */}
                {activeTab === 'audit' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {stationIds.map(sid => (
                      <div key={sid}>
                        {/* Inventory */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: '0.05em' }}>{sid.toUpperCase()} — INVENTORY AUDIT</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', fontSize: 10, textAlign: 'left' }}>
                                {['Item', 'Category', 'Quantity', 'Unit', 'Days Left', 'Status'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(inventory?.[sid] ?? []).map((item: InventoryRow) => (
                                <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1e293b' }}>{item.name}</td>
                                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{item.category}</td>
                                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0b3b60' }}>{item.quantity.toLocaleString()}</td>
                                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{item.unit}</td>
                                  <td style={{ padding: '7px 10px', color: item.days_remaining && item.days_remaining < 30 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                    {item.days_remaining ?? '—'}
                                  </td>
                                  <td style={{ padding: '7px 10px' }}>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: statusColor(item.status), background: '#f8fafc', padding: '2px 6px', border: '1px solid #e2e8f0' }}>{item.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Assets */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: '0.05em' }}>{sid.toUpperCase()} — ASSET REGISTER</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                            {(assets?.[sid] ?? []).map((a: AssetRow) => (
                              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0b3b60' }}>location_on</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 11, color: '#1e293b' }}>{a.name}</div>
                                  <div style={{ fontSize: 9, color: '#64748b' }}>{a.asset_type.replace(/_/g, ' ')} &nbsp;•&nbsp; <span style={{ color: statusColor(a.status), fontWeight: 700 }}>{a.status}</span></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Download / Export Bar */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px 16px', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Generated: {reportData?.generated_at ? new Date(reportData.generated_at as string).toLocaleString('en-IN') : '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => generateOfficialReportPDF({ reportType: activeTab, stationId, reportData })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'linear-gradient(135deg, #0b3b60 0%, #1e40af 100%)',
                        color: '#fff',
                        border: '1px solid #1e3a8a',
                        padding: '7px 14px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: 10.5,
                        borderRadius: 2,
                        boxShadow: '0 2px 4px rgba(11, 59, 96, 0.25)',
                      }}
                      title="Download official Government of India / MoES formatted Gazette PDF"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ff9933' }}>picture_as_pdf</span>
                      <span>Download Official PDF (Govt. Format)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#ea580c',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 14px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: 10.5,
                        borderRadius: 2,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }}
                      title="Print or export current operational report as official PDF"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
                      <span>Print Document</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isDownloading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: isDownloading ? '#94a3b8' : '#0b3b60',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 14px',
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                        fontWeight: 800,
                        fontSize: 10.5,
                        borderRadius: 2,
                      }}
                      title="Download raw plain-text audit record"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                      <span>{isDownloading ? 'Generating…' : `Raw Audit Log (.txt)`}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
              </>
            )}

            {/* Footer info bar */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px 16px', marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '0.05em' }}>DOCUMENT MANAGEMENT SYSTEM INFO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 10 }}>
                {[{ label: 'Data Store', value: 'Operational Relational Data Store', icon: 'database' }, { label: 'Encryption', value: 'AES-256 at rest & transit', icon: 'lock' }, { label: 'Digital Signatures', value: 'PKI / eSign (MeITY)', icon: 'verified' }, { label: 'Retention Policy', value: 'Daily: 90d • Monthly: 10yr', icon: 'history' }].map(info => (
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
