import { useAlerts } from '../../hooks/useAlerts'

const SEV_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  CRITICAL: { bg: 'rgba(147,0,10,0.15)', border: 'rgba(255,180,171,0.4)', color: '#ffb4ab', icon: 'warning' },
  HIGH:     { bg: 'rgba(40,29,11,0.4)',  border: 'rgba(216,196,168,0.4)', color: '#d8c4a8', icon: 'thermostat' },
  MEDIUM:   { bg: 'rgba(40,29,11,0.4)',  border: 'rgba(216,196,168,0.4)', color: '#d8c4a8', icon: 'local_shipping' },
  LOW:      { bg: 'rgba(30,43,60,0.4)',  border: 'rgba(69,70,76,0.4)',    color: '#909096', icon: 'info' },
}

export default function AlertStrip() {
  const { data, isError } = useAlerts({ ack_state: 'OPEN', page_size: 10 })

  const alerts = data?.items ?? []

  return (
    <div className="alert-strip" style={{
      background: '#0d1c2d', borderBottom: '1px solid #45464c',
      padding: '5px 16px', display: 'flex', alignItems: 'center',
      gap: 12, minHeight: 34,
    }}>
      {isError && (
        <span style={{ fontSize: 11, color: '#909096' }}>⚠ API unreachable — showing last known data</span>
      )}

      {alerts.length === 0 && !isError && (
        <span style={{ fontSize: 11, color: '#00a3ad', fontWeight: 600 }}>✓ No open alerts</span>
      )}

      {alerts.map(alert => {
        const s = SEV_STYLE[alert.severity] ?? SEV_STYLE.LOW
        return (
          <div key={alert.alert_id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: s.bg, border: `1px solid ${s.border}`, padding: '3px 10px',
            flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: s.color }}>{s.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: s.color, letterSpacing: '0.03em' }}>
              {alert.severity}: {alert.description}
            </span>
          </div>
        )
      })}

      {/* Live indicator */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className="pulse-dot rounded-full" style={{ width: 6, height: 6, background: isError ? '#ffb4ab' : '#00a3ad', display: 'inline-block' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: isError ? '#ffb4ab' : '#00a3ad', letterSpacing: '0.06em' }}>
          {isError ? 'OFFLINE' : 'LIVE'}
        </span>
      </div>
    </div>
  )
}
