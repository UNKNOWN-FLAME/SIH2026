import { useDashboard } from '../../hooks/useDashboard'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from '../../api/hq'

export default function Footer() {
  const { data: dash } = useDashboard()
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 0,
  })

  const online = !isError && health?.status === 'ok'

  return (
    <footer style={{
      background: '#010f1f', borderTop: '1px solid #45464c',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 16px', height: 30, flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#d4e4fa' }}>
        © 2024 MoES – National Centre for Polar and Ocean Research (NCPOR)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {dash && (
          <>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#909096' }}>
              Open Alerts: <span style={{ color: dash.total_open_alerts > 0 ? '#ffb4ab' : '#00a3ad', fontWeight: 600 }}>{dash.total_open_alerts}</span>
            </span>
          </>
        )}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#909096', fontFamily: 'Inter' }}>Encrypted: AES-256</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderLeft: '1px solid #45464c', paddingLeft: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: online ? '#c2c6d8' : '#909096', fontFamily: 'Inter' }}>
            Cloud: {online ? 'Connected' : 'Unreachable'}
          </span>
          <span className="pulse-dot rounded-full" style={{ width: 6, height: 6, background: online ? '#10b981' : '#ffb4ab', display: 'inline-block' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c2c6d8', fontFamily: 'Inter' }}>SatLink: {online ? 'Stable' : 'Unknown'}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#c2c6d8' }}>satellite_alt</span>
        </div>
      </div>
    </footer>
  )
}
