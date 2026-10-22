import React, { useState, useEffect } from 'react'
import A4Report, { A4ReportColumn } from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listDeductionTransactions, computeDeductionMetrics } from '../../mocks/deductionTransactions'
import { formatCurrency } from '../../utils/reportHelpers'

export default function LoanReportPage() {
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
  const [loanRows, setLoanRows] = useState<
    Array<{
      empId: string
      name: string
      currentMonthValue: number
      duration: string
      alreadyDeduct: number
      totalLoanValue: number
      totalBalance: number
    }>
  >([])

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
        listDeductionTransactions(cleanBc).catch(() => []),
        listEmployees(cleanBc).catch(() => []),
      ])

      // Filter deduction transactions where isLoan = true
      const loanTxs = txs.filter(t => t.isLoan === true)

      if (loanTxs.length > 0) {
        const refDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
        const mapped = loanTxs.map(tx => {
          const emp = emps.find(e => (e.epfNo || '').trim() === (tx.epfNo || '').trim())
          const fullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : tx.employeeName || tx.epfNo
          const metrics = computeDeductionMetrics(tx, refDate)
          const alreadyDeducted = Math.max(0, tx.totalAmount - metrics.remainingBalance)

          return {
            empId: tx.epfNo,
            name: fullName,
            currentMonthValue: tx.monthlyCut,
            duration: `${metrics.totalMonthsWindow || 6} months`,
            alreadyDeduct: alreadyDeducted,
            totalLoanValue: tx.totalAmount,
            totalBalance: metrics.remainingBalance,
          }
        })
        setLoanRows(mapped)
        setIsFallback(false)
        return
      }

      // Default sample matching prototype
      const defaultLoans = [
        {
          empId: 'E73',
          name: 'D M CHANDRALATHA',
          currentMonthValue: 2000,
          duration: '6 months',
          alreadyDeduct: 4000,
          totalLoanValue: 12000,
          totalBalance: 8000,
        },
        {
          empId: 'E79',
          name: 'R GUNAWATHI',
          currentMonthValue: 2000,
          duration: '9 months',
          alreadyDeduct: 6000,
          totalLoanValue: 18000,
          totalBalance: 12000,
        },
        {
          empId: 'E74',
          name: 'W A PEMALATHA',
          currentMonthValue: 2000,
          duration: '12 months',
          alreadyDeduct: 8000,
          totalLoanValue: 24000,
          totalBalance: 16000,
        },
      ]
      setLoanRows(defaultLoans)
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

  const columns: A4ReportColumn[] = [
    { header: 'Emp_ID', align: 'left' },
    { header: 'Name', align: 'left' },
    { header: 'Current Month Value', align: 'right' },
    { header: 'Loan Duration', align: 'left' },
    { header: 'Already Deduct', align: 'right' },
    { header: 'Total Loan Value', align: 'right' },
    { header: 'Total Balance', align: 'right' },
  ]

  const displayRows = loanRows.map(r => [
    r.empId,
    r.name,
    formatCurrency(r.currentMonthValue),
    r.duration,
    formatCurrency(r.alreadyDeduct),
    formatCurrency(r.totalLoanValue),
    formatCurrency(r.totalBalance),
  ])

  const sumCur = loanRows.reduce((a, b) => a + b.currentMonthValue, 0)
  const sumAlready = loanRows.reduce((a, b) => a + b.alreadyDeduct, 0)
  const sumTotal = loanRows.reduce((a, b) => a + b.totalLoanValue, 0)
  const sumBal = loanRows.reduce((a, b) => a + b.totalBalance, 0)

  const totalRow = [
    '',
    'Total',
    formatCurrency(sumCur),
    '',
    formatCurrency(sumAlready),
    formatCurrency(sumTotal),
    formatCurrency(sumBal),
  ]

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
      orientation="landscape"
      title="Loan Report"
      metaLeft={metaLeft}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      rowsPerPage={18}
      isLoading={loading}
      isFallback={isFallback}
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
