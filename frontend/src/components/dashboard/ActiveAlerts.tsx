import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAlerts, useAcknowledgeAlert } from '../../hooks/useAlerts'
import { useLanguage } from '../../context/LanguageContext'
import type { AlertOut } from '../../api/hq'
import { generateMissionAlertsPDF } from '../../utils/pdfGenerator'

interface Props {
  stationId: string
}

export interface StoredAlert extends AlertOut {
  stored_at: string
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#d97706',
  MEDIUM: '#0284c7',
  LOW: '#64748b',
}

const STORAGE_PREFIX = 'himantar_mission_alerts_store_'

function getStoredAlerts(stationId: string): StoredAlert[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${stationId.toLowerCase()}`)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to parse stored alerts:', e)
  }
  return []
}

function saveStoredAlerts(stationId: string, alerts: StoredAlert[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${stationId.toLowerCase()}`, JSON.stringify(alerts.slice(0, 150)))
  } catch (e) {
    console.error('Failed to save alerts to storage:', e)
  }
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return '—'
  }
}

function fullDateLabel(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  } catch {
    return '—'
  }
}

export default function ActiveAlerts({ stationId }: Props) {
  const currentStation = stationId.toLowerCase()
  const { data, isLoading } = useAlerts({ station_id: currentStation, ack_state: 'OPEN', page_size: 25 })
  const { mutate: ack, isPending } = useAcknowledgeAlert()
  const { t } = useLanguage()

  const [activeTab, setActiveTab] = useState<'active' | 'stored'>('active')
  const [storedAlerts, setStoredAlerts] = useState<StoredAlert[]>(() => getStoredAlerts(currentStation))
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set())
  const [sevFilter, setSevFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')


  // Sync incoming live alerts from backend into local archive
  useEffect(() => {
    const currentStored = getStoredAlerts(currentStation)
    const map = new Map<string, StoredAlert>()

    for (const a of currentStored) {
      map.set(a.alert_id, a)
    }

    let changed = false

    if (data?.items && data.items.length > 0) {
      for (const item of data.items) {
        const existing = map.get(item.alert_id)
        if (!existing) {
          map.set(item.alert_id, { ...item, stored_at: new Date().toISOString() })
          changed = true
        } else if (existing.ack_state !== item.ack_state) {
          map.set(item.alert_id, { ...existing, ...item })
          changed = true
        }
      }
    }

    if (changed) {
      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
      )
      saveStoredAlerts(currentStation, sorted)
      setStoredAlerts(sorted)
    }
  }, [data?.items, currentStation])

  // Computed active alerts, immediately filtering out acknowledged IDs
  const activeAlerts = useMemo(() => {
    const raw = data?.items ?? []
    return raw.filter((a) => !ackedIds.has(a.alert_id) && a.ack_state === 'OPEN')
  }, [data?.items, ackedIds])

  // Instant synchronized acknowledge handler
  const handleAcknowledge = useCallback(
    (alertId: string) => {
      // 1. Optimistically hide from active view immediately
      setAckedIds((prev) => new Set(prev).add(alertId))

      // 2. Call backend mutation
      ack({ alertId, note: 'Duty Officer Acknowledged' })

      // 3. Update persistent stored archive
      setStoredAlerts((prev) => {
        const updated = prev.map((a) =>
          a.alert_id === alertId
            ? {
                ...a,
                ack_state: 'ACKNOWLEDGED' as const,
                acknowledged_by: 'Station Duty Officer',
                acknowledged_at: new Date().toISOString(),
              }
            : a
        )
        saveStoredAlerts(currentStation, updated)
        return updated
      })
    },
    [ack, currentStation]
  )

  // Download official PDF SITREP report
  const handleDownloadPDF = useCallback(() => {
    const listToExport = storedAlerts.length > 0 ? storedAlerts : activeAlerts
    generateMissionAlertsPDF({
      stationId: currentStation,
      alerts: listToExport,
    })
  }, [currentStation, storedAlerts, activeAlerts])

  // Filtered stored archive for view/modal
  const filteredStored = useMemo(() => {
    return storedAlerts.filter((a) => {
      const matchSev = sevFilter === 'ALL' || a.severity === sevFilter
      const q = searchQuery.toLowerCase().trim()
      const matchQuery =
        !q ||
        a.description.toLowerCase().includes(q) ||
        (a.asset_id && a.asset_id.toLowerCase().includes(q)) ||
        a.domain.toLowerCase().includes(q) ||
        a.alert_id.toLowerCase().includes(q)
      return matchSev && matchQuery
    })
  }, [storedAlerts, sevFilter, searchQuery])

  return (
    <>
      {/* ── CARD ROOT CONTAINER: Strictly bounded so layout never distorts other cards ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          height: 255,
          maxHeight: 255,
          minHeight: 255,
          overflow: 'hidden',
          borderRadius: 2,
        }}
      >
        {/* Card Header Strip */}
        <div
          style={{
            background: '#0b3b60',
            borderBottom: '2px solid #ff9933',
            padding: '5px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            height: 35,
          }}
        >
          {/* Title & Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: activeAlerts.length > 0 ? '#ff9933' : '#4ade80', flexShrink: 0 }}
            >
              {activeAlerts.length > 0 ? 'notifications_active' : 'verified_user'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {t('alerts.title')}
            </span>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 2,
                background: activeAlerts.length > 0 ? '#dc2626' : 'rgba(22, 163, 74, 0.3)',
                color: '#ffffff',
                border: activeAlerts.length > 0 ? '1px solid #ef4444' : '1px solid #22c55e',
                flexShrink: 0,
              }}
            >
              {activeAlerts.length > 0 ? `${activeAlerts.length} OPEN` : 'NOMINAL'}
            </span>
          </div>

          {/* Action Tools: Tab Switcher, PDF Button, Expand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 2,
                border: activeTab === 'active' ? '1px solid #ff9933' : '1px solid rgba(255,255,255,0.2)',
                background: activeTab === 'active' ? '#ff9933' : 'rgba(255,255,255,0.1)',
                color: activeTab === 'active' ? '#0b3b60' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              Active ({activeAlerts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stored')}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 2,
                border: activeTab === 'stored' ? '1px solid #ff9933' : '1px solid rgba(255,255,255,0.2)',
                background: activeTab === 'stored' ? '#ff9933' : 'rgba(255,255,255,0.1)',
                color: activeTab === 'stored' ? '#0b3b60' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              Archive ({storedAlerts.length})
            </button>

            {/* ONLY PDF Download Option — Compact & Highlighted */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              title="Download Official Mission Alerts SITREP PDF"
              style={{
                fontSize: 9,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 2,
                background: '#dc2626',
                color: '#ffffff',
                border: '1px solid #ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                boxShadow: '0 1px 2px rgba(220,38,38,0.3)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                picture_as_pdf
              </span>
              <span>PDF</span>
            </button>

            {/* Expand Dialog */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Open Full Archive Modal"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                open_in_new
              </span>
            </button>
          </div>
        </div>

        {/* ── CARD BODY: Scrollable container strictly locked to remaining height ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '6px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {activeTab === 'active' ? (
            /* ──── ACTIVE ALERTS VIEW ──── */
            <>
              {isLoading && (
                <div style={{ fontSize: 10.5, color: '#64748b', padding: '16px 0', textAlign: 'center' }}>
                  {t('alerts.loading')}
                </div>
              )}

              {!isLoading && activeAlerts.length === 0 && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#166534',
                    padding: '10px 12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    fontWeight: 600,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>
                      check_circle
                    </span>
                    <span>{t('alerts.none')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stored')}
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: '#0b3b60',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Archived Events ({storedAlerts.length}) →
                  </button>
                </div>
              )}

              {activeAlerts.map((alert) => (
                <div
                  key={alert.alert_id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${SEV_COLOR[alert.severity] ?? '#64748b'}`,
                    padding: '5px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    borderRadius: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 900,
                        color: '#ffffff',
                        background: SEV_COLOR[alert.severity] ?? '#64748b',
                        padding: '1px 5px',
                        borderRadius: 2,
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      {alert.severity}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', fontFamily: 'monospace' }}>
                          {timeLabel(alert.triggered_at)} IST
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={alert.description}
                        >
                          {alert.description}
                        </span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#64748b' }}>
                        {alert.asset_id ? `${alert.asset_id} • ` : ''}{alert.domain.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Acknowledge Button */}
                  <button
                    onClick={() => handleAcknowledge(alert.alert_id)}
                    disabled={isPending}
                    title="Acknowledge & Archive Incident"
                    style={{
                      background: '#0b3b60',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 8.5,
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#15803d'
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#0b3b60'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
                      done
                    </span>
                    <span>{t('alerts.ack')}</span>
                  </button>
                </div>
              ))}
            </>
          ) : (
            /* ──── STORED ALERTS ARCHIVE VIEW ──── */
            <>
              {/* Quick Severity Filter Pills */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 2,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSevFilter(sev)}
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 2,
                        border: `1px solid ${sevFilter === sev ? '#0b3b60' : '#cbd5e1'}`,
                        background: sevFilter === sev ? '#0b3b60' : '#ffffff',
                        color: sevFilter === sev ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: 8.5, color: '#64748b' }}>
                  {filteredStored.length} archived
                </span>
              </div>

              {filteredStored.length === 0 ? (
                <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  No archived alerts matching filter.
                </div>
              ) : (
                filteredStored.map((a) => (
                  <div
                    key={a.alert_id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderLeft: `3px solid ${SEV_COLOR[a.severity] ?? '#64748b'}`,
                      padding: '4px 7px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            fontSize: 7.5,
                            fontWeight: 900,
                            color: '#ffffff',
                            background: SEV_COLOR[a.severity] ?? '#64748b',
                            padding: '1px 4px',
                            borderRadius: 2,
                          }}
                        >
                          {a.severity}
                        </span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b' }}>
                          {timeLabel(a.triggered_at)} IST
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 7.5,
                          fontWeight: 800,
                          padding: '1px 4px',
                          borderRadius: 2,
                          background:
                            a.ack_state === 'OPEN'
                              ? '#fee2e2'
                              : a.ack_state === 'ACKNOWLEDGED'
                              ? '#fef3c7'
                              : '#dcfce7',
                          color:
                            a.ack_state === 'OPEN'
                              ? '#b91c1c'
                              : a.ack_state === 'ACKNOWLEDGED'
                              ? '#92400e'
                              : '#15803d',
                        }}
                      >
                        {a.ack_state === 'OPEN' ? 'OPEN' : a.ack_state === 'ACKNOWLEDGED' ? 'ACKED' : 'RESOLVED'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={a.description}
                    >
                      {a.description}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#64748b' }}>
                      <span>{a.asset_id || currentStation.toUpperCase()} • {a.domain}</span>
                      {a.acknowledged_by && <span>Ack: {a.acknowledged_by}</span>}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ──── FULL AUDIT ARCHIVE MODAL DIALOG ──── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: 880,
              maxHeight: '85vh',
              borderRadius: 4,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '2px solid #0b3b60',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0b3b60',
                borderBottom: '3px solid #ff9933',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ff9933' }}>
                  assignment_late
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.04em' }}>
                    MISSION ALERTS AUDIT ARCHIVE — {currentStation.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>
                    NCPOR Official Station Telemetry Alarms & Operational Incident Record
                  </div>
                </div>
              </div>

              {/* ONLY PDF Download & Close in Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  title="Download Certified Official MoES SITREP PDF"
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: 3,
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.4)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    picture_as_pdf
                  </span>
                  <span>Download PDF SITREP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    close
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Search & Severity Filters */}
            <div
              style={{
                padding: '8px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ position: 'relative', width: 260 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ position: 'absolute', left: 7, top: 6, fontSize: 16, color: '#64748b' }}
                >
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter by description, domain, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 8px 4px 26px',
                    fontSize: 11,
                    border: '1px solid #cbd5e1',
                    borderRadius: 3,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Severity:</span>
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSevFilter(sev)}
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 2,
                      border: `1px solid ${sevFilter === sev ? '#0b3b60' : '#cbd5e1'}`,
                      background: sevFilter === sev ? '#0b3b60' : '#ffffff',
                      color: sevFilter === sev ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Table Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 10.5 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#0b3b60', fontSize: 9.5, fontWeight: 900 }}>
                    <th style={{ padding: '8px 6px' }}>TIMESTAMP (IST)</th>
                    <th style={{ padding: '8px 6px' }}>SEVERITY</th>
                    <th style={{ padding: '8px 6px' }}>DESCRIPTION</th>
                    <th style={{ padding: '8px 6px' }}>ASSET & DOMAIN</th>
                    <th style={{ padding: '8px 6px' }}>STATUS</th>
                    <th style={{ padding: '8px 6px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStored.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                        No alerts match the filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredStored.map((a) => (
                      <tr
                        key={a.alert_id}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '6px 6px', fontFamily: 'monospace', color: '#475569', fontSize: 9.5 }}>
                          {fullDateLabel(a.triggered_at)}
                        </td>
                        <td style={{ padding: '6px 6px' }}>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 900,
                              color: '#ffffff',
                              background: SEV_COLOR[a.severity] ?? '#64748b',
                              padding: '1px 5px',
                              borderRadius: 2,
                            }}
                          >
                            {a.severity}
                          </span>
                        </td>
                        <td style={{ padding: '6px 6px', fontWeight: 700, color: '#0f172a', maxWidth: 300 }}>
                          {a.description}
                        </td>
                        <td style={{ padding: '6px 6px', color: '#64748b' }}>
                          <span style={{ fontWeight: 800, color: '#334155' }}>{a.asset_id || currentStation.toUpperCase()}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8', display: 'block' }}>{a.domain}</span>
                        </td>
                        <td style={{ padding: '6px 6px' }}>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 2,
                              background:
                                a.ack_state === 'OPEN'
                                  ? '#fee2e2'
                                  : a.ack_state === 'ACKNOWLEDGED'
                                  ? '#fef3c7'
                                  : '#dcfce7',
                              color:
                                a.ack_state === 'OPEN'
                                  ? '#b91c1c'
                                  : a.ack_state === 'ACKNOWLEDGED'
                                  ? '#92400e'
                                  : '#15803d',
                            }}
                          >
                            {a.ack_state}
                          </span>
                        </td>
                        <td style={{ padding: '6px 6px' }}>
                          {a.ack_state === 'OPEN' ? (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(a.alert_id)}
                              disabled={isPending}
                              style={{
                                fontSize: 8.5,
                                fontWeight: 800,
                                padding: '2px 7px',
                                background: '#0b3b60',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 2,
                                cursor: 'pointer',
                              }}
                            >
                              Acknowledge
                            </button>
                          ) : (
                            <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>ACKNOWLEDGED</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '8px 16px',
                background: '#f1f5f9',
                borderTop: '1px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 10,
                color: '#64748b',
              }}
            >
              <span>Total Archive: <strong>{storedAlerts.length} entries recorded</strong></span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: '#0b3b60',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: 2,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
