import React, { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { list as listEmployees } from '../../mocks/employees'
import { list as listAttendance } from '../../mocks/attendance'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listAdditions } from '../../mocks/transactionAdditions'
import { list as listDeductions } from '../../mocks/transactionDeductions'
import { list as listLeaves } from '../../mocks/leaves'
import { FileSpreadsheet, Printer, Search, Filter } from 'lucide-react'

type ReportType = 'employee' | 'attendance' | 'additions' | 'deductions' | 'leaves' | 'business_center'

const COLUMN_TITLES: Record<string, string> = {
  epfNo: 'Employee ID (EPF)',
  employeeName: 'Employee Name',
  nicNo: 'NIC No',
  designation: 'Designation',
  sectionCode: 'Section',
  plantCode: 'Plant / Customer',
  businessCenter: 'Business Center',
  basicSalary: 'Daily Rate (LKR)',
  hiredDate: 'Hired Date',
  status: 'Status',
  date: 'Date',
  timeIn: 'Time In',
  timeOut: 'Time Out',
  totalHours: 'Total Hours',
  otHours: 'OT Hours',
  nightShift: 'Night Shift',
  addCode: 'Addition Code',
  didCode: 'Deduction Code',
  amount: 'Amount (LKR)',
  month: 'Month',
  year: 'Year',
  recurring: 'Recurring (Monthly)',
  leaveType: 'Leave Type',
  startDate: 'Start Date',
  endDate: 'End Date',
  days: 'Days',
  code: 'BC Code',
  name: 'BC Name',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('employee')
  const [selectedBc, setSelectedBc] = useState<string>('ALL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : ''

  useEffect(() => {
    listBC().then(setBusinessCenters)
  }, [])

  useEffect(() => {
    loadReportData()
  }, [reportType, activeBc])

  async function loadReportData() {
    setLoading(true)
    try {
      const allEmployees = await listEmployees()
      const empMap = new Map<string, string>()
      allEmployees.forEach((e: any) => {
        if (e.epfNo) {
          const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.epfNo
          empMap.set(e.epfNo.trim().toUpperCase(), fullName)
        }
      })

      const getEmpName = (id?: string) => {
        if (!id) return '—'
        return empMap.get(id.trim().toUpperCase()) || '—'
      }

      if (reportType === 'employee') {
        const list = await listEmployees(cleanBc)
        setData(
          list.map((e: any) => ({
            epfNo: e.epfNo || '',
            employeeName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.epfNo || '',
            nicNo: e.nicNo || '—',
            designation: e.designation || 'Staff',
            sectionCode: e.sectionCode || '—',
            plantCode: e.plantCode || '—',
            businessCenter: e.businessCenter || '—',
            basicSalary: Number(e.basicSalary || 0),
            hiredDate: e.hiredDate || '—',
            status: e.statusActive !== false ? 'Active' : 'Inactive'
          }))
        )
      } else if (reportType === 'attendance') {
        const list = await listAttendance()
        setData(
          list.map((a: any) => ({
            epfNo: a.epfNo || '',
            employeeName: getEmpName(a.epfNo),
            date: a.dayIn || '',
            timeIn: a.timeIn || '—',
            timeOut: a.timeOut || '—',
            totalHours: a.totalWorkingHours || 0,
            otHours: a.totalOt || 0,
            plantCode: a.plantCode || '—',
            businessCenter: a.businessCenter || '—',
            nightShift: a.nightShift === 'Y' ? 'Yes' : 'No'
          }))
        )
      } else if (reportType === 'additions') {
        const list = await listAdditions()
        setData(
          list.map((a: any) => ({
            epfNo: a.epfNo || '',
            employeeName: getEmpName(a.epfNo),
            addCode: a.addCode || '',
            amount: Number(a.addAmount || 0),
            month: a.addMonth || '',
            year: a.addYear || '',
            recurring: a.everyMonth === 'Y' || a.everyMonth === true ? 'Yes' : 'No',
            businessCenter: a.businessCenter || '—'
          }))
        )
      } else if (reportType === 'deductions') {
        const list = await listDeductions()
        setData(
          list.map((d: any) => ({
            epfNo: d.epfNo || '',
            employeeName: getEmpName(d.epfNo),
            didCode: d.didCode || '',
            amount: Number(d.didAmount || 0),
            month: d.addMonth || '',
            year: d.addYear || '',
            recurring: d.everyMonth === 'Y' || d.everyMonth === true ? 'Yes' : 'No',
            businessCenter: d.businessCenter || '—'
          }))
        )
      } else if (reportType === 'leaves') {
        const list = await listLeaves()
        setData(
          list.map((l: any) => {
            const epf = l.empNo || l.epfNo || ''
            return {
              epfNo: epf,
              employeeName: getEmpName(epf),
              leaveType: l.leaveType || 'Annual',
              startDate: l.start || l.leaveStartDate || '',
              endDate: l.end || l.leaveEndDate || '',
              days: Number(l.leaveDays || 1),
              month: l.leaveMonth || '',
              year: l.leaveYear || ''
            }
          })
        )
      } else if (reportType === 'business_center') {
        const list = await listBC()
        setData(
          list.map((b: any) => ({
            code: b.code || '',
            name: b.name || '',
            address: b.address || '—',
            phone: b.phone || '—',
            email: b.email || '—'
          }))
        )
      }
    } catch (err) {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (selectedBc !== 'ALL') {
        const bc = item.businessCenter || item.code || ''
        if (bc !== selectedBc && !bc.includes(selectedBc)) return false
      }

      const date = item.date || item.startDate || item.hiredDate || ''
      if (startDate && date && date < startDate) return false
      if (endDate && date && date > endDate) return false

      if (search.trim()) {
        const s = search.toLowerCase()
        const str = Object.values(item).join(' ').toLowerCase()
        if (!str.includes(s)) return false
      }
      return true
    })
  }, [data, selectedBc, startDate, endDate, search])

  const reportKeys = useMemo(() => {
    if (filteredData.length === 0) return []
    return Object.keys(filteredData[0]).filter(k => typeof filteredData[0][k] !== 'object')
  }, [filteredData])

  function exportToExcel() {
    if (filteredData.length === 0) {
      toast.error('No data to export')
      return
    }

    const headerLabels = reportKeys.map(k => `"${COLUMN_TITLES[k] || k}"`)
    const headerRow = headerLabels.join(',')
    const dataRows = filteredData.map(row =>
      reportKeys.map(k => {
        const val = row[k] ?? ''
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      }).join(',')
    )

    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Shinex_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Excel report downloaded successfully!')
  }

  function exportToPDF() {
    if (filteredData.length === 0) {
      toast.error('No data to export')
      return
    }
    window.print()
  }

  useEffect(() => {
    const handleBc = () => {
      loadReportData()
    }
    window.addEventListener('hsb_bc_change', handleBc)
    window.addEventListener('storage', handleBc)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc)
      window.removeEventListener('storage', handleBc)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#2F6F5E] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Report Generator</span>
            <span className="text-slate-400 text-xs">HSB HRIS v1.0</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HR & Payroll Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Comprehensive audit & operational reports with mandatory ID and Employee Name inclusion.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
          >
            <FileSpreadsheet size={16} />
            <span>Export to Excel (CSV)</span>
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
          >
            <Printer size={16} />
            <span>Export to PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">SHINEX HOUSE KEEPING SERVICES (PVT) LTD</h2>
        <h3 className="text-sm font-semibold text-slate-700 capitalize">{reportType.replace('_', ' ')} Report</h3>
        <p className="text-xs text-slate-500 mt-1">Generated on: {new Date().toLocaleString()} &bull; Total Records: {filteredData.length}</p>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 space-y-4 print:hidden">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Filter size={16} className="text-[#2F6F5E]" />
          Report Configuration & Filters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              className="w-full form-input bg-slate-50 border-slate-300 font-medium text-xs"
            >
              <option value="employee">Employee Master Report</option>
              <option value="attendance">Attendance Summary Report</option>
              <option value="additions">Transaction Additions Report</option>
              <option value="deductions">Transaction Deductions Report</option>
              <option value="leaves">Leave Summary Report</option>
              <option value="business_center">Business Center Directory</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Business Center Scope</label>
            <select
              value={selectedBc}
              onChange={e => setSelectedBc(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300 text-xs"
            >
              <option value="ALL">All Business Centers</option>
              {businessCenters.map((b: any) => (
                <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="w-full max-w-sm relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, Name, Section, etc..."
              className="w-full form-input pl-8 text-xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredData.length}</span> records
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
          <h3 className="font-semibold text-slate-800 text-sm">Report Preview (Includes Employee ID & Name)</h3>
          <span className="text-xs text-slate-500 bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
            {filteredData.length} Records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading report dataset...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No matching records found for the selected criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  {reportKeys.map(key => (
                    <th key={key} className="px-4 py-3 whitespace-nowrap">
                      {COLUMN_TITLES[key] || key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {reportKeys.map(key => {
                      const val = row[key]
                      const isId = key === 'epfNo' || key === 'code'
                      const isName = key === 'employeeName' || key === 'name'
                      const isMoney = key === 'basicSalary' || key === 'amount'
                      return (
                        <td
                          key={key}
                          className={`px-4 py-2.5 whitespace-nowrap ${
                            isId
                              ? 'font-mono font-bold text-slate-900 bg-slate-50/50'
                              : isName
                              ? 'font-medium text-slate-800'
                              : isMoney
                              ? 'font-mono text-emerald-700 font-semibold text-right'
                              : ''
                          }`}
                        >
                          {isMoney && typeof val === 'number'
                            ? `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
                            : String(val ?? '—')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
