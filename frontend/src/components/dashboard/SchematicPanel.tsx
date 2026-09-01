import { useLanguage } from '../../context/LanguageContext'

interface Props {
  stationId: string
}

const SCHEMATICS: Record<string, { labelKey: string; img: string; ver: string }> = {
  maitri: {
    labelKey: 'schematic.maitri_title',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQdw0cLzhj6KGCnwSKVB9nxgKVInnMh24ReDgQEYAX4fWkSlthBixJiQwez-S-Mgf0CBbG5ujn8H8D9I5V-nILWW_yv5CbU3cnzQW7aeOHAxiD-kaYMYRKCyz7iVNF8iPALYVj_cNOBBVLrKnzta8EjnXrgwVXJfifxVzjS_YeCYj5gL8_7ymzpFNvTSyrxlvXZ4v98qZeLDYdHNhcZrMoebB3m4-REretyEeTvFMflW4AfF-7cZNVFg',
    ver: 'ARCH-REF: MTR-2026-V2.4',
  },
  bharati: {
    labelKey: 'schematic.bharati_title',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQdw0cLzhj6KGCnwSKVB9nxgKVInnMh24ReDgQEYAX4fWkSlthBixJiQwez-S-Mgf0CBbG5ujn8H8D9I5V-nILWW_yv5CbU3cnzQW7aeOHAxiD-kaYMYRKCyz7iVNF8iPALYVj_cNOBBVLrKnzta8EjnXrgwVXJfifxVzjS_YeCYj5gL8_7ymzpFNvTSyrxlvXZ4v98qZeLDYdHNhcZrMoebB3m4-REretyEeTvFMflW4AfF-7cZNVFg',
    ver: 'ARCH-REF: BHR-2026-V1.8',
  },
}

export default function SchematicPanel({ stationId }: Props) {
  const { t } = useLanguage()
  const sch = SCHEMATICS[stationId] ?? SCHEMATICS.maitri

  return (
    <div
      style={{
        gridColumn: 'span 8',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 390,
      }}
    >
      {/* Official Blueprint Header Badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.96)',
          borderLeft: '4px solid #0b3b60',
          borderTop: '1px solid #cbd5e1',
          borderRight: '1px solid #cbd5e1',
          borderBottom: '1px solid #cbd5e1',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)',
          padding: '6px 14px',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0b3b60', letterSpacing: '0.02em' }}>
          {t(sch.labelKey)}
        </div>
        <div style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
          {sch.ver} <span style={{ color: '#ea580c' }}>•</span> NIC / MOES TWIN
        </div>
      </div>

      {/* Security Watermark Stamp */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.94)',
          border: '1px solid #cbd5e1',
          padding: '4px 10px',
          fontSize: 9,
          fontWeight: 800,
          color: '#0b3b60',
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ color: '#ea580c' }}>●</span> {t('schematic.confidential')}
      </div>

      {/* Control buttons */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 4 }}>
        {['zoom_in', 'fullscreen'].map((icon) => (
          <button
            key={icon}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              color: '#334155',
              padding: 5,
              cursor: 'pointer',
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.background = '#f1f5f9')}
            onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.background = '#ffffff')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
          </button>
        ))}
      </div>

      {/* Schematic Image Canvas */}
      <div style={{ flex: 1, position: 'relative', background: '#0a192f', overflow: 'hidden' }}>
        <img
          src={sch.img}
          alt={`${stationId} schematic`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.88,
            mixBlendMode: 'screen',
            transition: 'opacity 0.3s',
          }}
        />

        {/* Overlay: External Sensors */}
        <div
          className="schematic-overlay"
          style={{
            top: '20%',
            left: '20%',
            background: 'rgba(255, 255, 255, 0.95)',
            borderLeft: '3px solid #0284c7',
            borderTop: '1px solid #cbd5e1',
            borderRight: '1px solid #cbd5e1',
            borderBottom: '1px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: '#0284c7', marginBottom: 2 }}>
            {t('schematic.ext_sensors')}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'Inter' }}>
            {t('schematic.temp')}: {stationId === 'maitri' ? '-18.4°C' : '-12.1°C'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', fontFamily: 'Inter' }}>
            {t('schematic.humidity')}: {stationId === 'maitri' ? '80%' : '65%'}
          </div>
        </div>

        {/* Overlay: Generator Substation */}
        <div
          className="schematic-overlay schematic-overlay-active"
          style={{
            bottom: '24%',
            right: '22%',
            background: 'rgba(255, 255, 255, 0.95)',
            borderLeft: '3px solid #ea580c',
            borderTop: '1px solid #cbd5e1',
            borderRight: '1px solid #cbd5e1',
            borderBottom: '1px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span
              className="pulse-dot rounded-full"
              style={{ width: 6, height: 6, background: '#ea580c', display: 'inline-block' }}
            />
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: '#ea580c' }}>
              {t('schematic.gen_sub')}
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', fontFamily: 'Inter' }}>
            {t('schematic.status_active')}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', fontFamily: 'Inter' }}>
            {t('schematic.load')}: {stationId === 'maitri' ? '84.0%' : '71.0%'}
          </div>
        </div>
      </div>
    </div>
  )
}
