import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchInput from '../../components/SearchInput'
import { list, create, update, remove } from '../../mocks/deductions'
import { validateNameField } from '../../utils/validators'

export default function DeductionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})
  useEffect(() => { list().then(setRows) }, [])
  function refresh(){ list().then(setRows) }
  function onOpenCreate() { setErrors({}); setForm({code:'',name:'',amount:0,isLoan:false,isUniform:false,addOther:false}); setEditing(null); setOpen(true) }
  function onEdit(row:any){ setErrors({}); setForm(row); setEditing(row.code); setOpen(true) }
  function validate(){ const next: { code?: string; name?: string } = {}; if(!String(form.code || '').trim()) next.code='Code is required'; if(!String(form.name || '').trim()) { next.name='Name is required' } else { const nameError = validateNameField(String(form.name || ''), 'Deduction name'); if (nameError) next.name = nameError } setErrors(next); return Object.keys(next).length===0 }
  async function onSave(){ if(!validate()){ toast.error('Please complete the required fields'); return } try { if(editing) await update(editing, form); else await create(form); toast.success('Deduction saved'); setOpen(false); refresh() } catch (error) { console.error('Save deduction failed', error); toast.error('Failed to save deduction — please try again') } }
  function onDeleteConfirm(){ if(confirm){ remove(confirm).then(()=>{ setConfirm(null); refresh(); toast.success('Deduction deleted') }).catch(()=>toast.error('Failed to delete deduction — please try again')) } }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Deduction Types</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search deductions by code or name..." />
          <button className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md" onClick={onOpenCreate}>Add Deduction</button>
        </div>
      </div>

      <DataTable columns={[{key:'code',label:'Code',className:'mono-numeric'},{key:'name',label:'Name'},{key:'amount',label:'Amount',className:'mono-numeric'},{key:'badges',label:'Flags'},{key:'id',label:'Actions'}]} data={rows.filter(r=> (r.code + ' ' + r.name).toLowerCase().includes(q.toLowerCase())).map(r=>({code:r.code,name:r.name,amount:r.amount,badges:(r.isLoan? 'Loan ':'')+(r.isUniform? 'Uniform ':'')+(r.addOther? 'Other':''), id:r.code}))} onEdit={(id)=>{ const row = rows.find(r=>r.code===id); if(row) onEdit(row) }} onDelete={(id)=>setConfirm(id)} />

      <Modal title="Add / Edit Deduction" open={open} onClose={()=>setOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600">Code</label>
            <input className={`mt-1 w-full form-input mono-numeric ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`} value={form.code||''} onChange={e=>{ setForm({...form,code:e.target.value}); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }} />
            {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-600">Name</label>
            <input className={`mt-1 w-full form-input ${errors.name ? 'border-red-300 ring-2 ring-red-100' : ''}`} value={form.name||''} onChange={e=>{ setForm({...form,name:e.target.value}); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-600">Amount</label>
            <input type="number" className="mt-1 w-full form-input mono-numeric" value={form.amount||0} onChange={e=>setForm({...form,amount:Number(e.target.value)})} />
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={!!form.isLoan} onChange={v=>setForm({...form,isLoan:v})} label="Is Loan" />
            <Toggle checked={!!form.isUniform} onChange={v=>setForm({...form,isUniform:v})} label="Is Uniform" />
            <Toggle checked={!!form.addOther} onChange={v=>setForm({...form,addOther:v})} label="Add Other" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={()=>setOpen(false)} className="px-3 py-1 rounded-md border">Cancel</button>
            <button onClick={onSave} className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white">Save</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} title="Delete Deduction" message={`Delete ${confirm}?`} onConfirm={onDeleteConfirm} onCancel={()=>setConfirm(null)} />
    </div>
  )
}
