import { useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'
import AnomalyInjector from '../dashboard/AnomalyInjector'
import emblemOfIndia from '../../assets/emblem_of_india.svg'

export default function Sidebar({
  activeStation: _activeStation,
  onSwitchStation: _onSwitchStation,
}: {
  activeStation?: string
  onSwitchStation?: () => void
} = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const { stationId, openBlackBox } = useStation()
  const currentStation = _activeStation || stationId || 'maitri'

  const navItems = [
    { icon: 'dashboard', label: t('nav.dashboard'), sub: t('nav.dashboard_sub'), path: '/' },
    { icon: 'sensors', label: t('nav.telemetry'), sub: t('nav.telemetry_sub'), path: '/telemetry' },
    { icon: 'bolt', label: t('nav.energy'), sub: t('nav.energy_sub'), path: '/energy' },
    { icon: 'local_shipping', label: t('nav.logistics'), sub: t('nav.logistics_sub'), path: '/logistics' },
    { icon: 'eco', label: t('nav.environment'), sub: t('nav.environment_sub'), path: '/environment' },
    { icon: 'foundation', label: t('nav.infrastructure'), sub: t('nav.infrastructure_sub'), path: '/infrastructure' },
    { icon: 'analytics', label: t('nav.analytics'), sub: t('nav.analytics_sub'), path: '/analytics' },
    { icon: 'description', label: t('nav.reports'), sub: t('nav.reports_sub'), path: '/reports' },
  ]

  return (
    <aside
      className="app-sidebar"
      style={{
        background: '#ffffff',
        borderRight: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        maxHeight: '100vh',
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      {/* Official Wing Emblem Banner */}
      <div
        className="sidebar-emblem"
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #cbd5e1',
          background: '#0b3b60',
          flexShrink: 0,
        }}
      >
        <div className="sidebar-emblem-inner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 30,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '2px',
              borderRadius: 2,
            }}
          >
            <img
              src={emblemOfIndia}
              alt="Emblem Logo of India"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div className="sidebar-emblem-text">
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: '#ff9933' }}>
              {t('nav.wing_title')}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
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
          padding: '5px 7px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <a
              key={item.path}
              href="#"
              className="sidebar-nav-item"
              title={`${item.label} (${item.sub})`}
              onClick={(e) => {
                e.preventDefault()
                navigate(item.path)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                textDecoration: 'none',
                transition: 'all 0.15s',
                background: active ? '#f0f9ff' : 'transparent',
                borderLeft: active ? '3px solid #0b3b60' : '3px solid transparent',
                borderBottom: '1px solid #f8fafc',
                borderRadius: 2,
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
                  fontSize: 17,
                  color: active ? '#0b3b60' : '#64748b',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <div className="sidebar-label" style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 11, fontWeight: active ? 800 : 600, color: active ? '#0b3b60' : '#1e293b' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 8, color: '#64748b', fontWeight: 500 }}>
                  {item.sub}
                </div>
              </div>
            </a>
          )
        })}

        {/* Anomaly Injector button just below Official Reports */}
        <div className="sidebar-anomaly-wrapper" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          <AnomalyInjector activeStation={currentStation} variant="sidebar" />
        </div>
      </nav>

      {/* ── PINNED AT END OF SIDEBAR: SQUARE BLACK BOX BUTTON ── */}
      <div
        className="sidebar-blackbox-container"
        style={{
          padding: '8px 10px 10px 10px',
          borderTop: '1px solid #cbd5e1',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 'auto',
        }}
      >
        <button
          type="button"
          className="sidebar-blackbox-btn"
          onClick={openBlackBox}
          title="Open Polar Black Box — Mission Telemetry & Flight Data Recorder"
          style={{
            width: 86,
            height: 86,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: 6,
            background: location.pathname === '/blackbox' ? '#090d16' : '#0f172a',
            color: '#ffffff',
            border: location.pathname === '/blackbox' ? '2px solid #ef4444' : '1.5px solid #334155',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: location.pathname === '/blackbox'
              ? '0 0 14px rgba(239, 68, 68, 0.45), 0 3px 8px rgba(0,0,0,0.3)'
              : '0 2px 6px rgba(0,0,0,0.18)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#090d16'
            e.currentTarget.style.borderColor = '#ef4444'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 5px 14px rgba(239, 68, 68, 0.35)'
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== '/blackbox') {
              e.currentTarget.style.background = '#0f172a'
              e.currentTarget.style.borderColor = '#334155'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)'
            }
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          {/* Top pulse REC indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 7.5, fontWeight: 900, color: '#ef4444', letterSpacing: '0.08em' }}>
              REC
            </span>
          </div>

          {/* Center Flight Recorder Icon */}
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 24,
              color: location.pathname === '/blackbox' ? '#ef4444' : '#f1f5f9',
            }}
          >
            deployed_code
          </span>

          {/* Main Title */}
          <div className="sidebar-blackbox-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 900,
                letterSpacing: '0.07em',
                fontFamily: 'monospace',
                color: '#ffffff',
                lineHeight: 1.1,
                textAlign: 'center',
              }}
            >
              BLACK BOX
            </span>

            {/* Subtitle */}
            <span style={{ fontSize: 7, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.03em' }}>
              DVR LOGS
            </span>
          </div>
        </button>
      </div>
    </aside>
  )
}

