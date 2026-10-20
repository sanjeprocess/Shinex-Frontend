import React from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import TopMenuBar from '../components/TopMenuBar'
import { list as listBC } from '../mocks/businessCenters'
import { useState, useEffect } from 'react'
import ShinexLogo from '../components/ShinexLogo'

export default function AppShell() {
  const [bc, setBc] = useState<string | null>(null)
  const [centers, setCenters] = useState<any[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [bcOpen, setBcOpen] = useState(false)
  const navigate = useNavigate()

  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const userRole = localStorage.getItem('hsb_user_role') || ''
  const isSuperAdmin = userRole === 'SUPERADMIN'

  useEffect(() => {
    listBC().then(list => {
      const assignedBc = localStorage.getItem('hsb_assigned_bc')
      let filteredList = list
      if (!isSuperAdmin && assignedBc && assignedBc !== 'ALL') {
        filteredList = list.filter(x => x.code === assignedBc || x.name === assignedBc || assignedBc.includes(x.code))
        if (filteredList.length === 0 && list.length > 0) {
          const match = list.find(x => assignedBc.toLowerCase().includes(x.code.toLowerCase()) || assignedBc.toLowerCase().includes((x.name || '').toLowerCase()))
          if (match) filteredList = [match]
        }
      }
      setCenters(filteredList.length > 0 ? filteredList : list)

      const saved = localStorage.getItem('hsb_active_bc')
      if (!isSuperAdmin && assignedBc && assignedBc !== 'ALL') {
        const targetBc = filteredList[0]?.code || assignedBc
        setBc(targetBc)
        localStorage.setItem('hsb_active_bc', targetBc)
      } else if (saved && (saved === 'ALL' || list.some(x => x.code === saved || x.name === saved))) {
        setBc(saved)
      } else if (list.length > 0) {
        setBc(list[0]?.code || null)
        if (list[0]) localStorage.setItem('hsb_active_bc', list[0].code)
      }
    })
  }, [isSuperAdmin])

  // Strictly enforce assigned business center on every route change for non-superadmins
  useEffect(() => {
    if (!isSuperAdmin) {
      const assignedBc = localStorage.getItem('hsb_assigned_bc')
      if (assignedBc && assignedBc !== 'ALL') {
        const currentActive = localStorage.getItem('hsb_active_bc')
        if (currentActive !== assignedBc) {
          localStorage.setItem('hsb_active_bc', assignedBc)
          setBc(assignedBc)
          window.dispatchEvent(new CustomEvent('hsb_bc_change', { detail: assignedBc }))
        }
      }
    }
  }, [location.pathname, isSuperAdmin])

  function switchBc(newBc: string) {
    if (!isSuperAdmin) return
    setBc(newBc)
    localStorage.setItem('hsb_active_bc', newBc)
    setBcOpen(false)
    window.dispatchEvent(new CustomEvent('hsb_bc_change', { detail: newBc }))
  }

  useEffect(()=>{
    function onDoc(e: MouseEvent){ if (!rootRef.current) return; if (!rootRef.current.contains(e.target as Node)) { setProfileOpen(false); setBcOpen(false) } }
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') { setProfileOpen(false); setBcOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  function signOut(){
    localStorage.removeItem('hsb_auth_token')
    localStorage.removeItem('hsb_test_auth')
    localStorage.removeItem('hsb_test_user')
    localStorage.removeItem('hsb_user_role')
    localStorage.removeItem('hsb_user_profile')
    localStorage.removeItem('hsb_user_permissions')
    localStorage.removeItem('hsb_assigned_bc')
    localStorage.removeItem('hsb_active_bc')
    navigate('/login')
  }
  function initials(){ const name = localStorage.getItem('hsb_test_user') || 'Test User'; return name.split(' ').map(s=>s[0]).slice(0,2).join('') }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <Toaster richColors position="top-right" closeButton expand visibleToasts={5} />
      <header className="bg-white border-b">
        <div ref={rootRef} className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center rounded-md px-1 py-1 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#2F6F5E]/30" aria-label="Go to dashboard">
              <ShinexLogo />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isSuperAdmin ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={()=> setBcOpen(!bcOpen)}
                  className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border hover:border-slate-400 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-[#3F9884]" />
                  <strong className="text-sm">{bc === 'ALL' ? 'All Business Centers' : (centers.find(c => c.code === bc)?.name ? `${bc} - ${centers.find(c => c.code === bc)?.name}` : bc)}</strong>
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {bcOpen && (
                  <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-white border rounded shadow-float max-h-80 overflow-y-auto">
                    <ul className="divide-y divide-slate-100">
                      <li>
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 font-medium ${bc === 'ALL' ? 'text-[#2F6F5E] bg-emerald-50' : ''}`}
                          onClick={() => switchBc('ALL')}
                        >
                          All Business Centers
                        </button>
                      </li>
                      {centers.map(c=> (
                        <li key={c.code}>
                          <button
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${bc === c.code ? 'text-[#2F6F5E] bg-emerald-50 font-medium' : ''}`}
                            onClick={() => switchBc(c.code)}
                          >
                            {c.code} / {c.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 select-none">
                <span className="w-2 h-2 rounded-full bg-[#3F9884]" />
                <span className="text-xs font-semibold text-slate-700">
                  {centers.find(c => c.code === bc)?.name ? `${bc} - ${centers.find(c => c.code === bc)?.name}` : (bc || 'Assigned Business Center')}
                </span>
              </div>
            )}

            <div className="relative">
              <button onClick={()=>setProfileOpen(!profileOpen)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold">{initials()}</button>
              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 z-50 min-w-[220px] w-56 bg-white border rounded shadow-float text-slate-900">
                  <div className="px-3 py-2 text-sm font-medium">{localStorage.getItem('hsb_test_user') || 'Test User'}</div>
                  <div className="px-3 py-1 text-xs text-slate-500">test.user@shinex.lk</div>
                  <div className="px-3 py-2 text-xs text-slate-400">{centers.find((c: any)=>c.code===bc)?.name || bc}</div>
                  <div className="border-t" />
                  <div className="px-2 py-2"><button type="button" onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-red-600 whitespace-nowrap">Sign out</button></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top menu bar replaces the old permanent sidebar */}
        <TopMenuBar />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
