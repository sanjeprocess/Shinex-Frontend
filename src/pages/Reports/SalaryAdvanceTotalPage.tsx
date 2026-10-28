import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listBC } from '../../mocks/businessCenters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

export default function SalaryAdvanceTotalPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>('ALL')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [companyRows, setCompanyRows] = useState<Array<[string, number]>>([])

  useEffect(() => {
    listBC().then(setBusinessCenters)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const response = await api.get('/reports/salary-advance-total', {
        params: { businessCenter: cleanBc || 'ALL', year, month }
      })
      if (!Array.isArray(response.data)) {
        throw new Error('Salary advance total report returned an invalid response.')
      }
      setCompanyRows(response.data.map((row: any) => [row.companyName || row.businessCenter, Number(row.amount || 0)]))
    } catch (error) {
      console.warn('Salary advance total endpoint failed, calculating from deduction transactions', error)
      try {
        const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
        const transRes = await api.get('/deduction-transactions', { params: { businessCenter: cleanBc || undefined } }).catch(() => ({ data: [] }))
        const list = Array.isArray(transRes.data) ? transRes.data : []
        const plantSums: Record<string, number> = {}
        list.forEach((d: any) => {
          const code = (d.didCode || '').toLowerCase()
          const name = (d.deductionName || '').toLowerCase()
          if (!code.includes('adv') && !name.includes('advance')) return
          if (d.status && d.status.toUpperCase() !== 'ACTIVE') return
          const targetStr = `${year}-${String(month).padStart(2, '0')}`
          const s = (d.startDate || '').slice(0, 7)
          const e = (d.endDate || '').slice(0, 7)
          if (s && targetStr < s) return
          if (e && targetStr > e) return
          const plantKey = d.businessCenter || 'Company'
          plantSums[plantKey] = (plantSums[plantKey] || 0) + Number(d.monthlyCut || 0)
        })
        setCompanyRows(Object.entries(plantSums))
      } catch {
        setCompanyRows([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

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
      emptyMessage="No data for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
