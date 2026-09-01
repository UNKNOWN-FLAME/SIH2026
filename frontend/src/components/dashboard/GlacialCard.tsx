import { useLanguage } from '../../context/LanguageContext'

export default function GlacialCard() {
  const { t } = useLanguage()

  return (
    <div
      style={{
        gridColumn: 'span 4',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 185,
      }}
    >
      {/* Official Header Strip */}
      <div
        style={{
          background: '#0b3b60',
          borderBottom: '2px solid #ff9933',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ff9933' }}>
            ac_unit
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            {t('glacial.title')}
          </span>
        </div>
        <span style={{ fontSize: 8.5, color: '#ffedd5', background: 'rgba(255, 153, 51, 0.25)', padding: '1px 5px', fontWeight: 700 }}>
          NCPOR-GEO
        </span>
      </div>

      <div
        style={{
          flex: 1,
          position: 'relative',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD7SfAYor_oYUoGMAV897dYFgcLbG-ssgsJqLTrl1wgd5y83w_knhSO0hxUEEe8scL6FkT7ogiP28b6QR4gGPmdJBbqS9vZghUb6GKKlaLuwvZYSqQPohsK3sJliZNl35tYBc7kVtjE-HHYKC_-weiQiWb8UXnz4o-9Yj2rovhi2dnaJAXD8gw5BUiR2i_75xJHtxvLeniAMsgiZ_90Zm8kRPi63b3WNnqddPML9wXmf4VMRTO5eVzPQ"
          alt="Glacial Cross-section"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 6,
            opacity: 0.85,
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            right: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              color: '#0b3b60',
              letterSpacing: '0.04em',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #cbd5e1',
              padding: '2px 6px',
            }}
          >
            {t('glacial.badge')}
          </div>
          <div
            style={{
              fontSize: 8.5,
              color: '#16a34a',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #bbf7d0',
              padding: '2px 6px',
              fontFamily: 'Inter',
              fontWeight: 800,
            }}
          >
            ✓ {t('glacial.verified')}
          </div>
        </div>
      </div>
    </div>
  )
}
