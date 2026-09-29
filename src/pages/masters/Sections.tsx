import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import { list, create, update, remove, Section } from '../../mocks/sections'
import { list as listEmployees } from '../../mocks/employees'
import { list as listBusinessCenters, BusinessCenter } from '../../mocks/businessCenters'
import { validateNameField } from '../../utils/validators'

export default function SectionsPage() {
  const [rows, setRows] = useState<Section[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [businessCenters, setBusinessCenters] = useState<BusinessCenter[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [businessCenter, setBusinessCenter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  const getActiveBc = () => {
    const raw = localStorage.getItem('hsb_active_bc') || '001'
    return raw.split(' / ')[0].trim()
  }

  useEffect(() => {
    refresh()
    listEmployees().then(setEmployees)
    listBusinessCenters().then(setBusinessCenters)
  }, [])

  useEffect(() => {
    const handleBcChange = () => {
      refresh()
      listEmployees().then(setEmployees)
    }
    window.addEventListener('hsb_bc_change', handleBcChange)
    window.addEventListener('storage', handleBcChange)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange)
      window.removeEventListener('storage', handleBcChange)
    }
  }, [])

  function refresh() {
    list().then(setRows)
    listEmployees().then(setEmployees)
  }

  function validate() {
    const next: { code?: string; name?: string } = {}
    if (!code.trim()) next.code = 'Code is required'
    if (!name.trim()) {
      next.name = 'Name is required'
    } else {
      const nameError = validateNameField(name, 'Section name')
      if (nameError) next.name = nameError
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }
    const targetBc = businessCenter || getActiveBc()
    create({ code, name, businessCenter: targetBc })
      .then(() => {
        setCode('')
        setName('')
        setBusinessCenter('')
        setErrors({})
        refresh()
        toast.success('Section added')
      })
      .catch(() => toast.error('Failed to save section — please try again'))
  }

  function onEdit(row: Section) {
    setEditing(row.code)
    setCode(row.code)
    setName(row.name)
    setBusinessCenter(row.businessCenter || getActiveBc())
    setErrors({})
  }

  function onSaveEdit() {
    if (!editing) return
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }
    const targetBc = businessCenter || getActiveBc()
    update(editing, { code, name, businessCenter: targetBc })
      .then(() => {
        setEditing(null)
        setCode('')
        setName('')
        setBusinessCenter('')
        setErrors({})
        refresh()
        toast.success('Section updated')
      })
      .catch(() => toast.error('Failed to update section — please try again'))
  }

  function onDeleteConfirm() {
    if (confirm)
      remove(confirm)
        .then(() => {
          setConfirm(null)
          refresh()
          toast.success('Section deleted')
        })
        .catch(() => toast.error('Failed to delete section — please try again'))
  }

  const [q, setQ] = useState('')

  const tableData = rows
    .filter(r => (r.code + ' ' + r.name + ' ' + (r.businessCenter || '')).toLowerCase().includes(q.toLowerCase()))
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
        empCount: String(empCount) + (empCount === 1 ? ' Employee' : ' Employees'),
        id: r.code
      }
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Employee Sections</h2>
          <p className="text-xs text-slate-500">Manage organizational sections isolated by Business Center</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search sections by code, name, or BC..." />
        </div>
      </div>

      <form className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl shadow-flat border border-slate-200/80" onSubmit={editing ? (e) => { e.preventDefault(); onSaveEdit() } : onAdd}>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Code</label>
          <input
            value={code}
            disabled={!!editing}
            onChange={e => { setCode(e.target.value); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }}
            className={'mt-1 w-full form-input mono-numeric ' + (errors.code ? 'border-red-300 ring-2 ring-red-100' : '')}
            placeholder="e.g. 001"
          />
          {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }}
            className={'mt-1 w-full form-input ' + (errors.name ? 'border-red-300 ring-2 ring-red-100' : '')}
            placeholder="e.g. Production Floor"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Business Center</label>
          <select
            value={businessCenter || getActiveBc()}
            onChange={e => setBusinessCenter(e.target.value)}
            className="mt-1 w-full form-input"
          >
            {businessCenters.map(bc => (
              <option key={bc.code} value={bc.code}>
                {bc.code} - {bc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(null); setCode(''); setName(''); setBusinessCenter(''); }}
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
          { key: 'empCount', label: 'Employee Count', className: 'mono-numeric font-semibold text-[#2F6F5E]' },
          { key: 'id', label: 'Actions' }
        ]}
        data={tableData}
        onEdit={(id) => {
          const row = rows.find(r => r.code === id)
          if (row) onEdit(row)
        }}
        onDelete={(id) => setConfirm(id)}
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
