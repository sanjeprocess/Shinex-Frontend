import React, { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { FileText, Image as ImageIcon, Upload, X, Building, CheckCircle2 } from 'lucide-react'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import NumericInput from '../../components/NumericInput'
import { list, create, update, remove, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { validateNameField } from '../../utils/validators'
import { PROFIT_CENTERS } from '../../constants/profitCenters'

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([])
  const [bcList, setBcList] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string; contactName?: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    list().then(setRows).catch(console.error)
  }

  useEffect(() => {
    refresh()
    listBC().then(setBcList).catch(console.error)
    const handleBcChange = () => refresh()
    window.addEventListener('hsb_bc_change', handleBcChange)
    window.addEventListener('storage', handleBcChange)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange)
      window.removeEventListener('storage', handleBcChange)
    }
  }, [])

  function onOpenCreate() {
    const activeBc = localStorage.getItem('hsb_active_bc') || '001'
    setErrors({})
    setForm({
      code: '',
      name: '',
      profitCenter: '',
      businessCenter: activeBc.split(' / ')[0].trim(),
      address1: '',
      address2: '',
      address3: '',
      email: '',
      contactName: '',
      contactNo: '',
      workingDays: '',
      otAuto: false,
      minStaffQty: '',
      attendanceAllowance: '',
      daysToWorkForAllowance: '',
      documentUrl: ''
    })
    setEditing(null)
    setOpen(true)
  }

  function onEdit(row: Customer) {
    setErrors({})
    setForm({ ...row })
    setEditing(row.code)
    setOpen(true)
  }

  function validate() {
    const next: { code?: string; name?: string; contactName?: string } = {}
    if (!String(form.code || '').trim()) next.code = 'Code is required'
    if (!String(form.name || '').trim()) {
      next.name = 'Name is required'
    } else {
      const nameError = validateNameField(String(form.name || ''), 'Name')
      if (nameError) next.name = nameError
    }
    const contactNameError = validateNameField(String(form.contactName || ''), 'Contact name')
    if (contactNameError) next.contactName = contactNameError
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSave() {
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }
    try {
      if (editing) await update(editing, form)
      else await create(form)
      toast.success('Plant saved successfully')
      setOpen(false)
      refresh()
    } catch (error) {
      console.error('Save plant failed', error)
      toast.error('Failed to save plant — please try again')
    }
  }

  function onDeleteConfirm() {
    if (confirm) {
      remove(confirm)
        .then(() => {
          setConfirm(null)
          refresh()
          toast.success('Plant deleted')
        })
        .catch(() => toast.error('Failed to delete plant — please try again'))
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setForm((prev: any) => ({ ...prev, documentUrl: base64 }))
      toast.success(`Attached ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  const activeBc = localStorage.getItem('hsb_active_bc') || 'All'

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Customers / Plants Master</h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building size={14} className="text-teal-600" />
            Filtered by Active Business Center: <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{activeBc}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search plants by code, name, profit center..." />
          <button className="bg-[#2F6F5E] hover:bg-[#265b4d] text-white px-3.5 py-1.5 rounded-md font-medium text-sm transition shadow-sm flex items-center gap-1.5" onClick={onOpenCreate}>
            <span>+ Add Plant</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'code', label: 'Plant Code', className: 'mono-numeric font-medium' },
          { key: 'name', label: 'Plant Name' },
          { key: 'profitCenter', label: 'Profit Center' },
          { key: 'businessCenter', label: 'Business Center' },
          { key: 'contactName', label: 'Contact Name' },
          { key: 'contactNo', label: 'Contact No' },
          {
            key: 'doc',
            label: 'Attachment',
            render: (_: any, r: Customer) => (
              r.documentUrl ? (
                r.documentUrl.startsWith('data:image') ? (
                  <img src={r.documentUrl} alt="Plant" className="w-8 h-8 object-cover rounded border border-slate-200 shadow-xs" />
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs border border-blue-200 font-medium">
                    <FileText size={12} /> Doc Attached
                  </span>
                )
              ) : (
                <span className="text-slate-400 text-xs italic">None</span>
              )
            )
          },
          { key: 'id', label: 'Actions' }
        ]}
        data={rows
          .filter(r => (r.code + ' ' + r.name + ' ' + (r.contactName || '') + ' ' + (r.profitCenter || '') + ' ' + (r.businessCenter || '')).toLowerCase().includes(q.toLowerCase()))
          .map(r => ({
            code: r.code,
            name: r.name,
            profitCenter: r.profitCenter || '—',
            businessCenter: r.businessCenter || '—',
            contactName: r.contactName || '—',
            contactNo: r.contactNo || '—',
            documentUrl: r.documentUrl,
            id: r.code
          }))}
        onEdit={(id) => {
          const row = rows.find(r => r.code === id)
          if (row) onEdit(row)
        }}
        onDelete={(id) => setConfirm(id)}
      />

      <Modal title={editing ? `Edit Plant: ${editing}` : 'Add New Plant / Customer'} open={open} onClose={() => setOpen(false)}>
        <div className="max-h-[72vh] overflow-y-auto overscroll-contain scroll-smooth plant-form-scroll pr-1 space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plant Code *</label>
              <input
                className={`mt-1 w-full form-input mono-numeric ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                value={form.code || ''}
                disabled={!!editing}
                placeholder="e.g. PL001"
                onChange={e => {
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                  if (errors.code) setErrors(prev => ({ ...prev, code: undefined }))
                }}
              />
              {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Profit Center</label>
              <select
                className="mt-1 w-full form-input text-xs"
                value={form.profitCenter || ''}
                onChange={e => setForm({ ...form, profitCenter: e.target.value })}
              >
                <option value="">Select Profit Center</option>
                {PROFIT_CENTERS.map(pc => (
                  <option key={pc} value={pc}>
                    {pc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Business Center</label>
              <select
                className="mt-1 w-full form-input text-xs"
                value={form.businessCenter || ''}
                onChange={e => setForm({ ...form, businessCenter: e.target.value })}
              >
                {bcList.map(bc => (
                  <option key={bc.code || bc.id} value={bc.code || bc.id}>
                    {bc.code} - {bc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Plant / Customer Name *</label>
            <input
              className={`mt-1 w-full form-input ${errors.name ? 'border-red-300 ring-2 ring-red-100' : ''}`}
              value={form.name || ''}
              placeholder="e.g. Shinex Processing Plant A"
              onChange={e => {
                setForm({ ...form, name: e.target.value })
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
              }}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Document / Image Upload Section */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-teal-600" />
              Plant Image / Document Attachment
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />

            {form.documentUrl ? (
              <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-200">
                {form.documentUrl.startsWith('data:image') ? (
                  <img src={form.documentUrl} alt="Preview" className="w-12 h-12 object-cover rounded border" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded border">
                    <FileText size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Document Loaded
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">Ready to save with record</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev: any) => ({ ...prev, documentUrl: '' }))}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Remove document"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-3 text-center transition bg-white cursor-pointer group"
              >
                <Upload size={18} className="mx-auto text-slate-400 group-hover:text-teal-600 mb-1" />
                <span className="text-xs text-slate-600 group-hover:text-teal-700 font-medium">Click to upload plant photo, blueprint, or compliance doc</span>
                <span className="block text-[10px] text-slate-400">PNG, JPG, PDF up to 5MB</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Name</label>
              <input
                className={`mt-1 w-full form-input ${errors.contactName ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                value={form.contactName || ''}
                placeholder="e.g. John Doe"
                onChange={e => {
                  setForm({ ...form, contactName: e.target.value })
                  if (errors.contactName) setErrors(prev => ({ ...prev, contactName: undefined }))
                }}
              />
              {errors.contactName && <p className="mt-1 text-xs text-red-500">{errors.contactName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact No</label>
              <input
                className="mt-1 w-full form-input mono-numeric"
                value={form.contactNo || ''}
                placeholder="e.g. 0771234567"
                onChange={e => setForm({ ...form, contactNo: e.target.value.replace(/[^0-9+]/g, '') })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-600">Address Line 1</label>
              <input className="mt-1 w-full form-input text-xs" value={form.address1 || ''} onChange={e => setForm({ ...form, address1: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Address Line 2</label>
              <input className="mt-1 w-full form-input text-xs" value={form.address2 || ''} onChange={e => setForm({ ...form, address2: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Address Line 3</label>
              <input className="mt-1 w-full form-input text-xs" value={form.address3 || ''} onChange={e => setForm({ ...form, address3: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600">Email Address</label>
              <input type="email" className="mt-1 w-full form-input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Standard Working Days</label>
              <NumericInput integer className="mt-1 w-full form-input mono-numeric" value={form.workingDays ?? ''} onChange={e => setForm({ ...form, workingDays: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-1">
            <input type="checkbox" id="otAuto" checked={!!form.otAuto} onChange={e => setForm({ ...form, otAuto: e.target.checked })} className="w-4 h-4 text-teal-600 rounded" />
            <label htmlFor="otAuto" className="text-xs font-medium text-slate-700 cursor-pointer">Auto OT Calculation</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600">Min Staff Quantity</label>
              <NumericInput integer className="mt-1 w-full form-input mono-numeric" value={form.minStaffQty ?? ''} onChange={e => setForm({ ...form, minStaffQty: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Attendance Allowance</label>
              <NumericInput className="mt-1 w-full form-input mono-numeric" value={form.attendanceAllowance ?? ''} onChange={e => setForm({ ...form, attendanceAllowance: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Days for Att. Allowance</label>
              <NumericInput integer className="mt-1 w-full form-input mono-numeric" value={form.daysToWorkForAllowance ?? ''} onChange={e => setForm({ ...form, daysToWorkForAllowance: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
          <button onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-md border text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={onSave} className="px-4 py-1.5 rounded-md bg-[#2F6F5E] hover:bg-[#265b4d] text-white font-medium text-sm transition shadow-sm">Save Plant</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} title="Delete Plant" message={`Are you sure you want to delete plant ${confirm}?`} onConfirm={onDeleteConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}

