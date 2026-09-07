import React from 'react'

export default function Modal({ title, open, onClose, children }: { title?: string; open: boolean; onClose: () => void; children?: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40 transition-opacity" onClick={onClose} />
      <div className="relative max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal p-6 w-full max-w-xl overflow-hidden dropdown-transition">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-500">Close</button>
        </div>
        <div className="min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  )
}
