interface Props {
  stationId: string
}

const SCHEMATICS: Record<string, { label: string; img: string }> = {
  maitri: {
    label: 'MAITRI SCHEMATIC V2.4',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQdw0cLzhj6KGCnwSKVB9nxgKVInnMh24ReDgQEYAX4fWkSlthBixJiQwez-S-Mgf0CBbG5ujn8H8D9I5V-nILWW_yv5CbU3cnzQW7aeOHAxiD-kaYMYRKCyz7iVNF8iPALYVj_cNOBBVLrKnzta8EjnXrgwVXJfifxVzjS_YeCYj5gL8_7ymzpFNvTSyrxlvXZ4v98qZeLDYdHNhcZrMoebB3m4-REretyEeTvFMflW4AfF-7cZNVFg',
  },
  bharati: {
    label: 'BHARATI SCHEMATIC V1.8',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQdw0cLzhj6KGCnwSKVB9nxgKVInnMh24ReDgQEYAX4fWkSlthBixJiQwez-S-Mgf0CBbG5ujn8H8D9I5V-nILWW_yv5CbU3cnzQW7aeOHAxiD-kaYMYRKCyz7iVNF8iPALYVj_cNOBBVLrKnzta8EjnXrgwVXJfifxVzjS_YeCYj5gL8_7ymzpFNvTSyrxlvXZ4v98qZeLDYdHNhcZrMoebB3m4-REretyEeTvFMflW4AfF-7cZNVFg',
  },
}

export default function SchematicPanel({ stationId }: Props) {
  const sch = SCHEMATICS[stationId] ?? SCHEMATICS.maitri

  return (
    <div style={{
      gridColumn: 'span 8', background: '#1c2b3c', border: '1px solid #45464c',
      position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      minHeight: 380,
    }}>
      {/* Header badge */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        background: 'rgba(18,33,49,0.88)', backdropFilter: 'blur(8px)',
        border: '1px solid #45464c', padding: '4px 12px',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#d4e4fa', letterSpacing: '0.05em' }}>
          {sch.label}
        </span>
      </div>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 4 }}>
        {['zoom_in', 'fullscreen'].map(icon => (
          <button key={icon} style={{
            background: 'rgba(18,33,49,0.88)', backdropFilter: 'blur(8px)',
            border: '1px solid #45464c', color: '#909096', padding: 5, cursor: 'pointer',
          }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = '#d4e4fa')}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = '#909096')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
          </button>
        ))}
      </div>

      {/* Image */}
      <div style={{ flex: 1, position: 'relative', background: '#080f1a', overflow: 'hidden' }}>
        <img
          src={sch.img}
          alt={`${stationId} schematic`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82, mixBlendMode: 'screen', transition: 'opacity 0.3s' }}
        />

        {/* Overlay: External Sensors */}
        <div className="schematic-overlay" style={{ top: '22%', left: '22%' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: '#d8c4a8', marginBottom: 3 }}>EXTERNAL SENSORS</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4e4fa', fontFamily: 'Inter' }}>Temp: {stationId === 'maitri' ? '-18°C' : '-12°C'}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4e4fa', fontFamily: 'Inter' }}>Humidity: {stationId === 'maitri' ? '80%' : '65%'}</div>
        </div>

        {/* Overlay: Generator Substation */}
        <div className="schematic-overlay schematic-overlay-active" style={{ bottom: '28%', right: '26%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span className="pulse-dot rounded-full" style={{ width: 6, height: 6, background: '#c2c6d8', display: 'inline-block' }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: '#c2c6d8' }}>GENERATOR SUBSTATION</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4e4fa', fontFamily: 'Inter' }}>Status: Active</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4e4fa', fontFamily: 'Inter' }}>
            Load: {stationId === 'maitri' ? '84%' : '71%'}
          </div>
        </div>
      </div>
    </div>
  )
}
