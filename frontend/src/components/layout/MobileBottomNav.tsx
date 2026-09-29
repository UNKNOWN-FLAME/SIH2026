import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useStation, type StationId } from '../../context/StationContext'
import { useAuth } from '../../hooks/useAuth'
import AnomalyInjector from '../dashboard/AnomalyInjector'

export default function MobileBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const { token } = useAuth()
  const { stationId, setStationId, openBlackBox, isOnline, toggleLinkState } = useStation()
  const [showDrawer, setShowDrawer] = useState(false)

  // Only display for authenticated users and not on login page
  if (!token || location.pathname === '/login') {
    return null
  }

  const primaryItems = [
    { icon: 'dashboard', label: t('nav.dashboard'), path: '/' },
    { icon: 'sensors', label: 'Sensors', path: '/telemetry' },
    { icon: 'bolt', label: 'Power', path: '/energy' },
    { icon: 'local_shipping', label: 'Cargo', path: '/logistics' },
    { icon: 'description', label: 'Reports', path: '/reports' },
  ]

  const secondaryItems = [
    { icon: 'eco', label: t('nav.environment'), path: '/environment' },
    { icon: 'foundation', label: t('nav.infrastructure'), path: '/infrastructure' },
    { icon: 'analytics', label: t('nav.analytics'), path: '/analytics' },
  ]

  return (
    <>
      {/* ── Slide-up Drawer for Extra Navigation & Controls ── */}
      {showDrawer && (
        <div
          onClick={() => setShowDrawer(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 99990,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: 500,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              border: '1px solid #cbd5e1',
              borderBottom: 'none',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.15)',
              padding: '16px 18px 24px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Drawer Handle */}
            <div style={{ width: 36, height: 4, background: '#cbd5e1', borderRadius: 2, margin: '0 auto 4px auto' }} />

            {/* Header with Station Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60' }}>
                  HIMANTAR Polar Fleet Control
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  National Centre for Polar & Ocean Research
                </div>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
              >
                ✕
              </button>
            </div>

            {/* Active Station Selector */}
            <div style={{ display: 'flex', gap: 8, background: '#f8fafc', padding: 4, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {(['maitri', 'bharati'] as StationId[]).map((sid) => (
                <button
                  key={sid}
                  onClick={() => setStationId(sid)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: stationId === sid ? '#0b3b60' : 'transparent',
                    color: stationId === sid ? '#ffffff' : '#475569',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: stationId === sid ? '#ff9933' : '#94a3b8' }} />
                  <span>{sid === 'maitri' ? 'Maitri Base' : 'Bharati Base'}</span>
                </button>
              ))}
            </div>

            {/* Additional Modules Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {secondaryItems.map((item) => {
                const active = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      setShowDrawer(false)
                      navigate(item.path)
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '10px 6px',
                      background: active ? '#f0f9ff' : '#f8fafc',
                      border: active ? '1.5px solid #0b3b60' : '1px solid #e2e8f0',
                      borderRadius: 6,
                      color: active ? '#0b3b60' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: active ? '#0b3b60' : '#64748b' }}>
                      {item.icon}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tactical Actions (Black Box + VSAT) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={() => {
                  setShowDrawer(false)
                  openBlackBox()
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '1.5px solid #ef4444',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                <span>BLACK BOX DVR</span>
              </button>

              <button
                onClick={toggleLinkState}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: isOnline ? '#fef2f2' : '#f0fdf4',
                  color: isOnline ? '#b91c1c' : '#15803d',
                  border: isOnline ? '1.5px solid #f87171' : '1.5px solid #86efac',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <span>{isOnline ? 'SEVER VSAT' : 'RESTORE VSAT'}</span>
              </button>
            </div>

            {/* Anomaly Injector Simulator in Drawer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              <AnomalyInjector activeStation={stationId} variant="sidebar" />
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed Sticky Mobile Bottom Navigation Bar ── */}
      <nav
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: '#0b3b60',
          borderTop: '2px solid #ff9933',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
          zIndex: 99980,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-around',
        }}
      >
        {primaryItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: 'none',
                color: active ? '#ff9933' : '#cbd5e1',
                cursor: 'pointer',
                padding: '4px 2px',
                transition: 'all 0.15s',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 19,
                  color: active ? '#ff9933' : '#ffffff',
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: active ? 800 : 600,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Tactical Black Box Fast Trigger */}
        <button
          type="button"
          onClick={openBlackBox}
          title="Open Flight Data Black Box"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: location.pathname === '/blackbox' ? '#090d16' : 'rgba(15, 23, 42, 0.4)',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            padding: '4px 2px',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 19,
                color: '#ef4444',
              }}
            >
              deployed_code
            </span>
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 4px #ef4444',
              }}
            />
          </div>
          <span style={{ fontSize: 8.5, fontWeight: 900, color: '#fca5a5', lineHeight: 1 }}>
            REC
          </span>
        </button>

        {/* More / All Modules Drawer Toggle */}
        <button
          type="button"
          onClick={() => setShowDrawer((v) => !v)}
          title="Open More Modules"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: showDrawer ? 'rgba(255,255,255,0.15)' : 'transparent',
            border: 'none',
            color: showDrawer ? '#ff9933' : '#cbd5e1',
            cursor: 'pointer',
            padding: '4px 2px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 19, color: showDrawer ? '#ff9933' : '#ffffff' }}>
            apps
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
            More
          </span>
        </button>
      </nav>
    </>
  )
}
