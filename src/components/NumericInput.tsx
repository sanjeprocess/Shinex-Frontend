import React from 'react'

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  integer?: boolean
  onChange?: React.ChangeEventHandler<HTMLInputElement>
}

export default function NumericInput({ integer = false, onChange, onKeyDown, ...props }: NumericInputProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (['e', 'E', '+', '-', ...(integer ? ['.'] : [])].includes(event.key)) {
      event.preventDefault()
      return
    }
    onKeyDown?.(event)
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const pattern = integer ? /[^0-9]/g : /[^0-9.]/g
    event.currentTarget.value = event.currentTarget.value
      .replace(pattern, '')
      .replace(/^0+(?=\d)/, '')
      .replace(/^0+(?=\.)/, '0')
    onChange?.(event)
  }

  return <input {...props} type="number" onKeyDown={handleKeyDown} onChange={handleChange} />
}
