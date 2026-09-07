export function isLettersOnly(value: string): boolean {
  if (!value) return true
  return /^[A-Za-z\s'-]+$/.test(value.trim())
}

export function containsNumber(value: string): boolean {
  return /\d/.test(value ?? '')
}

export function validateNameField(value: string, label = 'Name'): string | null {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) return null
  return isLettersOnly(trimmed) ? null : `${label} can only contain letters`
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
