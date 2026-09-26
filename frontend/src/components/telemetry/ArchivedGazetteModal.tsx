import { useState } from 'react'
import GovtOfIndiaLogo from '../ui/GovtOfIndiaLogo'
import { useLanguage } from '../../context/LanguageContext'

interface Props {
  stationId?: 'maitri' | 'bharati' | string
  onClose?: () => void
  inline?: boolean
}

interface ArchivedWeekData {
  id: string
  weekLabel: string
  dateRange: string
  sitrepNumber: string
  totalReadings: string
  avgPower: string
  fuelRemaining: string
  blackBoxIncidents: number
  linkUptime: string
  hashVerified: string
}

const WEEKS_DATA: Record<string, ArchivedWeekData[]> = {
  maitri: [
    {
      id: 'w37',
      weekLabel: 'Week 37',
      dateRange: '11 Sep 2026 – 18 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/MAI/2026-W37',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (93.8% Saved)',
      avgPower: '84.2 kW',
      fuelRemaining: '138,400 Litres (214 Days Autonomy)',
      blackBoxIncidents: 1,
      linkUptime: '99.4% (ISRO GSAT-30)',
      hashVerified: 'SHA256:7f8b92c4e1a056d39fa451b68ce92d4f8a123e7b',
    },
    {
      id: 'w36',
      weekLabel: 'Week 36',
      dateRange: '04 Sep 2026 – 11 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/MAI/2026-W36',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (94.1% Saved)',
      avgPower: '83.9 kW',
      fuelRemaining: '141,800 Litres (221 Days Autonomy)',
      blackBoxIncidents: 0,
      linkUptime: '98.8% (Blizzard Outage 14h buffered)',
      hashVerified: 'SHA256:5b2149e89d10acb78119024f9104dc4a675e8812',
    },
    {
      id: 'w35',
      weekLabel: 'Week 35',
      dateRange: '28 Aug 2026 – 04 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/MAI/2026-W35',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (94.0% Saved)',
      avgPower: '85.1 kW',
      fuelRemaining: '145,200 Litres (228 Days Autonomy)',
      blackBoxIncidents: 0,
      linkUptime: '99.8% (Nominal clear sky)',
      hashVerified: 'SHA256:9c1a04b12f8e65d38fa221b68ce92d4f8a342a99',
    },
  ],
  bharati: [
    {
      id: 'w37',
      weekLabel: 'Week 37',
      dateRange: '11 Sep 2026 – 18 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/BHR/2026-W37',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (93.9% Saved)',
      avgPower: '96.4 kW',
      fuelRemaining: '210,500 Litres (248 Days Autonomy)',
      blackBoxIncidents: 1,
      linkUptime: '99.1% (ISRO GSAT-30)',
      hashVerified: 'SHA256:3a1c9e88d2f00b7415a782ef9104dc4a675e2199',
    },
    {
      id: 'w36',
      weekLabel: 'Week 36',
      dateRange: '04 Sep 2026 – 11 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/BHR/2026-W36',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (94.2% Saved)',
      avgPower: '95.8 kW',
      fuelRemaining: '214,900 Litres (255 Days Autonomy)',
      blackBoxIncidents: 0,
      linkUptime: '99.5% (Nominal link)',
      hashVerified: 'SHA256:88a10b4f32e91ca7119024f9104dc4a675e3341',
    },
    {
      id: 'w35',
      weekLabel: 'Week 35',
      dateRange: '28 Aug 2026 – 04 Sep 2026',
      sitrepNumber: 'NCPOR/SITREP/45-ISEA/BHR/2026-W35',
      totalReadings: '60,480 Samples Decimated to 672 Hourly Rollups (94.0% Saved)',
      avgPower: '97.2 kW',
      fuelRemaining: '219,300 Litres (262 Days Autonomy)',
      blackBoxIncidents: 0,
      linkUptime: '97.4% (Severe Katabatic gale 28h buffered)',
      hashVerified: 'SHA256:44b91ac08f7129d38fa221b68ce92d4f8a892b11',
    },
  ],
}

