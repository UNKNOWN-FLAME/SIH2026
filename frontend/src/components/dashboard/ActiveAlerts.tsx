import { useAlerts, useAcknowledgeAlert } from '../../hooks/useAlerts'
import type { AlertOut } from '../../api/hq'

interface Props { stationId: string }

const SEV_CLASS: Record<string, string> = {
  CRITICAL: 'alert-critical',
  HIGH: 'alert-warning',
  MEDIUM: 'alert-warning',
  LOW: 'alert-info',
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ffb4ab',
  HIGH: '#d8c4a8',
  MEDIUM: '#d8c4a8',
  LOW: '#909096',
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return '—'
  }
}

export default function ActiveAlerts({ stationId }: Props) {
  const { data, isLoading } = useAlerts({ station_id: stationId, ack_state: 'OPEN', page_size: 8 })
  const { mutate: ack, isPending } = useAcknowledgeAlert()

  const alerts: AlertOut[] = data?.items ?? []

  return (
    <div style={{ background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #45464c', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096' }}>ACTIVE ALERTS</span>
        {data && <span style={{ fontSize: 10, color: '#909096' }}>{data.total} total</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isLoading && (
          <div style={{ fontSize: 11, color: '#909096', padding: '4px 0' }}>Loading…</div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div style={{ fontSize: 11, color: '#00a3ad', padding: '4px 0' }}>✓ No active alerts</div>
        )}

        {alerts.map(alert => (
          <div
            key={alert.alert_id}
            className={`alert-row ${SEV_CLASS[alert.severity] ?? 'alert-info'}`}
            style={{ background: '#0d1c2d', padding: '5px 8px', cursor: 'default', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[alert.severity] ?? '#909096', fontFamily: 'Inter' }}>
                {timeLabel(alert.triggered_at)}
              </span>
              <span style={{ fontSize: 11, color: '#d4e4fa', fontFamily: 'Inter', marginLeft: 4 }}>
                {alert.description}
              </span>
            </div>
            {/* Acknowledge button */}
            <button
              onClick={() => ack({ alertId: alert.alert_id })}
              disabled={isPending}
              title="Acknowledge"
              style={{
                background: 'transparent', border: '1px solid #45464c', color: '#909096',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 6px',
                cursor: 'pointer', flexShrink: 0, fontFamily: 'Inter',
              }}
              onMouseOver={e => ((e.currentTarget as HTMLElement).style.borderColor = '#c2c6d8')}
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.borderColor = '#45464c')}
            >
              ACK
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
