import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Invalid credentials. Check username and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', background: '#051424', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter' }}>
      <div style={{ width: 360 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: '#1c2b3c', border: '1px solid #45464c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#c2c6d8' }}>public</span>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#d8c4a8', textTransform: 'uppercase' }}>MoES NCPOR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#d4e4fa', lineHeight: 1.2 }}>OPERATIONAL COMMAND</div>
            <div style={{ fontSize: 10, color: '#909096' }}>VajraX v3.02 — SIH 2026</div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#0d1c2d', border: '1px solid #45464c', padding: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d4e4fa', letterSpacing: '0.04em', marginBottom: 20 }}>
            HQ DASHBOARD LOGIN
          </div>

          {error && (
            <div style={{ background: 'rgba(147,0,10,0.2)', border: '1px solid rgba(255,180,171,0.4)', padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#ffb4ab' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#909096', display: 'block', marginBottom: 6 }}>
                USERNAME
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                style={{ width: '100%', background: '#122131', border: '1px solid #45464c', color: '#d4e4fa', fontSize: 13, fontFamily: 'Inter', padding: '8px 10px', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#00a3ad')}
                onBlur={e => (e.target.style.borderColor = '#45464c')}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#909096', display: 'block', marginBottom: 6 }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', background: '#122131', border: '1px solid #45464c', color: '#d4e4fa', fontSize: 13, fontFamily: 'Inter', padding: '8px 10px', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#00a3ad')}
                onBlur={e => (e.target.style.borderColor = '#45464c')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: loading ? '#273647' : '#00a3ad', border: 'none',
                color: loading ? '#909096' : '#010f1f', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.07em', padding: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter', textTransform: 'uppercase', transition: 'background 0.15s',
              }}
            >
              {loading ? 'AUTHENTICATING…' : 'LOGIN'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #45464c' }}>
            <div style={{ fontSize: 10, color: '#45464c', letterSpacing: '0.03em' }}>
              Encrypted TLS · Ed25519 Auth · AES-256
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: '#45464c', textAlign: 'center' }}>
          © 2024 MoES – NCPOR | Unauthorised access prohibited
        </div>
      </div>
    </div>
  )
}
