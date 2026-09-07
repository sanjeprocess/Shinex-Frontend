import { useEffect, useState } from 'react'
import { list as listEmployees } from '../../mocks/employees'
import type { Employee } from '../../types/employee'
import { getMonthlySummary, type MonthlySummary } from '../../mocks/monthlySummary'

const money = (value: number | undefined) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

export default function MonthlyBreakdown() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [epfNo, setEpfNo] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listEmployees().then(setEmployees) }, [])
  useEffect(() => {
    if (!epfNo) { setSummary(null); return }
    setLoading(true); setError('')
    const fetchSummary = async () => {
      try {
        setSummary(await getMonthlySummary(epfNo.trim(), year.trim(), month.trim()))
      } catch (requestError: any) {
        console.error('Monthly summary request failed', {
          status: requestError?.response?.status,
          data: requestError?.response?.data,
          message: requestError?.message
        })
        setError(requestError?.response?.data?.message || 'Unable to load monthly summary.')
      } finally { setLoading(false) }
    }
    fetchSummary()
  }, [epfNo, year, month])

  const years = Array.from({ length: 5 }, (_, index) => String(new Date().getFullYear() - 2 + index))
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Employee Monthly Summary</h1>
        <p className="text-sm text-slate-500">Review salary, additions, deductions, loans, and attendance for a payroll period.</p>
      </div>
      <section className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow-flat md:grid-cols-3">
        <select value={epfNo} onChange={e => setEpfNo(e.target.value)} className="form-input">
          <option value="">Select employee</option>
          {employees.map(employee => <option key={employee.epfNo} value={employee.epfNo}>{employee.epfNo} - {employee.firstName} {employee.lastName}</option>)}
        </select>
        <select value={year} onChange={e => setYear(e.target.value)} className="form-input">{years.map(value => <option key={value}>{value}</option>)}</select>
        <select value={month} onChange={e => setMonth(e.target.value)} className="form-input">{Array.from({ length: 12 }, (_, i) => { const value = String(i + 1).padStart(2, '0'); return <option key={value}>{value}</option> })}</select>
      </section>
      {loading && <div className="rounded-xl bg-white p-6 text-slate-500">Loading monthly summary...</div>}
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {summary && !loading && <>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[['Basic Salary', summary.basicSalary], ['Total Additions', summary.totalAdditions], ['Total Deductions', summary.totalDeductions], ['Net Salary', summary.netSalary]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-white p-4 shadow-flat"><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-slate-800">{money(value as number)}</div></div>)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Breakdown title="Allowances & Additions" headers={['Code', 'Name', 'Amount']} rows={summary.additions.map(row => [row.code, row.name, money(row.amount)])} />
          <Breakdown title="Deductions" headers={['Code', 'Name', 'Amount']} rows={summary.deductions.map(row => [row.code, row.name, money(row.amount)])} />
          <Breakdown title="Salary Advances & Loans" headers={['Loan ID', 'Amount']} rows={summary.advances.map(row => [row.loanId, money(row.amount)])} />
          <div className="rounded-xl bg-white p-5 shadow-flat"><h2 className="mb-4 font-semibold text-slate-800">Attendance Summary</h2><div className="grid grid-cols-2 gap-3 text-sm">{[['Working days', summary.attendance.workingDays], ['OT hours', summary.attendance.otHours], ['Day allowance', money(summary.attendance.dayAllowance)], ['Night allowance', money(summary.attendance.nightAllowance)], ['Meal value', money(summary.attendance.mealValue)]].map(([label, value]) => <div key={label as string}><div className="text-slate-500">{label}</div><div className="font-medium text-slate-800">{value}</div></div>)}</div></div>
        </div>
      </>}
    </div>
  )
}

function Breakdown({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <div className="overflow-hidden rounded-xl bg-white shadow-flat"><h2 className="p-5 pb-3 font-semibold text-slate-800">{title}</h2><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map(header => <th key={header} className="px-5 py-3">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-3">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-5 py-4 text-slate-400">No records found.</td></tr>}</tbody></table></div>
}
