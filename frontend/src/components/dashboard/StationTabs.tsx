import { useStations } from '../../hooks/useStations'

interface Props {
  active: string
  onSelect: (s: string) => void
  timeRange: string
  onTimeRange: (t: string) => void
}

export default function StationTabs({ active, onSelect, timeRange, onTimeRange }: Props) {
  const { data: stations } = useStations()

  const maitri = stations?.find(s => s.station_id === 'maitri')
  const bharati = stations?.find(s => s.station_id === 'bharati')

  const dotColor = (s: typeof maitri) =>
    !s ? '#909096' : s.link_state === 'UP' ? '#10b981' : s.link_state === 'DEGRADED' ? '#d8c4a8' : '#ffb4ab'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      {/* Station Tabs */}
      <div style={{ display: 'flex', background: '#1c2b3c', border: '1px solid #45464c', padding: 3, gap: 2 }}>
        {[
          { id: 'maitri', label: 'MAITRI STATION', status: maitri },
          { id: 'bharati', label: 'BHARATI', status: bharati },
        ].map(({ id, label, status }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={active === id ? 'station-active' : 'station-inactive'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer',
              fontFamily: 'Inter', textTransform: 'uppercase', transition: 'all 0.15s', border: 'none',
            }}
          >
            <span className="rounded-full" style={{ width: 7, height: 7, background: dotColor(status), display: 'inline-block' }} />
            {label}
          </button>
        ))}
      </div>

      {/* Time Range */}
      <div style={{ display: 'flex', background: '#1c2b3c', border: '1px solid #45464c', overflow: 'hidden' }}>
        {['1H', '6H', '24H'].map((t, i) => (
          <button
            key={t}
            onClick={() => onTimeRange(t)}
            className={timeRange === t ? 'time-active' : 'time-inactive'}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              cursor: 'pointer', fontFamily: 'Inter', border: 'none',
              borderRight: i < 2 ? '1px solid #45464c' : 'none', transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
