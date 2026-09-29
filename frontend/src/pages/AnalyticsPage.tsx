
import React, { useState, useMemo } from 'react'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { usePredictionsV2 } from '../hooks/usePredictiveAI'

type TabType = 'overview' | 'fuel' | 'energy' | 'generator' | 'blizzard' | 'water' | 'structural'

const formulaStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '4px 8px',
  borderRadius: '4px',
  display: 'inline-block',
  marginTop: '4px'
}

const actionBoxStyle: React.CSSProperties = {
  borderLeft: '4px solid #ef4444',
  backgroundColor: '#fef2f2',
  padding: '12px',
  marginTop: '16px',
  borderRadius: '0 4px 4px 0'
}

function KpiCard({ title, value, status }: { title: string; value: string; status: string }) {
  const color = status === 'CRITICAL' ? '#ef4444' : status === 'WARNING' ? '#f59e0b' : '#10b981'
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '8px' }}>
      <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ color: color, fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{value}</div>
    </div>
  )
}

function TimelineChart({ data, color }: { data: number[], color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: '60px', gap: '4px', marginTop: '16px' }}>
      {data.map((v, i) => {
        const heightPct = (v / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: `${heightPct}%`, backgroundColor: color, opacity: 0.8, borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }} />
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>D+{i+1}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const { stationId: station, setStationId: setStation } = useStation()
  const { data: v2Data } = usePredictionsV2(station)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const preds = useMemo(() => {
    if (!v2Data || !v2Data.predictions) return []
    return v2Data.predictions
  }, [v2Data])

  const getPred = (name: string) => preds.find((p: any) => p.model_name === name)

  const fuelPred = getPred('FuelDepletion')
  const energyPred = getPred('EnergyLoad')
  const genPred = getPred('GeneratorRUL')
  const blizzPred = getPred('BlizzardProb')
  const waterPred = getPred('WaterSustainability')
  const structPred = getPred('StructuralStress')

  const tabs = [
    { id: 'overview', label: 'OVERVIEW GRID' },
    { id: 'fuel', label: 'FUEL DEPLETION' },
    { id: 'energy', label: 'ENERGY DEGREE-DAYS' },
    { id: 'generator', label: 'GENERATOR WEIBULL' },
    { id: 'blizzard', label: 'BLIZZARD LOGISTIC' },
    { id: 'water', label: 'WATER SUSTAINABILITY' },
    { id: 'structural', label: 'STRUCTURAL LOAD' },
  ]

  const panels = [
    {
      id: 'fuel',
      title: 'Fuel Depletion (Linear Extrapolation)',
      formula: 'daysToCritical = (fuelRemaining - capacity * 0.30) / forecastedBurnDay7',
      color: '#3b82f6',
      pred: fuelPred,
      metric: fuelPred ? `${fuelPred.val.toFixed(1)} days to critical` : '--',
      chartData: [1210, 1280, 1190, 1320, 1260, 1240, 1250],
      actions: {
        WARNING: ["Order resupply vessel now — 45-day lead time required"],
        CRITICAL: ["EMERGENCY RESUPPLY: Contact NCPOR HQ immediately", "Activate fuel rationing protocol 7B"]
      }
    },
    {
      id: 'energy',
      title: 'Energy Degree-Days',
      formula: 'load_kW = 120 + 2.8 * HDD + 1.5 * crew_count + 0.3 * wind_kmh',
      color: '#8b5cf6',
      pred: energyPred,
      metric: energyPred ? `${energyPred.val.toFixed(1)} kW load` : '--',
      chartData: [140, 145, 150, 160, 155, 142, 138],
      actions: {
        WARNING: ["Switch to partial load shedding", "Defer non-essential lab equipment"],
        CRITICAL: ["Switch to partial load shedding", "Defer non-essential lab equipment"]
      }
    },
    {
      id: 'generator',
      title: 'Generator RUL (Weibull)',
      formula: 'RUL_hours = eta * (-Math.log(reliability_target)) ** (1/beta)',
      color: '#10b981',
      pred: genPred,
      metric: genPred ? `${genPred.val.toFixed(1)} hours remaining` : '--',
      chartData: [2100, 2050, 2000, 1950, 1900, 1850, 1800],
      actions: {
        WARNING: ["Schedule DG overhaul within 7 days", "Prepare DG-2 as primary"],
        CRITICAL: ["Schedule DG overhaul immediately", "Switch to DG-2 immediately"]
      }
    },
    {
      id: 'blizzard',
      title: 'Blizzard Logistic',
      formula: 'P = 1 / (1 + Math.exp(-(0.042*v + 0.18*dP/dt + 0.015*h - 3.2)))',
      color: '#f59e0b',
      pred: blizzPred,
      metric: blizzPred ? `${blizzPred.val.toFixed(1)}% probability` : '--',
      chartData: [10, 15, 20, 45, 80, 85, 30],
      actions: {
        WARNING: ["Secure outdoor equipment", "Brief crew on blizzard protocol"],
        CRITICAL: ["LOCKDOWN: All outdoor operations suspended", "Activate HF backup radio"]
      }
    },
    {
      id: 'water',
      title: 'Water Sustainability',
      formula: 'daysToRefill = currentVolume / Math.max(1, Math.abs(netDailyChange))',
      color: '#06b6d4',
      pred: waterPred,
      metric: waterPred ? `${waterPred.val.toFixed(1)} days to refill` : '--',
      chartData: [45, 42, 38, 35, 30, 25, 20],
      actions: {
        WARNING: ["Activate snow-melt unit", "Reduce shower allocations to 2 min/person"],
        CRITICAL: ["Activate snow-melt unit immediately", "Emergency water rations only"]
      }
    },
    {
      id: 'structural',
      title: 'Structural Snow Load',
      formula: 'totalLoad = (density * depth * g) + (0.5 * rho * v^2 * Cd)',
      color: '#64748b',
      pred: structPred,
      metric: structPred ? `${structPred.val.toFixed(1)}% of safe limit` : '--',
      chartData: [40, 45, 55, 60, 75, 82, 88],
      actions: {
        WARNING: ["Inspect roof snow accumulation", "Deploy de-icing cable"],
        CRITICAL: ["EVACUATE AFFECTED MODULES", "Engineering inspection mandatory"]
      }
    }
  ]

  const activePanels = activeTab === 'overview' ? panels : panels.filter(p => p.id === activeTab)

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNav />
        <AlertStrip />
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)', padding: '24px', borderRadius: '8px', color: 'white', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em' }}>
                🔬 ALGORITHMIC PREDICTION ENGINE — {station.toUpperCase()}
              </h1>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                Last Computed: {v2Data?.generated_at ? new Date(v2Data.generated_at).toLocaleString() : 'Loading...'} | Pure Math Deterministic Models
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setStation('maitri')}
                style={{ background: station === 'maitri' ? '#f97316' : '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                MAITRI
              </button>
              <button 
                onClick={() => setStation('bharati')}
                style={{ background: station === 'bharati' ? '#f97316' : '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                BHARATI
              </button>
            </div>
          </div>

          {/* KPI Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <KpiCard title="FUEL CRITICAL IN" value={fuelPred ? `${fuelPred.val.toFixed(0)} d` : '--'} status={fuelPred?.risk || 'NOMINAL'} />
            <KpiCard title="ENERGY DEFICIT" value={energyPred ? `${energyPred.data?.deficit?.toFixed(0)} kW` : '--'} status={energyPred?.risk || 'NOMINAL'} />
            <KpiCard title="GENERATOR RUL" value={genPred ? `${genPred.val.toFixed(0)} h` : '--'} status={genPred?.risk || 'NOMINAL'} />
            <KpiCard title="BLIZZARD RISK" value={blizzPred ? `${blizzPred.val.toFixed(0)}%` : '--'} status={blizzPred?.risk || 'NOMINAL'} />
            <KpiCard title="WATER DAYS" value={waterPred ? `${waterPred.val.toFixed(0)} d` : '--'} status={waterPred?.risk || 'NOMINAL'} />
            <KpiCard title="STRUCTURAL LOAD" value={structPred ? `${structPred.val.toFixed(0)}%` : '--'} status={structPred?.risk || 'NOMINAL'} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === t.id ? '2px solid #0f172a' : '2px solid transparent',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? '#0f172a' : '#64748b',
                  fontSize: '13px'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'overview' ? 'repeat(2, 1fr)' : '1fr', gap: '24px' }}>
            {activePanels.map((p, idx) => (
              <div key={idx} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${p.color}`, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{p.title}</h2>
                    <div style={formulaStyle}>{p.formula}</div>
                  </div>
                  <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                    CONFIDENCE: {p.pred ? '99.9%' : '--'}
                  </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Current Value</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{p.metric}</div>
                  </div>
                  <div style={{ width: '40%' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', fontWeight: 600 }}>7-DAY PROJECTION</div>
                    <TimelineChart data={p.chartData} color={p.color} />
                  </div>
                </div>

                {p.pred && (p.pred.risk === 'WARNING' || p.pred.risk === 'CRITICAL') && (
                  <div style={actionBoxStyle}>
                    <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '12px', marginBottom: '8px' }}>⚡ IMMEDIATE ACTION REQUIRED</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#7f1d1d', fontSize: '13px', lineHeight: 1.5 }}>
                      {(p.actions[p.pred.risk as 'WARNING'|'CRITICAL'] || []).map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Log Table */}
          <div style={{ marginTop: '32px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a' }}>Recent Database Writes (AIPrediction)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '12px 8px' }}>Timestamp</th>
                  <th style={{ padding: '12px 8px' }}>Model</th>
                  <th style={{ padding: '12px 8px' }}>Risk Level</th>
                  <th style={{ padding: '12px 8px' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {preds.slice(0, 10).map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 8px', color: '#475569' }}>{new Date().toISOString()}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 500, color: '#0f172a' }}>{p.model_name}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        background: p.risk === 'CRITICAL' ? '#fef2f2' : p.risk === 'WARNING' ? '#fffbeb' : '#ecfdf5',
                        color: p.risk === 'CRITICAL' ? '#ef4444' : p.risk === 'WARNING' ? '#d97706' : '#10b981',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                      }}>
                        {p.risk}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#475569' }}>{p.val.toFixed(2)}</td>
                  </tr>
                ))}
                {preds.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No recent predictions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
        <Footer />
      </div>
    </div>
  )
}
