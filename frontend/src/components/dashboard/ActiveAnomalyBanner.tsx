import { useState, useEffect } from 'react'
import { useStation } from '../../context/StationContext'

export default function ActiveAnomalyBanner() {
  const {
    lastAnomalyResult,
    stationId,
    linkState,
    openBlackBox,
    acknowledgeAnomalyAtHQ,
  } = useStation()

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  const isConsoleEnded = Boolean(lastAnomalyResult?.consoleEnded)
  const isHqAcked = Boolean(lastAnomalyResult?.hqAcknowledged)

  // Track elapsed time since anomaly injection (or freeze at ended_at if resolved)
  useEffect(() => {
    if (!lastAnomalyResult) {
      setElapsedSeconds(0)
      return
    }

    const startTime = lastAnomalyResult.injected_at
      ? new Date(lastAnomalyResult.injected_at).getTime()
      : Date.now()

    function updateTimer() {
      const endTime = isConsoleEnded && lastAnomalyResult?.ended_at
        ? new Date(lastAnomalyResult.ended_at).getTime()
        : Date.now()
      const diffSec = Math.max(0, Math.floor((endTime - startTime) / 1000))
      setElapsedSeconds(diffSec)
    }

    updateTimer()
    if (isConsoleEnded) return
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [lastAnomalyResult, isConsoleEnded])

  if (!lastAnomalyResult) return null

  // If station doesn't match, don't show
  const isTargetStation = !lastAnomalyResult.station_id || lastAnomalyResult.station_id === stationId
  if (!isTargetStation) return null

  // If anomaly was injected while offline and link is still DOWN, Goa HQ does not know yet
  if (linkState === 'DOWN' && lastAnomalyResult.injectedWhileOffline) return null

  // Dual-Condition Rule: if both on-ice console ended and HQ acknowledged, banner closes
  if (isConsoleEnded && isHqAcked) return null

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const impacts = lastAnomalyResult.impacts || []

  // Dynamic styling based on dual-twin stage
  const bannerBg = isConsoleEnded ? '#f0fdf4' : isHqAcked ? '#fefce8' : '#fff5f5'
  const bannerBorder = isConsoleEnded ? '#86efac' : isHqAcked ? '#fde047' : '#fca5a5'
  const bannerLeftBorder = isConsoleEnded ? '4px solid #16a34a' : isHqAcked ? '4px solid #ca8a04' : '4px solid #dc2626'

  const sevKey = (lastAnomalyResult.severity || 'CRITICAL').toUpperCase()
  const sevObj = {
    CRITICAL: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
    HIGH:     { bg: '#ffedd5', border: '#fed7aa', color: '#c2410c' },
    MEDIUM:   { bg: '#fef9c3', border: '#fde047', color: '#854d0e' },
    LOW:      { bg: '#dcfce7', border: '#86efac', color: '#15803d' },
  }[sevKey] || { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' }

  return (
    <div
      style={{
        position: 'relative',
        background: bannerBg,
        border: `1px solid ${bannerBorder}`,
        borderLeft: bannerLeftBorder,
        borderRadius: 5,
        padding: '7px 12px',
        marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        color: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        opacity: isTargetStation ? 1 : 0.7,
        transition: 'all 0.2s ease',
      }}
    >
      <style>{`
        @keyframes subtle-beacon-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(0.85);
          }
        }
      `}</style>

      {/* Main Single Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Left: Icon + Status Pill + Title + Severity + Station info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {/* Status Icon Container */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: isConsoleEnded ? '#dcfce7' : isHqAcked ? '#fef9c3' : '#fee2e2',
              border: `1px solid ${isConsoleEnded ? '#86efac' : isHqAcked ? '#fde047' : '#fca5a5'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConsoleEnded ? '#15803d' : isHqAcked ? '#a16207' : '#dc2626',
              flexShrink: 0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 13,
                animation: !isConsoleEnded ? 'subtle-beacon-pulse 1.4s infinite ease-in-out' : 'none',
              }}
            >
              {isConsoleEnded ? 'check_circle' : isHqAcked ? 'sync' : 'crisis_alert'}
            </span>
          </div>

          {/* Status Badge */}
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              background: isConsoleEnded ? '#dcfce7' : isHqAcked ? '#fef9c3' : '#fee2e2',
              color: isConsoleEnded ? '#15803d' : isHqAcked ? '#854d0e' : '#b91c1c',
              border: `1px solid ${isConsoleEnded ? '#86efac' : isHqAcked ? '#fde047' : '#fca5a5'}`,
              padding: '2px 6px',
              borderRadius: 3,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isConsoleEnded
              ? '✓ RESOLVED ON-ICE • PENDING HQ ACK'
              : isHqAcked
              ? 'HQ ACKNOWLEDGED • AWAITING ON-ICE STOP'
              : 'ACTIVE ANOMALY • ON-STATION'}
          </span>

          {/* Anomaly Name */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isConsoleEnded ? '#0f172a' : '#991b1b',
              letterSpacing: '-0.01em',
            }}
          >
            {lastAnomalyResult.anomaly_name}
          </span>

          {/* Severity Tag */}
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              background: sevObj.bg,
              color: sevObj.color,
              border: `1px solid ${sevObj.border}`,
              padding: '1.5px 6px',
              borderRadius: 3,
              letterSpacing: '0.04em',
            }}
          >
            {lastAnomalyResult.severity}
          </span>

          {/* Station Name */}
          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
            • Station: <strong style={{ color: '#0b3b60', fontWeight: 800 }}>{lastAnomalyResult.station_id?.toUpperCase() || stationId.toUpperCase()}</strong>
          </span>

          {/* Duration Badge */}
          <span
            style={{
              fontSize: 9.5,
              color: '#475569',
              fontFamily: 'monospace',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '1px 5px',
              borderRadius: 3,
              fontWeight: 700,
            }}
            title={isConsoleEnded ? 'Incident concluded on station' : 'Elapsed active duration'}
          >
            {isConsoleEnded ? `Duration: ${formattedTime}` : formattedTime}
          </span>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isHqAcked && (
            <button
              type="button"
              onClick={() => acknowledgeAnomalyAtHQ()}
              title="Acknowledge alert and dismiss at Goa HQ command"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 26,
                background: isConsoleEnded ? '#15803d' : '#ea580c',
                color: '#ffffff',
                border: `1px solid ${isConsoleEnded ? '#166534' : '#c2410c'}`,
                padding: '0 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: isConsoleEnded ? '0 1px 3px rgba(21, 128, 61, 0.25)' : '0 1px 3px rgba(234, 88, 12, 0.25)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isConsoleEnded ? '#166534' : '#c2410c')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isConsoleEnded ? '#15803d' : '#ea580c')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {isConsoleEnded ? 'verified' : 'crisis_alert'}
              </span>
              <span>{isConsoleEnded ? 'Acknowledge & Close' : 'Acknowledge Alert'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={openBlackBox}
            title="Inspect 10-hour flight recorder"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 26,
              background: '#ffffff',
              color: '#0b3b60',
              border: '1px solid #cbd5e1',
              padding: '0 9px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.borderColor = '#94a3b8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ea580c' }}>
              emergency_recording
            </span>
            <span>Black Box</span>
          </button>
        </div>
      </div>

      {/* Impacted Subsystems Strip */}
      {impacts.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            flexWrap: 'wrap',
            paddingTop: 1,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: isConsoleEnded ? '#166534' : isHqAcked ? '#854d0e' : '#991b1b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {isConsoleEnded ? 'task_alt' : 'warning'}
            </span>
            <span>{isConsoleEnded ? 'Telemetry Status (Normalized):' : 'Impacted Telemetry:'}</span>
          </span>

          {impacts.slice(0, 3).map((imp, idx) => (
            <span
              key={idx}
              style={{
                background: '#ffffff',
                border: `1px solid ${isConsoleEnded ? '#bbf7d0' : isHqAcked ? '#fde68a' : '#fecaca'}`,
                padding: '2px 7px',
                borderRadius: 3,
                fontSize: 9.5,
                color: isConsoleEnded ? '#166534' : isHqAcked ? '#854d0e' : '#991b1b',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isConsoleEnded ? '#22c55e' : isHqAcked ? '#eab308' : '#ef4444',
                  flexShrink: 0,
                }}
              />
              <span>{imp}</span>
            </span>
          ))}

          {!isTargetStation && (
            <span style={{ color: '#b45309', fontSize: 10, marginLeft: 'auto' }}>
              (Note: Active on {lastAnomalyResult.station_id?.toUpperCase()})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
