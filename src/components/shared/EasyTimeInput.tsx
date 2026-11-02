import React, { useEffect, useState } from 'react'
import { displayTime } from '../../utils/easyTime'

/** Time cell with the browser's clock picker. Enter moves to the next row of a table. */
export default function EasyTimeInput({ value, onCommit, column, ariaLabel, className = '' }: {
  value?: string | null
  onCommit: (time: string) => void
  column: string
  ariaLabel?: string
  className?: string
}) {
  const shown = displayTime(value)
  const [draft, setDraft] = useState(shown)

  useEffect(() => setDraft(shown), [shown])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value)
    // Blank while a part is being typed; a cleared time is committed on leaving the cell
    if (event.target.value && event.target.value !== shown) onCommit(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const input = event.currentTarget
    const inputs = Array.from(input.closest('table')?.querySelectorAll<HTMLInputElement>(`input[data-time-col="${column}"]`) || [])
    const next = inputs[inputs.indexOf(input) + 1]
    if (next) next.focus()
    else input.blur()
  }

  return (
    <input
      type="time"
      data-time-col={column}
      aria-label={ariaLabel}
      value={draft}
      onChange={handleChange}
      onClick={event => { try { event.currentTarget.showPicker() } catch { /* typing still works */ } }}
      onBlur={() => { if (!draft && shown) onCommit('') }}
      onKeyDown={handleKeyDown}
      className={`form-input font-mono ${className}`}
    />
  )
}
