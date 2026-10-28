import axios from 'axios'
import { toast } from 'sonner'
import { canEdit, getCurrentUser } from '../utils/permissions'

const getStoredToken = () => {
  try {
    return localStorage.getItem('hsb_auth_token') || ''
  } catch {
    return ''
  }
}

const getBaseUrl = () => {
  // In production (Amplify): use relative /api path so Amplify proxy rewrites
  // handle forwarding to the backend. This avoids Mixed Content (HTTPS→HTTP) errors.
  // In local dev: VITE_API_URL is set via .env, or falls back to localhost proxy.
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (import.meta.env.DEV) return '/api'
  return '/api'  // Production: relative path → Amplify proxy forwards to backend
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
})

// ── Request: attach auth token ────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  const isWrite = ['post', 'put', 'patch', 'delete'].includes(method)
  const isAuthRequest = String(config.url || '').startsWith('/auth/')
  if (isWrite && !isAuthRequest && !canEdit()) {
    toast.error(getCurrentUser().accessLevel === 'READ_ONLY' ? 'Your account is read-only.' : 'Your account does not have permission to edit.')
    return Promise.reject(new Error('Insufficient permissions'))
  }
  const token = getStoredToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response: global error safety net ────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Can't reach the server. Check your network connection and backend availability, then try again.", {
        id: 'network-error'
      })
    } else {
      const status: number = error.response.status
      const isAuthEndpoint = String(error.config?.url || '').includes('/auth/')
      if (status === 401 && !isAuthEndpoint && window.location.pathname !== '/login') {
        const isWrite = ['post', 'put', 'patch', 'delete'].includes((error.config?.method || '').toLowerCase())
        if (isWrite) {
          toast.error('Session expired or unauthorized for this save operation. Your staged records have been saved locally.', {
            id: 'auth-error',
            duration: 8000
          })
          return Promise.reject(error)
        }
        localStorage.removeItem('hsb_auth_token')
        toast.error('Your session has expired. Please sign in again.', {
          id: 'auth-error'
        })
        window.location.href = '/login'
        return Promise.reject(error)
      }
      if (status === 401) {
        toast.error(isAuthEndpoint ? 'Invalid username or password.' : 'Authentication is required.', {
          id: 'auth-error'
        })
      } else if (status === 403) {
        toast.error('Access denied. Your account does not have permission to perform this action.', {
          id: 'forbidden-error'
        })
      } else if (status === 409) {
        const isDelete = (error.config?.method || '').toLowerCase() === 'delete';
        const data = error.response.data;
        const backendMessage =
          (typeof data === 'string' && data.trim()) ||
          data?.message ||
          data?.error ||
          null;
        toast.error(
          backendMessage
            ? String(backendMessage)
            : (isDelete ? 'Cannot delete this item as it is linked to other records in the system.' : 'Record conflict occurred — please check your data.'),
          { id: 'conflict-error' }
        )
      } else if (status >= 500) {
        toast.error('Something went wrong on the server. Please try again.', {
          id: 'server-error'
        })
      } else if (status >= 400) {
        const data = error.response.data
        const backendMessage =
          (typeof data === 'string' && data.trim()) ||
          data?.message ||
          data?.error ||
          null
        toast.error(
          backendMessage
            ? String(backendMessage)
            : 'Request failed — please check your input.'
        )
      }
    }
    return Promise.reject(error)
  }
)

export default api
