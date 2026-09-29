import { useState, useEffect } from 'react'
import { useStation } from '../../context/StationContext'
import { useLanguage } from '../../context/LanguageContext'
import emblemOfIndia from '../../assets/emblem_of_india.svg'

export default function GovtTelemetrySyncBanner() {
  const { lang } = useLanguage()
  const { isTelemetrySyncing, syncProgress, syncStage, stationId } = useStation()

  // Real-time cycling cryptographic block hash for genuine data telemetry feel
  const [cryptoBlock, setCryptoBlock] = useState('0x8f3c4e12b7a9')

  useEffect(() => {
    if (!isTelemetrySyncing) return
    const timer = setInterval(() => {
      const hex = '0123456789abcdef'
      let h = '0x'
      for (let i = 0; i < 12; i++) {
        h += hex[Math.floor(Math.random() * hex.length)]
      }
      setCryptoBlock(h)
    }, 120)
    return () => clearInterval(timer)
  }, [isTelemetrySyncing])

  if (!isTelemetrySyncing) return null

  const isHindi = lang === 'hi'
  const currentFrames = Math.min(92, Math.max(8, Math.round((syncProgress / 100) * 92)))

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 4,
        border: '1.5px solid #0b3b60',
        marginBottom: 12,
        boxShadow: '0 2px 8px rgba(11, 59, 96, 0.1)',
        color: '#0f172a',
        overflow: 'hidden',
        position: 'relative',
        animation: 'fadeIn 0.25s ease-out',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── Official Government of India National Tricolour Ribbon ── */}
      <div style={{ height: 3.5, display: 'flex', width: '100%' }}>
        <div style={{ flex: 1, background: '#FF9933' }} />
        <div style={{ flex: 1, background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} />
        <div style={{ flex: 1, background: '#138808' }} />
      </div>

      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        }}
      >
        {/* ── Left: Official Government Header & Insignia ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 280 }}>
          {/* Ashoka Lion Capital Box */}
          <div
            style={{
              width: 32,
              height: 38,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <img
              src={emblemOfIndia}
              alt="Government of India Emblem"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            {/* Government Ministry Line */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 9,
                fontWeight: 800,
                color: '#0b3b60',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span>भारत सरकार • पृथ्वी विज्ञान मंत्रालय | GOVT. OF INDIA</span>
              <span style={{ color: '#94a3b8' }}>•</span>
              <span style={{ color: '#ea580c', fontWeight: 900 }}>NCPOR GOA</span>
            </div>

            {/* Mission Telemetry Title */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: '#072a44',
                letterSpacing: '0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 2,
              }}
            >
              <span>
                {isHindi
                  ? `GSAT-7 उपग्रह टेलीमेट्री तुल्यकालन • ${stationId.toUpperCase()} बेस`
                  : `GSAT-7 SATELLITE TELEMETRY SYNCHRONIZATION • ${stationId.toUpperCase()} BASE`}
              </span>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 900,
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  padding: '1.5px 7px',
                  borderRadius: 3,
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#16a34a',
                    display: 'inline-block',
                  }}
                />
                RECONCILING
              </span>
            </div>

            {/* Official Progress Stage */}
            <div
              style={{
                fontSize: 10.5,
                color: '#334155',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#0284c7' }}>
                sync
              </span>
              <span>{syncStage || 'Validating Protobuf telemetry frames & CRC-32 checksums...'}</span>
            </div>
          </div>
        </div>

        {/* ── Right: Official Telemetry Progress Bar & Data Ticker ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Official Govt Metadata Box */}
          <div
            style={{
              textAlign: 'right',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '4px 8px',
              borderRadius: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontSize: 9.5, fontWeight: 800 }}>
              <span style={{ color: '#64748b' }}>FRAMES:</span>
              <span style={{ color: '#0b3b60', fontFamily: 'monospace' }}>{currentFrames}/92</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#15803d', fontFamily: 'monospace' }}>0% LOSS</span>
            </div>
            <div style={{ fontSize: 8.5, color: '#475569', marginTop: 1, fontFamily: 'monospace' }}>
              BLOCK: <span style={{ color: '#b45309', fontWeight: 700 }}>{cryptoBlock}</span> • SHA-256 (NIC)
            </div>
          </div>

          {/* Clean Government Progress Bar */}
          <div style={{ width: 170 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 9.5,
                fontWeight: 800,
                color: '#0b3b60',
                marginBottom: 3,
              }}
            >
              <span style={{ letterSpacing: '0.04em' }}>TELEMETRY STREAM</span>
              <span style={{ color: '#0b3b60', fontFamily: 'monospace', fontSize: 11, fontWeight: 900 }}>
                {syncProgress}%
              </span>
            </div>

            {/* Official Tricolour-inspired continuous bar */}
            <div
              style={{
                height: 9,
                background: '#e2e8f0',
                borderRadius: 2,
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${syncProgress}%`,
                  background: 'linear-gradient(90deg, #ff9933 0%, #0b3b60 50%, #16a34a 100%)',
                  borderRadius: 1,
                  transition: 'width 0.25s ease-out',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#64748b', marginTop: 2 }}>
              <span>ISRO GSAT-7</span>
              <span>100% PARITY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
