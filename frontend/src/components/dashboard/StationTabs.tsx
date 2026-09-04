import { useStations } from '../../hooks/useStations'
import { useLanguage } from '../../context/LanguageContext'

interface Props {
  active: string
  onSelect: (s: string) => void
  timeRange?: string
  onTimeRange?: (t: string) => void
}

export default function StationTabs({ active, onSelect }: Props) {
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
    </div>
  )
}
