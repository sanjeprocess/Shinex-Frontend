import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { list as listBC } from '../mocks/businessCenters'

export default function Login() {
  const navigate = useNavigate()
  const [bcList, setBcList] = useState<Array<any>>([])
  const [selectedBc, setSelectedBc] = useState<string>('')

  useEffect(() => { listBC().then(list => { setBcList(list); setSelectedBc(list[0]?.code || '') }) }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Test mode: accept any credentials and proceed to dashboard
    if (!selectedBc && bcList.length) setSelectedBc(bcList[0].code)
      // set a simple client-side flag so ProtectedRoute allows entry in test mode
      try { localStorage.setItem('hsb_test_auth', '1'); } catch {}
      navigate('/')
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
              <input name="username" className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Password</label>
              <input name="password" type="password" className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Business Center</label>
              <select value={selectedBc} onChange={e => setSelectedBc(e.target.value)} className="mt-1 w-full border border-slate-600 rounded-md px-3 py-2 bg-transparent text-white appearance-none">
                {bcList.map(b => <option key={b.code} value={b.code} className="text-slate-900">{b.code} / {b.name}</option>)}
              </select>
            </div>

            <div className="text-xs text-slate-400">Test mode — any credentials will sign you in</div>

            <button type="submit" className="w-full bg-[#2F6F5E] text-white py-2 rounded-md btn-press mt-2">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  )
}
