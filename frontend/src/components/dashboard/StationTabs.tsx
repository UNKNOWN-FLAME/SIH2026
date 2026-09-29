import { useStations } from '../../hooks/useStations'
import { useStation, type StationId } from '../../context/StationContext'

interface Props {
  active: string
  onSelect: (s: StationId) => void
  timeRange?: string
  onTimeRange?: (t: string) => void
}

export default function StationTabs({ active, onSelect }: Props) {
  const { data: stations } = useStations()
  const { linkState: currentLinkState, stationId: currentStationId } = useStation()

  const maitri = stations?.find((s) => s.station_id === 'maitri')
  const bharati = stations?.find((s) => s.station_id === 'bharati')

  const getEffectiveLink = (id: StationId, s: typeof maitri): string => {
    if (id === currentStationId) {
      return currentLinkState
    }
    return s?.link_state ?? 'UP'
  }

  const dotColor = (link: string) =>
    link === 'UP' ? '#16a34a' : link === 'DEGRADED' ? '#d97706' : '#dc2626'

  const STATIONS = [
    {
      id: 'maitri' as StationId,
      name: 'Maitri Research Station',
      location: '70°45′S, 11°44′E • Schirmacher Oasis',
      status: maitri,
    },
    {
      id: 'bharati' as StationId,
      name: 'Bharati Research Station',
      location: '69°24′S, 76°11′E • Larsemann Hills',
      status: bharati,
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        padding: 4,
        gap: 6,
        marginBottom: 10,
        width: '100%',
      }}
    >
      {STATIONS.map(({ id, name, location, status }) => {
        const isSelected = active === id
        const link = getEffectiveLink(id, status)
        const isUp = link === 'UP'

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: isSelected ? '#0b3b60' : '#f8fafc',
              border: isSelected ? '1px solid #0b3b60' : '1px solid #e2e8f0',
              borderLeft: isSelected ? '3px solid #ff9933' : '3px solid transparent',
              cursor: 'pointer',
              borderRadius: 2,
              transition: 'background 0.15s ease, border-color 0.15s ease',
              textAlign: 'left',
            }}
          >
            {/* Left: Indicator dot + Name + Simple coords */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dotColor(link),
                  boxShadow: isUp ? '0 0 0 2px rgba(22, 163, 74, 0.25)' : 'none',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    letterSpacing: '0.01em',
                    color: isSelected ? '#ffffff' : '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: isSelected ? '#94a3b8' : '#64748b',
                    marginTop: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {location}
                </div>
              </div>
            </div>

            {/* Right: Clean minimal status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isUp ? (isSelected ? '#86efac' : '#15803d') : (isSelected ? '#fca5a5' : '#dc2626'),
                }}
              >
                {isUp ? 'Online' : 'Offline'}
              </span>
              {isSelected && (
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    background: 'rgba(255, 153, 51, 0.2)',
                    color: '#ff9933',
                    border: '1px solid #ff9933',
                    padding: '1px 6px',
                    borderRadius: 2,
                    letterSpacing: '0.04em',
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
