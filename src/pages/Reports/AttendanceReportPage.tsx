import React, { useState, useEffect } from 'react'
import A4Report from '../../components/reports/A4Report'
import { Attendance } from '../../mocks/attendance'
import { list as listEmployees } from '../../mocks/employees'
import { list as listCustomers, Customer } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import api from '../../api/axios'
import { formatDateDdMmmYyyy, formatTimeAmPm, decimalToHmm, formatCurrency } from '../../utils/reportHelpers'

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

  useEffect(() => {
    Promise.all([
      listBC(),
      listCustomers(businessCenter),
      listEmployees(businessCenter),
    ]).then(([bcs, custs, emps]) => {
      setBusinessCenters(bcs)
      setCustomers(custs)
      setEmployees(emps)
      setSelectedPlant(current => custs.some(customer => customer.code === current)
        ? current
        : custs[0]?.code || '')
    })
  }, [businessCenter])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const response = await api.get('/reports/attendance', {
        params: { businessCenter: cleanBc || 'ALL', year, month, plant: selectedPlant || undefined }
      })
      if (!Array.isArray(response.data)) {
        throw new Error('Attendance report returned an invalid response.')
      }
      setAttendanceList(response.data.map((row: any) => ({
        ...row,
        atttYear: row.attYear || row.atttYear,
        dasForAttAllowance: row.daysForAttAllowance ?? row.dasForAttAllowance
      })))
    } catch (error) {
      setAttendanceList([])
      console.error('Attendance report could not be loaded', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month, selectedPlant])

  const selectedCustObj = customers.find(c => c.code === selectedPlant)
  const plantTitle = selectedCustObj
    ? `${selectedCustObj.name} - ${selectedCustObj.address || selectedCustObj.code}`
    : ''

  const metaLeft = (
    <div>
      <div>{selectedCustObj?.name || ''}</div>
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
        formatCurrency(a.basicSalary || 0),
        a.dayShift || '',
        a.normalDay || '',
      ]
    })
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
      filterControls={filterControls}
      onGenerate={loadData}
    />
  )
}
