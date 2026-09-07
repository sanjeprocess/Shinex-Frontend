import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { list as listBC } from '../mocks/businessCenters'
import { getCurrentUser } from '../utils/permissions'

type MenuItem = { label: string; to?: string }

const MENU = [
  { label: 'Master', items: [
    { label: 'Business Centers', to: '/business-centers' },
    { label: 'Employee Sections', to: '/sections' },
    { label: 'Employees', to: '/employees' },
    { label: 'EPF B-Cards', to: '/bcards' },
    { label: 'Addition Types', to: '/additions' },
    { label: 'Deduction Types', to: '/deductions' },
    { label: 'Customers / Plants', to: '/customers' },
  ] },
  { label: 'Transaction', items: [
    { label: 'Attendance', to: '/attendance' },
    { label: 'Additions', to: '/employee-additions' },
    { label: 'Deductions', to: '/employee-deductions' },
    { label: 'Leave', to: '/leaves' },
    { label: 'Loans', to: '/loans' },
  ] },
  { label: 'Process', items: [
    { label: 'Payroll Run', to: '/payroll' },
    { label: 'Employee Monthly Summary', to: '/monthly-breakdown' },
    { label: 'System Audit Trail', to: '/audit-logs' },
  ] },
  { label: 'Reports', items: [
    { label: 'General Reports', to: '/reports' },
    { label: 'Employee History Dossier', to: '/employee-history' },
    { label: 'System Change History', to: '/audit-logs' },
  ] },
]

export default function TopMenuBar() {
  const [open, setOpen] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  const [userRole, setUserRole] = useState<string>('ADMIN')

  useEffect(() => {
    const role = localStorage.getItem('hsb_user_role') || 'ADMIN'
    setUserRole(role.toUpperCase())
  }, [location])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  // determine active top-level by URL
  const activeIndex = (() => {
    const path = location.pathname
    for (let i = 0; i < MENU.length; i++) {
      const group = MENU[i].items as MenuItem[]
      if (group.some(it => it.to && path.startsWith(it.to))) return i
    }
    return null
  })()

  const isSuperAdmin = userRole === 'SUPERADMIN'
  const canViewSite = getCurrentUser().canViewSite

  return (
    <div ref={rootRef} className="sticky top-0 z-20 overflow-visible bg-[#12161C] text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 overflow-visible">
        <div className="flex items-center justify-between h-12">
          <nav className="flex items-center gap-3">
            <Link
              to="/"
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                location.pathname === '/'
                  ? 'bg-[#1B2028] text-[#3F9884] font-semibold border border-[#3F9884]/30'
                  : 'text-slate-200 hover:bg-[#1B2028]'
              }`}
            >
              Dashboard
            </Link>

            {canViewSite && MENU.map((group, idx) => (
              <div key={group.label} className="relative">
                <button
                  onClick={() => setOpen(open === idx ? null : idx)}
                  onMouseEnter={() => setOpen(idx)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeIndex === idx
                      ? 'bg-[#1B2028] text-[#3F9884] font-semibold border border-[#3F9884]/30'
                      : 'text-slate-200 hover:bg-[#1B2028]'
                  }`}
                >
                  {group.label}
                </button>
                {open === idx && (
                  <div
                    onMouseLeave={() => setOpen(null)}
                    className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#2a2f33] bg-[#1B2028] shadow-2xl dropdown-transition"
                    style={{ transform: 'translateY(0)', opacity: 1 }}
                  >
                    <ul className="py-2">
                      {group.items.map((it: any) => (
                        <li key={it.label}>
                          <Link
                            to={it.to || '#'}
                            onClick={() => setOpen(null)}
                            className="block px-4 py-2 text-sm text-slate-200 hover:bg-[#3F9884] hover:text-white transition-colors"
                          >
                            {it.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* SUPERADMIN Only: Admin Control Tab */}
            {isSuperAdmin && (
              <Link
                to="/admin-control"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  location.pathname.startsWith('/admin-control')
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-amber-400/90 hover:bg-amber-500/10 hover:text-amber-300 border border-amber-500/20'
                }`}
              >
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 011.341 1.341l-.8 1.599L18.677 11H20a1 1 0 110 2h-1.323l-1.582 3.954.8 1.599a1 1 0 01-1.341 1.341l-1.599-.8L11 18.677V20a1 1 0 11-2 0v-1.323l-3.954-1.582-1.599.8a1 1 0 01-1.341-1.341l.8-1.599L1.323 13H0a1 1 0 110-2h1.323l1.582-3.954-.8-1.599a1 1 0 011.341-1.341l1.599.8L9 4.323V3a1 1 0 011-1zm0 5a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
                </svg>
                Admin Control
              </Link>
            )}
          </nav>

          {/* User Badge */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <span className="bg-amber-500/15 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                SUPERADMIN
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
