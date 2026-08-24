import React from 'react'

export default function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className={`inline-flex items-center gap-2 px-3 py-1 rounded ${checked ? 'bg-[#2F6F5E] text-white' : 'bg-slate-100 text-slate-700'}`}>
      <span className={`w-4 h-4 rounded-full ${checked ? 'bg-white' : 'bg-slate-400'}`} />
      {label && <span className="text-sm">{label}</span>}
    </button>
  )
}
