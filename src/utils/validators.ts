export function isLettersOnly(value: string): boolean {
  if (!value) return true
  return /^[a-zA-Z\s.\-']+$/.test(value.trim())
}

export function containsNumber(value: string): boolean {
  return /\d/.test(value ?? '')
}

export function validateNameField(value: string, label = 'Name'): string | null {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) return null
  return isLettersOnly(trimmed) ? null : `${label} can only contain letters, spaces, periods, hyphens, or apostrophes`
}

export function validateTextField(value: string, label = 'Field'): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  return containsNumber(trimmed) ? `${label} cannot contain numbers` : null
}

export function validateNumberField(value: string, label = 'Field'): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  return /^\d*\.?\d*$/.test(trimmed) ? null : `${label} must be a number`
}
