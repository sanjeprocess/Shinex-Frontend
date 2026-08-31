import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { list as listBC } from '../mocks/businessCenters'

type MenuItem = { label: string; to?: string }

const MENU = [
  { label: 'Master', items: [
    { label: 'Business Centers', to: '/business-centers' },
    { label: 'Employee Sections', to: '/sections' },
    { label: 'Employees', to: '/employees' },
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
  const [bc, setBc] = useState<string | null>(null)

  useEffect(() => { listBC().then(list => setBc(list[0]?.code || null)); }, [])

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

  return (
    <div ref={rootRef} className="sticky top-0 z-20 bg-[#12161C] text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-8 h-12">
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className={`px-3 py-2 text-sm rounded ${location.pathname === '/' ? 'underline decoration-2 decoration-[#3F9884] font-semibold text-white' : 'text-slate-200 hover:bg-[#1B2028]'}`}>
              Dashboard
            </Link>
            {MENU.map((group, idx) => (
              <div key={group.label} className="relative">
                <button
                  onClick={() => setOpen(open === idx ? null : idx)}
                  onMouseEnter={() => setOpen(idx)}
                  className={`px-3 py-2 text-sm rounded ${activeIndex === idx ? 'underline decoration-2 decoration-[#3F9884]' : 'hover:bg-[#1B2028]'}`}>
                  {group.label}
                </button>
                {open === idx && (
                  <div onMouseLeave={() => setOpen(null)} className="absolute left-0 mt-2 w-56 bg-[#1B2028] border border-[#2a2f33] rounded-md shadow-float dropdown-transition" style={{transform: 'translateY(0)', opacity: 1}}>
                    <ul className="py-2">
                      {group.items.map((it: any) => (
                        <li key={it.label}>
                          <Link to={it.to || '#'} onClick={() => setOpen(null)} className="block px-4 py-2 text-sm text-white hover:bg-[#3F9884] hover:text-white">
                            {it.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
