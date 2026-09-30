import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStation } from '../../context/StationContext'
import { useLanguage } from '../../context/LanguageContext'
import { generateBlackoutIncidentSitrepPdf, generateIncidentDamageAssessmentPDF } from '../../utils/pdfGenerator'
import { getAnomalyModel } from './IncidentImpactModal'

interface Props {
  stationId: string
}

export default function OfflineBlackoutAuditCard({ stationId }: Props) {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const {
    postBlackoutIncident,
    closeBlackoutModal,
    linkState,
    edgeBufferCount,
    lastAnomalyResult,
    isTelemetrySyncing,
    syncProgress,
    syncStage,
    completedIncidentResult,
    openImpactModal,
    clearCompletedIncident,
  } = useStation()

  // State to control the Rollover Drawer overlay
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Real-time cycling hash animation for authentic data stream feel
  const [streamingHash, setStreamingHash] = useState('0x8f3c4e12b7a90dc4')

  useEffect(() => {
    if (!isTelemetrySyncing) return
    const timer = setInterval(() => {
      const hex = '0123456789abcdef'
      let h = '0x'
      for (let i = 0; i < 16; i++) {
        h += hex[Math.floor(Math.random() * hex.length)]
      }
      setStreamingHash(h)
    }, 120)
    return () => clearInterval(timer)
  }, [isTelemetrySyncing])

  // Incident determination
  const activeIncident = postBlackoutIncident || (lastAnomalyResult?.injectedWhileOffline && linkState === 'UP' ? lastAnomalyResult : null)
  const isHindi = lang === 'hi'
  const isDown = linkState === 'DOWN'

  // Completed incident loss model for post-anomaly summary card
  const effectiveCompletedIncident = useMemo(() => {
    if (completedIncidentResult) return completedIncidentResult
    if (lastAnomalyResult && (lastAnomalyResult.consoleEnded || lastAnomalyResult.hqAcknowledged)) {
      return lastAnomalyResult
    }
    return null
  }, [completedIncidentResult, lastAnomalyResult])

  const completedModel = useMemo(() => {
    if (!effectiveCompletedIncident) return null
    const aid = effectiveCompletedIncident.anomaly_id || 'generator_failure'
    return getAnomalyModel(aid, stationId)
  }, [effectiveCompletedIncident, stationId])

  const timeStr = activeIncident?.occurredAt
    ? new Date(activeIncident.occurredAt).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' IST'
    : 'During Blackout'

  return (
    <>
      {/* ── 1. Compact Dashboard Card (Fixed Height ~135-155px - Never Breaks Bento Grid!) ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          border: activeIncident
            ? '1.5px solid #f59e0b'
            : isTelemetrySyncing
            ? '1.5px solid #0284c7'
            : effectiveCompletedIncident && completedModel
            ? '1px solid #cbd5e1'
            : isDown
            ? '1px solid #fca5a5'
            : '1px solid #cbd5e1',
          boxShadow: activeIncident
            ? '0 3px 12px rgba(245, 158, 11, 0.16)'
            : isTelemetrySyncing
            ? '0 0 16px rgba(2, 132, 199, 0.25)'
            : effectiveCompletedIncident && completedModel
            ? '0 2px 8px rgba(15, 23, 42, 0.06)'
            : '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 135,
          maxHeight: 155,
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Government of India Micro Tricolor Bar */}
        <div style={{ height: 2.5, display: 'flex', width: '100%', flexShrink: 0 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#e2e8f0' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>

        {/* ── Mode A: Government of India GSAT-7 Telemetry Sync Animation ── */}
        {isTelemetrySyncing ? (
          <div
            style={{
              padding: '9px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              background: '#ffffff',
              color: '#0f172a',
            }}
          >
            {/* Header with Gov Insignia */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, animation: 'spin 3s linear infinite', display: 'inline-block' }}>🛰️</span>
                <div>
                  <div style={{ fontSize: 7.5, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    भारत सरकार • NCPOR GOA
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 900, color: '#072a44', letterSpacing: '0.02em' }}>
                    GSAT-7 S-BAND TELEMETRY
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 900,
                  color: '#15803d',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontFamily: 'monospace',
                }}
              >
                {syncProgress}%
              </span>
            </div>

            {/* Official Government Telemetry Progress Bar */}
            <div style={{ margin: '3px 0' }}>
              <div
                style={{
                  height: 8,
                  background: '#e2e8f0',
                  borderRadius: 2,
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${syncProgress}%`,
                    background: 'linear-gradient(90deg, #ff9933 0%, #0b3b60 60%, #16a34a 100%)',
                    borderRadius: 1,
                    transition: 'width 0.25s ease-out',
                  }}
                />
              </div>
              <div style={{ fontSize: 8.5, color: '#475569', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                {syncStage || 'Validating Protobuf telemetry frames...'}
              </div>
            </div>

            {/* Cryptographic stream packet ticker */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 8,
                color: '#475569',
                background: '#f8fafc',
                padding: '2px 6px',
                borderRadius: 3,
                border: '1px solid #cbd5e1',
              }}
            >
              <span style={{ fontFamily: 'monospace', color: '#0b3b60', fontWeight: 700 }}>
                BLOCK: {streamingHash}
              </span>
              <span style={{ fontWeight: 800, color: '#15803d' }}>
                ● CRC-32: VALIDATED
              </span>
            </div>
          </div>
        ) : activeIncident ? (
          /* ── Mode B: Incident Present (Compact Card with Rollover trigger) ── */
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 13 }}>⚠️</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#92400e', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {isHindi ? 'ब्लैकआउट विसंगति रिपोर्ट' : 'OFFLINE BLACKOUT AUDIT'}
                </span>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: activeIncident.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                  color: activeIncident.severity === 'CRITICAL' ? '#b91c1c' : '#b45309',
                  border: `1px solid ${activeIncident.severity === 'CRITICAL' ? '#fca5a5' : '#fde68a'}`,
                }}
              >
                {activeIncident.severity}
              </span>
            </div>

            {/* Incident Name & timing */}
            <div style={{ margin: '4px 0', minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeIncident.anomaly_name}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>🕒 {timeStr}</span>
                <span>•</span>
                <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#475569' }}>{activeIncident.category || 'Subsystem'}</span>
              </div>
            </div>

            {/* Action Buttons: Opens Rollover Drawer or Black Box without pushing page layout! */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <button
                onClick={() => setIsDrawerOpen(true)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '5px 8px',
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.25)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#d97706')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)')}
                title="Click to open slide-over report drawer without altering screen layout"
              >
                <span>📂</span>
                <span>{isHindi ? 'रिपोर्ट खोलें (रोलओवर)' : 'VIEW AUDIT (ROLLOVER)'}</span>
              </button>

              <button
                onClick={() => navigate('/blackbox')}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: 4,
                  padding: '5px 8px',
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0f172a')}
                title="Open Black Box flight recorder"
              >
                <span>📦</span>
                <span>{isHindi ? 'ब्लैक बॉक्स' : 'BLACK BOX'}</span>
              </button>
            </div>
          </div>
        ) : effectiveCompletedIncident && completedModel ? (
          /* ── Mode D: Post-Anomaly Completed Incident Summary ── */
          <div style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#15803d',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>assessment</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#0b3b60', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isHindi ? 'विसंगति नुकसान रिपोर्ट' : 'INCIDENT LOSS REPORT'}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {effectiveCompletedIncident.anomaly_name || completedModel.title}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>
                  <span>RESOLVED</span>
                </span>
                <button
                  type="button"
                  onClick={clearCompletedIncident}
                  title="Clear & Acknowledge this incident report"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444'
                    e.currentTarget.style.background = '#fee2e2'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                </button>
              </div>
            </div>

            {/* Mini Loss KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, margin: '2px 0 5px 0' }}>
              {/* Energy Tile */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #d97706',
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Energy
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#d97706' }}>bolt</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                  {completedModel.energyLossKwh} <span style={{ fontSize: 8.5, fontWeight: 600, color: '#64748b' }}>kWh</span>
                </div>
              </div>

              {/* Fuel Tile */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #dc2626',
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Fuel
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#dc2626' }}>local_gas_station</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                  {completedModel.fuelLossLitres} <span style={{ fontSize: 8.5, fontWeight: 600, color: '#64748b' }}>L</span>
                </div>
              </div>

              {/* Cost Tile */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #0284c7',
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Cost
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#0284c7' }}>payments</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                  ₹{completedModel.financialLossInr.toLocaleString()}
                </div>
              </div>

              {/* Downtime Tile */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #7c3aed',
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Downtime
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#7c3aed' }}>schedule</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                  ~{completedModel.downtimeHours} <span style={{ fontSize: 8.5, fontWeight: 600, color: '#64748b' }}>hrs</span>
                </div>
              </div>
            </div>

            {/* Action buttons: View Full Report + Download PDF + Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
              <button
                type="button"
                onClick={openImpactModal}
                style={{
                  flex: 1.2,
                  height: 26,
                  background: '#0b3b60',
                  color: '#ffffff',
                  border: '1px solid #07253d',
                  borderRadius: 4,
                  padding: '0 8px',
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 2px rgba(11, 59, 96, 0.15)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#0e4a7a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0b3b60')}
                title="Open full Incident Damage, Loss & Shipment Report"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>assignment</span>
                <span>{isHindi ? 'पूरी रिपोर्ट' : 'FULL REPORT'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  generateIncidentDamageAssessmentPDF({
                    stationId,
                    anomalyName: effectiveCompletedIncident.anomaly_name || completedModel.title,
                    anomalyId: effectiveCompletedIncident.anomaly_id,
                    severity: effectiveCompletedIncident.severity || completedModel.severity,
                    referenceId: effectiveCompletedIncident.report_reference || effectiveCompletedIncident.incident_id || 'INC-POLAR-99',
                    injectedAt: effectiveCompletedIncident.injected_at,
                    losses: {
                      energyLossKwh: completedModel.energyLossKwh,
                      powerSpikeKw: completedModel.powerSpikeKw,
                      normalPowerKw: completedModel.normalPowerKw,
                      anomalyPowerKw: completedModel.anomalyPowerKw,
                      fuelLossLitres: completedModel.fuelLossLitres,
                      normalFuelBurnLh: completedModel.normalFuelBurnLh,
                      anomalyFuelBurnLh: completedModel.anomalyFuelBurnLh,
                      financialLossInr: completedModel.financialLossInr,
                      carbonFootprintKg: completedModel.carbonFootprintKg,
                      dataLossMb: completedModel.dataLossMb,
                      packetsDelayed: completedModel.packetsDelayed,
                      tempVarianceC: completedModel.tempVarianceC,
                      downtimeHours: completedModel.downtimeHours,
                      subsystem: completedModel.subsystem,
                    },
                    departments: completedModel.impactsByDepartment.map((d: { dept: string; icon: string; color: string; badge: string; summary: string; details: string }) => ({
                      dept: d.dept,
                      badge: d.badge,
                      summary: d.summary,
                      details: d.details,
                    })),
                    actionChecklist: completedModel.actionChecklist,
                    shipmentItems: completedModel.shipmentRecommendations.map((r: { name: string; sku: string; category: string; quantity: number; unit: string; priority: string; reason: string }) => ({
                      name: r.name,
                      sku: r.sku,
                      category: r.category,
                      quantity: r.quantity,
                      unit: r.unit,
                      priority: r.priority,
                      reason: r.reason,
                    })),
                  })
                }}
                style={{
                  height: 26,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: 4,
                  padding: '0 8px',
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  letterSpacing: '0.02em',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dcfce7'
                  e.currentTarget.style.borderColor = '#4ade80'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f0fdf4'
                  e.currentTarget.style.borderColor = '#86efac'
                }}
                title="Download official Government Incident Damage Assessment PDF"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#15803d' }}>picture_as_pdf</span>
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={clearCompletedIncident}
                style={{
                  height: 26,
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  padding: '0 8px',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  letterSpacing: '0.02em',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2'
                  e.currentTarget.style.color = '#991b1b'
                  e.currentTarget.style.borderColor = '#fca5a5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.color = '#64748b'
                  e.currentTarget.style.borderColor = '#cbd5e1'
                }}
                title="Acknowledge & clear incident report, restoring GSAT-7 Flight Recorder"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>done_all</span>
                <span>{isHindi ? 'हटाएं' : 'CLEAR & ACK'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Mode C: Standby GSAT-7 Flight Recorder ── */
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{isDown ? '🔴' : '🛰️'}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: isDown ? '#991b1b' : '#0f172a', letterSpacing: '0.03em' }}>
                    {isHindi ? 'उपग्रह फ्लाइट रिकॉर्डर' : 'GSAT-7 FLIGHT RECORDER'}
                  </div>
                  <div style={{ fontSize: 8.5, color: isDown ? '#b91c1c' : '#64748b' }}>
                    NCPOR Autonomous Dual-Twin • {stationId.toUpperCase()}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  padding: '1.5px 6px',
                  borderRadius: 10,
                  background: isDown ? '#fee2e2' : '#ecfdf5',
                  color: isDown ? '#b91c1c' : '#059669',
                  border: `1px solid ${isDown ? '#fca5a5' : '#a7f3d0'}`,
                }}
              >
                {isDown ? 'EDGE BUFFERING' : 'SYNCHRONIZED'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, margin: '4px 0' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 4, padding: '4px 6px' }}>
                <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>Local SSD Buffer</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a' }}>
                  {isDown ? `${edgeBufferCount || 92} frames` : '0 frames (Flushed)'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 4, padding: '4px 6px' }}>
                <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>SHA-256 Chain</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a' }}>100% Zero Loss</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ fontSize: 8.5, color: '#64748b' }}>
                {isDown ? 'Local NVMe SSD logging' : 'GSAT-7 in telemetry parity'}
              </div>
              <button
                onClick={() => navigate('/blackbox')}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0f172a')}
              >
                <span>📦</span>
                <span>{isHindi ? 'ब्लैक बॉक्स' : 'BLACK BOX'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Screen Rollover Drawer (Slide-Over Panel - Zero Layout Disruption!) ── */}
      {isDrawerOpen && activeIncident && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          {/* Drawer Container */}
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              height: '100%',
              background: '#ffffff',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top National Ribbon */}
            <div style={{ height: 4, display: 'flex', width: '100%' }}>
              <div style={{ flex: 1, background: '#FF9933' }} />
              <div style={{ flex: 1, background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} />
              <div style={{ flex: 1, background: '#138808' }} />
            </div>

            {/* Drawer Header */}
            <div
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🛰️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {isHindi ? 'उपग्रह ब्लैकआउट विसंगति विवरण' : 'OFFLINE BLACKOUT INCIDENT AUDIT'}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    NCPOR Flight SITREP • {stationId.toUpperCase()} BASE
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                title="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Incident Header Card */}
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: '#dc2626',
                        color: '#ffffff',
                        display: 'inline-block',
                        marginBottom: 4,
                      }}
                    >
                      {activeIncident.severity}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#991b1b', lineHeight: 1.25 }}>
                      {activeIncident.anomaly_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#7f1d1d', marginTop: 3 }}>
                      <span>Subsystem: <strong>{activeIncident.category?.toUpperCase() || 'TELEMETRY'}</strong></span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>Time: <strong>{timeStr}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Description ("ky ky hua h") */}
                <div style={{ marginTop: 10, fontSize: 11, color: '#334155', background: '#ffffff', padding: '10px', borderRadius: 6, border: '1px solid #fecaca', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>
                    {isHindi ? 'घटना का विवरण (Incident Context & Cause):' : 'Incident Context & Cause:'}
                  </div>
                  {activeIncident.description}
                </div>

                {activeIncident.onIceActionTaken && (
                  <div style={{ marginTop: 8, fontSize: 10.5, color: '#166534', background: '#f0fdf4', padding: '8px 10px', borderRadius: 6, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🛡️</span>
                    <div>
                      <strong>{isHindi ? 'स्टेशन कमांडर द्वारा की गई कार्रवाई: ' : 'On-Ice Action Taken: '}</strong>
                      {activeIncident.onIceActionTaken}
                    </div>
                  </div>
                )}
              </div>

              {/* Damage & Loss Assessment ("loss vgera hua h etc") */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📊</span>
                  <span>{isHindi ? 'नुकसान एवं प्रभाव विश्लेषण (Loss Assessment)' : 'Damage & Loss Assessment'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {/* Equipment Stress */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      ⚙️ {isHindi ? 'उपकरण तनाव' : 'Equipment Stress'}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginTop: 3, lineHeight: 1.3 }}>
                      {activeIncident.lossAssessment?.equipmentStress || 'Thermal excursion mitigated'}
                    </div>
                  </div>

                  {/* Telemetry Drift */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      📉 {isHindi ? 'टेलीमेट्री विचलन' : 'Telemetry Drift'}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginTop: 3, lineHeight: 1.3 }}>
                      {activeIncident.lossAssessment?.telemetryDeviation || activeIncident.impacts?.[0] || 'Nominal range exceeded'}
                    </div>
                  </div>

                  {/* Habitat / Ration Risk */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      🧊 {isHindi ? 'राशन / आवास प्रभाव' : 'Habitat / Ration Risk'}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#16a34a', marginTop: 3, lineHeight: 1.3 }}>
                      {activeIncident.lossAssessment?.rationImpact || 'Zero habitat compromise'}
                    </div>
                  </div>

                  {/* Data Recovery */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      ⏱️ {isHindi ? 'डेटा अखंडता' : 'Buffered Recovery'}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0284c7', marginTop: 3, lineHeight: 1.3 }}>
                      {activeIncident.lossAssessment?.estimatedDowntime || 'Buffered to local NVMe SSD (Zero Loss)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Flight Black Box Inspection Card ("black box m jaane ka bhi option avialable ho") */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: 8,
                  padding: '14px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📦</span>
                    <span>{isHindi ? 'फ्लाइट ब्लैक बॉक्स में टेलीमेट्री जांचें' : 'INSPECT IN FLIGHT BLACK BOX'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    {isHindi
                      ? 'ब्लैकआउट के समय के उच्च-आवृत्ति डेटा को सीधे ब्लैक बॉक्स टाइमलाइन पर देखें'
                      : 'Examine synchronized microsecond sensor telemetry before, during, and after blackout.'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsDrawerOpen(false)
                    navigate('/blackbox')
                  }}
                  style={{
                    background: '#f59e0b',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#d97706')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f59e0b')}
                >
                  {isHindi ? 'ब्लैक बॉक्स खोलें →' : 'OPEN BLACK BOX →'}
                </button>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                padding: '12px 18px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              {/* Download Official Government of India SITREP PDF Button */}
              <button
                onClick={() => {
                  generateBlackoutIncidentSitrepPdf({ stationId, incident: activeIncident })
                }}
                style={{
                  background: 'linear-gradient(135deg, #0b3b60 0%, #0f172a 100%)',
                  border: '1.5px solid #3b82f6',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: '0 2px 8px rgba(11, 59, 96, 0.4)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3a8a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #0b3b60 0%, #0f172a 100%)')}
                title="Download official Government of India SITREP PDF with complete damage & loss analysis"
              >
                <span style={{ fontSize: 13 }}>📥</span>
                <span>{isHindi ? 'SITREP रिपोर्ट डाउनलोड करें (PDF)' : 'DOWNLOAD SITREP REPORT (PDF)'}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => {
                    setIsDrawerOpen(false)
                    closeBlackoutModal()
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ✓ {isHindi ? 'स्वीकार कर हटाएं' : 'ACKNOWLEDGE & CLEAR'}
                </button>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {isHindi ? 'बंद करें' : 'CLOSE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
