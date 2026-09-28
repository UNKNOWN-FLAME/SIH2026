import axios from 'axios'

// Token stored in memory and persisted in localStorage to prevent session drops & reload loops
const TOKEN_KEY = 'vajrax_auth_token'
let _token: string | null = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export function setToken(t: string | null) {
  _token = t
  if (typeof window !== 'undefined') {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }
}

export function getToken(): string | null {
  if (!_token && typeof window !== 'undefined') {
    _token = localStorage.getItem(TOKEN_KEY)
  }
  return _token
}

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const currentToken = getToken()
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`
  }
  return config
})

// On 401 clear token and notify auth context without triggering browser reload
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vajrax_auth_unauthorized'))
      }
    }
    return Promise.reject(err)
  }
)

export default api
