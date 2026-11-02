import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { displayTime, parseEasyTime } from '../../utils/easyTime'

/** Time cell of the upload review: type 7.30 or 4.30pm; Enter or the arrow keys move to the next row. */
export default function EasyTimeInput({ value, onCommit, column, className = '' }: {
  value?: string | null
  onCommit: (time: string) => void
  column: string
  className?: string
}) {
  const shown = displayTime(value)
  const [draft, setDraft] = useState(shown)

  useEffect(() => setDraft(shown), [shown])

  const commit = () => {
    const parsed = parseEasyTime(draft)
    if (parsed === null) {
      toast.error(`"${draft}" is not a time. Type it like 7.30, 16.45 or 4.30pm.`)
      setDraft(shown)
      return
    }
    setDraft(displayTime(parsed))
    if (displayTime(parsed) !== shown) onCommit(parsed)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setDraft(shown)
      return
    }
    if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const input = event.currentTarget
    const inputs = Array.from(input.closest('table')?.querySelectorAll<HTMLInputElement>(`input[data-time-col="${column}"]`) || [])
    const next = inputs[inputs.indexOf(input) + (event.key === 'ArrowUp' ? -1 : 1)]
    if (next) next.focus()
    else input.blur()
  }

  return (
    <input
      type="text"
      inputMode="text"
      data-time-col={column}
      value={draft}
      placeholder="7.30"
      title="Type 7.30, 730, 16.45 or 4.30pm. Enter moves to the next row."
      onChange={e => setDraft(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={`form-input font-mono ${className}`}
    />
  )
}
