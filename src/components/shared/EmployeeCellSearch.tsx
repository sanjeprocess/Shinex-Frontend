import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_OPTIONS = 30

/** Employee ID cell of a table: type the EPF or any part of the name. The list floats above the table's scroll area. */
export default function EmployeeCellSearch({ employees, value, onChange, invalid = false, className = '' }: {
  employees: any[]
  value?: string | null
  onChange: (epf: string) => void
  invalid?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => { if (!open) setDraft(value || '') }, [value, open])

  const options = useMemo(() => {
    if (!open) return []
    const tokens = draft.trim().toLowerCase().split(/\s+/).filter(Boolean)
    // Opening on a saved value lists everyone; typing narrows it
    const typing = tokens.length > 0 && draft !== (value || '')
    const nameOf = (e: any) => `${e.epfNo} ${e.firstName || ''} ${e.lastName || ''}`.toLowerCase()
    return (typing ? employees.filter(e => tokens.every(t => nameOf(e).includes(t))) : employees).slice(0, MAX_OPTIONS)
  }, [employees, draft, open, value])

  const place = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) setPosition({ left: rect.left, top: rect.bottom + 2 })
  }

  // The list floats outside the table, so it follows the cell when the table scrolls
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', place, true)
    return () => window.removeEventListener('scroll', place, true)
  }, [open])

  const choose = (epf: string) => {
    setOpen(false)
    setDraft(epf)
    if (epf !== (value || '')) onChange(epf)
  }

  const finish = () => {
    if (!open) return
    const text = draft.trim()
    if (!text) return choose('')
    const exact = employees.find(e => (e.epfNo || '').trim().toLowerCase() === text.toLowerCase())
    if (exact) return choose(exact.epfNo)
    if (draft !== (value || '') && options.length === 1) return choose(options[0].epfNo)
    setOpen(false)
    setDraft(value || '')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(current => Math.max(0, Math.min(options.length - 1, current + step)))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (options[active]) choose(options[active].epfNo)
      inputRef.current?.blur()
    } else if (event.key === 'Escape') {
      setOpen(false)
      setDraft(value || '')
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        placeholder="EPF or name"
        title="Type the EPF number or any part of the employee name"
        onFocus={e => { e.target.select(); place(); setActive(0); setOpen(true) }}
        onChange={e => { setDraft(e.target.value); setActive(0); place(); setOpen(true) }}
        onBlur={finish}
        onKeyDown={handleKeyDown}
        className={`form-input font-mono ${invalid ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : ''} ${className}`}
      />
      {open && createPortal(
        <div
          id="employee-cell-options"
          style={{ position: 'fixed', left: position.left, top: position.top, zIndex: 1000 }}
          className="w-72 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No employee found</div>
          ) : options.map((employee, index) => (
            <button
              key={employee.epfNo}
              type="button"
              // Before the input's blur, so the click is not lost
              onMouseDown={event => { event.preventDefault(); choose(employee.epfNo); inputRef.current?.blur() }}
              className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 ${index === active ? 'bg-emerald-50' : ''}`}
            >
              <div className="text-xs font-medium text-slate-800">{employee.epfNo} - {employee.firstName} {employee.lastName || ''}</div>
              <div className="text-[10px] text-slate-500">Plant: {employee.plantCode || '-'}</div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
