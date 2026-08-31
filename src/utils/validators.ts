export function isLettersOnly(value: string): boolean {
  if (!value) return true
  return /^[A-Za-z\s'-]+$/.test(value.trim())
}

export function validateNameField(value: string, label = 'Name'): string | null {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) return null
  return isLettersOnly(trimmed) ? null : `${label} can only contain letters`
}
