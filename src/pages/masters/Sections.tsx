import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import NumericInput from '../../components/NumericInput'
import { list, create, update, remove, getNextSectionCode, Section } from '../../mocks/sections'
import { list as listEmployees } from '../../mocks/employees'
import { list as listBusinessCenters, BusinessCenter } from '../../mocks/businessCenters'

export default function SectionsPage() {
  const [rows, setRows] = useState<Section[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [businessCenters, setBusinessCenters] = useState<BusinessCenter[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [businessCenter, setBusinessCenter] = useState('')
  const [basicSalary, setBasicSalary] = useState<number | string>('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ code?: string; name?: string; basicSalary?: string }>({})

  const getActiveBc = () => {
    const raw = localStorage.getItem('hsb_active_bc') || '001'
    return raw.split(' / ')[0].trim()
  }

  const loadNextCode = async (bc?: string) => {
    try {
      const targetBc = bc || businessCenter || getActiveBc()
      const nextCode = await getNextSectionCode(targetBc)
      setCode(nextCode)
    } catch {
      setCode('001')
    }
  }

  useEffect(() => {
    refresh()
    listEmployees().then(setEmployees)
    listBusinessCenters().then(setBusinessCenters)
    loadNextCode()
  }, [])

  useEffect(() => {
    const handleBcChange = () => {
      refresh()
      listEmployees().then(setEmployees)
      if (!editing) loadNextCode()
    }
    window.addEventListener('hsb_bc_change', handleBcChange)
    window.addEventListener('storage', handleBcChange)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange)
      window.removeEventListener('storage', handleBcChange)
    }
  }, [editing])

  function refresh() {
    list().then(setRows)
    listEmployees().then(setEmployees)
  }

  function validate() {
    const next: { code?: string; name?: string; basicSalary?: string } = {}
    if (!code.trim()) next.code = 'Code is required'
    if (!name.trim()) {
      next.name = 'Section name is required'
    } else {
      const cleanName = name.trim().toLowerCase()
      const targetBc = (businessCenter || getActiveBc()).trim().toUpperCase()
      const duplicate = rows.find(r => {
        if (editing && r.code === editing) return false
        const rBc = (r.businessCenter || '').trim().toUpperCase()
        const isSameBc = !targetBc || targetBc === 'ALL' || !rBc || rBc === targetBc
        return isSameBc && (r.name || '').trim().toLowerCase() === cleanName
      })
      if (duplicate) {
        next.name = `A section named "${name.trim()}" already exists in this Business Center (Code: ${duplicate.code})`
      }
    }
    if (basicSalary !== '' && Number(basicSalary) < 0) {
      next.basicSalary = 'Basic salary cannot be negative'
    }
    setErrors(next)
    return Object.keys(next).length === 0 ? null : next
  }

  function resetForm() {
    setName('')
    setBusinessCenter('')
    setBasicSalary('')
    setEditing(null)
    setErrors({})
    loadNextCode()
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (errs) {
      toast.error(errs.name || errs.code || errs.basicSalary || 'Please complete the required fields')
      return
    }
    const targetBc = businessCenter || getActiveBc()
    const salaryVal = basicSalary === '' ? 0 : Number(basicSalary)
    create({ code: code.trim(), name: name.trim(), businessCenter: targetBc, basicSalary: salaryVal })
      .then(() => {
        resetForm()
        refresh()
        toast.success('Section added successfully')
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data : null) || err?.message || 'Failed to save section — please try again'
        toast.error(msg)
      })
  }

  function onEdit(row: Section) {
    setEditing(row.code)
    setCode(row.code)
    setName(row.name)
    setBusinessCenter(row.businessCenter || getActiveBc())
    setBasicSalary(row.basicSalary != null && row.basicSalary > 0 ? row.basicSalary : '')
    setErrors({})
  }

  function onSaveEdit() {
    if (!editing) return
    const errs = validate()
    if (errs) {
      toast.error(errs.name || errs.code || errs.basicSalary || 'Please complete the required fields')
      return
    }
    const targetBc = businessCenter || getActiveBc()
    const salaryVal = basicSalary === '' ? 0 : Number(basicSalary)
    update(editing, { code: code.trim(), name: name.trim(), businessCenter: targetBc, basicSalary: salaryVal })
      .then(() => {
        resetForm()
        refresh()
        toast.success('Section updated successfully')
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data : null) || err?.message || 'Failed to update section — please try again'
        toast.error(msg)
      })
  }

  function handleDeleteRequest(code: string) {
    const linkedEmployees = employees.filter(e => (e.sectionCode || '').trim() === code.trim() || (e.section || '').trim() === code.trim())
    if (linkedEmployees.length > 0) {
      toast.error(`Cannot delete section '${code}': ${linkedEmployees.length} active employee(s) are linked to this section.`)
      return
    }
    setConfirm(code)
  }

  function onDeleteConfirm() {
    if (!confirm) return
    const linkedEmployees = employees.filter(e => (e.sectionCode || '').trim() === confirm.trim() || (e.section || '').trim() === confirm.trim())
    if (linkedEmployees.length > 0) {
      toast.error(`Cannot delete section '${confirm}': ${linkedEmployees.length} active employee(s) are linked to this section.`)
      setConfirm(null)
      return
    }
    remove(confirm)
      .then(() => {
        setConfirm(null)
        refresh()
        toast.success('Section deleted')
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data : null) || 'Cannot delete section linked to employees'
        toast.error(String(msg))
        setConfirm(null)
      })
  }

  const [q, setQ] = useState('')

  const tableData = rows
    .filter(r => {
      const searchTarget = `${r.code} ${r.name} ${r.businessCenter || ''} ${r.basicSalary || ''}`.toLowerCase()
      return searchTarget.includes(q.toLowerCase().trim())
    })
    .map(r => {
      const empCount = employees.filter(e => e.sectionCode === r.code).length
      return {
        code: r.code,
        name: r.name,
        businessCenter: (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {r.businessCenter || getActiveBc()}
          </span>
        ),
        basicSalary: (
          <span className="mono-numeric font-medium text-slate-800">
            {r.basicSalary != null && Number(r.basicSalary) > 0
              ? `Rs. ${Number(r.basicSalary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </span>
        ),
        empCount: String(empCount) + (empCount === 1 ? ' Employee' : ' Employees'),
        id: r.code
      }
    })

  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false)
  const nameContainerRef = React.useRef<HTMLDivElement>(null)

  const standardSectionSuggestions = [
    'Janitor',
    'Supervisor',
    'Area Managers',
    'Head Office Staff',
    'Packing Floor',
    'Cutting Floor',
    'Production Floor',
    'Quality Assurance',
    'Machine Operator',
    'Maintenance',
    'Security',
    'Warehouse & Dispatch',
    'Driver',
    'Office Administration',
    'Accountant',
    'General Helper'
  ]

  const suggestedNames = React.useMemo(() => {
    const existing = rows.map(r => r.name.trim()).filter(Boolean)
    const combined = Array.from(new Set([...standardSectionSuggestions, ...existing]))
    if (!name.trim()) return combined
    const lower = name.toLowerCase().trim()
    return combined.filter(n => n.toLowerCase().includes(lower))
  }, [rows, name])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nameContainerRef.current && !nameContainerRef.current.contains(e.target as Node)) {
        setIsNameDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Employee Sections</h2>
          <p className="text-xs text-slate-500">Manage organizational sections isolated by Business Center Code</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search sections by code, name, or BC..." />
        </div>
      </div>

      <form className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-4 rounded-xl shadow-flat border border-slate-200/80" onSubmit={editing ? (e) => { e.preventDefault(); onSaveEdit() } : onAdd}>
        <div>
          <label className="block text-xs text-slate-600 font-medium flex items-center justify-between">
            <span>Code <span className="text-red-500">*</span></span>
            {!editing && <span className="text-[10px] text-[#2F6F5E] font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Auto-generated</span>}
          </label>
          <input
            value={code}
            disabled={!!editing}
            onChange={e => { setCode(e.target.value); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }}
            className={'mt-1 w-full form-input mono-numeric ' + (errors.code ? 'border-red-300 ring-2 ring-red-100' : '')}
            placeholder="e.g. 001"
          />
          {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
        </div>
        <div ref={nameContainerRef} className="relative">
          <label className="block text-xs text-slate-600 font-medium flex items-center justify-between">
            <span>Section Name <span className="text-red-500">*</span></span>
            <span className="text-[10px] text-slate-400">Search or Type</span>
          </label>
          <input
            value={name}
            onFocus={() => setIsNameDropdownOpen(true)}
            onChange={e => {
              setName(e.target.value)
              setIsNameDropdownOpen(true)
              if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
            }}
            className={'mt-1 w-full form-input ' + (errors.name ? 'border-red-300 ring-2 ring-red-100' : '')}
            placeholder="Search / type section name..."
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}

          {isNameDropdownOpen && suggestedNames.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
              {suggestedNames.map((sName) => {
                const matchingExisting = rows.find(r => r.name.toLowerCase() === sName.toLowerCase())
                return (
                  <div
                    key={sName}
                    onClick={() => {
                      setName(sName)
                      if (matchingExisting && matchingExisting.basicSalary && (!basicSalary || basicSalary === 0)) {
                        setBasicSalary(matchingExisting.basicSalary)
                      }
                      setIsNameDropdownOpen(false)
                      if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
                    }}
                    className="px-3 py-2 cursor-pointer hover:bg-emerald-50 text-xs text-slate-800 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">{sName}</span>
                    {matchingExisting && matchingExisting.basicSalary ? (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mono-numeric">
                        Preset: Rs. {Number(matchingExisting.basicSalary).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Preset</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Business Center</label>
          <select
            value={businessCenter || getActiveBc()}
            onChange={e => {
              const newBc = e.target.value;
              setBusinessCenter(newBc);
              if (!editing) loadNextCode(newBc);
            }}
            className="mt-1 w-full form-input"
          >
            {businessCenters.map(bc => (
              <option key={bc.code} value={bc.code}>
                {bc.code} - {bc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Basic Salary (Rs.)</label>
          <NumericInput
            value={basicSalary}
            onChange={e => {
              setBasicSalary(e.target.value)
              if (errors.basicSalary) setErrors(prev => ({ ...prev, basicSalary: undefined }))
            }}
            placeholder="0.00"
            className={'mt-1 w-full form-input mono-numeric ' + (errors.basicSalary ? 'border-red-300 ring-2 ring-red-100' : '')}
          />
          {errors.basicSalary && <p className="mt-1 text-xs text-red-500">{errors.basicSalary}</p>}
        </div>
        <div className="flex items-end gap-2">
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 font-medium text-sm flex-1 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          <button type="submit" className="px-4 py-2 rounded-md bg-[#2F6F5E] text-white font-medium text-sm flex-1 hover:bg-[#25584a] shadow-sm">
            {editing ? 'Save Changes' : 'Add Section'}
          </button>
        </div>
      </form>

      <DataTable
        columns={[
          { key: 'code', label: 'Code', className: 'mono-numeric font-medium' },
          { key: 'name', label: 'Section Name' },
          { key: 'businessCenter', label: 'Business Center' },
          { key: 'basicSalary', label: 'Basic Salary (Rs.)', className: 'mono-numeric font-medium' },
          { key: 'empCount', label: 'Employee Count', className: 'mono-numeric font-semibold text-[#2F6F5E]' },
          { key: 'id', label: 'Actions' }
        ]}
        data={tableData}
        onEdit={(id) => {
          const row = rows.find(r => r.code === id)
          if (row) onEdit(row)
        }}
        onDelete={handleDeleteRequest}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Delete Section"
        message={'Delete section ' + confirm + '?'}
        onConfirm={onDeleteConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

