export default function GlacialCard() {
  return (
    <div style={{ gridColumn: 'span 4', background: '#1c2b3c', border: '1px solid #45464c', padding: '10px 12px', display: 'flex', flexDirection: 'column', minHeight: 180 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#909096', paddingBottom: 6, borderBottom: '1px solid #45464c', marginBottom: 8 }}>
        GLACIAL SUB-STRUCTURE
      </div>
      <div style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,70,76,0.4)', overflow: 'hidden' }}>
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD7SfAYor_oYUoGMAV897dYFgcLbG-ssgsJqLTrl1wgd5y83w_knhSO0hxUEEe8scL6FkT7ogiP28b6QR4gGPmdJBbqS9vZghUb6GKKlaLuwvZYSqQPohsK3sJliZNl35tYBc7kVtjE-HHYKC_-weiQiWb8UXnz4o-9Yj2rovhi2dnaJAXD8gw5BUiR2i_75xJHtxvLeniAMsgiZ_90Zm8kRPi63b3WNnqddPML9wXmf4VMRTO5eVzPQ"
          alt="Glacial Cross-section"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6, filter: 'invert(1)', opacity: 0.75, mixBlendMode: 'screen' }}
        />
        <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#c2c6d8', letterSpacing: '0.05em', background: 'rgba(10,18,30,0.7)', padding: '2px 5px' }}>
            ANTARCTIC ICE SHELF MONITORING
          </div>
          <div style={{ fontSize: 8, color: '#909096', background: 'rgba(10,18,30,0.7)', padding: '2px 5px', fontFamily: 'Inter' }}>
            CROSS-SECTION
          </div>
        </div>
      </div>
    </div>
  )
}
