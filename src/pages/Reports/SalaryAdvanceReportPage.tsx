import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

export default function SalaryAdvanceReportPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>('ALL')
  const [selectedClient, setSelectedClient] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<Array<[string, string, string, string, string, number, number]>>([])

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers(businessCenter),
      listEmployees(businessCenter),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
    })
  }, [businessCenter])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [report, emps] = await Promise.all([
        api.get('/reports/salary-advance', {
          params: { businessCenter: cleanBc || 'ALL', year, month, plant: selectedClient || undefined }
        }),
        listEmployees(cleanBc),
      ])
      if (!Array.isArray(report.data)) {
        throw new Error('Salary advance report returned an invalid response.')
      }
      const mapped = report.data.map((advance: any) => {
        const employee = emps.find(e => (e.epfNo || '').trim() === (advance.epfNo || '').trim())
        const fullName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : advance.employeeName || advance.epfNo
        const plantDisplay = advance.plantCode || employee?.plantCode || '—'
        return [
          advance.epfNo,
          fullName,
          plantDisplay,
          employee?.bankAccountNumber || '',
          employee?.branchCode || '',
          Number(advance.totalAmount ?? 0),
          Number(advance.monthlyCut ?? 0)
        ] as [string, string, string, string, string, number, number]
      })
      setRows(mapped)
    } catch (error) {
      console.warn('Salary advance endpoint failed, falling back to deduction transactions', error)
      try {
        const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
        const [transRes, emps] = await Promise.all([
          api.get('/deduction-transactions', { params: { businessCenter: cleanBc || undefined } }).catch(() => ({ data: [] })),
          listEmployees(cleanBc)
        ])
        const list = Array.isArray(transRes.data) ? transRes.data : []
        const filtered = list.filter((d: any) => {
          const code = (d.didCode || '').toLowerCase()
          const name = (d.deductionName || '').toLowerCase()
          const isAdv = code.includes('adv') || name.includes('advance')
          if (!isAdv) return false
          if (d.status && d.status.toUpperCase() !== 'ACTIVE') return false
          const targetStr = `${year}-${String(month).padStart(2, '0')}`
          const s = (d.startDate || '').slice(0, 7)
          const e = (d.endDate || '').slice(0, 7)
          if (s && targetStr < s) return false
          if (e && targetStr > e) return false
          return true
        })
        const mapped = filtered.map((advance: any) => {
          const employee = emps.find(e => (e.epfNo || '').trim() === (advance.epfNo || '').trim())
          const fullName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : advance.employeeName || advance.epfNo
          const plantDisplay = advance.plantCode || employee?.plantCode || '—'
          return [
            advance.epfNo,
            fullName,
            plantDisplay,
            employee?.bankAccountNumber || '',
            employee?.branchCode || '',
            Number(advance.totalAmount ?? 0),
            Number(advance.monthlyCut ?? 0)
          ] as [string, string, string, string, string, number, number]
        })
        setRows(mapped)
      } catch {
        setRows([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month, selectedClient])

  const selectedCust = customers.find(c => c.code === selectedClient)
  const clientName = selectedCust ? `${selectedCust.code} - ${selectedCust.name}` : (selectedClient || 'All Plants')

  const metaLeft = (
    <div>
      <div>Year: {year}</div>
      <div>Month: {month}</div>
      <div>Plant / Client: {clientName}</div>
    </div>
  )

  const columns = ['Emp_ID', 'Name', 'Plant', 'Bank Account No', 'Bank_Code', 'Total Advance', 'Monthly Cut']

  const displayRows = rows.map(([empId, name, plant, acc, code, totAdv, cutVal]) => [
    empId,
    name,
    plant,
    acc,
    code,
    formatCurrency(totAdv),
    formatCurrency(cutVal),
  ])

  const grandTotalAdvance = rows.reduce((acc, [, , , , , totAdv]) => acc + totAdv, 0)
  const grandMonthlyCut = rows.reduce((acc, [, , , , , , cutVal]) => acc + cutVal, 0)
  const totalRow = ['', 'Total', '', '', '', formatCurrency(grandTotalAdvance), formatCurrency(grandMonthlyCut)]

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
      emptyMessage="No data for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
