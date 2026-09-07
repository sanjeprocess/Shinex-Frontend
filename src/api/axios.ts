import axios from 'axios'
import { toast } from 'sonner'
import { canEdit, getCurrentUser } from '../utils/permissions'

const getStoredToken = () => {
  try {
    return (
      localStorage.getItem('hsb_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('jwt') ||
      sessionStorage.getItem('hsb_auth_token') ||
      ''
    )
  } catch {
    return ''
  }
}

const getBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL
  if (url) return url
  return 'http://localhost:8080/api'
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10_000,
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
      toast.error("Can't reach the server. Please check your connection and try again.")
    } else {
      const status: number = error.response.status
      if (status === 409) {
        toast.error('Cannot delete this item as it is linked to other records in the system.')
      } else if (status >= 500) {
        toast.error('Something went wrong on the server. Please try again.')
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
