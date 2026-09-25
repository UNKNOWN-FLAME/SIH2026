import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSensors } from '../hooks/useSensors'

type StationId = 'maitri' | 'bharati'
type TabType = 'fuel' | 'energy' | 'weather' | 'anomaly' | 'maintenance' | 'expedition'

function computeWindChill(tempC: number, windKmh: number): number {
  if (windKmh < 5) return tempC
  return 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16)
}

function KpiCard({ label, value, unit, icon, color, trend, sub }: { label: string; value: string | number; unit?: string; icon: string; color: string; trend?: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '14px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginLeft: 8 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{value}</span>
            {unit && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 3 }}>{unit}</span>}
          </div>
          {sub && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color }}>{icon}</span>
          {trend && <span style={{ fontSize: 10, fontWeight: 700, color: trend.startsWith('▲') ? '#16a34a' : '#dc2626' }}>{trend}</span>}
        </div>
      </div>
    </div>
  )
}

function MiniBarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', height: `${(v / max) * 52}px`, background: color, opacity: i === data.length - 1 ? 1 : 0.5, transition: 'height 0.3s' }} />
          <span style={{ fontSize: 8, color: '#94a3b8' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [activeStation, setActiveStation] = useState<StationId>('maitri')
  const [activeTab, setActiveTab] = useState<TabType>('fuel')
  useAnalytics(activeStation)

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'fuel', label: 'Fuel Burn Model', icon: 'local_gas_station' },
    { id: 'energy', label: 'Energy Forecast', icon: 'bolt' },
    { id: 'weather', label: 'Weather Forecast AI', icon: 'thermostat' },
    { id: 'anomaly', label: 'Anomaly Detection', icon: 'psychology' },
    { id: 'maintenance', label: 'Predictive Maintenance', icon: 'build' },
    { id: 'expedition', label: 'Expedition Planning', icon: 'explore' },
  ]

  const fuel = activeStation === 'maitri'
    ? { remaining: 138400, capacity: 165000, dailyBurn: 1240, resupplyDate: '2027-02-15', daysLeft: 111, trend: '▼ -2.4%' }
    : { remaining: 210500, capacity: 250000, dailyBurn: 1680, resupplyDate: '2027-03-20', daysLeft: 125, trend: '▼ -1.8%' }
  const fuelPct = Math.round((fuel.remaining / fuel.capacity) * 100)
  const burnHistory = [1210, 1280, 1190, 1320, 1260, 1240, fuel.dailyBurn]
  const burnLabels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today']

  const [forecastView, setForecastView] = useState<'7day' | 'hourly'>('7day')
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0)
  const [stormSimActive, setStormSimActive] = useState<boolean>(false)

  const { data: weatherSensors } = useSensors(activeStation, 'weather')

  const isM = activeStation === 'maitri'
  const liveTemp = weatherSensors?.find(s => s.sensor_id.includes('temperature'))?.latest_value ?? (isM ? -15.5 : -12.1)
  const liveWind = weatherSensors?.find(s => s.sensor_id.includes('wind_speed'))?.latest_value ?? (isM ? 26.0 : 19.0)

  const stormMultiplier = stormSimActive ? 1.32 : 1.0

  const forecast7Day = useMemo(() => {
    const today = new Date()
    const daysMeta = [
      { name: 'Today', offset: 0, dT: 0, dW: 0, icon: liveWind * stormMultiplier > 55 ? 'storm' : 'ac_unit', desc: liveWind * stormMultiplier > 55 ? 'Blizzard Surge' : 'Polar Snow Flurry', p: 75, solar: 280, pres: 986, synoptic: 'High-latitude polar air mass over Queen Maud Land. Local katabatic gradient active off the polar plateau.' },
      { name: 'Tomorrow', offset: 1, dT: -2.8, dW: 16, icon: 'storm', desc: 'Katabatic Surge', p: 90, solar: 180, pres: 978, synoptic: 'Severe cyclonic trough migrating from Weddell Sea. Sharp pressure drop with katabatic gusts peaking near 65 km/h.' },
      { name: 'D+2', offset: 2, dT: -1.2, dW: -6, icon: 'partly_cloudy_day', desc: 'Cold Clearing', p: 35, solar: 390, pres: 994, synoptic: 'Post-frontal cold sector stabilization. Cloud cover dissipating with high UV index and excellent visibility.' },
      { name: 'D+3', offset: 3, dT: +2.1, dW: -18, icon: 'sunny', desc: 'Optimal Polar Sun', p: 10, solar: 440, pres: 1002, synoptic: 'Antarctic high ridge dominating inland coast. Calm winds, zero drift, ideal window for heavy scientific fieldwork.' },
      { name: 'D+4', offset: 4, dT: +0.8, dW: +4, icon: 'cloud', desc: 'Ice Fog / Stratus', p: 40, solar: 290, pres: 991, synoptic: 'Moist maritime air advection into Schirmacher Oasis. Stratocumulus layer lowering to 800 ft AGL with ice fog.' },
      { name: 'D+5', offset: 5, dT: -4.2, dW: +24, icon: 'cyclone', desc: 'Polar Low Storm', p: 95, solar: 110, pres: 969, synoptic: 'Deep mesocyclone tracking eastward along Antarctic perimeter. Extreme blizzard hazard and severe rotor turbulence.' },
      { name: 'D+6', offset: 6, dT: -1.8, dW: -8, icon: 'ac_unit', desc: 'Drifting Snow', p: 55, solar: 320, pres: 985, synoptic: 'Residual snow drift settling. Wind speeds moderating back to seasonal baselines.' },
    ]

    return daysMeta.map((d) => {
      const targetDate = new Date(today.getTime() + d.offset * 24 * 60 * 60 * 1000)
      const dateStr = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const weekdayShort = targetDate.toLocaleDateString('en-US', { weekday: 'short' })
      const weekdayLong = targetDate.toLocaleDateString('en-US', { weekday: 'long' })
      const computedName = d.offset === 0
        ? `Today (${weekdayShort})`
        : d.offset === 1
        ? `Tomorrow (${weekdayShort})`
        : weekdayLong

      const dayTemp = Number((liveTemp + d.dT - (stormSimActive ? 2.5 : 0)).toFixed(1))
      const dayWind = Number((Math.max(12, (liveWind + d.dW) * stormMultiplier)).toFixed(1))
      const dayGust = Number((dayWind * 1.33).toFixed(1))
      const dayChill = Number(computeWindChill(dayTemp, dayWind).toFixed(1))
      const daySnowP = Math.min(100, Math.round(d.p * (stormSimActive ? 1.2 : 1.0)))
      const daySnowAccum = Number(((daySnowP / 100) * 4.2).toFixed(1))

      // Mission safety statuses
      let safetyStatus: 'ALL CLEAR' | 'CAUTION' | 'STORM WARNING' = 'ALL CLEAR'
      let heliStatus: 'APPROVED' | 'STANDBY' | 'NO-GO' = 'APPROVED'
      let traverseStatus: 'OPTIMAL' | 'CAUTION' | 'SUSPENDED' = 'OPTIMAL'

      if (dayGust >= 60 || daySnowP >= 80) {
        safetyStatus = 'STORM WARNING'
        heliStatus = 'NO-GO'
        traverseStatus = 'SUSPENDED'
      } else if (dayGust >= 40 || daySnowP >= 50) {
        safetyStatus = 'CAUTION'
        heliStatus = 'STANDBY'
        traverseStatus = 'CAUTION'
      }

      const phases = [
        { label: 'Night (00-06 UTC)', temp: (dayTemp - 1.8).toFixed(1), wind: Math.round(dayWind * 0.9), cond: 'Clear Sky / Chill' },
        { label: 'Morning (06-12 UTC)', temp: (dayTemp + 0.4).toFixed(1), wind: Math.round(dayWind * 1.05), cond: 'Katabatic Onset' },
        { label: 'Polar Noon (12-18 UTC)', temp: (dayTemp + 2.0).toFixed(1), wind: Math.round(dayWind * 1.15), cond: 'Peak Solar / Gust' },
        { label: 'Evening (18-24 UTC)', temp: (dayTemp - 0.5).toFixed(1), wind: Math.round(dayWind * 0.95), cond: 'Radiative Inversion' },
      ]

      return {
        ...d,
        name: computedName,
        weekday: weekdayLong,
        dateStr,
        temp: dayTemp,
        minTemp: Number((dayTemp - 3.4).toFixed(1)),
        maxTemp: Number((dayTemp + 2.6).toFixed(1)),
        wind: dayWind,
        gust: dayGust,
        chill: dayChill,
        snowProb: daySnowP,
        snowAccum: daySnowAccum,
        solarYield: Math.round((d.solar / 450) * 42),
        safetyStatus,
        heliStatus,
        traverseStatus,
        phases,
      }
    })
  }, [liveTemp, liveWind, stormMultiplier, stormSimActive])

  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const hour = i
      const tSine = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 3.2
      const wSine = Math.cos(((hour - 4) / 24) * 2 * Math.PI) * 12
      const sSine = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * 420
      const hTemp = Number((liveTemp + tSine - (stormSimActive ? 2.5 : 0)).toFixed(1))
      const hWind = Math.max(14, Number(((liveWind + wSine) * stormMultiplier).toFixed(1)))
      const hGust = Number((hWind * 1.32).toFixed(1))
      const hChill = Number(computeWindChill(hTemp, hWind).toFixed(1))
      const hSnow = Math.round(Math.max(10, Math.min(95, 45 + Math.sin(hour / 3) * 35)))
      const hSolar = Math.round(sSine)
      const hPres = Number((988 - Math.sin(hour / 4) * 6).toFixed(1))

      return {
        hourIdx: hour,
        hour: `${String(hour).padStart(2, '0')}:00`,
        temp: hTemp,
        wind: hWind,
        gust: hGust,
        chill: hChill,
        snowProb: hSnow,
        solar: hSolar,
        pressure: hPres,
      }
    })
  }, [liveTemp, liveWind, stormMultiplier, stormSimActive])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation(s => s === 'maitri' ? 'bharati' : 'maitri')} />
        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Home</button>
                <span>›</span><span style={{ color: '#ea580c', fontWeight: 800 }}>Predictive Analytics</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700, background: '#f5f3ff', padding: '2px 8px', border: '1px solid #ddd6fe' }}>🤖 AI ENGINE ACTIVE</span>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #0b3b60 0%, #1a5276 100%)', color: '#fff', padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>🤖 PREDICTIVE ANALYTICS — {activeStation === 'maitri' ? 'MAITRI' : 'BHARATI'} AI ENGINE v2.1</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Edge AI • LSTM Burn Models • Anomaly Detection • Maintenance Forecasting • Mission Planning</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['maitri', 'bharati'] as const).map(s => (
                  <button key={s} onClick={() => setActiveStation(s)} style={{ background: activeStation === s ? '#ff9933' : 'rgba(255,255,255,0.1)', border: activeStation === s ? '2px solid #ff9933' : '2px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 12px', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>{s.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', marginBottom: 12, background: '#fff', padding: '0 8px' }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === tab.id ? 800 : 600, color: activeTab === tab.id ? '#0b3b60' : '#64748b', fontSize: 11, borderBottom: activeTab === tab.id ? '2px solid #0b3b60' : '2px solid transparent', marginBottom: -2 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'fuel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <KpiCard label="FUEL REMAINING" value={fuel.remaining.toLocaleString()} unit="L" icon="local_gas_station" color="#ea580c" sub={`${fuelPct}% of ${(fuel.capacity / 1000).toFixed(0)}kL capacity`} />
                  <KpiCard label="DAILY BURN RATE" value={fuel.dailyBurn.toLocaleString()} unit="L/day" icon="whatshot" color="#dc2626" trend={fuel.trend} sub="7-day rolling average" />
                  <KpiCard label="DAYS OF AUTONOMY" value={fuel.daysLeft} unit="days" icon="calendar_month" color="#0b3b60" sub="Until empty at current burn" />
                  <KpiCard label="NEXT RESUPPLY" value={fuel.resupplyDate} icon="local_shipping" color="#16a34a" sub="Scheduled supply voyage" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>FUEL TANK LEVEL — VISUAL GAUGE</div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ width: 60, height: 120, border: '2px solid #cbd5e1', position: 'relative', background: '#f8fafc', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${fuelPct}%`, background: fuelPct > 50 ? '#16a34a' : fuelPct > 25 ? '#d97706' : '#dc2626', transition: 'height 0.5s', opacity: 0.8 }} />
                        <div style={{ position: 'absolute', bottom: '25%', width: '100%', borderTop: '1px dashed #dc2626', opacity: 0.5 }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{fuelPct}%</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0b3b60', marginBottom: 8 }}>AI BURN RATE PREDICTION — LSTM MODEL</div>
                        <div style={{ fontSize: 10, lineHeight: 1.6, color: '#475569' }}>
                          Based on current weather conditions (temp: {activeStation === 'maitri' ? '-28.4' : '-21.7'}°C), crew occupancy ({activeStation === 'maitri' ? 24 : 32}), and generator load, the LSTM model predicts:
                        </div>
                        <div style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {[{ label: 'Next 7 days', val: `${fuel.dailyBurn} \u00b1 45 L/day`, icon: 'trending_flat' },{ label: 'Next 30 days', val: `${Math.round(fuel.dailyBurn * 1.04)} \u00b1 80 L/day`, icon: 'trending_up' },{ label: 'Winter Peak (Jul-Aug)', val: `${Math.round(fuel.dailyBurn * 1.18)} \u00b1 120 L/day`, icon: 'trending_up' }].map(p => (
                            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ea580c' }}>{p.icon}</span>
                              <span style={{ color: '#64748b' }}>{p.label}:</span>
                              <span style={{ fontWeight: 800, color: '#0f172a' }}>{p.val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '6px 10px', fontSize: 10, color: '#92400e', fontWeight: 700 }}>
                          ⚠ Model confidence: 91.4% • Last trained: 2026-09-01 02:00 UTC
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>DAILY FUEL BURN — LAST 7 DAYS (Litres)</div>
                    <MiniBarChart data={burnHistory} labels={burnLabels} color="#ea580c" />
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 10 }}>
                      <div style={{ background: '#fef3c7', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#d97706', fontSize: 13 }}>{Math.max(...burnHistory).toLocaleString()}</div>
                        <div style={{ color: '#64748b' }}>Peak (7d)</div>
                      </div>
                      <div style={{ background: '#f0fdf4', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#16a34a', fontSize: 13 }}>{Math.min(...burnHistory).toLocaleString()}</div>
                        <div style={{ color: '#64748b' }}>Min (7d)</div>
                      </div>
                      <div style={{ background: '#f0f9ff', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#0b3b60', fontSize: 13 }}>{Math.round(burnHistory.reduce((a, b) => a + b) / burnHistory.length).toLocaleString()}</div>
                        <div style={{ color: '#64748b' }}>Avg (7d)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'energy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <KpiCard label="CURRENT LOAD" value={activeStation === 'maitri' ? 164 : 218} unit="kW" icon="bolt" color="#f59e0b" sub="Real-time station demand" />
                  <KpiCard label="SOLAR GENERATION" value={activeStation === 'maitri' ? '18.5' : '34.0'} unit="kW" icon="wb_sunny" color="#16a34a" trend="▲ +12%" />
                  <KpiCard label="WIND GENERATION" value={activeStation === 'maitri' ? '24.2' : '16.8'} unit="kW" icon="air" color="#3b82f6" trend="▲ +8%" />
                  <KpiCard label="BATTERY SoC" value={activeStation === 'maitri' ? 91 : 96} unit="%" icon="battery_charging_full" color="#16a34a" sub="LiFePO4 bank" />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>48-HOUR ENERGY BALANCE FORECAST — MICROGRID AI MODEL</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const load = 150 + Math.sin(i * 0.8) * 30 + 20
                      const solar = i >= 2 && i <= 6 ? 15 + Math.sin((i - 2) * 0.7) * 18 : 0
                      const wind = 20 + Math.sin(i * 0.5) * 8
                      const gen = Math.max(0, load - solar - wind)
                      return (
                        <div key={i} style={{ textAlign: 'center', border: '1px solid #e2e8f0', padding: '8px 4px', background: '#fafafa' }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>+{i * 6}h</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#0b3b60' }}>{Math.round(load)}kW</div>
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ height: 4, background: '#16a34a', width: `${solar / load * 100}%` }} title={`Solar: ${Math.round(solar)}kW`} />
                            <div style={{ height: 4, background: '#3b82f6', width: `${wind / load * 100}%` }} title={`Wind: ${Math.round(wind)}kW`} />
                            <div style={{ height: 4, background: '#ea580c', width: `${gen / load * 100}%` }} title={`Generator: ${Math.round(gen)}kW`} />
                          </div>
                          <div style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>G:{Math.round(gen)}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10 }}>
                    <span><span style={{ background: '#16a34a', display: 'inline-block', width: 12, height: 8, marginRight: 4 }} />Solar</span>
                    <span><span style={{ background: '#3b82f6', display: 'inline-block', width: 12, height: 8, marginRight: 4 }} />Wind</span>
                    <span><span style={{ background: '#ea580c', display: 'inline-block', width: 12, height: 8, marginRight: 4 }} />Generator (Diesel)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'weather' && (() => {
              const activeDay = forecast7Day[selectedDayIdx] ?? forecast7Day[0]

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Top KPI Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <KpiCard
                      label="AI PREDICTIVE ENSEMBLE"
                      value="WRF 4.1 + NCMRWF"
                      icon="model_training"
                      color="#0b3b60"
                      sub="168-Hour Multi-Model Consensus (06 UTC)"
                    />
                    <KpiCard
                      label={`${activeDay.name.toUpperCase()} PEAK GUST`}
                      value={`${Math.round(activeDay.gust)} km/h`}
                      unit=""
                      icon="air"
                      color={activeDay.gust >= 60 ? '#dc2626' : activeDay.gust >= 45 ? '#ea580c' : '#0284c7'}
                      trend={activeDay.gust >= 60 ? '▲ Katabatic Warning' : '▲ Nominal Range'}
                      sub="Direction: 140° SSE • Max at 17:00 UTC"
                    />
                    <KpiCard
                      label="POLAR MISSION STATUS"
                      value={activeDay.safetyStatus}
                      icon={activeDay.safetyStatus === 'ALL CLEAR' ? 'verified' : activeDay.safetyStatus === 'CAUTION' ? 'warning' : 'block'}
                      color={activeDay.safetyStatus === 'ALL CLEAR' ? '#16a34a' : activeDay.safetyStatus === 'CAUTION' ? '#d97706' : '#dc2626'}
                      sub={`Blizzard Risk: ${activeDay.snowProb}% • Heli: ${activeDay.heliStatus}`}
                    />
                    <KpiCard
                      label="RENEWABLE MICROGRID OFFSET"
                      value={`+${activeDay.solarYield + Math.round(activeDay.wind * 0.7)} kW`}
                      icon="bolt"
                      color="#3b82f6"
                      trend="▲ Eco Dispatch"
                      sub={`Solar: ${activeDay.solarYield}kW • Wind: ${Math.round(activeDay.wind * 0.7)}kW`}
                    />
                  </div>

                  {/* Synoptic Forecast Header & Mode Switcher */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284c7' }}>
                          calendar_month
                        </span>
                        {forecastView === '7day' ? '7-DAY SYNOPTIC POLAR FORECAST (CLICK ANY DAY TO INSPECT)' : '24-HOUR HOURLY MICRO-FORECAST'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9.5, color: '#64748b' }}>
                          Anchored to Live Sensors ({liveTemp}°C, {liveWind} km/h)
                        </span>

                        {/* View Switcher: 7-Day vs 24-Hr */}
                        <div style={{ display: 'flex', border: '1.5px solid #0b3b60', borderRadius: 2, overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => setForecastView('7day')}
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '3px 9px',
                              background: forecastView === '7day' ? '#0b3b60' : '#ffffff',
                              color: forecastView === '7day' ? '#ffffff' : '#0b3b60',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            7-Day
                          </button>
                          <button
                            type="button"
                            onClick={() => setForecastView('hourly')}
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '3px 9px',
                              background: forecastView === 'hourly' ? '#0b3b60' : '#ffffff',
                              color: forecastView === 'hourly' ? '#ffffff' : '#0b3b60',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            24-Hr
                          </button>
                        </div>

                        {/* Storm Simulation Stress-Test Button */}
                        <button
                          type="button"
                          onClick={() => setStormSimActive(s => !s)}
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: stormSimActive ? '#fee2e2' : '#f8fafc',
                            color: stormSimActive ? '#b91c1c' : '#475569',
                            border: `1.5px solid ${stormSimActive ? '#f87171' : '#cbd5e1'}`,
                            cursor: 'pointer',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Simulate +30% Polar Storm Surge across all predictive neural models"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: stormSimActive ? '#b91c1c' : '#64748b' }}>
                            {stormSimActive ? 'cyclone' : 'tune'}
                          </span>
                          {stormSimActive ? '⚠️ Blizzard Surge Active (+30%)' : 'Simulate Storm (+30%)'}
                        </button>
                      </div>
                    </div>

                    {forecastView === '7day' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
                        {forecast7Day.map((d, idx) => {
                          const isSelected = selectedDayIdx === idx
                          return (
                            <div
                              key={d.name}
                              onClick={() => setSelectedDayIdx(idx)}
                              style={{
                                background: isSelected ? 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)' : '#ffffff',
                                border: isSelected ? '2.5px solid #0b3b60' : '1px solid #cbd5e1',
                                padding: '14px 12px',
                                minHeight: 250,
                                cursor: 'pointer',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 4,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isSelected
                                  ? '0 8px 20px rgba(11, 59, 96, 0.16)'
                                  : '0 1px 4px rgba(0,0,0,0.05)',
                                transform: isSelected ? 'translateY(-2px)' : 'none',
                              }}
                            >
                              {/* Top MoES Navy Accent for Selected Card */}
                              {isSelected && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 4,
                                    background: '#0b3b60',
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2,
                                  }}
                                />
                              )}

                              {/* Card Header: Day Name & Date Pill */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 900, color: isSelected ? '#0b3b60' : '#0f172a' }}>
                                  {d.name}
                                </div>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    color: isSelected ? '#0369a1' : '#64748b',
                                    background: isSelected ? '#e0f2fe' : '#f1f5f9',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 10,
                                  }}
                                >
                                  {d.dateStr}
                                </span>
                              </div>

                              {/* Weather Icon & Phenomenon Label */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', margin: '6px 0 8px 0' }}>
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: 32,
                                    color: d.icon === 'sunny'
                                      ? '#f59e0b'
                                      : d.icon === 'storm' || d.icon === 'cyclone'
                                      ? '#ea580c'
                                      : '#0284c7',
                                  }}
                                >
                                  {d.icon}
                                </span>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: '#334155',
                                    marginTop: 3,
                                    lineHeight: 1.2,
                                    minHeight: 25,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {d.desc}
                                </div>
                              </div>

                              {/* Hero Temperature & Range */}
                              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                  {d.temp.toFixed(1)}°<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>C</span>
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, display: 'flex', justifyContent: 'center', gap: 6 }}>
                                  <span>L: <strong style={{ color: '#0284c7' }}>{d.minTemp.toFixed(0)}°</strong></span>
                                  <span>•</span>
                                  <span>H: <strong style={{ color: '#ea580c' }}>{d.maxTemp.toFixed(0)}°</strong></span>
                                </div>
                              </div>

                              {/* Metric Chips (Wind & Snow) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                                <div
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 3,
                                    padding: '4px 6px',
                                    fontSize: 9.5,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span style={{ color: '#475569' }}>💨 {Math.round(d.wind)} km/h</span>
                                  <span style={{ color: d.gust >= 55 ? '#dc2626' : '#ea580c', fontWeight: 800 }}>
                                    ⚡ {Math.round(d.gust)}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 3,
                                    padding: '4px 6px',
                                    fontSize: 9.5,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#475569' }}>❄️ Snow Risk</span>
                                    <span style={{ color: d.snowProb > 70 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                                      {d.snowProb}%
                                    </span>
                                  </div>
                                  <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${d.snowProb}%`,
                                        background: d.snowProb > 70 ? '#dc2626' : d.snowProb > 40 ? '#f59e0b' : '#10b981',
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Operational Status Pill */}
                              <div style={{ marginTop: 'auto' }}>
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '4px 6px',
                                    borderRadius: 3,
                                    textAlign: 'center',
                                    background: d.safetyStatus === 'ALL CLEAR' ? '#dcfce7' : d.safetyStatus === 'CAUTION' ? '#fef3c7' : '#fee2e2',
                                    color: d.safetyStatus === 'ALL CLEAR' ? '#15803d' : d.safetyStatus === 'CAUTION' ? '#92400e' : '#b91c1c',
                                    border: `1px solid ${d.safetyStatus === 'ALL CLEAR' ? '#86efac' : d.safetyStatus === 'CAUTION' ? '#fde047' : '#fca5a5'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                    {d.safetyStatus === 'ALL CLEAR' ? 'check_circle' : d.safetyStatus === 'CAUTION' ? 'warning' : 'block'}
                                  </span>
                                  {d.safetyStatus === 'ALL CLEAR' ? 'ALL CLEAR' : d.safetyStatus === 'CAUTION' ? 'CAUTION' : 'LOCKDOWN'}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, maxHeight: 280, overflowY: 'auto', padding: 2 }}>
                        {hourlyData.map((h, idx) => (
                          <div
                            key={h.hour}
                            style={{
                              background: idx === 0 ? '#f0f9ff' : '#ffffff',
                              border: `1px solid ${idx === 0 ? '#bae6fd' : '#cbd5e1'}`,
                              borderRadius: 4,
                              padding: '10px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 900, color: '#0b3b60' }}>{h.hour} UTC</span>
                              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{h.temp}°C</span>
                            </div>
                            <div style={{ fontSize: 9.5, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                              <span>💨 Wind: {h.wind} km/h</span>
                              <span style={{ color: '#ea580c', fontWeight: 800 }}>⚡ {h.gust}</span>
                            </div>
                            <div style={{ fontSize: 9.5, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Chill: <strong>{h.chill}°C</strong></span>
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>❄️ {h.snowProb}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Photo-Rich Minimal AI Future Hazards & Problem Predictor (Linked to Selected Day) */}
                  {(() => {
                    const d = forecast7Day[selectedDayIdx] ?? forecast7Day[0]

                    // Dynamic hazard profile customized to the selected day's exact numerical forecast
                    const dayThreat = (() => {
                      if (selectedDayIdx === 0) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: d.safetyStatus,
                          risk: Math.min(95, Math.round(55 * stormMultiplier)),
                          severityColor: d.safetyStatus === 'STORM WARNING' ? '#dc2626' : '#ea580c',
                          image: '/threats/turbine.jpg',
                          title: 'Active Katabatic Drift & Wind Chill Inversion',
                          tags: [`🌡️ ${d.temp}°C Temp`, `💨 ${Math.round(d.gust)} km/h Gust`, `🥶 ${Math.round(d.chill)}°C Chill`, `❄️ ${d.snowProb}% Drift`],
                          problems: [
                            'Rapid temperature inversion; severe frostbite hazard on outside crew transit beyond 15 mins.',
                            'Blowing drift snow beginning to cover exterior electrical junction boxes.',
                          ],
                          actions: [
                            'Level-2 thermal PPE mandatory for all outside station personnel.',
                            'Keep emergency heated PistenBully vehicle on warm-idle standby.',
                          ],
                          heli: d.heliStatus,
                          traverse: d.traverseStatus,
                        }
                      } else if (selectedDayIdx === 1) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'STORM WARNING',
                          risk: Math.min(98, Math.round(94 * stormMultiplier)),
                          severityColor: '#dc2626',
                          image: '/threats/blizzard.jpg',
                          title: 'Severe Whiteout Blizzard & Katabatic Gale Surge',
                          tags: [`📉 ${d.pres} hPa (Drop)`, `💨 ${Math.round(d.gust)} km/h Peak Gust`, `🥶 ${Math.round(d.chill)}°C Chill`, '❄️ <5m Visibility'],
                          problems: [
                            'Zero outdoor visibility (<5m). High disorientation hazard outside living modules.',
                            'Wind turbine rotor overspeed trip risk (185 RPM) & Ku-band VSAT tracking drift.',
                          ],
                          actions: [
                            'Level-3 Station Lockdown: exterior transit restricted to fixed lifeline guide ropes.',
                            'Auto-feather turbine blades; park satellite dish to 90° survival stow.',
                          ],
                          heli: 'NO-GO',
                          traverse: 'SUSPENDED',
                        }
                      } else if (selectedDayIdx === 2) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'CAUTION',
                          risk: 38,
                          severityColor: '#0284c7',
                          image: '/threats/turbine.jpg',
                          title: 'Post-Frontal Freeze & Apron Black Ice',
                          tags: [`📈 ${d.pres} hPa (Rising)`, `💨 ${Math.round(d.wind)} km/h Wind`, `🥶 ${Math.round(d.chill)}°C Chill`, '☀️ High UV Glare'],
                          problems: [
                            'Flash-freeze creates invisible black ice across helipad apron and metal gangways.',
                            'High UV reflection off fresh snow sheet causing temporary snow blindness.',
                          ],
                          actions: [
                            'Apply coarse grit/salt on station gangways and helipad perimeter.',
                            'Category-4 polar sunglasses mandatory for all outside technical crews.',
                          ],
                          heli: 'STANDBY',
                          traverse: 'CAUTION',
                        }
                      } else if (selectedDayIdx === 3) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'ALL CLEAR',
                          risk: 12,
                          severityColor: '#16a34a',
                          image: '/threats/traverse.jpg',
                          title: 'Optimal Weather Window (Calm High-Pressure Ridge)',
                          tags: [`☀️ ${d.solar} W/m² Solar`, `💨 ${Math.round(d.wind)} km/h Gentle`, `🌡️ ${d.temp}°C Mild`, '🛡️ Minimal Hazard'],
                          problems: [
                            'No critical atmospheric hazards detected. Atmospheric stability at weekly peak.',
                            'Minor solar glare on exterior telemetry optical lenses.',
                          ],
                          actions: [
                            'Green flag: Ideal window for heavy logistics, fuel bunkering, and scientific field trips.',
                            'Perform preventive maintenance on exterior wind turbines and solar PV arrays.',
                          ],
                          heli: 'APPROVED',
                          traverse: 'OPTIMAL',
                        }
                      } else if (selectedDayIdx === 4) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'CAUTION',
                          risk: 74,
                          severityColor: '#ea580c',
                          image: '/threats/traverse.jpg',
                          title: 'Tropospheric Ice Fog & Flat Light Crevasse Risk',
                          tags: [`🌫️ 800ft Ceiling`, `🕳️ Crevasse Risk`, `💨 ${Math.round(d.wind)} km/h`, '📡 VSAT Loss +4.8dB'],
                          problems: [
                            'Flat light eliminates surface shadows; concealed 30m-deep crevasse snow bridges invisible.',
                            'Moist maritime air induces rime icing on radar domes and Ku-band communications.',
                          ],
                          actions: [
                            'Suspend overland PistenBully traverse beyond 3 km station safety perimeter.',
                            'Turn on radome quartz heating de-icers 2 hours in advance of satellite sync pass.',
                          ],
                          heli: 'STANDBY',
                          traverse: 'SUSPENDED',
                        }
                      } else if (selectedDayIdx === 5) {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'STORM WARNING',
                          risk: 96,
                          severityColor: '#dc2626',
                          image: '/threats/blizzard.jpg',
                          title: 'Deep Mesocyclone Low & Diesel Fuel Line Gelling',
                          tags: [`📉 969 hPa Deep Low`, `💨 ${Math.round(d.gust)} km/h Gust`, `🥶 -42°C Skin Chill`, '❄️ 95% Snow Blizzard'],
                          problems: [
                            'HSD fuel lines wax crystallization approaching pour point (-24°C); generator starvation risk.',
                            'Violent blizzard winds cause heavy structural windward vibration and snow drift packing.',
                          ],
                          actions: [
                            'Engage 100% duty cycle electric heat-tracing on exterior fuel pipelines FP-1 & FP-2.',
                            'Switch station microgrid to dual-generator load sharing; lockdown all non-essential doors.',
                          ],
                          heli: 'NO-GO',
                          traverse: 'SUSPENDED',
                        }
                      } else {
                        return {
                          label: `${d.name} (${d.dateStr})`,
                          statusText: 'CAUTION',
                          risk: 48,
                          severityColor: '#0284c7',
                          image: '/threats/traverse.jpg',
                          title: 'Post-Storm Snow Drift Silt & Intake Obstruction',
                          tags: [`❄️ Heavy Drift Snow`, `💨 ${Math.round(d.wind)} km/h Moderating`, `🌡️ ${d.temp}°C`, '🚜 Snow Clearing'],
                          problems: [
                            'Massive 2-meter snow drifts accumulating against generator air intake louvers.',
                            'Containerized storage doors and emergency egress hatches blocked by wind-packed snow.',
                          ],
                          actions: [
                            'Deploy PistenBully snow blade crew for prioritized clearance of life-support air intakes.',
                            'Inspect structural stay wires and communications masts for storm wind drift looseness.',
                          ],
                          heli: 'STANDBY',
                          traverse: 'CAUTION',
                        }
                      }
                    })()

                    return (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '14px 16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        {/* Header with Selected Day Indicator */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18, color: dayThreat.severityColor }}>
                                warning
                              </span>
                              AI FUTURE THREAT & OPERATIONAL PROBLEM PREDICTOR
                            </div>
                            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1 }}>
                              Target Day Analysis: <strong style={{ color: '#0b3b60' }}>{dayThreat.label}</strong> — <span style={{ color: '#475569' }}>{d.desc}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0b3b60', background: '#f0f9ff', padding: '3px 9px', borderRadius: 3, border: '1px solid #bae6fd' }}>
                              📍 DAY {selectedDayIdx + 1} OF 7 SELECTED (Click any day card above to switch)
                            </span>
                          </div>
                        </div>

                        {/* Focused 2-Column Card for Selected Day */}
                        <div
                          style={{
                            background: '#ffffff',
                            border: `1.5px solid ${dayThreat.severityColor}40`,
                            borderRadius: 6,
                            overflow: 'hidden',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                            display: 'grid',
                            gridTemplateColumns: '380px 1fr',
                            gap: 0,
                          }}
                        >
                          {/* Left Column: Photo Banner */}
                          <div style={{ position: 'relative', minHeight: 180, background: '#0f172a', overflow: 'hidden' }}>
                            <img
                              src={dayThreat.image}
                              alt={dayThreat.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                filter: 'brightness(0.92)',
                              }}
                            />
                            {/* Vignette Gradient */}
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.9) 100%)',
                              }}
                            />
                            {/* Floating Badges */}
                            <div style={{ position: 'absolute', top: 9, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: 3,
                                  background: 'rgba(15, 23, 42, 0.85)',
                                  color: '#f8fafc',
                                  backdropFilter: 'blur(4px)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                }}
                              >
                                📅 {dayThreat.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 900,
                                  padding: '2px 8px',
                                  borderRadius: 3,
                                  background: dayThreat.severityColor,
                                  color: '#ffffff',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                  letterSpacing: '0.03em',
                                }}
                              >
                                {dayThreat.risk}% RISK • {dayThreat.statusText}
                              </span>
                            </div>

                            {/* Bottom Title on Image */}
                            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                                {dayThreat.title}
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Minimal Problems, Actions & Clearance */}
                          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between' }}>
                            {/* Row 1: Trigger Badges */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {dayThreat.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    background: '#f8fafc',
                                    color: '#334155',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 3,
                                  }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>

                            {/* Row 2: Predicted Problems */}
                            <div
                              style={{
                                background: '#fff7ed',
                                border: '1px solid #ffedd5',
                                borderRadius: 4,
                                padding: '7px 10px',
                                fontSize: 10,
                                color: '#9a3412',
                                lineHeight: 1.4,
                              }}
                            >
                              <div style={{ fontWeight: 900, color: '#c2410c', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>⚠️ Predicted Operational Problems:</span>
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayThreat.problems.map((p, idx) => (
                                  <li key={idx}>{p}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Row 3: Action Protocol */}
                            <div
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #dcfce7',
                                borderRadius: 4,
                                padding: '7px 10px',
                                fontSize: 10,
                                color: '#166534',
                                lineHeight: 1.4,
                              }}
                            >
                              <div style={{ fontWeight: 900, color: '#15803d', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>🛡️ Mandatory Station Protocol:</span>
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayThreat.actions.map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Row 4: Mission Clearance Badges */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 2 }}>
                              <div style={{ fontSize: 9.5, color: '#64748b' }}>
                                Helipad Air Sortie: <strong style={{ color: dayThreat.heli === 'NO-GO' ? '#dc2626' : dayThreat.heli === 'STANDBY' ? '#d97706' : '#16a34a' }}>{dayThreat.heli}</strong>
                              </div>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <div style={{ fontSize: 9.5, color: '#64748b' }}>
                                Overland Traverse: <strong style={{ color: dayThreat.traverse === 'SUSPENDED' ? '#dc2626' : dayThreat.traverse === 'CAUTION' ? '#d97706' : '#16a34a' }}>{dayThreat.traverse}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            {activeTab === 'anomaly' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <KpiCard label="ANOMALIES TODAY" value="2" icon="psychology" color="#d97706" sub="1 resolved, 1 monitoring" />
                  <KpiCard label="MODEL ACCURACY" value="97.3" unit="%" icon="verified" color="#16a34a" sub="30-day validation set" />
                  <KpiCard label="FALSE POSITIVE RATE" value="0.8" unit="%" icon="check_circle" color="#16a34a" sub="Last 30 days" />
                  <KpiCard label="SENSORS MONITORED" value={activeStation === 'maitri' ? 84 : 136} icon="sensors" color="#0b3b60" sub="Real-time ML inference" />
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>ANOMALY DETECTION LOG — ISOLATION FOREST + LSTM AUTOENCODER</div>
                  {[{ id: 'ANM-2026-0847', time: '14:12 IST', sensor: 'Generator DG-2 Vibration (Z-axis)', value: '14.2 mm/s', baseline: '8.1 mm/s', deviation: '+75%', severity: 'HIGH', status: 'MONITORING', model: 'Isolation Forest' },{ id: 'ANM-2026-0846', time: '11:34 IST', sensor: 'Met Tower Wind Load Cell', value: '218 N', baseline: '145 N', deviation: '+50%', severity: 'MEDIUM', status: 'MONITORING', model: 'Statistical 3σ' },{ id: 'ANM-2026-0845', time: '08:21 IST', sensor: 'Fuel Line Pressure Sensor FP-3', value: '2.8 bar', baseline: '3.2 ± 0.15 bar', deviation: '-12.5%', severity: 'LOW', status: 'RESOLVED', model: 'LSTM' },{ id: 'ANM-2026-0844', time: 'Yesterday', sensor: 'Battery Bank Temp Cell-14', value: '48.2°C', baseline: '35 ± 5°C', deviation: '+21%', severity: 'MEDIUM', status: 'RESOLVED', model: 'Threshold' }].map(a => (
                    <div key={a.id} style={{ border: `1px solid ${a.status === 'MONITORING' ? '#fde68a' : '#e2e8f0'}`, padding: '12px', marginBottom: 8, background: a.status === 'MONITORING' ? '#fffbeb' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#0b3b60', fontSize: 11 }}>{a.id}</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{a.time}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: a.severity === 'HIGH' ? '#dc2626' : a.severity === 'MEDIUM' ? '#d97706' : '#16a34a', background: a.severity === 'HIGH' ? '#fef2f2' : a.severity === 'MEDIUM' ? '#fef3c7' : '#f0fdf4', padding: '1px 6px', border: `1px solid ${a.severity === 'HIGH' ? '#fecaca' : a.severity === 'MEDIUM' ? '#fde68a' : '#bbf7d0'}` }}>{a.severity}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: a.status === 'MONITORING' ? '#d97706' : '#16a34a', background: a.status === 'MONITORING' ? '#fef3c7' : '#f0fdf4', padding: '1px 6px', border: `1px solid ${a.status === 'MONITORING' ? '#fde68a' : '#bbf7d0'}` }}>{a.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{a.sensor}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#64748b' }}>
                        <span>Detected: <strong style={{ color: a.severity === 'HIGH' ? '#dc2626' : '#d97706' }}>{a.value}</strong></span>
                        <span>Baseline: <strong>{a.baseline}</strong></span>
                        <span>Deviation: <strong style={{ color: '#dc2626' }}>{a.deviation}</strong></span>
                        <span>Model: <strong style={{ color: '#7c3aed' }}>{a.model}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <KpiCard label="UPCOMING (7 DAYS)" value="3" icon="build" color="#d97706" sub="Scheduled maintenance" />
                  <KpiCard label="OVERDUE" value="0" icon="check_circle" color="#16a34a" sub="All current" />
                  <KpiCard label="AI RECOMMENDATIONS" value="5" icon="psychology" color="#7c3aed" sub="Predictive items" />
                  <KpiCard label="MTBF — DG-1" value="4,280" unit="hrs" icon="timer" color="#3b82f6" sub="Mean time between failures" />
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>PREDICTIVE MAINTENANCE SCHEDULE — AI RECOMMENDATIONS</div>
                  {[{ id: 'PM-2026-114', asset: 'Generator DG-2', task: 'Vibration bearing inspection & lubrication', due: '2026-09-05', urgency: 'HIGH', trigger: 'Vibration anomaly ANM-0847 detected — bearing wear predicted', confidence: 91 },{ id: 'PM-2026-113', asset: 'VSAT Dish Actuator', task: 'Motor brushes replacement', due: '2026-09-10', urgency: 'MEDIUM', trigger: 'MTBF threshold: 2,100 hrs operational (recommended: 2,000)', confidence: 78 },{ id: 'PM-2026-112', asset: 'Fuel Transfer Pump FP-1', task: 'Seal kit replacement', due: '2026-09-14', urgency: 'MEDIUM', trigger: 'Periodic: 1,500 hr service interval', confidence: 85 },{ id: 'PM-2026-111', asset: 'Battery Bank — Cells 1-20', task: 'Capacity test & cell balancing', due: '2026-09-20', urgency: 'LOW', trigger: 'Quarterly capacity verification', confidence: 95 },{ id: 'PM-2026-110', asset: 'Wind Turbine WT-1', task: 'Blade inspection & pitch calibration', due: '2026-09-28', urgency: 'LOW', trigger: 'Annual inspection schedule', confidence: 99 }].map(m => (
                    <div key={m.id} style={{ border: `1px solid ${m.urgency === 'HIGH' ? '#fecaca' : m.urgency === 'MEDIUM' ? '#fde68a' : '#e2e8f0'}`, padding: '12px', marginBottom: 8, background: m.urgency === 'HIGH' ? '#fef2f2' : m.urgency === 'MEDIUM' ? '#fffbeb' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#0b3b60', fontSize: 10 }}>{m.id}</span>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 11 }}>{m.asset}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: m.urgency === 'HIGH' ? '#dc2626' : m.urgency === 'MEDIUM' ? '#d97706' : '#16a34a', background: 'rgba(255,255,255,0.7)', padding: '1px 6px', border: '1px solid currentColor' }}>{m.urgency}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>Due: {m.due}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 600, marginBottom: 4 }}>{m.task}</div>
                      <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#7c3aed' }}>psychology</span>
                        {m.trigger}
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#7c3aed' }}>AI Confidence: {m.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'expedition' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <KpiCard label="CURRENT EXPEDITION" value="45th ISEA" icon="explore" color="#0b3b60" sub="Indian Scientific Expedition" />
                  <KpiCard label="CREW STRENGTH" value={activeStation === 'maitri' ? 24 : 32} unit="personnel" icon="group" color="#3b82f6" sub="All life-support nominal" />
                  <KpiCard label="MISSION DAYS LEFT" value="112" icon="calendar_month" color="#16a34a" sub="Winter campaign ends Feb 2027" />
                  <KpiCard label="CARGO CONSUMED" value="68" unit="%" icon="inventory" color="#ea580c" sub="Of expedition supplies" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>EXPEDITION TIMELINE — 45TH ISEA</div>
                    {[{ phase: 'Pre-expedition Briefing', date: '2026-10-15', status: 'UPCOMING', color: '#64748b' },{ phase: 'Departure from Goa (MV Nuyina)', date: '2026-11-01', status: 'UPCOMING', color: '#64748b' },{ phase: 'Arrival at Bharati', date: '2026-12-15', status: 'PLANNED', color: '#3b82f6' },{ phase: 'Station Handover — Bharati', date: '2026-12-18', status: 'PLANNED', color: '#3b82f6' },{ phase: 'Arrival at Maitri', date: '2026-12-28', status: 'PLANNED', color: '#3b82f6' },{ phase: 'Return Departure', date: '2027-03-01', status: 'PLANNED', color: '#3b82f6' },{ phase: 'Arrival at Goa', date: '2027-04-10', status: 'PLANNED', color: '#3b82f6' }].map(e => (
                      <div key={e.phase} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, background: e.color, borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{e.phase}</span>
                        </div>
                        <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{e.date}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: e.color, background: '#f8fafc', padding: '1px 5px', border: '1px solid #e2e8f0' }}>{e.status}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: '0.05em' }}>RESOURCE ADEQUACY FORECAST — AI MISSION PLANNER</div>
                    {[{ resource: 'Diesel Fuel (HSD)', current: `${(activeStation === 'maitri' ? 138400 : 210500).toLocaleString()} L`, adequacy: activeStation === 'maitri' ? 111 : 125, needed: 90, status: 'ADEQUATE' },{ resource: 'Aviation Fuel (ATF)', current: '28,400 L', adequacy: 95, needed: 60, status: 'ADEQUATE' },{ resource: 'LPG (Cooking)', current: '142 cylinders', adequacy: 180, needed: 90, status: 'SURPLUS' },{ resource: 'Medical Supplies', current: '100%', adequacy: 365, needed: 90, status: 'ADEQUATE' },{ resource: 'Emergency Rations', current: '72 person-days', adequacy: 72, needed: 30, status: 'ADEQUATE' }].map(r => (
                      <div key={r.resource} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{r.resource}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: r.status === 'SURPLUS' ? '#0b3b60' : '#16a34a', background: r.status === 'SURPLUS' ? '#f0f9ff' : '#f0fdf4', padding: '1px 6px', border: `1px solid ${r.status === 'SURPLUS' ? '#bae6fd' : '#bbf7d0'}` }}>{r.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748b', marginBottom: 4 }}>
                          <span>Current: <strong>{r.current}</strong></span>
                          <span>Covers: <strong style={{ color: '#16a34a' }}>{r.adequacy} days</strong></span>
                          <span>Required: <strong>{r.needed} days</strong></span>
                        </div>
                        <div style={{ height: 4, background: '#e2e8f0' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, (r.needed / r.adequacy) * 100)}%`, background: '#16a34a' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
