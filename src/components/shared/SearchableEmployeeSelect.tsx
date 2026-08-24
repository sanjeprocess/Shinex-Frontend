import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { useQuery } from '@tanstack/react-query'
import { employees as fallbackEmployees } from '../../mocks/employees'
import { sections } from '../../mocks/sections'
import { customers } from '../../mocks/customers'
import type { Employee } from '../../types/employee'

type EmployeeContext = {
 epfNo: string
 employeeName: string
 sectionName: string
 plantName: string
 businessCenter: string
}

export default function SearchableEmployeeSelect({
 value,
 onChange,
 placeholder = 'Search employee by EPF or name'
}: {
 value?: string | null;
 onChange: (epf: string | null, context?: EmployeeContext) => void;
 placeholder?: string
}) {
 const { data: list = [], isLoading } = useQuery(['master', 'employees'], async () => {
   try {
     const res = await api.get('/master/employees')
     return res.data || []
   } catch (err) {
     return []
   }
 })

 const [q, setQ] = useState('')
 useEffect(() => { setQ('') }, [value])

 const employeeCatalog = useMemo(() => {
   const merged = [...fallbackEmployees, ...list]
   const map = new Map<string, Employee>()
   merged.forEach((employee: Employee) => {
     if (employee?.epfNo) {
       map.set(employee.epfNo, { ...map.get(employee.epfNo), ...employee })
     }
   })
   return Array.from(map.values())
 }, [list])

 const selectedEmployee = useMemo(
   () => employeeCatalog.find((employee: Employee) => employee.epfNo === value) || null,
   [employeeCatalog, value]
 )

 const selectedContext = useMemo<EmployeeContext | undefined>(() => {
   if (!selectedEmployee) return undefined

   const sectionName = sections.find((section) => section.code === selectedEmployee.sectionCode)?.name || '—'
   const plantName = customers.find((customer) => customer.code === selectedEmployee.plantCode)?.name || '—'
   const employeeName = `${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim() || '—'
   const businessCenter = selectedEmployee.businessCenter || localStorage.getItem('hsb_active_bc') || '—'

   return {
     epfNo: selectedEmployee.epfNo,
     employeeName,
     sectionName,
     plantName,
     businessCenter
   }
 }, [selectedEmployee])

 const options = useMemo(() => {
   const s = q.trim().toLowerCase()
   if (!s) return employeeCatalog
   return employeeCatalog.filter((employee: Employee) => (
     `${employee.epfNo} ${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase().includes(s)
   ))
 }, [employeeCatalog, q])

 const handleSelect = (employee: Employee | null) => {
   if (!employee) {
     onChange(null, undefined)
     return
   }

   const context: EmployeeContext = {
     epfNo: employee.epfNo,
     employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || '—',
     sectionName: sections.find((section) => section.code === employee.sectionCode)?.name || '—',
     plantName: customers.find((customer) => customer.code === employee.plantCode)?.name || '—',
     businessCenter: employee.businessCenter || localStorage.getItem('hsb_active_bc') || '—'
   }

   onChange(employee.epfNo, context)
 }

 return (
   <div className="relative">
     <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="w-full form-input" />
     <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-flat">
       <div className="max-h-64 overflow-y-auto overscroll-contain scroll-smooth">
         {isLoading ? (
           <div className="p-4 text-sm text-slate-500">Loading employees...</div>
         ) : options.length === 0 ? (
           <div className="p-4 text-sm text-slate-500">No employees</div>
         ) : (
           options.map((employee: Employee) => (
             <button
               key={employee.epfNo}
               type="button"
               onClick={() => handleSelect(employee)}
               className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${value === employee.epfNo ? 'bg-slate-100' : ''}`}
             >
               <div className="text-sm font-medium">{employee.epfNo} - {employee.firstName} {employee.lastName || ''}</div>
             </button>
           ))
         )}
       </div>
     </div>

     {selectedContext && (
       <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
         <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
           <span><span className="font-medium text-slate-700">Name:</span> {selectedContext.employeeName}</span>
           <span><span className="font-medium text-slate-700">Section:</span> {selectedContext.sectionName}</span>
           <span><span className="font-medium text-slate-700">Plant:</span> {selectedContext.plantName}</span>
           <span><span className="font-medium text-slate-700">BC:</span> <span className="mono-numeric">{selectedContext.businessCenter}</span></span>
         </div>
       </div>
     )}
   </div>
 )
}
