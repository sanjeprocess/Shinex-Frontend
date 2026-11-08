import React, { useEffect, useMemo, useState } from 'react'
import TableCellSearch from '../shared/TableCellSearch'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listEmployees, Employee } from '../../mocks/employees'

const selectClass = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500'

/** "P01", "p01 " or "P01 / Plant Name" to the upper-case code; codes may contain spaces ("BA POL") */
export const plantKey = (value?: string | null) => (value || '').split('/')[0].trim().toUpperCase()

export const cleanBusinessCenter = (businessCenter: string) =>
  businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : 'ALL'

export const employeeFullName = (employee?: Employee | null) =>
  employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : ''

/** The current business center: the login's own, or the one a super admin switched to. */
export const defaultReportCenter = () => (localStorage.getItem('hsb_active_bc') || '').split(' / ')[0].trim() || 'ALL'

/** Years offered by the report filters, newest first */
const lastReportYear = Math.max(2030, new Date().getFullYear())
export const reportYears = Array.from({ length: lastReportYear - 2022 }, (_, i) => String(lastReportYear - i))

/** Year, month, business center and plant state shared by the printed reports. */
export function useReportFilters(defaultToFirstPlant = false) {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>(defaultReportCenter)
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

/** Client box of the reports: type any part of the code or name to find a client. */
export function ClientSearch({ value, onChange, customers, allOption = true }: {
  value: string
  onChange: (code: string) => void
  customers: Customer[]
  allOption?: boolean
}) {
  const options = useMemo(() => [
    ...(allOption ? [{ value: '', label: 'All Clients' }] : []),
    ...customers.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })),
  ], [customers, allOption])
  return (
    <TableCellSearch
      options={options}
      value={value}
      // Without "All Clients" an emptied box keeps the client it had
      onChange={code => { if (code || allOption) onChange(code) }}
      showLabel
      placeholder="Type client code or name"
      ariaLabel="Client"
      maxOptions={1000}
      className="!w-[260px] !py-1.5 !px-2.5 !text-xs !border-slate-300 !rounded-lg"
    />
  )
}

export default function ReportFilters({ filters, showPlant = true, allPlantsOption = true }: { filters: Filters; showPlant?: boolean; allPlantsOption?: boolean }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Year:</label>
        <select value={filters.year} onChange={e => filters.setYear(e.target.value)} className={selectClass}>
          {reportYears.map(y => <option key={y} value={y}>{y}</option>)}
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
          <ClientSearch value={filters.plant} onChange={filters.setPlant} customers={filters.customers} allOption={allPlantsOption} />
        </div>
      )}
    </>
  )
}
