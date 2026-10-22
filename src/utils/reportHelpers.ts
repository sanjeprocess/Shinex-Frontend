/**
 * Report formatting helpers for HSB HRIS A4 reports
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Converts "2024-12-06" or ISO string to "06-Dec-2024" */
export function formatDateDdMmmYyyy(dateStr?: string): string {
  if (!dateStr) return '—'
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    const y = parts[0]
    const m = parseInt(parts[1], 10) - 1
    const d = parts[2].padStart(2, '0')
    if (m >= 0 && m < 12) {
      return `${d}-${MONTH_NAMES[m]}-${y}`
    }
  }
  return dateStr
}

/** Converts "07:16" or "18:30:00" to "7:16 am" or "6:30 pm" */
export function formatTimeAmPm(timeStr?: string): string {
  if (!timeStr) return '—'
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1].padStart(2, '0')
    if (isNaN(hours)) return timeStr
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    if (hours === 0) hours = 12
    return `${hours}:${minutes} ${ampm}`
  }
  return timeStr
}

/** Converts decimal hours like 11.25 to "11:15" */
export function decimalToHmm(num?: number): string {
  if (num == null || isNaN(num) || num <= 0) return '0:00'
  const h = Math.floor(num)
  const m = Math.round((num - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Formats a number to 2 decimal places with Sri Lankan commas */
export function formatCurrency(n: number | string | undefined | null): string {
  if (n == null || n === '') return '0.00'
  const num = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
