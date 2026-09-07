import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { list, create, update, remove, BusinessCenter } from '../../mocks/businessCenters'
import SearchInput from '../../components/SearchInput'
import { validateNameField } from '../../utils/validators'

export default function BusinessCentersPage() {
  const [rows, setRows] = useState<BusinessCenter[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<BusinessCenter>>({})
  const [deleting, setDeleting] = useState<{code:string|null} | null>(null)
  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  useEffect(() => { list().then(setRows) }, [])

  function refresh() { list().then(setRows) }
  function onOpenCreate() { setErrors({}); setForm({}); setOpen(true) }
  function onEdit(r: BusinessCenter) { setErrors({}); setForm(r); setOpen(true) }
  function validate() {
    const next: { code?: string; name?: string } = {}
    if (!String(form.code || '').trim()) next.code = 'Code is required'
    if (!String(form.name || '').trim()) {
      next.name = 'Name is required'
    } else {
      const nameError = validateNameField(String(form.name || ''), 'Business center name')
      if (nameError) next.name = nameError
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }
  async function onSave() {
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }
    try {
      const normalizedForm = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      ) as Partial<BusinessCenter>
      normalizedForm.code = String(normalizedForm.code || '').slice(0, 10)
      const exists = rows.some(r=>r.code===normalizedForm.code)
      if (exists) await update(normalizedForm.code, normalizedForm)
      else await create(normalizedForm as BusinessCenter)
      toast.success('Business center saved')
      setOpen(false); refresh()
    } catch (error) {
      console.error('Save business center failed', error)
      toast.error('Failed to save business center — please try again')
    }
  }
  function onDeleteConfirm() {
    if (deleting?.code) {
      remove(deleting.code).then(()=>{ setDeleting(null); refresh(); toast.success('Business center deleted') }).catch(()=>toast.error('Failed to delete business center — please try again'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Business Centers</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search business centers by code or name..." />
          <button className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md btn-press" onClick={onOpenCreate}>Add Business Center</button>
        </div>
      </div>

      <DataTable columns={[{key:'code',label:'Code',className:'mono-numeric'},{key:'name',label:'Name'},{key:'tel',label:'Tel'},{key:'email',label:'Email'},{key:'id',label:'Actions'}]} data={rows.filter(r=> ((r.code || '') + ' ' + (r.name || '')).toLowerCase().includes(q.toLowerCase())).map(r=>({code:r.code || '',name:r.name || '',tel:r.tel || '',email:r.email || '',id:r.code || '' }))} onEdit={(id)=>{ const row = rows.find(r=>r.code===id); if(row) onEdit(row) }} onDelete={(id)=>setDeleting({code:id})} />

      <Modal title="Add / Edit Business Center" open={open} onClose={() => setOpen(false)}>
        <div className="min-h-0 flex flex-col">
          <div className="min-h-0 max-h-[calc(85vh-9rem)] overflow-y-auto overscroll-contain px-1 pb-2 space-y-3 smooth-scroll">
          <div>
            <label className="block text-xs text-slate-600">Code</label>
            <input maxLength={10} className={`mt-1 w-full form-input mono-numeric ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`} value={form.code || ''} onChange={e=>{ setForm({...form,code:e.target.value.slice(0, 10)}); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }} />
            {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-600">Name</label>
            <input className={`mt-1 w-full form-input ${errors.name ? 'border-red-300 ring-2 ring-red-100' : ''}`} value={form.name || ''} onChange={e=>{ setForm({...form,name:e.target.value}); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-600">Address</label>
                      <input className="mt-1 w-full form-input" value={form.address || ''} onChange={e=>setForm({...form,address:e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-slate-600">Tel No</label>
                      <input className="mt-1 w-full form-input" value={form.tel || ''} onChange={e=>setForm({...form,tel:e.target.value.replace(/[^0-9+]/g, '')})} />
          </div>
          <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600">Fax No</label>
                        <input className="mt-1 w-full form-input" value={form.fax || ''} onChange={e=>setForm({...form,fax:e.target.value.replace(/[^0-9+]/g, '')})} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600">Web Address</label>
                        <input className="mt-1 w-full form-input" value={form.web || ''} onChange={e=>setForm({...form,web:e.target.value})} />
                      </div>
          </div>

          <div className="mt-3">
                      <h4 className="text-sm font-medium">Registration Numbers</h4>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <label className="block text-xs text-slate-600">EPF Reg No</label>
                          <input className="mt-1 w-full form-input mono-numeric" value={form.epfReg || ''} onChange={e=>setForm({...form,epfReg:e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600">VAT Reg No</label>
                          <input className="mt-1 w-full form-input" value={form.vatReg || ''} onChange={e=>setForm({...form,vatReg:e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600">BR No</label>
                          <input className="mt-1 w-full form-input" value={form.brNo || ''} onChange={e=>setForm({...form,brNo:e.target.value})} />
                        </div>
                      </div>
          </div>

          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t bg-white pt-4 mt-2">
            <button type="button" onClick={()=>setOpen(false)} className="px-3 py-1 rounded-md border">Cancel</button>
            <button type="button" onClick={onSave} className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white">Save</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Business Center" message={`Delete ${deleting?.code}?`} onConfirm={onDeleteConfirm} onCancel={()=>setDeleting(null)} />
    </div>
  )
}
