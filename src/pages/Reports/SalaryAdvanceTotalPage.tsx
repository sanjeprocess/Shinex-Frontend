import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listDeductionTransactions } from '../../mocks/deductionTransactions'
import { formatCurrency } from '../../utils/reportHelpers'

export default function SalaryAdvanceTotalPage() {
  const [year, setYear] = useState<string>('2024')
  const [month, setMonth] = useState<string>('12')
  const [businessCenter, setBusinessCenter] = useState<string>(
    localStorage.getItem('hsb_active_bc') || 'ALL'
  )

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [isFallback, setIsFallback] = useState<boolean>(false)
  const [companyRows, setCompanyRows] = useState<Array<[string, number]>>([])

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers().catch(() => []),
    ]).then(([bcs, custs]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const [custs, txs] = await Promise.all([
        listCustomers(cleanBc).catch(() => []),
        listDeductionTransactions(cleanBc).catch(() => []),
      ])

      // Find advance deductions
      const advanceTxs = txs.filter(t => {
        const name = (t.deductionName || '').toLowerCase()
        const code = (t.didCode || '').toLowerCase()
        return name.includes('advance') || code.includes('adv')
      })

      if (advanceTxs.length > 0 && custs.length > 0) {
        // Group by company
        const map = new Map<string, number>()
        custs.forEach(c => map.set(c.name, 0))
        advanceTxs.forEach(t => {
          // allocate to company or business center
          const key = t.businessCenter || 'Default Company'
          map.set(key, (map.get(key) || 0) + (t.monthlyCut || t.totalAmount || 0))
        })
        const rows = Array.from(map.entries()).filter(([, amt]) => amt > 0)
        if (rows.length > 0) {
          setCompanyRows(rows)
          setIsFallback(false)
          return
        }
      }

      // Default sample companies matching prototype
      const defaultCompanies: Array<[string, number]> = [
        ['ASIAN GROUP OF COMPANIES - COLOMBO 13', 46000],
        ['BCCT RATHMALANA', 17500],
        ['BRANDIX APPAREL SOLUTIONS (PVT) LTD - BATTICALOA', 200000],
        ['BRANDIX APPAREL SOLUTIONS (PVT) LTD - GIRITHALE', 41000],
        ['PORT CITY COLOMBO', 95000],
        ['VARNA LTD - RATHMALANA', 40000],
      ]
      setCompanyRows(defaultCompanies)
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

  const columns = ['Company', 'Advance']

  const displayRows = companyRows.map(([company, amount]) => [
    company,
    formatCurrency(amount),
  ])

  const totalAdvance = companyRows.reduce((acc, [, amt]) => acc + amt, 0)
  const totalRow = ['Total', formatCurrency(totalAdvance)]

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
      title="Salary Advance - Total"
      subtitle={`Month Of ${month} / ${year}`}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      numericFromColIndex={1}
      rowsPerPage={28}
      isLoading={loading}
      isFallback={isFallback}
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
