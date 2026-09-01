import { useLanguage } from '../../context/LanguageContext'

interface Props { stationId: string }

export default function SeismicCard({ stationId }: Props) {
  const { t } = useLanguage()
  const stationCode = stationId === 'maitri' ? 'MTR-SEIS-01' : 'BHR-SEIS-01'

  return (
    <div
      style={{
        gridColumn: 'span 4',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 185,
      }}
    >
      {/* Official Header Strip */}
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
            waves
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('seismic.title')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#ffffff', padding: '1px 6px' }}>
          <span
            className="pulse-dot rounded-full"
            style={{ width: 6, height: 6, background: '#dc2626', display: 'inline-block' }}
          />
          <span style={{ fontSize: 8.5, fontWeight: 800, color: '#dc2626', letterSpacing: '0.05em' }}>
            {t('seismic.live_rec')}
          </span>
        </div>
      </div>

      {/* Waveform */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        {/* Grid */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="seismic-grid-light" width="30" height="20" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="300" height="80" fill="url(#seismic-grid-light)" />
          <line x1="0" y1="40" x2="300" y2="40" stroke="#cbd5e1" strokeWidth="1" />
        </svg>

        {/* Animated waveform */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <svg
            style={{ width: '200%', height: '100%' }}
            viewBox="0 0 600 80"
            preserveAspectRatio="none"
            className="seismic-line"
          >
            <path
              d="M0,40 L15,40 L20,32 L25,48 L30,40 L60,40 L65,35 L70,45 L75,40 L120,40 L125,22 L130,58 L135,40 L180,40 L185,36 L190,44 L195,40 L240,40 L245,30 L250,50 L255,40 L300,40 L305,38 L310,42 L315,40 L360,40 L365,15 L370,65 L375,40 L420,40 L425,34 L430,46 L435,40 L480,40 L485,28 L490,52 L495,40 L540,40 L545,38 L550,42 L555,40 L600,40"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Labels */}
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 6,
            fontSize: 8.5,
            fontWeight: 700,
            color: '#475569',
            fontFamily: 'Inter',
            pointerEvents: 'none',
          }}
        >
          {t('seismic.frequency')}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            fontSize: 9,
            fontWeight: 800,
            color: '#0b3b60',
            fontFamily: 'Inter',
            pointerEvents: 'none',
          }}
        >
          {t('seismic.station_code')}: {stationCode}
        </div>
        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, color: '#94a3b8', fontFamily: 'Inter' }}>
          +μm/s
        </div>
        <div style={{ position: 'absolute', bottom: 14, left: 4, fontSize: 8, color: '#94a3b8', fontFamily: 'Inter' }}>
          -μm/s
        </div>
      </div>
    </div>
  )
}
