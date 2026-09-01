import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useLanguage } from '../../context/LanguageContext'
import GovtOfIndiaLogo from '../ui/GovtOfIndiaLogo'

export default function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { data: dash } = useDashboard()
  const { lang, toggleLang, t } = useLanguage()
  const [timeStr, setTimeStr] = useState<string>('')
  const [fontSize, setFontSize] = useState<string>('normal')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    function updateClock() {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      setTimeStr(new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', options).format(now) + ' IST')
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [lang])

  return (
    <header className="w-full shrink-0 z-50 flex flex-col bg-white shadow-sm">
      {/* ── Tier 1: National Tricolour Stripe ── */}
      <div className="tricolour-ribbon" />

      {/* ── Tier 1: Accessibility & Government of India National Bar (GIGW 3.0 Standard) ── */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '3px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Mini Indian Flag Emblem */}
          <div
            style={{
              width: 18,
              height: 12,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #cbd5e1',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#FFFFFF', position: 'relative' }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#0B3B60', margin: 'auto' }} />
            </div>
            <div style={{ flex: 1, background: '#138808' }} />
          </div>

          <span style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
            {t('gov.title')}
          </span>
          <span style={{ color: '#94a3b8' }}>|</span>
          <span style={{ color: '#1e293b', fontWeight: 600 }}>
            {t('gov.ministry')}
          </span>
          <span style={{ color: '#94a3b8' }} className="hidden md:inline">•</span>
          <span style={{ color: '#475569' }} className="hidden md:inline">
            {t('gov.ncpor_short')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Skip to main content link (GIGW mandatory) */}
          <a
            href="#main-content"
            style={{
              color: '#0b3b60',
              textDecoration: 'none',
              fontSize: 10.5,
              fontWeight: 600,
            }}
            className="hidden lg:inline hover:underline"
          >
            {t('header.skip_main')}
          </a>

          {/* Dynamic Indian Standard Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0b3b60', fontFamily: 'Inter', fontWeight: 700, fontSize: 10.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ea580c' }}>schedule</span>
            <span>{timeStr || 'LIVE IST'}</span>
          </div>

          {/* Text Size Sizer (A- A A+) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#e2e8f0', border: '1px solid #cbd5e1', padding: '1px 2px' }}>
            {(['sm', 'normal', 'lg'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                style={{
                  background: fontSize === size ? '#0b3b60' : 'transparent',
                  color: fontSize === size ? '#ffffff' : '#334155',
                  border: 'none',
                  fontSize: size === 'sm' ? 9.5 : size === 'normal' ? 11 : 12.5,
                  fontWeight: 800,
                  padding: '1px 5px',
                  cursor: 'pointer',
                }}
                title={`${t('header.text_size')}: ${size}`}
              >
                A{size === 'sm' ? '-' : size === 'lg' ? '+' : ''}
              </button>
            ))}
          </div>

          {/* Language Switch Button */}
          <button
            onClick={toggleLang}
            style={{
              background: '#0b3b60',
              border: '1px solid #082842',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              transition: 'background 0.15s',
            }}
            title={lang === 'hi' ? 'Switch portal to English' : 'पोर्टल को हिंदी में बदलें'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ff9933' }}>translate</span>
            <span>{lang === 'hi' ? 'English' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>

      {/* ── Tier 2: The Iconic Official White Government Masthead ── */}
      <div
        style={{
          background: '#ffffff',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {/* Left: Government of India Official Logo + Ministry Hierarchy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Government of India Logo */}
          <GovtOfIndiaLogo size={50} color="#0b3b60" showGovtText={true} textColor="#0b3b60" />

          <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Tier A: Organisation Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('gov.ncpor')}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 3 }}>
                MoES
              </span>
            </div>

            {/* Tier B: Main Application Brand & Title */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1.2 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0b3b60', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
                {t('app.name')}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', letterSpacing: '-0.01em' }}>
                {t('app.title')}
              </span>
            </div>

            {/* Tier C: Subtitle */}
            <div style={{ fontSize: 10.5, fontWeight: 500, color: '#64748b', marginTop: 2, letterSpacing: '0.01em' }}>
              {t('app.subtitle')}
            </div>
          </div>
        </div>

        {/* Right: Digital India Badge + Officer Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Government of India Official Badge */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderTop: '3px solid #FF9933',
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            className="hidden md:flex"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0b3b60' }}>
              verified_user
            </span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.06em' }}>
                {t('badge.govt')}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#ea580c' }}>
                {t('badge.restricted')}
              </div>
            </div>
          </div>

          {/* Officer Profile & Logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '5px 12px',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0b3b60', lineHeight: 1.1 }}>
                {user?.username ? user.username.toUpperCase() : 'OFFICER'}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ea580c', letterSpacing: '0.04em' }}>
                {t('header.hq')}
              </div>
            </div>

            <button
              onClick={logout}
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 800,
                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
              }}
              title={t('header.logout')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>logout</span>
              <span className="hidden sm:inline">{t('header.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tier 3: The Canonical Government Navy Blue Navigation Bar (#0B3B60) ── */}
      <nav
        style={{
          background: '#0b3b60',
          borderBottom: '3px solid #FF9933',
          padding: '0 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 40,
        }}
      >
        {/* Horizontal Navigation Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
          {[
            { label: t('topnav.home'), icon: 'home', path: '/' },
            { label: t('nav.stations'), icon: 'hub', path: '/stations' },
            { label: t('topnav.maitri'), icon: 'foundation', path: '/stations' },
            { label: t('topnav.bharati'), icon: 'domain', path: '/stations' },
            { label: t('topnav.energy'), icon: 'bolt', path: '/energy' },
            { label: t('topnav.logistics'), icon: 'local_shipping', path: '/logistics' },
            { label: t('topnav.weather'), icon: 'thermostat', path: '/' },
            { label: t('topnav.alerts'), icon: 'notifications_active', badge: dash?.critical_alerts, path: '/' },
            { label: t('topnav.reports'), icon: 'description', path: '/' },
          ].map((item, idx) => {
            const active = location.pathname === item.path && (item.path !== '/' || location.pathname === '/')
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                style={{
                  background: active ? '#082545' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '3px solid #FF9933' : '3px solid transparent',
                  color: active ? '#ffffff' : '#cbd5e1',
                  padding: '9px 12px',
                  fontSize: 11.5,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = '#0d4775'
                    ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
                  }
                }}
                onMouseOut={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = '#cbd5e1'
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: active ? '#FF9933' : '#94a3b8' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 9999,
                      marginLeft: 2,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Integrated Government Search Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }} className="hidden md:flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('header.search')}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: 11,
              padding: '5px 10px',
              width: 190,
              outline: 'none',
            }}
          />
          <button
            style={{
              background: '#ea580c',
              border: 'none',
              color: '#ffffff',
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>
            <span>{t('header.search_btn')}</span>
          </button>
        </div>
      </nav>
    </header>
  )
}
