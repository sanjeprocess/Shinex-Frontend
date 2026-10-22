import React, { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Sun, Sunset, Moon, Star, ArrowRightLeft, Trash2, Filter, Layers, FileSpreadsheet } from 'lucide-react'
import SearchInput from '../../components/SearchInput'
import NumericInput from '../../components/NumericInput'
import DataTable from '../../components/DataTable'
import SlideOver from '../../components/SlideOver'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../services/employeeService'
import { list as listCustomers } from '../../mocks/customers'
import { list as listSections, Section } from '../../mocks/sections'
import { list as listBC } from '../../mocks/businessCenters'
import { list as listTransfers, PlantTransfer } from '../../mocks/plantTransfers'
import { list as listLeaves } from '../../mocks/leaves'
import { syncMonthlySummary } from '../../mocks/monthlySummary'
import {
  list as listAttendance,
  create as createAttendance,
  update as updateAttendance,
  bulkSave as bulkSaveAttendance,
  remove as removeAttendance,
  Attendance
} from '../../mocks/attendance'
import { logAuditAction } from '../../utils/auditLogger'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'

const SHIFT_ICONS: Record<string, any> = {
  'Day': Sun,
  '2nd': Sunset,
  'Night': Moon,
  'Full Night': Star
}

// Helper to compute total hours and OT hours dynamically
function computeHours(timeInStr: string, timeOutStr: string): { hours: number; ot: number } {
  if (!timeInStr || !timeOutStr) return { hours: 0, ot: 0 };
  const [hIn, mIn] = timeInStr.split(':').map(Number);
  const [hOut, mOut] = timeOutStr.split(':').map(Number);
  
  let diffMinutes = (hOut * 60 + mOut) - (hIn * 60 + mIn);
  if (diffMinutes < 0) {
    // Cross midnight
    diffMinutes += 24 * 60;
  }
  
  const hours = Math.round((diffMinutes / 60) * 10) / 10;
  const ot = Math.max(0, Math.round((hours - 8.0) * 10) / 10);
  return { hours, ot };
}

function normalizeLocalDateTime(dateValue?: string, fallbackTime?: string): string | undefined {
  if (!dateValue) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateValue)) return dateValue;

  const baseDate = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
  const time = (fallbackTime || '00:00').trim();
  return `${baseDate}T${time}`.length === 16 ? `${baseDate}T${time}:00` : `${baseDate}T${time}`;
}

const excelFieldMap: Record<string, keyof Attendance> = {
  attyear: 'atttYear', atttyear: 'atttYear', attmonth: 'attMonth', epfno: 'epfNo',
  plantcode: 'plantCode', customercode: 'customerCode', sectioncode: 'sectionCode',
  workingdays: 'workingDays', basicsalary: 'basicSalary', dayallowance: 'dayAllowance',
  nightallowance: 'nightAllowance', dayin: 'dayIn', timein: 'timeIn', dayout: 'dayOut',
  timeout: 'timeOut', halfday: 'halfDay', totalworkinghours: 'totalWorkingHours', totalot: 'totalOt',
  normalday: 'normalDay', saturdaypoya: 'saturdayPoya', specialday: 'specialDay',
  dayshift: 'dayShift', secondshift: 'secondShift', nightshift: 'nightShift', fullnight: 'fullNight',
  noofmeal: 'noOfMeal', totalmealvalue: 'totalMealValue', statutoryholidays: 'statutoryHolidays',
  sundaypoyaextra: 'sundayPoyaExtra', businesscenter: 'businessCenter'
}

function excelDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : ''
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return text
}

