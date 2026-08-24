import React from 'react'

export default function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children?: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black opacity-40 transition-opacity" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-modal h-full overflow-auto p-6 slide-over-transition">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-600">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
