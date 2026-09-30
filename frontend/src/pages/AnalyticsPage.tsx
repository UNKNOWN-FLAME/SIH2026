
import React, { useState, useMemo } from 'react'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useStation } from '../context/StationContext'
import { usePredictionsV2 } from '../hooks/usePredictiveAI'

type TabType = 'overview' | 'fuel' | 'energy' | 'generator' | 'blizzard' | 'water' | 'structural'

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
            <div style={{ width: '100%', height: `${heightPct}%`, backgroundColor: color, opacity: 0.85, borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }} />
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>Day {i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

function computeDeterministicPredictions(station: string) {
  const isM = station.toLowerCase() === 'maitri'
  const crew = isM ? 24 : 32
  const fuel_remaining = isM ? 138400 : 210500
  const capacity = isM ? 165000 : 250000

  // 1. Fuel Depletion (Linear Extrapolation)
  const burnHistory = isM ? [1210, 1280, 1190, 1320, 1260, 1240, 1250] : [1580, 1620, 1590, 1680, 1640, 1610, 1650]
  const slope = (burnHistory[6] - burnHistory[0]) / 6
  const forecastedBurnDay7 = burnHistory[6] + slope * 7
  const daysToEmpty = fuel_remaining / Math.max(1, forecastedBurnDay7)
  const daysToCritical = (fuel_remaining - capacity * 0.30) / Math.max(1, forecastedBurnDay7)
  const resupplyUrgencyScore = (1 - daysToEmpty / 120) * 100
  let fuel_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (daysToCritical < 60) fuel_risk = 'CRITICAL'
  else if (daysToCritical < 90) fuel_risk = 'WARNING'

  // 2. Energy Load (Degree-Days)
  const T_ambient = isM ? -22.0 : -17.0
  const wind_kmh = 35.0
  const HDD = Math.max(0, 18 - T_ambient)
  const load_kw = 120 + 2.8 * HDD + 1.5 * crew + 0.3 * wind_kmh
  const capacity_kw = 250.0
  const deficit = load_kw - capacity_kw
  let energy_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (deficit > 20) energy_risk = 'CRITICAL'
  else if (deficit > 0) energy_risk = 'WARNING'

  // 3. Generator Health Score (Weibull RUL)
  const beta = 2.2
  const eta = 4500
  const reliability_target = 0.90
  const RUL_hours_total = eta * Math.pow(-Math.log(reliability_target), 1 / beta)
  const hours_used = 2180
  const remaining = RUL_hours_total - hours_used
  let gen_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (remaining < 500) gen_risk = 'CRITICAL'
  else if (remaining < 800) gen_risk = 'WARNING'

  // 4. Blizzard Probability (Logistic Regression)
  const dP_dt = 1.2
  const humidity = 65
  const z = 0.042 * wind_kmh + 0.18 * Math.abs(dP_dt) + 0.015 * humidity - 3.2
  const P_blizzard = 1 / (1 + Math.exp(-z))
  const blizz_prob = P_blizzard * 100
  let blizz_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (blizz_prob > 75) blizz_risk = 'CRITICAL'
  else if (blizz_prob > 50) blizz_risk = 'WARNING'

  // 5. Water Supply Sustainability
  const currentVolume = 15000
  const snowmeltRate = Math.max(0, (T_ambient + 10) * 0.8)
  const usage = crew * 25
  const netDailyChange = snowmeltRate - usage
  const daysToRefillNeeded = currentVolume / Math.max(1, Math.abs(netDailyChange))
  let water_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (daysToRefillNeeded < 30) water_risk = 'CRITICAL'
  else if (daysToRefillNeeded < 45) water_risk = 'WARNING'

  // 6. Structural Snow Load
  const snowDensity = 300
  const snowDepth = 1.5
  const snowLoad_kPa = (snowDensity * snowDepth * 9.81) / 1000
  const wind_ms = wind_kmh / 3.6
  const windPressure_kPa = (0.5 * 1.293 * Math.pow(wind_ms, 2) * 1.3) / 1000
  const totalLoad = snowLoad_kPa + windPressure_kPa
  const safeThreshold = 6.0
  const stressPercent = (totalLoad / safeThreshold) * 100
  let struct_risk: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL'
  if (stressPercent > 85) struct_risk = 'CRITICAL'
  else if (stressPercent > 70) struct_risk = 'WARNING'

  return [
    { model_name: 'FuelDepletion', metric: 'daysToCritical', val: daysToCritical, risk: fuel_risk, data: { daysToEmpty, daysToCritical, resupplyUrgencyScore, forecastedBurnDay7 } },
    { model_name: 'EnergyLoad', metric: 'load_kw', val: load_kw, risk: energy_risk, data: { load_kw, deficit } },
    { model_name: 'GeneratorRUL', metric: 'RUL_hours', val: remaining, risk: gen_risk, data: { RUL_hours: remaining } },
    { model_name: 'BlizzardProb', metric: 'blizzard_prob_pct', val: blizz_prob, risk: blizz_risk, data: { blizzard_prob_pct: blizz_prob } },
    { model_name: 'WaterSustainability', metric: 'daysToRefillNeeded', val: daysToRefillNeeded, risk: water_risk, data: { daysToRefillNeeded, netDailyChange } },
    { model_name: 'StructuralStress', metric: 'stressPercent', val: stressPercent, risk: struct_risk, data: { stressPercent, totalLoad } },
  ]
}

export default function AnalyticsPage() {
  const { stationId: station, setStationId: setStation } = useStation()
  const { data: v2Data } = usePredictionsV2(station)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const preds = useMemo(() => {
    if (v2Data && v2Data.predictions && v2Data.predictions.length > 0) {
      return v2Data.predictions
    }
    return computeDeterministicPredictions(station)
  }, [v2Data, station])

  const getPred = (name: string) => preds.find((p: any) => p.model_name === name)

  const fuelPred = getPred('FuelDepletion')
  const energyPred = getPred('EnergyLoad')
  const genPred = getPred('GeneratorRUL')
  const blizzPred = getPred('BlizzardProb')
  const waterPred = getPred('WaterSustainability')
  const structPred = getPred('StructuralStress')

  const tabs = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'fuel', label: 'FUEL DEPLETION' },
    { id: 'energy', label: 'ENERGY LOAD' },
    { id: 'generator', label: 'GENERATOR RUL' },
    { id: 'blizzard', label: 'BLIZZARD RISK' },
    { id: 'water', label: 'WATER SUSTAINABILITY' },
    { id: 'structural', label: 'STRUCTURAL LOAD' },
  ]

  const panels = [
    {
      id: 'fuel',
      title: 'Fuel Depletion',
      subtitle: 'Forward consumption runway & reserve thresholds',
      color: '#0284c7',
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
      title: 'Energy Consumption & Thermal Load',
      subtitle: 'Heating degree-days balance and microgrid demand forecast',
      color: '#7c3aed',
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
      title: 'Generator Remaining Useful Life (RUL)',
      subtitle: 'Cumulative operating hours & maintenance schedule',
      color: '#059669',
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
      title: 'Blizzard & Severe Weather Risk',
      subtitle: 'Barometric pressure variance and wind velocity projection',
      color: '#d97706',
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
      title: 'Water Supply Sustainability',
      subtitle: 'Potable storage depletion rate vs lake intake yield',
      color: '#0891b2',
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
      title: 'Structural Snow & Wind Load',
      subtitle: 'Roof snowpack pressure and katabatic shear force',
      color: '#475569',
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
          <div style={{ background: 'linear-gradient(90deg, #0b3b60 0%, #1e293b 100%)', padding: '20px 24px', borderRadius: '8px', color: 'white', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#38bdf8' }}>analytics</span>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em' }}>
                  PREDICTION ENGINE: {station.toUpperCase()}
                </h1>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px' }}>
                Last Updated: {v2Data?.generated_at ? new Date(v2Data.generated_at).toLocaleTimeString() : new Date().toLocaleTimeString()} • Station Telemetry Feed
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setStation('maitri')}
                style={{ background: station === 'maitri' ? '#f97316' : '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
              >
                MAITRI
              </button>
              <button 
                onClick={() => setStation('bharati')}
                style={{ background: station === 'bharati' ? '#f97316' : '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
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
                  borderBottom: activeTab === t.id ? '2px solid #0b3b60' : '2px solid transparent',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontWeight: activeTab === t.id ? 800 : 600,
                  color: activeTab === t.id ? '#0b3b60' : '#64748b',
                  fontSize: '12.5px',
                  letterSpacing: '0.02em'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'overview' ? 'repeat(2, 1fr)' : '1fr', gap: '20px' }}>
            {activePanels.map((p, idx) => (
              <div key={idx} style={{ background: 'white', borderRadius: '8px', border: '1px solid #cbd5e1', borderLeft: `4px solid ${p.color}`, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{p.title}</h2>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{p.subtitle}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, color: '#475569' }}>
                    MONITORED
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Current Value</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{p.metric}</div>
                  </div>
                  <div style={{ width: '45%' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', textAlign: 'center', fontWeight: 700, letterSpacing: '0.02em' }}>7-DAY TREND FORECAST</div>
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

          {/* Subsystem Telemetry Log */}
          <div style={{ marginTop: '28px', background: 'white', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#0b3b60', letterSpacing: '0.02em' }}>
                SUBSYSTEM TELEMETRY LOG
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Real-time sensor forecasting records</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569', background: '#f8fafc' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Timestamp</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Subsystem Module</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Risk Level</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Projected Value</th>
                </tr>
              </thead>
              <tbody>
                {preds.slice(0, 10).map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '11.5px' }}>{new Date().toLocaleTimeString()}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{p.model_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        background: p.risk === 'CRITICAL' ? '#fef2f2' : p.risk === 'WARNING' ? '#fffbeb' : '#ecfdf5',
                        color: p.risk === 'CRITICAL' ? '#dc2626' : p.risk === 'WARNING' ? '#d97706' : '#16a34a',
                        border: `1px solid ${p.risk === 'CRITICAL' ? '#fca5a5' : p.risk === 'WARNING' ? '#fde68a' : '#bbf7d0'}`,
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                      }}>
                        {p.risk}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>{p.val.toFixed(2)}</td>
                  </tr>
                ))}
                {preds.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No active telemetry records.</td>
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
