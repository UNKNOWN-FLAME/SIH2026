interface Props { stationId: string }

export default function SeismicCard({ stationId }: Props) {
  const stationCode = stationId === 'maitri' ? 'MAITRI-01' : 'BHARATI-01'

  return (
    <div style={{ gridColumn: 'span 4', background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px', display: 'flex', flexDirection: 'column', minHeight: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #45464c', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096' }}>SEISMIC TELEMETRY</span>
        <span className="pulse-dot badge-rec">● REC</span>
      </div>

      {/* Waveform */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(69,70,76,0.4)' }}>
        {/* Grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 300 80" preserveAspectRatio="none">
          <defs>
            <pattern id="seismic-grid" width="30" height="20" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#1c2b3c" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="300" height="80" fill="url(#seismic-grid)" />
          <line x1="0" y1="40" x2="300" y2="40" stroke="#273647" strokeWidth="1" />
        </svg>

        {/* Animated waveform */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <svg style={{ width: '200%', height: '100%' }} viewBox="0 0 600 80" preserveAspectRatio="none" className="seismic-line">
            <path
              d="M0,40 L15,40 L20,32 L25,48 L30,40 L60,40 L65,35 L70,45 L75,40 L120,40 L125,22 L130,58 L135,40 L180,40 L185,36 L190,44 L195,40 L240,40 L245,30 L250,50 L255,40 L300,40 L305,38 L310,42 L315,40 L360,40 L365,15 L370,65 L375,40 L420,40 L425,34 L430,46 L435,40 L480,40 L485,28 L490,52 L495,40 L540,40 L545,38 L550,42 L555,40 L600,40"
              fill="none" stroke="#c2c6d8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Labels */}
        <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, fontWeight: 500, color: '#909096', fontFamily: 'Inter', pointerEvents: 'none' }}>FREQ: 0.1-10Hz</div>
        <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 500, color: '#909096', fontFamily: 'Inter', pointerEvents: 'none' }}>STA: {stationCode}</div>
        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, color: '#273647', fontFamily: 'Inter' }}>+μm/s</div>
        <div style={{ position: 'absolute', bottom: 14, left: 4, fontSize: 8, color: '#273647', fontFamily: 'Inter' }}>-μm/s</div>
      </div>
    </div>
  )
}
