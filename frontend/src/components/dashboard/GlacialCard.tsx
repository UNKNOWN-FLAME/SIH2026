import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import { useDigitalTwin } from '../../hooks/useDigitalTwin'
import { getCardAnomalyImpact } from '../../utils/anomalyImpact'

interface Props {
  stationId?: string
}

export default function GlacialCard({ stationId = 'maitri' }: Props) {
  const { lastAnomalyResult } = useStation()
  const { data: dt } = useDigitalTwin(stationId)
  const { t } = useLanguage()
  const [viewMode, setViewMode] = useState<'gpr' | 'lss'>('lss')

  const anomalyImpact = getCardAnomalyImpact('glacial', lastAnomalyResult, stationId)
  const isInfected = Boolean(anomalyImpact?.isInfected)

  const isMaitri = stationId === 'maitri'

  // Dynamic LSS & Water Telemetry from Digital Twin
  const dtWaterL = dt?.water?.potable_storage_litres ?? dt?.water?.tank_level_L
  const waterMaxCap = isMaitri ? 16800 : 18000
  let waterReserveL = dtWaterL ?? (isMaitri ? 14800 : 14200)
  if (waterReserveL > waterMaxCap) waterReserveL = Math.round(waterMaxCap * 0.88)
  const waterPct = Math.min(100, Math.round((waterReserveL / waterMaxCap) * 100))
  const waterDays = Math.round(waterReserveL / (isMaitri ? 1100 : 1250))

  const habitatTempC = dt?.hvac?.living_zone_temp_c ?? (isMaitri ? 21.4 : 20.8)

  const lssData = isMaitri
    ? {
        source: 'Lake Priyadarshini Intake (Trace-Heated Line)',
        reserveL: `${waterReserveL.toLocaleString()} Litres`,
        percent: waterPct,
        days: `${waterDays} Days Left`,
        heatState: 'ON (+4.2°C Flow)',
        habitatTemp: `+${habitatTempC.toFixed(1)}°C`,
        habitatZone: 'Quarters (Heated PUF)',
        airO2: 'Safe (20.9% O₂)',
        airSub: 'CO₂: 420 ppm',
        division: 'Maitri Life Support Active',
      }
    : {
        source: 'Seawater Reverse Osmosis (RO) Desalination',
        reserveL: `${waterReserveL.toLocaleString()} Litres`,
        percent: waterPct,
        days: `${waterDays} Days Left`,
        heatState: 'ON (180 L/h RO)',
        habitatTemp: `+${habitatTempC.toFixed(1)}°C`,
        habitatZone: 'Hab Module (Airlock Sealed)',
        airO2: 'Safe (20.9% O₂)',
        airSub: 'TDS: 42 ppm Pure',
        division: 'Bharati Life Support Active',
      }

  // Radar profiles specific to geographical site
  const gprProfile = isMaitri
    ? {
        title: 'GSI RADAR PROFILE MTR-04 (SCHIRMACHER)',
        iceThickness: '142.4 Metres',
        iceSub: 'Continental Blue Ice Sheet',
        cracks: 'Zero (None)',
        cracksSub: '100% Solid Oasis Bedrock',
        bedrockDepth: '-142.4 Metres',
        bedrockSub: 'Gneiss / Amphibolite Rock',
        yMax: '-142 m',
        method: '400 MHz Sub-Surface Radar (GSI & NCPOR)',
      }
    : {
        title: 'GSI RADAR PROFILE BHR-02 (LARSEMANN)',
        iceThickness: '38.4 Metres',
        iceSub: 'Coastal Firn & Marine Ice',
        cracks: 'Zero (None)',
        cracksSub: 'Granite Ridge Foundation',
        bedrockDepth: '-38.4 Metres',
        bedrockSub: 'Solid Granulite Gneiss',
        yMax: '-38 m',
        method: '900 MHz Stepped-Frequency Radar (NCPOR)',
      }

  return (
    <div
      style={{
        width: '100%',
        background: '#ffffff',
        border: isInfected ? '1.5px solid rgba(239, 68, 68, 0.45)' : '1px solid #cbd5e1',
        boxShadow: isInfected
          ? '0 0 10px rgba(239, 68, 68, 0.12)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 185,
        transition: 'all 0.25s ease',
      }}
    >
      {/* Official Government Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: isInfected ? '2px solid #ef4444' : '2px solid #ff9933',
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: isInfected ? '#f87171' : '#ff9933',
              flexShrink: 0,
            }}
          >
            {isInfected ? 'warning' : viewMode === 'gpr' ? 'radar' : 'water_drop'}
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {viewMode === 'gpr' ? `${isMaitri ? 'MAITRI' : 'BHARATI'} ICE RADAR SCAN` : t('lss.title')}
          </span>
          {isInfected && anomalyImpact && (
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fecaca',
                padding: '1px 5px',
                borderRadius: 2,
                border: '1px solid rgba(239, 68, 68, 0.35)',
                letterSpacing: '0.03em',
                flexShrink: 0,
              }}
            >
              ● {anomalyImpact.tag}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => setViewMode(m => m === 'gpr' ? 'lss' : 'gpr')}
            title="Switch View"
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              color: '#ffffff',
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {viewMode === 'gpr' ? 'WATER' : 'RADAR'}
          </button>
          <span
            style={{
              fontSize: 8.5,
              color: '#ffedd5',
              background: 'rgba(255, 153, 51, 0.25)',
              border: '1px solid rgba(255, 153, 51, 0.5)',
              padding: '1px 5px',
              fontWeight: 800,
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {isMaitri ? 'LAKE PRIYADARSHINI' : 'RO DESAL PLANT'}
          </span>
        </div>
      </div>

      {viewMode === 'gpr' ? (
        /* ── OFFICIAL GOVERNMENT SCIENTIFIC GRAPH (Light Theme, Clear Grid & Labels) ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
          {/* Government Legend Ribbon */}
          <div
            style={{
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '5px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 9.5,
              color: '#334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 4, background: '#0284c7', display: 'inline-block' }} />
                <span>Surface Snow</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 4, background: '#0369a1', display: 'inline-block' }} />
                <span>Solid Ice Sheet</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 4, background: '#ea580c', display: 'inline-block' }} />
                <span>Bedrock ({gprProfile.yMax})</span>
              </span>
            </div>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                color: '#166534',
                background: '#dcfce7',
                border: '1px solid #86efac',
                padding: '1px 6px',
                borderRadius: 2,
              }}
            >
              ✓ NO DANGER CRACKS
            </span>
          </div>

          {/* Clean Scientific Graph Canvas */}
          <div style={{ flex: 1, position: 'relative', minHeight: 92, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 320 88" preserveAspectRatio="none">
              <defs>
                <pattern id="radar-grid" width="30" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                </pattern>
                <linearGradient id="gov-snow-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="gov-ice-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="gov-rock-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#ffedd5" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              <rect x="36" y="6" width="280" height="74" fill="url(#radar-grid)" />
              <line x1="36" y1="6" x2="36" y2="80" stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1="36" y1="80" x2="316" y2="80" stroke="#cbd5e1" strokeWidth="1.2" />

              <line x1="36" y1="14" x2="316" y2="14" stroke="#cbd5e1" strokeDasharray="3,3" strokeWidth="0.8" />
              <line x1="36" y1="42" x2="316" y2="42" stroke="#cbd5e1" strokeDasharray="3,3" strokeWidth="0.8" />
              <line x1="36" y1="68" x2="316" y2="68" stroke="#cbd5e1" strokeDasharray="3,3" strokeWidth="0.8" />

              <text x="32" y="17" fill="#475569" fontSize="8" fontWeight="700" fontFamily="Inter" textAnchor="end">0 m</text>
              <text x="32" y="45" fill="#475569" fontSize="8" fontWeight="700" fontFamily="Inter" textAnchor="end">{isMaitri ? '-70 m' : '-18 m'}</text>
              <text x="32" y="71" fill="#ea580c" fontSize="8" fontWeight="800" fontFamily="Inter" textAnchor="end">{gprProfile.yMax}</text>

              <path d="M 36 14 C 95 16, 180 13, 316 15 L 316 23 C 180 21, 95 24, 36 22 Z" fill="url(#gov-snow-fill)" />
              <path d="M 36 14 C 95 16, 180 13, 316 15" fill="none" stroke="#0284c7" strokeWidth="1.8" />

              <path d="M 36 22 C 95 24, 180 21, 316 23 L 316 67 C 200 64, 110 70, 36 67 Z" fill="url(#gov-ice-fill)" />
              <path d="M 36 42 C 110 39, 210 45, 316 41" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,2" />

              <path d="M 36 67 C 110 70, 200 64, 316 67 L 316 80 L 36 80 Z" fill="url(#gov-rock-fill)" />
              <path d="M 36 67 C 110 70, 200 64, 316 67" fill="none" stroke="#ea580c" strokeWidth="2.4" strokeLinecap="round" />

              <text x="40" y="78" fill="#64748b" fontSize="7" fontWeight="600" fontFamily="Inter">0 m (Base Origin)</text>
              <text x="176" y="78" fill="#64748b" fontSize="7" fontWeight="600" fontFamily="Inter" textAnchor="middle">100 m</text>
              <text x="312" y="78" fill="#64748b" fontSize="7" fontWeight="600" fontFamily="Inter" textAnchor="end">200 m</text>
            </svg>

            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 10,
                fontSize: 8,
                fontWeight: 700,
                color: '#0b3b60',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #cbd5e1',
                padding: '1px 5px',
                borderRadius: 2,
              }}
            >
              {gprProfile.title}
            </div>
          </div>

          {/* Simple Government Metrics Bar */}
          <div
            style={{
              background: '#ffffff',
              padding: '6px 10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>ICE THICKNESS</div>
              <div style={{ fontSize: 13, color: '#0b3b60', fontWeight: 800 }}>{gprProfile.iceThickness}</div>
              <div style={{ fontSize: 8, color: '#16a34a', fontWeight: 600 }}>{gprProfile.iceSub}</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>GROUND CRACKS</div>
              <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 800 }}>{gprProfile.cracks}</div>
              <div style={{ fontSize: 8, color: '#16a34a', fontWeight: 600 }}>{gprProfile.cracksSub}</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 700 }}>BEDROCK DEPTH</div>
              <div style={{ fontSize: 13, color: '#ea580c', fontWeight: 800 }}>{gprProfile.bedrockDepth}</div>
              <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>{gprProfile.bedrockSub}</div>
            </div>
          </div>

          <div
            style={{
              background: '#f1f5f9',
              borderTop: '1px solid #e2e8f0',
              padding: '3px 10px',
              fontSize: 8.5,
              color: '#475569',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>● {gprProfile.method}</span>
            <span style={{ color: '#15803d', fontWeight: 700 }}>✓ Certified Solid Foundation</span>
          </div>
        </div>
      ) : (
        /* ── LIFE SUPPORT & WATER VIEW ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
          {/* Source Banner */}
          <div
            style={{
              background: '#f0fdf4',
              borderBottom: '1px solid #dcfce7',
              padding: '5px 10px',
              fontSize: 9.5,
              fontWeight: 700,
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#16a34a' }}>
                verified
              </span>
              <span>{lssData.source}</span>
            </div>
            <span style={{ fontSize: 8.5, background: '#bbf7d0', padding: '1px 6px', borderRadius: 2, color: '#14532d', fontWeight: 800 }}>
              POTABLE & TESTED
            </span>
          </div>

          {/* Water Storage Bar */}
          <div style={{ padding: '8px 12px 6px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.03em' }}>
                {isMaitri ? 'Lake Water Potable Storage' : 'Desalinated Water Storage'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', fontFamily: 'Inter' }}>
                {lssData.reserveL} ({lssData.percent}%) • {lssData.days}
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${lssData.percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          {/* 3 Telemetry Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '0 10px 8px 10px', flex: 1 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 8px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b' }}>
                {isMaitri ? 'Pipe Trace Heat' : 'Desal RO Rate'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginTop: 1 }}>
                {lssData.heatState}
              </div>
              <div style={{ fontSize: 8, color: '#64748b' }}>{isMaitri ? 'No ice in pipe' : 'Continuous Desal'}</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 8px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b' }}>
                {t('lss.indoor_temp')}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                {lssData.habitatTemp}
              </div>
              <div style={{ fontSize: 8, color: '#64748b' }}>{lssData.habitatZone}</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 8px', borderRadius: 2 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b' }}>
                {isMaitri ? 'Air Purity' : 'Water Purity'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                {isMaitri ? lssData.airO2 : lssData.airSub}
              </div>
              <div style={{ fontSize: 8, color: '#16a34a', fontWeight: 600 }}>
                {isMaitri ? lssData.airSub : 'WHO Polar Standard'}
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#f1f5f9',
              borderTop: '1px solid #e2e8f0',
              padding: '3px 10px',
              fontSize: 8.5,
              color: '#475569',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>● NCPOR Environmental & Water Quality Tested</span>
            <span style={{ color: '#0284c7', fontWeight: 700 }}>✓ {lssData.division}</span>
          </div>
        </div>
      )}
    </div>
  )
}
