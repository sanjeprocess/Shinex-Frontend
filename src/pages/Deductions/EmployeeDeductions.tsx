import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import SearchInput from '../../components/SearchInput'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../mocks/employees'
import { list as listDeductionTypes } from '../../mocks/deductions'
import type { Employee } from '../../types/employee'
import type { DeductionType } from '../../mocks/deductions'
import {
 list as listTransactionDeductions,
 create as createTransactionDeduction,
 update as updateTransactionDeduction,
 remove as removeTransactionDeduction,
 type TransactionDeduction
} from '../../mocks/transactionDeductions'

type DeductionForm = {
 epfNo: string
 didCode: string
 businessCenter: string
 didAmount: number
 everyMonth: boolean
 addMonth: string
 addYear: string
}

const getActiveBusinessCenter = () => {
 if (typeof window === 'undefined') return '001'
 return localStorage.getItem('hsb_active_bc') || '001'
}

const createEmptyForm = (): DeductionForm => {
 const now = new Date()
 return {
   epfNo: '',
   didCode: '',
   businessCenter: getActiveBusinessCenter(),
   didAmount: 0,
   everyMonth: false,
   addMonth: String(now.getMonth() + 1).padStart(2, '0'),
   addYear: String(now.getFullYear())
 }
}

const isEveryMonth = (value: string | boolean | null | undefined) =>
 value === true || value === 'Y' || value === 'y' || value === 'Yes' || value === '1'

const rowKey = (row: TransactionDeduction) =>
 `${row.epfNo}|${row.didCode}|${row.addMonth}|${row.addYear}`

const formatPeriod = (month: string, year: string) => {
 if (!month || !year) return '—'
 return `${month.padStart(2, '0')}/${year}`
}

