import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import { list, create, update, remove, Section } from '../../mocks/sections'
import { list as listEmployees } from '../../mocks/employees'
import { validateNameField } from '../../utils/validators'

export default function SectionsPage() {
  const [rows, setRows] = useState<Section[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  useEffect(() => {
    refresh()
    listEmployees().then(setEmployees)
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
    create({ code, name })
      .then(() => {
        setCode('')
        setName('')
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
    setErrors({})
  }

  function onSaveEdit() {
    if (!editing) return
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }
    update(editing, { code, name })
      .then(() => {
        setEditing(null)
        setCode('')
        setName('')
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
    .filter(r => (r.code + ' ' + r.name).toLowerCase().includes(q.toLowerCase()))
    .map(r => {
      const empCount = employees.filter(e => e.sectionCode === r.code).length
      return {
        code: r.code,
        name: r.name,
        empCount: `${empCount} Employee${empCount === 1 ? '' : 's'}`,
        id: r.code
      }
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Employee Sections</h2>
          <p className="text-xs text-slate-500">Manage organizational sections and view employee count per section</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search sections by code or name..." />
        </div>
      </div>

      <form className="mb-4 grid grid-cols-3 gap-2" onSubmit={editing ? (e) => { e.preventDefault(); onSaveEdit() } : onAdd}>
        <div>
          <label className="block text-xs text-slate-600 font-medium">Code</label>
          <input
            value={code}
            onChange={e => { setCode(e.target.value); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }}
            className={`mt-1 w-full form-input mono-numeric ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`}
            placeholder="e.g. 001"
          />
          {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-600 font-medium">Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }}
            className={`mt-1 w-full form-input ${errors.name ? 'border-red-300 ring-2 ring-red-100' : ''}`}
            placeholder="e.g. Janitor"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>
        <div className="col-span-3 text-right">
          <button type="submit" className="px-3.5 py-1.5 rounded-md bg-[#2F6F5E] text-white font-medium text-sm">
            {editing ? 'Save Changes' : 'Add Section'}
          </button>
        </div>
      </form>

      <DataTable
        columns={[
          { key: 'code', label: 'Code', className: 'mono-numeric font-medium' },
          { key: 'name', label: 'Section Name' },
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
        message={`Delete section ${confirm}?`}
        onConfirm={onDeleteConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
