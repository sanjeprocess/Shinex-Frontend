import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:8080/api' : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Simple JWT interceptor placeholder; adapt to secure storage strategy
api.interceptors.request.use((config) => {
  // attach token from memory store or call a getAuthToken helper
  // const token = auth.getToken();
  const token = undefined
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
