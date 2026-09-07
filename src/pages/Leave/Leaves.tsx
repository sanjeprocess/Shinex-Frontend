import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import SearchInput from '../../components/SearchInput'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import NumericInput from '../../components/NumericInput'
import { list as listEmployees } from '../../mocks/employees'
import { list as listLeaveTypes } from '../../mocks/leaveTypes'
import {
 list as listLeaves,
 create as createLeave,
 update as updateLeave,
 remove as removeLeave,
 type LeaveRecord
} from '../../mocks/leaves'
import type { Employee } from '../../types/employee'

const getActiveBusinessCenter = () => {
 if (typeof window === 'undefined') return '001'
 return localStorage.getItem('hsb_active_bc') || '001'
}

const calculateLeaveDays = (startDate: string, endDate: string) => {
 if (!startDate || !endDate) return 0
 const start = new Date(`${startDate}T00:00:00`)
 const end = new Date(`${endDate}T00:00:00`)
 if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
 const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
 return diff > 0 ? diff : 0
}

type LeaveForm = {
 id?: string
 leaveYear: string
 leaveMonth: string
 empNo: string
 leaveType: string
 leaveDays: number
 leaveStartDate: string
 leaveEndDate: string
 businessCenter: string
}

const createEmptyForm = (): LeaveForm => {
 const now = new Date()
 return {
   leaveYear: String(now.getFullYear()),
   leaveMonth: String(now.getMonth() + 1).padStart(2, '0'),
   empNo: '',
   leaveType: '',
   leaveDays: 0,
   leaveStartDate: '',
   leaveEndDate: '',
   businessCenter: getActiveBusinessCenter()
 }
}

