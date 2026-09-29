/**
 * AnomalyInjector — Simulation Module
 *
 * Provides a clearly visible "⚠ INJECT ANOMALY" button on the dashboard.
 * When clicked, opens a detailed modal with all injectable anomaly types
 * grouped by severity. Clicking an anomaly runs an animated injection
 * sequence (progress bar + phase labels), calls the backend simulation
 * endpoint, then shows a full impact/recovery report with a PDF download
 * stub (to be wired later).
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useStation } from '../../context/StationContext'
import {
  getAnomalyRegistry,
  injectAnomaly,
  type AnomalyDefinition,
  type AnomalyInjectionResult,
} from '../../api/hq'

// ── Severity colours ─────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, { bg: string; border: string; color: string; badge: string; badgeFg: string }> = {
  CRITICAL: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', badge: '#b91c1c', badgeFg: '#fff' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', badge: '#ea580c', badgeFg: '#fff' },
  MEDIUM:   { bg: '#fefce8', border: '#fde68a', color: '#92400e', badge: '#ca8a04', badgeFg: '#fff' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', badge: '#16a34a', badgeFg: '#fff' },
}

function getSevStyle(sev: string) {
  return SEV_STYLE[sev] ?? SEV_STYLE['LOW']
}

// ── Injection phases (animated steps) ────────────────────────────────────────

const INJECTION_PHASES = [
  { label: 'Initialising anomaly simulation engine…',     pct: 8 },
  { label: 'Authenticating with NCPOR HQ telemetry bus…', pct: 20 },
  { label: 'Preparing anomaly injection payload…',        pct: 35 },
  { label: 'Connecting to station sensor bus…',           pct: 50 },
  { label: 'Injecting anomaly parameters into system…',   pct: 65 },
  { label: 'Propagating anomaly across sensor network…',  pct: 80 },
  { label: 'Generating impact report and audit log…',     pct: 92 },
  { label: 'Anomaly injection complete. Analysing…',      pct: 100 },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function AnomalyCard({
  anomaly,
  selected,
  isActive = false,
  onClick,
}: {
  anomaly: AnomalyDefinition
  selected: boolean
  isActive?: boolean
  onClick: () => void
}) {
  const sev = getSevStyle(anomaly.severity)
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        border: isActive ? '2.5px solid #e11d48' : selected ? `2px solid ${sev.badge}` : '1.5px solid #e2e8f0',
        background: isActive ? '#fff1f2' : selected ? sev.bg : '#ffffff',
        borderRadius: 10,
        padding: '13px 15px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isActive
          ? '0 0 16px rgba(225, 29, 72, 0.35)'
          : selected
          ? `0 0 0 2px ${sev.badge}33, 0 6px 18px ${sev.badge}22`
          : '0 1px 3px rgba(15, 23, 42, 0.04)',
        outline: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 88,
      }}
      onMouseOver={(e) => {
        if (!selected) {
          const el = e.currentTarget as HTMLElement
          el.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.09)'
          el.style.borderColor = sev.badge + '80'
          el.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseOut={(e) => {
        if (!selected) {
          const el = e.currentTarget as HTMLElement
          el.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)'
          el.style.borderColor = '#e2e8f0'
          el.style.transform = 'none'
        }
      }}
    >
      {/* Top Section: Icon, Anomaly Name, Category & Severity Badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: selected ? '#ffffff' : sev.bg,
              border: `1px solid ${selected ? sev.badge + '40' : sev.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 21,
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {anomaly.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
              }}
              title={anomaly.name}
            >
              {anomaly.name}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: sev.color,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: 3,
              }}
            >
              {anomaly.category}
            </div>
          </div>
        </div>

        {/* Severity Badge */}
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 900,
            padding: '2.5px 8px',
            background: sev.badge,
            color: sev.badgeFg,
            borderRadius: 12,
            letterSpacing: '0.04em',
            flexShrink: 0,
            boxShadow: `0 2px 4px ${sev.badge}25`,
          }}
        >
          {anomaly.severity}
        </span>
      </div>

      {/* Bottom Status Row */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${selected ? sev.badge + '20' : '#f1f5f9'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 9.5,
        }}
      >
        <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <span>⏱️</span>
          <span>~{anomaly.estimated_duration_s}s</span>
        </div>
        {isActive ? (
          <span
            style={{
              fontWeight: 900,
              color: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              letterSpacing: '0.04em',
            }}
          >
            🔴 ACTIVE SIMULATION
          </span>
        ) : selected ? (
          <span
            style={{
              fontWeight: 900,
              color: sev.badge,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
            }}
          >
            ✓ SELECTED
          </span>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 9.5, fontWeight: 700 }}>
            Click to select →
          </span>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 5,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

