import React from 'react'

export default function Modal({ title, open, onClose, children }: { title?: string; open: boolean; onClose: () => void; children?: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity" onClick={onClose} />
      <div className="relative max-h-[90vh] flex flex-col bg-white rounded-xl shadow-modal p-6 w-full max-w-xl overflow-hidden dropdown-transition z-10">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 text-sm font-medium px-2 py-1 rounded-md hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 flex flex-col">{children}</div>
      </div>
    </div>
  )
}

