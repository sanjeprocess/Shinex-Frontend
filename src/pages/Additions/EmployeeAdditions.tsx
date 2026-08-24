import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import SearchInput from '../../components/SearchInput'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../mocks/employees'
import { list as listAdditionTypes } from '../../mocks/additions'
import {
 list as listTransactionAdditions,
 create as createTransactionAddition,
 update as updateTransactionAddition,
 remove as removeTransactionAddition,
 type TransactionAddition
} from '../../mocks/transactionAdditions'
import type { Employee } from '../../types/employee'

type FormState = {
 epfNo: string
 addCode: string
 businessCenter: string
 addAmount: number
 everyMonth: boolean
 addMonth: number
 addYear: string
}

const getActiveBusinessCenter = () => {
 if (typeof window === 'undefined') return '001'
 return localStorage.getItem('hsb_active_bc') || '001'
}

const createEmptyForm = (): FormState => {
 const now = new Date()
 return {
   epfNo: '',
   addCode: '',
   businessCenter: getActiveBusinessCenter(),
   addAmount: 0,
   everyMonth: false,
   addMonth: now.getMonth() + 1,
   addYear: String(now.getFullYear())
 }
}

const rowKey = (row: TransactionAddition) => `${row.epfNo}|${row.addCode}|${row.addMonth}|${row.addYear}`