export default function EmployeeDeductions() {
 const [rows, setRows] = useState<TransactionDeduction[]>([])
 const [employees, setEmployees] = useState<Employee[]>([])
 const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([])
 const [q, setQ] = useState('')
 const [open, setOpen] = useState(false)
 const [editingKey, setEditingKey] = useState<string | null>(null)
 const [deleteKey, setDeleteKey] = useState<string | null>(null)
 const [form, setForm] = useState<DeductionForm>(createEmptyForm())
 const [errors, setErrors] = useState<{ epfNo?: string; didCode?: string; addMonth?: string; addYear?: string }>({})

 useEffect(() => {
   refresh()
   listEmployees().then(setEmployees)
   listDeductionTypes().then(setDeductionTypes)
 }, [])

 function refresh() {
   listTransactionDeductions().then(setRows)
 }

 function handleAdd() {
   setForm(createEmptyForm())
   setEditingKey(null)
   setOpen(true)
 }

 function handleEdit(id: string) {
   const row = rows.find(item => rowKey(item) === id)
   if (!row) return
   setForm({
     epfNo: row.epfNo,
     didCode: row.didCode,
     businessCenter: row.businessCenter || getActiveBusinessCenter(),
     didAmount: Number(row.didAmount || 0),
     everyMonth: isEveryMonth(row.everyMonth),
     addMonth: row.addMonth || '',
     addYear: row.addYear || String(new Date().getFullYear())
   })
   setEditingKey(id)
   setOpen(true)
 }

 function validate() {
   const next: { epfNo?: string; didCode?: string; addMonth?: string; addYear?: string } = {}
   if (!String(form.epfNo || '').trim()) next.epfNo = 'Employee is required'
   if (!String(form.didCode || '').trim()) next.didCode = 'Deduction type is required'
   if (!String(form.addMonth || '').trim()) next.addMonth = 'Month is required'
   if (!String(form.addYear || '').trim()) next.addYear = 'Year is required'
   setErrors(next)
   return Object.keys(next).length === 0
 }

 async function handleSave() {
   if (!validate()) {
     toast.error('Please complete the required fields')
     return
   }

   const payload: TransactionDeduction = {
     epfNo: form.epfNo,
     didCode: form.didCode,
     businessCenter: form.businessCenter || getActiveBusinessCenter(),
     didAmount: Number(form.didAmount || 0),
     everyMonth: form.everyMonth ? 'Y' : 'N',
     addMonth: form.addMonth,
     addYear: form.addYear
   }

   try {
     if (editingKey) {
       const target = rows.find(item => rowKey(item) === editingKey)
       if (!target) return
       await updateTransactionDeduction(target.epfNo, target.didCode, target.addMonth, target.addYear, payload)
       toast.success('Deduction updated')
     } else {
       await createTransactionDeduction(payload)
       toast.success('Deduction added')
     }
     setOpen(false)
     refresh()
   } catch (error) {
     console.error('Save deduction failed', error)
     toast.error('Save failed')
   }
 }

 function handleDeleteConfirm() {
   if (!deleteKey) return
   const row = rows.find(item => rowKey(item) === deleteKey)
   if (!row) {
     setDeleteKey(null)
     return
   }

   removeTransactionDeduction(row.epfNo, row.didCode, row.addMonth, row.addYear).then(() => {
     setDeleteKey(null)
     refresh()
     toast.success('Deduction deleted')
   }).catch(() => {
     toast.error('Failed to delete deduction — please try again')
   })
 }

 const employeeMap = useMemo(
   () => new Map(employees.map(emp => [emp.epfNo, emp])),
   [employees]
 )

 const deductionMap = useMemo(
   () => new Map(deductionTypes.map(type => [type.code, type])),
   [deductionTypes]
 )

 const filteredRows = useMemo(() => {
   const normalizedQuery = q.trim().toLowerCase()
   if (!normalizedQuery) return rows

   return rows.filter(row => {
     const employee = employeeMap.get(row.epfNo)
     const deduction = deductionMap.get(row.didCode)
     const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : ''
     const searchText = `${employeeName} ${row.epfNo} ${deduction?.name || ''} ${row.didCode}`.toLowerCase()
     return searchText.includes(normalizedQuery)
   })
 }, [rows, employeeMap, deductionMap, q])

 const tableData = filteredRows.map(row => {
   const employee = employeeMap.get(row.epfNo)
   const deduction = deductionMap.get(row.didCode)
   const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'Unknown'
   const deductionName = deduction ? deduction.name : row.didCode
   const everyMonthBadge = isEveryMonth(row.everyMonth) ? (
     <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
       Every Month
     </span>
   ) : (
     <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
       One-off
     </span>
   )

   return {
     id: rowKey(row),
     employee: employeeName,
     employeeEpf: row.epfNo,
     deduction: deductionName,
     amount: Number(row.didAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
     period: formatPeriod(row.addMonth, row.addYear),
     businessCenter: row.businessCenter || '—',
     everyMonth: everyMonthBadge,
     sourceId: rowKey(row)
   }
 })

 return (
   <div>
     <div className="mb-4 flex items-center justify-between gap-3">
       <h2 className="text-xl font-semibold text-slate-800">Transaction Deductions</h2>
       <div className="flex items-center gap-2">
         <SearchInput
           value={q}
           onChange={setQ}
           placeholder="Search by employee name or EPF No..."
         />
         <button
           className="rounded-md bg-[#2F6F5E] px-3 py-1.5 text-sm font-medium text-white"
           onClick={handleAdd}
         >
           Add Deduction
         </button>
       </div>
     </div>

     <div className="bg-white rounded-xl shadow-flat overflow-hidden">
       <DataTable
         columns={[
           { key: 'employee', label: 'Employee' },
           { key: 'employeeEpf', label: 'EPF No', className: 'mono-numeric' },
           { key: 'deduction', label: 'Deduction Type' },
           { key: 'amount', label: 'Amount', className: 'mono-numeric text-right' },
           { key: 'period', label: 'Period', className: 'mono-numeric' },
           { key: 'businessCenter', label: 'Business Center' },
           { key: 'everyMonth', label: 'Every Month' },
           { key: 'id', label: 'Actions' }
         ]}
         data={tableData}
         onEdit={handleEdit}
         onDelete={setDeleteKey}
       />
     </div>

     <Modal
       title={editingKey ? 'Edit Deduction' : 'Add Deduction'}
       open={open}
       onClose={() => setOpen(false)}
     >
       <div className="space-y-4">
         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Employee</label>
           <SearchableEmployeeSelect
             value={form.epfNo || undefined}
             onChange={(epf) => {
               setForm(prev => ({ ...prev, epfNo: epf || '' }))
               if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined }))
             }}
           />
           {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
         </div>

         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Deduction Type</label>
           <select
             value={form.didCode}
             onChange={e => { setForm(prev => ({ ...prev, didCode: e.target.value })); if (errors.didCode) setErrors(prev => ({ ...prev, didCode: undefined })) }}
             className={`w-full form-input ${errors.didCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}
           >
             <option value="">Select deduction type</option>
             {deductionTypes.map(type => (
               <option key={type.code} value={type.code}>
                 {type.code} - {type.name}
               </option>
             ))}
           </select>
           {errors.didCode && <p className="mt-1 text-xs text-red-500">{errors.didCode}</p>}
         </div>

         <div className="grid grid-cols-2 gap-3">
           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Amount</label>
             <input
               type="number"
               step="0.01"
               value={form.didAmount}
               onChange={e => setForm(prev => ({ ...prev, didAmount: Number(e.target.value || 0) }))}
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

           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Month</label>
             <select
               value={form.addMonth}
               onChange={e => { setForm(prev => ({ ...prev, addMonth: e.target.value })); if (errors.addMonth) setErrors(prev => ({ ...prev, addMonth: undefined })) }}
               className={`w-full form-input ${errors.addMonth ? 'border-red-300 ring-2 ring-red-100' : ''}`}
             >
               {Array.from({ length: 12 }, (_, index) => {
                 const month = String(index + 1).padStart(2, '0')
                 return <option key={month} value={month}>{month}</option>
               })}
             </select>
             {errors.addMonth && <p className="mt-1 text-xs text-red-500">{errors.addMonth}</p>}
           </div>

           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Year</label>
             <select
               value={form.addYear}
               onChange={e => { setForm(prev => ({ ...prev, addYear: e.target.value })); if (errors.addYear) setErrors(prev => ({ ...prev, addYear: undefined })) }}
               className={`w-full form-input ${errors.addYear ? 'border-red-300 ring-2 ring-red-100' : ''}`}
             >
               {Array.from({ length: 5 }, (_, index) => {
                 const year = String(new Date().getFullYear() - 1 + index)
                 return <option key={year} value={year}>{year}</option>
               })}
             </select>
             {errors.addYear && <p className="mt-1 text-xs text-red-500">{errors.addYear}</p>}
           </div>
         </div>

         <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
           <span className="text-sm font-medium text-slate-700">Every Month</span>
           <input
             type="checkbox"
             checked={form.everyMonth}
             onChange={e => setForm(prev => ({ ...prev, everyMonth: e.target.checked }))}
             className="h-4 w-4"
           />
         </div>

         <div className="flex justify-end gap-2 pt-2">
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
       open={!!deleteKey}
       title="Delete Deduction"
       message="Are you sure you want to delete this deduction record?"
       onConfirm={handleDeleteConfirm}
       onCancel={() => setDeleteKey(null)}
     />
   </div>
 )
}
