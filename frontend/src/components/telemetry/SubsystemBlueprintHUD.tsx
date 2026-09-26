interface Props {
  stationId: 'maitri' | 'bharati'
  isBlackBox: boolean
  powerKw: number
  fuelPressureBar: number
  coolantTempC: number
  habitatTempC: number
}

export default function SubsystemBlueprintHUD({
  stationId,
  isBlackBox,
  powerKw,
  fuelPressureBar,
  coolantTempC,
  habitatTempC,
}: Props) {
  const stationLabel = stationId === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station'

  return (
    <div
      style={{
        background: isBlackBox
          ? 'linear-gradient(180deg, #1f0a0a 0%, #0c0404 100%)'
          : 'linear-gradient(180deg, #09192f 0%, #06101e 100%)',
        border: isBlackBox ? '2px solid #ef4444' : '1px solid #1e3a5f',
        padding: '12px 14px',
        marginBottom: 12,
        borderRadius: 3,
        boxShadow: isBlackBox
          ? '0 0 25px rgba(239, 68, 68, 0.35), inset 0 0 15px rgba(239, 68, 68, 0.15)'
          : '0 2px 8px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Cyber Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isBlackBox
            ? 'linear-gradient(rgba(239, 68, 68, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}
      />

      {/* Emergency Siren Ribbon during Black Box Mode */}
      {isBlackBox && (
        <div
          style={{
            background: 'repeating-linear-gradient(45deg, #b91c1c, #b91c1c 12px, #7f1d1d 12px, #7f1d1d 24px)',
            color: '#ffffff',
            padding: '5px 12px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: '0.06em',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'ping 1s infinite' }}>
              fmd_bad
            </span>
            <span>🚨 BLACK-BOX EMERGENCY REPLAY: CRITICAL SUBSYSTEM FAILURE LOCKED</span>
          </div>
          <span style={{ background: '#000000', padding: '2px 8px', borderRadius: 2, fontSize: 9.5 }}>
            UNCOMPRESSED 1Hz TELEMETRY BUFFER
          </span>
        </div>
      )}

      {/* Top HUD Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isBlackBox ? '#ef4444' : '#00f0ff',
              boxShadow: isBlackBox ? '0 0 10px #ef4444' : '0 0 8px #00f0ff',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 900, color: isBlackBox ? '#fca5a5' : '#7dd3fc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {stationLabel} — SUBSYSTEM BLUEPRINT HUD
          </span>
        </div>

        <div style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'monospace' }}>
          SCADA BUS: <span style={{ color: isBlackBox ? '#ef4444' : '#38bdf8', fontWeight: 800 }}>{isBlackBox ? 'FAULT PROPAGATING' : 'SYNCHRONIZED'}</span>
        </div>
      </div>

      {/* 5 Subsystem Nodes Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Node 1: DG-1 Generator Station */}
        <div
          style={{
            background: isBlackBox && powerKw < 30 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 39, 68, 0.6)',
            border: isBlackBox && powerKw < 30 ? '2px solid #ef4444' : '1px solid #1e3a5f',
            padding: '8px 10px',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>NODE 01</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isBlackBox && powerKw < 30 ? '#ef4444' : '#38bdf8' }}>
              bolt
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            DG-1 Power Gen
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: isBlackBox && powerKw < 30 ? '#f87171' : '#38bdf8', marginTop: 2 }}>
            {powerKw} kW
          </div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: isBlackBox && powerKw < 30 ? '#fca5a5' : '#86efac',
              marginTop: 2,
            }}
          >
            {isBlackBox && powerKw < 30 ? '💥 STALL / TRIP' : '● NOMINAL 84kW'}
          </div>
        </div>

        {/* Node 2: Cryo Fuel Line B */}
        <div
          style={{
            background: isBlackBox && fuelPressureBar < 1.0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 39, 68, 0.6)',
            border: isBlackBox && fuelPressureBar < 1.0 ? '2px solid #ef4444' : '1px solid #1e3a5f',
            padding: '8px 10px',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>NODE 02</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isBlackBox && fuelPressureBar < 1.0 ? '#00f0ff' : '#ea580c' }}>
              local_gas_station
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            Fuel Tracing Line
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: isBlackBox && fuelPressureBar < 1.0 ? '#38bdf8' : '#fb923c', marginTop: 2 }}>
            {fuelPressureBar} Bar
          </div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: isBlackBox && fuelPressureBar < 1.0 ? '#7dd3fc' : '#86efac',
              marginTop: 2,
            }}
          >
            {isBlackBox && fuelPressureBar < 1.0 ? '❄️ WAX FREEZE PLUG' : '● TRACING HEATED'}
          </div>
        </div>

        {/* Node 3: HVAC Thermal Loop */}
        <div
          style={{
            background: isBlackBox && coolantTempC > 95 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 39, 68, 0.6)',
            border: isBlackBox && coolantTempC > 95 ? '2px solid #ef4444' : '1px solid #1e3a5f',
            padding: '8px 10px',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>NODE 03</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isBlackBox && coolantTempC > 95 ? '#ef4444' : '#10b981' }}>
              heat_pump
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            Coolant CHP Exch
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: isBlackBox && coolantTempC > 95 ? '#f87171' : '#34d399', marginTop: 2 }}>
            +{coolantTempC}°C
          </div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: isBlackBox && coolantTempC > 95 ? '#fca5a5' : '#86efac',
              marginTop: 2,
            }}
          >
            {isBlackBox && coolantTempC > 95 ? '🔥 OVERHEAT SPIKE' : '● GLYCOL RECIRC.'}
          </div>
        </div>

        {/* Node 4: Habitat Living Quarters */}
        <div
          style={{
            background: isBlackBox && habitatTempC < 18 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 39, 68, 0.6)',
            border: isBlackBox && habitatTempC < 18 ? '2px solid #ef4444' : '1px solid #1e3a5f',
            padding: '8px 10px',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>NODE 04</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isBlackBox && habitatTempC < 18 ? '#ef4444' : '#c084fc' }}>
              roofing
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            Living Quarters
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: isBlackBox && habitatTempC < 18 ? '#f87171' : '#e879f9', marginTop: 2 }}>
            +{habitatTempC}°C
          </div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: isBlackBox && habitatTempC < 18 ? '#fca5a5' : '#86efac',
              marginTop: 2,
            }}
          >
            {isBlackBox && habitatTempC < 18 ? '⚠️ HYPOTHERMIA RISK' : '● WARM (+21°C)'}
          </div>
        </div>

        {/* Node 5: VSAT Satellite Radome */}
        <div
          style={{
            background: 'rgba(15, 39, 68, 0.6)',
            border: '1px solid #1e3a5f',
            padding: '8px 10px',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>NODE 05</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#38bdf8' }}>
              satellite_alt
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            ISRO GSAT-30
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
            584 ms
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: '#86efac', marginTop: 2 }}>
            ● LINK SYNCED
          </div>
        </div>
      </div>
    </div>
  )
}
