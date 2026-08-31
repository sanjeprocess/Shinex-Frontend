import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchInput from '../../components/SearchInput'
import api from '../../api/axios'
import { validateNameField } from '../../utils/validators'

const toUiRow = (item: any) => ({
  code: item.additionCode ?? item.code ?? '',
  name: item.additionName ?? item.name ?? '',
  value: Number(item.additionValue ?? item.value ?? 0),
  addToEpf: item.addToEpf === 'Y' || item.addToEpf === true || !!item.addToEpf,
  addToBasic: item.addToBasic === 'Y' || item.addToBasic === true || !!item.addToBasic,
  addOther: item.addOther === 'Y' || item.addOther === true || !!item.addOther
})

const toPayload = (form: any) => ({
  additionCode: String(form.code || '').trim(),
  additionName: String(form.name || '').trim(),
  additionValue: Number(form.value || 0),
  addToEpf: form.addToEpf ? 'Y' : 'N',
  addToBasic: form.addToBasic ? 'Y' : 'N',
  addOther: form.addOther ? 'Y' : 'N'
})

export default function AdditionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  const refresh = async () => {
    const res = await api.get('/master/additions')
    setRows((res.data || []).map(toUiRow))
  }

  useEffect(() => {
    refresh().catch((error) => {
      console.error('Load additions failed', error)
      toast.error('Failed to load additions')
    })
  }, [])

  function onOpenCreate() { setErrors({}); setForm({code:'',name:'',value:0,addToEpf:false,addToBasic:false,addOther:false}); setEditing(null); setOpen(true) }
  function onEdit(row:any){ setErrors({}); setForm(row); setEditing(row.code); setOpen(true) }
  function validate(){ const next: { code?: string; name?: string } = {}; if(!String(form.code || '').trim()) next.code='Code is required'; if(!String(form.name || '').trim()) { next.name='Name is required' } else { const nameError = validateNameField(String(form.name || ''), 'Addition name'); if (nameError) next.name = nameError } setErrors(next); return Object.keys(next).length===0 }

  async function onSave(){
    if(!validate()){ toast.error('Please complete the required fields'); return }
    try {
      const payload = toPayload(form)
      if(editing) {
        await api.put(`/master/additions/${encodeURIComponent(editing)}`, payload)
      } else {
        await api.post('/master/additions', payload)
      }
      toast.success('Addition saved')
      setOpen(false)
      await refresh()
    } catch (error) {
      console.error('Save addition failed', error)
      toast.error('Failed to save addition — please try again')
    }
  }

  async function onDeleteConfirm(){
    if(confirm){
      try {
        await api.delete(`/master/additions/${encodeURIComponent(confirm)}`)
        setConfirm(null)
        await refresh()
        toast.success('Addition deleted')
      } catch (error) {
        console.error('Delete addition failed', error)
        toast.error('Failed to delete addition — please try again')
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Addition Types</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search additions by code or name..." />
          <button className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md" onClick={onOpenCreate}>Add Addition</button>
        </div>
      </div>

      <DataTable columns={[{key:'code',label:'Code',className:'mono-numeric'},{key:'name',label:'Name'},{key:'value',label:'Value',className:'mono-numeric'},{key:'badges',label:'Flags'},{key:'id',label:'Actions'}]} data={rows.filter(r=> (r.code + ' ' + r.name).toLowerCase().includes(q.toLowerCase())).map(r=>({code:r.code,name:r.name,value:r.value,badges: (r.addToEpf? 'EPF ':'') + (r.addToBasic? 'Basic ':'') + (r.addOther? 'Other':''), id:r.code}))} onEdit={(id)=>{ const row = rows.find(r=>r.code===id); if(row) onEdit(row) }} onDelete={(id)=>setConfirm(id)} />

      <Modal title="Add / Edit Addition" open={open} onClose={()=>setOpen(false)}>
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
            <label className="block text-xs text-slate-600">Value</label>
            <input type="number" className="mt-1 w-full form-input mono-numeric" value={form.value||0} onChange={e=>setForm({...form,value:Number(e.target.value)})} />
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={!!form.addToEpf} onChange={v=>setForm({...form,addToEpf:v})} label="Add to EPF" />
            <Toggle checked={!!form.addToBasic} onChange={v=>setForm({...form,addToBasic:v})} label="Add to Basic" />
            <Toggle checked={!!form.addOther} onChange={v=>setForm({...form,addOther:v})} label="Add Other" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={()=>setOpen(false)} className="px-3 py-1 rounded-md border">Cancel</button>
            <button onClick={onSave} className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white">Save</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} title="Delete Addition" message={`Delete ${confirm}?`} onConfirm={onDeleteConfirm} onCancel={()=>setConfirm(null)} />
    </div>
  )
}
