import React from 'react'

export default function Header() {
  return (
    <header className="w-full border-b bg-white sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="text-sm text-slate-600">Business Center: <strong>—</strong></div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-700">Welcome, User</div>
        </div>
      </div>
    </header>
  )
}
