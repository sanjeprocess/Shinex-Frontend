import React, { useEffect, useState } from 'react'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listEmployees, Employee } from '../../mocks/employees'

const selectClass = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500'

/** "P01", "p01 " or "P01 / Plant Name" to the bare upper-case code */
export const plantKey = (value?: string | null) => (value || '').split(/\s|\//)[0].trim().toUpperCase()

export const cleanBusinessCenter = (businessCenter: string) =>
  businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : 'ALL'

export const employeeFullName = (employee?: Employee | null) =>
  employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : ''

/** Year, month, business center and plant state shared by the printed reports. */
export function useReportFilters(defaultToFirstPlant = false) {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>('ALL')
  const [plant, setPlant] = useState<string>('')
  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    listBC().then(setBusinessCenters).catch(() => setBusinessCenters([]))
  }, [])

  useEffect(() => {
    Promise.all([
      listCustomers(businessCenter).catch(() => []),
      listEmployees(businessCenter).catch(() => []),
    ]).then(([custs, emps]) => {
      setCustomers(custs)
      setEmployees(emps)
      setPlant(current => custs.some(c => c.code === current) ? current : (defaultToFirstPlant ? custs[0]?.code || '' : ''))
    })
  }, [businessCenter])

  return { year, setYear, month, setMonth, businessCenter, setBusinessCenter, plant, setPlant, businessCenters, customers, employees }
}

type Filters = ReturnType<typeof useReportFilters>

export default function ReportFilters({ filters, showPlant = true, allPlantsOption = true }: { filters: Filters; showPlant?: boolean; allPlantsOption?: boolean }) {
  const thisYear = new Date().getFullYear()
  return (
    <>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Year:</label>
        <select value={filters.year} onChange={e => filters.setYear(e.target.value)} className={selectClass}>
          {Array.from({ length: 5 }, (_, i) => String(thisYear + 1 - i)).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Month:</label>
        <select value={filters.month} onChange={e => filters.setMonth(e.target.value)} className={selectClass}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Business Center:</label>
        <select value={filters.businessCenter} onChange={e => filters.setBusinessCenter(e.target.value)} className={`${selectClass} max-w-[180px]`}>
          <option value="ALL">All Business Centers</option>
          {filters.businessCenters.map((b: any) => <option key={b.code || b.id} value={b.code}>{b.code} - {b.name}</option>)}
        </select>
      </div>

      {showPlant && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-600">Client:</label>
          <select value={filters.plant} onChange={e => filters.setPlant(e.target.value)} className={`${selectClass} max-w-[220px]`}>
            {allPlantsOption && <option value="">All Clients</option>}
            {filters.customers.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
          </select>
        </div>
      )}
    </>
  )
}
