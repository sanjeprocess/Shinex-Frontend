import React, { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Building2, ArrowRightLeft, Calendar, FileText, Printer, CheckCircle } from 'lucide-react'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../services/employeeService'
import { list as listAttendance } from '../../mocks/attendance'
import { list as listAdditions } from '../../mocks/transactionAdditions'
import { list as listDeductions } from '../../mocks/transactionDeductions'
import { list as listLeaves } from '../../mocks/leaves'
import { list as listLoans } from '../../mocks/loans'
import { list as listTransfers, PlantTransfer } from '../../mocks/plantTransfers'
import { list as listPlants, Customer } from '../../mocks/customers'

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

  const [employee, setEmployee] = useState<any | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [additionsList, setAdditionsList] = useState<any[]>([])
  const [deductionsList, setDeductionsList] = useState<any[]>([])
  const [leavesList, setLeavesList] = useState<any[]>([])
  const [loansList, setLoansList] = useState<any[]>([])
  const [employeeTransfers, setEmployeeTransfers] = useState<PlantTransfer[]>([])
  const [selectedPlantOptionId, setSelectedPlantOptionId] = useState<string>('ALL')

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL'
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : ''

  useEffect(() => {
    loadCompanyEmployees()
    listPlants(cleanBc).then(setPlants).catch(console.error)
  }, [activeBc])

  async function loadCompanyEmployees() {
    try {
      const list = await listEmployees(cleanBc)
      // Feature 6: De-duplicate by unique employee (epfNo) for logged-in company only
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
      setSelectedPlantOptionId('ALL')
      return
    }

    loadEmployeeHistory(selectedEpf)
  }, [selectedEpf])

  async function loadEmployeeHistory(epf: string) {
    setLoading(true)
    setSelectedPlantOptionId('ALL')
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
    } catch (err) {
      toast.error('Failed to load employee history')
    } finally {
      setLoading(false)
    }
  }

  // Feature 4: Compute Current and Previous Plant options
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

    // Also check distinct plantCodes from attendance if any other previous plants exist
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

  // Filtered attendance based on selected plant option
  const selectedOption = plantAssignmentOptions.find(o => o.id === selectedPlantOptionId) || plantAssignmentOptions[0]

  const filteredAttendanceList = useMemo(() => {
    if (!selectedOption || selectedOption.id === 'ALL') {
      return attendanceList
    }

    return attendanceList.filter(a => {
      // Filter by plant code if present
      if (a.plantCode && selectedOption.plantCode && a.plantCode.trim().toUpperCase() === selectedOption.plantCode.trim().toUpperCase()) {
        return true
      }
      // Filter by date range if available
      if (selectedOption.startDate && a.dayIn && a.dayIn < selectedOption.startDate) {
        return false
      }
      if (selectedOption.endDate && a.dayIn && a.dayIn > selectedOption.endDate) {
        return false
      }
      return !selectedOption.plantCode || (a.plantCode && a.plantCode.includes(selectedOption.plantCode))
    })
  }, [attendanceList, selectedOption])

  const payrollDossierCalculation = useMemo(() => {
    if (!employee) return null

    const dailyRate = Number(employee.basicSalary || 0)
    const normalRate = dailyRate > 0 ? dailyRate : 840
    
    // Total shifts worked
    const totalAttendanceDays = filteredAttendanceList.reduce((acc, curr) => acc + (curr.halfDay === 1 || curr.halfDay === 0.5 ? 0.5 : 1), 0)
    const normalDays = totalAttendanceDays
    const normalAmount = Math.round(normalDays * normalRate * 100) / 100

    // Night Shift calculation
    const nightDays = filteredAttendanceList.filter(a => a.nightShift === 'Y' || a.fullNight === 'Y').length
    const nightRate = Number(employee.nightAllowance || 540)
    const nightAmount = filteredAttendanceList.reduce((acc, curr) => {
      if (curr.nightShift === 'Y' || curr.fullNight === 'Y') {
        const rate = (curr.nightAllowance && curr.nightAllowance > 0) ? Number(curr.nightAllowance) : nightRate
        return acc + rate
      }
      return acc
    }, 0)

    // Sunday / Poya calculation (Uses explicit Sunday Poya Extra Payment logged in attendance)
    const poyaDays = filteredAttendanceList.filter(a => a.saturdayPoya === 'Y').length
    const poyaExtraSum = filteredAttendanceList.reduce((acc, curr) => {
      if (curr.saturdayPoya === 'Y') {
        return acc + (Number(curr.sundayPoyaExtra) || 0)
      }
      return acc
    }, 0)
    const poyaRate = poyaDays > 0 ? (poyaExtraSum > 0 ? Math.round((poyaExtraSum / poyaDays) * 100) / 100 : 0) : 0
    const poyaAmount = poyaExtraSum

    // Statutory Holidays
    const statutoryDays = filteredAttendanceList.reduce((acc, curr) => acc + (Number(curr.statutoryHolidays) || 0), 0)
    const statutoryHolidayAmount = Math.round(statutoryDays * normalRate * 100) / 100

    // Overtime
    const otHours = filteredAttendanceList.reduce((acc, curr) => acc + (Number(curr.totalOt) || 0), 0)
    const otRate = Math.round((normalRate / 8 * 1.5) * 100) / 100
    const otAmount = otHours > 0 ? Math.round(otHours * otRate * 100) / 100 : 0

    const incentive = Number(employee.dayAllowance || 0)
    const totalAdds = additionsList.reduce((acc, curr) => acc + (Number(curr.addAmount) || 0), 0)
    const otherAdditions = totalAdds

    const grossSalary = Math.round((normalAmount + nightAmount + poyaAmount + otAmount + incentive + statutoryHolidayAmount + totalAdds) * 100) / 100

    const epf8 = Math.round(normalAmount * 0.08 * 100) / 100
    const advance = deductionsList.filter(d => (d.didCode || '').toLowerCase().includes('adv')).reduce((acc, curr) => acc + (Number(curr.didAmount) || 0), 0)
    const otherDeds = deductionsList.filter(d => !(d.didCode || '').toLowerCase().includes('adv')).reduce((acc, curr) => acc + (Number(curr.didAmount) || 0), 0)
    const totalDeductions = Math.round((epf8 + advance + otherDeds) * 100) / 100
    const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100

    const epf12 = Math.round(normalAmount * 0.12 * 100) / 100
    const etf3 = Math.round(normalAmount * 0.03 * 100) / 100

    return {
      basic: dailyRate,
      normalRate,
      normalDays,
      normalAmount,
      poyaDays,
      poyaRate,
      poyaAmount,
      nightDays,
      nightRate,
      nightAmount,
      otHours,
      otRate,
      otAmount,
      incentive,
      statutoryDays,
      statutoryHolidayAmount,
      otherAdditions,
      grossSalary,
      epf8,
      advance,
      otherDeds,
      totalDeductions,
      netSalary,
      epf12,
      etf3
    }
  }, [employee, filteredAttendanceList, additionsList, deductionsList])

  function exportToExcel() {
    if (!employee) {
      toast.error('Please select an employee first')
      return
    }

    const currentPeriod = new Date().toISOString().slice(5, 7) + '/' + new Date().getFullYear();
    const dailyRate = Number(employee.basicSalary || 0);
    const normalRate = dailyRate > 0 ? dailyRate : 840;
    
    const totalAttendanceDays = filteredAttendanceList.reduce((acc, curr) => acc + (curr.halfDay === 1 || curr.halfDay === 0.5 ? 0.5 : 1), 0);
    const normalDays = totalAttendanceDays;
    const normalAmount = Math.round(normalDays * normalRate * 100) / 100;

    const nightDays = filteredAttendanceList.filter(a => a.nightShift === 'Y' || a.fullNight === 'Y').length;
    const nightRate = Number(employee.nightAllowance || 540);
    const nightAmount = filteredAttendanceList.reduce((acc, curr) => {
      if (curr.nightShift === 'Y' || curr.fullNight === 'Y') {
        const rate = (curr.nightAllowance && curr.nightAllowance > 0) ? Number(curr.nightAllowance) : nightRate;
        return acc + rate;
      }
      return acc;
    }, 0);

    const poyaDays = filteredAttendanceList.filter(a => a.saturdayPoya === 'Y').length;
    const poyaExtraSum = filteredAttendanceList.reduce((acc, curr) => {
      if (curr.saturdayPoya === 'Y') {
        return acc + (Number(curr.sundayPoyaExtra) || 0);
      }
      return acc;
    }, 0);
    const poyaRate = poyaDays > 0 ? (poyaExtraSum > 0 ? Math.round((poyaExtraSum / poyaDays) * 100) / 100 : '-') : '-';
    const poyaAmount = poyaExtraSum > 0 ? poyaExtraSum : '-';

    const statutoryDays = filteredAttendanceList.reduce((acc, curr) => acc + (Number(curr.statutoryHolidays) || 0), 0);
    const statutoryHolidayAmount = statutoryDays > 0 ? Math.round(statutoryDays * normalRate * 100) / 100 : '-';

    const otHours = filteredAttendanceList.reduce((acc, curr) => acc + (Number(curr.totalOt) || 0), 0);
    const otRate = Math.round((normalRate / 8 * 1.5) * 100) / 100;
    const otAmount = otHours > 0 ? Math.round(otHours * otRate * 100) / 100 : '-';

    const incentive = employee.dayAllowance ? employee.dayAllowance : '-';
    const totalAdds = additionsList.reduce((acc, curr) => acc + (Number(curr.addAmount) || 0), 0);
    const otherAdditions = totalAdds > 0 ? totalAdds : '';

    const grossSalary = Math.round((normalAmount + nightAmount + (typeof poyaAmount === 'number' ? poyaAmount : 0) + (typeof otAmount === 'number' ? otAmount : 0) + (employee.dayAllowance || 0) + (typeof statutoryHolidayAmount === 'number' ? statutoryHolidayAmount : 0) + totalAdds) * 100) / 100;

    const epf8 = Math.round(normalAmount * 0.08 * 100) / 100;
    const advance = deductionsList.filter(d => (d.didCode || '').toLowerCase().includes('adv')).reduce((acc, curr) => acc + (Number(curr.didAmount) || 0), 0) || '';
    const otherDeds = deductionsList.filter(d => !(d.didCode || '').toLowerCase().includes('adv')).reduce((acc, curr) => acc + (Number(curr.didAmount) || 0), 0);
    const totalDeductions = Math.round((epf8 + (Number(advance) || 0) + otherDeds) * 100) / 100;
    const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

    const epf12 = Math.round(normalAmount * 0.12 * 100) / 100;
    const etf3 = Math.round(normalAmount * 0.03 * 100) / 100;

    const lines: string[] = [
      `SHINEX HOUSE KEEPING SERVICES (PVT) LTD,,,${currentPeriod},`,
      `,,,,`,
      `NAME AND EPF NO / பெயர் / නම සහ අංකය,,,${employee.firstName} ${employee.lastName || ''} - ${employee.epfNo},`,
      `,DAY,HOUR,RATE,AMOUNT`,
      `NORMAL / பொது / සාමාන්‍ය,${normalDays},,${normalRate},${normalAmount}`,
      `NIGHT / இரவு / රාත්‍රී,,${nightDays || ''},${nightRate},${nightAmount}`,
      `POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය,${poyaDays},,${poyaRate},${poyaAmount}`,
      `OVERTIME / மேலதிக நேரம் / අතිකාල,,${otHours || ''},${otRate},${otAmount}`,
      `INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව,,,,${incentive}`,
      `ATTENDANCE ALLOWANCE / கலந்துகொள்ளல் படி / පැමිණීමේ දීමනාව,,,,`,
      `ATTENDANCE BONUS / வருகை போனஸ் / පැමිණීමේ බෝනස්,,,,`,
      `STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ඥාපිත නිවාඩු,,,,`,
      `OTHER / மற்றவை / වෙනත්,,,,${otherAdditions}`,
      `GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප,,,,${grossSalary}`,
      `,,,,`,
      `DEDUCTIONS / கழிவுகள் / අඩු කිරීම්,,,,`,
      `E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%,,,,${epf8}`,
      `ADVANCE / முற்பணம் / අත්තිකාරම්,,,,${advance}`,
      `TELEPHONE / தொலைபேசி / දුරකථනය,,,,-`,
      `MEAL / உணவு / ආහාරය,,,,`,
      `ABSENT / வராதிருத்தல் / නොපැමිණීම,,,,`,
      `LOAN / கடன் / ණය,,,,`,
      `DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර,,,,`,
      `TOTAL DEDUCTION / மொத்த கழிவு / මුළු අඩුකිරීම,,,,${totalDeductions}`,
      `NET SALARY / நிகர சம்பளம் / ශුද්ධ වැටුප,,,,${netSalary}`,
      `COMPANY CONTRIBUTION / நிறுவன பங்களிப்பு / සමාගම් දායකත්වය,,,,`,
      `E.P.F. 12% / ஊ.சே.நி. 12% / සේ.අ.අ. 12%,,,,${epf12}`,
      `E.T.F. 3% / ஊ.பொ.நி. 3% / සේ.අ.අ.අ. 3%,,,,${etf3}`,
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
    link.setAttribute('download', `Employee_Complete_Dossier_${employee.epfNo}_${new Date().toISOString().slice(0, 10)}.csv`)
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
  }, [selectedEpf])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#3F9884] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Individual Profile History</span>
            <span className="text-slate-400 text-xs font-mono">{selectedEpf || 'No Employee Selected'}</span>
            <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded border border-slate-700">
              Company: {activeBc === 'ALL' ? 'All Companies' : activeBc}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Complete Record Dossier</h1>
          <p className="text-sm text-slate-400 mt-0.5">Scoped to logged-in company employees. View full historical master & transaction records with plant tracing.</p>
        </div>

        {employee && (
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              <FileText size={16} />
              <span>Export Dossier (Excel)</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md"
            >
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Employee Selector Card (Scoped to unique company employees - Feature 6) */}
      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Select Employee ({companyEmployees.length} unique employees in company)</span>
              <span className="text-slate-400 font-normal text-[11px]">De-duplicated</span>
            </label>
            <SearchableEmployeeSelect
              value={selectedEpf}
              employees={companyEmployees}
              onChange={(epf) => setSelectedEpf(epf)}
              placeholder="Type EPF or Name (e.g. EPF00001 or Sunil)"
            />
          </div>

          {employee && plantAssignmentOptions.length > 1 && (
            <div className="flex-1 max-w-md bg-teal-50/70 p-3.5 rounded-xl border border-teal-200">
              <label className="block text-xs font-bold text-teal-900 mb-1.5 flex items-center gap-1.5">
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
              <p className="text-[11px] text-teal-700 mt-1">
                {selectedOption?.id === 'ALL'
                  ? 'Showing all historical records across all plants.'
                  : `Filtered to records for ${selectedOption.plantName}.`}
              </p>
            </div>
          )}
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 pb-4 border-b">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="Employee Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-[#2F6F5E] shadow-sm flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2F6F5E] to-[#3F9884] text-white flex items-center justify-center font-bold text-lg uppercase shadow-sm flex-shrink-0">
                  {(employee.firstName?.[0] || 'E') + (employee.lastName?.[0] || '')}
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-800">{employee.firstName} {employee.lastName || ''} ({employee.epfNo})</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Current Plant: {employee.plantCode || 'Main Plant'}
                    </span>
                    {employee.statusActive !== false ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                        <CheckCircle size={12} /> Active Employee
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  NIC: <span className="font-medium text-slate-700">{employee.nicNo || '—'}</span> &bull; Section: <span className="font-medium text-slate-700">{employee.sectionCode || '—'}</span> &bull; BC: <span className="font-medium text-slate-700">{employee.businessCenter || activeBc}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div><span className="text-slate-500 block">Full Name</span><strong className="text-slate-800 text-sm">{employee.firstName} {employee.lastName || ''}</strong></div>
              <div><span className="text-slate-500 block">NIC No</span><strong className="text-slate-800 text-sm">{employee.nicNo || '—'}</strong></div>
              <div><span className="text-slate-500 block">Business Center</span><strong className="text-slate-800 text-sm">{employee.businessCenter || activeBc}</strong></div>
              <div><span className="text-slate-500 block">Daily Rate (per day)</span><strong className="text-[#2F6F5E] text-sm">LKR {Number(employee.basicSalary || 0).toLocaleString()}</strong></div>

              <div><span className="text-slate-500 block">Current Plant / Customer</span><strong className="text-slate-800">{employee.plantCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Section Code</span><strong className="text-slate-800">{employee.sectionCode || '—'}</strong></div>
              <div><span className="text-slate-500 block">Hired Date</span><strong className="text-slate-800">{employee.hiredDate || '—'}</strong></div>
              <div><span className="text-slate-500 block">Bank Account</span><strong className="text-slate-800">{employee.bankName || 'Bank'} — {employee.bankAccountNumber || '—'}</strong></div>
            </div>
          </div>

          {/* Live Pay Advice & Comprehensive Salary Calculation Dossier Card */}
          {payrollDossierCalculation && (
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm tracking-wide flex items-center gap-2 text-emerald-400">
                    <FileText size={16} />
                    SHINEX HOUSE KEEPING SERVICES (PVT) LTD — PAY ADVICE DOSSIER
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    NAME AND EPF NO: <span className="font-semibold text-white">{employee.firstName} {employee.lastName || ''} - {employee.epfNo}</span>
                  </p>
                </div>
                <span className="text-xs bg-emerald-900/80 text-emerald-200 px-3 py-1 rounded-full border border-emerald-700 font-mono">
                  Net Salary: LKR {payrollDossierCalculation.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Earnings Table */}
              <div className="p-4 border-b border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                  Earnings & Allowances
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2">Description / விவரம் / විස්තරය</th>
                        <th className="px-3 py-2 text-center">Day</th>
                        <th className="px-3 py-2 text-center">Hour</th>
                        <th className="px-3 py-2 text-right">Rate (LKR)</th>
                        <th className="px-3 py-2 text-right">Amount (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">NORMAL / பொது / සාමාන්‍ය</td>
                        <td className="px-3 py-2 text-center text-slate-700">{payrollDossierCalculation.normalDays}</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-700">{payrollDossierCalculation.normalRate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.normalAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">NIGHT / இரவு / රාත්‍රී</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-center text-slate-700">{payrollDossierCalculation.nightDays || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{payrollDossierCalculation.nightRate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.nightAmount > 0 ? payrollDossierCalculation.nightAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය</td>
                        <td className="px-3 py-2 text-center text-slate-700">{payrollDossierCalculation.poyaDays}</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-700">{payrollDossierCalculation.poyaRate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.poyaAmount > 0 ? payrollDossierCalculation.poyaAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">OVERTIME / மேலதிக நேரம் / අතිකාල (1.5× rate)</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-center text-amber-700 font-bold">{payrollDossierCalculation.otHours || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{payrollDossierCalculation.otRate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-900">{payrollDossierCalculation.otAmount > 0 ? payrollDossierCalculation.otAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.incentive > 0 ? payrollDossierCalculation.incentive.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">STATUTORY HOLIDAY / சட்டப்பூர்ව விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු</td>
                        <td className="px-3 py-2 text-center text-slate-700">{payrollDossierCalculation.statutoryDays || '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-700">{payrollDossierCalculation.statutoryDays > 0 ? payrollDossierCalculation.normalRate.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.statutoryHolidayAmount > 0 ? payrollDossierCalculation.statutoryHolidayAmount.toFixed(2) : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans font-medium text-slate-800">OTHER / மற்றவை / වෙනත්</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-center text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{payrollDossierCalculation.otherAdditions > 0 ? payrollDossierCalculation.otherAdditions.toFixed(2) : '—'}</td>
                      </tr>
                      <tr className="bg-emerald-50/80 font-bold font-sans border-t-2 border-emerald-300">
                        <td className="px-3 py-2.5 text-emerald-950 font-bold text-xs" colSpan={4}>GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප</td>
                        <td className="px-3 py-2.5 text-right text-emerald-950 font-mono text-sm font-bold">LKR {payrollDossierCalculation.grossSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions & Statutory Table */}
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-200 font-bold text-rose-900 text-xs uppercase tracking-wider">
                    Deductions / கழிவுகள் / අඩු කිරීම්
                  </div>
                  <table className="w-full text-left text-xs divide-y divide-slate-100 font-mono">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-3.5 py-2 font-sans text-slate-700">E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%</td>
                        <td className="px-3.5 py-2 text-right font-semibold text-rose-700">LKR {payrollDossierCalculation.epf8.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-sans text-slate-700">ADVANCE / முற்பணம் / අත්තිකාරම්</td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">{payrollDossierCalculation.advance > 0 ? `LKR ${payrollDossierCalculation.advance.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-sans text-slate-700">OTHER DEDUCTIONS / ஏனையவை</td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">{payrollDossierCalculation.otherDeds > 0 ? `LKR ${payrollDossierCalculation.otherDeds.toFixed(2)}` : '—'}</td>
                      </tr>
                      <tr className="bg-rose-50/70 font-bold font-sans border-t border-rose-200">
                        <td className="px-3.5 py-2.5 text-rose-950 font-bold">TOTAL DEDUCTION / மொத்த கழிவு / මුළු අඩුකිරීම</td>
                        <td className="px-3.5 py-2.5 text-right text-rose-950 font-mono text-sm font-bold">LKR {payrollDossierCalculation.totalDeductions.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Company Contribution / நிறுவன பங்களிப்பு
                  </div>
                  <table className="w-full text-left text-xs divide-y divide-slate-100 font-mono">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-3.5 py-2 font-sans text-slate-700">E.P.F. 12% (Company) / ஊ.சே.நி. 12%</td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">LKR {payrollDossierCalculation.epf12.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-sans text-slate-700">E.T.F. 3% (Company) / ஊ.பொ.நி. 3%</td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">LKR {payrollDossierCalculation.etf3.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="p-3.5 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between font-sans">
                    <span className="font-bold text-xs text-emerald-950">FINAL NET SALARY / நிகர சம்பளம் / ශුද්ධ වැටුප:</span>
                    <span className="font-mono text-base font-black text-emerald-900">LKR {payrollDossierCalculation.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Plant Movement & Transfer History Card (Feature 4) */}
          {employeeTransfers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <ArrowRightLeft size={14} className="text-teal-600" />
                  Plant Transfer Movements & History ({employeeTransfers.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold">
                    <tr>
                      <th className="px-4 py-2">Transfer Date</th>
                      <th className="px-4 py-2">Movement Route (From → To)</th>
                      <th className="px-4 py-2">Duration</th>
                      <th className="px-4 py-2">Transfer Type</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeTransfers.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 mono-numeric font-medium">{t.transferDate} {t.endDate ? `to ${t.endDate}` : ''}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100">{t.fromPlant || 'Base'}</span>
                          <span className="mx-1.5 text-teal-600">→</span>
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">{t.toPlant}</span>
                        </td>
                        <td className="px-4 py-2 mono-numeric">{t.daysWorked || 1} days</td>
                        <td className="px-4 py-2">{t.transferType || 'Support'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'Active' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                            {t.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{t.workDetails || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance History (filtered by plant assignment if selected - Feature 4) */}
          <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} className="text-teal-600" />
                Attendance Log History ({filteredAttendanceList.length}{selectedOption?.id !== 'ALL' ? ` filtered by ${selectedOption.plantName}` : ''})
              </h4>
              {selectedOption?.id !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedPlantOptionId('ALL')}
                  className="text-xs text-teal-700 hover:underline font-medium"
                >
                  Clear Plant Filter (Show All {attendanceList.length})
                </button>
              )}
            </div>
            {filteredAttendanceList.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No attendance logs recorded for this plant/period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b font-semibold">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Time In</th>
                      <th className="px-4 py-2">Time Out</th>
                      <th className="px-4 py-2">Plant</th>
                      <th className="px-4 py-2">Total Hours</th>
                      <th className="px-4 py-2">OT Hours</th>
                      <th className="px-4 py-2">Business Center</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendanceList.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 mono-numeric font-medium">{a.dayIn}</td>
                        <td className="px-4 py-2 mono-numeric">{a.timeIn}</td>
                        <td className="px-4 py-2 mono-numeric">{a.timeOut || '—'}</td>
                        <td className="px-4 py-2 font-medium text-teal-800">{a.plantCode || employee.plantCode || '—'}</td>
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
