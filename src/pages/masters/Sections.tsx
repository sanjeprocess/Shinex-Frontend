import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import { list, create, update, remove, sections, Section } from '../../mocks/sections'

export default function SectionsPage() {
  const [rows, setRows] = useState<Section[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  useEffect(() => { list().then(setRows) }, [])

  function refresh() { list().then(setRows) }
  function validate() {
    const next: { code?: string; name?: string } = {}
    if (!code.trim()) next.code = 'Code is required'
    if (!name.trim()) next.name = 'Name is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  function onAdd(e: React.FormEvent) { e.preventDefault(); if (!validate()) { toast.error('Please complete the required fields'); return }; create({code,name}).then(()=>{ setCode(''); setName(''); setErrors({}); refresh(); toast.success('Section added') }).catch(()=>toast.error('Failed to save section — please try again')) }
  function onEdit(row: Section) { setEditing(row.code); setCode(row.code); setName(row.name); setErrors({}) }
  function onSaveEdit() { if (!editing) return; if (!validate()) { toast.error('Please complete the required fields'); return }; update(editing,{code, name}).then(()=>{ setEditing(null); setCode(''); setName(''); setErrors({}); refresh(); toast.success('Section updated') }).catch(()=>toast.error('Failed to update section — please try again')) }
  function onDeleteConfirm() { if (confirm) remove(confirm).then(()=>{ setConfirm(null); refresh(); toast.success('Section deleted') }).catch(()=>toast.error('Failed to delete section — please try again')) }

  const [q, setQ] = useState('')
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Employee Sections</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search sections by code or name..." />
        </div>
      </div>

      <form className="mb-4 grid grid-cols-3 gap-2" onSubmit={editing? (e)=>{ e.preventDefault(); onSaveEdit() } : onAdd}>
        <div>
          <label className="block text-xs text-slate-600">Code</label>
          <input value={code} onChange={e=>{ setCode(e.target.value); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }} className={`mt-1 w-full form-input mono-numeric ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="e.g. 001" />
          {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-600">Name</label>
          <input value={name} onChange={e=>{ setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }} className={`mt-1 w-full form-input ${errors.name ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="e.g. Janitor" />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>
        <div className="col-span-3 text-right">
          <button type="submit" className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white">{editing ? 'Save' : 'Add Section'}</button>
        </div>
      </form>

      <DataTable columns={[{key:'code',label:'Code',className:'mono-numeric'},{key:'name',label:'Name'},{key:'id',label:'Actions'}]} data={rows.filter(r=> (r.code + ' ' + r.name).toLowerCase().includes(q.toLowerCase())).map(r=>({code:r.code,name:r.name,id:r.code}))} onEdit={(id)=>{ const row = rows.find(r=>r.code===id); if(row) onEdit(row) }} onDelete={(id)=>setConfirm(id)} />

      <ConfirmDialog open={!!confirm} title="Delete Section" message={`Delete ${confirm}?`} onConfirm={onDeleteConfirm} onCancel={()=>setConfirm(null)} />
    </div>
  )
}
