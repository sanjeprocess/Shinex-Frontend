import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { list as listBC } from '../mocks/businessCenters'
import api from '../api/axios'
import { toast } from 'sonner'

export default function Login() {
  const navigate = useNavigate()
  const [bcList, setBcList] = useState<Array<any>>([])
  const [selectedBc, setSelectedBc] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    listBC()
      .then(list => {
        setBcList(list)
        if (list.length > 0) {
          setSelectedBc(list[0]?.code || '')
        }
      })
      .catch(() => {})
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const form = new FormData(e.currentTarget as HTMLFormElement)
    const loginName = String(form.get('username') || '').trim()
    const enteredPassword = password
    if (!loginName || !enteredPassword) {
      toast.error('Username and password are required')
      return
    }
    setSubmitting(true)
    setErrorMessage('')
    try {
      const businessCode = selectedBc ? selectedBc.split(' / ')[0].trim() : ''
      const response = await api.post('/auth/login', {
        loginName,
        password: enteredPassword,
        clientBusinessCode: businessCode || undefined
      })

      localStorage.setItem('hsb_auth_token', response.data.token)
      localStorage.setItem('hsb_test_user', response.data.loginName || loginName)
      localStorage.setItem('hsb_user_profile', JSON.stringify({
        fullName: response.data.fullName || response.data.loginName || loginName,
        nicNumber: response.data.nicNumber || '',
        role: response.data.role || 'ADMIN',
        businessCenterName: response.data.clientBusinessCode || selectedBc || 'All Business Centers'
      }))
      localStorage.setItem('hsb_user_role', response.data.role || 'ADMIN')
      localStorage.setItem('hsb_user_permissions', JSON.stringify({
        isBlocked: response.data.blocked === true,
        canViewSite: response.data.canViewSite !== false,
        accessLevel: response.data.accessLevel || 'READ_WRITE',
        canManageUsers: response.data.canManageUsers === true
      }))

      if (response.data.clientBusinessCode) {
        localStorage.setItem('hsb_active_bc', response.data.clientBusinessCode)
      } else if (selectedBc) {
        localStorage.setItem('hsb_active_bc', selectedBc)
      } else {
        localStorage.setItem('hsb_active_bc', 'ALL')
      }

      toast.success(`Welcome back, ${response.data.loginName || loginName}!`)
      navigate('/')
    } catch (error: any) {
      const message = 'Invalid username or password. Please try again.'
      setErrorMessage(message)
      setPassword('')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#12161C]">
      <div className="w-full max-w-2xl p-8 bg-[#1B2028] rounded-xl shadow-modal flex gap-6">
        {/* Logo / lockup */}
        <div className="flex-shrink-0 flex items-center gap-3 pr-4 border-r border-slate-700">
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <circle cx="32" cy="32" r="30" fill="#2F6F5E" />
            <path d="M20 36c6-8 18-10 24-6" stroke="#F7F6F3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-2xl font-semibold text-[#F7F6F3]">Shinex</div>
            <div className="text-xs text-slate-400">POWERED BY HSB HOLDINGS</div>
          </div>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-4 text-[#3F9884]">Sign in</h1>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs text-slate-300">Username</label>
              <input
                name="username"
                autoComplete="username"
                placeholder="e.g. superadmin or admin"
                className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white focus:outline-none focus:border-[#3F9884]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Password</label>
              <input
                name="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white focus:outline-none focus:border-[#3F9884]"
                required
              />
            </div>
            {errorMessage && (
              <div role="alert" className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-300">
                Business Center <span className="text-slate-500">(Optional for Superadmin)</span>
              </label>
              <select
                value={selectedBc}
                onChange={e => setSelectedBc(e.target.value)}
                className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white appearance-none focus:outline-none focus:border-[#3F9884]"
              >
                <option value="" className="text-slate-900">None / All Business Centers (Superadmin)</option>
                {bcList.map(b => (
                  <option key={b.code} value={b.code} className="text-slate-900">
                    {b.code} / {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400"></div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2F6F5E] hover:bg-[#3F9884] text-white py-2 rounded-md btn-press mt-2 font-medium disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
