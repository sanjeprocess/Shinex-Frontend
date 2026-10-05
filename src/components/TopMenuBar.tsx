import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCurrentUser, canViewModule, AdminPermissions } from '../utils/permissions'

type ModKey = keyof AdminPermissions['modules']

type MenuItem = {
  label: string
  to: string
  /** Module key from permissions — if undefined the item is always visible */
  mod?: ModKey
}

type MenuGroup = {
  label: string
  items: MenuItem[]
}

const MENU: MenuGroup[] = [
  {
    label: 'Master',
    items: [
      { label: 'Business Centers',   to: '/business-centers',    mod: 'masterBCenters'   },
      { label: 'Employee Sections',   to: '/sections',            mod: 'masterSections'   },
      { label: 'Employees',           to: '/employees',           mod: 'employees'        },
      { label: 'EPF B-Cards',         to: '/bcards',              mod: 'masterSections'   },
      { label: 'Addition Types',      to: '/additions',           mod: 'masterAdditions'  },
      { label: 'Deduction Types',     to: '/deductions',          mod: 'masterDeductions' },
      { label: 'Customers / Plants',  to: '/customers',           mod: 'masterCustomers'  },
    ],
  },
  {
    label: 'Transaction',
    items: [
      { label: 'Attendance',                to: '/attendance',         mod: 'attendance'    },
      { label: 'Plant Transfers & Roaming', to: '/plant-transfers',    mod: 'plantTransfers'},
      { label: 'Additions',                 to: '/employee-additions', mod: 'additions'     },
      { label: 'Deductions',                to: '/employee-deductions',mod: 'deductions'    },
      { label: 'Leave',                     to: '/leaves',             mod: 'leaves'        },
      { label: 'Loans',                     to: '/loans',              mod: 'loans'         },
    ],
  },
  {
    label: 'Process',
    items: [
      { label: 'Monthly Breakdown',  to: '/monthly-breakdown', mod: 'process'   },
      { label: 'System Audit Trail', to: '/audit-logs',        mod: 'audit'     },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'General Reports',          to: '/reports',          mod: 'reports'   },
      { label: 'Employee Monthly Summary', to: '/monthly-breakdown',mod: 'process'   },
      { label: 'Employee History Dossier', to: '/employee-history', mod: 'payAdvice' },
    ],
  },
]

export default function TopMenuBar() {
  const [open, setOpen] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  // Re-read permissions on every navigation so changes reflect immediately
  const [, forceUpdate] = useState(0)
  const user = getCurrentUser()

  useEffect(() => {
    // Re-compute visible menu on each route change (picks up any localStorage updates)
    forceUpdate(n => n + 1)
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

  const isSuperAdmin = ['SUPERADMIN', 'SUPER_ADMIN'].includes(user.role)

  /** Filter items by module visibility — SUPERADMIN always sees everything */
  const visibleItems = (items: MenuItem[]): MenuItem[] => {
    if (isSuperAdmin) return items
    return items.filter(it => !it.mod || canViewModule(it.mod))
  }

  /** Filter top-level groups — hide group entirely if all its items are hidden */
  const visibleGroups = MENU.filter(group => {
    if (!user.canViewSite) return false
    return visibleItems(group.items).length > 0
  })

  // Determine active top-level by URL
  const activeIndex = (() => {
    const path = location.pathname
    for (let i = 0; i < visibleGroups.length; i++) {
      if (visibleGroups[i].items.some(it => it.to && path.startsWith(it.to))) return i
    }
    return null
  })()

  return (
    <div ref={rootRef} className="sticky top-0 z-20 overflow-visible bg-[#12161C] text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 overflow-visible">
        <div className="flex items-center justify-between h-12">
          <nav className="flex items-center gap-3">
            {/* Dashboard — always visible */}
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

            {/* Filtered menu groups */}
            {visibleGroups.map((group, idx) => {
              const items = visibleItems(group.items)
              return (
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
                      className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#2a2f33] bg-[#1B2028] shadow-2xl"
                    >
                      <ul className="py-2">
                        {items.map(it => (
                          <li key={it.to}>
                            <Link
                              to={it.to}
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
              )
            })}

            {/* SUPERADMIN only: Admin Control tab */}
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

          {/* Role badge */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <span className="bg-amber-500/15 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                SUPERADMIN
              </span>
            )}
            {!isSuperAdmin && user.isBlocked && (
              <span className="bg-rose-500/15 text-rose-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-rose-500/30">
                BLOCKED
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
