import { useState, useEffect, useMemo } from 'react'
import { useStation } from '../../context/StationContext'
import { getAnomalyModel } from './IncidentImpactModal'

export default function LiveImpactSideTab() {
  const {
    lastAnomalyResult,
    stationId,
    linkState,
    openImpactModal,
  } = useStation()

  const [nowTime, setNowTime] = useState<number>(Date.now())
  // Expanded by default so the user sees the live stats immediately; can toggle/collapse to stay docked
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  // Tick every second while anomaly is active
  useEffect(() => {
    if (!lastAnomalyResult || linkState === 'DOWN') return
    const timer = setInterval(() => setNowTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [lastAnomalyResult, linkState])

  // Elapsed seconds since injection
  const activeSeconds = useMemo(() => {
    if (!lastAnomalyResult) return 0
    if (lastAnomalyResult.injected_at) {
      const start = new Date(lastAnomalyResult.injected_at).getTime()
      if (!isNaN(start) && start > 0) {
        return Math.max(1, Math.floor((nowTime - start) / 1000))
      }
    }
    return Math.max(1, Math.floor((nowTime - 0) / 1000) % 3600)
  }, [lastAnomalyResult, nowTime])

  // Get model for loss calculations
  const model = useMemo(() => {
    if (!lastAnomalyResult) return null
    const aid = lastAnomalyResult.anomaly_id || 'generator_failure'
    return getAnomalyModel(aid, stationId)
  }, [lastAnomalyResult, stationId])

  // Live accumulating metrics
  const liveCost = useMemo(() => {
    if (!model) return 0
    return model.financialLossInr + Math.round(activeSeconds * 45)
  }, [model, activeSeconds])

  const liveEnergy = useMemo(() => {
    if (!model) return 0
    return Number((model.energyLossKwh + activeSeconds * 0.38).toFixed(1))
  }, [model, activeSeconds])

  const liveFuel = useMemo(() => {
    if (!model) return 0
    return Number((model.fuelLossLitres + activeSeconds * 0.052).toFixed(1))
  }, [model, activeSeconds])

  // Don't render if no active anomaly, offline, or already resolved
  if (!lastAnomalyResult || linkState === 'DOWN' || !model) return null
  if (lastAnomalyResult.consoleEnded) return null
  if (lastAnomalyResult.injectedWhileOffline && linkState !== 'UP') return null

  const minutes = Math.floor(activeSeconds / 60)
  const seconds = activeSeconds % 60
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  return (
    <>
      <style>{`
        @keyframes sideTabSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes sideTabBeaconPulse {
          0%, 100% { box-shadow: 0 4px 18px rgba(185, 28, 28, 0.3); }
          50% { box-shadow: 0 4px 26px rgba(185, 28, 28, 0.55); }
        }
        @keyframes liveBlinkDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }
      `}</style>

      {/* Docked Side Container - sticks to right edge */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: '46%',
          transform: 'translateY(-50%)',
          zIndex: 9990,
          animation: 'sideTabSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1), sideTabBeaconPulse 2.5s infinite ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px 0 0 8px',
          overflow: 'hidden',
          border: '1.5px solid #b91c1c',
          borderRight: 'none',
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(185, 28, 28, 0.28)',
          width: isExpanded ? 88 : 34,
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          userSelect: 'none',
        }}
      >
        {isExpanded ? (
          /* ── Full Expanded View (Exact Match to User Reference Screenshot) ── */
          <div style={{ display: 'flex', flexDirection: 'column', width: 88 }}>
            {/* Top Red Header with LIVE dot + Collapse arrow */}
            <div
              onClick={() => setIsExpanded(false)}
              title="Click to collapse to edge"
              style={{
                background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fca5a5',
                    animation: 'liveBlinkDot 1.2s infinite',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 9.5, fontWeight: 900, color: '#ffffff', letterSpacing: '0.06em' }}>
                  LIVE
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: '#fecaca',
                  fontWeight: 800,
                  lineHeight: 1,
                  padding: '1px 2px',
                }}
                title="Collapse"
              >
                ▶
              </span>
            </div>

            {/* Dark Timer Box */}
            <div
              style={{
                background: '#0f172a',
                padding: '3px 4px',
                textAlign: 'center',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#fca5a5',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {timeStr}
              </div>
            </div>

            {/* Cost Metric */}
            <div
              style={{
                padding: '6px 4px 4px',
                textAlign: 'center',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 7.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                COST
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 900,
                  color: '#0284c7',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginTop: 1,
                }}
              >
                ₹{liveCost.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Energy Metric */}
            <div
              style={{
                padding: '4px 4px',
                textAlign: 'center',
                borderBottom: '1px solid #f1f5f9',
                background: '#fafaf9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#ea580c' }}>⚡</span>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#c2410c', lineHeight: 1 }}>
                  {liveEnergy}
                </span>
              </div>
              <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>
                kWh
              </div>
            </div>

            {/* Fuel Metric */}
            <div
              style={{
                padding: '4px 4px',
                textAlign: 'center',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 9.5, color: '#dc2626' }}>⛽</span>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#b91c1c', lineHeight: 1 }}>
                  {liveFuel}
                </span>
              </div>
              <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>
                Litres
              </div>
            </div>

            {/* Bottom: ◀ Open Action (Opens Full Modal) */}
            <button
              type="button"
              onClick={openImpactModal}
              title="Click to open comprehensive damage & shipment report"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '5px 4px',
                background: '#f8fafc',
                border: 'none',
                borderTop: '1px solid #e2e8f0',
                color: '#334155',
                fontSize: 9.5,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#b91c1c'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.color = '#334155'
              }}
            >
              <span style={{ fontSize: 9 }}>◀</span>
              <span>Open</span>
            </button>
          </div>
        ) : (
          /* ── Collapsed Docked Tab (Chipka hua to the side) ── */
          <div
            onClick={() => setIsExpanded(true)}
            title="Active Anomaly! Click to expand live telemetry impact"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              background: 'linear-gradient(180deg, #991b1b 0%, #b91c1c 100%)',
              cursor: 'pointer',
              color: '#ffffff',
              gap: 8,
              minHeight: 110,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#fca5a5',
                animation: 'liveBlinkDot 1s infinite',
                boxShadow: '0 0 6px #fca5a5',
              }}
            />
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 900,
                letterSpacing: '0.08em',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
              }}
            >
              LIVE
            </span>
            <span style={{ fontSize: 10, color: '#fecaca', fontWeight: 900 }}>
              ◀
            </span>
          </div>
        )}
      </div>
    </>
  )
}
