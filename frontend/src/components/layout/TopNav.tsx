import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../context/LanguageContext'
import { useStation } from '../../context/StationContext'

export default function TopNav() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { lang, toggleLang, t } = useLanguage()
  const { isOnline, edgeBufferCount, toggleLinkState, flushEdgeBuffer } = useStation()
  const [timeStr, setTimeStr] = useState<string>('')

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
      {/* ── Tier 1: Accessibility & Government of India National Bar (GIGW 3.0 Standard) ── */}
      <div
        className="topbar-tier1"
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '3px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#334155',
          flexWrap: 'wrap',
          gap: '4px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

          <span style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em', fontSize: 10.5 }}>
            {t('gov.title')}
          </span>
          <span style={{ color: '#94a3b8' }} className="hidden sm:inline">|</span>
          <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 10.5 }} className="hidden sm:inline">
            {t('gov.ministry')}
          </span>
          <span style={{ color: '#94a3b8' }} className="hidden lg:inline">•</span>
          <span style={{ color: '#475569', fontSize: 10.5 }} className="hidden lg:inline">
            {t('gov.ncpor_short')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Dynamic Indian Standard Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0b3b60', fontFamily: 'Inter', fontWeight: 700, fontSize: 10 }}>
            <span className="material-symbols-outlined hidden sm:inline" style={{ fontSize: 13, color: '#ea580c' }}>schedule</span>
            <span>{timeStr || 'LIVE IST'}</span>
          </div>

          {/* VSAT Link Status & Edge Buffer Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOnline ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#15803d',
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
                title="VSAT Telemetry stream is CONNECTED. Live alerts & sensors flow directly to HQ Digital Twin."
              >
                <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                <span className="hidden sm:inline">VSAT LINK LIVE (HQ DIRECT)</span>
                <span className="inline sm:hidden">VSAT LIVE</span>
                <button
                  onClick={toggleLinkState}
                  style={{
                    background: '#e2e8f0',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    marginLeft: 4,
                  }}
                  title="Simulate VSAT severed / blackout outage"
                >
                  <span className="hidden sm:inline">SEVER LINK</span>
                  <span className="inline sm:hidden">SEVER</span>
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#b91c1c',
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.3)',
                }}
                title="VSAT link is severed! Station running in Autonomous Edge Mode. Telemetry buffering in Black Box."
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite', flexShrink: 0 }} />
                <span className="hidden sm:inline">VSAT SEVERED • EDGE BUFFER ({edgeBufferCount} FRAMES)</span>
                <span className="inline sm:hidden">BUFFER ({edgeBufferCount})</span>
                <button
                  onClick={flushEdgeBuffer}
                  style={{
                    background: '#dc2626',
                    border: '1px solid #991b1b',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    marginLeft: 4,
                  }}
                  title="Restore link and flush Edge Black Box buffer to Cloud HQ"
                >
                  <span className="hidden sm:inline">RESTORE & SYNC</span>
                  <span className="inline sm:hidden">SYNC</span>
                </button>
              </div>
            )}
          </div>

          {/* On-Ice Station Edge Console Toggle */}
          <button
            onClick={() => window.open('/edge', '_blank', 'noopener,noreferrer')}
            style={{
              background: '#042f2e',
              border: '1px solid #14b8a6',
              color: '#2dd4bf',
              fontSize: 10.5,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 0 8px rgba(20, 184, 166, 0.25)',
              letterSpacing: '0.02em',
            }}
            title="Open On-Ice Station Edge Console in new tab (Maitri LAN 192.168.1.10)"
          >
            <span style={{ fontSize: 12 }}>❄️</span>
            <span className="hidden sm:inline">ON-ICE CONSOLE</span>
            <span className="inline sm:hidden">ON-ICE</span>
            <span style={{ fontSize: 10 }}>↗</span>
          </button>

          {/* Language Switch Button */}
          <button
            onClick={toggleLang}
            style={{
              background: '#0b3b60',
              border: '1px solid #082842',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 800,
              padding: '2px 8px',
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
            <span>{lang === 'hi' ? 'EN' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>

      {/* ── Tier 2: The Iconic Official White Government Masthead ── */}
      <div
        className="topbar-tier2"
        style={{
          background: '#ffffff',
          padding: '5px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #FF9933',
          flexWrap: 'wrap',
          gap: '6px 12px',
        }}
      >
        {/* Left: Ministry Hierarchy & Application Brand */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          title="HIMANTAR Home"
        >
          {/* Official Circular NCPOR Logo */}
          <img
            src="/ncpor_logo.png"
            alt="NCPOR Logo"
            className="topbar-ncpor-logo"
            style={{ height: 42, width: 42, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Tier A: Organisation Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('gov.ncpor')}
              </span>
              <span className="hidden sm:inline" style={{ fontSize: 8.5, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: 3 }}>
                MoES
              </span>
            </div>

            {/* Tier B: Main Application Brand Logo & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.2 }}>
              <img
                src="/himantar_logo.png"
                alt="HIMANTAR"
                style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '-0.01em' }}>
                {t('app.title')}
              </span>
            </div>

            {/* Tier C: Subtitle */}
            <div className="hidden md:block" style={{ fontSize: 9.5, fontWeight: 500, color: '#64748b', marginTop: 1, letterSpacing: '0.01em' }}>
              {t('app.subtitle')}
            </div>
          </div>
        </div>

        {/* Right: Digital India Badge + Officer Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Officer Profile & Logout */}
          <div
            className="topbar-officer-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '4px 10px',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', lineHeight: 1.1 }}>
                {user?.username ? user.username.toUpperCase() : 'OFFICER'}
              </div>
              <div className="hidden sm:block" style={{ fontSize: 8.5, fontWeight: 700, color: '#ea580c', letterSpacing: '0.04em' }}>
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
    </header>
  )
}


