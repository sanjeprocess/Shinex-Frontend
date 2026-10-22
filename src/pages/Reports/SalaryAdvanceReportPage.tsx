import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listDeductions } from '../../mocks/deductionTransactions'
import { formatCurrency } from '../../utils/reportHelpers'

export default function SalaryAdvanceReportPage() {
  const [year, setYear] = useState<string>('2024')
  const [month, setMonth] = useState<string>('12')
  const [businessCenter, setBusinessCenter] = useState<string>(
    localStorage.getItem('hsb_active_bc') || 'ALL'
  )
  const [selectedClient, setSelectedClient] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [isFallback, setIsFallback] = useState<boolean>(false)
  const [rows, setRows] = useState<Array<[string, string, string, string, number]>>([])

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers().catch(() => []),
      listEmployees().catch(() => []),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      if (custs.length > 0 && !selectedClient) {
        setSelectedClient(custs[0].code)
      }
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [txs, emps] = await Promise.all([
        listDeductions(cleanBc).catch(() => []),
        listEmployees(cleanBc).catch(() => []),
      ])

      // Look for advance deductions
      const advances = txs.filter(t => {
        const name = (t.deductionName || '').toLowerCase()
        const code = (t.didCode || '').toLowerCase()
        return name.includes('advance') || code.includes('adv')
      })

      if (advances.length > 0) {
        const mapped = advances.map(adv => {
          const emp = emps.find(e => (e.epfNo || '').trim() === (adv.epfNo || '').trim())
          const fullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : adv.employeeName || adv.epfNo
          const bankAcc = emp?.bankAccountNumber || '001234567'
          const bankCode = emp?.branchCode || '7056'
          const amt = adv.monthlyCut || adv.totalAmount || 5000
          return [adv.epfNo, fullName, bankAcc, bankCode, amt] as [string, string, string, string, number]
        })
        setRows(mapped)
        setIsFallback(false)
        return
      }

      // Default sample matching prototype
      const defaultRows: Array<[string, string, string, string, number]> = [
        ['E73', 'D M CHANDRALATHA', '001234567', '7056', 5000],
        ['E79', 'R GUNAWATHI', '001234658', '7056', 7500],
        ['E74', 'W A PEMALATHA', '001234749', '7056', 10000],
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

  const selectedCust = customers.find(c => c.code === selectedClient)
  const clientName = selectedCust ? selectedCust.name : 'BRANDIX - RIDIGAMA'

  const metaLeft = (
    <div>
      <div>Year {year}</div>
      <div>Month {month}</div>
      <div>Client Name: {clientName}</div>
    </div>
  )

  const columns = ['Emp_ID', 'Name', 'Bank Account No', 'Bank_Code', 'D_Value']

  const displayRows = rows.map(([empId, name, acc, code, val]) => [
    empId,
    name,
    acc,
    code,
    formatCurrency(val),
  ])

  const totalVal = rows.reduce((acc, [, , , , v]) => acc + v, 0)
  const totalRow = ['', 'Total', '', '', formatCurrency(totalVal)]

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
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[170px]"
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
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px]"
        >
          <option value="">All Clients</option>
          {customers.map(c => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.name}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  return (
    <A4Report
      orientation="portrait"
      title="Salary Advance Report"
      metaLeft={metaLeft}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      numericFromColIndex={4}
      rowsPerPage={28}
      isLoading={loading}
      isFallback={isFallback}
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
