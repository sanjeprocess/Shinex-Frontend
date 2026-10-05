import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { Building2, Search, X } from 'lucide-react'

export const DEFAULT_BANKS = [
  'Commercial Bank',
  'Bank of Ceylon',
  'People\'s Bank',
  'Hatton National Bank',
  'Sampath Bank',
  'Seylan Bank',
  'Nations Trust Bank',
  'National Savings Bank',
  'DFCC Bank',
  'NDB Bank',
  'Pan Asia Bank',
  'Union Bank',
  'Standard Chartered Bank',
  'HSBC',
  'Cargills Bank',
  'Amana Bank',
  'Habib Bank',
  'State Bank of India',
  'Indian Overseas Bank',
  'Citi Bank'
]

interface SearchableBankSelectProps {
  value?: string
  onChange: (bankName: string) => void
  placeholder?: string
  className?: string
  error?: string
  disabled?: boolean
}

export default function SearchableBankSelect({
  value = '',
  onChange,
  placeholder = 'Search or select bank...',
  className = '',
  error,
  disabled = false
}: SearchableBankSelectProps) {
  const [bankList, setBankList] = useState<string[]>(DEFAULT_BANKS)
  const [q, setQ] = useState(value || '')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQ(value || '')
  }, [value])

  useEffect(() => {
    // Try fetching master banks from API if backend is available
    api.get('/master/banks')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const apiBankNames = res.data
            .map((b: any) => typeof b === 'string' ? b : (b.bankName || b.name || ''))
            .filter(Boolean)
          
          const combined = Array.from(new Set([...apiBankNames, ...DEFAULT_BANKS]))
          setBankList(combined)
        }
      })
      .catch(() => {
        // Fallback to default banks list
      })
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredBanks = useMemo(() => {
    if (!q.trim()) return bankList
    const query = q.toLowerCase().trim()
    return bankList.filter(b => b.toLowerCase().includes(query))
  }, [bankList, q])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQ(val)
    setIsOpen(true)
    onChange(val)
  }

  const handleSelectBank = (bankName: string) => {
    setQ(bankName)
    onChange(bankName)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQ('')
    onChange('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={q}
          onFocus={() => {
            if (!disabled) setIsOpen(true)
          }}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full form-input pr-8 text-sm ${error ? 'border-red-300 ring-2 ring-red-100' : ''} ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
        />
        {q && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            title="Clear bank selection"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {filteredBanks.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center flex flex-col items-center justify-center gap-1">
              <span>No pre-defined bank matching "{q}"</span>
              <span className="text-[11px] text-slate-400">Custom bank name will be saved on select</span>
            </div>
          ) : (
            filteredBanks.map((bankName) => {
              const isSelected = bankName.toLowerCase() === (value || '').toLowerCase()
              return (
                <div
                  key={bankName}
                  onClick={() => handleSelectBank(bankName)}
                  className={`px-3 py-2 cursor-pointer transition flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-[#2F6F5E] ${
                    isSelected ? 'bg-emerald-50 text-[#2F6F5E] font-semibold border-l-4 border-[#2F6F5E]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className={isSelected ? 'text-[#2F6F5E]' : 'text-slate-400'} />
                    <span>{bankName}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] bg-emerald-100 text-[#2F6F5E] px-1.5 py-0.5 rounded font-semibold">
                      Selected
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
