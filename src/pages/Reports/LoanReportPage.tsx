import React, { useState, useEffect } from 'react'
import A4Report, { A4ReportColumn } from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { computeDeductionMetrics } from '../../mocks/deductionTransactions'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

export default function LoanReportPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>('ALL')
  const [selectedClient, setSelectedClient] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
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
      listCustomers(businessCenter),
      listEmployees(businessCenter),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      setSelectedClient(current => custs.some(customer => customer.code === current)
        ? current
        : custs[0]?.code || '')
    })
  }, [businessCenter])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [report, emps] = await Promise.all([
        api.get('/reports/loan', {
          params: { businessCenter: cleanBc || 'ALL', year, month }
        }),
        listEmployees(cleanBc),
      ])
      if (!Array.isArray(report.data)) {
        throw new Error('Loan report returned an invalid response.')
      }
      const refDate = new Date(Number(year), Number(month) - 1, 1)
      const mapped = report.data.map((tx: any) => {
        const employee = emps.find(e => (e.epfNo || '').trim() === (tx.epfNo || '').trim())
        const fullName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : tx.employeeName || tx.epfNo
        const metrics = computeDeductionMetrics(tx, refDate)
        return {
          empId: tx.epfNo,
          name: fullName,
          currentMonthValue: Number(tx.monthlyCut || 0),
          duration: `${metrics.totalMonthsWindow} months`,
          alreadyDeduct: Math.max(0, Number(tx.totalAmount || 0) - metrics.remainingBalance),
          totalLoanValue: Number(tx.totalAmount || 0),
          totalBalance: metrics.remainingBalance
        }
      })
      setLoanRows(mapped)
    } catch (error) {
      setLoanRows([])
      console.error('Loan report could not be loaded', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  const selectedCust = customers.find(c => c.code === selectedClient)
  const clientName = selectedCust ? selectedCust.name : ''

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
      emptyMessage="No data for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