function excelTime(value: unknown): string {
  if (typeof value === 'number') {
    const totalSeconds = Math.round(value * 86400)
    return `${String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(text) ? (text.length === 5 ? `${text}:00` : text) : text
}

function parseAttendanceRows(
  data: unknown[][],
  businessCenter: string,
  defaultPlant?: string,
  defaultSection?: string
): Attendance[] {
  if (!data.length) return []
  const headers = data[0].map(value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  return data.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const record: Partial<Attendance> = {
      id: uuid(), atttYear: '', attMonth: '', epfNo: '',
      plantCode: defaultPlant || '', customerCode: defaultPlant || '', sectionCode: defaultSection || '',
      dayIn: '', timeIn: '', businessCenter
    }
    headers.forEach((header, column) => {
      const field = excelFieldMap[header]
      if (!field) return
      const value = row[column]
      if (field === 'dayIn') (record as any)[field] = excelDate(value)
      else if (field === 'dayOut') (record as any)[field] = excelDate(value)
      else if (field === 'timeIn' || field === 'timeOut') (record as any)[field] = excelTime(value)
      else if (['workingDays', 'basicSalary', 'dayAllowance', 'nightAllowance', 'halfDay', 'totalWorkingHours', 'totalOt', 'noOfMeal', 'totalMealValue', 'statutoryHolidays', 'sundayPoyaExtra'].includes(field)) {
        const number = Number(String(value ?? '').replace(/^0+(?=\d)/, ''))
        ;(record as any)[field] = Number.isFinite(number) ? number : 0
      } else if (field === 'businessCenter') (record as any)[field] = String(value ?? '').trim() || businessCenter
      else (record as any)[field] = String(value ?? '').trim()
    })

    const dayInVal = record.dayIn || ''
    const yearFromDate = dayInVal.includes('-') ? dayInVal.split('-')[0] : '2026'
    const monthFromDate = dayInVal.includes('-') ? dayInVal.split('-')[1] : '01'

    return {
      ...defaultAttendanceRecord,
      ...record,
      id: record.id || `${record.epfNo || 'row'}-${index}`,
      atttYear: record.atttYear || yearFromDate,
      attMonth: record.attMonth || monthFromDate,
      plantCode: record.plantCode || defaultPlant || '',
      customerCode: record.customerCode || record.plantCode || defaultPlant || '',
      sectionCode: record.sectionCode || defaultSection || '',
      businessCenter: record.businessCenter || businessCenter
    } as Attendance
  })
}

function validateUploadRow(
  row: Attendance,
  allUploadRows: Attendance[],
  savedRows: Attendance[],
  empList: any[]
): {
  isValid: boolean;
  errors: string[];
} {
  const errs: string[] = []
  const cleanEpf = (row.epfNo || '').trim().toLowerCase()

  // 1. Unknown EPF check
  if (!cleanEpf) {
    errs.push('Missing EPF No')
  } else if (empList.length > 0 && !empList.some(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf)) {
    errs.push('Unknown EPF No')
  }

  // 2. Bad date check
  if (!row.dayIn || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.dayIn).trim())) {
    errs.push('Invalid Date')
  }

  // 3. Duplicate check for same employee and date
  if (cleanEpf && row.dayIn) {
    const dupCount = allUploadRows.filter(r => (r.epfNo || '').trim().toLowerCase() === cleanEpf && r.dayIn === row.dayIn).length
    const dupSaved = savedRows.some(r => (r.epfNo || '').trim().toLowerCase() === cleanEpf && r.dayIn === row.dayIn)
    if (dupCount > 1) {
      errs.push('Duplicate row in Excel')
    } else if (dupSaved) {
      errs.push('Duplicate in saved logs')
    }
  }

  return {
    isValid: errs.length === 0,
    errors: errs
  }
}

const defaultAttendanceRecord: Attendance = {
  id: '', atttYear: '', attMonth: '', epfNo: '', plantCode: '', dayIn: '', timeIn: '',
  businessCenter: ''
}

export default function AttendancePage() {
  const defaultForm: Attendance = {
    id: '',
    atttYear: new Date().getFullYear().toString(),
    attMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    epfNo: '',
    plantCode: '',
    workingDays: 1,
    otCalAuto: 'Y',
    noOfStaff: 5,
    attAllowance: 'Y',
    dasForAttAllowance: 22,
    poyaSaturdayNormal: 'N',
    basicSalary: 0,
    dayAllowance: 0,
    nightAllowance: 0,
    dayIn: new Date().toISOString().split('T')[0],
    timeIn: '08:00',
    dayOut: new Date().toISOString().split('T')[0],
    timeOut: '16:00', // Normal 8-hour day end time is 4:00 PM (not 5:00 PM)
    halfDay: 0,
    totalWorkingHours: 8.0,
    totalOt: 0.0,
    normalDay: 'Y',
    saturdayPoya: 'N',
    specialDay: 'N',
    lateAllowNo: '',
    dayShift: 'Y',
    secondShift: 'N',
    nightShift: 'N',
    fullNight: 'N',
    noOfMeal: 1,
    totalMealValue: 120,
    statutoryHolidays: 0,
    sundayPoyaExtra: 0,
    businessCenter: localStorage.getItem('hsb_active_bc') || '001'
  };

  const [rows, setRows] = useState<Attendance[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Attendance>({ ...defaultForm })
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [errors, setErrors] = useState<{ epfNo?: string; plantCode?: string; dayIn?: string }>({})

  // Sourced lists
  const [employeeList, setEmployeeList] = useState<any[]>([])
  const [sectionList, setSectionList] = useState<Section[]>([])
  const [customerList, setCustomerList] = useState<any[]>([])
  const [bcList, setBcList] = useState<any[]>([])
  const [transfers, setTransfers] = useState<PlantTransfer[]>([])
  const [uploadRows, setUploadRows] = useState<Attendance[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filters for Year, Month, Employee, Plant
  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')
  const [filterPlant, setFilterPlant] = useState<string>('ALL')

  // Upload default selectors
  const [uploadDefaultPlant, setUploadDefaultPlant] = useState<string>('')
  const [uploadDefaultSection, setUploadDefaultSection] = useState<string>('')

  // Multi-Plant Date Range Batch Editor
  const [rangeEmployee, setRangeEmployee] = useState<string>('')
  const [rangeFrom, setRangeFrom] = useState<string>('')
  const [rangeTo, setRangeTo] = useState<string>('')
  const [rangePlant, setRangePlant] = useState<string>('')
  const [rangeSection, setRangeSection] = useState<string>('')
  const [appliedRanges, setAppliedRanges] = useState<Array<{
    id: string;
    epfNo: string;
    fromDate: string;
    toDate: string;
    plantCode: string;
    sectionCode?: string;
  }>>([])

  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncYear, setSyncYear] = useState('2026')
  const [syncMonth, setSyncMonth] = useState('09')
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<any[]>([])

  async function handleRunMonthlySync() {
    setSyncing(true)
    try {
      await syncMonthlySummary(syncYear, syncMonth)
      const leaveList = await listLeaves()

      const calculated = employeeList.map(emp => {
        const epf = emp.epfNo
        const empAttList = rows.filter(r => r.epfNo === epf && (r.atttYear === syncYear || !r.atttYear) && (r.attMonth === syncMonth || !r.attMonth))
        let presentDays = 0
        let otHours = 0

        empAttList.forEach(a => {
          const weight = a.halfDay === 1 ? 0.5 : 1.0
          presentDays += weight
          if (a.totalOt && a.totalOt > 0) otHours += a.totalOt
        })

        const empLeaves = leaveList.filter(l => (l.epfNo === epf || l.empNo === epf) && (l.leaveYear === syncYear || !l.leaveYear) && (l.leaveMonth === syncMonth || !l.leaveMonth))
        const totalLeaves = empLeaves.reduce((acc, l) => acc + (l.leaveDays || l.days || 0), 0)

        return {
          epfNo: epf,
          empName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
          presentDays,
          leaves: totalLeaves,
          otHours
        }
      })

      setSyncResults(calculated)
      const monthNames: Record<string, string> = {
        '01': 'January', '02': 'February', '03': 'March', '04': 'April',
        '05': 'May', '06': 'June', '07': 'July', '08': 'August',
        '09': 'September', '10': 'October', '11': 'November', '12': 'December'
      }
      const monthLabel = monthNames[syncMonth] || syncMonth
      toast.success(`Calculated total present days, leaves, and OT hours for all employees (${monthLabel} ${syncYear}).`)
    } catch (err) {
      console.error('Monthly summary sync failed', err)
      toast.error('Monthly summary sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function refresh() {
    const activeBc = localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';

    listAttendance().then(setRows).catch(console.error);
    listTransfers(cleanBc).then(setTransfers).catch(console.error);
    listSections(cleanBc).then((sections) => {
      setSectionList(sections);
      listEmployees(cleanBc).then((employees) => {
        setEmployeeList(employees);
        const firstEmployee = employees.find((employee) => employee?.epfNo);
        if (firstEmployee) {
          const autoSalary = resolveEmployeeBasicSalary(firstEmployee, sections);
          setForm((prev) => ({
            ...prev,
            epfNo: prev.epfNo && employees.some(e => e.epfNo === prev.epfNo) ? prev.epfNo : firstEmployee.epfNo,
            plantCode: prev.plantCode || firstEmployee.plantCode || '',
            businessCenter: cleanBc || firstEmployee.businessCenter || '001',
            basicSalary: prev.basicSalary && prev.basicSalary !== 0 ? prev.basicSalary : autoSalary,
            dayAllowance: prev.dayAllowance && prev.dayAllowance !== 0 ? prev.dayAllowance : (firstEmployee.dayAllowance || 0),
            nightAllowance: prev.nightAllowance && prev.nightAllowance !== 0 ? prev.nightAllowance : (firstEmployee.nightAllowance || 0)
          }));
        }
      }).catch(console.error);
    }).catch(console.error);
    listCustomers(cleanBc).then(setCustomerList).catch(console.error);
    listBC().then(setBcList).catch(console.error);
  }

  function resolveEmployeeBasicSalary(emp?: any, listSec: Section[] = sectionList): number {
    if (!emp) return 0;
    const secCode = (emp.sectionCode || emp.section || '').trim();
    const sec = secCode ? listSec.find(s => (s.code || '').trim() === secCode || (s.name || '').trim().toLowerCase() === secCode.toLowerCase()) : null;
    const secSalary = sec?.basicSalary != null && Number(sec.basicSalary) > 0 ? Number(sec.basicSalary) : 0;
    const empSalary = emp?.basicSalary != null && Number(emp.basicSalary) > 0 ? Number(emp.basicSalary) : 0;
    return empSalary > 0 ? empSalary : secSalary;
  }

  useEffect(() => {
    refresh();
    const handleBc = () => refresh();
    window.addEventListener('hsb_bc_change', handleBc);
    window.addEventListener('storage', handleBc);
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc);
      window.removeEventListener('storage', handleBc);
    };
  }, []);

  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const defaultPlant = uploadDefaultPlant || (customerList[0]?.code || '')
      const defaultSection = uploadDefaultSection || (sectionList[0]?.code || '')
      const parsed = parseAttendanceRows(
        XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }),
        localStorage.getItem('hsb_active_bc') || defaultForm.businessCenter,
        defaultPlant,
        defaultSection
      )
      if (!parsed.length) {
        toast.error('The selected file contains no attendance rows.')
        return
      }
      setUploadRows(parsed)
      toast.success(`${parsed.length} attendance rows loaded for review`)
    } catch (error) {
      console.error('Attendance Excel import failed', error)
      toast.error('Unable to read the selected Excel file.')
    }
  }

  function updateUploadRow(index: number, patch: Partial<Attendance>) {
    setUploadRows(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  async function handleBulkSaveValidated() {
    if (!uploadRows.length) {
      toast.error('Upload an attendance file first.')
      return
    }
    const validated = uploadRows.map(r => ({
      row: r,
      val: validateUploadRow(r, uploadRows, rows, employeeList)
    }))
    const validRows = validated.filter(v => v.val.isValid).map(v => v.row)
    const invalidCount = validated.length - validRows.length

    if (validRows.length === 0) {
      toast.error(`All ${uploadRows.length} rows have validation issues. Please correct them before saving.`)
      return
    }

    try {
      await bulkSaveAttendance(validRows)
      toast.success(`Successfully saved ${validRows.length} valid attendance rows.${invalidCount > 0 ? ` ${invalidCount} invalid rows retained for review.` : ''}`)
      if (invalidCount > 0) {
        setUploadRows(validated.filter(v => !v.val.isValid).map(v => v.row))
      } else {
        setUploadRows([])
      }
      refresh()
    } catch (error: any) {
      console.error('Bulk attendance save failed', error)
      toast.error(String(error?.response?.data?.message || 'Bulk attendance save failed'))
    }
  }

  async function handleBulkSave() {
    await handleBulkSaveValidated()
  }

  async function handleApplyPlantRange() {
    if (!rangeEmployee) {
      toast.error('Please select an employee.')
      return
    }
    if (!rangeFrom || !rangeTo) {
      toast.error('Please select both From Date and To Date.')
      return
    }
    if (rangeFrom > rangeTo) {
      toast.error('From Date cannot be later than To Date.')
      return
    }
    if (!rangePlant) {
      toast.error('Please select a Plant (Customer).')
      return
    }

    // Overlap validation: Overlapping ranges for the same employee and date are not allowed.
    const overlapping = appliedRanges.find(r =>
      r.epfNo === rangeEmployee &&
      r.plantCode !== rangePlant &&
      rangeFrom <= r.toDate &&
      rangeTo >= r.fromDate
    )

    if (overlapping) {
      toast.error(`Overlapping ranges for the same employee are not allowed! Overlaps with ${overlapping.fromDate} to ${overlapping.toDate} (${overlapping.plantCode}).`)
      return
    }

    const newRangeEntry = {
      id: uuid(),
      epfNo: rangeEmployee,
      fromDate: rangeFrom,
      toDate: rangeTo,
      plantCode: rangePlant,
      sectionCode: rangeSection
    }
    setAppliedRanges(prev => [...prev, newRangeEntry])

    // 1. Update matching rows in uploadRows if present
    let uploadMatchCount = 0
    if (uploadRows.length > 0) {
      setUploadRows(prev => prev.map(row => {
        if (row.epfNo === rangeEmployee && row.dayIn >= rangeFrom && row.dayIn <= rangeTo) {
          uploadMatchCount++
          return {
            ...row,
            plantCode: rangePlant,
            customerCode: rangePlant,
            sectionCode: rangeSection || row.sectionCode
          }
        }
        return row
      }))
    }

    // 2. Update matching existing saved rows in stages
    const matchingSaved = rows.filter(r =>
      r.epfNo === rangeEmployee &&
      r.dayIn >= rangeFrom &&
      r.dayIn <= rangeTo
    )

    if (matchingSaved.length > 0) {
      const updatedSaved = matchingSaved.map(r => ({
        ...r,
        plantCode: rangePlant,
        customerCode: rangePlant,
        sectionCode: rangeSection || r.sectionCode
      }))

      try {
        await bulkSaveAttendance(updatedSaved)
        setRows(prev => prev.map(r => {
          if (r.epfNo === rangeEmployee && r.dayIn >= rangeFrom && r.dayIn <= rangeTo) {
            return {
              ...r,
              plantCode: rangePlant,
              customerCode: rangePlant,
              sectionCode: rangeSection || r.sectionCode
            }
          }
          return r
        }))
        toast.success(`Applied plant ${rangePlant} to ${updatedSaved.length} saved attendance logs (${rangeFrom} to ${rangeTo}).`)
      } catch (err) {
        console.error('Failed to update saved plant rows', err)
        toast.error('Failed to update plant range in system.')
      }
    } else if (uploadMatchCount > 0) {
      toast.success(`Applied plant ${rangePlant} to ${uploadMatchCount} uploaded rows (${rangeFrom} to ${rangeTo}).`)
    } else {
      toast.info(`Plant range registered for ${rangeEmployee} (${rangeFrom} to ${rangeTo}). No day logs loaded in range.`)
    }
  }

  function exportUploadRows() {
    if (!uploadRows.length) {
      toast.error('There are no uploaded rows to export.')
      return
    }
    const exportRows = uploadRows.map(row => {
      const { id, ...record } = row
      return {
        Attt_Year: record.atttYear, Att_Month: record.attMonth, EPF_No: record.epfNo,
        Plant_Code: record.plantCode, Working_Days: record.workingDays, Basic_Salary: record.basicSalary,
        Day_Allowance: record.dayAllowance, Night_Allowance: record.nightAllowance, Day_in: record.dayIn,
        Time_IN: record.timeIn, Day_out: record.dayOut, Time_Out: record.timeOut, Half_Day: record.halfDay,
        Total_Working_Hours: record.totalWorkingHours, Total_OT: record.totalOt, Normal_Day: record.normalDay,
        Saturday_Poya: record.saturdayPoya, Special_Day: record.specialDay, Day_shift: record.dayShift,
        second_Shift: record.secondShift, Night_Shift: record.nightShift, Full_Night: record.fullNight,
        No_of_Meal: record.noOfMeal, Total_Meal_Value: record.totalMealValue,
        Statutory_holidays: record.statutoryHolidays, Sunday_Poya_Extra: record.sundayPoyaExtra,
        Business_Center: record.businessCenter
      }
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Attendance')
    XLSX.writeFile(workbook, 'attendance-updated.xlsx')
  }

  function getDefaultEmployeeValues(employee?: any, shift: string = 'Day') {
    if (!employee) return {}
    const autoSalary = resolveEmployeeBasicSalary(employee)
    const isNight = shift === 'Night' || shift === 'Full Night'
    return {
      epfNo: employee.epfNo || '',
      plantCode: employee.plantCode || '',
      businessCenter: employee.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
      basicSalary: autoSalary,
      dayAllowance: employee.dayAllowance || 0,
      nightAllowance: isNight ? (employee.nightAllowance || 0) : 0
    }
  }

  // Add flow
  function handleAdd() {
    const firstEmployee = employeeList.find((employee) => employee?.epfNo)
    const todayStr = new Date().toISOString().split('T')[0]
    const empty = {
      ...defaultForm,
      ...getDefaultEmployeeValues(firstEmployee, 'Day'),
      dayIn: todayStr,
      dayOut: todayStr,
      timeIn: '08:00',
      timeOut: '16:00',
      totalWorkingHours: 8.0,
      totalOt: 0.0,
      dayShift: 'Y',
      secondShift: 'N',
      nightShift: 'N',
      fullNight: 'N',
      nightAllowance: 0,
      businessCenter: localStorage.getItem('hsb_active_bc') || defaultForm.businessCenter
    }
    setForm(empty)
    setIsEditing(false)
    setEditingId(null)
    setOpen(true)
  }

  // Edit flow
  function handleEdit(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row) return

    const emp = employeeList.find(e => (e.epfNo || '').trim() === (row.epfNo || '').trim())
    const autoSalary = resolveEmployeeBasicSalary(emp)
    // If row basicSalary is 0 or if section/employee has a defined basic salary, ensure it's up to date
    const resolvedSalary = (row.basicSalary != null && Number(row.basicSalary) > 0) ? Number(row.basicSalary) : autoSalary

    const rawDayIn = row.dayIn ? String(row.dayIn).split('T')[0] : ''
    const rawDayOut = row.dayOut ? String(row.dayOut).split('T')[0] : (rawDayIn || '')

    setForm({
      ...row,
      basicSalary: resolvedSalary,
      dayIn: rawDayIn,
      dayOut: rawDayOut || rawDayIn
    })
    setIsEditing(true)
    setEditingId(id)
    setOpen(true)
  }

  // Delete flow
  function handleDeleteConfirm() {
    if (!confirm) return
    const targetRow = rows.find(r => r.id === confirm)
    removeAttendance(confirm).then(() => {
      if (targetRow) {
        logAuditAction('DELETE', 'Attendance', targetRow.id || confirm, {
          epfNo: targetRow.epfNo,
          dayIn: targetRow.dayIn,
          plantCode: targetRow.plantCode
        }, null);
      }
      setConfirm(null)
      refresh()
      toast.success('Attendance entry deleted')
    }).catch(() => {
      toast.error('Failed to delete attendance entry — please try again')
    })
  }

  function validateAttendance() {
    const next: { epfNo?: string; plantCode?: string; dayIn?: string } = {}
    const selectedEmployeeExists = String(form.epfNo || '').trim() && employeeList.some((employee) => employee?.epfNo === form.epfNo)

    if (!String(form.epfNo || '').trim()) {
      next.epfNo = 'Employee is required'
    } else if (!selectedEmployeeExists) {
      next.epfNo = 'Select a valid employee from the list'
    }
    if (!String(form.plantCode || '').trim()) next.plantCode = 'Plant is required'
    if (!String(form.dayIn || '').trim()) next.dayIn = 'Date is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Save flow
  async function handleSave() {
    if (!validateAttendance()) {
      toast.error('Please complete the required fields')
      return
    }

    const { hours, ot } = computeHours(form.timeIn || '', form.timeOut || '')
    let yr = form.atttYear
    let mo = form.attMonth
    if (form.dayIn && form.dayIn.includes('-')) {
      const parts = form.dayIn.split('-')
      yr = parts[0]
      mo = parts[1]
    }

    const isNight = form.nightShift === 'Y' || form.fullNight === 'Y';
    const toSave: Attendance = {
      ...form,
      atttYear: yr || form.atttYear || '2026',
      attMonth: mo || form.attMonth || '01',
      dayOut: normalizeLocalDateTime(form.dayOut || form.dayIn, form.timeOut) || form.dayIn,
      totalWorkingHours: hours,
      totalOt: ot,
      nightAllowance: isNight ? (form.nightAllowance || 0) : 0
    }

    const duplicate = !isEditing && rows.some((row) => 
      row.epfNo === toSave.epfNo &&
      row.dayIn === toSave.dayIn
    )

    if (duplicate) {
      toast.error('Attendance already exists for this employee on this date.')
      return
    }

    try {
      if (isEditing && editingId) {
        const oldRow = rows.find(r => r.id === editingId)
        await updateAttendance(editingId, toSave)
        logAuditAction('UPDATE', 'Attendance', editingId, oldRow || null, toSave)
        toast.success('Attendance updated')
      } else {
        const newId = uuid()
        await createAttendance({
          ...toSave,
          id: newId
        })
        logAuditAction('CREATE', 'Attendance', newId, null, toSave)
        toast.success('Attendance added')
      }
      setOpen(false)
      refresh()
    } catch (err: any) {
      console.error('Save failed', err)
      const backendMessage = err?.response?.data?.message || err?.response?.data?.error || 'Attendance save failed'
      toast.error(String(backendMessage))
    }
  }

  // Search & Filter (Year, Month, Employee, Plant, Query)
  const filtered = useMemo(() => {
    return rows.filter(r => {
      // Year filter
      if (filterYear !== 'ALL' && r.atttYear !== filterYear) {
        if (!r.dayIn || !r.dayIn.startsWith(filterYear)) return false
      }
      // Month filter
      if (filterMonth !== 'ALL' && r.attMonth !== filterMonth) {
        if (!r.dayIn || r.dayIn.slice(5, 7) !== filterMonth) return false
      }
      // Employee filter
      if (filterEmployee !== 'ALL' && (r.epfNo || '').trim() !== filterEmployee.trim()) {
        return false
      }
      // Plant filter
      if (filterPlant !== 'ALL' && (r.plantCode || '').trim() !== filterPlant.trim()) {
        return false
      }
      // Query search
      const emp = employeeList.find(e => e.epfNo === r.epfNo)
      const empName = emp ? `${emp.firstName} ${emp.lastName || ''}`.toLowerCase() : ''
      const searchStr = `${r.epfNo} ${empName} ${r.plantCode} ${r.dayIn}`.toLowerCase()
      return searchStr.includes(q.toLowerCase())
    })
  }, [rows, employeeList, q, filterYear, filterMonth, filterEmployee, filterPlant])

  // Plants worked summary map per employee across attendance rows: e.g. "PL001 (10 days), PL002 (8 days)"
  const employeePlantsWorkedMap = useMemo(() => {
    const map: Record<string, string> = {}
    const empGroup: Record<string, Record<string, number>> = {}
    rows.forEach(r => {
      const epf = (r.epfNo || '').trim()
      if (!epf) return
      if (!empGroup[epf]) empGroup[epf] = {}
      const plant = (r.plantCode || 'Unknown').trim()
      empGroup[epf][plant] = (empGroup[epf][plant] || 0) + 1
    })

    Object.entries(empGroup).forEach(([epf, plantMap]) => {
      const parts = Object.entries(plantMap).map(([p, count]) => `${p} (${count} ${count === 1 ? 'day' : 'days'})`)
      map[epf] = parts.join(', ')
    })
    return map
  }, [rows])

  // Custom Form Select Handlers
  function handleNumericInput(field: 'workingDays' | 'noOfStaff' | 'dasForAttAllowance' | 'basicSalary' | 'dayAllowance' | 'nightAllowance' | 'sundayPoyaExtra' | 'noOfMeal' | 'totalMealValue', label: string, value: string) {
    if (value === '') {
      setForm(prev => ({ ...prev, [field]: 0 }))
      return
    }
    if (!/^\d*\.?\d*$/.test(value)) {
      toast.error(`${label} must be a number.`)
      return
    }
    setForm(prev => ({ ...prev, [field]: Number(value) }))
  }

  const empTransfers = useMemo(() => {
    if (!form.epfNo) return []
    return transfers.filter(t => t.epfNo === form.epfNo)
  }, [form.epfNo, transfers])

  const hasPlantTransfer = empTransfers.length > 0

  const relevantPlants = useMemo(() => {
    if (!form.epfNo) return customerList
    const emp = employeeList.find(e => e.epfNo === form.epfNo)
    const codes = new Set<string>()

    if (emp?.plantCode) {
      const cleanHome = emp.plantCode.split(' ')[0].trim()
      codes.add(cleanHome)
    }

    empTransfers.forEach(t => {
      if (t.fromPlant) codes.add(t.fromPlant.split(' ')[0].trim())
      if (t.toPlant) codes.add(t.toPlant.split(' ')[0].trim())
    })

    const filtered = customerList.filter(c => codes.has(c.code))
    if (filtered.length === 0 && emp?.plantCode) {
      const cleanHome = emp.plantCode.split(' ')[0].trim()
      return [{ code: cleanHome, name: emp.plantCode }]
    }
    return filtered
  }, [form.epfNo, employeeList, empTransfers, customerList])

  function handleEmployeeChange(epf: string | null) {
    if (!epf) return
    const emp = employeeList.find(e => e.epfNo === epf)
    const empTrans = transfers.filter(t => t.epfNo === epf)
    const activeTransfer = empTrans.find(t => t.status === 'Active') || empTrans[0]

    let effectivePlant = emp?.plantCode ? emp.plantCode.split(' ')[0].trim() : ''
    if (activeTransfer?.toPlant) {
      const targetCode = activeTransfer.toPlant.split(' ')[0].trim()
      if (customerList.some(c => c.code === targetCode)) {
        effectivePlant = targetCode
      } else {
        effectivePlant = activeTransfer.toPlant
      }
    }

    if (emp) {
      const autoSalary = resolveEmployeeBasicSalary(emp);
      const isNight = form.nightShift === 'Y' || form.fullNight === 'Y';
      setForm(prev => ({
        ...prev,
        epfNo: epf,
        plantCode: effectivePlant,
        businessCenter: emp.businessCenter || prev.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
        basicSalary: autoSalary,
        dayAllowance: emp.dayAllowance || 0,
        nightAllowance: isNight ? (emp.nightAllowance || 0) : 0
      }))
    } else {
      setForm(prev => ({ ...prev, epfNo: epf, plantCode: effectivePlant }))
    }
  }

  const selectedDayType = form.normalDay === 'Y' ? 'Normal' : (form.saturdayPoya === 'Y' ? 'SaturdayPoya' : (form.specialDay === 'Y' ? 'Special' : 'Normal'))

  function handleDayTypeChange(type: 'Normal' | 'SaturdayPoya' | 'Special') {
    const dailyRate = form.basicSalary || 0;
    const poyaExtraPayment = Math.round(dailyRate * 1.5 * 100) / 100;

    setForm(prev => ({
      ...prev,
      normalDay: type === 'Normal' ? 'Y' : 'N',
      saturdayPoya: type === 'SaturdayPoya' ? 'Y' : 'N',
      specialDay: type === 'Special' ? 'Y' : 'N',
      sundayPoyaExtra: type === 'SaturdayPoya' ? (prev.sundayPoyaExtra && prev.sundayPoyaExtra > 0 ? prev.sundayPoyaExtra : poyaExtraPayment) : prev.sundayPoyaExtra
    }))
  }

  const selectedShift = form.dayShift === 'Y' ? 'Day' : (form.secondShift === 'Y' ? '2nd' : (form.nightShift === 'Y' ? 'Night' : 'Full Night'))

  function handleShiftChange(shift: 'Day' | '2nd' | 'Night' | 'Full Night') {
    const isNight = shift === 'Night' || shift === 'Full Night';
    const currentEmp = employeeList.find(e => (e.epfNo || '').trim() === (form.epfNo || '').trim());
    const empNightAllowance = currentEmp?.nightAllowance || 0;

    let nextTimeIn = form.timeIn || '08:00';
    let nextTimeOut = form.timeOut || '16:00';

    if (shift === 'Day') {
      nextTimeIn = '08:00';
      nextTimeOut = '16:00'; // Normal 8-hour day end time (4:00 PM)
    } else if (shift === '2nd') {
      nextTimeIn = '16:00';
      nextTimeOut = '00:00';
    } else if (shift === 'Night' || shift === 'Full Night') {
      nextTimeIn = '20:00';
      nextTimeOut = '04:00';
    }

    const { hours, ot } = computeHours(nextTimeIn, nextTimeOut);

    setForm(prev => ({
      ...prev,
      dayShift: shift === 'Day' ? 'Y' : 'N',
      secondShift: shift === '2nd' ? 'Y' : 'N',
      nightShift: shift === 'Night' ? 'Y' : 'N',
      fullNight: shift === 'Full Night' ? 'Y' : 'N',
      timeIn: nextTimeIn,
      timeOut: nextTimeOut,
      totalWorkingHours: hours,
      totalOt: ot,
      nightAllowance: isNight ? empNightAllowance : 0
    }))
  }

  // Live computed hours
  const liveComputed = useMemo(() => {
    return computeHours(form.timeIn || '', form.timeOut || '')
  }, [form.timeIn, form.timeOut])

  // Table Column definitions
  const columns = [
    { key: 'date', label: 'Date', className: 'mono-numeric' },
    { key: 'epfNo', label: 'EPF No', className: 'mono-numeric' },
    { key: 'empName', label: 'Employee Name' },
    { key: 'plant', label: 'Plant (Code & Name)' },
    { key: 'plantsWorked', label: 'Plants Worked' },
    { key: 'shiftNode', label: 'Shift' },
    { key: 'dayType', label: 'Day Type' },
    { key: 'timeRange', label: 'Time In/Out', className: 'mono-numeric' },
    { key: 'totalHours', label: 'Total Hours', className: 'mono-numeric' },
    { key: 'otHours', label: 'OT' },
    { key: 'meals', label: 'Meals', className: 'mono-numeric' },
    { key: 'id', label: 'Actions' }
  ]

  // Table Data mapping
  const tableData = filtered.map(r => {
    const emp = employeeList.find(e => e.epfNo === r.epfNo)
    const empName = emp ? `${emp.firstName} ${emp.lastName || ''}` : 'Unknown'

    // Plant Code & Name + transferred plant if any
    const cust = customerList.find(c => c.code === r.plantCode)
    const plantName = cust?.name || r.plantCode || 'Unknown Plant'
    const transfer = transfers.find(t =>
      t.epfNo === r.epfNo &&
      t.transferDate &&
      r.dayIn >= t.transferDate &&
      (!t.endDate || r.dayIn <= t.endDate)
    )

    const plantNode = (
      <div>
        <div className="font-semibold text-slate-800 flex items-center gap-1">
          <span className="font-mono text-xs text-[#2F6F5E]">{r.plantCode}</span>
          <span className="text-slate-600 font-normal truncate max-w-[130px]">- {plantName}</span>
        </div>
        {r.sectionCode && (
          <div className="text-[10px] text-slate-400">Section: {r.sectionCode}</div>
        )}
        {transfer && (
          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
            <ArrowRightLeft size={10} className="text-amber-600" />
            Transferred: {transfer.toPlant}
          </span>
        )}
      </div>
    )

    const plantsWorkedSummary = employeePlantsWorkedMap[r.epfNo] || '-'
    const plantsWorkedNode = (
      <span className="inline-block text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded max-w-[180px] truncate" title={plantsWorkedSummary}>
        {plantsWorkedSummary}
      </span>
    )

    // Shift node
    let shiftLabel = 'Day'
    let ShiftIcon = Sun
    if (r.dayShift === 'Y') { shiftLabel = 'Day'; ShiftIcon = Sun; }
    else if (r.secondShift === 'Y') { shiftLabel = '2nd'; ShiftIcon = Sunset; }
    else if (r.nightShift === 'Y') { shiftLabel = 'Night'; ShiftIcon = Moon; }
    else if (r.fullNight === 'Y') { shiftLabel = 'Full Night'; ShiftIcon = Star; }

    const shiftNode = (
      <div className="flex items-center gap-1.5 text-xs text-slate-700">
        <ShiftIcon size={14} className="text-slate-500" />
        <span>{shiftLabel}</span>
      </div>
    )

    // Day Type Badge
    let dayTypeNode = <span className="tag-pill bg-slate-100 text-slate-700 border">Normal</span>
    if (r.saturdayPoya === 'Y') {
      dayTypeNode = <span className="tag-pill bg-violet-50 text-violet-700 border border-violet-200">Poya/Sat</span>
    } else if (r.specialDay === 'Y') {
      dayTypeNode = <span className="tag-pill bg-rose-50 text-rose-700 border border-rose-200">Special</span>
    }

    // OT Node
    const otVal = r.totalOt || 0
    const otNode = otVal > 0 ? (
      <span className="mono-numeric text-[#C08A2E] font-medium">{otVal.toFixed(1)}</span>
    ) : (
      <span className="mono-numeric text-slate-400">-</span>
    )

    return {
      date: r.dayIn,
      epfNo: r.epfNo,
      empName,
      plant: plantNode,
      plantsWorked: plantsWorkedNode,
      shiftNode,
      dayType: dayTypeNode,
      timeRange: `${r.timeIn} - ${r.timeOut}`,
      totalHours: r.totalWorkingHours?.toFixed(1) || '0.0',
      otHours: otNode,
      meals: r.noOfMeal || 0,
      id: r.id
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily attendance with Excel import, multi-plant staging, and automatic transfer sync.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name, EPF, plant..." />
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
          <button
            type="button"
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-medium btn-press shadow-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet size={14} />
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-1.5 rounded-md text-xs font-medium btn-press shadow-xs"
            onClick={() => setSyncModalOpen(true)}
          >
            Sync Monthly Summary
          </button>
          <button
            type="button"
            className="bg-[#2F6F5E] hover:bg-[#25584a] text-white px-3.5 py-1.5 rounded-md text-xs font-medium btn-press shadow-xs"
            onClick={handleAdd}
          >
            + Add Entry
          </button>
        </div>
      </div>

      {/* Filter Strip (Year, Month, Employee, Plant) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-flat flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
          <Filter size={14} className="text-[#2F6F5E]" />
          <span>Filters:</span>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-600 font-medium">Year:</label>
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="form-input text-xs py-1 px-2 h-8"
          >
            <option value="ALL">All Years</option>
            {['2024', '2025', '2026', '2027', '2028'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-600 font-medium">Month:</label>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="form-input text-xs py-1 px-2 h-8"
          >
            <option value="ALL">All Months</option>
            {[
              { val: '01', name: 'Jan' }, { val: '02', name: 'Feb' }, { val: '03', name: 'Mar' },
              { val: '04', name: 'Apr' }, { val: '05', name: 'May' }, { val: '06', name: 'Jun' },
              { val: '07', name: 'Jul' }, { val: '08', name: 'Aug' }, { val: '09', name: 'Sep' },
              { val: '10', name: 'Oct' }, { val: '11', name: 'Nov' }, { val: '12', name: 'Dec' },
            ].map(m => (
              <option key={m.val} value={m.val}>{m.val} - {m.name}</option>
            ))}
          </select>
        </div>

        {/* Employee Filter */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-600 font-medium">Employee:</label>
          <select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            className="form-input text-xs py-1 px-2 h-8 max-w-[180px]"
          >
            <option value="ALL">All Employees ({employeeList.length})</option>
            {employeeList.map(e => (
              <option key={e.epfNo} value={e.epfNo}>
                {e.epfNo} - {e.firstName} {e.lastName || ''}
              </option>
            ))}
          </select>
        </div>

        {/* Plant Filter */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-600 font-medium">Plant:</label>
          <select
            value={filterPlant}
            onChange={e => setFilterPlant(e.target.value)}
            className="form-input text-xs py-1 px-2 h-8 max-w-[180px]"
          >
            <option value="ALL">All Plants ({customerList.length})</option>
            {customerList.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        {(filterYear !== 'ALL' || filterMonth !== 'ALL' || filterEmployee !== 'ALL' || filterPlant !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setFilterYear('ALL')
              setFilterMonth('ALL')
              setFilterEmployee('ALL')
              setFilterPlant('ALL')
            }}
            className="text-xs text-teal-700 hover:text-teal-900 underline font-medium ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Multi-Plant Date Range Editor Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-flat p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#2F6F5E]" />
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Multi-Plant Assignment by Date Range (Staged Multi-Plant Editing)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Apply different plants for date ranges (e.g. 01–10 Plant A, 11–20 Plant B) without overwriting.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Employee *</label>
            <select
              value={rangeEmployee}
              onChange={e => setRangeEmployee(e.target.value)}
              className="form-input w-full text-xs"
            >
              <option value="">-- Select Employee --</option>
              {employeeList.map(e => (
                <option key={e.epfNo} value={e.epfNo}>
                  {e.epfNo} - {e.firstName} {e.lastName || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">From Date *</label>
            <input
              type="date"
              value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)}
              className="form-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">To Date *</label>
            <input
              type="date"
              value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              className="form-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Plant (Customer Code) *</label>
            <select
              value={rangePlant}
              onChange={e => setRangePlant(e.target.value)}
              className="form-input w-full text-xs"
            >
              <option value="">-- Select Plant --</option>
              {customerList.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Section Code (Optional)</label>
            <select
              value={rangeSection}
              onChange={e => setRangeSection(e.target.value)}
              className="form-input w-full text-xs"
            >
              <option value="">-- Select Section --</option>
              {sectionList.map(s => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {appliedRanges.length > 0 && (
              <>
                <span className="text-slate-500 font-medium">Session Applied Ranges:</span>
                {appliedRanges.map(ar => (
                  <span
                    key={ar.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <span>{ar.epfNo}:</span>
                    <span>{ar.fromDate} to {ar.toDate}</span>
                    <strong className="text-emerald-950">({ar.plantCode})</strong>
                  </span>
                ))}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyPlantRange}
            className="px-4 py-1.5 bg-[#2F6F5E] hover:bg-[#25584a] text-white text-xs font-semibold rounded-lg shadow-sm transition shrink-0"
          >
            Apply Plant to Date Range
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onDelete={setConfirm}
      />

      <SlideOver open={open} onClose={() => setOpen(false)} title={isEditing ? 'Edit Attendance Entry' : 'Add Attendance Entry'}>
        <div className="space-y-4">
          
          {/* Section 1: Context */}
          <section>
            <h4 className="font-semibold mb-2">Context</h4>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border">
              <div className="col-span-2">
                <label className="block text-xs text-slate-600">Business Center</label>
                <input
                  value={(bcList.find(c => c.code === form.businessCenter)?.code ? `${bcList.find(c => c.code === form.businessCenter)?.code} / ${bcList.find(c => c.code === form.businessCenter)?.name}` : form.businessCenter) || ''}
                  readOnly
                  className="mt-1 w-full form-input bg-slate-100 cursor-not-allowed text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Year</label>
                <select value={form.atttYear} onChange={e => setForm({ ...form, atttYear: e.target.value })} className="mt-1 w-full form-input">
                  {['2025', '2026', '2027', '2028'].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600">Month</label>
                <select value={form.attMonth} onChange={e => setForm({ ...form, attMonth: e.target.value })} className="mt-1 w-full form-input">
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                <SearchableEmployeeSelect employees={employeeList} value={form.epfNo} onChange={(epf) => { handleEmployeeChange(epf || ''); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} />
                {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Plant / Customer *</label>
                  {form.epfNo && hasPlantTransfer && relevantPlants.length > 0 && (
                    <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium border border-teal-200">
                      {relevantPlants.length} Assigned {relevantPlants.length === 1 ? 'Plant' : 'Plants'}
                    </span>
                  )}
                  {form.epfNo && !hasPlantTransfer && (
                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                      Current Plant
                    </span>
                  )}
                </div>
                {form.epfNo && !hasPlantTransfer ? (
                  <select 
                    value={form.plantCode} 
                    disabled
                    className="w-full form-input bg-slate-100 cursor-not-allowed text-slate-700 font-medium"
                  >
                    {relevantPlants.map(c => {
                      const emp = employeeList.find(e => e.epfNo === form.epfNo);
                      const isCurrent = emp?.plantCode?.startsWith(c.code);
                      return (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}{isCurrent ? ' (Current Plant)' : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <select 
                    value={form.plantCode} 
                    onChange={e => { 
                      setForm({ ...form, plantCode: e.target.value }); 
                      if (errors.plantCode) setErrors(prev => ({ ...prev, plantCode: undefined })) 
                    }} 
                    className={`w-full form-input ${errors.plantCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                  >
                    <option value="">Select plant</option>
                    {relevantPlants.map(c => {
                      const emp = employeeList.find(e => e.epfNo === form.epfNo);
                      const isCurrent = emp?.plantCode?.startsWith(c.code);
                      const isFromPlant = empTransfers.some(t => t.fromPlant?.includes(c.code));
                      const isToPlant = empTransfers.some(t => t.toPlant?.includes(c.code));
                      let tag = '';
                      if (isCurrent) tag = ' (Current Plant)';
                      else if (isFromPlant) tag = ' (Previous Plant)';
                      else if (isToPlant) tag = ' (Transferred Plant)';
                      return (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}{tag}
                        </option>
                      );
                    })}
                    {!form.epfNo && (
                      <optgroup label="── All Other Plants ──">
                        {customerList.map(c => (
                          <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
                {errors.plantCode && <p className="mt-1 text-xs text-red-500">{errors.plantCode}</p>}
                {form.epfNo && !hasPlantTransfer && (
                  <p className="mt-1 text-[11px] text-slate-500 italic">
                    Employee has not transferred plants. Assigned to current plant only.
                  </p>
                )}
              </div>

              {/* Active Plant Transfer Banner */}
              {transfers.find(t => t.epfNo === form.epfNo && t.status === 'Active') && (
                <div className="col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 shadow-xs">
                  <ArrowRightLeft className="text-amber-600 shrink-0" size={16} />
                  <div className="text-xs">
                    <span className="font-bold text-amber-900">Active Cross-Plant Transfer:</span>
                    <span className="text-amber-800 ml-1">
                      Assigned to <strong>{transfers.find(t => t.epfNo === form.epfNo && t.status === 'Active')?.toPlant}</strong> ({transfers.find(t => t.epfNo === form.epfNo && t.status === 'Active')?.daysWorked} days worked).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Plant Settings */}
          <section className="bg-slate-50 border p-3 rounded-lg space-y-2">
            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Plant Settings</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-600">Working Days (Plant)</label>
                <NumericInput integer value={form.workingDays || 0} onChange={e => handleNumericInput('workingDays', 'Working days', e.target.value)} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-slate-600">No Of Staff (Plant)</label>
                <NumericInput integer value={form.noOfStaff || 0} onChange={e => handleNumericInput('noOfStaff', 'No of staff', e.target.value)} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-slate-600">Das for Att Allowance</label>
                <NumericInput integer value={form.dasForAttAllowance || 0} onChange={e => handleNumericInput('dasForAttAllowance', 'Attendance allowance days', e.target.value)} className="mt-1 w-full form-input" />
              </div>
              <div className="flex items-center justify-between p-1 bg-white border rounded mt-3">
                <span className="text-slate-600 font-medium">Auto OT Calculation</span>
                <Toggle checked={form.otCalAuto === 'Y'} onChange={v => setForm({ ...form, otCalAuto: v ? 'Y' : 'N' })} />
              </div>
              <div className="flex items-center justify-between p-1 bg-white border rounded mt-3 col-span-2">
                <span className="text-slate-600 font-medium">Include Attendance Allowance</span>
                <Toggle checked={form.attAllowance === 'Y'} onChange={v => setForm({ ...form, attAllowance: v ? 'Y' : 'N' })} />
              </div>
            </div>
          </section>

          {/* Section 3: Compensation Snapshot */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-xs text-slate-700">Compensation Snapshot (Editable)</h4>
              {(() => {
                const emp = employeeList.find(e => (e.epfNo || '').trim() === (form.epfNo || '').trim());
                const autoSal = resolveEmployeeBasicSalary(emp);
                if (autoSal > 0 && form.basicSalary !== autoSal) {
                  return (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, basicSalary: autoSal }))}
                      className="text-[11px] text-[#2F6F5E] hover:underline font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                    >
                      Sync from Section Basic Salary (Rs. {autoSal.toLocaleString()})
                    </button>
                  );
                }
                return null;
              })()}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Basic Salary (Rs.)</label>
                <NumericInput value={form.basicSalary || 0} onChange={e => handleNumericInput('basicSalary', 'Basic salary', e.target.value)} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Allowance</label>
                <NumericInput value={form.dayAllowance || 0} onChange={e => handleNumericInput('dayAllowance', 'Day allowance', e.target.value)} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Night Allowance</label>
                <NumericInput value={form.nightAllowance || 0} onChange={e => handleNumericInput('nightAllowance', 'Night allowance', e.target.value)} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
              </div>
            </div>
          </section>

          {/* Section 4: Day Entry */}
          <section className="border border-slate-200 p-3 rounded-lg space-y-3">
            <h4 className="font-semibold mb-1 text-slate-800">Day Entry</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Day In (Date) *</label>
                <input
                  type="date"
                  value={form.dayIn ? form.dayIn.split('T')[0] : ''}
                  onChange={e => {
                    const newDate = e.target.value;
                    let yr = form.atttYear;
                    let mo = form.attMonth;
                    if (newDate && newDate.includes('-')) {
                      const parts = newDate.split('-');
                      yr = parts[0];
                      mo = parts[1];
                    }
                    setForm(prev => ({
                      ...prev,
                      dayIn: newDate,
                      dayOut: newDate, // automatically assign Day Out (Date) to match Day In (Date)
                      atttYear: yr,
                      attMonth: mo
                    }));
                    if (errors.dayIn) setErrors(prev => ({ ...prev, dayIn: undefined }));
                  }}
                  className={`mt-1 w-full form-input ${errors.dayIn ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.dayIn && <p className="mt-1 text-xs text-red-500">{errors.dayIn}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Time In</label>
                <input type="time" value={form.timeIn} onChange={e => setForm({ ...form, timeIn: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Out (Date) (Editable)</label>
                <input
                  type="date"
                  value={form.dayOut ? form.dayOut.split('T')[0] : (form.dayIn ? form.dayIn.split('T')[0] : '')}
                  onChange={e => setForm(prev => ({ ...prev, dayOut: e.target.value }))}
                  className="mt-1 w-full form-input"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Time Out</label>
                <input type="time" value={form.timeOut} onChange={e => setForm({ ...form, timeOut: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div className="col-span-2 flex items-center justify-between p-2 bg-slate-50 border rounded-lg">
                <span className="text-xs font-semibold text-slate-600">Half Day Entry</span>
                <Toggle checked={form.halfDay === 1} onChange={v => setForm({ ...form, halfDay: v ? 1 : 0 })} />
              </div>
            </div>

            {/* Computed read-only StatChips */}
            <div className="flex gap-4 items-center bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <div>
                <span className="text-xs text-emerald-800 block font-medium">Total Working Hours</span>
                <span className="text-lg font-bold font-mono text-emerald-950">{liveComputed.hours.toFixed(1)} hrs</span>
              </div>
              <div className="border-l border-emerald-200 pl-4">
                <span className="text-xs text-emerald-800 block font-medium">Calculated OT</span>
                <span className={`text-lg font-bold font-mono ${liveComputed.ot > 0 ? 'text-[#C08A2E]' : 'text-emerald-900'}`}>{liveComputed.ot.toFixed(1)} hrs</span>
              </div>
            </div>
          </section>

          {/* Section 5: Day Type */}
          <section className="space-y-3">
            <h4 className="font-semibold mb-1">Day Type</h4>
            <div className="flex rounded-lg bg-slate-100 p-0.5 border">
              <button type="button" onClick={() => handleDayTypeChange('Normal')} className={`flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all ${selectedDayType === 'Normal' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Normal</button>
              <button type="button" onClick={() => handleDayTypeChange('SaturdayPoya')} className={`flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all ${selectedDayType === 'SaturdayPoya' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Poya/Sat</button>
              <button type="button" onClick={() => handleDayTypeChange('Special')} className={`flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all ${selectedDayType === 'Special' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Special</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1 bg-white border rounded">
                <span className="text-slate-600 font-medium">Poya / Saturday Normal</span>
                <Toggle checked={form.poyaSaturdayNormal === 'Y'} onChange={v => setForm({ ...form, poyaSaturdayNormal: v ? 'Y' : 'N' })} />
              </div>
              <div className="flex items-center justify-between p-1 bg-white border rounded">
                <span className="text-slate-600 font-medium">Statutory Holidays</span>
                <Toggle checked={form.statutoryHolidays === 1} onChange={v => setForm({ ...form, statutoryHolidays: v ? 1 : 0 })} />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-600 mb-1">Sunday Poya Extra Payment</label>
                <NumericInput value={form.sundayPoyaExtra || 0} onChange={e => handleNumericInput('sundayPoyaExtra', 'Sunday/Poya extra payment', e.target.value)} className="w-full form-input" />
              </div>
            </div>
          </section>

          {/* Section 6: Shift */}
          <section className="space-y-2">
            <h4 className="font-semibold mb-1">Shift</h4>
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-100 border">
              {[
                { name: 'Day', icon: Sun },
                { name: '2nd', icon: Sunset },
                { name: 'Night', icon: Moon },
                { name: 'Full Night', icon: Star }
              ].map(s => {
                const Icon = s.icon;
                const active = selectedShift === s.name;
                return (
                  <button key={s.name} type="button" onClick={() => handleShiftChange(s.name as any)} className={`flex flex-col items-center justify-center py-1.5 rounded-md text-xs font-semibold transition-all ${active ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
                    <Icon size={16} className={active ? 'text-[#2F6F5E]' : 'text-slate-500'} />
                    <span className="mt-0.5 text-[10px]">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 7: Meals & Misc */}
          <section>
            <h4 className="font-semibold mb-2">Meals & Misc</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600">No of Meals</label>
                <NumericInput integer value={form.noOfMeal || 0} onChange={e => handleNumericInput('noOfMeal', 'No of meals', e.target.value)} className="mt-1 w-full form-input text-right mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Total Meal Value</label>
                <NumericInput value={form.totalMealValue || 0} onChange={e => handleNumericInput('totalMealValue', 'Total meal value', e.target.value)} className="mt-1 w-full form-input text-right mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Late Allow No</label>
                <input type="text" value={form.lateAllowNo || ''} onChange={e => setForm({ ...form, lateAllowNo: e.target.value })} className="mt-1 w-full form-input" />
              </div>
            </div>
          </section>

          {/* Save/Cancel Action Bar */}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className="px-3 py-1 rounded-md border" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="px-3 py-1 rounded-md bg-[#2F6F5E] text-white font-medium" onClick={handleSave}>Save</button>
          </div>
        </div>
      </SlideOver>

      {uploadRows.length > 0 && (
        <section className="mt-5 rounded-lg border bg-white shadow-flat">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-4 py-3 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#2F6F5E]" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Uploaded Attendance Preview ({uploadRows.length} rows)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {uploadRows.filter(r => validateUploadRow(r, uploadRows, rows, employeeList).isValid).length} Valid
                </span>
                {uploadRows.some(r => !validateUploadRow(r, uploadRows, rows, employeeList).isValid) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    {uploadRows.filter(r => !validateUploadRow(r, uploadRows, rows, employeeList).isValid).length} Flagged
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Each row has its own Plant Code and Section Code dropdown. Defaults apply automatically and can be edited per row.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">Default Plant:</span>
                <select
                  value={uploadDefaultPlant}
                  onChange={e => setUploadDefaultPlant(e.target.value)}
                  className="form-input text-xs py-1 h-7 max-w-[130px]"
                >
                  <option value="">(None)</option>
                  {customerList.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">Default Section:</span>
                <select
                  value={uploadDefaultSection}
                  onChange={e => setUploadDefaultSection(e.target.value)}
                  className="form-input text-xs py-1 h-7 max-w-[130px]"
                >
                  <option value="">(None)</option>
                  {sectionList.map(s => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              {(uploadDefaultPlant || uploadDefaultSection) && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadRows(prev => prev.map(r => ({
                      ...r,
                      plantCode: (!r.plantCode || r.plantCode === '') && uploadDefaultPlant ? uploadDefaultPlant : r.plantCode,
                      customerCode: (!r.customerCode || r.customerCode === '') && uploadDefaultPlant ? uploadDefaultPlant : r.customerCode,
                      sectionCode: (!r.sectionCode || r.sectionCode === '') && uploadDefaultSection ? uploadDefaultSection : r.sectionCode
                    })));
                    toast.success('Applied defaults to unset rows.');
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                >
                  Apply Defaults
                </button>
              )}

              <button type="button" className="px-2.5 py-1 text-xs border rounded hover:bg-slate-50" onClick={exportUploadRows}>
                Export Draft
              </button>
              <button type="button" className="px-2.5 py-1 text-xs text-red-600 hover:text-red-800" onClick={() => setUploadRows([])}>
                Clear All
              </button>
              <button
                type="button"
                className="px-3.5 py-1 text-xs bg-[#2F6F5E] text-white rounded font-semibold hover:bg-[#26594b] shadow-xs"
                onClick={handleBulkSaveValidated}
              >
                Save Valid Rows ({uploadRows.filter(r => validateUploadRow(r, uploadRows, rows, employeeList).isValid).length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="min-w-[1450px] w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600 sticky top-0 z-10 border-b">
                <tr>
                  <th className="px-2 py-2">Validation Status</th>
                  <th className="px-2 py-2">EPF No</th>
                  <th className="px-2 py-2">Plant Code *</th>
                  <th className="px-2 py-2">Section Code</th>
                  <th className="px-2 py-2">Day In</th>
                  <th className="px-2 py-2">Day Out</th>
                  <th className="px-2 py-2">Time In</th>
                  <th className="px-2 py-2">Time Out</th>
                  <th className="px-2 py-2">Work Days</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">OT</th>
                  <th className="px-2 py-2">Shift</th>
                  <th className="px-2 py-2">Meals</th>
                  <th className="px-2 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploadRows.map((row, index) => {
                  const val = validateUploadRow(row, uploadRows, rows, employeeList);
                  return (
                    <tr key={row.id || index} className={val.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/60'}>
                      <td className="px-2 py-1.5">
                        {val.isValid ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Valid
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {val.errors.map((e, ei) => (
                              <span key={ei} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                ⚠️ {e}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="text" 
                          value={row.epfNo || ''} 
                          onChange={e => updateUploadRow(index, { epfNo: e.target.value })} 
                          className={`form-input w-24 text-xs font-mono ${val.errors.some(er => er.includes('EPF')) ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : ''}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.plantCode || ''} 
                          onChange={e => updateUploadRow(index, { plantCode: e.target.value, customerCode: e.target.value })} 
                          className="form-input w-36 text-xs"
                        >
                          <option value="">Select Plant</option>
                          {customerList.map(c => (
                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.sectionCode || ''} 
                          onChange={e => updateUploadRow(index, { sectionCode: e.target.value })} 
                          className="form-input w-36 text-xs"
                        >
                          <option value="">Select Section</option>
                          {sectionList.map(s => (
                            <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="date" 
                          value={row.dayIn || ''} 
                          onChange={e => updateUploadRow(index, { dayIn: e.target.value, dayOut: row.dayOut || e.target.value })} 
                          className={`form-input w-32 text-xs ${val.errors.some(er => er.includes('Date')) ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="date" 
                          value={row.dayOut ? String(row.dayOut).split('T')[0] : (row.dayIn || '')} 
                          onChange={e => updateUploadRow(index, { dayOut: e.target.value })} 
                          className="form-input w-32 text-xs" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="time" 
                          step="1" 
                          value={row.timeIn || ''} 
                          onChange={e => {
                            const newTimeIn = e.target.value;
                            const { hours, ot } = computeHours(newTimeIn, row.timeOut || '');
                            updateUploadRow(index, { timeIn: newTimeIn, totalWorkingHours: hours, totalOt: ot });
                          }} 
                          className="form-input w-24 text-xs" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="time" 
                          step="1" 
                          value={(row.timeOut || '').slice(0, 8)} 
                          onChange={e => {
                            const newTimeOut = e.target.value;
                            const { hours, ot } = computeHours(row.timeIn || '', newTimeOut);
                            updateUploadRow(index, { timeOut: newTimeOut, totalWorkingHours: hours, totalOt: ot });
                          }} 
                          className="form-input w-24 text-xs" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumericInput 
                          value={row.workingDays ?? ''} 
                          onChange={e => updateUploadRow(index, { workingDays: Number(e.target.value || 0) })} 
                          className="form-input w-16 text-xs text-right" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumericInput 
                          value={row.totalWorkingHours ?? ''} 
                          onChange={e => updateUploadRow(index, { totalWorkingHours: Number(e.target.value || 0) })} 
                          className="form-input w-16 text-xs text-right" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumericInput 
                          value={row.totalOt ?? ''} 
                          onChange={e => updateUploadRow(index, { totalOt: Number(e.target.value || 0) })} 
                          className="form-input w-16 text-xs text-right" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.dayShift === 'Y' ? 'Day' : row.secondShift === 'Y' ? '2nd' : row.nightShift === 'Y' ? 'Night' : 'Full Night'} 
                          onChange={e => {
                            const shift = e.target.value;
                            updateUploadRow(index, { 
                              dayShift: shift === 'Day' ? 'Y' : 'N', 
                              secondShift: shift === '2nd' ? 'Y' : 'N', 
                              nightShift: shift === 'Night' ? 'Y' : 'N', 
                              fullNight: shift === 'Full Night' ? 'Y' : 'N' 
                            });
                          }} 
                          className="form-input w-24 text-xs"
                        >
                          <option>Day</option>
                          <option>2nd</option>
                          <option>Night</option>
                          <option>Full Night</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <NumericInput 
                          integer 
                          value={row.noOfMeal ?? ''} 
                          onChange={e => updateUploadRow(index, { noOfMeal: Number(e.target.value || 0) })} 
                          className="form-input w-14 text-xs text-right" 
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button 
                          type="button" 
                          title="Remove Row"
                          onClick={() => setUploadRows(uploadRows.filter((_, rIdx) => rIdx !== index))}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmDialog open={!!confirm} title="Delete Entry" message="Are you sure you want to delete this attendance log?" onConfirm={handleDeleteConfirm} onCancel={() => setConfirm(null)} />

      {/* Sync Monthly Summary Modal */}
      <SlideOver open={syncModalOpen} onClose={() => setSyncModalOpen(false)} title="Sync Monthly Summary">
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">Select Month & Year for Bulk Attendance Sync</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payroll Month *</label>
                <select
                  value={syncMonth}
                  onChange={e => setSyncMonth(e.target.value)}
                  className="w-full form-input text-xs"
                >
                  <option value="01">01 - January</option>
                  <option value="02">02 - February</option>
                  <option value="03">03 - March</option>
                  <option value="04">04 - April</option>
                  <option value="05">05 - May</option>
                  <option value="06">06 - June</option>
                  <option value="07">07 - July</option>
                  <option value="08">08 - August</option>
                  <option value="09">09 - September</option>
                  <option value="10">10 - October</option>
                  <option value="11">11 - November</option>
                  <option value="12">12 - December</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payroll Year *</label>
                <select
                  value={syncYear}
                  onChange={e => setSyncYear(e.target.value)}
                  className="w-full form-input text-xs"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSyncModalOpen(false)}
              className="px-3 py-1.5 rounded-md border text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={handleRunMonthlySync}
              className="px-4 py-1.5 rounded-md bg-[#2F6F5E] hover:bg-[#26594b] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Monthly Summary'}
            </button>
          </div>

          {syncResults.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-slate-800">Synced Summary Results ({syncResults.length} Employees)</h4>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">
                  Calculated for {syncMonth}/{syncYear}
                </span>
              </div>
              <div className="overflow-x-auto max-h-64 border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b">
                    <tr>
                      <th className="p-2">EPF No</th>
                      <th className="p-2">Employee Name</th>
                      <th className="p-2 text-right">Present Days</th>
                      <th className="p-2 text-right">Leaves</th>
                      <th className="p-2 text-right">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {syncResults.map(r => (
                      <tr key={r.epfNo} className="hover:bg-slate-50">
                        <td className="p-2 font-mono">{r.epfNo}</td>
                        <td className="p-2 font-medium text-slate-800">{r.empName}</td>
                        <td className="p-2 text-right font-mono text-emerald-700 font-semibold">{r.presentDays}</td>
                        <td className="p-2 text-right font-mono text-amber-700 font-semibold">{r.leaves}</td>
                        <td className="p-2 text-right font-mono text-indigo-700 font-semibold">{r.otHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
