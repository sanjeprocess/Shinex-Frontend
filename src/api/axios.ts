import axios from 'axios'
import { toast } from 'sonner'

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
  try {
    const meta = import.meta as any
    if (meta && meta.env && meta.env.VITE_API_URL) {
      return meta.env.VITE_API_URL
    }
    // Local development mode (npm run dev)
    if (meta && meta.env && meta.env.DEV) {
      return 'http://localhost:8080/api'
    }
  } catch {}
  // Hosted Production default (AWS Amplify / AWS Elastic Beanstalk)
  return 'http://shinex-hris-backend-env.eba-tdpzseqt.eu-north-1.elasticbeanstalk.com/api'
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
      if (status >= 500) {
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
