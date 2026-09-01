import { useNavigate, useLocation } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import { useLanguage } from '../../context/LanguageContext'
import AntarcticMap from '../ui/AntarcticMap'
import emblemOfIndia from '../../assets/emblem_of_india.svg'

export default function Sidebar({ activeStation, onSwitchStation }: { activeStation: string; onSwitchStation: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: stations } = useStations()
  const { t } = useLanguage()

  const maitriStatus = stations?.find((s) => s.station_id === 'maitri')
  const bharatiStatus = stations?.find((s) => s.station_id === 'bharati')

  const maitriOnline = maitriStatus?.link_state === 'UP'
  const bharatiOnline = bharatiStatus?.link_state === 'UP'

  const navItems = [
    { icon: 'dashboard', label: t('nav.dashboard'), sub: t('nav.dashboard_sub'), path: '/' },
    { icon: 'hub', label: t('nav.stations'), sub: t('nav.stations_sub'), path: '/stations' },
    { icon: 'bolt', label: t('nav.energy'), sub: t('nav.energy_sub'), path: '/energy' },
    { icon: 'local_shipping', label: t('nav.logistics'), sub: t('nav.logistics_sub'), path: '/logistics' },
    { icon: 'eco', label: t('nav.environment'), sub: t('nav.environment_sub'), path: '/environment' },
    { icon: 'foundation', label: t('nav.infrastructure'), sub: t('nav.infrastructure_sub'), path: '/infrastructure' },
    { icon: 'analytics', label: t('nav.analytics'), sub: t('nav.analytics_sub'), path: '/analytics' },
    { icon: 'description', label: t('nav.reports'), sub: t('nav.reports_sub'), path: '/reports' },
    { icon: 'settings', label: t('nav.settings'), sub: t('nav.settings_sub'), path: '/settings' },
  ]

  return (
    <aside
      style={{
        background: '#ffffff',
        borderRight: '1px solid #cbd5e1',
        width: 220,
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Official Wing Emblem Banner */}
      <div
        className="sidebar-emblem"
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #cbd5e1',
          background: '#0b3b60',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 38,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '2px 3px',
              borderRadius: 2,
            }}
          >
            <img
              src={emblemOfIndia}
              alt="Emblem Logo of India"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: '#ff9933' }}>
              {t('nav.wing_title')}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
              {t('nav.wing_sub')}
            </div>
            <div style={{ fontSize: 8, fontWeight: 600, color: '#cbd5e1', letterSpacing: '0.03em' }}>
              V3.02 • NIC GOI
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav
        style={{
          flex: 1,
          padding: '6px 8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <a
              key={item.path}
              href="#"
              onClick={(e) => {
                e.preventDefault()
                navigate(item.path)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                textDecoration: 'none',
                transition: 'all 0.15s',
                background: active ? '#f0f9ff' : 'transparent',
                borderLeft: active ? '3px solid #0b3b60' : '3px solid transparent',
                borderBottom: '1px solid #f1f5f9',
              }}
              onMouseOver={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = '#f8fafc'
              }}
              onMouseOut={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 18,
                  color: active ? '#0b3b60' : '#64748b',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <div className="sidebar-label" style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? '#0b3b60' : '#1e293b' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 500 }}>
                  {item.sub}
                </div>
              </div>
            </a>
          )
        })}
      </nav>

      {/* Bottom: Station Quick Switch & Antarctic Coordinates Map */}
      <div
        style={{
          padding: '10px',
          borderTop: '1px solid #cbd5e1',
          background: '#f8fafc',
        }}
      >
        <button
          onClick={onSwitchStation}
          style={{
            width: '100%',
            border: '1px solid #0b3b60',
            background: '#ffffff',
            color: '#0b3b60',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '7px 4px',
            cursor: 'pointer',
            fontFamily: 'Inter',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'background 0.15s',
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
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            swap_horiz
          </span>
          <span>
            {t('nav.switch_to')} {activeStation === 'maitri' ? t('station.bharati') : t('station.maitri')}
          </span>
        </button>

        <AntarcticMap
          maitriOnline={maitriOnline}
          bharatiOnline={bharatiOnline}
          activeStation={activeStation}
        />

        {/* Digital India / Atmanirbhar Bharat footer stamp */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center',
            fontSize: 8,
            fontWeight: 700,
            color: '#475569',
            letterSpacing: '0.04em',
          }}
        >
          {t('nav.digital_india')}
        </div>
      </div>
    </aside>
  )
}
