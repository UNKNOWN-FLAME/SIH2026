import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnomalyInjectionResult } from '../../api/hq'
import { emergencyAudio } from '../../utils/emergencyAudio'
import { useStation } from '../../context/StationContext'

interface EmergencyWarningModalProps {
  alert: AnomalyInjectionResult | null
  onClose: () => void
}

export default function EmergencyWarningModal({ alert, onClose }: EmergencyWarningModalProps) {
  const navigate = useNavigate()
  const { openImpactModal } = useStation()
  const [mutedAlertRef, setMutedAlertRef] = useState<string | null>(null)
  const isAudioMuted = Boolean(alert && mutedAlertRef === alert.report_reference)

  useEffect(() => {
    if (alert) {
      // Trigger siren sound and audible alert voice
      emergencyAudio.playAlarm(alert.station_id, alert.anomaly_name, alert.severity)
    }
    return () => {
      emergencyAudio.stop()
    }
  }, [alert])

  if (!alert) return null

  function handleMuteAudio() {
    emergencyAudio.stop()
    if (alert) {
      setMutedAlertRef(alert.report_reference)
    }
  }

  function handleAcknowledge() {
    emergencyAudio.stop()
    onClose()
  }

  function handleViewBlackBox() {
    emergencyAudio.stop()
    onClose()
    navigate('/blackbox')
  }

  const isCritical = alert.severity === 'CRITICAL'
  const accentColor = isCritical ? '#dc2626' : '#ea580c'
  const glowColor = isCritical ? 'rgba(220, 38, 38, 0.45)' : 'rgba(234, 88, 12, 0.45)'

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(3, 7, 18, 0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxShadow: `inset 0 0 120px ${glowColor}`,
        animation: 'emergencyBackdrop 2s infinite alternate',
      }}
      onClick={handleAcknowledge}
    >
      <div
        style={{
          background: '#090d16',
          border: `2px solid ${accentColor}`,
          borderRadius: 14,
          width: '100%',
          maxWidth: 680,
          boxShadow: `0 0 50px ${glowColor}, 0 25px 60px rgba(0, 0, 0, 0.9)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#ffffff',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Emergency Strobe Banner */}
        <div
          style={{
            background: `linear-gradient(90deg, #7f1d1d 0%, ${accentColor} 50%, #7f1d1d 100%)`,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ffffff' }}>
              crisis_alert
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#ffffff',
              }}
            >
              LEVEL 1 EMERGENCY WARNING SYSTEM
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleMuteAudio}
              style={{
                background: isAudioMuted ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                fontSize: 9.5,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={isAudioMuted ? 'Alarm Voice Muted' : 'Silence Alarm Voice'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {isAudioMuted ? 'volume_off' : 'volume_up'}
              </span>
              <span>{isAudioMuted ? 'MUTED' : 'SILENCE'}</span>
            </button>

            <button
              onClick={handleAcknowledge}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#cbd5e1',
                width: 26,
                height: 26,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 22px 18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main Title Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'rgba(220, 38, 38, 0.15)',
                border: `1.5px solid ${accentColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 0 16px ${glowColor}`,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#f87171' }}>
                {alert.category.includes('fire') ? 'local_fire_department' : alert.category.includes('power') ? 'bolt' : alert.category.includes('comm') ? 'cell_tower' : 'warning'}
              </span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                <span
                  style={{
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 900,
                    padding: '1.5px 7px',
                    borderRadius: 3,
                    letterSpacing: '0.05em',
                  }}
                >
                  {alert.severity} SEVERITY
                </span>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1.5px 7px',
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  STATION: {alert.station_id.toUpperCase()}
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                  Category: <strong style={{ color: '#e2e8f0' }}>{alert.category}</strong>
                </span>
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {alert.anomaly_name}
              </h2>
            </div>
          </div>

          {/* Clean Threat Situation Advisory */}
          <div
            style={{
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: 6,
              padding: '9px 13px',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#f87171', flexShrink: 0 }}>
              error
            </span>
            <div style={{ fontSize: 11.5, color: '#fca5a5', lineHeight: 1.4 }}>
              <strong style={{ color: '#ffffff' }}>Active Anomaly Deviation:</strong> Station telemetry sensors are registering abnormal variance beyond approved safety baseline limits.
            </div>
          </div>

          {/* Expected System Impacts */}
          {alert.impacts && alert.impacts.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
                Expected Subsystem Impacts
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 7 }}>
                {alert.impacts.map((imp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(239, 68, 68, 0.06)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 4,
                      padding: '7px 11px',
                      fontSize: 11,
                      color: '#fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingTop: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b' }}>
              Incident Ref: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{alert.report_reference}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  emergencyAudio.stop()
                  onClose()
                  openImpactModal()
                }}
                style={{
                  background: '#c2410c',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '7px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 2px 6px rgba(194, 65, 12, 0.35)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#9a3412' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#c2410c' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>assessment</span>
                <span>Loss & Shipment Report</span>
              </button>

              <button
                type="button"
                onClick={handleViewBlackBox}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '7px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#38bdf8' }}>deployed_code</span>
                <span>View Black Box</span>
              </button>

              <button
                type="button"
                onClick={handleAcknowledge}
                style={{
                  background: accentColor,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '7px 18px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: `0 3px 12px ${glowColor}`,
                  letterSpacing: '0.03em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#b91c1c' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = accentColor }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified_user</span>
                <span>ACKNOWLEDGE ALERT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
