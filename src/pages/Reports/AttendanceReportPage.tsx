import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import A4Report from '../../components/reports/A4Report'
import { Attendance } from '../../mocks/attendance'
import { list as listEmployees } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import api from '../../api/axios'
import { formatDateDdMmmYyyy, formatTimeAmPm, decimalToHmm, formatCurrency } from '../../utils/reportHelpers'

// Actual time between In and Off, as printed on the sheet (7:16 am - 6:30 pm = 11.23)
function clockHours(a: Attendance): number {
  if (!a.timeIn || !a.timeOut) return 0
  const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
  let diff = minutes(a.timeOut) - minutes(a.timeIn)
  if (diff < 0) diff += 24 * 60
  return diff / 60
}

// 11.25 hours prints as 11.15 (hours.minutes)
const hoursDotMinutes = (hours: number) => decimalToHmm(hours).replace(':', '.')

export default function AttendanceReportPage() {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [businessCenter, setBusinessCenter] = useState<string>('ALL')
  const [selectedPlant, setSelectedPlant] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const requestId = useRef(0)

  useEffect(() => {
    Promise.all([
      listBC(),
      listCustomers(businessCenter),
      listEmployees(businessCenter),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      // Keep "All Plants" selected unless the chosen plant no longer exists in this business center
      setSelectedPlant(current => !current || custs.some(customer => customer.code === current) ? current : '')
    })
  }, [businessCenter])

  const loadData = async () => {
    const thisRequest = ++requestId.current
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const response = await api.get('/reports/attendance', {
        params: { businessCenter: cleanBc || 'ALL', year, month, plant: selectedPlant || undefined }
      })
      if (!Array.isArray(response.data)) {
        throw new Error('Attendance report returned an invalid response.')
      }
      if (thisRequest !== requestId.current) return
      setAttendanceList(response.data.map((row: any) => ({
        ...row,
        atttYear: row.attYear || row.atttYear,
        dasForAttAllowance: row.daysForAttAllowance ?? row.dasForAttAllowance
      })))
    } catch (error) {
      if (thisRequest !== requestId.current) return
      setAttendanceList([])
      console.error('Attendance report could not be loaded', error)
      toast.error('Attendance report could not be loaded')
    } finally {
      if (thisRequest === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month, selectedPlant])

  const selectedCustObj = customers.find(c => c.code === selectedPlant)
  const plantTitle = selectedCustObj?.name || 'Attendance Report - All Plants'

  const metaLeft = <strong>{selectedCustObj?.address1 || selectedCustObj?.code || ''}</strong>
  const metaRight = <div>Year : {year} &nbsp;&nbsp; Month : {month}</div>

  const columns = [
    'Name',
    'Emp No',
    'In Date',
    'In Time',
    'Off Date',
    'Off Time',
    'Total Hours',
    'Total Hours In H:MM',
    'OT Hours',
    'OT Hours H:MM',
    'Meal',
    'Meal Value',
    'OT Min',
    'Rate Value',
    'Day Shift',
    'Normal Day',
  ]

  const cleanPlant = selectedPlant.trim().toUpperCase()
  const filtered = attendanceList.filter(a => {
    if (!cleanPlant) return true
    return (a.plantCode || a.customerCode || '').trim().toUpperCase() === cleanPlant
  })

  // Group by employee (numeric-aware EPF order), then by date
  filtered.sort((a, b) =>
    (a.epfNo || '').trim().localeCompare((b.epfNo || '').trim(), undefined, { numeric: true })
    || (a.dayIn || '').localeCompare(b.dayIn || '')
    || (a.timeIn || '').localeCompare(b.timeIn || ''))

  const displayRows: any[][] = filtered.map(a => {
    const emp = employees.find(e => (e.epfNo || '').trim() === (a.epfNo || '').trim())
    const empFullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (a.employeeName || '').trim()
    const totalHours = clockHours(a)
    const otHours = a.totalOt || 0
    const hasOut = !!a.timeOut

    return [
      `${empFullName || a.epfNo}-${(a.epfNo || '').trim()}`,
      a.epfNo,
      formatDateDdMmmYyyy(a.dayIn),
      formatTimeAmPm(a.timeIn),
      hasOut ? formatDateDdMmmYyyy(a.dayOut || a.dayIn) : '—',
      hasOut ? formatTimeAmPm(a.timeOut) : '—',
      totalHours.toFixed(2),
      hoursDotMinutes(totalHours),
      otHours.toFixed(2),
      hoursDotMinutes(otHours),
      (a.noOfMeal || 0).toFixed(2),
      formatCurrency(a.totalMealValue || 0),
      '0.00',
      formatCurrency(a.dayAllowance || 0),
      a.dayShift || '',
      a.normalDay || '',
    ]
  })

  const totalHours = filtered.reduce((sum, a) => sum + clockHours(a), 0)
  const totalOt = filtered.reduce((sum, a) => sum + (a.totalOt || 0), 0)
  const totalMeals = filtered.reduce((sum, a) => sum + (a.noOfMeal || 0), 0)
  const totalMealValue = filtered.reduce((sum, a) => sum + (a.totalMealValue || 0), 0)
  const employeeCount = new Set(filtered.map(a => (a.epfNo || '').trim())).size

  const totalRow = filtered.length > 0 ? [
    'Total',
    `${employeeCount} Emp`,
    '',
    '',
    '',
    '',
    totalHours.toFixed(2),
    hoursDotMinutes(totalHours),
    totalOt.toFixed(2),
    hoursDotMinutes(totalOt),
    totalMeals.toFixed(2),
    formatCurrency(totalMealValue),
    '',
    '',
    '',
    '',
  ] : undefined

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
        <label className="text-xs font-semibold text-slate-600">Plant / Customer:</label>
        <select
          value={selectedPlant}
          onChange={e => setSelectedPlant(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[220px]"
        >
          <option value="">All Plants / Customers</option>
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
      title={plantTitle}
      metaLeft={metaLeft}
      metaRight={metaRight}
      columns={columns}
      rows={displayRows}
      totalRow={totalRow}
      numericFromColIndex={6}
      rowsPerPage={22}
      tableClassName="compact"
      isLoading={loading}
      emptyMessage="No attendance for the selected filters."
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