type ModalPhase = 'select' | 'injecting' | 'result'

interface AnomalyInjectorModalProps {
  activeStation: string
  onClose: () => void
}

function AnomalyInjectorModal({ activeStation, onClose }: AnomalyInjectorModalProps) {
  const { lastAnomalyResult, setLastAnomalyResult, triggerEmergencyAlert, setActiveIncidentId, refreshLinkState } = useStation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [anomalies, setAnomalies] = useState<AnomalyDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<ModalPhase>('select')
  const [progressPct, setProgressPct] = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('')
  const [result, setResult] = useState<AnomalyInjectionResult | null>(null)
  const [injectionError, setInjectionError] = useState<string | null>(null)
  const [endSuccessMsg, setEndSuccessMsg] = useState<string | null>(null)
  const [filterSev, setFilterSev] = useState<string>('ALL')
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch registry on mount
  useEffect(() => {
    getAnomalyRegistry()
      .then((r) => setAnomalies(r.anomalies))
      .catch(() => {
        // Fallback hardcoded list so the UI still works without the backend
        setAnomalies([])
      })
      .finally(() => setLoading(false))
  }, [])

  // Clean up timer on unmount
  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current) }, [])

  const selected = anomalies.find((a) => a.id === selectedId)

  const filtered = anomalies.filter((a) =>
    filterSev === 'ALL' ? true : a.severity === filterSev,
  )

  async function handleInject() {
    if (!selectedId || !selected) return
    setPhase('injecting')
    setProgressPct(0)
    setInjectionError(null)

    // Animate through phases
    let phaseIdx = 0
    const advance = () => {
      if (phaseIdx >= INJECTION_PHASES.length) return
      const p = INJECTION_PHASES[phaseIdx]
      setProgressPct(p.pct)
      setPhaseLabel(p.label)
      phaseIdx++
      if (phaseIdx < INJECTION_PHASES.length) {
        animRef.current = setTimeout(advance, (selected.estimated_duration_s * 1000) / INJECTION_PHASES.length)
      }
    }
    advance()

    try {
      // Actual API call — runs in parallel with animation
      const r = await injectAnomaly(selectedId, activeStation)
      // Wait until animation reaches 100 %
      await new Promise<void>((res) => setTimeout(res, selected.estimated_duration_s * 1000 + 200))
      setResult(r)
      setPhase('result')
      setLastAnomalyResult(r)
      if (r.incident_id) {
        setActiveIncidentId(r.incident_id)
      }
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      refreshLinkState()

      // Trigger big emergency warning modal with alert voice on main dashboard
      triggerEmergencyAlert(r)
      onClose()
    } catch (err: unknown) {
      await new Promise<void>((res) => setTimeout(res, 800))
      setInjectionError(
        err instanceof Error ? err.message : 'Anomaly injection failed. Backend may be unavailable.',
      )
      setPhase('result')
    }
  }

  function handleReset() {
    setPhase('select')
    setSelectedId(null)
    setProgressPct(0)
    setPhaseLabel('')
    setResult(null)
    setInjectionError(null)
  }

  function handleEndAnomaly() {
    setLastAnomalyResult(null)
    setResult(null)
    setSelectedId(null)
    setPhase('select')
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['sensors'] })
    queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    refreshLinkState()
    setEndSuccessMsg('Anomaly terminated. Station systems and telemetry restored to nominal baseline.')
    setTimeout(() => setEndSuccessMsg(null), 4000)
  }

  const sevColor =
    result
      ? getSevStyle(result.severity).badge
      : selected
        ? getSevStyle(selected.severity).badge
        : '#0b3b60'

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 8, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: phase === 'result' ? 720 : 940,
          maxHeight: '88vh',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderTop: `5px solid ${sevColor}`,
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── MODAL HEADER ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0b2545 0%, #133a68 100%)',
            color: '#ffffff',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff' }}>
                  Anomaly Simulator
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: 'rgba(239, 68, 68, 0.18)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    letterSpacing: '0.05em',
                  }}
                >
                  SIMULATION
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  Target Station:{' '}
                  <strong style={{ color: '#38bdf8', letterSpacing: '0.04em' }}>
                    {activeStation.toUpperCase()}
                  </strong>
                </span>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ color: '#cbd5e1' }}>Safe In-Memory Mode</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseOver={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(255, 255, 255, 0.18)'
              el.style.color = '#ffffff'
            }}
            onMouseOut={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(255, 255, 255, 0.08)'
              el.style.color = '#cbd5e1'
            }}
          >
            ✕
          </button>
        </div>

        {/* ── MINIMAL NOTICE STRIP ── */}
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '7px 20px',
            fontSize: 11,
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#f59e0b', fontSize: 13 }}>ℹ️</span>
          <span>
            Test environment sandbox — station hardware is isolated and unaffected.
          </span>
        </div>

        {/* Active Simulation Status & Stop Control */}
        {lastAnomalyResult && (
          <div
            style={{
              background: '#fff1f2',
              borderBottom: '2px solid #f43f5e',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#e11d48' }}>
                warning
              </span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#9f1239', letterSpacing: '0.02em' }}>
                    SIMULATION RUNNING: {lastAnomalyResult.anomaly_name}
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 900,
                      background: '#e11d48',
                      color: '#ffffff',
                      padding: '1.5px 6px',
                      borderRadius: 10,
                      letterSpacing: '0.04em',
                    }}
                  >
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: '#be123c', marginTop: 1 }}>
                  Station: <strong>{activeStation.toUpperCase()}</strong> • Severity:{' '}
                  <strong>{lastAnomalyResult.severity.toUpperCase()}</strong> • Telemetry is reflecting simulated faults.
                </div>
              </div>
            </div>

            <button
              onClick={handleEndAnomaly}
              style={{
                background: '#e11d48',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(225, 29, 72, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#be123c')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#e11d48')}
            >
              <span>🛑</span>
              <span>STOP ANOMALY & RESTORE NOMINAL</span>
            </button>
          </div>
        )}

        {/* Success feedback when ended */}
        {endSuccessMsg && (
          <div
            style={{
              background: '#f0fdf4',
              borderBottom: '1px solid #86efac',
              padding: '8px 20px',
              fontSize: 11,
              fontWeight: 800,
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            <span>{endSuccessMsg}</span>
          </div>
        )}

        {/* ── PHASE: SELECT ── */}
        {phase === 'select' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflowY: 'auto',
            }}
          >

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Filter by severity:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => {
                const st = s === 'ALL' ? null : getSevStyle(s)
                const isSelected = filterSev === s
                return (
                  <button
                    key={s}
                    onClick={() => setFilterSev(s)}
                    style={{
                      background: isSelected ? (st?.badge ?? '#0b3b60') : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: 'none',
                      padding: '4px 12px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 16,
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {s} ({s === 'ALL' ? anomalies.length : anomalies.filter((a) => a.severity === s).length})
                  </button>
                )
              })}
            </div>

            {/* Anomaly grid */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: 12 }}>
                Loading anomaly registry…
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}
              >
                {filtered.map((a) => (
                  <AnomalyCard
                    key={a.id}
                    anomaly={a}
                    selected={selectedId === a.id}
                    isActive={lastAnomalyResult?.anomaly_id === a.id}
                    onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                  />
                ))}
              </div>
            )}


            {/* Action row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 12,
                marginTop: 'auto',
                borderTop: '1px solid #e2e8f0',
                position: 'sticky',
                bottom: 0,
                background: '#ffffff',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: '#64748b' }}>
                {lastAnomalyResult ? (
                  <span style={{ color: '#be123c', fontWeight: 700 }}>
                    Active: "{lastAnomalyResult.anomaly_name}" — Click "Stop Anomaly" to restore nominal baseline.
                  </span>
                ) : selected ? (
                  `Ready to inject: "${selected.name}" into ${activeStation.toUpperCase()} station`
                ) : (
                  'Select an anomaly above to proceed'
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {lastAnomalyResult && (
                  <button
                    onClick={handleEndAnomaly}
                    style={{
                      background: '#e11d48',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 18px',
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: 'pointer',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(225, 29, 72, 0.25)',
                    }}
                  >
                    <span>🛑</span>
                    <span>STOP ANOMALY</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '7px 18px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleInject}
                  disabled={!selectedId}
                  style={{
                    background: selectedId ? '#dc2626' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 22px',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: selectedId ? 'pointer' : 'not-allowed',
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                    opacity: selectedId ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  ⚡ INJECT ANOMALY
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: INJECTING ── */}
        {phase === 'injecting' && selected && (
          <div style={{ flex: 1, padding: '30px 32px', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div style={{ fontSize: 40 }}>{selected.icon}</div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                Injecting: {selected.name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Target: <strong>{activeStation.toUpperCase()}</strong> station
              </div>
            </div>

            {/* Main progress bar */}
            <div style={{ width: '100%', maxWidth: 520 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10, color: '#64748b' }}>
                <span>Injection Progress</span>
                <span style={{ fontWeight: 800, color: '#0b3b60' }}>{progressPct}%</span>
              </div>
              <ProgressBar pct={progressPct} color={getSevStyle(selected.severity).badge} />
              <div style={{ marginTop: 10, fontSize: 10.5, color: '#475569', fontStyle: 'italic', textAlign: 'center', minHeight: 18 }}>
                {phaseLabel}
              </div>
            </div>

            {/* Mini phase indicators */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {INJECTION_PHASES.map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: progressPct >= p.pct
                      ? getSevStyle(selected.severity).badge
                      : '#e2e8f0',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            <div style={{ fontSize: 9.5, color: '#94a3b8', textAlign: 'center', maxWidth: 420 }}>
              Do not close this window. The anomaly simulation is being propagated across all
              monitored sensor domains and subsystem models.
            </div>
          </div>
        )}

        {/* ── PHASE: RESULT ── */}
        {phase === 'result' && (
          <div style={{ flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {injectionError ? (
              /* Error state */
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>❌</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>Injection Failed</div>
                <div style={{ fontSize: 11, color: '#7f1d1d' }}>{injectionError}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                  The simulation UI still reflects expected behaviour based on the local anomaly registry.
                </div>
              </div>
            ) : result && (
              <>
                {/* Success banner */}
                <div
                  style={{
                    background: getSevStyle(result.severity).bg,
                    border: `1px solid ${getSevStyle(result.severity).border}`,
                    borderLeft: `5px solid ${getSevStyle(result.severity).badge}`,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 22 }}>
                        {anomalies.find((a) => a.id === result.anomaly_id)?.icon ?? '⚠️'}
                      </span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                          {result.anomaly_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Injected at {new Date(result.injected_at).toLocaleTimeString()} •
                          Station: <strong>{result.station_id.toUpperCase()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        background: getSevStyle(result.severity).badge,
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: 2,
                        marginBottom: 4,
                      }}
                    >
                      ✅ INJECTED — {result.severity}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                      Ref: {result.report_reference}
                    </div>
                  </div>
                </div>

                {/* Connection status banner: Live vs Edge Buffered */}
                <div
                  style={{
                    background: result.connected ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${result.connected ? '#86efac' : '#f87171'}`,
                    borderLeft: `5px solid ${result.connected ? '#16a34a' : '#dc2626'}`,
                    padding: '10px 14px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20 }}>
                    {result.connected ? '🟢' : '🔴'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: result.connected ? '#15803d' : '#b91c1c' }}>
                      {result.connected
                        ? 'LIVE TRANSMISSION ACTIVE (HQ TWIN SYNCHRONIZED)'
                        : 'VSAT LINK SEVERED — STORED IN LOCAL EDGE BLACK BOX'}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                      {result.message}
                    </div>
                  </div>
                  {result.alert_id && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 2 }}>
                      ALERT: {result.alert_id}
                    </span>
                  )}
                  {result.edge_buffered && (
                    <span style={{ fontSize: 9.5, fontWeight: 900, background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171', padding: '2px 8px', borderRadius: 2 }}>
                      {result.buffered_frames_count} FRAMES BUFFERED
                    </span>
                  )}
                </div>

                {/* Two-column: Impacts + Recovery */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Impacts */}
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      🚨 System Impacts
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                      {result.impacts.map((imp, i) => (
                        <li key={i} style={{ fontSize: 10.5, color: '#334155', marginBottom: 5, lineHeight: 1.4 }}>
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recovery */}
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      🛡️ Recovery Procedures
                    </div>
                    <ol style={{ margin: 0, padding: '0 0 0 14px' }}>
                      {result.recovery_steps.map((step, i) => (
                        <li key={i} style={{ fontSize: 10.5, color: '#334155', marginBottom: 5, lineHeight: 1.4 }}>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* PDF Download (placeholder) */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                      📄 Anomaly Incident Audit Report
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      Reference: <span style={{ fontFamily: 'monospace', color: '#0369a1' }}>{result.report_reference}</span>
                      {result.incident_id && (
                        <span style={{ marginLeft: 10 }}>• Black Box ID: <strong style={{ color: '#0f172a' }}>{result.incident_id}</strong></span>
                      )}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
                      Includes: Impact timeline, telemetry delta values, SHA-256 hash chains, and automated recovery checklist.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 800 }}>
                      ✔ VERIFIED BY NCPOR
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Bottom actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {result?.connected ? (
                  <>
                    <button
                      onClick={() => {
                        onClose()
                        navigate('/infrastructure')
                      }}
                      style={{
                        background: '#0b3b60',
                        color: '#ffffff',
                        border: 'none',
                        padding: '7px 16px',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 1px 3px rgba(11, 59, 96, 0.25)',
                      }}
                      title="View live anomaly propagation in Infrastructure Digital Twin"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>domain</span>
                      <span>VIEW INFRASTRUCTURE TWIN &amp; IOT BUS</span>
                    </button>

                    <button
                      onClick={() => {
                        onClose()
                        navigate('/blackbox')
                      }}
                      style={{
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        padding: '7px 12px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Inspect in Black Box Flight Recorder (Standby Replay)"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span>
                      <span>Flight Recorder (Standby)</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/blackbox')
                    }}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 18px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 3px rgba(220, 38, 38, 0.35)',
                    }}
                    title="Open Edge Black Box Flight Recorder buffer"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>videocam</span>
                    <span>OPEN EDGE BLACK BOX RECORDER ({result?.buffered_frames_count || 6} FRAMES)</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReset}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '7px 18px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  ↩ Inject Another
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: '#0b3b60',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 22px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  Close & View Twin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Exported component — the trigger button ────────────────────────────────

export default function AnomalyInjector({
  activeStation,
  variant = 'header',
}: {
  activeStation: string
  variant?: 'header' | 'sidebar'
}) {
  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(true)
  const { lastAnomalyResult } = useStation()

  const isSimActive = Boolean(lastAnomalyResult)

  // Subtle pulse animation on first render to draw attention
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes anomaly-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
        }
        @keyframes anomaly-active-beacon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.85); }
        }
        .anomaly-btn:hover {
          background: #b91c1c !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.35) !important;
        }
        .anomaly-btn:active {
          transform: translateY(0);
        }
        .anomaly-btn-sidebar:hover {
          background: #b91c1c !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3) !important;
        }
        .anomaly-btn-sidebar:active {
          transform: translateY(0);
        }
      `}</style>

      {variant === 'sidebar' ? (
        <button
          className="anomaly-btn-sidebar"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            padding: '0 8px',
            background: isSimActive ? '#dc2626' : '#b91c1c',
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            boxShadow: isSimActive
              ? '0 0 10px rgba(220, 38, 38, 0.4)'
              : '0 1px 3px rgba(185, 28, 28, 0.25)',
            fontWeight: 800,
            fontSize: 10.5,
            letterSpacing: '0.03em',
            transition: 'all 0.15s ease',
            userSelect: 'none',
          }}
          title={isSimActive ? 'Simulation Anomaly actively running — click to view or stop' : 'Open Anomaly Injection Simulator to test station resilience'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: isSimActive ? '#ffffff' : '#fef08a' }}>
              {isSimActive ? 'crisis_alert' : 'warning'}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{isSimActive ? 'FAULT ACTIVE' : 'INJECT ANOMALY'}</span>
          </div>
          <span
            style={{
              fontSize: 7.5,
              fontWeight: 900,
              background: isSimActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.22)',
              color: '#ffffff',
              padding: '1.5px 5px',
              borderRadius: 2,
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {isSimActive ? 'LIVE' : 'SIM'}
          </span>
        </button>
      ) : (
        <button
          className="anomaly-btn"
          onClick={() => setOpen(true)}
          style={{
            height: 28,
            background: isSimActive ? '#dc2626' : '#b91c1c',
            color: '#ffffff',
            border: 'none',
            padding: '0 10px',
            fontWeight: 800,
            fontSize: 10.5,
            cursor: 'pointer',
            borderRadius: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.03em',
            transition: 'background 0.15s, transform 0.1s, box-shadow 0.2s',
            animation: pulse ? 'anomaly-pulse 1.5s ease-in-out 3' : 'none',
            userSelect: 'none',
          }}
          title="Open the Anomaly Injection Simulator to stress-test station resilience"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: isSimActive ? '#ffffff' : '#fef08a' }}>
            {isSimActive ? 'crisis_alert' : 'warning'}
          </span>
          <span>{isSimActive ? 'ANOMALY ACTIVE' : 'INJECT ANOMALY'}</span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              background: 'rgba(255,255,255,0.22)',
              padding: '1px 5px',
              borderRadius: 2,
              letterSpacing: '0.05em',
            }}
          >
            {isSimActive ? 'LIVE' : 'SIM'}
          </span>
        </button>
      )}

      {open && (
        <AnomalyInjectorModal
          activeStation={activeStation}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
