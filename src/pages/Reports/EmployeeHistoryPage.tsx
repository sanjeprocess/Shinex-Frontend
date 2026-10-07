import React, { useEffect, useState, useMemo } from 'react'
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
import { list as listTransfers, PlantTransfer } from '../../mocks/plantTransfers'
import { list as listPlants, Customer } from '../../mocks/customers'
import { getMonthlySummary, type MonthlySummary } from '../../mocks/monthlySummary'

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

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : ''
  const years = Array.from({ length: 5 }, (_, index) => String(new Date().getFullYear() - 2 + index))

  useEffect(() => {
    loadCompanyEmployees()
    listPlants(cleanBc).then(setPlants).catch(console.error)
  }, [activeBc])

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
      const allEmps = await listEmployees(cleanBc)
      const emp = allEmps.find(e => e.epfNo === epf)
      setEmployee(emp || null)

      const [att, add, ded, lve, lon, allTr] = await Promise.all([
        listAttendance(),
        listAdditions(),
        listDeductions(),
        listLeaves(),
        listLoans(),
        listTransfers(cleanBc)
      ])

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
      const normalDays = monthlyData.normalDays !== undefined ? monthlyData.normalDays : (monthlyData.attendance?.workingDays || 0)
      const normalRate = monthlyData.normalRate !== undefined ? monthlyData.normalRate : (monthlyData.basicSalary || Number(employee.basicSalary || 840))
      const normalAmount = monthlyData.normalAmount !== undefined ? monthlyData.normalAmount : Math.round(normalDays * normalRate * 100) / 100

      const nightDays = monthlyData.nightDays !== undefined ? monthlyData.nightDays : 0
      const nightRate = monthlyData.nightRate !== undefined ? monthlyData.nightRate : (monthlyData.nightAllowance || Number(employee.nightAllowance || 540))
      const nightAmount = monthlyData.nightAmount !== undefined ? monthlyData.nightAmount : 0

      const poyaDays = monthlyData.poyaDays !== undefined ? monthlyData.poyaDays : 0
      const poyaRate = monthlyData.poyaRate !== undefined ? monthlyData.poyaRate : Math.round(normalRate * 1.5 * 100) / 100
      const poyaAmount = monthlyData.poyaAmount !== undefined ? monthlyData.poyaAmount : (monthlyData.poyaDayExtra || 0)

      const otHours = monthlyData.overtimeHours !== undefined ? monthlyData.overtimeHours : (monthlyData.attendance?.otHours || 0)
      const otRate = monthlyData.overtimeRate !== undefined ? monthlyData.overtimeRate : (monthlyData.attendance?.otRate || Math.round((normalRate / 8 * 1.5) * 100) / 100)
      const otAmount = monthlyData.overtimeAmount !== undefined ? monthlyData.overtimeAmount : 0

      const incentive = monthlyData.dayAllowance !== undefined ? monthlyData.dayAllowance : Number(employee.dayAllowance || 0)
      const statutoryHolidayAmount = monthlyData.statutoryHolidayAmount !== undefined ? monthlyData.statutoryHolidayAmount : 0
      const totalAdditions = monthlyData.totalAdditions !== undefined ? monthlyData.totalAdditions : 0
      const grossSalary = monthlyData.grossSalary !== undefined ? monthlyData.grossSalary : Math.round((normalAmount + nightAmount + poyaAmount + otAmount + incentive + statutoryHolidayAmount + totalAdditions) * 100) / 100

      const epf8 = monthlyData.epf8 !== undefined ? monthlyData.epf8 : Math.round(normalAmount * 0.08 * 100) / 100
      const advance = monthlyData.advanceDeduction !== undefined ? monthlyData.advanceDeduction : 0
      const telephone = monthlyData.telephoneDeduction !== undefined ? monthlyData.telephoneDeduction : 0
      const meal = monthlyData.mealDeduction !== undefined ? monthlyData.mealDeduction : 0
      const absent = monthlyData.absentDeduction !== undefined ? monthlyData.absentDeduction : 0
      const loan = monthlyData.loanDeduction !== undefined ? monthlyData.loanDeduction : 0
      const deathDonation = monthlyData.deathDonation !== undefined ? monthlyData.deathDonation : 0

      const totalDeductions = monthlyData.totalDeductions !== undefined ? monthlyData.totalDeductions : Math.round((epf8 + advance + telephone + meal + absent + loan + deathDonation) * 100) / 100
      const netSalary = monthlyData.netSalary !== undefined ? monthlyData.netSalary : Math.round((grossSalary - totalDeductions) * 100) / 100

      const epf12 = monthlyData.epf12 !== undefined ? monthlyData.epf12 : Math.round(normalAmount * 0.12 * 100) / 100
      const etf3 = monthlyData.etf3 !== undefined ? monthlyData.etf3 : Math.round(normalAmount * 0.03 * 100) / 100

      return {
        basicSalary: normalRate,
        normalDays,
        normalRate,
        normalAmount,
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
        statutoryDays: monthlyData.attendance?.statutoryHolidayCount || 0,
        statutoryHolidayAmount,
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

    const nightRate = Number(employee.nightAllowance || 540)
    const nightAmount = nightExtraSum > 0 ? nightExtraSum : (nightDays * nightRate)

    const poyaRate = Math.round(normalRate * 1.5 * 100) / 100
    const poyaAmount = poyaExtraSum > 0 ? poyaExtraSum : Math.round(poyaDays * poyaRate * 100) / 100

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

  function exportToExcel() {
    if (!employee || !payrollCalculation) {
      toast.error('Please select an employee first')
      return
    }

    const currentPeriod = `${month.padStart(2, '0')}/${year}`
    const calc = payrollCalculation

    const lines: string[] = [
      `SHINEX HOUSE KEEPING SERVICES (PVT) LTD,,,${currentPeriod},`,
      `,,,,`,
      `NAME AND EPF NO / பெயர் / නම සහ අංකය,,,${employee.firstName} ${employee.lastName || ''} - ${employee.epfNo},`,
      `,DAY,HOUR,RATE,AMOUNT`,
      `NORMAL / பொது / සාමාන්‍ය,${calc.normalDays},,${calc.normalRate},${calc.normalAmount}`,
      `NIGHT / இரவு / රාත්‍රී,,${calc.nightDays || ''},${calc.nightRate},${calc.nightAmount > 0 ? calc.nightAmount : '-'}`,
      `POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය,${calc.poyaDays},,${calc.poyaRate},${calc.poyaAmount > 0 ? calc.poyaAmount : '-'}`,
      `OVERTIME / மேலதிக நேரம் / අතිකාල,,${calc.otHours || ''},${calc.otRate},${calc.otAmount > 0 ? calc.otAmount : '-'}`,
      `INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව,,,,${calc.incentive > 0 ? calc.incentive : '-'}`,
      `ATTENDANCE ALLOWANCE / கலந்துகொள்ளல் படி / පැමිණීමේ දීමනාව,,,,`,
      `ATTENDANCE BONUS / வருகை போனஸ் / පැමිණීමේ බෝනස්,,,,`,
      `STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු,,,,${calc.statutoryHolidayAmount > 0 ? calc.statutoryHolidayAmount : '-'}`,
      `OTHER / மற்றவை / වෙනත්,,,,${calc.totalAdditions > 0 ? calc.totalAdditions : ''}`,
      `GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප,,,,${calc.grossSalary}`,
      `,,,,`,
      `DEDUCTIONS / கழிவுகள் / අඩු කිරීම්,,,,`,
      `E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%,,,,${calc.epf8}`,
      `ADVANCE / முற்பணம் / අත්තිකාරම්,,,,${calc.advance > 0 ? calc.advance : ''}`,
      `TELEPHONE / தொலைபேசி / දුරකථනය,,,,${calc.telephone > 0 ? calc.telephone : '-'}`,
      `MEAL / உணவு / ආහාරය,,,,${calc.meal > 0 ? calc.meal : ''}`,
      `ABSENT / வராதிருத்தல் / නොපැමිණීම,,,,${calc.absent > 0 ? calc.absent : ''}`,
      `LOAN / கடன் / ණය,,,,${calc.loan > 0 ? calc.loan : ''}`,
      `DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර,,,,${calc.deathDonation > 0 ? calc.deathDonation : ''}`,
      `TOTAL DEDUCTION / மொத்த கழிவு / මුළු අඩුකිරීම,,,,${calc.totalDeductions}`,
      `NET SALARY / நிகர சம்பளம் / ශුද්ධ වැටුප,,,,${calc.netSalary}`,
      `COMPANY CONTRIBUTION / நிறுவன பங்களிப்பு / සමාගම් දායකත්වය,,,,`,
      `E.P.F. 12% / ஊ.சே.நி. 12% / සේ.අ.අ. 12%,,,,${calc.epf12}`,
      `E.T.F. 3% / ஊ.பொ.நி. 3% / සේ.අ.අ.අ. 3%,,,,${calc.etf3}`,
      '',
      '========================================================================',
      `EMPLOYEE COMPLETE RECORD DOSSIER - ${employee.epfNo}`,
      `Full Name,${employee.firstName} ${employee.lastName || ''}`,
      `NIC No,${employee.nicNo || 'N/A'}`,
      `Business Center,${employee.businessCenter || activeBc}`,
      `Current Plant,${employee.plantCode || 'N/A'}`,
      `Plant Filter Applied,${selectedOption?.label || 'All Plants'}`,
      `Basic Salary,LKR ${employee.basicSalary || 0}`,
      `Hired Date,${employee.hiredDate || 'N/A'}`,
      '',
      '--- ATTENDANCE HISTORY ---',
      'Date,Time In,Time Out,Total Hours,OT Hours,Plant Code,Business Center',
      ...filteredAttendanceList.map(a => `"${a.dayIn}","${a.timeIn}","${a.timeOut || ''}","${a.totalWorkingHours || 0}","${a.totalOt || 0}","${a.plantCode || ''}","${a.businessCenter || ''}"`),
      '',
      '--- PLANT TRANSFER MOVEMENTS ---',
      'Transfer Date,From Plant,To Plant,Duration Days,Status,Work Details',
      ...employeeTransfers.map(t => `"${t.transferDate}","${t.fromPlant || ''}","${t.toPlant || ''}","${t.daysWorked || 1}","${t.status || 'Active'}","${(t.workDetails || '').replace(/"/g, '""')}"`),
      '',
      '--- ADDITIONS HISTORY ---',
      'Code,Amount,Month,Year,Every Month',
      ...additionsList.map(a => `"${a.addCode}","${a.addAmount}","${a.addMonth}","${a.addYear}","${a.everyMonth || 'N'}"`),
      '',
      '--- DEDUCTIONS HISTORY ---',
      'Code,Amount,Month,Year,Every Month',
      ...deductionsList.map(d => `"${d.didCode}","${d.didAmount}","${d.addMonth}","${d.addYear}","${d.everyMonth || 'N'}"`),
      '',
      '--- LEAVE HISTORY ---',
      'Type,Start Date,End Date,Days,Year,Month',
      ...leavesList.map(l => `"${l.leaveType}","${l.start || l.leaveStartDate || ''}","${l.end || l.leaveEndDate || ''}","${l.leaveDays || 0}","${l.leaveYear || ''}","${l.leaveMonth || ''}"`),
      '',
      '--- LOAN HISTORY ---',
      'Loan ID,Amount,Start Date,Duration Months,Business Unit',
      ...loansList.map(l => `"${l.loanId}","${l.loanAmount}","${l.loanStartDate}","${l.loanDuration}","${l.businessUnit || ''}"`)
    ]

    const csvContent = '\uFEFF' + lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Employee_Complete_Dossier_${employee.epfNo}_${year}_${month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Complete dossier for ${employee.epfNo} exported to Excel!`)
  }

  function exportToPDF() {
    if (!employee) {
      toast.error('Please select an employee first')
      return
    }
    window.print()
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
    <div className="space-y-6 print:space-y-3">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#3F9884] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Individual Profile History</span>
            <span className="text-slate-400 text-xs font-mono">{selectedEpf || 'No Employee Selected'}</span>
            <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded border border-slate-700">
              Company: {activeBc === 'ALL' ? 'All Companies' : activeBc}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Complete Record Dossier</h1>
          <p className="text-sm text-slate-400 mt-0.5">Scoped to logged-in company employees. View full historical master & transaction records with plant tracing (A5 Export Format).</p>
        </div>

        {employee && (
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              <FileSpreadsheet size={16} />
              <span>Export Dossier (Excel)</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              <Printer size={16} />
              <span>Print A5 Sheet / PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* A5 Printable Header (Visible only when printing) */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-2 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">SHINEX HOUSE KEEPING SERVICES (PVT) LTD</h2>
            <p className="text-[10px] text-slate-600 font-medium">EMPLOYEE COMPLETE RECORD DOSSIER &bull; A5 OFFICIAL RECORD</p>
          </div>
          <div className="text-right text-[9px] text-slate-500">
            <div>Period: <strong>{month.padStart(2, '0')}/{year}</strong></div>
            <div>Company: {employee?.businessCenter || activeBc}</div>
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

      {/* History Profile Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-500">Loading complete employee dossier...</div>
      ) : !employee ? (
        <div className="bg-white p-12 rounded-2xl shadow-flat border text-center text-slate-400 text-sm print:hidden">
          Please select an employee above to display their complete profile and transaction history.
        </div>
      ) : (
        <div className="space-y-5 print:space-y-3">
          {/* Master Employee Summary Card */}
          <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 print:p-3 print:rounded-lg print:border-slate-300 print-page-break-avoid">
            <div className="flex items-center gap-4 mb-3 pb-3 border-b">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[#2F6F5E] shadow-sm flex-shrink-0 print:w-10 print:h-10" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2F6F5E] to-[#3F9884] text-white flex items-center justify-center font-bold text-base uppercase shadow-sm flex-shrink-0 print:w-10 print:h-10 print:text-xs">
                  {(employee.firstName?.[0] || 'E') + (employee.lastName?.[0] || '')}
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <h3 className="text-base font-bold text-slate-900 print:text-xs">
                    {employee.firstName} {employee.lastName || ''} <span className="text-[#2F6F5E] font-mono">({employee.epfNo})</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 print:text-[8px]">
                      Plant: {employee.plantCode || 'Main Plant'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200 print:text-[8px]">
                      {employee.statusActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 print:text-[9px]">
                  NIC: <strong className="text-slate-700">{employee.nicNo || '—'}</strong> &bull; Section: <strong className="text-slate-700">{employee.sectionCode || '—'}</strong> &bull; BC: <strong className="text-slate-700">{employee.businessCenter || activeBc}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs print:grid-cols-4 print:text-[9px] print:gap-1.5">
              <div><span className="text-slate-500 block">Full Name</span><strong className="text-slate-800">{employee.firstName} {employee.lastName || ''}</strong></div>
              <div><span className="text-slate-500 block">NIC No</span><strong className="text-slate-800">{employee.nicNo || '—'}</strong></div>
              <div><span className="text-slate-500 block">Business Center</span><strong className="text-slate-800">{employee.businessCenter || activeBc}</strong></div>
              <div><span className="text-slate-500 block">Daily Rate (Normal)</span><strong className="text-[#2F6F5E]">LKR {Number(employee.basicSalary || 0).toLocaleString()}</strong></div>

              <div><span className="text-slate-500 block">Current Plant</span><strong className="text-slate-800">{employee.plantCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Section Code</span><strong className="text-slate-800">{employee.sectionCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Hired Date</span><strong className="text-slate-800">{employee.hiredDate || '—'}</strong></div>
              <div><span className="text-slate-500 block">Bank Account</span><strong className="text-slate-800">{employee.bankName || 'Bank'} — {employee.bankAccountNumber || '—'}</strong></div>
            </div>
          </div>

          {/* Unified Pay Advice Breakdown (100% Synchronized with Monthly Summary & Generated Pay Advice Layout) */}
          {payrollCalculation && (
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded-lg print:border-slate-300 print-page-break-avoid">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between print:bg-slate-800 print:py-1.5">
                <div>
                  <h3 className="font-bold text-xs tracking-wide flex items-center gap-1.5 text-emerald-400 print:text-[10px]">
                    <FileText size={14} />
                    SHINEX PAY ADVICE DOSSIER &bull; {month.padStart(2, '0')}/{year}
                  </h3>
                  <p className="text-[11px] text-slate-300 print:text-[8px]">
                    NAME & EPF: {employee.firstName} {employee.lastName || ''} - {employee.epfNo}
                  </p>
                </div>
                <span className="text-xs bg-emerald-900/90 text-emerald-200 px-3 py-1 rounded-full border border-emerald-600 font-mono font-bold print:text-[9px] print:py-0.5">
                  Net Salary: LKR {payrollCalculation.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Earnings Table */}
              <div className="p-3 border-b border-slate-200 print:p-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1.5 print:text-[9px]">
                  Earnings & Allowances / கொடுப்பனவுகள் / ඉපැයීම්
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200 print:text-[8.5px]">
                    <thead className="bg-slate-50 text-slate-600 font-semibold print:bg-slate-100">
                      <tr>
                        <th className="px-2.5 py-1.5">Description / விவரம் / විස්තරය</th>
                        <th className="px-2 py-1.5 text-center">Day</th>
                        <th className="px-2 py-1.5 text-center">Hour</th>
                        <th className="px-2.5 py-1.5 text-right">Rate (LKR)</th>
                        <th className="px-2.5 py-1.5 text-right">Amount (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">NORMAL / பொது / සාමාන්‍ය</td>
                        <td className="px-2 py-1 text-center text-slate-700">{payrollCalculation.normalDays}</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right text-slate-700">{payrollCalculation.normalRate.toFixed(2)}</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.normalAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">NIGHT / இரவு / රාත්‍රී</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2 py-1 text-center text-slate-700">{payrollCalculation.nightDays || '—'}</td>
                        <td className="px-2.5 py-1 text-right text-slate-700">{payrollCalculation.nightRate.toFixed(2)}</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.nightAmount > 0 ? payrollCalculation.nightAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය</td>
                        <td className="px-2 py-1 text-center text-slate-700">{payrollCalculation.poyaDays || '—'}</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right text-slate-700">{payrollCalculation.poyaRate.toFixed(2)}</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.poyaAmount > 0 ? payrollCalculation.poyaAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">OVERTIME / மேலதிக நேரம் / අතිකාල (1.5× rate)</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2 py-1 text-center text-amber-700 font-bold">{payrollCalculation.otHours || '—'}</td>
                        <td className="px-2.5 py-1 text-right text-slate-700">{payrollCalculation.otRate.toFixed(2)}</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-amber-900">{payrollCalculation.otAmount > 0 ? payrollCalculation.otAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.incentive > 0 ? payrollCalculation.incentive.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු</td>
                        <td className="px-2 py-1 text-center text-slate-700">{payrollCalculation.statutoryDays || '—'}</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right text-slate-700">{payrollCalculation.statutoryDays > 0 ? payrollCalculation.normalRate.toFixed(2) : '—'}</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.statutoryHolidayAmount > 0 ? payrollCalculation.statutoryHolidayAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-2.5 py-1 font-sans font-medium text-slate-800">OTHER ADDITIONS / மற்றவை / වෙනත් එකතු කිරීම්</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2 py-1 text-center text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right text-slate-400">—</td>
                        <td className="px-2.5 py-1 text-right font-semibold text-slate-900">{payrollCalculation.totalAdditions > 0 ? payrollCalculation.totalAdditions.toFixed(2) : '—'}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold font-sans border-t-2 border-emerald-300 print:bg-slate-100">
                        <td className="px-2.5 py-1.5 text-emerald-950 font-bold" colSpan={4}>GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප</td>
                        <td className="px-2.5 py-1.5 text-right text-emerald-950 font-mono font-bold">LKR {payrollCalculation.grossSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions & Company Contributions */}
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2 print:p-2 print:gap-2">
                <div className="border border-slate-200 rounded-xl overflow-hidden print:rounded print:border-slate-300">
                  <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 font-bold text-rose-900 text-[11px] uppercase tracking-wider print:text-[8.5px] print:py-1">
                    Deductions / கழிவுகள் / අඩු කිරීම්
                  </div>
                  <table className="w-full text-left text-xs divide-y divide-slate-100 font-mono print:text-[8.5px]">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%</td>
                        <td className="px-3 py-1 text-right font-semibold text-rose-700">LKR {payrollCalculation.epf8.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">ADVANCE / முற்பணம் / අත්තිකාරම්</td>
                        <td className="px-3 py-1 text-right font-semibold text-slate-800">{payrollCalculation.advance > 0 ? `LKR ${payrollCalculation.advance.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">TELEPHONE / தொலைபேசி / දුරකථනය</td>
                        <td className="px-3 py-1 text-right font-semibold text-slate-800">{payrollCalculation.telephone > 0 ? `LKR ${payrollCalculation.telephone.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">MEAL / உணவு / ආහාරය</td>
                        <td className="px-3 py-1 text-right font-semibold text-slate-800">{payrollCalculation.meal > 0 ? `LKR ${payrollCalculation.meal.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">LOAN / கடன் / ණය</td>
                        <td className="px-3 py-1 text-right font-semibold text-slate-800">{payrollCalculation.loan > 0 ? `LKR ${payrollCalculation.loan.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 font-sans text-slate-700">DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර</td>
                        <td className="px-3 py-1 text-right font-semibold text-slate-800">{payrollCalculation.deathDonation > 0 ? `LKR ${payrollCalculation.deathDonation.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr className="bg-rose-50 font-bold font-sans border-t border-rose-200 print:bg-slate-100">
                        <td className="px-3 py-1.5 text-rose-950 font-bold">TOTAL DEDUCTION / மொத்த கழிவு</td>
                        <td className="px-3 py-1.5 text-right text-rose-950 font-mono font-bold">LKR {payrollCalculation.totalDeductions.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between print:rounded print:border-slate-300">
                  <div>
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-[11px] uppercase tracking-wider print:text-[8.5px] print:py-1">
                      Company Contribution / நிறுவன பங்களிப்பு
                    </div>
                    <table className="w-full text-left text-xs divide-y divide-slate-100 font-mono print:text-[8.5px]">
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-3 py-1 font-sans text-slate-700">E.P.F. 12% (Company) / ஊ.சே.நி. 12%</td>
                          <td className="px-3 py-1 text-right font-semibold text-slate-800">LKR {payrollCalculation.epf12.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-1 font-sans text-slate-700">E.T.F. 3% (Company) / ஊ.பொ.நி. 3%</td>
                          <td className="px-3 py-1 text-right font-semibold text-slate-800">LKR {payrollCalculation.etf3.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between font-sans print:p-2">
                    <span className="font-bold text-xs text-emerald-950 print:text-[9px]">FINAL NET SALARY:</span>
                    <span className="font-mono text-sm font-black text-emerald-900 print:text-xs">
                      LKR {payrollCalculation.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Plant Movement & Transfer History Card */}
          {employeeTransfers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded print:border-slate-300 print-page-break-avoid">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:py-1">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 print:text-[9px]">
                  <ArrowRightLeft size={13} className="text-teal-600" />
                  Plant Transfer Movements & History ({employeeTransfers.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs print:text-[8.5px]">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold">
                    <tr>
                      <th className="px-3 py-1.5">Transfer Date</th>
                      <th className="px-3 py-1.5">Route (From → To)</th>
                      <th className="px-3 py-1.5">Duration</th>
                      <th className="px-3 py-1.5">Status</th>
                      <th className="px-3 py-1.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeTransfers.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1 mono-numeric font-medium">{t.transferDate} {t.endDate ? `to ${t.endDate}` : ''}</td>
                        <td className="px-3 py-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100">{t.fromPlant || 'Base'}</span>
                          <span className="mx-1 text-teal-600">→</span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">{t.toPlant}</span>
                        </td>
                        <td className="px-3 py-1 mono-numeric">{t.daysWorked || 1} days</td>
                        <td className="px-3 py-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold print:text-[8px] ${t.status === 'Active' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {t.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-slate-500">{t.workDetails || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance History (Scoped & Filtered) */}
          <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded print:border-slate-300 print-page-break-avoid">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:py-1">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 print:text-[9px]">
                <Calendar size={13} className="text-teal-600" />
                Attendance Log History ({filteredAttendanceList.length}{selectedOption?.id !== 'ALL' ? ` filtered by ${selectedOption.plantName}` : ''})
              </h4>
              {selectedOption?.id !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedPlantOptionId('ALL')}
                  className="text-xs text-teal-700 hover:underline font-medium print:hidden"
                >
                  Clear Plant Filter (Show All {attendanceList.length})
                </button>
              )}
            </div>
            {filteredAttendanceList.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">No attendance logs recorded for this plant/period.</div>
            ) : (
              <div className="overflow-x-auto max-h-64 print:max-h-none">
                <table className="w-full text-left text-xs print:text-[8.5px]">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5">Date</th>
                      <th className="px-3 py-1.5">Time In</th>
                      <th className="px-3 py-1.5">Time Out</th>
                      <th className="px-3 py-1.5">Plant</th>
                      <th className="px-3 py-1.5">Total Hours</th>
                      <th className="px-3 py-1.5">OT Hours</th>
                      <th className="px-3 py-1.5">Business Center</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendanceList.slice(0, 30).map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1 mono-numeric font-medium">{a.dayIn}</td>
                        <td className="px-3 py-1 mono-numeric">{a.timeIn}</td>
                        <td className="px-3 py-1 mono-numeric">{a.timeOut || '—'}</td>
                        <td className="px-3 py-1 font-medium text-teal-800">{a.plantCode || employee.plantCode || '—'}</td>
                        <td className="px-3 py-1 mono-numeric font-semibold">{a.totalWorkingHours || 0} hrs</td>
                        <td className="px-3 py-1 mono-numeric text-amber-600 font-semibold">{a.totalOt || 0} hrs</td>
                        <td className="px-3 py-1">{a.businessCenter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Additions, Deductions, Loans & Leaves Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2 print-page-break-avoid">
            {/* Additions History */}
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded print:border-slate-300">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 print:py-1">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider print:text-[9px]">Additions History ({additionsList.length})</h4>
              </div>
              {additionsList.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">No additions recorded.</div>
              ) : (
                <table className="w-full text-left text-xs divide-y divide-slate-100 print:text-[8.5px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr><th className="px-3 py-1">Add Code</th><th className="px-3 py-1">Amount</th><th className="px-3 py-1">Month/Year</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {additionsList.slice(0, 10).map((a, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1 font-medium">{a.addCode}</td>
                        <td className="px-3 py-1 font-semibold text-emerald-600 font-mono">LKR {Number(a.addAmount).toLocaleString()}</td>
                        <td className="px-3 py-1 mono-numeric">{a.addMonth}/{a.addYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Deductions History */}
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded print:border-slate-300">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 print:py-1">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider print:text-[9px]">Deductions History ({deductionsList.length})</h4>
              </div>
              {deductionsList.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">No deductions recorded.</div>
              ) : (
                <table className="w-full text-left text-xs divide-y divide-slate-100 print:text-[8.5px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr><th className="px-3 py-1">Did Code</th><th className="px-3 py-1">Amount</th><th className="px-3 py-1">Month/Year</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deductionsList.slice(0, 10).map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1 font-medium">{d.didCode}</td>
                        <td className="px-3 py-1 font-semibold text-rose-600 font-mono">LKR {Number(d.didAmount).toLocaleString()}</td>
                        <td className="px-3 py-1 mono-numeric">{d.addMonth}/{d.addYear}</td>
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
