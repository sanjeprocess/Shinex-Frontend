import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import SlideOver from '../../components/SlideOver'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchInput from '../../components/SearchInput'
import { list as listEmployees, create as createEmployee, update as updateEmployee, remove as removeEmployee } from '../../services/employeeService'
import { list as listSections } from '../../mocks/sections'
import { list as listCustomers } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { Employee } from '../../types/employee'
import { validateNameField } from '../../utils/validators'

export default function EmployeesList() {
  // explicit, strongly-typed form state matching Employee type
  const defaultEmployee: Employee = {
    epfNo: '',
    nicNo: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    address: '',
    homeContact: '',
    mobile: '',
    email: '',

    plantCode: '',
    sectionCode: '',
    businessCenter: localStorage.getItem('hsb_active_bc') || '',
    hiredDate: '',
    hiredMonth: '',
    statusActive: true,

    basicSalary: 0,
    dayAllowance: 0,
    nightAllowance: 0,
    sundayPoyaExtra: 0,

    bankAccountNumber: '',
    bankName: '',
    branchName: '',
    branchCode: '',
    swift: '',

    bCardYes: false,
    deathDonation: false
  }

  const [rows, setRows] = useState<Employee[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Employee>({ ...defaultEmployee })
  const [isEditing, setIsEditing] = useState(false)
  const [editingEpf, setEditingEpf] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [sections, setSections] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [centerList, setCenterList] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ epfNo?: string; firstName?: string; lastName?: string; bankName?: string }>({})

  useEffect(() => {
    refresh()
    listSections().then(setSections)
    listCustomers().then(setCustomers)
    listBC().then(setCenterList)
  }, [])

  function refresh() { listEmployees().then(setRows) }

  // Add: reset form to full explicit defaults and open
  function handleAdd() {
    const empty = { ...defaultEmployee }
    // ensure business center is set from header context at add-time
    empty.businessCenter = localStorage.getItem('hsb_active_bc') || empty.businessCenter
    setForm(empty)
    setIsEditing(false)
    setEditingEpf(null)
    // open after state set
    setOpen(true)
  }

  // Edit: set full form copy and open
  function handleEdit(epf: string) {
    const row = rows.find(r => r.epfNo === epf)
    if (!row) return
    setForm({ ...row })
    setIsEditing(true)
    setEditingEpf(epf)
    setOpen(true)
  }

  // Save: explicit validation, call create/update, close, toast, refresh
  function validateEmployee() {
    const next: { epfNo?: string; firstName?: string; lastName?: string; bankName?: string } = {}

    if (!String(form.epfNo || '').trim()) next.epfNo = 'EPF No is required'

    if (!String(form.firstName || '').trim()) {
      next.firstName = 'First Name is required'
    } else {
      const nameError = validateNameField(form.firstName || '', 'First name')
      if (nameError) next.firstName = nameError
    }

    const lastNameError = validateNameField(form.lastName || '', 'Last name')
    if (lastNameError) next.lastName = lastNameError

    const bankNameError = validateNameField(form.bankName || '', 'Bank name')
    if (bankNameError) next.bankName = bankNameError

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validateEmployee()) {
      toast.error('Please complete the required fields')
      return
    }
    try {
      if (isEditing && editingEpf) {
        await updateEmployee(editingEpf, form)
        toast.success('Employee updated')
      } else {
        await createEmployee(form)
        toast.success('Employee added')
      }
      setOpen(false)
      refresh()
    } catch (err) {
      console.error('Employee save failed', err)
      toast.error('Save failed')
    }
  }

  // Delete confirm
  function handleDeleteConfirm() {
    if (!confirm) return
    removeEmployee(confirm).then(() => { setConfirm(null); refresh(); toast.success('Employee deleted') }).catch(() => toast.error('Failed to delete employee — please try again'))
  }

  // client-side filtering
  const filtered = rows.filter(r => {
    const hay = `${r.epfNo} ${r.firstName} ${r.lastName || ''} ${r.nicNo || ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Employees</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name, EPF No, or NIC..." />
          <button type="button" className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md btn-press" onClick={handleAdd}>Add</button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'epfNo', label: 'Emp No', className: 'mono-numeric' },
          { key: 'name', label: 'Name' },
          { key: 'section', label: 'Section' },
          { key: 'plant', label: 'Plant' },
          { key: 'id', label: 'Actions' }
        ]}
        data={filtered.map(r => ({ epfNo: r.epfNo, name: `${r.firstName} ${r.lastName || ''}`, section: r.sectionCode, plant: r.plantCode, id: r.epfNo }))}
        onEdit={(id) => handleEdit(id)}
        onDelete={(id) => setConfirm(id)}
      />

      <SlideOver open={open} onClose={() => setOpen(false)} title={isEditing ? 'Edit Employee' : 'Add Employee'}>
        <div className="space-y-4">
          <section>
            <h4 className="font-semibold mb-2">Personal</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">EPF No</label>
                <input type="text" value={form.epfNo || ''} onChange={e => { setForm({ ...form, epfNo: e.target.value }); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} className={`mt-1 w-full form-input mono-numeric ${errors.epfNo ? 'border-red-300 ring-2 ring-red-100' : ''}`} disabled={isEditing} />
                {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">NIC No</label>
                <input type="text" value={form.nicNo || ''} onChange={e => setForm({ ...form, nicNo: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">First Name</label>
                <input type="text" value={form.firstName || ''} onChange={e => { if (/\d/.test(e.target.value)) { toast.error('First name cannot contain numbers.'); return } setForm({ ...form, firstName: e.target.value }); if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined })) }} className={`mt-1 w-full form-input ${errors.firstName ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Last Name</label>
                <input type="text" value={form.lastName || ''} onChange={e => { if (/\d/.test(e.target.value)) { toast.error('Last name cannot contain numbers.'); return } setForm({ ...form, lastName: e.target.value }); if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined })) }} className={`mt-1 w-full form-input ${errors.lastName ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Date of Birth</label>
                <input type="date" value={form.dateOfBirth || ''} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Gender</label>
                <select value={form.gender || 'Male'} onChange={e => setForm({ ...form, gender: e.target.value })} className="mt-1 w-full form-input">
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Employment</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Plant / Customer</label>
                <select value={form.plantCode || ''} onChange={e => setForm({ ...form, plantCode: e.target.value })} className="mt-1 w-full form-input">
                  <option value="">Select</option>
                  {customers.map(c => <option key={c.code} value={c.code}>{c.code} / {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600">Section</label>
                <select value={form.sectionCode || ''} onChange={e => setForm({ ...form, sectionCode: e.target.value })} className="mt-1 w-full form-input">
                  <option value="">Select</option>
                  {sections.map(s => <option key={s.code} value={s.code}>{s.code} / {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600">Business Center</label>
                <input value={(centerList.find(c => c.code === form.businessCenter)?.code ? `${centerList.find(c => c.code === form.businessCenter)?.code} / ${centerList.find(c => c.code === form.businessCenter)?.name}` : form.businessCenter) || ''} readOnly className="mt-1 w-full form-input bg-slate-50 cursor-default" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Hired Date</label>
                <input type="date" value={form.hiredDate || ''} onChange={e => setForm({ ...form, hiredDate: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Hired Month</label>
                <select value={form.hiredMonth || ''} onChange={e => setForm({ ...form, hiredMonth: e.target.value })} className="mt-1 w-full form-input">
                  <option value="">Select month</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="block text-xs text-slate-600">Employee Status</label>
                <div>
                  <Toggle checked={!!form.statusActive} onChange={v => setForm({ ...form, statusActive: v })} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Compensation</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Basic Salary</label>
                <input type="number" value={form.basicSalary || 0} onChange={e => { if (!/^\d*\.?\d*$/.test(e.target.value)) { toast.error('Basic salary must be a number.'); return } setForm({ ...form, basicSalary: Number(e.target.value) }) }} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Allowance</label>
                <input type="number" value={form.dayAllowance || 0} onChange={e => { if (!/^\d*\.?\d*$/.test(e.target.value)) { toast.error('Day allowance must be a number.'); return } setForm({ ...form, dayAllowance: Number(e.target.value) }) }} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Night Allowance</label>
                <input type="number" value={form.nightAllowance || 0} onChange={e => { if (!/^\d*\.?\d*$/.test(e.target.value)) { toast.error('Night allowance must be a number.'); return } setForm({ ...form, nightAllowance: Number(e.target.value) }) }} className="mt-1 w-full form-input mono-numeric" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-xs text-slate-600">Sunday / Poya Extra Payment</label>
              <input type="number" value={form.sundayPoyaExtra || 0} onChange={e => { if (!/^\d*\.?\d*$/.test(e.target.value)) { toast.error('Sunday/Poya extra payment must be a number.'); return } setForm({ ...form, sundayPoyaExtra: Number(e.target.value) }) }} className="mt-1 w-40 form-input mono-numeric" />
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Banking</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Bank Account No</label>
                <input value={form.bankAccountNumber || ''} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Bank Name</label>
                <input value={form.bankName || ''} onChange={e => { if (/\d/.test(e.target.value)) { toast.error('Bank name cannot contain numbers.'); return } setForm({ ...form, bankName: e.target.value }); if (errors.bankName) setErrors(prev => ({ ...prev, bankName: undefined })) }} className={`mt-1 w-full form-input ${errors.bankName ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.bankName && <p className="mt-1 text-xs text-red-500">{errors.bankName}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Branch Name</label>
                <input value={form.branchName || ''} onChange={e => setForm({ ...form, branchName: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Branch Code</label>
                <input value={form.branchCode || ''} onChange={e => setForm({ ...form, branchCode: e.target.value })} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">SWIFT</label>
                <input value={form.swift || ''} onChange={e => setForm({ ...form, swift: e.target.value })} className="mt-1 w-full form-input" />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 rounded-md border" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white" onClick={handleSave}>Save</button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog open={!!confirm} title="Delete Employee" message={`Delete ${confirm}?`} onConfirm={handleDeleteConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