export default function ArchivedGazetteModal({
  stationId: initialStationId = 'maitri',
  onClose,
  inline = false,
}: Props) {
  const { lang } = useLanguage()
  const [stationId, setStationId] = useState<'maitri' | 'bharati'>(
    initialStationId === 'bharati' ? 'bharati' : 'maitri'
  )

  const weeks = WEEKS_DATA[stationId] || WEEKS_DATA.maitri
  const [selectedWeekId, setSelectedWeekId] = useState<string>('w37')
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null)

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0]
  const stationName = stationId === 'maitri' ? 'MAITRI BASE (70°45′S, 11°44′E)' : 'BHARATI BASE (69°24′S, 76°11′E)'
  const stationRegion = stationId === 'maitri' ? 'Schirmacher Oasis, Queen Maud Land' : 'Larsemann Hills, Prydz Bay'

  function handlePrint() {
    window.print()
  }

  function handleDownloadRaw() {
    const rawContent = `================================================================================
THE GAZETTE OF INDIA : EXTRAORDINARY — POLAR OPERATIONS DIVISION
MINISTRY OF EARTH SCIENCES (MoES), GOVT. OF INDIA
NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR), HEADQUARTERS, GOA
================================================================================
OFFICIAL WEEKLY TELEMETRY DIGEST & ARCHIVE SITUATION REPORT
Document Reference   : ${selectedWeek.sitrepNumber}
Station Location     : ${stationName} — ${stationRegion}
Archived Timeframe   : ${selectedWeek.dateRange}
Verification Status  : Certified Ed25519 Cryptographic Chain
Data Storage Tier    : GIGW 3.0 Standardized Cold Archival (> 7 Days)
Generated Timestamp  : ${new Date().toUTCString()}
--------------------------------------------------------------------------------

1. STATION OPERATIONAL HEALTH AUDIT
   - Primary Microgrid Load Avg    : ${selectedWeek.avgPower}
   - Polar Fuel Reserves Remaining : ${selectedWeek.fuelRemaining}
   - Ground Satellite Uplink       : ${selectedWeek.linkUptime}
   - Decimation Storage Factor     : ${selectedWeek.totalReadings}

2. INCIDENT & TAMPER-EVIDENT REGISTRATION
   - Registered Black-Box Windows  : ${selectedWeek.blackBoxIncidents} Locked Incident Frame(s)
   - Cryptographic Hash Signature  : ${selectedWeek.hashVerified}
   - Chain Integrity Verification  : Zero modifications detected. Unbroken Ed25519 hash chain.

3. STATUTORY COMPLIANCE DECLARATION
   Telemetry samples older than 7 calendar days have been securely compressed
   and purged from the transactional database in accordance with MoES Polar
   Data Governance Directives. This document constitutes the permanent golden record.

   Digitally Signed & Sealed by:
   Director, National Centre for Polar and Ocean Research (NCPOR)
   Head of Polar Operations, Ministry of Earth Sciences, Govt. of India
================================================================================`

    const blob = new Blob([rawContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedWeek.sitrepNumber.replace(/\//g, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setDownloadMsg(`✓ Downloaded ${selectedWeek.sitrepNumber.replace(/\//g, '_')}.txt`)
    setTimeout(() => setDownloadMsg(null), 4000)
  }

  const documentCard = (
    <div
      className="gazette-modal-container"
      style={{
        width: '100%',
        maxWidth: inline ? '100%' : 820,
        background: '#ffffff',
        maxHeight: inline ? 'none' : '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: inline ? '0 1px 3px rgba(0,0,0,0.06)' : '0 20px 50px rgba(0,0,0,0.5)',
        border: '1px solid #cbd5e1',
        position: 'relative',
        marginBottom: inline ? 16 : 0,
      }}
    >
      {/* Top Control Toolbar (Hidden when printing) */}
      <div
        className="no-print"
        style={{
          background: '#0b3b60',
          borderBottom: '3px solid #ff9933',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#ff9933', fontSize: 22 }}>
            policy
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
              {lang === 'hi' ? 'आधिकारिक सरकारी राजपत्र एवं शीत-संग्रह (SitRep)' : 'OFFICIAL GOVERNMENT ARCHIVE & GAZETTE SITREP'}
            </div>
            <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>
              GIGW 3.0 / Nic Meghraj Compliant • Cold Storage for Historical Telemetry (&gt; 7 Days)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Station switcher */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setStationId('maitri')}
              style={{
                background: stationId === 'maitri' ? '#ff9933' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: 'none',
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              MAITRI
            </button>
            <button
              type="button"
              onClick={() => setStationId('bharati')}
              style={{
                background: stationId === 'bharati' ? '#ff9933' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: 'none',
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              BHARATI
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              padding: '5px 12px',
              fontSize: 10.5,
              fontWeight: 800,
              borderRadius: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Print official document or Save as PDF"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
            <span>{lang === 'hi' ? 'प्रिंट / पीडीएफ सहेजें' : 'Print / Save PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadRaw}
            style={{
              background: '#f8fafc',
              color: '#0b3b60',
              border: '1px solid #cbd5e1',
              padding: '5px 10px',
              fontSize: 10.5,
              fontWeight: 800,
              borderRadius: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
            <span>TXT</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: 'none',
                padding: '4px 9px',
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 2,
                cursor: 'pointer',
                marginLeft: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

        {/* Week Selector Bar (Hidden when printing) */}
        <div
          className="no-print"
          style={{
            background: '#f1f5f9',
            borderBottom: '1px solid #cbd5e1',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Select Past Week:
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {weeks.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeekId(w.id)}
                  style={{
                    background: selectedWeekId === w.id ? '#0b3b60' : '#ffffff',
                    color: selectedWeekId === w.id ? '#ffffff' : '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '4px 10px',
                    fontSize: 10,
                    fontWeight: selectedWeekId === w.id ? 800 : 600,
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  {w.weekLabel} ({w.dateRange.split('–')[0].trim()})
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, color: '#64748b' }}>
            Reference: <strong style={{ color: '#0b3b60', fontFamily: 'monospace' }}>{selectedWeek.sitrepNumber}</strong>
          </div>
        </div>

        {downloadMsg && (
          <div style={{ background: '#ecfdf5', color: '#166534', padding: '4px 16px', fontSize: 10, fontWeight: 700 }}>
            {downloadMsg}
          </div>
        )}

        {/* ═══════════ THE OFFICIAL GAZETTE DOCUMENT (A4 PAPER SIMULATION) ═══════════ */}
        <div
          id="printable-gazette-doc"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px 40px',
            background: '#fcfcfb',
            color: '#0f172a',
            fontFamily: 'Georgia, serif',
            position: 'relative',
          }}
        >
          {/* Subtle Document Watermark */}
          <div
            style={{
              position: 'absolute',
              top: '42%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-30deg)',
              fontSize: 60,
              fontWeight: 900,
              color: 'rgba(11, 59, 96, 0.04)',
              pointerEvents: 'none',
              userSelect: 'none',
              letterSpacing: '10px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            NCPOR • POLAR ARCHIVE
          </div>

          {/* National Tricolour Ribbon at top of page */}
          <div style={{ height: 4, display: 'flex', width: '100%', marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#FFFFFF', border: '0.5px solid #cbd5e1' }} />
            <div style={{ flex: 1, background: '#138808' }} />
          </div>

          {/* Official Emblem & Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <GovtOfIndiaLogo size={54} color="#0b3b60" showGovtText={false} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              भारत सरकार • GOVERNMENT OF INDIA
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 1 }}>
              पृथ्वी विज्ञान मंत्रालय • MINISTRY OF EARTH SCIENCES
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 1 }}>
              राष्ट्रीय ध्रुवीय एवं समुद्री अनुसंधान केंद्र (NCPOR), वास्को-डि-गामा, गोवा
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
              45वां भारतीय वैज्ञानिक अंटार्कटिक अभियान (45th Indian Scientific Expedition to Antarctica)
            </div>

            <div style={{ margin: '14px auto 0 auto', width: '80%', borderBottom: '1.5px solid #0f172a' }} />
            <div style={{ margin: '2px auto 14px auto', width: '80%', borderBottom: '0.5px solid #0f172a' }} />

            <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: '0.06em' }}>
              साप्ताहिक टेलीमेट्री एवं परिचालन स्थिति प्रतिवेदन (SITREP)
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              WEEKLY POLAR EXPEDITION TELEMETRY ARCHIVE DIGEST
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              border: '1px solid #cbd5e1',
              padding: '10px 14px',
              fontSize: 10.5,
              background: '#ffffff',
              marginBottom: 16,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Gazette Serial Ref:</span>{' '}
              <strong style={{ color: '#0b3b60' }}>{selectedWeek.sitrepNumber}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Archived Window:</span>{' '}
              <strong>{selectedWeek.dateRange}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Station Identity:</span>{' '}
              <strong>{stationName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Ground Satellite Lock:</span>{' '}
              <strong style={{ color: '#16a34a' }}>{selectedWeek.linkUptime}</strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#64748b' }}>Decimation Ratio:</span>{' '}
              <strong>{selectedWeek.totalReadings}</strong>
            </div>
          </div>

          {/* Section 1: Subsystem Health Rollup */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#0b3b60',
                borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              1. प्रमुख उपप्रणालियों की परिचालन स्थिति (Subsystem Telemetry Summary)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Subsystem Unit</th>
                  <th style={{ padding: '6px 8px' }}>Average Operational Load</th>
                  <th style={{ padding: '6px 8px' }}>Cold Resistance Metric</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>Primary Microgrid (DG-1, DG-2, BESS)</td>
                  <td style={{ padding: '6px 8px' }}>{selectedWeek.avgPower} continuous</td>
                  <td style={{ padding: '6px 8px' }}>Coolant Temp +86.2°C nominal</td>
                  <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 800 }}>NORMAL</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>Arctic Grade Fuel Reserve</td>
                  <td style={{ padding: '6px 8px' }}>{selectedWeek.fuelRemaining}</td>
                  <td style={{ padding: '6px 8px' }}>Thermal Tracing Line Active (-38°C)</td>
                  <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 800 }}>AUTONOMOUS</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>Habitat Life Support & HVAC</td>
                  <td style={{ padding: '6px 8px' }}>+21.4°C Living Core / 410 ppm CO₂</td>
                  <td style={{ padding: '6px 8px' }}>Triple-Glazed Thermal Aerogel</td>
                  <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 800 }}>NOMINAL</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>Snow-Melt Fresh Water Recycler</td>
                  <td style={{ padding: '6px 8px' }}>9,200 Litres Reservoir Buffer</td>
                  <td style={{ padding: '6px 8px' }}>CHP Waste Heat Re-use (+48°C)</td>
                  <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 800 }}>OPTIMAL</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Cryptographic Black Box Audit */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#0b3b60',
                borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              2. घटना अभिलेख एवं डिजिटल ब्लैक-बॉक्स सत्यापन (Black-Box Cryptographic Registration)
            </div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '10px 14px',
                fontSize: 10,
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.5,
              }}
            >
              <div>
                <strong>Recorded Critical Incidents:</strong> {selectedWeek.blackBoxIncidents} event(s) locked during this weekly period.
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Ed25519 & SHA-256 Hash Chain:</strong>{' '}
                <span style={{ fontFamily: 'monospace', color: '#0369a1', fontWeight: 800 }}>
                  {selectedWeek.hashVerified}
                </span>
              </div>
              <div style={{ marginTop: 4, color: '#166534', fontWeight: 700 }}>
                ✓ Cryptographic Chain Authenticated: Telemetry sequence anchors to on-station hardware security module. Tampering resistance confirmed under Ministry Guidelines.
              </div>
            </div>
          </div>

          {/* Section 3: Official Signoff & Digital Blue Ink Seal */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div>
              <div style={{ fontSize: 9.5, color: '#64748b' }}>NIC MEGHRAJ CLOUD VAULT ID:</div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                NCPOR-GOI-ARC-2026-99382-SEC
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                GIGW 3.0 Standard • Ministry of Earth Sciences
              </div>
            </div>

            {/* Official Blue Ink Circular Seal + Signature Block */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              {/* Simulated Official Blue Stamp Seal */}
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  border: '2px solid #0369a1',
                  color: '#0369a1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 7.5,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                  margin: '0 auto 6px auto',
                  transform: 'rotate(-8deg)',
                  boxShadow: 'inset 0 0 4px rgba(3, 105, 161, 0.2)',
                  letterSpacing: '0.04em',
                }}
              >
                <div>★ NCPOR ★</div>
                <div style={{ fontSize: 6.5 }}>POLAR DIVISION</div>
                <div style={{ fontSize: 8.5, color: '#0b3b60', fontWeight: 900 }}>CERTIFIED</div>
                <div style={{ fontSize: 6.5 }}>GOVT. OF INDIA</div>
              </div>

              <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0b3b60' }}>
                डॉ. निदेशक / Dr. Director
              </div>
              <div style={{ fontSize: 9.5, color: '#334155' }}>
                ध्रुवीय प्रचालन प्रभाग (Head of Polar Operations)
              </div>
              <div style={{ fontSize: 8.5, color: '#64748b' }}>
                NCPOR, Ministry of Earth Sciences, Goa
              </div>
            </div>
          </div>
      </div>
    </div>
  )

  if (inline) {
    return documentCard
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 15, 30, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      {documentCard}
    </div>
  )
}
