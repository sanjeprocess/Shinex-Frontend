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
    if (!selectedBc) {
      toast.error('Please select a Business Center to log in')
      return
    }
    setSubmitting(true)
    setErrorMessage('')
    try {
      const businessCode = selectedBc.split(' / ')[0].trim()
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
        businessCenterName: selectedBc
      }))
      localStorage.setItem('hsb_user_role', response.data.role || 'ADMIN')
      localStorage.setItem('hsb_user_permissions', JSON.stringify({
        isBlocked: response.data.blocked === true,
        canViewSite: response.data.canViewSite !== false,
        accessLevel: response.data.accessLevel || 'READ_WRITE',
        canManageUsers: response.data.canManageUsers === true
      }))

      localStorage.setItem('hsb_active_bc', businessCode)
      window.dispatchEvent(new CustomEvent('hsb_bc_change', { detail: businessCode }))

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
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 pr-4 border-r border-slate-700">
          <img
            src="/shinex_logo.png"
            alt="Shinex"
            className="h-14 w-auto object-contain"
          />
          <div className="text-[10px] text-slate-400 tracking-widest uppercase">Powered by HSB Holdings</div>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-4 text-[#3F9884]">Sign in</h1>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs text-slate-300">Username *</label>
              <input
                name="username"
                autoComplete="username"
                placeholder="e.g. superadmin or admin"
                className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white focus:outline-none focus:border-[#3F9884]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Password *</label>
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
                Business Center / Company Scope *
              </label>
              <select
                value={selectedBc}
                onChange={e => setSelectedBc(e.target.value)}
                className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white appearance-none focus:outline-none focus:border-[#3F9884]"
                required
              >
                <option value="" className="text-slate-900">-- Select Business Center --</option>
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
