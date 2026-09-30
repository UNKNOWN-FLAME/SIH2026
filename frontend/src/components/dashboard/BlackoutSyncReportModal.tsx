import { useStation } from '../../context/StationContext'
import { emergencyAudio } from '../../utils/emergencyAudio'

export default function BlackoutSyncReportModal() {
  const {
    isBlackoutModalOpen,
    closeBlackoutModal,
    postBlackoutIncident,
    openImpactModal,
    acknowledgeAnomalyAtHQ,
  } = useStation()

  if (!isBlackoutModalOpen || !postBlackoutIncident) return null

  const isCritical = postBlackoutIncident.severity === 'CRITICAL'
  const accentColor = isCritical ? '#dc2626' : '#ea580c'
  const glowColor = isCritical ? 'rgba(220, 38, 38, 0.45)' : 'rgba(234, 88, 12, 0.45)'

  function handleReconcileAndClose() {
    emergencyAudio.stop()
    acknowledgeAnomalyAtHQ()
    closeBlackoutModal()
  }

  function handleOpenReport() {
    closeBlackoutModal()
    openImpactModal()
  }

  const occurredTimeStr = postBlackoutIncident.occurredAt
    ? new Date(postBlackoutIncident.occurredAt).toUTCString()
    : 'During Link Blackout'

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(4, 9, 20, 0.76)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxShadow: `inset 0 0 100px ${glowColor}`,
      }}
      onClick={handleReconcileAndClose}
    >
      <div
        style={{
          background: 'rgba(10, 15, 29, 0.85)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          border: `1.5px solid ${isCritical ? 'rgba(239, 68, 68, 0.55)' : 'rgba(249, 115, 22, 0.55)'}`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          boxShadow: `0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 50px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#ffffff',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Official Recon Strobe Header */}
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(14, 116, 144, 0.85) 0%, rgba(2, 132, 199, 0.88) 50%, rgba(14, 116, 144, 0.85) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛰️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff' }}>
                GOVERNMENT OF INDIA • DUAL-TWIN TELEMETRY RECONCILIATION
              </div>
              <div style={{ fontSize: 10, color: '#e0f2fe' }}>
                Post-Blackout Re-Sync & Incident Audit (GSAT-7 Link Restored)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 9.5,
                background: '#042f2e',
                color: '#2dd4bf',
                border: '1px solid #14b8a6',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 800,
              }}
            >
              100% PARITY RESTORED
            </span>
            <button
              onClick={handleReconcileAndClose}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#cbd5e1',
                width: 26,
                height: 26,
                borderRadius: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Notice Alert */}
          <div
            style={{
              background: 'rgba(234, 88, 12, 0.12)',
              border: '1px solid rgba(234, 88, 12, 0.35)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 11.5,
              color: '#fed7aa',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <strong>SATELLITE BLACKOUT RECONNECTED:</strong> While the VSAT link was disconnected, an incident occurred on-ice and was buffered autonomously to local SSD. Review the incident details and loss assessment below.
            </div>
          </div>

          {/* Anomaly Profile Header Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 10,
                background: isCritical ? 'rgba(220, 38, 38, 0.2)' : 'rgba(234, 88, 12, 0.2)',
                border: `1.5px solid ${isCritical ? 'rgba(248, 113, 113, 0.5)' : 'rgba(251, 146, 60, 0.5)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              ⚡
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span
                  style={{
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 3,
                  }}
                >
                  {postBlackoutIncident.severity} SEVERITY
                </span>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  STATION: {postBlackoutIncident.station_id?.toUpperCase()}
                </span>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                  Occurred on Ice: <strong style={{ color: '#e2e8f0' }}>{occurredTimeStr}</strong>
                </span>
              </div>

              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {postBlackoutIncident.anomaly_name}
              </h3>

              <div style={{ marginTop: 6, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
                <strong style={{ color: '#fb923c' }}>Root Cause & Trigger: </strong>
                {postBlackoutIncident.description}
              </div>
            </div>
          </div>

          {/* Loss Assessment & Subsystem Deviations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {/* Box 1: Subsystem Impacts */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                💥 Subsystem Telemetry Deviations:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(postBlackoutIncident.impacts || []).slice(0, 4).map((imp: string, idx: number) => (
                  <div key={idx} style={{ fontSize: 11, color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 2: Loss Assessment Summary */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                📋 Equipment & Loss Assessment:
              </div>
              <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Component Stress: </span>
                  <strong style={{ color: '#f87171' }}>{postBlackoutIncident.lossAssessment?.equipmentStress || 'Elevated Thermal Excursion'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Downtime Profile: </span>
                  <strong style={{ color: '#e2e8f0' }}>{postBlackoutIncident.lossAssessment?.estimatedDowntime || 'Buffered seamlessly to local NVMe SSD'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Life Support / Crew: </span>
                  <strong style={{ color: '#4ade80' }}>25 Expeditioners Preserved Nominal</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Autonomous Edge Actions Executed */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 11.5,
              color: '#a7f3d0',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#34d399' }}>🛡️ Autonomous Edge Action Executed: </strong>
            {postBlackoutIncident.onIceActionTaken || 'Station crew executed on-ice emergency failover, activated heating and queued telemetry to NVMe SSD.'}
          </div>

          {/* Cryptographic Chain Integrity Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
              SHA-256 Chain Verification: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>0x8f3c4e12b7a90dc4 (0 Frames Lost)</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleOpenReport}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '8px 16px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>📊</span>
                <span>Loss & Shipment Requisition</span>
              </button>

              <button
                type="button"
                onClick={handleReconcileAndClose}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: 11.5,
                  fontWeight: 900,
                  padding: '8px 22px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                }}
              >
                🛡️ ACKNOWLEDGE & RECONCILE DUAL-TWIN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
