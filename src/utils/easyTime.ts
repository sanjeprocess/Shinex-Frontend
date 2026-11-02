/**
 * Reads a time the way people type it: 7.30, 7:30, 730, 7, 16.45, 4.30pm, 07:30:15.
 * Returns HH:mm (HH:mm:ss when seconds are given), '' for blank, or null when it is not a time.
 */
export function parseEasyTime(input: unknown): string | null {
  const text = String(input ?? '').trim().toLowerCase()
  if (!text) return ''
  const match = text.match(/^(\d{1,4})(?:[:.\s](\d{1,2}))?(?:[:.](\d{2}))?\s*(am?|pm?)?$/)
  if (!match) return null
  const [, whole, minutePart, secondPart, suffix] = match
  if (whole.length > 2 && minutePart !== undefined) return null

  let hours: number
  let minutes: number
  if (whole.length > 2) {
    hours = Number(whole.slice(0, -2))
    minutes = Number(whole.slice(-2))
  } else {
    hours = Number(whole)
    // "7.3" is 7:30, as Excel drops the last zero of 7.30
    minutes = minutePart === undefined ? 0 : Number(minutePart.padEnd(2, '0'))
  }
  const seconds = secondPart === undefined ? 0 : Number(secondPart)

  if (suffix) {
    if (hours < 1 || hours > 12) return null
    if (suffix.startsWith('p') && hours < 12) hours += 12
    if (suffix.startsWith('a') && hours === 12) hours = 0
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}${seconds ? `:${pad(seconds)}` : ''}`
}

/** 07:30:00 to 07:30; real seconds are kept. */
export const displayTime = (value?: string | null) => (value || '').trim().replace(/^(\d{1,2}:\d{2}):00$/, '$1')
