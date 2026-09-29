import { useStations } from '../../hooks/useStations'
import { useLanguage } from '../../context/LanguageContext'
import { useStation, type StationId } from '../../context/StationContext'
import DownloadReportButton from './DownloadReportButton'

interface Props {
  active: string
  onSelect: (s: StationId) => void
  timeRange?: string
  onTimeRange?: (t: string) => void
}

export default function StationTabs({ active, onSelect }: Props) {
  const { data: stations } = useStations()
  const { linkState: currentLinkState, stationId: currentStationId } = useStation()
  const { t } = useLanguage()

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

  const stateText = (link: string) =>
    link === 'UP' ? t('station.online') : link === 'DEGRADED' ? t('station.degraded') : t('station.offline')

  const statusTextColor = (link: string, isSelected: boolean) => {
    if (link === 'UP') return isSelected ? '#86efac' : '#16a34a'
    if (link === 'DEGRADED') return isSelected ? '#fde047' : '#d97706'
    return isSelected ? '#fca5a5' : '#dc2626'
  }

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
      {/* Station Selector Tabs */}
      <div
        style={{
          display: 'flex',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)',
          padding: 4,
          gap: 6,
          flex: 1,
        }}
      >
        {[
          {
            id: 'maitri' as StationId,
            name: t('station.maitri'),
            coords: t('station.maitri_coords'),
            status: maitri,
          },
          {
            id: 'bharati' as StationId,
            name: t('station.bharati'),
            coords: t('station.bharati_coords'),
            status: bharati,
          },
        ].map(({ id, name, coords, status }) => {
          const isSelected = active === id
          const link = getEffectiveLink(id, status)
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '5px 12px',
                background: isSelected ? '#0b3b60' : '#f8fafc',
                border: isSelected ? '1px solid #0b3b60' : '1px solid #e2e8f0',
                borderLeft: isSelected ? '3px solid #ff9933' : '3px solid transparent',
                cursor: 'pointer',
                fontFamily: 'Inter',
                transition: 'all 0.15s',
                borderRadius: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: dotColor(link),
                      display: 'inline-block',
                      boxShadow: link === 'DOWN' ? '0 0 6px rgba(220, 38, 38, 0.6)' : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      color: isSelected ? '#ffffff' : '#0f172a',
                    }}
                  >
                    {name}
                  </span>
                </div>
                {isSelected && (
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      color: link === 'DOWN' ? '#991b1b' : '#166534',
                      background: link === 'DOWN' ? '#fee2e2' : '#dcfce7',
                      border: `1px solid ${link === 'DOWN' ? '#fca5a5' : '#86efac'}`,
                      padding: '1px 6px',
                      borderRadius: 2,
                    }}
                  >
                    ACTIVE STATION
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10.5, color: isSelected ? '#cbd5e1' : '#64748b' }}>
                <span>{coords}</span>
                <span>•</span>
                <span style={{ color: statusTextColor(link, isSelected), fontWeight: 700 }}>
                  ● {stateText(link)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Station Operations Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DownloadReportButton stationId={active} />
      </div>
    </div>
  )
}
