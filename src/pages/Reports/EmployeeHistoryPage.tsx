import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../mocks/employees'
import { list as listAttendance } from '../../mocks/attendance'
import { list as listAdditions } from '../../mocks/transactionAdditions'
import { list as listDeductions } from '../../mocks/transactionDeductions'
import { list as listLeaves } from '../../mocks/leaves'
import { list as listLoans } from '../../mocks/loans'

export default function EmployeeHistoryPage() {
  const [selectedEpf, setSelectedEpf] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [employee, setEmployee] = useState<any | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [additionsList, setAdditionsList] = useState<any[]>([])
  const [deductionsList, setDeductionsList] = useState<any[]>([])
  const [leavesList, setLeavesList] = useState<any[]>([])
  const [loansList, setLoansList] = useState<any[]>([])

  useEffect(() => {
    if (!selectedEpf) {
      setEmployee(null)
      setAttendanceList([])
      setAdditionsList([])
      setDeductionsList([])
      setLeavesList([])
      setLoansList([])
      return
    }

    loadEmployeeHistory(selectedEpf)
  }, [selectedEpf])

  async function loadEmployeeHistory(epf: string) {
    setLoading(true)
    try {
      const allEmps = await listEmployees()
      const emp = allEmps.find(e => e.epfNo === epf)
      setEmployee(emp || null)

      const [att, add, ded, lve, lon] = await Promise.all([
        listAttendance(),
        listAdditions(),
        listDeductions(),
        listLeaves(),
        listLoans()
      ])

      setAttendanceList(att.filter(a => a.epfNo === epf))
      setAdditionsList(add.filter(a => a.epfNo === epf))
      setDeductionsList(ded.filter(d => d.epfNo === epf))
      setLeavesList(lve.filter(l => l.empNo === epf || l.epfNo === epf))
      setLoansList(lon.filter(l => l.epfNo === epf))
    } catch (err) {
      toast.error('Failed to load employee history')
    } finally {
      setLoading(false)
    }
  }

  function exportToExcel() {
    if (!employee) {
      toast.error('Please select an employee first')
      return
    }

    const lines: string[] = []
    lines.push(`EMPLOYEE HISTORY REPORT - ${employee.epfNo}`)
    lines.push(`Name,${employee.firstName} ${employee.lastName || ''}`)
    lines.push(`NIC No,${employee.nicNo || 'N/A'}`)
    lines.push(`Business Center,${employee.businessCenter || 'N/A'}`)
    lines.push(`Basic Salary,LKR ${employee.basicSalary || 0}`)
    lines.push(`Hired Date,${employee.hiredDate || 'N/A'}`)
    lines.push('')

    lines.push('--- ATTENDANCE HISTORY ---')
    lines.push('Date,Time In,Time Out,Working Hours,OT Hours,Business Center')
    attendanceList.forEach(a => {
      lines.push(`"${a.dayIn}","${a.timeIn}","${a.timeOut}","${a.totalWorkingHours || 0}","${a.totalOt || 0}","${a.businessCenter}"`)
    })
    lines.push('')

    lines.push('--- ADDITIONS HISTORY ---')
    lines.push('Code,Amount,Month,Year,Every Month')
    additionsList.forEach(a => {
      lines.push(`"${a.addCode}","${a.addAmount}","${a.addMonth}","${a.addYear}","${a.everyMonth}"`)
    })
    lines.push('')

    lines.push('--- DEDUCTIONS HISTORY ---')
    lines.push('Code,Amount,Month,Year,Every Month')
    deductionsList.forEach(d => {
      lines.push(`"${d.didCode}","${d.didAmount}","${d.addMonth}","${d.addYear}","${d.everyMonth}"`)
    })
    lines.push('')

    lines.push('--- LEAVE HISTORY ---')
    lines.push('Type,Start Date,End Date,Days,Year,Month')
    leavesList.forEach(l => {
      lines.push(`"${l.leaveType}","${l.start || l.leaveStartDate}","${l.end || l.leaveEndDate}","${l.leaveDays}","${l.leaveYear}","${l.leaveMonth}"`)
    })
    lines.push('')

    lines.push('--- LOAN HISTORY ---')
    lines.push('Loan ID,Amount,Start Date,Duration Months,Business Unit')
    loansList.forEach(l => {
      lines.push(`"${l.loanId}","${l.loanAmount}","${l.loanStartDate}","${l.loanDuration}","${l.businessUnit}"`)
    })

    const csvContent = '\uFEFF' + lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Employee_History_${employee.epfNo}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Full history for ${employee.epfNo} exported to Excel!`)
  }

  function exportToPDF() {
    if (!employee) {
      toast.error('Please select an employee first')
      return
    }
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#3F9884] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Individual Profile History</span>
            <span className="text-slate-400 text-xs font-mono">{selectedEpf || 'No Employee Selected'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Complete Record Dossier</h1>
          <p className="text-sm text-slate-400 mt-0.5">Select a specific employee to retrieve their full historical master & transaction records.</p>
        </div>

        {employee && (
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              📊 Export History (Excel)
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              📄 Print / Save PDF
            </button>
          </div>
        )}
      </div>

      {/* Employee Selector Card */}
      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200">
        <label className="block text-xs font-semibold text-slate-700 mb-2">Select Employee to View Complete History</label>
        <div className="max-w-xl">
          <SearchableEmployeeSelect
            value={selectedEpf}
            onChange={(epf) => setSelectedEpf(epf)}
            placeholder="Type EPF or Name (e.g. EPF00001 or Sunil)"
          />
        </div>
      </div>

      {/* History Profile Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-500">Loading complete employee dossier...</div>
      ) : !employee ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-400 text-sm">
          Please select an employee above to display their complete profile and transaction history.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Master Employee Summary Card */}
          <div className="bg-white p-6 rounded-2xl shadow-flat border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b">Master Profile — {employee.epfNo}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div><span className="text-slate-500 block">Full Name</span><strong className="text-slate-800 text-sm">{employee.firstName} {employee.lastName || ''}</strong></div>
              <div><span className="text-slate-500 block">NIC No</span><strong className="text-slate-800 text-sm">{employee.nicNo || '—'}</strong></div>
              <div><span className="text-slate-500 block">Business Center</span><strong className="text-slate-800 text-sm">{employee.businessCenter || '—'}</strong></div>
              <div><span className="text-slate-500 block">Basic Salary</span><strong className="text-[#2F6F5E] text-sm">LKR {Number(employee.basicSalary || 0).toLocaleString()}</strong></div>

              <div><span className="text-slate-500 block">Plant / Customer</span><strong className="text-slate-800">{employee.plantCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Section Code</span><strong className="text-slate-800">{employee.sectionCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Hired Date</span><strong className="text-slate-800">{employee.hiredDate || '—'}</strong></div>
              <div><span className="text-slate-500 block">Bank Account</span><strong className="text-slate-800">{employee.bankName || 'Bank'} — {employee.bankAccountNumber || '—'}</strong></div>
            </div>
          </div>

          {/* Attendance History */}
          <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Attendance Log History ({attendanceList.length})</h4>
            </div>
            {attendanceList.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No attendance logs recorded for this employee.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold">
                    <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Time In</th><th className="px-4 py-2">Time Out</th><th className="px-4 py-2">Total Hours</th><th className="px-4 py-2">OT Hours</th><th className="px-4 py-2">Business Center</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceList.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 mono-numeric font-medium">{a.dayIn}</td>
                        <td className="px-4 py-2 mono-numeric">{a.timeIn}</td>
                        <td className="px-4 py-2 mono-numeric">{a.timeOut || '—'}</td>
                        <td className="px-4 py-2 mono-numeric font-semibold">{a.totalWorkingHours || 0} hrs</td>
                        <td className="px-4 py-2 mono-numeric text-amber-600 font-semibold">{a.totalOt || 0} hrs</td>
                        <td className="px-4 py-2">{a.businessCenter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Loan History */}
          <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Loan Transaction History ({loansList.length})</h4>
            </div>
            {loansList.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No loan records for this employee.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold">
                    <tr><th className="px-4 py-2">Loan ID</th><th className="px-4 py-2">Loan Amount</th><th className="px-4 py-2">Start Date</th><th className="px-4 py-2">Duration</th><th className="px-4 py-2">Business Unit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loansList.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 mono-numeric font-medium">{l.loanId}</td>
                        <td className="px-4 py-2 mono-numeric font-bold text-[#2F6F5E]">LKR {Number(l.loanAmount).toLocaleString()}</td>
                        <td className="px-4 py-2 mono-numeric">{l.loanStartDate}</td>
                        <td className="px-4 py-2">{l.loanDuration} Months</td>
                        <td className="px-4 py-2">{l.businessUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Additions & Deductions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Additions History ({additionsList.length})</h4>
              </div>
              {additionsList.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">No additions recorded.</div>
              ) : (
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr><th className="px-3 py-2">Add Code</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Month/Year</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {additionsList.map((a, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{a.addCode}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-600">LKR {Number(a.addAmount).toLocaleString()}</td>
                        <td className="px-3 py-2 mono-numeric">{a.addMonth}/{a.addYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Deductions History ({deductionsList.length})</h4>
              </div>
              {deductionsList.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">No deductions recorded.</div>
              ) : (
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr><th className="px-3 py-2">Did Code</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Month/Year</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deductionsList.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{d.didCode}</td>
                        <td className="px-3 py-2 font-semibold text-rose-600">LKR {Number(d.didAmount).toLocaleString()}</td>
                        <td className="px-3 py-2 mono-numeric">{d.addMonth}/{d.addYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
