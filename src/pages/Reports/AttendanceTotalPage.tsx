import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import A4Report from '../../components/reports/A4Report'
import { list as listBC } from '../../mocks/businessCenters'
import { defaultReportCenter } from '../../components/reports/ReportFilters'
import api from '../../api/axios'

type TotalRow = {
  companyName: string
  employees: number
  daysWorked: number
  halfDays: number
  totalHours: number
  otHours: number
}

const fmt = (n: number, digits = 2) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export default function AttendanceTotalPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>(defaultReportCenter)

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<TotalRow[]>([])

  useEffect(() => {
    listBC().then(setBusinessCenters)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const response = await api.get('/reports/attendance-total', {
        params: { businessCenter: cleanBc || 'ALL', year, month }
      })
      if (!Array.isArray(response.data)) {
        throw new Error('Attendance total report returned an invalid response.')
      }
      setRows(response.data.map((row: any) => ({
        companyName: row.companyName || row.plantCode || '—',
        employees: Number(row.employees || 0),
        daysWorked: Number(row.daysWorked || 0),
        halfDays: Number(row.halfDays || 0),
        totalHours: Number(row.totalHours || 0),
        otHours: Number(row.otHours || 0),
      })))
    } catch (error) {
      setRows([])
      console.error('Attendance total report could not be loaded', error)
      toast.error('Attendance total report could not be loaded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  const columns = ['Company Name', 'Employees', 'Days Worked', 'Half Days', 'Total Hours', 'OT Hours']

  const displayRows = rows.map(r => [
    r.companyName,
    String(r.employees),
    fmt(r.daysWorked, 1),
    String(r.halfDays),
    fmt(r.totalHours),
    fmt(r.otHours),
  ])

  const sum = (pick: (r: TotalRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  const totalRow = [
    'Total',
    String(sum(r => r.employees)),
    fmt(sum(r => r.daysWorked), 1),
    String(sum(r => r.halfDays)),
    fmt(sum(r => r.totalHours)),
    fmt(sum(r => r.otHours)),
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
      title="Attendance - Total"
      subtitle={`Month Of ${month} / ${year}`}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      numericFromColIndex={1}
      rowsPerPage={28}
      isLoading={loading}
      emptyMessage="No attendance for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
