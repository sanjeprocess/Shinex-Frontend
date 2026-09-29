import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import NumericInput from '../../components/NumericInput'
import SearchInput from '../../components/SearchInput'
import { list, create, update, remove, DeductionType } from '../../mocks/deductions'
import { list as listBusinessCenters, BusinessCenter } from '../../mocks/businessCenters'
import { validateNameField } from '../../utils/validators'

const getActiveBc = () => {
  const raw = localStorage.getItem('hsb_active_bc') || '001'
  return raw.split(' / ')[0].trim()
}

export default function DeductionsPage() {
  const [rows, setRows] = useState<DeductionType[]>([])
  const [businessCenters, setBusinessCenters] = useState<BusinessCenter[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<DeductionType>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

  const refresh = async () => {
    const data = await list()
    setRows(data)
  }

  useEffect(() => {
    refresh()
    listBusinessCenters().then(setBusinessCenters)
  }, [])

  useEffect(() => {
    const handleBcChange = () => {
      refresh()
    }
    window.addEventListener('hsb_bc_change', handleBcChange)
    window.addEventListener('storage', handleBcChange)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange)
      window.removeEventListener('storage', handleBcChange)
    }
  }, [])

  function onOpenCreate() {
    setErrors({})
    setForm({
      code: '',
      name: '',
      amount: 0,
      isLoan: false,
      isUniform: false,
      addOther: false,
      businessCenter: getActiveBc()
    })
    setEditing(null)
    setOpen(true)
  }

  function onEdit(row: DeductionType) {
    setErrors({})
    setForm({ ...row, businessCenter: row.businessCenter || getActiveBc() })
    setEditing(row.code)
    setOpen(true)
  }

  function validate() {
    const next: { code?: string; name?: string } = {}
    if (!String(form.code || '').trim()) next.code = 'Code is required'
    if (!String(form.name || '').trim()) {
      next.name = 'Name is required'
    } else {
      const nameError = validateNameField(String(form.name || ''), 'Deduction name')
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
      const payload: DeductionType = {
        code: String(form.code || '').trim(),
        name: String(form.name || '').trim(),
        amount: Number(form.amount || 0),
        isLoan: !!form.isLoan,
        isUniform: !!form.isUniform,
        addOther: !!form.addOther,
        businessCenter: form.businessCenter || getActiveBc()
      }

      if (editing) {
        await update(editing, payload)
      } else {
        await create(payload)
      }
      toast.success('Deduction saved')
      setOpen(false)
      await refresh()
    } catch (error) {
      console.error('Save deduction failed', error)
      toast.error('Failed to save deduction — please try again')
    }
  }

  async function onDeleteConfirm() {
    if (confirm) {
      try {
        await remove(confirm)
        setConfirm(null)
        await refresh()
        toast.success('Deduction deleted')
      } catch (error) {
        console.error('Delete deduction failed', error)
        toast.error('Failed to delete deduction — please try again')
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Deduction Types</h2>
          <p className="text-xs text-slate-500">Manage deduction types isolated by Business Center</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search deductions by code or name..." />
          <button className="bg-[#2F6F5E] text-white px-3.5 py-1.5 rounded-md font-medium text-sm hover:bg-[#25584a] shadow-sm" onClick={onOpenCreate}>
            + Add Deduction
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'code', label: 'Code', className: 'mono-numeric font-medium' },
          { key: 'name', label: 'Name' },
          { key: 'amount', label: 'Default Amount', className: 'mono-numeric' },
          { key: 'businessCenter', label: 'Business Center' },
          { key: 'badges', label: 'Flags' },
          { key: 'id', label: 'Actions' }
        ]}
        data={rows
          .filter(r => (r.code + ' ' + r.name + ' ' + (r.businessCenter || '')).toLowerCase().includes(q.toLowerCase()))
          .map(r => ({
            code: r.code,
            name: r.name,
            amount: r.amount,
            businessCenter: (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                {r.businessCenter || getActiveBc()}
              </span>
            ),
            badges: (
              <div className="flex gap-1">
                {r.isLoan && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Loan</span>}
                {r.isUniform && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">Uniform</span>}
                {r.addOther && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">Other</span>}
              </div>
            ),
            id: r.code
          }))}
        onEdit={(id) => {
          const row = rows.find(r => r.code === id)
          if (row) onEdit(row)
        }}
        onDelete={(id) => setConfirm(id)}
      />

      <Modal title={editing ? "Edit Deduction Type" : "Add Deduction Type"} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 font-medium">Code</label>
              <input
                disabled={!!editing}
                className={'mt-1 w-full form-input mono-numeric ' + (errors.code ? 'border-red-300 ring-2 ring-red-100' : '')}
                value={form.code || ''}
                onChange={e => { setForm({ ...form, code: e.target.value }); if (errors.code) setErrors(prev => ({ ...prev, code: undefined })) }}
                placeholder="e.g. UNIFORM_DUD"
              />
              {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-600 font-medium">Business Center</label>
              <select
                value={form.businessCenter || getActiveBc()}
                onChange={e => setForm({ ...form, businessCenter: e.target.value })}
                className="mt-1 w-full form-input"
              >
                {businessCenters.map(bc => (
                  <option key={bc.code} value={bc.code}>
                    {bc.code} - {bc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-medium">Name</label>
            <input
              className={'mt-1 w-full form-input ' + (errors.name ? 'border-red-300 ring-2 ring-red-100' : '')}
              value={form.name || ''}
              onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }}
              placeholder="e.g. Uniform Deduction"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-medium">Default Amount (LKR)</label>
            <NumericInput
              className="mt-1 w-full form-input mono-numeric"
              value={form.amount || 0}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4">
            <Toggle checked={!!form.isLoan} onChange={v => setForm({ ...form, isLoan: v })} label="Is Loan" />
            <Toggle checked={!!form.isUniform} onChange={v => setForm({ ...form, isUniform: v })} label="Is Uniform" />
            <Toggle checked={!!form.addOther} onChange={v => setForm({ ...form, addOther: v })} label="Add Other" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-md border text-sm">Cancel</button>
            <button onClick={onSave} className="px-3.5 py-1.5 rounded-md bg-[#2F6F5E] text-white text-sm font-medium hover:bg-[#25584a]">Save Deduction</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} title="Delete Deduction" message={'Are you sure you want to delete deduction type ' + confirm + '?'} onConfirm={onDeleteConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