export default function EmployeeAdditions() {
 const [rows, setRows] = useState<TransactionAddition[]>([])
 const [employees, setEmployees] = useState<Employee[]>([])
 const [types, setTypes] = useState<any[]>([])
 const [q, setQ] = useState('')
 const [open, setOpen] = useState(false)
 const [editingKey, setEditingKey] = useState<string | null>(null)
 const [deleteKey, setDeleteKey] = useState<string | null>(null)
 const [form, setForm] = useState<FormState>(createEmptyForm())
 const [errors, setErrors] = useState<{ epfNo?: string; addCode?: string }>({})

 useEffect(() => {
   refresh()
   listEmployees().then(setEmployees)
   listAdditionTypes().then(setTypes)
 }, [])

 function refresh() {
   listTransactionAdditions().then(setRows)
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
     addCode: row.addCode,
     businessCenter: row.businessCenter || getActiveBusinessCenter(),
     addAmount: Number(row.addAmount || 0),
     everyMonth: row.everyMonth === true || row.everyMonth === 'Y' || row.everyMonth === 'y',
     addMonth: Number(row.addMonth || 1),
     addYear: row.addYear || String(new Date().getFullYear())
   })
   setEditingKey(id)
   setOpen(true)
 }

 function validate() {
   const next: { epfNo?: string; addCode?: string } = {}
   if (!String(form.epfNo || '').trim()) next.epfNo = 'Employee is required'
   if (!String(form.addCode || '').trim()) next.addCode = 'Addition type is required'
   setErrors(next)
   return Object.keys(next).length === 0
 }

 async function handleSave() {
   if (!validate()) {
     toast.error('Please complete the required fields')
     return
   }

   const payload: TransactionAddition = {
     epfNo: form.epfNo,
     addCode: form.addCode,
     businessCenter: form.businessCenter || getActiveBusinessCenter(),
     addAmount: Number(form.addAmount || 0),
     everyMonth: form.everyMonth ? 'Y' : 'N',
     addMonth: Number(form.addMonth || 1),
     addYear: form.addYear
   }

   try {
     if (editingKey) {
       const target = rows.find(item => rowKey(item) === editingKey)
       if (!target) return
       await updateTransactionAddition(target.epfNo, target.addCode, target.addMonth, target.addYear, payload)
       toast.success('Addition updated')
     } else {
       await createTransactionAddition(payload)
       toast.success('Addition added')
     }
     setOpen(false)
     refresh()
   } catch (error) {
     console.error('Save addition failed', error)
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

   removeTransactionAddition(row.epfNo, row.addCode, row.addMonth, row.addYear).then(() => {
     setDeleteKey(null)
     refresh()
     toast.success('Addition deleted')
   }).catch(() => {
     toast.error('Failed to delete addition — please try again')
   })
 }

 const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.epfNo, emp])), [employees])
 const additionTypeMap = useMemo(() => new Map(types.map(type => [type.code, type])), [types])

 const filteredRows = useMemo(() => {
   const normalized = q.trim().toLowerCase()
   if (!normalized) return rows

   return rows.filter(row => {
     const employee = employeeMap.get(row.epfNo)
     const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : ''
     const additionType = additionTypeMap.get(row.addCode)?.name || row.addCode
     const searchText = `${employeeName} ${row.epfNo} ${additionType} ${row.addCode}`.toLowerCase()
     return searchText.includes(normalized)
   })
 }, [rows, employeeMap, additionTypeMap, q])

 const tableData = filteredRows.map(row => {
   const employee = employeeMap.get(row.epfNo)
   const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'Unknown'
   const additionName = additionTypeMap.get(row.addCode)?.name || row.addCode
   const everyMonthBadge = row.everyMonth === true || row.everyMonth === 'Y' || row.everyMonth === 'y' ? (
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
     epfNo: row.epfNo,
     additionType: additionName,
     amount: Number(row.addAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
     period: `${String(row.addMonth).padStart(2, '0')}/${row.addYear}`,
     businessCenter: row.businessCenter || '—',
     everyMonth: everyMonthBadge
   }
 })

 return (
   <div>
     <div className="mb-4 flex items-center justify-between gap-3">
       <h2 className="text-xl font-semibold text-slate-800">Transaction Additions</h2>
       <div className="flex items-center gap-2">
         <SearchInput value={q} onChange={setQ} placeholder="Search by employee name or EPF No..." />
         <button className="rounded-md bg-[#2F6F5E] px-3 py-1.5 text-sm font-medium text-white" onClick={handleAdd}>
           Add Addition
         </button>
       </div>
     </div>

     <div className="overflow-hidden rounded-xl bg-white shadow-flat">
       <DataTable
         columns={[
           { key: 'employee', label: 'Employee' },
           { key: 'epfNo', label: 'EPF No', className: 'mono-numeric' },
           { key: 'additionType', label: 'Addition Type' },
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

     <Modal title={editingKey ? 'Edit Addition' : 'Add Addition'} open={open} onClose={() => setOpen(false)}>
       <div className="space-y-4">
         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Employee</label>
           <SearchableEmployeeSelect value={form.epfNo || undefined} onChange={(epf) => { setForm(prev => ({ ...prev, epfNo: epf || '' })); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} />
           {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
         </div>

         <div className="space-y-2">
           <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Addition Type</label>
           <select
             value={form.addCode}
             onChange={e => { setForm(prev => ({ ...prev, addCode: e.target.value })); if (errors.addCode) setErrors(prev => ({ ...prev, addCode: undefined })) }}
             className={`w-full form-input ${errors.addCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}
           >
             <option value="">Select addition type</option>
             {types.map(type => (
               <option key={type.code} value={type.code}>{type.code} - {type.name}</option>
             ))}
           </select>
           {errors.addCode && <p className="mt-1 text-xs text-red-500">{errors.addCode}</p>}
         </div>

         <div className="grid grid-cols-2 gap-3">
           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Amount</label>
             <input
               type="number"
               step="0.01"
               value={form.addAmount}
               onChange={e => setForm(prev => ({ ...prev, addAmount: Number(e.target.value || 0) }))}
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
               onChange={e => setForm(prev => ({ ...prev, addMonth: Number(e.target.value) }))}
               className="w-full form-input"
             >
               {Array.from({ length: 12 }, (_, index) => (
                 <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, '0')}</option>
               ))}
             </select>
           </div>

           <div className="space-y-2">
             <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Year</label>
             <select
               value={form.addYear}
               onChange={e => setForm(prev => ({ ...prev, addYear: e.target.value }))}
               className="w-full form-input"
             >
               {Array.from({ length: 5 }, (_, index) => {
                 const year = String(new Date().getFullYear() - 1 + index)
                 return <option key={year} value={year}>{year}</option>
               })}
             </select>
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
       title="Delete Addition"
       message="Are you sure you want to delete this addition record?"
       onConfirm={handleDeleteConfirm}
       onCancel={() => setDeleteKey(null)}
     />
   </div>
 )
}
