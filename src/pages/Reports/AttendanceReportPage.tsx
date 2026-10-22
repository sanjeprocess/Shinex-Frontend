import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { list as listAttendance, Attendance } from '../../mocks/attendance'
import { list as listEmployees } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import { formatDateDdMmmYyyy, formatTimeAmPm, decimalToHmm, formatCurrency } from '../../utils/reportHelpers'

export default function AttendanceReportPage() {
  const [year, setYear] = useState<string>('2024')
  const [month, setMonth] = useState<string>('12')
  const [businessCenter, setBusinessCenter] = useState<string>(
    localStorage.getItem('hsb_active_bc') || 'ALL'
  )
  const [selectedPlant, setSelectedPlant] = useState<string>('')

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([])
  const [isFallback, setIsFallback] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [hasGenerated, setHasGenerated] = useState<boolean>(false)

  useEffect(() => {
    Promise.all([
      listBC().catch(() => []),
      listCustomers().catch(() => []),
      listEmployees().catch(() => []),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      if (custs.length > 0 && !selectedPlant) {
        setSelectedPlant(custs[0].code)
      }
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const res = await listAttendance(cleanBc)
      setAttendanceList(res)
      // Check if fallback was used
      const rawStored = localStorage.getItem('hsb_attendance_data')
      setIsFallback(!!rawStored && res.length > 0)
      setHasGenerated(true)
    } catch {
      setIsFallback(true)
      setHasGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadData()
  }, [])

  const selectedCustObj = customers.find(c => c.code === selectedPlant)
  const plantTitle = selectedCustObj
    ? `${selectedCustObj.name} - ${selectedCustObj.address || selectedCustObj.code}`
    : 'BRANDIX APPAREL SOLUTIONS (PVT) LTD - RIDIGAMA'

  const metaLeft = (
    <div>
      <div>{selectedCustObj ? selectedCustObj.name : 'Ridigama'}</div>
      <div>
        Year : {year} &nbsp; Month : {month}
      </div>
    </div>
  )

  const columns = [
    'Name',
    'Emp No',
    'In Date',
    'In Time',
    'Off Date',
    'Off Time',
    'Total Hours',
    'Hours H:MM',
    'OT Hours',
    'OT H:MM',
    'Meal',
    'Meal Value',
    'OT Min',
    'Rate Value',
    'Day Shift',
    'Normal Day',
  ]

  // Filter attendance by year, month, and selected plant
  const cleanYear = year.trim()
  const cleanMonth = month.trim().padStart(2, '0')

  let filtered = attendanceList.filter(a => {
    const matchYear =
      a.atttYear === cleanYear || (a.dayIn && a.dayIn.startsWith(cleanYear))
    const matchMonth =
      a.attMonth === cleanMonth ||
      (a.dayIn && a.dayIn.slice(5, 7) === cleanMonth) ||
      (a.dayIn && parseInt(a.dayIn.slice(5, 7), 10) === parseInt(cleanMonth, 10))
    const matchPlant = !selectedPlant || a.plantCode === selectedPlant || a.customerCode === selectedPlant
    return matchYear && matchMonth && matchPlant
  })

  // Group by employee
  filtered.sort((a, b) => (a.epfNo || '').localeCompare(b.epfNo || ''))

  // If no live records found for the filter, provide prototype seed rows when viewing default
  let displayRows: any[][] = []

  if (filtered.length > 0) {
    displayRows = filtered.map(a => {
      const emp = employees.find(e => (e.epfNo || '').trim() === (a.epfNo || '').trim())
      const empFullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : a.epfNo
      const nameCol = `${empFullName || a.epfNo}-${a.epfNo}`
      const totalHours = a.totalWorkingHours || 0
      const otHours = a.totalOt || 0
      const offDate = a.dayOut || a.dayIn

      return [
        nameCol,
        a.epfNo,
        formatDateDdMmmYyyy(a.dayIn),
        formatTimeAmPm(a.timeIn),
        formatDateDdMmmYyyy(offDate),
        formatTimeAmPm(a.timeOut || a.timeIn),
        totalHours.toFixed(2),
        decimalToHmm(totalHours),
        otHours.toFixed(2),
        decimalToHmm(otHours),
        (a.noOfMeal || 0).toFixed(2),
        formatCurrency(a.totalMealValue || 0),
        '0.00',
        formatCurrency(a.basicSalary || 152.95),
        a.dayShift || 'Y',
        a.normalDay || 'Y',
      ]
    })
  } else if (!hasGenerated || (year === '2024' && month === '12')) {
    // Seed default sample rows from the prototype
    const sampleAtt = [
      ['06-Dec-2024', '7:16 am', '6:30 pm', 11.23, 2.0],
      ['07-Dec-2024', '7:15 am', '4:30 pm', 9.25, 3.25],
      ['10-Dec-2024', '7:15 am', '6:31 pm', 11.27, 2.0],
      ['11-Dec-2024', '7:10 am', '6:30 pm', 11.33, 2.0],
      ['12-Dec-2024', '7:15 am', '6:30 pm', 11.25, 2.0],
      ['28-Dec-2024', '6:20 am', '6:30 pm', 12.17, 6.25],
    ]

    displayRows = sampleAtt.map(r => [
      'D M CHANDRALATHA-E73',
      'E73',
      r[0],
      r[1],
      r[0],
      r[2],
      (r[3] as number).toFixed(2),
      decimalToHmm(r[3] as number),
      (r[4] as number).toFixed(2),
      decimalToHmm(r[4] as number),
      '0.00',
      '0.00',
      '0.00',
      '152.95',
      'Y',
      'Y',
    ])
  }

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
      columns={columns}
      rows={displayRows}
      numericFromColIndex={6}
      rowsPerPage={18}
      isLoading={loading}
      isFallback={isFallback}
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
