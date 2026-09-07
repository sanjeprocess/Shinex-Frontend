import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import TopMenuBar from '../../components/TopMenuBar'
import { list as listBC } from '../../mocks/businessCenters'
import ShinexLogo from '../ShinexLogo'

export default function Layout() {
  const [bc, setBc] = useState<string | null>(null)
  const [centers, setCenters] = useState<any[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [bcOpen, setBcOpen] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { listBC().then(list => { setCenters(list); const saved = localStorage.getItem('hsb_active_bc'); if (saved && list.some(x=>x.code===saved)) { setBc(saved) } else { setBc(list[0]?.code || null); if (list[0]) localStorage.setItem('hsb_active_bc', list[0].code) } }) }, [])

  const rootRef = React.useRef<HTMLDivElement | null>(null)
  useEffect(()=>{
    function onDoc(e: MouseEvent){ if (!rootRef.current) return; if (!rootRef.current.contains(e.target as Node)) { setProfileOpen(false); setBcOpen(false) } }
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') { setProfileOpen(false); setBcOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  function signOut(){ localStorage.removeItem('hsb_auth_token'); localStorage.removeItem('hsb_test_auth'); localStorage.removeItem('hsb_user_permissions'); navigate('/login') }
  function initials(){ const name = localStorage.getItem('hsb_test_user') || 'Test User'; return name.split(' ').map(s=>s[0]).slice(0,2).join('') }
  const profile = (() => { try { return JSON.parse(localStorage.getItem('hsb_user_profile') || '{}') } catch { return {} } })()
  const profileName = profile.fullName || localStorage.getItem('hsb_test_user') || 'Test User'

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <Toaster richColors position="top-right" closeButton expand visibleToasts={5} />
      <header className="relative z-30 overflow-visible bg-white border-b">
        <div ref={rootRef} className="relative z-40 max-w-7xl mx-auto px-6 py-3 flex items-center justify-between overflow-visible">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-3 rounded-md px-1 py-1 transition hover:text-[#264e45] focus:outline-none focus:ring-2 focus:ring-[#2F6F5E]/30" aria-label="Go to dashboard">
              <ShinexLogo />
            </Link>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">HSB HRIS</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative z-50">
              <button onClick={()=>setBcOpen(!bcOpen)} className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border">
                <span className="w-2 h-2 rounded-full bg-[#3F9884]" />
                <strong className="text-sm">{centers.find(c=>c.code===bc)?.name || bc}</strong>
                <svg className="ml-2" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {bcOpen && (
                <div className="absolute top-full right-0 mt-2 z-[9999] w-80 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                  <ul>
                    {centers.map(c=> <li key={c.code}><button className="w-full text-left px-3 py-2 text-sm" onClick={()=>{ setBc(c.code); localStorage.setItem('hsb_active_bc', c.code); setBcOpen(false) }}>{c.code} / {c.name}</button></li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={()=>setProfileOpen(!profileOpen)} className="w-9 h-9 rounded-full bg-[#2F6F5E] text-white flex items-center justify-center text-sm font-semibold">{initials()}</button>
              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 z-50 min-w-[220px] w-56 bg-white border rounded shadow-float text-slate-900">
                  <div className="p-4 space-y-1">
                    <p className="font-semibold text-gray-800">{profileName}</p>
                    <p className="text-xs text-gray-500">NIC: {profile.nicNumber || 'N/A'}</p>
                    <p className="text-xs text-emerald-600 font-medium">{profile.role || localStorage.getItem('hsb_user_role') || 'ADMIN'}</p>
                    <p className="text-xs text-gray-400">{profile.businessCenterName || centers.find(c=>c.code===bc)?.name || bc || 'All Business Centers'}</p>
                  </div>
                  <div className="border-t" />
                  <div className="px-2 py-2"><button type="button" onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-red-600 flex items-center gap-2 whitespace-nowrap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 17l5-5m0 0l-5-5m5 5H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Sign out</button></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <TopMenuBar />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
