import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { toast } from 'sonner'

type BusinessCenter = {
  code: string
  name: string
}

export default function Login() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [businessCenters, setBusinessCenters] = useState<BusinessCenter[]>([])
  const [selectedBc, setSelectedBc] = useState<string>('')
  const [bcLoading, setBcLoading] = useState(true)

  // Load business centers on mount for the dropdown
  useEffect(() => {
    setBcLoading(true)
    // Use a direct fetch without auth token since this must work before login
    fetch('/api/business-centers', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          const centers: BusinessCenter[] = data.map((b: any) => ({
            code: (b.code || b.companyId || '').trim(),
            name: (b.name || b.companyName || '').trim()
          })).filter(b => b.code)
          setBusinessCenters(centers)
          if (centers.length > 0) {
            setSelectedBc(centers[0].code)
          }
        }
      })
      .catch(() => {
        // Backend unreachable or returned error — login can still proceed without BC dropdown
        setBusinessCenters([])
      })
      .finally(() => setBcLoading(false))
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
      const response = await api.post('/auth/login', {
        loginName,
        password: enteredPassword,
        clientBusinessCode: selectedBc || undefined
      })

      const userRole = (response.data.role || 'ADMIN').toUpperCase()
      const isSuperAdminUser = ['SUPERADMIN', 'SUPER_ADMIN'].includes(userRole)
      const rawAssignedBc = response.data.clientBusinessCode || ''
      const assignedBc = rawAssignedBc.split(' - ')[0].split(' / ')[0].trim()

      // Determine effective BC: for non-superadmin with assigned BC, lock to it; otherwise use selected
      const effectiveBc = (!isSuperAdminUser && assignedBc && assignedBc !== 'ALL')
        ? assignedBc
        : (selectedBc || assignedBc || 'ALL')

      localStorage.setItem('hsb_auth_token', response.data.token)
      localStorage.setItem('hsb_test_user', response.data.loginName || loginName)
      localStorage.setItem('hsb_user_profile', JSON.stringify({
        fullName: response.data.fullName || response.data.loginName || loginName,
        nicNumber: response.data.nicNumber || '',
        role: userRole,
        businessCenterName: effectiveBc
      }))
      localStorage.setItem('hsb_user_role', userRole)
      localStorage.setItem('hsb_assigned_bc', (!isSuperAdminUser && assignedBc && assignedBc !== 'ALL') ? assignedBc : (isSuperAdminUser ? 'ALL' : effectiveBc))
      localStorage.setItem('hsb_active_bc', effectiveBc)

      // Save base permissions immediately so app can load
      let rawModules = response.data.modulePermissions ?? response.data.modules ?? null
      if (typeof rawModules === 'string') {
        try { rawModules = JSON.parse(rawModules) } catch { /* keep */ }
      }
      const basePerms = {
        isBlocked: response.data.blocked === true,
        canViewSite: response.data.canViewSite !== false,
        accessLevel: response.data.accessLevel || 'READ_WRITE',
        canManageUsers: response.data.canManageUsers === true,
        modules: rawModules
      }
      localStorage.setItem('hsb_user_permissions', JSON.stringify(basePerms))

      // Also fetch the full admin record to get granular modulePermissions if superadmin
      try {
        if (userRole === 'SUPERADMIN') {
          const adminRes = await api.get('/admins')
          const matched = Array.isArray(adminRes.data)
            ? adminRes.data.find((a: any) =>
                (a.loginName || '').toLowerCase() === (response.data.loginName || loginName).toLowerCase()
              )
            : null
          if (matched && matched.modulePermissions) {
            const fullPerms = {
              ...basePerms,
              modules: matched.modulePermissions
            }
            localStorage.setItem('hsb_user_permissions', JSON.stringify(fullPerms))
          }
        }
      } catch {
        // Non-fatal
      }

      window.dispatchEvent(new CustomEvent('hsb_bc_change', { detail: effectiveBc }))

      toast.success(`Welcome back, ${response.data.loginName || loginName}!`)
      navigate('/')
    } catch (error: any) {
      const status = error.response?.status
      const message = error.response?.data?.message ||
        (typeof error.response?.data === 'string' ? error.response.data : '') ||
        (status === 401
          ? 'Invalid username or password.'
          : status === 403
            ? 'Access denied. You are not authorized to log into this Business Center.'
            : !error.response
              ? "Can't reach the server. Check your network connection and backend availability."
              : 'Sign-in failed. Please try again.')
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
            <div>
              <label className="block text-xs text-slate-300">Business Center *</label>
              {bcLoading ? (
                <div className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 text-slate-400 text-sm bg-transparent">
                  Loading business centers…
                </div>
              ) : businessCenters.length > 0 ? (
                <select
                  value={selectedBc}
                  onChange={e => setSelectedBc(e.target.value)}
                  className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-[#1B2028] text-white focus:outline-none focus:border-[#3F9884] cursor-pointer"
                  required
                >
                  {businessCenters.map(bc => (
                    <option key={bc.code} value={bc.code} className="bg-[#1B2028] text-white">
                      {bc.name || bc.code}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 text-slate-400 text-sm bg-transparent">
                  No business centers found — proceeding without selection
                </div>
              )}
              <p className="mt-1 text-[10px] text-slate-500">
                Your account must be authorized for the selected business center.
              </p>
            </div>
            {errorMessage && (
              <div role="alert" className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
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