export default function Leaves() {
 const today = new Date().toISOString().split('T')[0]
 const userRole = (typeof window !== 'undefined' ? localStorage.getItem('hsb_user_role') : '') || ''
 const isSuperAdmin = ['SUPERADMIN', 'SUPER_ADMIN'].includes(userRole.toUpperCase())
 const [rows, setRows] = useState<LeaveRecord[]>([])
 const [employees, setEmployees] = useState<Employee[]>([])
 const [leaveTypes, setLeaveTypes] = useState<any[]>([])
 const [q, setQ] = useState('')
 const [open, setOpen] = useState(false)
 const [editingId, setEditingId] = useState<string | null>(null)
 const [deleteId, setDeleteId] = useState<string | null>(null)
 const [form, setForm] = useState<LeaveForm>(createEmptyForm())
 const [errors, setErrors] = useState<{ empNo?: string; leaveType?: string; leaveStartDate?: string; leaveEndDate?: string }>({})

 useEffect(() => {
   refresh()
   listEmployees().then(setEmployees)
   listLeaveTypes().then(setLeaveTypes)
 }, [])

 useEffect(() => {
   setForm(prev => ({
     ...prev,
     leaveDays: calculateLeaveDays(prev.leaveStartDate, prev.leaveEndDate)
   }))
 }, [form.leaveStartDate, form.leaveEndDate])

 function refresh() {
   listLeaves().then(setRows)
 }

 function handleAdd() {
   setForm(createEmptyForm())
   setEditingId(null)
   setOpen(true)
 }

 function handleEdit(id: string) {
   const row = rows.find(item => item.id === id)
   if (!row) return
   setForm({
     id: row.id,
     leaveYear: row.leaveYear || String(new Date().getFullYear()),
     leaveMonth: row.leaveMonth || String(new Date().getMonth() + 1).padStart(2, '0'),
     empNo: row.empNo || row.epfNo || '',
     leaveType: row.leaveType,
     leaveDays: Number(row.leaveDays || 0),
     leaveStartDate: row.leaveStartDate || row.start || '',
     leaveEndDate: row.leaveEndDate || row.end || '',
     businessCenter: row.businessCenter || getActiveBusinessCenter()
   })
   setEditingId(id)
   setOpen(true)
 }

 function validate() {
   const next: { empNo?: string; leaveType?: string; leaveStartDate?: string; leaveEndDate?: string } = {}
   if (!String(form.empNo || '').trim()) next.empNo = 'Employee is required'
   if (!String(form.leaveType || '').trim()) next.leaveType = 'Leave type is required'
   if (!String(form.leaveStartDate || '').trim()) next.leaveStartDate = 'Start date is required'
   if (!String(form.leaveEndDate || '').trim()) next.leaveEndDate = 'End date is required'
   if (!isSuperAdmin && form.leaveStartDate && form.leaveStartDate < today) {
     next.leaveStartDate = 'Regular Admins/Users cannot select past dates for leave.'
   }
   if (form.leaveStartDate && form.leaveEndDate && form.leaveEndDate < form.leaveStartDate) {
     next.leaveEndDate = 'End date cannot be earlier than start date'
   }
   setErrors(next)
   return Object.keys(next).length === 0
 }

 async function handleSave() {
   if (!validate()) {
     toast.error('Please complete the required fields')
     return
   }

    const leaveDays = calculateLeaveDays(form.leaveStartDate, form.leaveEndDate)
   const payload: LeaveRecord = {
     id: editingId || '',
     leaveYear: form.leaveYear,
     leaveMonth: form.leaveMonth,
     empNo: form.empNo,
     epfNo: form.empNo,
     leaveType: form.leaveType,
     leaveDays,
     leaveStartDate: form.leaveStartDate,
     leaveEndDate: form.leaveEndDate,
     businessCenter: form.businessCenter || getActiveBusinessCenter(),
     start: form.leaveStartDate,
     end: form.leaveEndDate,
     days: leaveDays
   }

   try {
     if (editingId) {
       await updateLeave(editingId, payload)
       toast.success('Leave updated')
     } else {
       await createLeave({ ...payload, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` })
       toast.success('Leave added')
     }
     setOpen(false)
     refresh()
   } catch (error: any) {
     console.error('Save leave failed', error)
     const status = error?.response?.status
     const message = error?.response?.data?.message || error?.response?.data?.error
     toast.error(status === 403
       ? 'Only Super Admins are authorized to apply for backdated leave.'
       : String(message || 'Save failed'))
   }
 }

 function handleDeleteConfirm() {
   if (!deleteId) return
   removeLeave(deleteId).then(() => {
     setDeleteId(null)
     refresh()
     toast.success('Leave deleted')
   }).catch(() => {
     toast.error('Failed to delete leave — please try again')
   })
 }

 const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.epfNo, emp])), [employees])
 const leaveTypeMap = useMemo(() => new Map(leaveTypes.map(type => [type.code.trim(), type])), [leaveTypes])

 const filteredRows = useMemo(() => {
   const normalized = q.trim().toLowerCase()
   if (!normalized) return rows

   return rows.filter(row => {
     const employee = employeeMap.get(row.empNo || row.epfNo || '')
     const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : ''
     const leaveTypeName = leaveTypeMap.get(row.leaveType)?.name || row.leaveType
     const searchText = `${employeeName} ${row.empNo || row.epfNo || ''} ${leaveTypeName}`.toLowerCase()
     return searchText.includes(normalized)
   })
 }, [rows, employeeMap, leaveTypeMap, q])

 const tableData = filteredRows.map(row => {
   const employee = employeeMap.get(row.empNo || row.epfNo || '')
   const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'Unknown'
   const leaveTypeName = leaveTypeMap.get(row.leaveType)?.name || row.leaveType
   return {
     id: row.id,
     employee: employeeName,
     epfNo: row.empNo || row.epfNo || '',
     leaveType: leaveTypeName,
     startDate: row.leaveStartDate || row.start || '',
     endDate: row.leaveEndDate || row.end || '',
     days: Number(row.leaveDays || row.days || 0),
     businessCenter: row.businessCenter || '—'
   }
 })

 return (
   <div>
     <div className="mb-4 flex items-center justify-between gap-3">
       <h2 className="text-xl font-semibold text-slate-800">Transaction Leave</h2>
       <div className="flex items-center gap-2">
         <SearchInput value={q} onChange={setQ} placeholder="Search by employee name or EPF No..." />
         <button className="rounded-md bg-[#2F6F5E] px-3 py-1.5 text-sm font-medium text-white" onClick={handleAdd}>
           Add Leave
         </button>
       </div>
     </div>

     <div className="overflow-hidden rounded-xl bg-white shadow-flat">
       <DataTable
         columns={[
           { key: 'employee', label: 'Employee' },
           { key: 'epfNo', label: 'EPF No', className: 'mono-numeric' },
           { key: 'leaveType', label: 'Leave Type' },
           { key: 'startDate', label: 'Start Date', className: 'mono-numeric' },
           { key: 'endDate', label: 'End Date', className: 'mono-numeric' },
           { key: 'days', label: 'Days', className: 'mono-numeric' },
           { key: 'businessCenter', label: 'Business Center' },
           { key: 'id', label: 'Actions' }
         ]}
         data={tableData}
         onEdit={handleEdit}
         onDelete={setDeleteId}
       />
     </div>

     <Modal title={editingId ? 'Edit Leave' : 'Add Leave'} open={open} onClose={() => setOpen(false)}>
       <div className="flex min-h-0 flex-col">
         <div className="leave-modal-body flex-1 overflow-y-auto overscroll-contain scroll-smooth px-1 py-1 space-y-4">
         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Employee</label>
           <SearchableEmployeeSelect
             value={form.empNo || undefined}
             onChange={(epf) => { setForm(prev => ({ ...prev, empNo: epf || '' })); if (errors.empNo) setErrors(prev => ({ ...prev, empNo: undefined })) }}
           />
           {errors.empNo && <p className="mt-1 text-xs text-red-500">{errors.empNo}</p>}
         </div>

         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Leave Type</label>
           <select
             value={form.leaveType}
             onChange={e => { setForm(prev => ({ ...prev, leaveType: e.target.value })); if (errors.leaveType) setErrors(prev => ({ ...prev, leaveType: undefined })) }}
             className={`w-full form-input ${errors.leaveType ? 'border-red-300 ring-2 ring-red-100' : ''}`}
           >
             <option value="">Select leave type</option>
             {leaveTypes.map(type => (
               <option key={type.code.trim()} value={type.code.trim()}>
                 {type.name.trim()} ({type.code.trim()})
               </option>
             ))}
           </select>
           {errors.leaveType && <p className="mt-1 text-xs text-red-500">{errors.leaveType}</p>}
         </div>

         <div className="grid grid-cols-2 gap-3">
           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Year</label>
             <select
               value={form.leaveYear}
               onChange={e => setForm(prev => ({ ...prev, leaveYear: e.target.value }))}
               className="w-full form-input"
             >
               {Array.from({ length: 5 }, (_, index) => {
                 const year = String(new Date().getFullYear() - 1 + index)
                 return <option key={year} value={year}>{year}</option>
               })}
             </select>
           </div>

           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Month</label>
             <select
               value={form.leaveMonth}
               onChange={e => setForm(prev => ({ ...prev, leaveMonth: e.target.value }))}
               className="w-full form-input"
             >
               {Array.from({ length: 12 }, (_, index) => {
                 const month = String(index + 1).padStart(2, '0')
                 return <option key={month} value={month}>{month}</option>
               })}
             </select>
           </div>
         </div>

         <div className="grid grid-cols-2 gap-3">
           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Start Date</label>
             <input
               type="date"
               value={form.leaveStartDate}
               min={!isSuperAdmin ? today : undefined}
               onChange={e => {
                 const start = e.target.value
                 const end = form.leaveEndDate
                 setForm(prev => ({
                   ...prev,
                   leaveStartDate: start,
                   leaveDays: start && end ? calculateLeaveDays(start, end) : prev.leaveDays
                 }))
                 if (!isSuperAdmin && start < today) {
                   setErrors(prev => ({ ...prev, leaveStartDate: 'Regular Admins/Users cannot select past dates for leave.' }))
                 } else if (errors.leaveStartDate) {
                   setErrors(prev => ({ ...prev, leaveStartDate: undefined }))
                 }
               }}
               className={`w-full form-input ${errors.leaveStartDate ? 'border-red-300 ring-2 ring-red-100' : ''}`}
             />
             {errors.leaveStartDate && <p className="mt-1 text-xs text-red-500">{errors.leaveStartDate}</p>}
           </div>

           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">End Date</label>
             <input
               type="date"
               value={form.leaveEndDate}
               min={form.leaveStartDate || undefined}
               onChange={e => {
                 const end = e.target.value
                 const start = form.leaveStartDate
                 setForm(prev => ({
                   ...prev,
                   leaveEndDate: end,
                   leaveDays: start && end ? calculateLeaveDays(start, end) : prev.leaveDays
                 }))
                 if (errors.leaveEndDate) setErrors(prev => ({ ...prev, leaveEndDate: undefined }))
               }}
               className={`w-full form-input ${errors.leaveEndDate ? 'border-red-300 ring-2 ring-red-100' : ''}`}
             />
             {errors.leaveEndDate && <p className="mt-1 text-xs text-red-500">{errors.leaveEndDate}</p>}
           </div>
         </div>

         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Leave Days</label>
           <NumericInput integer
             readOnly
             min={0}
             value={form.leaveDays}
             className="w-full form-input mono-numeric"
           />
         </div>

         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Business Center</label>
           <input
             value={form.businessCenter}
             readOnly
             className="w-full form-input bg-slate-100 text-slate-700"
           />
         </div>

         </div>
         <div className="flex shrink-0 justify-end gap-3 border-t bg-gray-50 px-1 py-4">
           <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setOpen(false)}>
             Cancel
           </button>
           <button type="button" className="rounded-md bg-[#2F6F5E] px-3 py-1.5 text-sm text-white" onClick={handleSave}>
             Save
           </button>
         </div>
       </div>
     </Modal>

     <ConfirmDialog
       open={!!deleteId}
       title="Delete Leave"
       message="Are you sure you want to delete this leave record?"
       onConfirm={handleDeleteConfirm}
       onCancel={() => setDeleteId(null)}
     />
   </div>
 )
}
