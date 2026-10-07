import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Upload, Trash2, User } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SlideOver from '../../components/SlideOver'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchInput from '../../components/SearchInput'
import NumericInput from '../../components/NumericInput'
import { list as listEmployees, create as createEmployee, update as updateEmployee, remove as removeEmployee, getNextEpfNo } from '../../services/employeeService'
import { list as listSections, Section } from '../../mocks/sections'
import { list as listCustomers } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import SearchableSectionSelect from '../../components/shared/SearchableSectionSelect'
import SearchableBankSelect from '../../components/shared/SearchableBankSelect'
import { Employee } from '../../types/employee'
import { validateNameField } from '../../utils/validators'
import { processImageFile } from '../../utils/imageUtils'

function calculateAge(dobString: string): number | null {
  if (!dobString) return null
  const birthDate = new Date(dobString)
  if (isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

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
    photoUrl: '',

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

    deathDonation: false
  }

  const [rows, setRows] = useState<Employee[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Employee>({ ...defaultEmployee })
  const [isEditing, setIsEditing] = useState(false)
  const [editingEpf, setEditingEpf] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [centerList, setCenterList] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsProcessingPhoto(true)
      const base64 = await processImageFile(file, 400, 400, 0.85)
      setForm(prev => ({ ...prev, photoUrl: base64 }))
      toast.success('Photo uploaded successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo')
    } finally {
      setIsProcessingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = () => {
    setForm(prev => ({ ...prev, photoUrl: '' }))
    if (photoInputRef.current) photoInputRef.current.value = ''
    toast.success('Photo removed')
  }

  useEffect(() => {
    refresh()
    listSections().then(res => setSections(Array.isArray(res) ? res : [])).catch(() => setSections([]))
    listCustomers().then(res => setCustomers(Array.isArray(res) ? res : [])).catch(() => setCustomers([]))
    listBC().then(res => setCenterList(Array.isArray(res) ? res : [])).catch(() => setCenterList([]))

    const handleBcChange = () => {
      refresh()
      listSections().then(res => setSections(Array.isArray(res) ? res : [])).catch(() => setSections([]))
    }
    window.addEventListener('hsb_bc_change', handleBcChange)
    window.addEventListener('storage', handleBcChange)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange)
      window.removeEventListener('storage', handleBcChange)
    }
  }, [])

  function refresh() {
    listEmployees()
      .then(res => setRows(Array.isArray(res) ? res : []))
      .catch(err => {
        console.warn('Failed to load employees', err)
        setRows([])
      })
  }

  // Add: reset form to full explicit defaults, auto-generate EPF No, and open
  async function handleAdd() {
    const activeBc = localStorage.getItem('hsb_active_bc') || ''
    const empty = { ...defaultEmployee }
    empty.businessCenter = activeBc && activeBc !== 'ALL' ? activeBc : (centerList[0]?.code || '')

    try {
      const generatedEpf = await getNextEpfNo(empty.businessCenter)
      empty.epfNo = generatedEpf
    } catch (e) {
      console.warn('Could not auto-generate EPF No', e)
    }

    setForm(empty)
    setIsEditing(false)
    setEditingEpf(null)
    setErrors({})
    setOpen(true)
  }

  // Edit: set full form copy and open
  function handleEdit(epf: string) {
    const row = rows.find(r => r.epfNo === epf)
    if (!row) return
    const secCode = (row.sectionCode || '').trim();
    const sectionObj = secCode ? sections.find(s => (s.code || '').trim() === secCode || (s.name || '').trim() === secCode) : null;
    const secSalary = sectionObj && sectionObj.basicSalary != null && Number(sectionObj.basicSalary) > 0 ? Number(sectionObj.basicSalary) : 0;
    const effectiveSalary = secSalary > 0 ? secSalary : (row.basicSalary || 0);

    setForm({
      ...row,
      basicSalary: effectiveSalary
    })
    setIsEditing(true)
    setEditingEpf(epf)
    setOpen(true)
  }

  // Save: explicit validation, call create/update, close, toast, refresh
  function validateEmployee() {
    const next: Record<string, string> = {}

    if (!String(form.epfNo || '').trim()) next.epfNo = 'EPF No is required'

    if (!String(form.firstName || '').trim()) {
      next.firstName = 'First Name is required'
    } else {
      const nameError = validateNameField(form.firstName || '', 'First name')
      if (nameError) next.firstName = nameError
    }
    if (!String(form.dateOfBirth || '').trim()) next.dateOfBirth = 'Date of Birth is required'
    if (!String(form.gender || '').trim()) next.gender = 'Gender is required'
    if (!String(form.plantCode || '').trim()) next.plantCode = 'Please select an Employee Plant'
    if (!String(form.businessCenter || '').trim()) next.businessCenter = 'Please select a Business Center'
    if (!String(form.hiredDate || '').trim()) next.hiredDate = 'Hired Date is required'
    if (!String(form.hiredMonth || '').trim()) next.hiredMonth = 'Please select Hired Month'

    if (!String(form.lastName || '').trim()) next.lastName = 'Last Name is required'
    const lastNameError = validateNameField(form.lastName || '', 'Last name')
    if (lastNameError) next.lastName = lastNameError

    const bankNameError = validateNameField(form.bankName || '', 'Bank name')
    if (bankNameError) next.bankName = bankNameError

    setErrors(next)
    return next
  }

  async function handleSave() {
    const validationErrors = validateEmployee()
    if (Object.keys(validationErrors).length > 0) {
      const missingFields = Object.keys(validationErrors)
        .map(key => ({ epfNo: 'EPF No', firstName: 'First Name', lastName: 'Last Name', dateOfBirth: 'Date of Birth', gender: 'Gender', plantCode: 'Employee Plant', businessCenter: 'Business Center', hiredDate: 'Hired Date', hiredMonth: 'Hired Month' } as Record<string, string>)[key] || key)
      toast.error(`Please complete required fields: ${missingFields.join(', ')}`)
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
  const filtered = (rows || []).filter(r => {
    if (!r) return false
    const hay = `${r.epfNo || ''} ${r.firstName || ''} ${r.lastName || ''} ${r.nicNo || ''}`.toLowerCase()
    return hay.includes((q || '').toLowerCase().trim())
  })

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Employees</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#2F6F5E] border border-emerald-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#3F9884]"></span>
              Total Employees: <strong className="mono-numeric text-sm">{(rows || []).length}</strong>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active Scope: <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{activeBc === 'ALL' ? 'All Business Centers' : activeBc}</span>
            {q.trim() && <span className="ml-2 text-slate-400 italic">(Showing {filtered.length} of {(rows || []).length})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name, EPF No, or NIC..." />
          <button type="button" className="bg-[#2F6F5E] hover:bg-[#25584a] text-white px-3.5 py-1.5 rounded-md font-medium text-sm transition shadow-sm" onClick={handleAdd}>+ Add Employee</button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'epfNo', label: 'Emp No', className: 'mono-numeric' },
          { key: 'name', label: 'Employee Name & Photo' },
          { key: 'plantName', label: 'Plant Name' },
          { key: 'sectionName', label: 'Section Name' },
          { key: 'basicSalary', label: 'Basic Salary', className: 'mono-numeric font-semibold text-slate-800' },
          { key: 'age', label: 'Age', className: 'text-slate-600' },
          { key: 'id', label: 'Actions' }
        ]}
        data={(filtered || []).map(r => {
          const plantObj = customers.find(c => (c.code || '').trim() === (r?.plantCode || '').trim() || (c.name || '').trim() === (r?.plantCode || '').trim());
          const plantDisplayName = plantObj ? (plantObj.name ? `${plantObj.name} (${plantObj.code})` : plantObj.code) : (r?.plantCode || '—');

          const sectionObj = sections.find(s => (s.code || '').trim() === (r?.sectionCode || '').trim() || (s.name || '').trim() === (r?.sectionCode || '').trim());
          const sectionDisplayName = sectionObj ? (sectionObj.name ? `${sectionObj.name}` : sectionObj.code) : (r?.sectionCode || '—');

          const secSalary = sectionObj && sectionObj.basicSalary != null && Number(sectionObj.basicSalary) > 0 ? Number(sectionObj.basicSalary) : 0;
          const empSalary = r?.basicSalary != null && Number(r.basicSalary) > 0 ? Number(r.basicSalary) : 0;
          const effectiveSalary = secSalary > 0 ? secSalary : empSalary;

          const formattedSalary = `Rs. ${effectiveSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          const ageNum = calculateAge(r?.dateOfBirth || '');
          const ageDisplay = ageNum !== null ? `${ageNum} yrs` : '—';

          return {
            epfNo: r?.epfNo || '',
            name: (
              <div className="flex items-center gap-3">
                {r?.photoUrl ? (
                  <img src={r.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F6F5E] to-[#3F9884] text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs flex-shrink-0">
                    {(r?.firstName?.[0] || 'E') + (r?.lastName?.[0] || '')}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-slate-800 leading-snug">{r?.firstName || ''} {r?.lastName || ''}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{r?.nicNo || 'No NIC'}</div>
                </div>
              </div>
            ),
            plantName: (
              <span className="text-slate-700 font-medium">
                {plantDisplayName}
              </span>
            ),
            sectionName: (
              <span className="text-slate-700">
                {sectionDisplayName}
              </span>
            ),
            basicSalary: (
              <span className="font-semibold text-slate-900 font-mono">
                {formattedSalary}
              </span>
            ),
            age: (
              <span className="text-slate-700 font-medium">
                {ageDisplay}
              </span>
            ),
            id: r?.epfNo || ''
          };
        })}
        onEdit={(id) => handleEdit(id)}
        onDelete={(id) => setConfirm(id)}
      />

      <SlideOver open={open} onClose={() => setOpen(false)} title={isEditing ? 'Edit Employee' : 'Add Employee'}>
        <div className="space-y-4">
          <section className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {form.photoUrl ? (
                  <img
                    src={form.photoUrl}
                    alt="Profile Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#2F6F5E] shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-400 flex flex-col items-center justify-center border-2 border-dashed border-slate-300">
                    <User size={28} />
                  </div>
                )}
                {isProcessingPhoto && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                    ...
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h4 className="text-xs font-semibold text-slate-800">Profile Photo</h4>
                <p className="text-[11px] text-slate-500 mb-2">Upload employee photo (JPG, PNG, WebP)</p>
                
                <div className="flex items-center gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition"
                  >
                    <Camera size={13} className="text-[#2F6F5E]" />
                    {form.photoUrl ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {form.photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-red-50 text-red-600 text-xs font-medium transition"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Personal</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 flex items-center justify-between"><span>EPF No <span className="text-red-500">*</span></span>{!isEditing && <span className="text-[10px] text-[#2F6F5E] font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Auto-generated</span>}</label>
                <input type="text" value={form.epfNo || ''} onChange={e => { setForm({ ...form, epfNo: e.target.value }); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} className={`mt-1 w-full form-input mono-numeric ${errors.epfNo ? 'border-red-300 ring-2 ring-red-100' : ''}`} disabled={isEditing} />
                {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">NIC No</label>
                <input type="text" value={form.nicNo || ''} onChange={e => setForm({ ...form, nicNo: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">First Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.firstName || ''} onChange={e => { if (/\d/.test(e.target.value)) { toast.error('First name cannot contain numbers.'); return } setForm({ ...form, firstName: e.target.value }); if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined })) }} className={`mt-1 w-full form-input ${errors.firstName ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Last Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.lastName || ''} onChange={e => { if (/\d/.test(e.target.value)) { toast.error('Last name cannot contain numbers.'); return } setForm({ ...form, lastName: e.target.value }); if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined })) }} className={`mt-1 w-full form-input ${errors.lastName ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Date of Birth <span className="text-red-500">*</span></label>
                <input type="date" value={form.dateOfBirth || ''} onChange={e => { setForm({ ...form, dateOfBirth: e.target.value }); setErrors(prev => ({ ...prev, dateOfBirth: undefined })) }} className={`mt-1 w-full form-input ${errors.dateOfBirth ? 'border-red-500 bg-red-50' : ''}`} />
                {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Age <span className="text-slate-400 font-normal">(Auto-calculated)</span></label>
                <input
                  type="text"
                  value={calculateAge(form.dateOfBirth) !== null ? `${calculateAge(form.dateOfBirth)} years` : ''}
                  readOnly
                  placeholder="Auto-calculated from DOB"
                  className="mt-1 w-full form-input bg-slate-50 text-slate-700 font-medium cursor-default"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-600">Gender <span className="text-red-500">*</span></label>
                <select value={form.gender || ''} onChange={e => { setForm({ ...form, gender: e.target.value }); setErrors(prev => ({ ...prev, gender: undefined })) }} className={`mt-1 w-full form-input ${errors.gender ? 'border-red-500 bg-red-50' : ''}`}>
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
                {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender}</p>}
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Employment</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Employee Plant <span className="text-red-500">*</span></label>
                <select value={form.plantCode || ''} onChange={e => { setForm({ ...form, plantCode: e.target.value }); setErrors(prev => ({ ...prev, plantCode: undefined })) }} className={`mt-1 w-full form-input ${errors.plantCode ? 'border-red-500 bg-red-50' : ''}`}>
                  <option value="">Select</option>
                  {customers.map(c => <option key={c.code} value={c.code}>{c.code} / {c.name}</option>)}
                </select>
                {errors.plantCode && <p className="mt-1 text-xs text-red-500">{errors.plantCode}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Plant Name</label>
                <input
                  value={customers.find(c => c.code === form.plantCode)?.name || ''}
                  readOnly
                  placeholder="Select a plant"
                  className="mt-1 w-full form-input bg-slate-50 cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Section Name</label>
                <SearchableSectionSelect
                  value={form.sectionCode || ''}
                  businessCenter={form.businessCenter}
                  sections={sections}
                  placeholder="Search section name or code..."
                  onChange={(selectedCode, selectedSection) => {
                    setForm(prev => ({
                      ...prev,
                      sectionCode: selectedCode,
                      ...(selectedSection && selectedSection.basicSalary != null && Number(selectedSection.basicSalary) > 0
                        ? { basicSalary: Number(selectedSection.basicSalary) }
                        : {})
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Business Center <span className="text-red-500">*</span></label>
                {(!form.businessCenter || localStorage.getItem('hsb_active_bc') === 'ALL') ? (
                  <select
                    value={form.businessCenter || ''}
                    onChange={async e => {
                      const newBc = e.target.value;
                      setForm(prev => ({ ...prev, businessCenter: newBc }));
                      setErrors(prev => ({ ...prev, businessCenter: undefined }));
                      if (!isEditing) {
                        try {
                          const nextEpf = await getNextEpfNo(newBc);
                          setForm(prev => ({ ...prev, businessCenter: newBc, epfNo: nextEpf }));
                        } catch {}
                      }
                    }}
                    className={`mt-1 w-full form-input ${errors.businessCenter ? 'border-red-500 bg-red-50' : ''}`}
                  >
                    <option value="">Select Business Center</option>
                    {centerList.map(c => <option key={c.code} value={c.code}>{c.code} / {c.name}</option>)}
                  </select>
                ) : (
                  <input
                    value={(centerList.find(c => c.code === form.businessCenter)?.code ? `${centerList.find(c => c.code === form.businessCenter)?.code} / ${centerList.find(c => c.code === form.businessCenter)?.name}` : form.businessCenter) || ''}
                    readOnly
                    className={`mt-1 w-full form-input bg-slate-50 cursor-default ${errors.businessCenter ? 'border-red-500 bg-red-50' : ''}`}
                  />
                )}
                {errors.businessCenter && <p className="mt-1 text-xs text-red-500">{errors.businessCenter}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Hired Date <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={form.hiredDate || ''} 
                  onChange={e => { 
                    const dateVal = e.target.value;
                    let autoMonth = '';
                    if (dateVal) {
                      const parts = dateVal.split('-');
                      if (parts.length >= 2) {
                        const monthIdx = parseInt(parts[1], 10) - 1;
                        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                        if (monthIdx >= 0 && monthIdx < 12) {
                          autoMonth = months[monthIdx];
                        }
                      }
                    }
                    setForm(prev => ({ 
                      ...prev, 
                      hiredDate: dateVal, 
                      hiredMonth: autoMonth || prev.hiredMonth 
                    })); 
                    setErrors(prev => ({ 
                      ...prev, 
                      hiredDate: undefined,
                      ...(autoMonth ? { hiredMonth: undefined } : {})
                    })); 
                  }} 
                  className={`mt-1 w-full form-input ${errors.hiredDate ? 'border-red-500 bg-red-50' : ''}`} 
                />
                {errors.hiredDate && <p className="mt-1 text-xs text-red-500">{errors.hiredDate}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600 flex items-center justify-between">
                  <span>Hired Month <span className="text-red-500">*</span></span>
                  {form.hiredMonth && <span className="text-[10px] text-[#2F6F5E] font-medium bg-emerald-50 px-1 rounded">Auto-generated</span>}
                </label>
                <select value={form.hiredMonth || ''} onChange={e => { setForm({ ...form, hiredMonth: e.target.value }); setErrors(prev => ({ ...prev, hiredMonth: undefined })) }} className={`mt-1 w-full form-input ${errors.hiredMonth ? 'border-red-500 bg-red-50' : ''}`}>
                  <option value="">Select month</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m}>{m}</option>)}
                </select>
                {errors.hiredMonth && <p className="mt-1 text-xs text-red-500">{errors.hiredMonth}</p>}
              </div>
              <div className="col-span-2 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!form.deathDonation}
                    onChange={e => setForm({ ...form, deathDonation: e.target.checked })}
                    className="w-4 h-4 text-[#2F6F5E] rounded border-slate-300 focus:ring-[#3F9884]"
                  />
                  <span className="font-semibold text-slate-800">Death Donation</span>
                </label>

                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-xs font-semibold text-slate-800">Employee Status (Active)</label>
                  <Toggle checked={!!form.statusActive} onChange={v => setForm({ ...form, statusActive: v })} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-xs text-slate-700">Compensation</h4>
              {(() => {
                const secCode = (form.sectionCode || '').trim();
                const sectionObj = secCode ? sections.find(s => (s.code || '').trim() === secCode || (s.name || '').trim().toLowerCase() === secCode.toLowerCase()) : null;
                const secSalary = sectionObj && sectionObj.basicSalary != null && Number(sectionObj.basicSalary) > 0 ? Number(sectionObj.basicSalary) : 0;
                if (secSalary > 0 && form.basicSalary !== secSalary) {
                  return (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, basicSalary: secSalary }))}
                      className="text-[11px] text-[#2F6F5E] hover:underline font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                    >
                      Sync from Section Basic Salary (Rs. {secSalary.toLocaleString()})
                    </button>
                  );
                }
                return null;
              })()}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Basic Salary (Rs.)</label>
                <NumericInput value={form.basicSalary || 0} onChange={e => { setForm({ ...form, basicSalary: Number(e.target.value) }) }} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Allowance</label>
                <NumericInput value={form.dayAllowance || 0} onChange={e => setForm({ ...form, dayAllowance: Number(e.target.value) })} className="mt-1 w-full form-input mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Night Allowance</label>
                <NumericInput value={form.nightAllowance || 0} onChange={e => setForm({ ...form, nightAllowance: Number(e.target.value) })} className="mt-1 w-full form-input mono-numeric" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-xs text-slate-600">Sunday / Poya Extra Payment</label>
              <NumericInput value={form.sundayPoyaExtra || 0} onChange={e => setForm({ ...form, sundayPoyaExtra: Number(e.target.value) })} className="mt-1 w-40 form-input mono-numeric" />
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
                <label className="block text-xs text-slate-600 mb-1">Bank Name</label>
                <SearchableBankSelect
                  value={form.bankName || ''}
                  onChange={(bankName) => {
                    if (/\d/.test(bankName)) {
                      toast.error('Bank name cannot contain numbers.')
                      return
                    }
                    setForm(prev => ({ ...prev, bankName }))
                    if (errors.bankName) setErrors(prev => ({ ...prev, bankName: undefined }))
                  }}
                  error={errors.bankName}
                />
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
