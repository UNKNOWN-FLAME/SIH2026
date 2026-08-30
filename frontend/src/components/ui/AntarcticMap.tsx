interface Props {
  maitriOnline: boolean
  bharatiOnline: boolean
  activeStation: string
}

export default function AntarcticMap({ maitriOnline, bharatiOnline, activeStation }: Props) {
  return (
    <div style={{ border: '1px solid #45464c', overflow: 'hidden', position: 'relative', background: '#010f1f' }}>
      <svg viewBox="0 0 200 130" style={{ width: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="130" fill="#010f1f" />
        <ellipse cx="100" cy="72" rx="70" ry="52" fill="#1c2b3c" stroke="#45464c" strokeWidth="1" />
        <ellipse cx="82" cy="58" rx="42" ry="30" fill="#273647" stroke="#45464c" strokeWidth="0.5" />
        <path d="M30 72 Q50 90 70 85 Q90 95 110 88 Q130 93 150 78 Q165 70 165 72 Q160 95 100 110 Q50 108 30 88 Z" fill="#1c2b3c" stroke="#45464c" strokeWidth="0.5" />
        {/* Maitri */}
        <circle cx="85" cy="68" r="3.5" fill={maitriOnline ? '#10b981' : '#909096'}
          opacity={activeStation === 'maitri' ? 1 : 0.6} />
        <text x="89" y="65" fill={activeStation === 'maitri' ? '#d4e4fa' : '#909096'} fontSize="8" fontFamily="Inter" fontWeight="600">Maitri</text>
        {/* Bharati */}
        <circle cx="118" cy="82" r="3.5" fill={bharatiOnline ? '#10b981' : '#909096'}
          opacity={activeStation === 'bharati' ? 1 : 0.6} />
        <text x="122" y="86" fill={activeStation === 'bharati' ? '#d4e4fa' : '#909096'} fontSize="8" fontFamily="Inter">Bharati</text>
        <text x="95" y="45" fill="#45464c" fontSize="7" fontFamily="Inter">SOUTH POLE</text>
        <circle cx="100" cy="40" r="2" fill="none" stroke="#45464c" strokeWidth="1" />
        <circle cx="100" cy="72" r="40" fill="none" stroke="#273647" strokeWidth="0.5" strokeDasharray="3,4" />
        <circle cx="100" cy="72" r="60" fill="none" stroke="#273647" strokeWidth="0.5" strokeDasharray="3,4" />
      </svg>
    </div>
  )
}
