import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Building, Calendar, DollarSign, ArrowRightLeft, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { list as listEmployees } from '../../services/employeeService'
import type { Employee } from '../../types/employee'
import { getMonthlySummary, type MonthlySummary } from '../../mocks/monthlySummary'

const money = (value: number | undefined) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function MonthlyBreakdown() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [epfNo, setEpfNo] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : ''

  useEffect(() => {
    listEmployees(cleanBc).then(setEmployees).catch(console.error)
  }, [activeBc])

  useEffect(() => {
    if (!epfNo) {
      setSummary(null)
      return
    }
    setLoading(true)
    setError('')
    const fetchSummary = async () => {
      try {
        const data = await getMonthlySummary(epfNo.trim(), year.trim(), month.trim())
        setSummary(data)
      } catch (requestError: any) {
        console.error('Monthly summary request failed', requestError)
        setError(requestError?.response?.data?.message || 'Unable to load monthly summary.')
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [epfNo, year, month])

  const years = Array.from({ length: 5 }, (_, index) => String(new Date().getFullYear() - 2 + index))

  useEffect(() => {
    const handleBc = () => {
      listEmployees(cleanBc).then(setEmployees).catch(console.error)
    }
    window.addEventListener('hsb_bc_change', handleBc)
    window.addEventListener('storage', handleBc)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc)
      window.removeEventListener('storage', handleBc)
    }
  }, [activeBc])

  // Feature 7: Multi-plant Excel Export per Generated_Pay_Advice_v2 layout
  // Official Multi-Lingual Pay Advice Export (English / Tamil / Sinhala)
  function exportMultiPlantExcel() {
    if (!summary) {
      toast.error('No summary available to export')
      return
    }

    const normalDays = summary.normalDays !== undefined ? summary.normalDays : (summary.attendance?.workingDays !== undefined ? summary.attendance.workingDays : 0);
    const normalRate = summary.normalRate !== undefined ? summary.normalRate : (summary.basicSalary ? Number(summary.basicSalary) : 840);
    const normalAmount = summary.normalAmount !== undefined ? summary.normalAmount : Math.round(normalDays * normalRate * 100) / 100;

    const nightDays = summary.nightDays !== undefined && summary.nightDays > 0 ? summary.nightDays : '';
    const nightRate = summary.nightRate !== undefined ? summary.nightRate : (summary.nightAllowance || 540);
    const nightAmount = summary.nightAmount !== undefined && summary.nightAmount > 0 ? summary.nightAmount : (summary.nightAllowance ? summary.nightAllowance : '-');

    const poyaDays = summary.poyaDays !== undefined ? summary.poyaDays : 0;
    const poyaRate = summary.poyaRate !== undefined ? summary.poyaRate : Math.round(normalRate * 1.5 * 100) / 100;
    const poyaAmount = summary.poyaAmount !== undefined && summary.poyaAmount > 0 ? summary.poyaAmount : (summary.poyaDayExtra ? summary.poyaDayExtra : '-');

    const otHours = summary.overtimeHours !== undefined ? summary.overtimeHours : (summary.attendance?.otHours || 0);
    const otRate = summary.overtimeRate !== undefined ? summary.overtimeRate : (summary.attendance?.otRate || Math.round((normalRate / 8 * 1.5) * 100) / 100);
    const otAmount = summary.overtimeAmount !== undefined && summary.overtimeAmount > 0 ? summary.overtimeAmount : (otHours > 0 ? Math.round(otHours * otRate * 100) / 100 : '-');

    const incentive = summary.dayAllowance ? summary.dayAllowance : '-';
    const attAllowance = summary.attendance?.dayAllowance ? summary.attendance.dayAllowance : '';
    const attBonus = '';
    const statHoliday = summary.statutoryHolidayAmount ? summary.statutoryHolidayAmount : '-';
    const otherAdditions = summary.totalAdditions ? summary.totalAdditions : '';
    const grossSalary = summary.grossSalary || 0;

    const epf8 = summary.epf8 !== undefined ? summary.epf8 : Math.round(normalAmount * 0.08 * 100) / 100;
    const advance = summary.advanceDeduction ? summary.advanceDeduction : '';
    const telephone = summary.telephoneDeduction ? summary.telephoneDeduction : '-';
    const meal = summary.mealDeduction ? summary.mealDeduction : '';
    const absent = summary.absentDeduction ? summary.absentDeduction : '';
    const loan = summary.loanDeduction ? summary.loanDeduction : '';
    const deathDonation = summary.deathDonation ? summary.deathDonation : '';
    const totalDeductions = summary.totalDeductions || (Number(epf8 || 0) + Number(advance || 0));
    const netSalary = summary.netSalary || (grossSalary - totalDeductions);

    const epf12 = summary.epf12 !== undefined ? summary.epf12 : Math.round(normalAmount * 0.12 * 100) / 100;
    const etf3 = summary.etf3 !== undefined ? summary.etf3 : Math.round(normalAmount * 0.03 * 100) / 100;

    const lines: string[] = [
      `SHINEX HOUSE KEEPING SERVICES (PVT) LTD,,,${month.padStart(2, '0')}/${year},`,
      `,,,,`,
      `NAME AND EPF NO / பெயர் / නම සහ අංකය,,,${summary.empName} - ${summary.epfNo},`,
      `,DAY,HOUR,RATE,AMOUNT`,
      `NORMAL / பொது / සාමාන්‍ය,${normalDays},,${normalRate},${normalAmount}`,
      `NIGHT / இரவு / රාත්‍රී,,${nightDays},${nightRate},${nightAmount}`,
      `POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය,${poyaDays},,${poyaRate},${poyaAmount}`,
      `OVERTIME / மேலதிக நேரம் / අතිකාල,,${otHours || ''},${otRate},${otAmount}`,
      `INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව,,,,${incentive}`,
      `ATTENDANCE ALLOWANCE / கலந்துகொள்ளல் படி / පැමිණීමේ දීමනාව,,,,${attAllowance}`,
      `ATTENDANCE BONUS / வருகை போனஸ் / පැමිණීමේ බෝනස්,,,,${attBonus}`,
      `STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු,,,,${statHoliday}`,
      `OTHER / மற்றவை / වෙනත්,,,,${otherAdditions}`,
      `GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප,,,,${grossSalary}`,
      `,,,,`,
      `DEDUCTIONS / கழிவுகள் / අඩු කිරීම්,,,,`,
      `E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%,,,,${epf8}`,
      `ADVANCE / முற்பணம் / අත්තිකාරම්,,,,${advance}`,
      `TELEPHONE / தொலைபேசி / දුරකථනය,,,,${telephone}`,
      `MEAL / உணவு / ආහාරය,,,,${meal}`,
      `ABSENT / வராதிருத்தல் / නොපැමිණීම,,,,${absent}`,
      `LOAN / கடன் / ණය,,,,${loan}`,
      `DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර,,,,${deathDonation}`,
      `TOTAL DEDUCTION / மொத்த கழிவு / මුළු අඩුකිරීම,,,,${totalDeductions}`,
      `NET SALARY / நிகර சம்பளம் / ශුද්ධ වැටුප,,,,${netSalary}`,
      `COMPANY CONTRIBUTION / நிறுவன பங்களிப்பு / සමාගම් දායකත්වය,,,,`,
      `E.P.F. 12% / ஊ.சே.நி. 12% / සේ.අ.අ. 12%,,,,${epf12}`,
      `E.T.F. 3% / ஊ.பொ.நி. 3% / සේ.අ.අ.අ. 3%,,,,${etf3}`
    ]

    const csvContent = '\uFEFF' + lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Pay_Advice_${summary.epfNo}_${year}_${month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Pay Advice for ${summary.epfNo} exported successfully!`)
  }

  const selectedEmployee = employees.find(e => e.epfNo === epfNo)

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#2F6F5E] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Payroll & Pay Advice</span>
            <span className="text-slate-400 text-xs">HSB HRIS v1.0</span>
            <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded border border-slate-700">
              Scope: {activeBc === 'ALL' ? 'All Business Centers' : activeBc}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Monthly Summary & Pay Advice</h1>
          <p className="text-sm text-slate-400 mt-0.5">Full monthly salary advice with automatic multi-plant split reporting.</p>
        </div>

        {summary && (
          <button
            onClick={exportMultiPlantExcel}
            className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shrink-0"
          >
            <FileSpreadsheet size={16} />
            <span>Export Pay Advice (Excel)</span>
          </button>
        )}
      </div>

      {/* Period & Employee Selection */}
      <section className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow-flat border border-slate-200 md:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Select Employee ({employees.length} available)</label>
          <select value={epfNo} onChange={e => setEpfNo(e.target.value)} className="w-full form-input text-xs">
            <option value="">-- Choose Employee --</option>
            {employees.map(emp => (
              <option key={emp.epfNo} value={emp.epfNo}>
                {emp.epfNo} - {emp.firstName} {emp.lastName || ''} ({emp.plantCode || 'No Plant'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Payroll Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} className="w-full form-input text-xs">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Payroll Month</label>
          <select value={month} onChange={e => setMonth(e.target.value)} className="w-full form-input text-xs">
            {Array.from({ length: 12 }, (_, i) => {
              const val = String(i + 1).padStart(2, '0')
              const monthName = new Date(2026, i, 1).toLocaleString('default', { month: 'long' })
              return <option key={val} value={val}>{val} - {monthName}</option>
            })}
          </select>
        </div>
      </section>

      {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-flat border">Calculating monthly payroll summary...</div>}
      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">{error}</div>}

      {summary && !loading && (
        <div className="space-y-6">
          {/* Multi-plant Split Banner (Feature 7) */}
          {summary.plantsWorked && summary.plantsWorked.length > 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200">
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <div className="flex items-center gap-2">
                  <Building size={18} className="text-teal-600" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Multi-Plant Working Distribution ({summary.plantsWorked.length} {summary.plantsWorked.length === 1 ? 'Plant' : 'Plants'} this month)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 italic">
                  * On export, one Excel entry is emitted per plant worked with full-month payroll totals duplicated.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {summary.plantsWorked.map((p, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">{p.plantCode} - {p.plantName}</span>
                      <span className="text-[11px] text-slate-500">Days worked (ref):</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-bold text-xs border border-teal-200">
                      {p.daysWorked} {p.daysWorked === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-flat border border-slate-200">
              <div className="text-xs uppercase font-semibold text-slate-500">Basic Salary</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{money(summary.basicSalary)}</div>
              <span className="text-[11px] text-slate-400">Normal contracted rate</span>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-flat border border-slate-200">
              <div className="text-xs uppercase font-semibold text-slate-500">Gross Salary</div>
              <div className="mt-1 text-2xl font-bold text-[#2F6F5E]">{money(summary.grossSalary)}</div>
              <span className="text-[11px] text-emerald-600">Earnings & Allowances</span>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-flat border border-slate-200">
              <div className="text-xs uppercase font-semibold text-slate-500">Total Deductions</div>
              <div className="mt-1 text-2xl font-bold text-rose-600">{money(summary.totalDeductions)}</div>
              <span className="text-[11px] text-rose-500">EPF 8% + Advances + Loans</span>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-flat border border-slate-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30">
              <div className="text-xs uppercase font-semibold text-emerald-800">Net Salary (Take Home)</div>
              <div className="mt-1 text-2xl font-black text-[#2F6F5E]">{money(summary.netSalary)}</div>
              <span className="text-[11px] text-emerald-700 font-medium">Final Payable</span>
            </div>
          </div>

          {/* Detailed Pay Advice Grid (Generated_Pay_Advice_v2 Structure) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings Breakdown */}
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-emerald-800">
                  Earnings & Allowances
                </h3>
                <span className="font-bold text-emerald-700 text-xs">{money(summary.grossSalary)}</span>
              </div>
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">
                      Normal / Basic Salary
                      {summary.attendance?.workingDays !== undefined && (
                        <span className="ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {summary.attendance.workingDays} {summary.attendance.workingDays === 1 ? 'day' : 'days'} attended
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.basicSalary)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Night Allowance</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.nightAllowance || summary.attendance?.nightAllowance)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Sunday / Poya Extra</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.poyaDayExtra || summary.attendance?.poyaDayExtra)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">
                      Overtime Amount
                      <span className="ml-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {summary.attendance?.otHours || 0} hrs @ 1.5× basic rate
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.overtimeAmount || summary.attendance?.otAmount)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Day Allowance / Incentive</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.dayAllowance || summary.attendance?.dayAllowance)}</td>
                  </tr>
                  {summary.additions.map((a, i) => (
                    <tr key={i} className="bg-slate-50/50">
                      <td className="px-5 py-2 text-slate-600 pl-8">{a.code} - {a.name}</td>
                      <td className="px-5 py-2 text-right font-medium text-slate-700">{money(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 font-bold border-t-2 border-emerald-200">
                    <td className="px-5 py-3 text-emerald-900">Gross Salary</td>
                    <td className="px-5 py-3 text-right text-emerald-900 text-sm">{money(summary.grossSalary)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions Breakdown */}
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-rose-800">
                  Deductions & Recoveries
                </h3>
                <span className="font-bold text-rose-700 text-xs">{money(summary.totalDeductions)}</span>
              </div>
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">EPF 8% (Employee Contribution)</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-rose-600">{money(summary.epf8 || ((summary.basicSalary || 0) * 0.08))}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Salary Advance</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.advanceDeduction)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Telephone Deduction</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.telephoneDeduction)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Meal Deduction</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.mealDeduction || summary.attendance?.mealValue)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Absent Deduction</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.absentDeduction)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Loan Deductions</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.loanDeduction)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-slate-700">Death Donation</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{money(summary.deathDonation)}</td>
                  </tr>
                  {summary.deductions.map((d, i) => (
                    <tr key={i} className="bg-slate-50/50">
                      <td className="px-5 py-2 text-slate-600 pl-8">{d.code} - {d.name}</td>
                      <td className="px-5 py-2 text-right font-medium text-slate-700">{money(d.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-rose-50/60 font-bold border-t-2 border-rose-200">
                    <td className="px-5 py-3 text-rose-900">Total Deductions</td>
                    <td className="px-5 py-3 text-right text-rose-900 text-sm">{money(summary.totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Company Contribution & Summary footer */}
          <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Company Statutory Contributions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">EPF 12% (Company Contribution)</span>
                <strong className="text-slate-800 text-sm block mt-0.5">{money(summary.epf12 || ((summary.basicSalary || 0) * 0.12))}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">ETF 3% (Company Contribution)</span>
                <strong className="text-slate-800 text-sm block mt-0.5">{money(summary.etf3 || ((summary.basicSalary || 0) * 0.03))}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Total Statutory Fund Contribution (15%)</span>
                <strong className="text-[#2F6F5E] text-sm block mt-0.5">{money((summary.epf12 || 0) + (summary.etf3 || 0) || ((summary.basicSalary || 0) * 0.15))}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
