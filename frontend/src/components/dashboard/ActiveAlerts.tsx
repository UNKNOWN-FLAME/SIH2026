import { useAlerts, useAcknowledgeAlert } from '../../hooks/useAlerts'
import { useLanguage } from '../../context/LanguageContext'
import type { AlertOut } from '../../api/hq'

interface Props { stationId: string }

const SEV_CLASS: Record<string, string> = {
  CRITICAL: 'alert-critical',
  HIGH: 'alert-warning',
  MEDIUM: 'alert-warning',
  LOW: 'alert-info',
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#d97706',
  MEDIUM: '#0284c7',
  LOW: '#64748b',
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
  const { t } = useLanguage()

  const alerts: AlertOut[] = data?.items ?? []

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
            notifications_active
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('alerts.title')}
          </span>
        </div>
        {data && (
          <span style={{ fontSize: 10, color: '#f8fafc', fontWeight: 700 }}>
            {t('alerts.total')}: <span style={{ color: '#ffedd5', background: 'rgba(255, 153, 51, 0.25)', padding: '1px 5px' }}>{data.total}</span>
          </span>
        )}
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isLoading && (
          <div style={{ fontSize: 11, color: '#64748b', padding: '4px 0' }}>{t('alerts.loading')}</div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div style={{ fontSize: 11, color: '#16a34a', padding: '6px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontWeight: 600 }}>
            ✓ {t('alerts.none')}
          </div>
        )}

        {alerts.map((alert) => (
          <div
            key={alert.alert_id}
            className={`alert-row ${SEV_CLASS[alert.severity] ?? 'alert-info'}`}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 8px',
              cursor: 'default',
              transition: 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: SEV_COLOR[alert.severity] ?? '#64748b',
                  fontFamily: 'Inter',
                }}
              >
                [{alert.severity}] {timeLabel(alert.triggered_at)}:
              </span>
              <span style={{ fontSize: 11, color: '#1e293b', fontFamily: 'Inter', marginLeft: 4, fontWeight: 500 }}>
                {alert.description}
              </span>
            </div>

            {/* Acknowledge button */}
            <button
              onClick={() => ack({ alertId: alert.alert_id })}
              disabled={isPending}
              title="Acknowledge Alert"
              style={{
                background: '#ffffff',
                border: '1px solid #0b3b60',
                color: '#0b3b60',
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '0.04em',
                padding: '3px 8px',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'Inter',
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#0b3b60'
                ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#ffffff'
                ;(e.currentTarget as HTMLElement).style.color = '#0b3b60'
              }}
            >
              {t('alerts.ack')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
