import React from 'react'
import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="!pl-10 !pr-8 py-1.5 rounded-full border form-input w-64" />
        {value && <button onClick={()=>onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 p-1"><X size={14} /></button>}
      </div>
    </div>
  )
}
