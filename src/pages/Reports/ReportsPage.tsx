import React, { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { list as listEmployees } from '../../mocks/employees'
import { list as listAttendance } from '../../mocks/attendance'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listAdditions } from '../../mocks/transactionAdditions'
import { list as listDeductions } from '../../mocks/transactionDeductions'
import { list as listLeaves } from '../../mocks/leaves'

type ReportType = 'employee' | 'attendance' | 'additions' | 'deductions' | 'leaves' | 'business_center'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('employee')
  const [selectedBc, setSelectedBc] = useState<string>('ALL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    listBC().then(setBusinessCenters)
  }, [])

  useEffect(() => {
    loadReportData()
  }, [reportType])

  async function loadReportData() {
    setLoading(true)
    try {
      if (reportType === 'employee') {
        const list = await listEmployees()
        setData(list)
      } else if (reportType === 'attendance') {
        const list = await listAttendance()
        setData(list)
      } else if (reportType === 'additions') {
        const list = await listAdditions()
        setData(list)
      } else if (reportType === 'deductions') {
        const list = await listDeductions()
        setData(list)
      } else if (reportType === 'leaves') {
        const list = await listLeaves()
        setData(list)
      } else if (reportType === 'business_center') {
        const list = await listBC()
        setData(list)
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
        const bc = item.businessCenter || item.code || item.companyId || ''
        if (bc !== selectedBc && !bc.includes(selectedBc)) return false
      }

      const date = item.dayIn || item.leaveStartDate || item.hiredDate || item.date || ''
      if (startDate && date && date < startDate) return false
      if (endDate && date && date > endDate) return false

      if (search.trim()) {
        const s = search.toLowerCase()
        const str = JSON.stringify(item).toLowerCase()
        if (!str.includes(s)) return false
      }
      return true
    })
  }, [data, selectedBc, startDate, endDate, search])

  function exportToExcel() {
    if (filteredData.length === 0) {
      toast.error('No data to export')
      return
    }

    const keys = Object.keys(filteredData[0]).filter(k => typeof filteredData[0][k] !== 'object')
    const headerRow = keys.join(',')
    const dataRows = filteredData.map(row =>
      keys.map(k => {
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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#2F6F5E] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Report Generator</span>
            <span className="text-slate-400 text-xs">HSB HRIS v1.0</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HR & Payroll Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Select a report type, apply filters, and export as Excel or PDF.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
          >
            📊 Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
          >
            📄 Export to PDF / Print
          </button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Report Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              className="w-full form-input bg-slate-50 border-slate-300 font-medium"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Business Center</label>
            <select
              value={selectedBc}
              onChange={e => setSelectedBc(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300"
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
              className="w-full form-input bg-slate-50 border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="w-full max-w-sm">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in report data..."
              className="w-full form-input text-xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredData.length}</span> records
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Report Preview</h3>
          <span className="text-xs text-slate-500">Live Data Sync</span>
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
                  {Object.keys(filteredData[0]).filter(k => typeof filteredData[0][k] !== 'object').slice(0, 8).map(key => (
                    <th key={key} className="px-4 py-3">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {Object.keys(filteredData[0]).filter(k => typeof filteredData[0][k] !== 'object').slice(0, 8).map(key => (
                      <td key={key} className="px-4 py-2.5 whitespace-nowrap">
                        {String(row[key] ?? '')}
                      </td>
                    ))}
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
