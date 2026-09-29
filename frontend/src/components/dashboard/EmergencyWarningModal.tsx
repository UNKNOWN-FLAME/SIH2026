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
  const { openImpactModal, acknowledgeAnomalyAtHQ, linkState } = useStation()
  const [mutedAlertRef, setMutedAlertRef] = useState<string | null>(null)
  const isAudioMuted = Boolean(alert && mutedAlertRef === alert.report_reference)

  useEffect(() => {
    if (alert && linkState !== 'DOWN' && !alert.injectedWhileOffline && !isAudioMuted) {
      // Trigger siren sound and audible alert voice only when online
      emergencyAudio.playAlarm(alert.station_id, alert.anomaly_name, alert.severity)
    } else {
      emergencyAudio.stop()
    }
    return () => {
      emergencyAudio.stop()
    }
  }, [alert, linkState, isAudioMuted])

  if (!alert || linkState === 'DOWN' || alert.injectedWhileOffline) return null

  function handleMuteAudio() {
    emergencyAudio.stop()
    if (alert) {
      setMutedAlertRef(alert.report_reference)
    }
  }

  function handleAcknowledge() {
    emergencyAudio.stop()
    acknowledgeAnomalyAtHQ()
    onClose()
  }

  function handleViewBlackBox() {
    emergencyAudio.stop()
    acknowledgeAnomalyAtHQ()
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
        background: 'rgba(4, 9, 20, 0.72)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxShadow: `inset 0 0 100px ${glowColor}`,
        animation: 'emergencyBackdrop 2s infinite alternate',
      }}
      onClick={handleAcknowledge}
    >
      <div
        style={{
          background: 'rgba(10, 15, 29, 0.78)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          border: `1.5px solid ${isCritical ? 'rgba(239, 68, 68, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          boxShadow: `0 25px 60px -10px rgba(0, 0, 0, 0.75), 0 0 45px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
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
            background: isCritical
              ? 'linear-gradient(90deg, rgba(153, 27, 27, 0.78) 0%, rgba(220, 38, 38, 0.85) 50%, rgba(153, 27, 27, 0.78) 100%)'
              : 'linear-gradient(90deg, rgba(154, 52, 18, 0.78) 0%, rgba(234, 88, 12, 0.85) 50%, rgba(154, 52, 18, 0.78) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '11px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                }}
              >
                LEVEL 1 EMERGENCY WARNING SYSTEM
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleMuteAudio}
              style={{
                background: isAudioMuted ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title={isAudioMuted ? 'Alarm Voice Muted' : 'Silence Alarm Voice'}
            >
              <span>{isAudioMuted ? '🔇' : '🔊'}</span>
              <span>{isAudioMuted ? 'MUTED' : 'SILENCE'}</span>
            </button>

            <button
              onClick={handleAcknowledge}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#cbd5e1',
                width: 28,
                height: 28,
                borderRadius: 6,
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

        {/* Content Body */}
        <div style={{ padding: '24px 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Main Title Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: isCritical ? 'rgba(220, 38, 38, 0.18)' : 'rgba(234, 88, 12, 0.18)',
                border: `1.5px solid ${isCritical ? 'rgba(248, 113, 113, 0.5)' : 'rgba(251, 146, 60, 0.5)'}`,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
                boxShadow: `0 0 24px ${glowColor}`,
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
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.06em',
                  }}
                >
                  {alert.severity} SEVERITY
                </span>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  STATION: {alert.station_id.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  Category: <strong style={{ color: '#e2e8f0' }}>{alert.category}</strong>
                </span>
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                }}
              >
                {alert.anomaly_name}
              </h2>
            </div>
          </div>

          {/* Quick Threat Situation Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#f87171', fontWeight: 800, fontSize: 11, letterSpacing: '0.04em' }}>
              <span>⚠️</span>
              <span>TELEMETRY ANOMALY INJECTED INTO DIGITAL TWIN</span>
            </div>
            Station models and digital twin subcomponents are actively registering abnormal deviations.
            Expected baseline values have exceeded safety operational limits.
          </div>

          {/* Expected System Impacts */}
          {alert.impacts && alert.impacts.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Expected Subsystem Impacts:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
                {alert.impacts.map((imp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(239, 68, 68, 0.07)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 11.5,
                      color: '#fca5a5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  emergencyAudio.stop()
                  onClose()
                  openImpactModal()
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.88) 0%, rgba(194, 65, 12, 0.92) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '8px 16px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 10px rgba(234, 88, 12, 0.35)',
                }}
              >
                <span>📊</span>
                <span>Loss & Shipment Report</span>
              </button>

              <button
                type="button"
                onClick={handleViewBlackBox}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                📼 View Black Box
              </button>

              <button
                type="button"
                onClick={handleAcknowledge}
                style={{
                  background: isCritical
                    ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.92) 0%, rgba(185, 28, 28, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(234, 88, 12, 0.92) 0%, rgba(194, 65, 12, 0.95) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: 11.5,
                  fontWeight: 900,
                  padding: '8px 22px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  boxShadow: `0 4px 18px ${glowColor}`,
                  letterSpacing: '0.04em',
                }}
              >
                🛡️ ACKNOWLEDGE ALERT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
