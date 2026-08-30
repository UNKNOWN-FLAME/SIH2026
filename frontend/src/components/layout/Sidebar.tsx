import { useNavigate, useLocation } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import AntarcticMap from '../ui/AntarcticMap'

const NAV_ITEMS = [
  { icon: 'dashboard', label: 'Dashboard', path: '/' },
  { icon: 'hub', label: 'Stations', path: '/stations' },
  { icon: 'bolt', label: 'Energy', path: '/energy' },
  { icon: 'local_shipping', label: 'Logistics', path: '/logistics' },
  { icon: 'eco', label: 'Environment', path: '/environment' },
  { icon: 'foundation', label: 'Infrastructure', path: '/infrastructure' },
  { icon: 'analytics', label: 'Analytics', path: '/analytics' },
  { icon: 'description', label: 'Reports', path: '/reports' },
  { icon: 'settings', label: 'Settings', path: '/settings' },
]

interface Props {
  activeStation: string
  onSwitchStation: () => void
}

export default function Sidebar({ activeStation, onSwitchStation }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: stations } = useStations()

  const maitriStatus = stations?.find(s => s.station_id === 'maitri')
  const bharatiStatus = stations?.find(s => s.station_id === 'bharati')

  const maitriOnline = maitriStatus?.link_state === 'UP'
  const bharatiOnline = bharatiStatus?.link_state === 'UP'

  return (
    <aside style={{
      background: '#0d1c2d', borderRight: '1px solid #45464c',
      width: 200, minWidth: 200, display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Emblem */}
      <div className="sidebar-emblem" style={{ padding: '14px 14px 10px', borderBottom: '1px solid #45464c' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#1a1f2c', border: '1px solid #45464c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c2c6d8' }}>language</span>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#d8c4a8', textTransform: 'uppercase' }}>MoES NCPOR</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d4e4fa', lineHeight: 1.2 }}>OPERATIONAL<br />COMMAND</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#909096', marginTop: 1 }}>V3.02-STABLE</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path
          return (
            <a
              key={item.path}
              href="#"
              onClick={e => { e.preventDefault(); navigate(item.path) }}
              className={active ? 'nav-active' : 'nav-inactive'}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', fontSize: 12, fontWeight: active ? 600 : 400, textDecoration: 'none', transition: 'all 0.15s' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </a>
          )
        })}
      </nav>

      {/* Bottom: switch + map */}
      <div className="sidebar-bottom" style={{ padding: '10px', borderTop: '1px solid #45464c' }}>
        <button
          onClick={onSwitchStation}
          style={{
            width: '100%', border: '1px solid #c2c6d8', background: 'transparent',
            color: '#c2c6d8', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            padding: '7px 4px', cursor: 'pointer', textTransform: 'uppercase',
            fontFamily: 'Inter', marginBottom: 8,
          }}
          onMouseOver={e => ((e.target as HTMLElement).style.background = 'rgba(194,198,216,0.08)')}
          onMouseOut={e => ((e.target as HTMLElement).style.background = 'transparent')}
        >
          SWITCH TO {activeStation === 'maitri' ? 'BHARATI' : 'MAITRI'}
        </button>

        <AntarcticMap
          maitriOnline={maitriOnline}
          bharatiOnline={bharatiOnline}
          activeStation={activeStation}
        />
      </div>
    </aside>
  )
}
