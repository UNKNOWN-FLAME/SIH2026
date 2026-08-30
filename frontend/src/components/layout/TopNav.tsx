import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'

export default function TopNav() {
  const { user, logout } = useAuth()
  const { data: dash } = useDashboard()

  return (
    <nav style={{ background: '#122131', borderBottom: '1px solid #45464c' }}
      className="flex justify-between items-center h-14 px-4 w-full shrink-0 z-50">
      <div className="flex items-center gap-3">
        <div style={{ border: '1px solid #45464c', background: '#1c2b3c', width: 32, height: 32 }}
          className="flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#c2c6d8' }}>public</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: '#d4e4fa', lineHeight: 1.2 }}>
          DIGITAL TWIN: ANTARCTIC RESEARCH STATIONS <span style={{ color: '#45464c' }}>|</span> REMOTE MANAGEMENT PLATFORM
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live summary */}
        {dash && (
          <div className="hidden md:flex items-center gap-4 mr-2">
            <span style={{ fontSize: 11, color: '#909096' }}>
              Stations: <span style={{ color: '#d4e4fa', fontWeight: 600 }}>{dash.online_stations}/{dash.total_stations}</span>
            </span>
            {dash.critical_alerts > 0 && (
              <span style={{ fontSize: 11, color: '#ffb4ab', fontWeight: 600 }}>
                {dash.critical_alerts} CRITICAL
              </span>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2"
            style={{ fontSize: 14, color: '#909096' }}>search</span>
          <input
            style={{ background: '#0d1c2d', border: '1px solid #45464c', color: '#d4e4fa', fontSize: 12, fontFamily: 'Inter', padding: '5px 10px 5px 28px', width: 220, outline: 'none' }}
            placeholder="Search parameters..." type="text"
            onFocus={e => (e.target.style.borderColor = '#00a3ad')}
            onBlur={e => (e.target.style.borderColor = '#45464c')}
          />
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          {user && <span style={{ fontSize: 11, color: '#909096' }}>{user.username}</span>}
          <button
            onClick={logout}
            style={{ background: 'transparent', border: 'none', color: '#909096', padding: 6, cursor: 'pointer' }}
            title="Logout"
            onMouseOver={e => ((e.target as HTMLElement).style.color = '#d4e4fa')}
            onMouseOut={e => ((e.target as HTMLElement).style.color = '#909096')}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>account_circle</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
