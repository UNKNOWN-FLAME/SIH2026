import { useStations } from '../../hooks/useStations'
import { useLanguage } from '../../context/LanguageContext'

interface Props {
  active: string
  onSelect: (s: string) => void
  timeRange: string
  onTimeRange: (t: string) => void
}

export default function StationTabs({ active, onSelect, timeRange, onTimeRange }: Props) {
  const { data: stations } = useStations()
  const { t } = useLanguage()

  const maitri = stations?.find((s) => s.station_id === 'maitri')
  const bharati = stations?.find((s) => s.station_id === 'bharati')

  const dotColor = (s: typeof maitri) =>
    !s ? '#94a3b8' : s.link_state === 'UP' ? '#16a34a' : s.link_state === 'DEGRADED' ? '#d97706' : '#dc2626'

  const stateText = (s: typeof maitri) =>
    !s ? 'UNKNOWN' : s.link_state === 'UP' ? t('station.online') : s.link_state === 'DEGRADED' ? t('station.degraded') : t('station.offline')

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Station Selector with Official Coordinates */}
      <div
        style={{
          display: 'flex',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
          padding: 3,
          gap: 4,
        }}
      >
        {[
          {
            id: 'maitri',
            name: t('station.maitri'),
            coords: t('station.maitri_coords'),
            status: maitri,
          },
          {
            id: 'bharati',
            name: t('station.bharati'),
            coords: t('station.bharati_coords'),
            status: bharati,
          },
        ].map(({ id, name, coords, status }) => {
          const isSelected = active === id
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '6px 14px',
                background: isSelected ? '#0b3b60' : 'transparent',
                border: isSelected ? '1px solid #0b3b60' : '1px solid transparent',
                borderLeft: isSelected ? '3px solid #ff9933' : '3px solid transparent',
                cursor: 'pointer',
                fontFamily: 'Inter',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  className="rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: dotColor(status),
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    color: isSelected ? '#ffffff' : '#0f172a',
                  }}
                >
                  {name}
                </span>
                {isSelected && (
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: '#ffffff',
                      background: '#ea580c',
                      padding: '1px 5px',
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 9.5, color: isSelected ? '#cbd5e1' : '#64748b' }}>
                <span>{coords}</span>
                <span>•</span>
                <span style={{ color: isSelected ? '#86efac' : dotColor(status), fontWeight: 700 }}>
                  {stateText(status)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Time Range Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.03em' }}>
          {t('station.interval')}
        </span>
        <div
          style={{
            display: 'flex',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          {[
            { key: '1H', label: t('station.1h') },
            { key: '6H', label: t('station.6h') },
            { key: '24H', label: t('station.24h') },
          ].map(({ key, label }, i) => (
            <button
              key={key}
              onClick={() => onTimeRange(key)}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: 'Inter',
                border: 'none',
                borderRight: i < 2 ? '1px solid #cbd5e1' : 'none',
                transition: 'all 0.15s',
                background: timeRange === key ? '#0b3b60' : 'transparent',
                color: timeRange === key ? '#ffffff' : '#475569',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
