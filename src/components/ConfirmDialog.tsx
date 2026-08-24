import React from 'react'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }: { open: boolean; title?: string; message?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-modal p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">{title || 'Confirm'}</h3>
        <p className="text-sm text-slate-600 mb-4">{message || 'Are you sure?'}</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded-md border" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
