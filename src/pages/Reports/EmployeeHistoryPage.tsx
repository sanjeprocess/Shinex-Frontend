import React, { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Building2, ArrowRightLeft, Calendar, FileText, Printer, CheckCircle,
  User, DollarSign, ShieldAlert, CreditCard, ChevronRight, FileSpreadsheet,
  Clock, ShieldCheck
} from 'lucide-react'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../services/employeeService'
import { list as listAttendance } from '../../mocks/attendance'
import { list as listAdditions } from '../../mocks/transactionAdditions'
import { list as listDeductions } from '../../mocks/transactionDeductions'
import { list as listLeaves } from '../../mocks/leaves'
import { list as listLoans } from '../../mocks/loans'
import { list as listSections } from '../../mocks/sections'
import { list as listTransfers, PlantTransfer } from '../../mocks/plantTransfers'
import { list as listPlants, Customer } from '../../mocks/customers'
import { getMonthlySummary, type MonthlySummary } from '../../mocks/monthlySummary'
import { list as listBusinessCenters } from '../../mocks/businessCenters'
import { reportYears } from '../../components/reports/ReportFilters'
import { downloadPaySheetExcel } from '../../utils/paySheetExcel'
import PaySheetView, { drawPaySheetPage, newPaySheetPdf, payrollFromSummary, renderPaySheetCanvas } from '../../components/reports/PaySheetView'

interface PlantAssignmentOption {
  id: string
  label: string
  plantCode: string
  plantName: string
  isCurrent: boolean
  startDate?: string
  endDate?: string
}

