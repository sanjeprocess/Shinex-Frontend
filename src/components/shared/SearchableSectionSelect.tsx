import React, { useEffect, useMemo, useRef, useState } from 'react'
import { list as listSections, Section } from '../../mocks/sections'

export default function SearchableSectionSelect({
  value,
  onChange,
  sections: passedSections,
  businessCenter,
  placeholder = 'Search section by code or name...',
  className = '',
  error,
  disabled = false
}: {
  value?: string | null
  onChange: (sectionCode: string, section?: Section) => void
  sections?: Section[]
  businessCenter?: string
  placeholder?: string
  className?: string
  error?: string
  disabled?: boolean
}) {
  const [fetchedSections, setFetchedSections] = useState<Section[]>([])
  const [q, setQ] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!passedSections || passedSections.length === 0) {
      listSections(businessCenter)
        .then(setFetchedSections)
        .catch(() => {})
    }
  }, [passedSections, businessCenter])

  const sectionCatalog = useMemo(() => {
    const raw = (passedSections && passedSections.length > 0) ? passedSections : fetchedSections
    const cleanBc = businessCenter ? businessCenter.split(' / ')[0].trim().toUpperCase() : ''

    return (raw || []).filter(s => {
      if (!s || !s.code) return false
      if (!cleanBc || cleanBc === 'ALL') return true
      const sBc = (s.businessCenter || '').trim().toUpperCase()
      if (!sBc) return true
      return sBc === cleanBc || sBc.startsWith(cleanBc) || cleanBc.startsWith(sBc)
    })
  }, [passedSections, fetchedSections, businessCenter])

  const selectedSection = useMemo(
    () => (sectionCatalog || []).find(s => s && s.code === value) || null,
    [sectionCatalog, value]
  )

  useEffect(() => {
    if (selectedSection) {
      setQ(`${selectedSection.code} / ${selectedSection.name || ''}`)
    } else if (!value) {
      setQ('')
    }
  }, [selectedSection, value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return sectionCatalog || []
    const lower = q.toLowerCase()
    return (sectionCatalog || []).filter(s => {
      if (!s) return false
      const c = (s.code || '').toLowerCase()
      const n = (s.name || '').toLowerCase()
      const bc = (s.businessCenter || '').toLowerCase()
      return c.includes(lower) || n.includes(lower) || bc.includes(lower)
    })
  }, [sectionCatalog, q])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={q}
          onFocus={() => {
            if (!disabled) setIsOpen(true)
          }}
          onChange={e => {
            setQ(e.target.value)
            setIsOpen(true)
            if (!e.target.value.trim()) {
              onChange('')
            }
          }}
          placeholder={placeholder}
          className={`w-full form-input pr-8 text-sm ${error ? 'border-red-500 bg-red-50' : ''} ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setQ('')
              onChange('')
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              No sections matching <span className="font-medium text-slate-700">"{q}"</span>
            </div>
          ) : (
            filtered.map(s => {
              const isSelected = s.code === value
              return (
                <div
                  key={s.code}
                  onClick={() => {
                    onChange(s.code, s)
                    setQ(`${s.code} / ${s.name}`)
                    setIsOpen(false)
                  }}
                  className={`px-3 py-2 cursor-pointer transition flex items-center justify-between gap-2 hover:bg-emerald-50 ${isSelected ? 'bg-emerald-50/70 border-l-4 border-[#2F6F5E]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono-numeric font-semibold text-xs text-[#2F6F5E] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {s.code}
                      </span>
                      <span className="font-medium text-sm text-slate-800 truncate">
                        {s.name}
                      </span>
                    </div>
                    {s.businessCenter && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Business Center: <span className="font-medium text-slate-600">{s.businessCenter}</span>
                      </div>
                    )}
                  </div>
                  {s.basicSalary != null && Number(s.basicSalary) > 0 && (
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700 mono-numeric bg-slate-100 px-2 py-0.5 rounded">
                        Rs. {Number(s.basicSalary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
