import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Users, FileText } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: <Home size={16} /> },
  { to: '/employees', label: 'Employees', icon: <Users size={16} /> },
  { to: '/attendance', label: 'Attendance', icon: <FileText size={16} /> }
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r">
      <div className="p-4 font-semibold text-xl text-teal-600">Shinex HRIS</div>
      <nav className="p-2">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${isActive ? 'bg-slate-100 font-medium' : 'text-slate-700'}`
            }
          >
            <span className="text-slate-600">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
