import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listDeductionTransactions } from '../../mocks/deductionTransactions'
import { formatCurrency } from '../../utils/reportHelpers'

export default function TelephoneDeductReportPage() {
  const [year, setYear] = useState<string>('2024')
  const [month, setMonth] = useState<string>('12')
  const [businessCenter, setBusinessCenter] = useState<string>(
    localStorage.getItem('hsb_active_bc') || 'ALL'
  )

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [isFallback, setIsFallback] = useState<boolean>(false)
  const [rows, setRows] = useState<Array<[string, string, string, number]>>([])

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers().catch(() => []),
      listEmployees().catch(() => []),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [txs, emps, custs] = await Promise.all([
        listDeductionTransactions(cleanBc).catch(() => []),
        listEmployees(cleanBc).catch(() => []),
        listCustomers(cleanBc).catch(() => []),
      ])

      // Look for deduction transactions whose master name is Telephone
      const telTxs = txs.filter(t => {
        const name = (t.deductionName || '').toLowerCase()
        const code = (t.didCode || '').toLowerCase()
        return name.includes('telephone') || name.includes('phone') || code.includes('tel')
      })

      if (telTxs.length > 0) {
        const mapped = telTxs.map(t => {
          const emp = emps.find(e => (e.epfNo || '').trim() === (t.epfNo || '').trim())
          const fullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : t.employeeName || t.epfNo
          const cust = custs.find(c => c.code === emp?.plantCode)
          const custName = cust ? cust.name : 'BRANDIX APPAREL SOLUTIONS - RIDIGAMA'
          const amt = t.monthlyCut || t.totalAmount || 450
          return [t.epfNo, fullName, custName, amt] as [string, string, string, number]
        })
        setRows(mapped)
        setIsFallback(false)
        return
      }

      // Default sample matching prototype
      const defaultRows: Array<[string, string, string, number]> = [
        ['E73', 'D M CHANDRALATHA', 'BRANDIX APPAREL SOLUTIONS - RIDIGAMA', 450],
        ['E79', 'R GUNAWATHI', 'BRANDIX APPAREL SOLUTIONS - RIDIGAMA', 600],
        ['E74', 'W A PEMALATHA', 'BRANDIX APPAREL SOLUTIONS - RIDIGAMA', 750],
      ]
      setRows(defaultRows)
      setIsFallback(true)
    } catch {
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const metaLeft = (
    <div>
      <div>Year {year}</div>
      <div>Month {month}</div>
    </div>
  )

  const columns = ['Emp_ID', 'Name', 'Customer Name', 'D_Value']

  const displayRows = rows.map(([empId, name, cust, amt]) => [
    empId,
    name,
    cust,
    formatCurrency(amt),
  ])

  const totalDVal = rows.reduce((acc, [, , , amt]) => acc + amt, 0)
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
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
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
      isFallback={isFallback}
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