export default function EmployeeHistoryPage() {
  const [selectedEpf, setSelectedEpf] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([])
  const [plants, setPlants] = useState<Customer[]>([])
  const [businessCenters, setBusinessCenters] = useState<any[]>([])

  // Payroll Period Filter
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))

  const [employee, setEmployee] = useState<any | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [additionsList, setAdditionsList] = useState<any[]>([])
  const [deductionsList, setDeductionsList] = useState<any[]>([])
  const [leavesList, setLeavesList] = useState<any[]>([])
  const [loansList, setLoansList] = useState<any[]>([])
  const [employeeTransfers, setEmployeeTransfers] = useState<PlantTransfer[]>([])
  const [selectedPlantOptionId, setSelectedPlantOptionId] = useState<string>('ALL')

  // Synced Monthly Summary
  const [monthlyData, setMonthlyData] = useState<MonthlySummary | null>(null)
  const [printSize, setPrintSize] = useState<'A4' | 'A5'>('A5')
  const [generatingPdf, setGeneratingPdf] = useState<'A4' | 'A5' | null>(null)
  const paySheetRef = useRef<HTMLDivElement>(null)

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : ''
  const companyName = businessCenters.find(center =>
    center.code === employee?.businessCenter || center.name === employee?.businessCenter
  )?.name || ''
  const years = reportYears

  useEffect(() => {
    loadCompanyEmployees()
    listPlants(cleanBc).then(setPlants).catch(console.error)
  }, [activeBc])

  useEffect(() => {
    listBusinessCenters().then(setBusinessCenters).catch(console.error)
  }, [])

  async function loadCompanyEmployees() {
    try {
      const list = await listEmployees(cleanBc)
      // De-duplicate by unique employee (epfNo) for logged-in company only
      const map = new Map<string, any>()
      list.forEach((emp: any) => {
        if (emp?.epfNo && !map.has(emp.epfNo.trim())) {
          map.set(emp.epfNo.trim(), emp)
        }
      })
      const uniqueEmps = Array.from(map.values())
      setCompanyEmployees(uniqueEmps)
    } catch (err) {
      console.error('Failed to load scoped unique employees', err)
    }
  }

  useEffect(() => {
    if (!selectedEpf) {
      setEmployee(null)
      setAttendanceList([])
      setAdditionsList([])
      setDeductionsList([])
      setLeavesList([])
      setLoansList([])
      setEmployeeTransfers([])
      setMonthlyData(null)
      setSelectedPlantOptionId('ALL')
      return
    }

    loadEmployeeHistory(selectedEpf)
  }, [selectedEpf, year, month])

  async function loadEmployeeHistory(epf: string) {
    setLoading(true)
    try {
      const [allEmps, sectionList, att, add, ded, lve, lon, allTr] = await Promise.all([
        listEmployees(cleanBc),
        listSections(cleanBc).catch(() => []),
        listAttendance(),
        listAdditions(),
        listDeductions(),
        listLeaves(),
        listLoans(),
        listTransfers(cleanBc)
      ])

      const rawEmp = allEmps.find(e => e.epfNo === epf)
      if (rawEmp) {
        const secCode = (rawEmp.sectionCode || '').trim()
        const secObj = secCode ? sectionList.find((s: any) => (s.code || '').trim() === secCode || (s.name || '').trim().toLowerCase() === secCode.toLowerCase()) : null
        const secSal = secObj?.basicSalary != null && Number(secObj.basicSalary) > 0 ? Number(secObj.basicSalary) : 0
        const empSal = rawEmp.basicSalary != null && Number(rawEmp.basicSalary) > 0 ? Number(rawEmp.basicSalary) : 0
        const effectiveSalary = secSal > 0 ? secSal : empSal
        setEmployee({ ...rawEmp, basicSalary: effectiveSalary })
      } else {
        setEmployee(null)
      }

      setAttendanceList(att.filter(a => a.epfNo === epf))
      setAdditionsList(add.filter(a => a.epfNo === epf))
      setDeductionsList(ded.filter(d => d.epfNo === epf))
      setLeavesList(lve.filter(l => l.empNo === epf || l.epfNo === epf))
      setLoansList(lon.filter(l => l.epfNo === epf))
      setEmployeeTransfers(allTr.filter(t => t.epfNo === epf))

      // Fetch backend-calculated monthly summary for the selected period
      try {
        const summary = await getMonthlySummary(epf.trim(), year.trim(), month.trim())
        setMonthlyData(summary)
      } catch (err) {
        setMonthlyData(null)
      }
    } catch (err) {
      toast.error('Failed to load employee history')
    } finally {
      setLoading(false)
    }
  }

  // Compute Current and Previous Plant options for transfer tracing
  const plantAssignmentOptions = useMemo<PlantAssignmentOption[]>(() => {
    if (!employee) return []
    const options: PlantAssignmentOption[] = [
      {
        id: 'ALL',
        label: 'All Plants (Full History)',
        plantCode: '',
        plantName: 'All Plants',
        isCurrent: false
      }
    ]

    const currCode = (employee.plantCode || '').split(' / ')[0].trim()
    const currPlantObj = plants.find(p => p.code === currCode)
    const currPlantName = currPlantObj ? currPlantObj.name : (currCode || 'Main Plant')

    if (currCode) {
      options.push({
        id: `CURRENT_${currCode}`,
        label: `Current Plant: ${currCode} - ${currPlantName} (Active)`,
        plantCode: currCode,
        plantName: currPlantName,
        isCurrent: true,
        startDate: employee.hiredDate
      })
    }

    // Historical transfers
    employeeTransfers.forEach((t, idx) => {
      const fromCode = (t.fromPlant || '').split(' ')[0].trim()
      const toCode = (t.toPlant || '').split(' ')[0].trim()

      if (toCode && toCode !== currCode) {
        const pObj = plants.find(p => p.code === toCode)
        const pName = pObj ? pObj.name : toCode
        options.push({
          id: `PREV_TO_${t.id || idx}`,
          label: `Previous Plant: ${toCode} - ${pName} (${t.transferDate}${t.endDate ? ` to ${t.endDate}` : ''})`,
          plantCode: toCode,
          plantName: pName,
          isCurrent: false,
          startDate: t.transferDate,
          endDate: t.endDate
        })
      } else if (fromCode && fromCode !== currCode && fromCode !== 'Main') {
        const pObj = plants.find(p => p.code === fromCode)
        const pName = pObj ? pObj.name : fromCode
        if (!options.some(o => o.plantCode === fromCode)) {
          options.push({
            id: `PREV_FROM_${t.id || idx}`,
            label: `Previous Plant: ${fromCode} - ${pName} (Prior to ${t.transferDate})`,
            plantCode: fromCode,
            plantName: pName,
            isCurrent: false,
            endDate: t.transferDate
          })
        }
      }
    })

    const attendancePlants = Array.from(new Set(attendanceList.map(a => a.plantCode).filter(Boolean)))
    attendancePlants.forEach(pCode => {
      const clean = pCode.trim()
      if (clean && !options.some(o => o.plantCode === clean)) {
        const pObj = plants.find(p => p.code === clean)
        const pName = pObj ? pObj.name : clean
        options.push({
          id: `ATT_PLANT_${clean}`,
          label: `Historical Plant: ${clean} - ${pName}`,
          plantCode: clean,
          plantName: pName,
          isCurrent: false
        })
      }
    })

    return options
  }, [employee, plants, employeeTransfers, attendanceList])

  // Months this employee has saved attendance, newest first
  const attendanceMonths = useMemo(() => {
    const counts = new Map<string, number>()
    attendanceList.forEach(a => {
      const period = String(a.dayIn || '').slice(0, 7)
      if (period) counts.set(period, (counts.get(period) || 0) + ((a.halfDay === 1 || a.halfDay === 0.5) ? 0.5 : 1))
    })
    return Array.from(counts.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [attendanceList])
  const selectedPeriod = `${year}-${month.padStart(2, '0')}`
  const noAttendanceInPeriod = !loading && !!employee && !attendanceMonths.some(([period]) => period === selectedPeriod)

  const selectedOption = plantAssignmentOptions.find(o => o.id === selectedPlantOptionId) || plantAssignmentOptions[0]

  const filteredAttendanceList = useMemo(() => {
    if (!selectedOption || selectedOption.id === 'ALL') {
      return attendanceList
    }

    return attendanceList.filter(a => {
      if (a.plantCode && selectedOption.plantCode && a.plantCode.trim().toUpperCase() === selectedOption.plantCode.trim().toUpperCase()) {
        return true
      }
      if (selectedOption.startDate && a.dayIn && a.dayIn < selectedOption.startDate) {
        return false
      }
      if (selectedOption.endDate && a.dayIn && a.dayIn > selectedOption.endDate) {
        return false
      }
      return !selectedOption.plantCode || (a.plantCode && a.plantCode.includes(selectedOption.plantCode))
    })
  }, [attendanceList, selectedOption])

  // Unified salary breakdown strictly synchronized with MonthlySummary & Pay Advice
  const payrollCalculation = useMemo(() => {
    if (!employee) return null

    // If backend monthlyData exists, use it directly to ensure 100% exact parity
    if (monthlyData) {
      return payrollFromSummary(monthlyData, employee)
    }

    // Fallback formula aligned with MonthlySummaryController
    const targetMo = month.padStart(2, '0')
    const targetYr = year.trim()

    const monthlyAtt = attendanceList.filter(a => {
      if (!a.dayIn) return false
      const [y, m] = a.dayIn.split('-')
      return y === targetYr && m === targetMo
    })

    const dailyRate = Number(employee.basicSalary || 0)
    const normalRate = dailyRate > 0 ? dailyRate : 840

    let normalDays = 0
    let poyaDays = 0
    let nightDays = 0
    let statutoryDays = 0
    let otHours = 0
    let poyaExtraSum = 0
    let nightExtraSum = 0

    monthlyAtt.forEach(a => {
      const weight = (a.halfDay === 1 || a.halfDay === 0.5) ? 0.5 : 1.0
      if (a.saturdayPoya === 'Y') {
        poyaDays += weight
        if (a.sundayPoyaExtra && a.sundayPoyaExtra > 0) poyaExtraSum += Number(a.sundayPoyaExtra)
      } else {
        normalDays += weight
      }
      if (a.nightShift === 'Y' || a.fullNight === 'Y') {
        nightDays += weight
        if (a.nightAllowance && a.nightAllowance > 0) nightExtraSum += Number(a.nightAllowance)
      }
      if (a.statutoryHolidays && a.statutoryHolidays > 0) statutoryDays += Number(a.statutoryHolidays)
      if (a.totalOt && a.totalOt > 0) otHours += Number(a.totalOt)
    })

    if (normalDays === 0 && monthlyAtt.length > 0) {
      normalDays = monthlyAtt.reduce((acc, curr) => acc + ((curr.halfDay === 1 || curr.halfDay === 0.5) ? 0.5 : 1), 0)
    }

    const normalAmount = Math.round(normalDays * normalRate * 100) / 100

    const nightRate = Number(employee.nightAllowance || 0)
    const nightAmount = nightDays > 0 ? (nightExtraSum > 0 ? nightExtraSum : Math.round(nightDays * nightRate * 100) / 100) : 0

    const poyaRate = Math.round(normalRate * 1.5 * 100) / 100
    const poyaAmount = poyaDays > 0 ? (poyaExtraSum > 0 ? poyaExtraSum : Math.round(poyaDays * poyaRate * 100) / 100) : 0

    const otRate = Math.round((normalRate / 8 * 1.5) * 100) / 100
    const otAmount = otHours > 0 ? Math.round(otHours * otRate * 100) / 100 : 0

    const incentive = Number(employee.dayAllowance || 0)
    const statutoryHolidayAmount = Math.round(statutoryDays * normalRate * 100) / 100

    // Additions for this month
    const monthlyAdds = additionsList.filter(a => String(a.addYear) === targetYr && String(a.addMonth).padStart(2, '0') === targetMo)
    const totalAdditions = monthlyAdds.reduce((acc, curr) => acc + Number(curr.addAmount || 0), 0)

    const grossSalary = Math.round((normalAmount + nightAmount + poyaAmount + otAmount + incentive + statutoryHolidayAmount + totalAdditions) * 100) / 100

    const epf8 = Math.round(normalAmount * 0.08 * 100) / 100

    // Deductions for this month
    const monthlyDeds = deductionsList.filter(d => String(d.addYear) === targetYr && String(d.addMonth).padStart(2, '0') === targetMo)
    let advance = 0, telephone = 0, meal = 0, absent = 0, loan = 0, deathDonation = 0, otherDeds = 0

    monthlyDeds.forEach(d => {
      const code = (d.didCode || '').toLowerCase()
      const amt = Number(d.didAmount || 0)
      if (code.includes('adv')) advance += amt
      else if (code.includes('phone') || code.includes('tel')) telephone += amt
      else if (code.includes('meal') || code.includes('food')) meal += amt
      else if (code.includes('abs')) absent += amt
      else if (code.includes('loan')) loan += amt
      else if (code.includes('death') || code.includes('don')) deathDonation += amt
      else otherDeds += amt
    })

    if (deathDonation === 0 && employee.dethDenotion === true) {
      deathDonation = 100
    }

    const totalDeductions = Math.round((epf8 + advance + telephone + meal + absent + loan + deathDonation + otherDeds) * 100) / 100
    const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100

    const epf12 = Math.round(normalAmount * 0.12 * 100) / 100
    const etf3 = Math.round(normalAmount * 0.03 * 100) / 100

    return {
      basicSalary: normalRate,
      normalDays,
      normalRate,
      normalAmount,
      dayOffDays: 0,
      dayOffRate: 0,
      dayOffAmount: 0,
      nightDays,
      nightRate,
      nightAmount,
      poyaDays,
      poyaRate,
      poyaAmount,
      otHours,
      otRate,
      otAmount,
      incentive,
      statutoryDays,
      statutoryHolidayAmount,
      statutoryOtHours: 0,
      statutoryOtRate: 0,
      statutoryOtAmount: 0,
      statutoryValueAmount: statutoryHolidayAmount,
      workingDays: normalDays,
      totalOtHours: otHours,
      totalAdditions,
      grossSalary,
      epf8,
      advance,
      telephone,
      meal,
      absent,
      loan,
      deathDonation,
      totalDeductions,
      netSalary,
      epf12,
      etf3
    }
  }, [employee, monthlyData, attendanceList, additionsList, deductionsList, month, year])

  async function exportToExcel() {
    if (!employee || !payrollCalculation) {
      toast.error('Please select an employee first')
      return
    }
    try {
      await downloadPaySheetExcel({
        companyName,
        month,
        year,
        employee,
        calc: payrollCalculation,
        activeBc,
        plantFilter: selectedOption?.label || 'All Plants',
        attendance: filteredAttendanceList,
        transfers: employeeTransfers,
        additions: additionsList,
        deductions: deductionsList,
        leaves: leavesList,
        loans: loansList
      }, `Employee_Pay_Sheet_${employee.epfNo}_${year}_${month}.xlsx`)
      toast.success(`Pay sheet for ${employee.epfNo} exported to Excel!`)
    } catch (err) {
      console.error('Pay sheet Excel failed', err)
      toast.error('Could not create the pay sheet Excel file')
    }
  }

  // Builds the pay sheet PDF on one A4 or A5 page: the sheet is scaled to fit the page, never split
  async function exportToPDF(size: 'A4' | 'A5') {
    if (!employee) {
      toast.error('Please select an employee first')
      return
    }
    if (!payrollCalculation || !paySheetRef.current) {
      toast.error('No pay sheet for the selected period')
      return
    }
    setPrintSize(size)
    setGeneratingPdf(size)
    try {
      const canvas = await renderPaySheetCanvas(paySheetRef.current)
      const pdf = await newPaySheetPdf(size)
      drawPaySheetPage(pdf, canvas, { companyName, month, year, size })
      pdf.save(`Pay_Sheet_${employee.epfNo}_${year}_${month.padStart(2, '0')}_${size}.pdf`)
      toast.success(`${size} pay sheet PDF created`)
    } catch (err) {
      console.error('Pay sheet PDF failed', err)
      toast.error('Could not create the pay sheet PDF')
    } finally {
      setGeneratingPdf(null)
    }
  }

  useEffect(() => {
    const handleBc = () => {
      loadCompanyEmployees()
      if (selectedEpf) loadEmployeeHistory(selectedEpf)
    }
    window.addEventListener('hsb_bc_change', handleBc)
    window.addEventListener('storage', handleBc)
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc)
      window.removeEventListener('storage', handleBc)
    }
  }, [selectedEpf, year, month])

  return (
    <div className="space-y-6 print:space-y-3 paysheet-print">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#3F9884] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Individual Pay Sheet</span>
            <span className="text-slate-400 text-xs font-mono">{selectedEpf || 'No Employee Selected'}</span>
            <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded border border-slate-700">
              Company: {activeBc === 'ALL' ? 'All Companies' : activeBc}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Pay Sheet</h1>
          <p className="text-sm text-slate-400 mt-0.5">Scoped to logged-in company employees. Monthly pay sheet for the selected period (A4 / A5 PDF).</p>
        </div>

        {employee && (
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              <FileSpreadsheet size={16} />
              <span>Export Pay Sheet (Excel)</span>
            </button>
            <button
              onClick={() => exportToPDF('A4')}
              disabled={generatingPdf !== null}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md disabled:opacity-60"
            >
              <Printer size={16} />
              <span>{generatingPdf === 'A4' ? 'Creating A4 PDF...' : 'Pay Sheet A4 / PDF'}</span>
            </button>
            <button
              onClick={() => exportToPDF('A5')}
              disabled={generatingPdf !== null}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md disabled:opacity-60"
            >
              <Printer size={16} />
              <span>{generatingPdf === 'A5' ? 'Creating A5 PDF...' : 'Pay Sheet A5 / PDF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* A5 Printable Header (Visible only when printing) */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-1.5 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">{companyName}</h2>
            <p className="text-[10px] text-slate-600 font-medium">EMPLOYEE PAY SHEET &bull; {printSize} OFFICIAL RECORD</p>
          </div>
          <div className="text-right text-[9px] text-slate-500">
            <div>Period: <strong>{month.padStart(2, '0')}/{year}</strong></div>
            <div>Company: {companyName}</div>
          </div>
        </div>
      </div>

      {/* Controls Card: Employee Selector & Payroll Period */}
      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 print:hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Select Employee ({companyEmployees.length} unique employees in company)</span>
              <span className="text-slate-400 font-normal text-[11px]">Company Scoped</span>
            </label>
            <SearchableEmployeeSelect
              value={selectedEpf}
              employees={companyEmployees}
              onChange={(epf) => setSelectedEpf(epf)}
              placeholder="Type EPF or Name (e.g. EPF00001 or Sunil)"
            />
          </div>

          {/* Period Selector for Synced Pay Advice */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payroll Year</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="form-input text-xs bg-white py-1 px-2.5 font-medium"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payroll Month</label>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="form-input text-xs bg-white py-1 px-2.5 font-medium"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0')
                  const name = new Date(2026, i, 1).toLocaleString('default', { month: 'short' })
                  return <option key={m} value={m}>{m} - {name}</option>
                })}
              </select>
            </div>
          </div>
        </div>

        {employee && plantAssignmentOptions.length > 1 && (
          <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-teal-900 mb-1 flex items-center gap-1.5">
                <ArrowRightLeft size={14} className="text-teal-700" />
                Transfer Tracing: Plant Assignment Period
              </label>
              <select
                value={selectedPlantOptionId}
                onChange={e => setSelectedPlantOptionId(e.target.value)}
                className="w-full form-input text-xs bg-white border-teal-300 font-medium text-slate-800"
              >
                {plantAssignmentOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-teal-700 md:max-w-xs">
              {selectedOption?.id === 'ALL'
                ? 'Showing all historical records across all plants.'
                : `Filtered to records for ${selectedOption.plantName}.`}
            </p>
          </div>
        )}
      </div>

      {noAttendanceInPeriod && (
        <div data-no-attendance className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 print:hidden space-y-2">
          <p className="font-semibold">No attendance is saved for {employee?.epfNo} in {selectedPeriod}, so this pay sheet is 0.</p>
          {attendanceMonths.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>Open a month with attendance:</span>
              {attendanceMonths.slice(0, 12).map(([period, days]) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => { setYear(period.slice(0, 4)); setMonth(period.slice(5, 7)) }}
                  className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-semibold hover:bg-amber-100"
                >
                  {period} ({days} day{days === 1 ? '' : 's'})
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs">Rows in the Excel upload preview are not counted until they are saved. Click Save on the Attendance page first.</p>
          )}
        </div>
      )}

      {/* History Profile Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-500">Loading employee pay sheet...</div>
      ) : !employee ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-400 text-sm print:hidden">
          Please select an employee above to display their pay sheet.
        </div>
      ) : (
        <PaySheetView ref={paySheetRef} employee={employee} calc={payrollCalculation} month={month} year={year} activeBc={activeBc} />
      )}
    </div>
  )
}
