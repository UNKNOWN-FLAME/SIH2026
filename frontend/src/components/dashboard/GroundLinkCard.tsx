import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

interface Props {
  stationId: string
}

export default function GroundLinkCard({ stationId }: Props) {
  const navigate = useNavigate()
  const { lang } = useLanguage()

  // Link simulation state
  const [linkState, setLinkState] = useState<'SYNCED' | 'OFFLINE' | 'SYNCING'>('SYNCED')
  const [bufferBytes, setBufferBytes] = useState(0)
  const [syncProgress, setSyncProgress] = useState(0)
  const [lastHandshakeSec, setLastHandshakeSec] = useState(2)

  // Simulation timer for handshake counter
  useEffect(() => {
    const timer = setInterval(() => {
      if (linkState === 'SYNCED') {
        setLastHandshakeSec((prev) => (prev > 6 ? 1 : prev + 1))
      } else if (linkState === 'OFFLINE') {
        setLastHandshakeSec((prev) => prev + 1)
        // Accumulate local buffer when offline (simulate telemetry arriving locally)
        setBufferBytes((prev) => prev + Math.floor(1200 + Math.random() * 800))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [linkState])

  function toggleOutage() {
    if (linkState === 'SYNCED') {
      // Sever the link
      setLinkState('OFFLINE')
    } else if (linkState === 'OFFLINE') {
      // Reconnect and trigger store-and-forward sync
      setLinkState('SYNCING')
      setSyncProgress(15)

      const p1 = setTimeout(() => setSyncProgress(48), 600)
      const p2 = setTimeout(() => setSyncProgress(82), 1200)
      const p3 = setTimeout(() => {
        setSyncProgress(100)
        setLinkState('SYNCED')
        setBufferBytes(0)
        setLastHandshakeSec(1)
      }, 1800)

      return () => {
        clearTimeout(p1)
        clearTimeout(p2)
        clearTimeout(p3)
      }
    }
  }

  const stationName = stationId === 'maitri' ? 'Maitri' : 'Bharati'
  const dishSize = stationId === 'maitri' ? '3.8m Heated Dish' : '4.5m Polar Dish'
  const latency = stationId === 'maitri' ? '584ms' : '562ms'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Official Government Card Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ff9933' }}>
            satellite_alt
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {lang === 'hi' ? 'उपग्रह लिंक एवं सिंक स्थिति' : 'SATELLITE SYNC & GROUND LINK'}
          </span>
        </div>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            color: '#ffedd5',
            background: 'rgba(255, 153, 51, 0.25)',
            padding: '1px 6px',
            border: '1px solid #ff9933',
            borderRadius: 2,
          }}
        >
          ISRO GSAT-30
        </span>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {/* Main Status Indicator Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              linkState === 'SYNCED'
                ? '#f0fdf4'
                : linkState === 'SYNCING'
                ? '#fefce8'
                : '#fef2f2',
            border:
              linkState === 'SYNCED'
                ? '1px solid #86efac'
                : linkState === 'SYNCING'
                ? '1px solid #fde047'
                : '1px solid #fecaca',
            padding: '6px 10px',
            borderRadius: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Pulsing indicator circle */}
            <div style={{ position: 'relative', width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background:
                    linkState === 'SYNCED'
                      ? '#22c55e'
                      : linkState === 'SYNCING'
                      ? '#eab308'
                      : '#ef4444',
                  opacity: 0.4,
                  animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background:
                    linkState === 'SYNCED'
                      ? '#16a34a'
                      : linkState === 'SYNCING'
                      ? '#ca8a04'
                      : '#dc2626',
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color:
                    linkState === 'SYNCED'
                      ? '#15803d'
                      : linkState === 'SYNCING'
                      ? '#a16207'
                      : '#b91c1c',
                }}
              >
                {linkState === 'SYNCED'
                  ? '● SYNCED (ONLINE)'
                  : linkState === 'SYNCING'
                  ? '🔄 SYNCING STORE-AND-FORWARD...'
                  : '✖ OFFLINE (BUFFERING ON EDGE)'}
              </div>
              <div style={{ fontSize: 9, color: '#64748b' }}>
                {linkState === 'SYNCED'
                  ? `${stationName} ↔ Goa HQ (${latency})`
                  : linkState === 'SYNCING'
                  ? `Flushing ${Math.round(bufferBytes / 1024)} KB queue (${syncProgress}%)`
                  : `Blizzard blackout • Disconnected ${lastHandshakeSec}s ago`}
              </div>
            </div>
          </div>

          {/* Sync Percentage / Ping Badge */}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 2,
              background: linkState === 'SYNCED' ? '#dcfce7' : linkState === 'SYNCING' ? '#fef08a' : '#fee2e2',
              color: linkState === 'SYNCED' ? '#166534' : linkState === 'SYNCING' ? '#854d0e' : '#991b1b',
            }}
          >
            {linkState === 'SYNCED' ? '100% HEALTH' : linkState === 'SYNCING' ? `${syncProgress}%` : 'LINK DOWN'}
          </span>
        </div>

        {/* Sync Progress Bar (Visible when syncing) */}
        {linkState === 'SYNCING' && (
          <div style={{ width: '100%', background: '#e2e8f0', borderRadius: 2, height: 5, overflow: 'hidden' }}>
            <div
              style={{
                width: `${syncProgress}%`,
                background: '#ea580c',
                height: '100%',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        )}

        {/* 3 Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 4px', borderRadius: 2 }}>
            <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Crushed</div>
            <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0369a1' }}>94.2%</div>
            <div style={{ fontSize: 8, color: '#94a3b8' }}>Protobuf</div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 4px', borderRadius: 2 }}>
            <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Edge Buffer</div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 900,
                color: linkState === 'OFFLINE' ? '#dc2626' : '#16a34a',
              }}
            >
              {linkState === 'OFFLINE' ? `${(bufferBytes / 1024).toFixed(1)} KB` : '0 KB'}
            </div>
            <div style={{ fontSize: 8, color: '#94a3b8' }}>
              {linkState === 'OFFLINE' ? 'Pending' : 'Queue Empty'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 4px', borderRadius: 2 }}>
            <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Hardware</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a' }}>{dishSize.split(' ')[0]}</div>
            <div style={{ fontSize: 8, color: '#94a3b8' }}>Dish Array</div>
          </div>
        </div>

        {/* Action Buttons: Outage Simulator & Open Telemetry */}
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button
            type="button"
            onClick={toggleOutage}
            style={{
              flex: 1,
              background: linkState === 'OFFLINE' ? '#16a34a' : '#f8fafc',
              border: linkState === 'OFFLINE' ? '1px solid #15803d' : '1px solid #cbd5e1',
              color: linkState === 'OFFLINE' ? '#ffffff' : '#b91c1c',
              fontSize: 10,
              fontWeight: 800,
              padding: '6px 8px',
              cursor: 'pointer',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {linkState === 'OFFLINE' ? 'wifi' : 'wifi_off'}
            </span>
            <span>
              {linkState === 'OFFLINE'
                ? (lang === 'hi' ? 'लिंक जोड़ें (Sync)' : 'Reconnect & Sync')
                : (lang === 'hi' ? 'आउटेज सिमुलेट करें' : 'Simulate Outage')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/telemetry')}
            style={{
              background: '#0b3b60',
              border: 'none',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 800,
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Open Live Telemetry & Scrubber"
          >
            <span>{lang === 'hi' ? 'टेलीमेट्री' : 'Telemetry'}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ff9933' }}>
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
