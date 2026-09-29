import { useAlerts } from '../../hooks/useAlerts'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'

export default function AlertStrip() {
  const { data } = useAlerts({ ack_state: 'OPEN', page_size: 10 })
  const { t } = useLanguage()
  const { lastAnomalyResult } = useStation()

  const alerts = data?.items ?? []

  const bulletins = [
    ...(lastAnomalyResult
      ? [`[FAULT INJECTION DRILL] [${lastAnomalyResult.severity}] ${lastAnomalyResult.anomaly_name} (${lastAnomalyResult.station_id?.toUpperCase()} BASE)`]
      : []),
    t('marquee.notice1'),
    alerts.length > 0
      ? alerts.map(a => `[${a.severity}] ${a.station_id.toUpperCase()}: ${a.description}`).join(' • ')
      : t('advisory.all_nominal'),
    t('marquee.notice2'),
    'NCPOR HQ Goa Polar Satellite Telemetry Uplink: GSAT-7 / Inmarsat Encrypted Multi-Beam Nominal',
  ]

  // Render a block of bulletins
  const renderBulletinBlock = () => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20, paddingRight: 20 }}>
      {bulletins.map((item, idx) => (
        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 600, color: '#1e293b' }}>
          <span style={{ color: '#0284c7', fontSize: 8 }}>◆</span>
          <span>{item}</span>
        </span>
      ))}
    </div>
  )

  return (
    <div
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #cbd5e1',
        padding: '3px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 32,
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Official Government "LATEST BULLETINS" Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: '#0b3b60',
          borderLeft: '3px solid #f97316',
          borderRadius: 3,
          padding: '2.5px 8px',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(11, 59, 96, 0.2)',
          zIndex: 5,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#f97316' }}>
          campaign
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff', whiteSpace: 'nowrap' }}>
          {t('marquee.label')}
        </span>
      </div>

      {/* Running Continuous Marquee Ticker */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          maskImage: 'linear-gradient(to right, transparent, black 12px, black 98%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 12px, black 98%, transparent)',
        }}
        title="Hover to pause ticker / स्क्रॉल रोकने के लिए कर्सर ऊपर लाएं"
      >
        <div className="marquee-track">
          {renderBulletinBlock()}
          {renderBulletinBlock()}
        </div>
      </div>
    </div>
  )
}
