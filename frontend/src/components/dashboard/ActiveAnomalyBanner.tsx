import { useState, useEffect } from 'react'
import { useStation } from '../../context/StationContext'
import { useQueryClient } from '@tanstack/react-query'

export default function ActiveAnomalyBanner() {
  const {
    lastAnomalyResult,
    setLastAnomalyResult,
    stationId,
    refreshLinkState,
    openBlackBox,
  } = useStation()

  const queryClient = useQueryClient()
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [isTerminating, setIsTerminating] = useState<boolean>(false)

  // Track elapsed time since anomaly injection
  useEffect(() => {
    if (!lastAnomalyResult) {
      setElapsedSeconds(0)
      return
    }

    const startTime = lastAnomalyResult.injected_at
      ? new Date(lastAnomalyResult.injected_at).getTime()
      : Date.now()

    function updateTimer() {
      const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
      setElapsedSeconds(diffSec)
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [lastAnomalyResult])

  if (!lastAnomalyResult) return null

  const isTargetStation = !lastAnomalyResult.station_id || lastAnomalyResult.station_id === stationId

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  function handleTerminate() {
    setIsTerminating(true)
    setTimeout(() => {
      setLastAnomalyResult(null)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      refreshLinkState()
      setIsTerminating(false)
    }, 250)
  }

  const impacts = lastAnomalyResult.impacts || []

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(254, 242, 242, 0.9)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderLeft: '4px solid #ef4444',
        borderRadius: 4,
        padding: '8px 14px',
        marginBottom: 8,
        boxShadow: '0 1px 4px rgba(239, 68, 68, 0.08)',
        color: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <style>{`
        @keyframes subtle-beacon-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
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
          gap: 10,
        }}
      >
        {/* Left: Subtle Beacon + Title + Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Subtle Pulse Dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'subtle-beacon-pulse 1.4s infinite ease-in-out',
              flexShrink: 0,
            }}
          />

          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#b91c1c',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '1px 6px',
              borderRadius: 3,
              fontFamily: 'monospace',
              letterSpacing: '0.04em',
            }}
          >
            ACTIVE ANOMALY
          </span>

          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#991b1b' }}>
            {lastAnomalyResult.anomaly_name}
          </span>

          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '1px 6px',
              borderRadius: 3,
            }}
          >
            {lastAnomalyResult.severity}
          </span>

          <span style={{ fontSize: 11, color: '#64748b' }}>
            • Station: <strong style={{ color: '#334155' }}>{lastAnomalyResult.station_id?.toUpperCase() || stationId.toUpperCase()}</strong>
          </span>

          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
            ({formattedTime})
          </span>
        </div>

        {/* Right: Subdued Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={openBlackBox}
            title="Inspect 10-hour flight recorder"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#ffffff',
              color: '#0b3b60',
              border: '1px solid #cbd5e1',
              padding: '3px 9px',
              borderRadius: 3,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ea580c' }}>
              emergency_recording
            </span>
            <span>Black Box</span>
          </button>

          <button
            type="button"
            onClick={handleTerminate}
            disabled={isTerminating}
            title="Stop anomaly and restore normal telemetry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#ffffff',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: '3px 10px',
              borderRadius: 3,
              fontSize: 10.5,
              fontWeight: 800,
              cursor: isTerminating ? 'wait' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
          >
            <span style={{ fontSize: 11 }}>✕</span>
            <span>{isTerminating ? 'Ending...' : 'Stop Anomaly'}</span>
          </button>
        </div>
      </div>

      {/* Subtle Impacted Subsystems Strip (only if impacts exist) */}
      {impacts.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10.5,
            color: '#64748b',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600, color: '#991b1b' }}>Impacted:</span>
          {impacts.slice(0, 3).map((imp, idx) => (
            <span
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '1px 6px',
                borderRadius: 2,
                fontSize: 10,
                color: '#7f1d1d',
              }}
            >
              {imp}
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
