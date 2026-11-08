import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_OPTIONS = 30

export type CellSearchOption = { value: string; label: string; detail?: string }

/** Search box for a form or table cell: type any part of the option. The list floats above the table's scroll area. */
export default function TableCellSearch({ options, value, onChange, showLabel = false, placeholder = 'Search', ariaLabel, invalid = false, className = '', maxOptions = MAX_OPTIONS }: {
  options: CellSearchOption[]
  value?: string | null
  onChange: (value: string) => void
  showLabel?: boolean
  placeholder?: string
  ariaLabel?: string
  invalid?: boolean
  className?: string
  maxOptions?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const current = options.find(option => option.value === value)
  const shown = showLabel && current ? current.label : (value || '')
  const [draft, setDraft] = useState(shown)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => { if (!open) setDraft(shown) }, [shown, open])

  const matches = useMemo(() => {
    if (!open) return []
    const tokens = draft.trim().toLowerCase().split(/\s+/).filter(Boolean)
    // Opening on a saved value lists everything; typing narrows it
    if (!tokens.length || draft === shown) return options.slice(0, maxOptions)
    return options.filter(option => tokens.every(token => option.label.toLowerCase().includes(token))).slice(0, maxOptions)
  }, [options, draft, open, shown, maxOptions])

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

  const choose = (next: string) => {
    setOpen(false)
    if (next !== (value || '')) onChange(next)
  }

  const finish = () => {
    if (!open) return
    const text = draft.trim().toLowerCase()
    if (!text) return choose('')
    if (draft === shown) return setOpen(false)
    const exact = options.find(option => option.value.trim().toLowerCase() === text || option.label.toLowerCase() === text)
    if (exact) return choose(exact.value)
    if (matches.length === 1) return choose(matches[0].value)
    setOpen(false)
    setDraft(shown)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(index => Math.max(0, Math.min(matches.length - 1, index + step)))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (matches[active]) choose(matches[active].value)
      inputRef.current?.blur()
    } else if (event.key === 'Escape') {
      setOpen(false)
      setDraft(shown)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        title={placeholder}
        onFocus={e => { e.target.select(); place(); setActive(0); setOpen(true) }}
        onChange={e => { setDraft(e.target.value); setActive(0); place(); setOpen(true) }}
        onBlur={finish}
        onKeyDown={handleKeyDown}
        className={`form-input ${invalid ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : ''} ${className}`}
      />
      {open && createPortal(
        <div
          data-cell-options
          style={{ position: 'fixed', left: position.left, top: position.top, zIndex: 1000 }}
          className="w-72 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100"
        >
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Nothing found</div>
          ) : matches.map((option, index) => (
            <button
              key={option.value}
              type="button"
              // Before the input's blur, so the click is not lost
              onMouseDown={event => { event.preventDefault(); choose(option.value); inputRef.current?.blur() }}
              className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 ${index === active ? 'bg-emerald-50' : ''}`}
            >
              <div className="text-xs font-medium text-slate-800">{option.label}</div>
              {option.detail && <div className="text-[10px] text-slate-500">{option.detail}</div>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
