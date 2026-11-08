import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'
import { ClientSearch, defaultReportCenter, plantKey, reportYears } from '../../components/reports/ReportFilters'

export default function TelephoneDeductReportPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>(defaultReportCenter)
  const [selectedClient, setSelectedClient] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<Array<[string, string, string, number]>>([])

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers(businessCenter),
      listEmployees(businessCenter),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      setSelectedClient(current => custs.some(c => c.code === current) ? current : '')
    })
  }, [businessCenter])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [report, emps, custs] = await Promise.all([
        api.get('/reports/telephone-deduct', {
          params: { businessCenter: cleanBc || 'ALL', year, month }
        }),
        listEmployees(cleanBc),
        listCustomers(cleanBc),
      ])
      if (!Array.isArray(report.data)) {
        throw new Error('Telephone deduction report returned an invalid response.')
      }
      const mapped = report.data.map((item: any) => {
        const employee = emps.find(e => (e.epfNo || '').trim() === (item.epfNo || '').trim())
        const fullName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : item.employeeName || item.epfNo
        const customer = custs.find(c => plantKey(c.code) === plantKey(employee?.plantCode))
        return [item.epfNo, fullName, customer?.name || '', Number(item.monthlyCut ?? 0)] as [string, string, string, number]
      })
      setRows(mapped)
    } catch (error) {
      setRows([])
      console.error('Telephone deduction report could not be loaded', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  const metaLeft = (
    <div>
      <div>Year {year}</div>
      <div>Month {month}</div>
    </div>
  )

  const columns = ['Emp_ID', 'Name', 'Customer Name', 'D_Value']

  const plantOf = (epfNo: string) => employees.find(e => (e.epfNo || '').trim() === (epfNo || '').trim())?.plantCode
  const visibleRows = selectedClient ? rows.filter(([empId]) => plantKey(plantOf(empId)) === plantKey(selectedClient)) : rows

  const displayRows = visibleRows.map(([empId, name, cust, amt]) => [
    empId,
    name,
    cust,
    formatCurrency(amt),
  ])

  const totalDVal = visibleRows.reduce((acc, [, , , amt]) => acc + amt, 0)
  const totalRow = ['', 'Total', '', formatCurrency(totalDVal)]

  const filterControls = (
    <>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Year:</label>
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {reportYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Month:</label>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return (
              <option key={m} value={m}>
                {m}
              </option>
            )
          })}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Business Center:</label>
        <select
          value={businessCenter}
          onChange={e => setBusinessCenter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[180px]"
        >
          <option value="ALL">All Business Centers</option>
          {businessCenters.map((b: any) => (
            <option key={b.code || b.id} value={b.code}>
              {b.code} - {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Client:</label>
        <ClientSearch value={selectedClient} onChange={setSelectedClient} customers={customers} />
      </div>
    </>
  )

  return (
    <A4Report
      orientation="portrait"
      title="Telephone Deduct Report"
      metaLeft={metaLeft}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      numericFromColIndex={3}
      rowsPerPage={28}
      isLoading={loading}
      emptyMessage="No data for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
