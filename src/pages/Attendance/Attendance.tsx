import React, { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Sun, Sunset, Moon, Star, ArrowRightLeft, Trash2, Filter, Layers, FileSpreadsheet, Save, Database, AlertCircle, Calendar, Check, X, CheckSquare, Square, Info, CalendarDays } from 'lucide-react'
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
  updatePlantRange,
  remove as removeAttendance,
  Attendance
} from '../../mocks/attendance'
import { computePlantHours, resolvePlantSetting } from '../../utils/shiftHoursCalculator'
import { logAuditAction } from '../../utils/auditLogger'
import {
  getStatutorySettings,
  saveStatutorySettings,
  getStatutoryMonthConfig,
  saveStatutoryMonthConfig,
  getEmployeeStatutoryEntries,
  saveEmployeeStatutoryEntries,
  computeHolidayValue,
  detectEmployeeWorkedOnHoliday,
  StatutoryHolidaySettings,
  StatutoryMonthConfig,
  EmployeeStatutoryEntry
} from '../../utils/statutoryHolidayManager'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'

const SHIFT_ICONS: Record<string, any> = {
  'Day': Sun,
  '2nd': Sunset,
  'Night': Moon,
  'Full Night': Star
}

// Helper to compute total hours and OT hours dynamically considering Plant shift rules
function computeHours(timeInStr: string, timeOutStr: string, plant?: any, plantCode?: string): { hours: number; ot: number } {
  const result = computePlantHours(timeInStr, timeOutStr, plant, plantCode);
  return { hours: result.hours, ot: result.ot };
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
  name: 'employeeName', employeename: 'employeeName', empname: 'employeeName',
  plantcode: 'plantCode', customercode: 'customerCode', sectioncode: 'sectionCode',
  workingdays: 'workingDays', workday: 'workingDays', workdays: 'workingDays',
  basicsalary: 'basicSalary', dayallowance: 'dayAllowance',
  nightallowance: 'nightAllowance', dayin: 'dayIn', timein: 'timeIn', dayout: 'dayOut',
  timeout: 'timeOut', halfday: 'halfDay', totalworkinghours: 'totalWorkingHours', totalot: 'totalOt',
  normalday: 'normalDay', saturdaypoya: 'saturdayPoya', specialday: 'specialDay',
  dayshift: 'dayShift', secondshift: 'secondShift', nightshift: 'nightShift', fullnight: 'fullNight',
  noofmeal: 'noOfMeal', noofmeals: 'noOfMeal', meals: 'noOfMeal', meal: 'noOfMeal',
  mealtype: 'mealType' as any,
  totalmealvalue: 'totalMealValue', mealvalue: 'totalMealValue', statutoryholidays: 'statutoryHolidays',
  sundaypoyaextra: 'sundayPoyaExtra', businesscenter: 'businessCenter'
}

function excelDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yr = value.getFullYear()
    const mo = String(value.getMonth() + 1).padStart(2, '0')
    const da = String(value.getDate()).padStart(2, '0')
    return `${yr}-${mo}-${da}`
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : ''
  }
  const text = String(value ?? '').trim()
  if (!text) return ''
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) {
    const parts = text.split(/[-/]/)
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].slice(0, 2).padStart(2, '0')}`
  }
  // MM/DD/YYYY or DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) {
    const parts = text.split('/')
    let p0 = parseInt(parts[0], 10)
    let p1 = parseInt(parts[1], 10)
    const yr = parts[2].slice(0, 4)
    // If first number > 12, it must be DD/MM/YYYY
    if (p0 > 12 && p1 <= 12) {
      return `${yr}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`
    }
    // Default standard US format MM/DD/YYYY
    return `${yr}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`
  }
  // Try native Date parsing
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) {
    const yr = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    return `${yr}-${mo}-${da}`
  }
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
  defaultSection?: string,
  employeeList: any[] = [],
  customerList: any[] = []
): Attendance[] {
  if (!data.length) return []
  const headers = data[0].map(value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  return data.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const record: Partial<Attendance> = {
      id: uuid(), atttYear: '', attMonth: '', epfNo: '',
      plantCode: defaultPlant || '', customerCode: defaultPlant || '', sectionCode: defaultSection || '',
      dayIn: '', timeIn: '', businessCenter,
      workingDays: 1, halfDay: 0, noOfMeal: 1
    }
    headers.forEach((header, column) => {
      const field = excelFieldMap[header]
      if (!field) return
      const value = row[column]
      if (field === 'dayIn') (record as any)[field] = excelDate(value)
      else if (field === 'dayOut') (record as any)[field] = excelDate(value)
      else if (field === 'timeIn' || field === 'timeOut') (record as any)[field] = excelTime(value)
      else if (field === 'workingDays') {
        const str = String(value ?? '').trim().toLowerCase()
        if (str.includes('half') || str.includes('0.5')) {
          (record as any).workingDays = 0.5
          ;(record as any).halfDay = 1
        } else if (str.includes('full') || str === '1' || str === '1.0' || str.includes('1 -')) {
          (record as any).workingDays = 1.0
          ;(record as any).halfDay = 0
        } else {
          const num = Number(str.replace(/^0+(?=\d)/, ''))
          ;(record as any).workingDays = Number.isFinite(num) ? num : 1
          ;(record as any).halfDay = ((record as any).workingDays <= 0.5 && (record as any).workingDays > 0) ? 1 : 0
        }
      } else if (field === 'mealType') {
        (record as any).mealType = String(value ?? '').trim()
      } else if (['basicSalary', 'dayAllowance', 'nightAllowance', 'halfDay', 'totalWorkingHours', 'totalOt', 'noOfMeal', 'totalMealValue', 'statutoryHolidays', 'sundayPoyaExtra'].includes(field)) {
        const number = Number(String(value ?? '').replace(/^0+(?=\d)/, ''))
        ;(record as any)[field] = Number.isFinite(number) ? number : 0
      } else if (field === 'businessCenter') (record as any)[field] = String(value ?? '').trim() || businessCenter
      else (record as any)[field] = String(value ?? '').trim()
    })

    const dayInVal = record.dayIn || ''
    const yearFromDate = dayInVal.includes('-') ? dayInVal.split('-')[0] : ''
    const monthFromDate = dayInVal.includes('-') ? dayInVal.split('-')[1] : ''

    const cleanEpf = (record.epfNo || '').trim().toLowerCase()
    const matchedEmployee = cleanEpf ? employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf) : undefined
    const autoPlant = record.plantCode || (matchedEmployee?.plantCode ? matchedEmployee.plantCode.split(' ')[0].trim() : '') || defaultPlant || ''
    const autoSection = record.sectionCode || matchedEmployee?.sectionCode || defaultSection || ''
    const autoName = record.employeeName || (matchedEmployee ? `${matchedEmployee.firstName} ${matchedEmployee.lastName || ''}`.trim() : '')
    const autoSalary = (record.basicSalary != null && record.basicSalary > 0) ? record.basicSalary : (matchedEmployee?.basicSalary || 0)

    const plantObj = customerList.find(c => c.code === autoPlant || c.name === autoPlant)
    const mealType = record.mealType || matchedEmployee?.mealType || 'Standard'
    const mealRate = matchedEmployee?.mealValue != null ? Number(matchedEmployee.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
    const noOfMeals = record.noOfMeal != null ? Number(record.noOfMeal) : 1
    const totalMealValue = (record.totalMealValue != null && record.totalMealValue > 0) ? record.totalMealValue : (noOfMeals * mealRate)

    // Compute working hours and OT using Plant shift settings
    let totalWorkingHours = record.totalWorkingHours
    let totalOt = record.totalOt
    if (record.timeIn && record.timeOut) {
      const computed = computePlantHours(record.timeIn, record.timeOut, plantObj, autoPlant)
      totalWorkingHours = computed.hours
      totalOt = computed.ot
    } else if (record.timeIn) {
      const computed = computePlantHours(record.timeIn, '16:00', plantObj, autoPlant)
      totalWorkingHours = computed.hours
      totalOt = computed.ot
    }

    return {
      ...defaultAttendanceRecord,
      ...record,
      id: record.id || `${record.epfNo || 'row'}-${index}`,
      employeeName: autoName,
      atttYear: record.atttYear || yearFromDate,
      attMonth: record.attMonth || monthFromDate,
      plantCode: autoPlant,
      customerCode: record.customerCode || autoPlant,
      sectionCode: autoSection,
      basicSalary: autoSalary,
      dayAllowance: record.dayAllowance ?? matchedEmployee?.dayAllowance ?? 0,
      nightAllowance: record.nightAllowance ?? matchedEmployee?.nightAllowance ?? 0,
      workingDays: record.workingDays ?? (record.halfDay === 1 ? 0.5 : 1),
      halfDay: record.halfDay ?? (record.workingDays === 0.5 ? 1 : 0),
      noOfMeal: noOfMeals,
      mealType,
      totalMealValue,
      totalWorkingHours: totalWorkingHours ?? 8.0,
      totalOt: totalOt ?? 0,
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
  } else if (!empList.some(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf)) {
    errs.push('Unknown EPF No')
  }

  // 2. Date check
  const rawDate = String(row.dayIn || '').trim()
  const normalized = excelDate(rawDate)
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? new Date(`${normalized}T00:00:00`) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
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
    noOfStaff: 0,
    attAllowance: 'Y',
    dasForAttAllowance: 0,
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
    totalMealValue: 0,
    statutoryHolidays: 0,
    sundayPoyaExtra: 0,
    businessCenter: localStorage.getItem('hsb_active_bc') || ''
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
  const [uploadRows, setUploadRows] = useState<Attendance[]>(() => {
    try {
      const cached = localStorage.getItem('hsb_attendance_staged_upload')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist staged Excel upload rows across logouts or page refreshes
  useEffect(() => {
    try {
      if (uploadRows.length > 0) {
        localStorage.setItem('hsb_attendance_staged_upload', JSON.stringify(uploadRows))
      } else {
        localStorage.removeItem('hsb_attendance_staged_upload')
      }
    } catch {}
  }, [uploadRows])

  // Filters for Year, Month, Employee, Plant
  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')
  const [filterPlant, setFilterPlant] = useState<string>('ALL')

  // View Mode: 'logs' (Daily logs table), 'savedRecords' (Month & Plant wise summary), or 'statutoryHolidays'
  const [activeTab, setActiveTab] = useState<'logs' | 'savedRecords' | 'statutoryHolidays'>('logs')
  const [statYear, setStatYear] = useState<string>(() => String(new Date().getFullYear()))
  const [statMonth, setStatMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [statSettings, setStatSettings] = useState<StatutoryHolidaySettings>(() => getStatutorySettings())
  const [statMonthConfig, setStatMonthConfig] = useState<StatutoryMonthConfig>(() =>
    getStatutoryMonthConfig(String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, '0'))
  )
  const [statEntries, setStatEntries] = useState<Record<string, EmployeeStatutoryEntry>>({})
  const [statNewDate, setStatNewDate] = useState<string>('')
  const [statNewName, setStatNewName] = useState<string>('')
  const [statSearch, setStatSearch] = useState<string>('')
  const [statPlantFilter, setStatPlantFilter] = useState<string>('ALL')
  const [statFilterStatus, setStatFilterStatus] = useState<'ALL' | 'WORKED' | 'NOT_WORKED' | 'ELIGIBLE' | 'NOT_ELIGIBLE'>('ALL')
  const [isSavingStat, setIsSavingStat] = useState<boolean>(false)
  const [isSavingDb, setIsSavingDb] = useState(false)
  const [saveSummaries, setSaveSummaries] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('')

  // Filters for Saved Records view
  const [savedRecordsYear, setSavedRecordsYear] = useState<string>('ALL')
  const [savedRecordsMonth, setSavedRecordsMonth] = useState<string>('ALL')
  const [savedRecordsPlant, setSavedRecordsPlant] = useState<string>('ALL')

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
  const [syncYear, setSyncYear] = useState(String(new Date().getFullYear()))
  const [syncMonth, setSyncMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
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

  async function refresh() {
    const activeBc = localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
    try {
      const [attendance, plantTransfers, sections, employees, customers, centers] = await Promise.all([
        listAttendance(cleanBc),
        listTransfers(cleanBc),
        listSections(cleanBc),
        listEmployees(cleanBc),
        listCustomers(cleanBc),
        listBC()
      ])
      setRows(attendance)
      setTransfers(plantTransfers)
      setSectionList(sections)
      setEmployeeList(employees)
      setCustomerList(customers)
      setBcList(centers)
      const firstEmployee = employees.find(employee => employee?.epfNo)
      if (firstEmployee) {
        const autoSalary = resolveEmployeeBasicSalary(firstEmployee, sections)
        setForm(prev => ({
          ...prev,
          epfNo: prev.epfNo && employees.some(e => e.epfNo === prev.epfNo) ? prev.epfNo : firstEmployee.epfNo,
          plantCode: prev.plantCode || firstEmployee.plantCode || '',
          businessCenter: cleanBc || firstEmployee.businessCenter || '',
          basicSalary: prev.basicSalary || autoSalary,
          dayAllowance: prev.dayAllowance || firstEmployee.dayAllowance || 0,
          nightAllowance: prev.nightAllowance || firstEmployee.nightAllowance || 0
        }))
      }
      setSaveError(null)
    } catch (error) {
      console.error('Failed to load attendance data', error)
      setSaveError('Unable to load attendance data from the server.')
    }
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
        defaultSection,
        employeeList,
        customerList
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

  function handleAddNewUploadRow() {
    const today = new Date().toISOString().split('T')[0];
    const defaultPlant = uploadDefaultPlant || (customerList[0]?.code || '');
    const defaultSection = uploadDefaultSection || (sectionList[0]?.code || '');
    const plantObj = customerList.find(c => c.code === defaultPlant || c.name === defaultPlant);
    const defaultTimeIn = '08:00';
    const defaultTimeOut = '16:00';
    const computed = computePlantHours(defaultTimeIn, defaultTimeOut, plantObj, defaultPlant);
    const mealRate = plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200;

    const newRow: Attendance = {
      id: uuid(),
      atttYear: today.split('-')[0],
      attMonth: today.split('-')[1],
      epfNo: '',
      employeeName: '',
      plantCode: defaultPlant,
      customerCode: defaultPlant,
      sectionCode: defaultSection,
      businessCenter: localStorage.getItem('hsb_active_bc') || defaultForm.businessCenter,
      dayIn: today,
      dayOut: today,
      timeIn: defaultTimeIn,
      timeOut: defaultTimeOut,
      workingDays: 1,
      halfDay: 0,
      totalWorkingHours: computed.hours,
      totalOt: computed.ot,
      dayShift: 'Y',
      secondShift: 'N',
      nightShift: 'N',
      fullNight: 'N',
      noOfMeal: 1,
      mealType: 'Standard',
      totalMealValue: mealRate,
      normalDay: 'Y',
      saturdayPoya: 'N',
      specialDay: 'N'
    };
    setUploadRows(prev => [newRow, ...prev]);
    toast.success('Added a new attendance entry row for editing.');
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
    const invalidRows = validated.filter(v => !v.val.isValid).map(v => v.row)
    const invalidCount = invalidRows.length

    if (validRows.length === 0) {
      toast.error(`All ${uploadRows.length} rows have validation issues. Please correct them before saving.`)
      return
    }

    // Enrich with employeeName and normalize date/plant fields from employeeList if not set
    const enrichedValid = validRows.map(r => {
      const cleanEpf = (r.epfNo || '').trim().toLowerCase()
      const emp = cleanEpf ? employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf) : undefined
      const name = emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (r.employeeName || '')
      const cleanDayIn = excelDate(r.dayIn) || r.dayIn
      const cleanDayOut = excelDate(r.dayOut) || cleanDayIn
      const yr = r.atttYear || (cleanDayIn.includes('-') ? cleanDayIn.split('-')[0] : '')
      const mo = r.attMonth || (cleanDayIn.includes('-') ? cleanDayIn.split('-')[1] : '')
      const autoPlant = r.plantCode || (emp?.plantCode ? emp.plantCode.split(' ')[0].trim() : '') || uploadDefaultPlant || (customerList[0]?.code || '')
      const autoSection = r.sectionCode || emp?.sectionCode || uploadDefaultSection || (sectionList[0]?.code || '')

      return {
        ...r,
        employeeName: name,
        dayIn: cleanDayIn,
        dayOut: cleanDayOut,
        atttYear: yr,
        attMonth: mo,
        plantCode: autoPlant,
        customerCode: r.customerCode || autoPlant,
        sectionCode: autoSection
      }
    })

    setSaveError(null)
    setSaveSummaries([])
    try {
      const result = await bulkSaveAttendance(enrichedValid)
      const nowStr = new Date().toLocaleString()
      setLastSavedTimestamp(nowStr)

      const summaryLines = result.summaries.map(s => s.message)
      setSaveSummaries(summaryLines)
      setSaveError(null)
      toast.success(`${summaryLines.join('\n')}${invalidCount > 0 ? `\n${invalidCount} invalid rows retained for review.` : ''}`)

      if (invalidCount > 0) {
        setUploadRows(invalidRows)
      } else {
        setUploadRows([])
      }
      await listAttendance(localStorage.getItem('hsb_active_bc') || '').then(setRows)
      // Switch to logs tab and reset filters so newly saved rows are immediately visible
      setFilterYear('ALL')
      setFilterMonth('ALL')
      setFilterPlant('ALL')
      setFilterEmployee('ALL')
      setActiveTab('logs')
    } catch (error: any) {
      console.error('Bulk attendance save failed', error)
      const msg = error?.response?.data?.message || error?.message || 'Bulk attendance save failed'
      setSaveError(msg)
      toast.error(String(msg))
    }
  }

  async function handleBulkSave() {
    await handleBulkSaveValidated()
  }

  async function handleSaveAllToDb() {
    if (uploadRows.length > 0) {
      toast.info(`Saving ${uploadRows.length} uploaded Excel attendance rows to database live...`)
      await handleBulkSaveValidated()
      return
    }

    if (rows.length === 0) {
      toast.error('No attendance records available to save.')
      return
    }

    setIsSavingDb(true)
    setSaveError(null)
    setSaveSummaries([])

    // Enrich rows with employeeName
    const enrichedRows = rows.map(r => {
      const emp = employeeList.find(e => (e.epfNo || '').trim() === (r.epfNo || '').trim())
      const name = emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (r.employeeName || '')
      return { ...r, employeeName: name }
    })

    try {
      const result = await bulkSaveAttendance(enrichedRows)
      const nowStr = new Date().toLocaleString()
      setLastSavedTimestamp(nowStr)

      const summaryLines = result.summaries.map(s => s.message)
      setSaveSummaries(summaryLines)
      setSaveError(null)
      toast.success(summaryLines.join('\n'))
      await listAttendance(localStorage.getItem('hsb_active_bc') || '').then(setRows)
    } catch (err: any) {
      console.error('Save all to database failed', err)
      const msg = err?.response?.data?.message || err?.message || 'Database save failed'
      setSaveError(msg)
      toast.error(String(msg))
    } finally {
      setIsSavingDb(false)
    }
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

    let uploadMatchCount = 0
    try {
      const activeBc = localStorage.getItem('hsb_active_bc') || ''
      const businessCenter = activeBc.split(' / ')[0].trim()
      const result = await updatePlantRange({
        epfNo: rangeEmployee,
        fromDate: rangeFrom,
        toDate: rangeTo,
        plantCode: rangePlant,
        sectionCode: rangeSection || undefined,
        businessCenter
      })
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
      setAppliedRanges(prev => [...prev, {
        id: uuid(),
        epfNo: rangeEmployee,
        fromDate: rangeFrom,
        toDate: rangeTo,
        plantCode: rangePlant,
        sectionCode: rangeSection
      }])
      await listAttendance(businessCenter).then(setRows)
      toast.success(`Applied plant ${rangePlant} to ${result.updatedRows} saved attendance logs (${rangeFrom} to ${rangeTo}).`)
      if (uploadMatchCount > 0) {
        toast.info(`Updated ${uploadMatchCount} uploaded rows in the preview.`)
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to update plant range in the database.'
      setSaveError(String(message))
      toast.error(String(message))
    }
  }

  function exportUploadRows() {
    if (!uploadRows.length) {
      toast.error('There are no uploaded rows to export.')
      return
    }
    const exportRows = uploadRows.map(row => {
      const { id, ...record } = row
      const isHalf = record.workingDays === 0.5 || record.halfDay === 1 || record.halfDay === 0.5
      const workdayText = isHalf ? '0.5 - Half Day' : '1 - Full Day'
      return {
        Attt_Year: record.atttYear,
        Att_Month: record.attMonth,
        EPF_No: record.epfNo,
        Employee_Name: record.employeeName,
        Plant_Code: record.plantCode,
        Section_Code: record.sectionCode,
        Workday: workdayText,
        Working_Days: record.workingDays ?? (isHalf ? 0.5 : 1),
        Day_in: record.dayIn,
        Time_IN: record.timeIn,
        Day_out: record.dayOut,
        Time_Out: record.timeOut,
        Half_Day: isHalf ? 0.5 : 0,
        Total_Working_Hours: record.totalWorkingHours,
        Total_OT: record.totalOt,
        Shift: record.dayShift === 'Y' ? 'Day' : record.secondShift === 'Y' ? '2nd' : record.nightShift === 'Y' ? 'Night' : 'Full Night',
        Day_shift: record.dayShift,
        second_Shift: record.secondShift,
        Night_Shift: record.nightShift,
        Full_Night: record.fullNight,
        No_of_Meal: record.noOfMeal ?? 1,
        Meal_Type: record.mealType || 'Standard',
        Total_Meal_Value: record.totalMealValue ?? 0,
        Basic_Salary: record.basicSalary,
        Day_Allowance: record.dayAllowance,
        Night_Allowance: record.nightAllowance,
        Normal_Day: record.normalDay,
        Saturday_Poya: record.saturdayPoya,
        Special_Day: record.specialDay,
        Statutory_holidays: record.statutoryHolidays,
        Sunday_Poya_Extra: record.sundayPoyaExtra,
        Business_Center: record.businessCenter
      }
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Attendance')
    XLSX.writeFile(workbook, 'attendance-updated.xlsx')
    toast.success(`Exported ${uploadRows.length} attendance rows to attendance-updated.xlsx`)
  }

  function getDefaultEmployeeValues(employee?: any, shift: string = 'Day') {
    if (!employee) return {}
    const autoSalary = resolveEmployeeBasicSalary(employee)
    const isNight = shift === 'Night' || shift === 'Full Night'
    return {
      epfNo: employee.epfNo || '',
      plantCode: employee.plantCode || '',
      businessCenter: employee.businessCenter || localStorage.getItem('hsb_active_bc') || '',
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
        logAuditAction({
          action: 'DELETE',
          module: 'Attendance',
          entityId: String(targetRow.id || confirm),
          details: `Deleted attendance for ${targetRow.epfNo} on ${targetRow.dayIn}`
        });
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

    const plantObj = customerList.find(c => c.code === form.plantCode || c.name === form.plantCode);
    const { hours, ot } = computeHours(form.timeIn || '', form.timeOut || '', plantObj, form.plantCode);
    let yr = form.atttYear
    let mo = form.attMonth
    if (form.dayIn && form.dayIn.includes('-')) {
      const parts = form.dayIn.split('-')
      yr = parts[0]
      mo = parts[1]
    }

    const isNight = form.nightShift === 'Y' || form.fullNight === 'Y';
    const currentEmp = employeeList.find(e => (e.epfNo || '').trim() === (form.epfNo || '').trim());
    const empName = currentEmp ? `${currentEmp.firstName} ${currentEmp.lastName || ''}`.trim() : (form.employeeName || '');
    const toSave: Attendance = {
      ...form,
      employeeName: empName,
      atttYear: yr || form.atttYear,
      attMonth: mo || form.attMonth,
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
        logAuditAction({
          action: 'UPDATE',
          module: 'Attendance',
          entityId: String(editingId),
          details: `Updated attendance for ${toSave.epfNo} on ${toSave.dayIn}`
        })
        toast.success('Attendance updated')
      } else {
        const newId = uuid()
        await createAttendance({
          ...toSave,
          id: newId
        })
        logAuditAction({
          action: 'CREATE',
          module: 'Attendance',
          entityId: newId,
          details: `Created attendance for ${toSave.epfNo} on ${toSave.dayIn}`
        })
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
        if (!r.dayIn || !String(r.dayIn).startsWith(filterYear)) return false
      }
      // Month filter
      if (filterMonth !== 'ALL' && r.attMonth !== filterMonth) {
        if (!r.dayIn || String(r.dayIn).slice(5, 7) !== filterMonth) return false
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

  // Plants worked summary map per employee across attendance rows.
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

  // Saved Records Grouping (Month & Plant Wise)
  const savedRecordsGroups = useMemo(() => {
    type GroupData = {
      key: string;
      plantCode: string;
      plantName: string;
      year: string;
      month: string;
      employees: Set<string>;
      totalDays: number;
      totalOt: number;
      lastSaved: string;
    };

    const groups = new Map<string, GroupData>();

    rows.forEach(r => {
      const plant = (r.plantCode || '').trim();
      let yr = (r.atttYear || '').trim();
      let mo = (r.attMonth || '').trim();
      if (!yr && r.dayIn) yr = String(r.dayIn).slice(0, 4);
      if (!mo && r.dayIn) mo = String(r.dayIn).slice(5, 7);
      if (!plant || !yr || !mo) return;

      if (savedRecordsYear !== 'ALL' && yr !== savedRecordsYear) return;
      if (savedRecordsMonth !== 'ALL' && mo !== savedRecordsMonth) return;
      if (savedRecordsPlant !== 'ALL' && plant !== savedRecordsPlant) return;

      const key = `${plant}|${yr}|${mo}`;
      if (!groups.has(key)) {
        const cust = customerList.find(c => c.code === plant);
        groups.set(key, {
          key,
          plantCode: plant,
          plantName: cust?.name || plant,
          year: yr,
          month: mo,
          employees: new Set<string>(),
          totalDays: 0,
          totalOt: 0,
          lastSaved: lastSavedTimestamp || '—'
        });
      }

      const g = groups.get(key)!;
      if (r.epfNo) g.employees.add(r.epfNo.trim());
      g.totalDays += Number(r.workingDays || (r.halfDay === 1 ? 0.5 : 1));
      g.totalOt += Number(r.totalOt || 0);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return a.plantCode.localeCompare(b.plantCode);
    });
  }, [rows, customerList, savedRecordsYear, savedRecordsMonth, savedRecordsPlant, lastSavedTimestamp]);

  function handleOpenGroupRows(group: { plantCode: string; year: string; month: string }) {
    setFilterYear(group.year);
    setFilterMonth(group.month);
    setFilterPlant(group.plantCode);
    setActiveTab('logs');
    toast.info(`Opened logs for Plant ${group.plantCode} (${group.month}/${group.year})`);
  }

  // Synchronize Statutory Holiday data when statYear or statMonth or rows or employeeList change
  useEffect(() => {
    const config = getStatutoryMonthConfig(statYear, statMonth);
    setStatMonthConfig(config);
    const saved = getEmployeeStatutoryEntries(statYear, statMonth);
    const settings = getStatutorySettings();
    setStatSettings(settings);

    const updated: Record<string, EmployeeStatutoryEntry> = { ...saved };
    employeeList.forEach(emp => {
      const epf = (emp.epfNo || '').trim();
      if (!epf) return;
      const prev = updated[epf];
      const eligible = prev ? prev.eligible : (emp.statutoryHolidayEligible !== false);
      const worked = config?.hasHoliday && Array.isArray(config?.holidayDates) && config.holidayDates.length > 0
        ? detectEmployeeWorkedOnHoliday(epf, config.holidayDates, rows)
        : (prev ? prev.workedOnHoliday : false);
      const dayValue = prev && prev.dayValue !== undefined
        ? prev.dayValue
        : (emp.dayRate || emp.basicSalary || 2000);
      const holidayValue = config?.hasHoliday
        ? computeHolidayValue(dayValue, eligible, worked, settings)
        : 0;

      updated[epf] = {
        epfNo: epf,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || epf,
        plantCode: emp.plantCode || '',
        sectionCode: emp.sectionCode || '',
        eligible,
        workedOnHoliday: worked,
        dayValue,
        holidayValue
      };
    });
    setStatEntries(updated);
  }, [statYear, statMonth, employeeList, rows]);

  // Toggle Statutory Holiday in this month (Yes/No)
  function handleToggleStatHoliday(hasHoliday: boolean) {
    const newConfig = {
      ...statMonthConfig,
      year: statYear,
      month: statMonth,
      hasHoliday
    };
    setStatMonthConfig(newConfig);
    saveStatutoryMonthConfig(newConfig);

    setStatEntries(prev => {
      const next: Record<string, EmployeeStatutoryEntry> = {};
      Object.entries(prev).forEach(([epf, entry]) => {
        const holidayVal = hasHoliday
          ? computeHolidayValue(entry.dayValue, entry.eligible, entry.workedOnHoliday, statSettings)
          : 0;
        next[epf] = { ...entry, holidayValue: holidayVal };
      });
      return next;
    });
    toast.info(hasHoliday ? 'Statutory holiday enabled for this month. Please add holiday dates.' : 'Statutory holiday disabled for this month.');
  }

  // Add holiday date
  function handleAddStatDate() {
    if (!statNewDate) {
      toast.error('Please select a holiday date');
      return;
    }
    const cleanDate = statNewDate.trim();
    if (statMonthConfig.holidayDates.includes(cleanDate)) {
      toast.error('This date is already added');
      return;
    }
    const newDates = [...statMonthConfig.holidayDates, cleanDate].sort();
    const newConfig = {
      ...statMonthConfig,
      year: statYear,
      month: statMonth,
      hasHoliday: true,
      holidayDates: newDates,
      holidayName: statNewName ? statNewName.trim() : statMonthConfig.holidayName
    };
    setStatMonthConfig(newConfig);
    saveStatutoryMonthConfig(newConfig);
    setStatNewDate('');

    // Re-detect workedOnHoliday for all employees
    setStatEntries(prev => {
      const next: Record<string, EmployeeStatutoryEntry> = {};
      Object.entries(prev).forEach(([epf, entry]) => {
        const worked = detectEmployeeWorkedOnHoliday(epf, newDates, rows);
        const holidayVal = computeHolidayValue(entry.dayValue, entry.eligible, worked, statSettings);
        next[epf] = { ...entry, workedOnHoliday: worked, holidayValue: holidayVal };
      });
      return next;
    });
    toast.success(`Holiday date ${cleanDate} added! Attendance records checked.`);
  }

  // Remove holiday date
  function handleRemoveStatDate(dateToRemove: string) {
    const newDates = statMonthConfig.holidayDates.filter(d => d !== dateToRemove);
    const newConfig = {
      ...statMonthConfig,
      holidayDates: newDates
    };
    setStatMonthConfig(newConfig);
    saveStatutoryMonthConfig(newConfig);

    setStatEntries(prev => {
      const next: Record<string, EmployeeStatutoryEntry> = {};
      Object.entries(prev).forEach(([epf, entry]) => {
        const worked = detectEmployeeWorkedOnHoliday(epf, newDates, rows);
        const holidayVal = computeHolidayValue(entry.dayValue, entry.eligible, worked, statSettings);
        next[epf] = { ...entry, workedOnHoliday: worked, holidayValue: holidayVal };
      });
      return next;
    });
    toast.info(`Removed holiday date ${dateToRemove}`);
  }

  // Edit employee Day Value in the table
  function handleStatDayValueChange(epfNo: string, newDayVal: number) {
    setStatEntries(prev => {
      const entry = prev[epfNo];
      if (!entry) return prev;
      const holidayVal = statMonthConfig.hasHoliday
        ? computeHolidayValue(newDayVal, entry.eligible, entry.workedOnHoliday, statSettings)
        : 0;
      return {
        ...prev,
        [epfNo]: { ...entry, dayValue: newDayVal, holidayValue: holidayVal }
      };
    });
  }

  // Toggle employee eligibility in the table
  function handleStatEligibilityToggle(epfNo: string) {
    setStatEntries(prev => {
      const entry = prev[epfNo];
      if (!entry) return prev;
      const newEligible = !entry.eligible;
      const holidayVal = statMonthConfig.hasHoliday
        ? computeHolidayValue(entry.dayValue, newEligible, entry.workedOnHoliday, statSettings)
        : 0;
      return {
        ...prev,
        [epfNo]: { ...entry, eligible: newEligible, holidayValue: holidayVal }
      };
    });
  }

  // Toggle worked on holiday override in the table
  function handleStatWorkedToggle(epfNo: string) {
    setStatEntries(prev => {
      const entry = prev[epfNo];
      if (!entry) return prev;
      const newWorked = !entry.workedOnHoliday;
      const holidayVal = statMonthConfig.hasHoliday
        ? computeHolidayValue(entry.dayValue, entry.eligible, newWorked, statSettings)
        : 0;
      return {
        ...prev,
        [epfNo]: { ...entry, workedOnHoliday: newWorked, holidayValue: holidayVal }
      };
    });
  }

  // Update policy rate inline
  function handleUpdateStatSetting<K extends keyof StatutoryHolidaySettings>(field: K, val: StatutoryHolidaySettings[K]) {
    const nextSettings = { ...statSettings, [field]: val };
    setStatSettings(nextSettings);
    saveStatutorySettings(nextSettings);

    setStatEntries(prev => {
      const next: Record<string, EmployeeStatutoryEntry> = {};
      Object.entries(prev).forEach(([epf, entry]) => {
        const holidayVal = statMonthConfig.hasHoliday
          ? computeHolidayValue(entry.dayValue, entry.eligible, entry.workedOnHoliday, nextSettings)
          : 0;
        next[epf] = { ...entry, holidayValue: holidayVal };
      });
      return next;
    });
  }

  // Save Statutory Holidays (Click Save -> values go to the payslip)
  function handleSaveStatutoryHolidays() {
    setIsSavingStat(true);
    try {
      saveStatutoryMonthConfig(statMonthConfig);
      saveStatutorySettings(statSettings);
      saveEmployeeStatutoryEntries(statYear, statMonth, statEntries);

      window.dispatchEvent(new CustomEvent('hsb_statutory_holiday_saved', {
        detail: { year: statYear, month: statMonth, entries: statEntries }
      }));

      toast.success(`Statutory holiday values saved and applied to payslips for ${statMonth}/${statYear}!`);
    } catch {
      toast.error('Failed to save statutory holiday entries');
    } finally {
      setIsSavingStat(false);
    }
  }

  // Export to Excel
  function exportStatutoryExcel() {
    const list = Object.values(statEntries);
    if (list.length === 0) {
      toast.error('No employee records to export');
      return;
    }
    const exportData = list.map(e => ({
      'EPF No': e.epfNo,
      'Employee Name': e.employeeName,
      'Plant': e.plantCode || '—',
      'Section': e.sectionCode || '—',
      'Statutory Holiday Eligible': e.eligible ? 'Yes' : 'No',
      'Worked on Holiday?': e.workedOnHoliday ? 'Worked' : 'Not worked',
      'Day Value (LKR)': e.dayValue,
      'Holiday Value (LKR)': e.holidayValue
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Statutory ${statMonth}-${statYear}`);
    XLSX.writeFile(wb, `statutory-holidays-${statYear}-${statMonth}.xlsx`);
    toast.success('Statutory holiday spreadsheet exported!');
  }

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
      const plantObj = customerList.find(c => c.code === effectivePlant || c.name === effectivePlant);
      const mealRate = emp.mealValue != null ? Number(emp.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200);
      const mealType = emp.mealType || 'Standard';
      const noOfMeals = form.noOfMeal ?? 1;
      setForm(prev => ({
        ...prev,
        epfNo: epf,
        plantCode: effectivePlant,
        businessCenter: emp.businessCenter || prev.businessCenter || localStorage.getItem('hsb_active_bc') || '',
        basicSalary: autoSalary,
        dayAllowance: emp.dayAllowance || 0,
        nightAllowance: isNight ? (emp.nightAllowance || 0) : 0,
        mealType,
        totalMealValue: noOfMeals * mealRate
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

  // Live computed hours with plant shift timing logic
  const liveComputed = useMemo(() => {
    const currentPlant = customerList.find(c => c.code === form.plantCode || c.name === form.plantCode);
    return computePlantHours(form.timeIn || '', form.timeOut || '', currentPlant, form.plantCode);
  }, [form.timeIn, form.timeOut, form.plantCode, customerList]);

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
    { key: 'workday', label: 'Workday' },
    { key: 'totalHours', label: 'Total Hours', className: 'mono-numeric' },
    { key: 'otHours', label: 'OT' },
    { key: 'meals', label: 'Meals', className: 'mono-numeric' },
    { key: 'id', label: 'Actions' }
  ]

  // Table Data mapping
  const tableData = filtered.map(r => {
    const emp = employeeList.find(e => e.epfNo === r.epfNo)
    const empName = r.employeeName || (emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : 'Unknown')

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
    const otVal = Number(r.totalOt) || 0
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
      workday: (r.workingDays === 0.5 || r.halfDay === 1 || r.halfDay === 0.5) ? (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          0.5 - Half Day
        </span>
      ) : (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          1 - Full Day
        </span>
      ),
      totalHours: (Number(r.totalWorkingHours) || 0).toFixed(1),
      otHours: otNode,
      meals: r.noOfMeal || 0,
      id: r.id
    }
  })

  // Filtered and calculated statutory holiday rows
  const statList = useMemo(() => {
    return Object.values(statEntries).filter(e => {
      if (statPlantFilter !== 'ALL' && e.plantCode !== statPlantFilter) {
        return false
      }
      if (statFilterStatus === 'ELIGIBLE' && !e.eligible) return false
      if (statFilterStatus === 'NOT_ELIGIBLE' && e.eligible) return false
      if (statFilterStatus === 'WORKED' && !e.workedOnHoliday) return false
      if (statFilterStatus === 'NOT_WORKED' && e.workedOnHoliday) return false
      if (statSearch.trim()) {
        const query = statSearch.toLowerCase()
        const match = (e.epfNo || '').toLowerCase().includes(query) || (e.employeeName || '').toLowerCase().includes(query)
        if (!match) return false
      }
      return true
    })
  }, [statEntries, statPlantFilter, statFilterStatus, statSearch])

  const statMetrics = useMemo(() => {
    const all = Object.values(statEntries)
    const totalEmployees = all.length
    const eligibleCount = all.filter(e => e.eligible).length
    const workedCount = all.filter(e => e.eligible && e.workedOnHoliday).length
    const notWorkedCount = all.filter(e => e.eligible && !e.workedOnHoliday).length
    const totalAmount = all.reduce((sum, e) => sum + (e.holidayValue || 0), 0)
    return {
      totalEmployees,
      eligibleCount,
      workedCount,
      notWorkedCount,
      totalAmount
    }
  }, [statEntries])

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
            disabled={isSavingDb}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold btn-press shadow-xs disabled:opacity-50"
            onClick={handleSaveAllToDb}
            title="Save manual and staged rows to SQL Server database"
          >
            <Database size={14} />
            <span>{isSavingDb ? 'Saving to DB...' : 'Save to Database'}</span>
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

      {/* Offline / Local Storage Badge & Alerts */}
      {saveError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span className="font-semibold">Save Error:</span>
          <span>Not saved to the database: {saveError}</span>
        </div>
      )}

      {saveSummaries.length > 0 && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 flex items-center gap-1">
              <Database size={14} /> Database Upsert Summary:
            </span>
            <button
              onClick={() => setSaveSummaries([])}
              className="text-emerald-700 hover:text-emerald-900 text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
          {saveSummaries.map((msg, i) => (
            <div key={i} className="text-emerald-800 font-mono text-[11px]">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Tabs: Daily Logs vs Saved Records vs Statutory Holidays */}
      <div className="flex items-center border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-[#2F6F5E] text-[#2F6F5E]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Daily Attendance Logs ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('savedRecords')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'savedRecords'
              ? 'border-[#2F6F5E] text-[#2F6F5E]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database size={13} />
          <span>Saved Records (Month & Plant Wise)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
            {savedRecordsGroups.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('statutoryHolidays')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'statutoryHolidays'
              ? 'border-[#2F6F5E] text-[#2F6F5E]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={13} />
          <span>Statutory Holidays</span>
          {statMonthConfig?.hasHoliday && Array.isArray(statMonthConfig?.holidayDates) && statMonthConfig.holidayDates.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
              {statMonthConfig.holidayDates.length} date{statMonthConfig.holidayDates.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
      </div>

      {/* View Mode Content */}
      {activeTab === 'savedRecords' ? (
        <div className="space-y-4">
          {/* Filters for Saved Records */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-flat flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <Filter size={14} className="text-[#2F6F5E]" />
              <span>Filters:</span>
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-600 font-medium">Year:</label>
              <select
                value={savedRecordsYear}
                onChange={e => setSavedRecordsYear(e.target.value)}
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
                value={savedRecordsMonth}
                onChange={e => setSavedRecordsMonth(e.target.value)}
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

            {/* Plant Filter */}
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-600 font-medium">Plant:</label>
              <select
                value={savedRecordsPlant}
                onChange={e => setSavedRecordsPlant(e.target.value)}
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

            {(savedRecordsYear !== 'ALL' || savedRecordsMonth !== 'ALL' || savedRecordsPlant !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSavedRecordsYear('ALL')
                  setSavedRecordsMonth('ALL')
                  setSavedRecordsPlant('ALL')
                }}
                className="text-xs text-teal-700 hover:text-teal-900 underline font-medium ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Grouped Records Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-flat overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Database size={15} className="text-[#2F6F5E]" />
                <span>Saved Attendance Records by Plant and Month ({savedRecordsGroups.length} Groups)</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Click "Open Rows" to view and edit individual attendance logs for that plant and month.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3">Plant (Customer)</th>
                    <th className="p-3">Payroll Period</th>
                    <th className="p-3 text-center">Employees</th>
                    <th className="p-3 text-center">Total Days</th>
                    <th className="p-3 text-center">Total OT (Hours)</th>
                    <th className="p-3">Last Saved Time</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedRecordsGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No saved attendance records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    savedRecordsGroups.map(group => (
                      <tr
                        key={group.key}
                        onClick={() => handleOpenGroupRows(group)}
                        className="hover:bg-emerald-50/60 transition-colors cursor-pointer group"
                        title="Click to view and edit attendance records for this plant and month"
                      >
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 group-hover:text-[#2F6F5E] transition-colors">
                            <span className="font-mono text-[#2F6F5E] mr-1">{group.plantCode}</span>
                            <span>- {group.plantName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-medium text-slate-700">
                          {group.year} / {group.month}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {group.employees.size} employees
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-slate-800">
                          {group.totalDays}
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-[#C08A2E]">
                          {group.totalOt.toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-slate-500 text-[11px] font-mono">
                          {group.lastSaved}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGroupRows(group);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#2F6F5E] hover:bg-[#25584a] text-white rounded text-xs font-semibold transition shadow-2xs"
                          >
                            <span>Open Rows</span>
                            <ArrowRightLeft size={11} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'statutoryHolidays' ? (
        <div className="space-y-4">
          {/* Top Control Bar: Month, Year, and Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold uppercase tracking-wider">
                <CalendarDays size={16} className="text-[#2F6F5E]" />
                <span>Select Period:</span>
              </div>

              {/* Year Select */}
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-600 font-medium">Year:</label>
                <select
                  value={statYear}
                  onChange={e => setStatYear(e.target.value)}
                  className="form-input text-xs py-1 px-2.5 h-8 font-semibold"
                >
                  {['2024', '2025', '2026', '2027', '2028'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month Select */}
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-600 font-medium">Month:</label>
                <select
                  value={statMonth}
                  onChange={e => setStatMonth(e.target.value)}
                  className="form-input text-xs py-1 px-2.5 h-8 font-semibold"
                >
                  {[
                    { val: '01', name: '01 - January' },
                    { val: '02', name: '02 - February' },
                    { val: '03', name: '03 - March' },
                    { val: '04', name: '04 - April' },
                    { val: '05', name: '05 - May' },
                    { val: '06', name: '06 - June' },
                    { val: '07', name: '07 - July' },
                    { val: '08', name: '08 - August' },
                    { val: '09', name: '09 - September' },
                    { val: '10', name: '10 - October' },
                    { val: '11', name: '11 - November' },
                    { val: '12', name: '12 - December' },
                  ].map(m => (
                    <option key={m.val} value={m.val}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportStatutoryExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                title="Export current table to Excel"
              >
                <FileSpreadsheet size={14} className="text-emerald-700" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleSaveStatutoryHolidays}
                disabled={isSavingStat}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2F6F5E] hover:bg-[#25584a] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSavingStat ? 'Saving to Payslips...' : 'Save & Apply to Payslip'}</span>
              </button>
            </div>
          </div>

          {/* Step 1: Statutory Holiday in this Month? */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Step 1</span>
                <h3 className="text-sm font-bold text-slate-800">Statutory holiday in this month?</h3>
                <p className="text-xs text-slate-500">
                  Specify whether a statutory holiday occurs in {statMonth}/{statYear}.
                </p>
              </div>

              {/* Yes / No Toggle buttons */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleToggleStatHoliday(true)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                    statMonthConfig.hasHoliday
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✓ Yes (Holiday in Month)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatHoliday(false)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                    !statMonthConfig.hasHoliday
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✕ No (No Holiday)
                </button>
              </div>
            </div>

            {/* If Yes: Add holiday date(s) */}
            {statMonthConfig.hasHoliday ? (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-end gap-3 bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Holiday Date:
                    </label>
                    <input
                      type="date"
                      value={statNewDate}
                      onChange={e => setStatNewDate(e.target.value)}
                      className="form-input text-xs py-1 px-2.5 h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Holiday Name / Description (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Full Moon Poya Day / Deepavali"
                      value={statNewName}
                      onChange={e => setStatNewName(e.target.value)}
                      className="form-input text-xs py-1 px-2.5 h-8 bg-white min-w-[240px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStatDate}
                    className="flex items-center gap-1 bg-[#2F6F5E] hover:bg-[#25584a] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs h-8"
                  >
                    + Add Date
                  </button>
                </div>

                {/* Display added dates */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Configured Holiday Date(s):</span>
                  {(!Array.isArray(statMonthConfig?.holidayDates) || statMonthConfig.holidayDates.length === 0) ? (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ⚠️ No dates added yet. Please add a date above to check attendance automatically.
                    </span>
                  ) : (
                    (statMonthConfig.holidayDates || []).map(date => (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-200"
                      >
                        <Calendar size={12} className="text-emerald-700" />
                        <span className="font-semibold">{date}</span>
                        {statMonthConfig.holidayName && (
                          <span className="text-[11px] text-emerald-800">({statMonthConfig.holidayName})</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveStatDate(date)}
                          className="hover:bg-emerald-200 rounded-full p-0.5 text-emerald-700 hover:text-emerald-950 transition-colors"
                          title="Remove date"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                <Info size={15} className="text-slate-400 shrink-0" />
                <span>
                  No statutory holiday for this month. All employees will have a statutory holiday value of <strong>Rs. 0</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Admin Rates Policy Overview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Step 2</span>
                <h3 className="text-sm font-bold text-slate-800">Statutory Holiday Pay Policy Rates</h3>
                <p className="text-xs text-slate-500">
                  Configured in Admin Settings. You can also adjust rates directly below for live recalculation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Worked Rate Card */}
              <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Worked Rate (Eligible & Worked)</span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {statSettings.workedRateType === 'multiplier'
                      ? `${statSettings.workedRateValue}x Day Rate`
                      : `Fixed Rs. ${statSettings.workedRateValue.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statSettings.workedRateType}
                    onChange={e => handleUpdateStatSetting('workedRateType', e.target.value as 'fixed' | 'multiplier')}
                    className="form-input text-xs py-1 px-2 h-7 bg-white"
                  >
                    <option value="multiplier">Multiplier of Day Rate</option>
                    <option value="fixed">Fixed Amount (LKR)</option>
                  </select>
                  <NumericInput
                    value={statSettings.workedRateValue}
                    onChange={e => handleUpdateStatSetting('workedRateValue', Number(e.target.value) || 0)}
                    className="form-input text-xs py-1 px-2 h-7 w-24 bg-white font-mono"
                  />
                  <span className="text-xs text-slate-500">
                    {statSettings.workedRateType === 'multiplier' ? 'x' : 'LKR'}
                  </span>
                </div>
              </div>

              {/* Not Worked Rate Card */}
              <div className="p-3 bg-amber-50/40 rounded-lg border border-amber-100 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">Not Worked Rate (Eligible & Not Worked)</span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    {statSettings.notWorkedRateType === 'multiplier'
                      ? `${statSettings.notWorkedRateValue}x Day Rate`
                      : `Fixed Rs. ${statSettings.notWorkedRateValue.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statSettings.notWorkedRateType}
                    onChange={e => handleUpdateStatSetting('notWorkedRateType', e.target.value as 'fixed' | 'multiplier')}
                    className="form-input text-xs py-1 px-2 h-7 bg-white"
                  >
                    <option value="multiplier">Multiplier of Day Rate</option>
                    <option value="fixed">Fixed Amount (LKR)</option>
                  </select>
                  <NumericInput
                    value={statSettings.notWorkedRateValue}
                    onChange={e => handleUpdateStatSetting('notWorkedRateValue', Number(e.target.value) || 0)}
                    className="form-input text-xs py-1 px-2 h-7 w-24 bg-white font-mono"
                  />
                  <span className="text-xs text-slate-500">
                    {statSettings.notWorkedRateType === 'multiplier' ? 'x' : 'LKR'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Employee Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-flat overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Step 3</span>
                  <h3 className="text-sm font-bold text-slate-800">
                    Employee Statutory Holiday Table ({statList.length} of {statMetrics.totalEmployees})
                  </h3>
                  <p className="text-xs text-slate-500">
                    "Worked on holiday?" is auto-filled from attendance. Admin can edit Day Value and eligibility.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveStatutoryHolidays}
                    disabled={isSavingStat}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2F6F5E] hover:bg-[#25584a] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{isSavingStat ? 'Saving...' : 'Save to Payslip'}</span>
                  </button>
                </div>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Total Employees</div>
                  <div className="text-base font-bold text-slate-800 font-mono">{statMetrics.totalEmployees}</div>
                </div>
                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                  <div className="text-[11px] text-emerald-700">Eligible Employees</div>
                  <div className="text-base font-bold text-emerald-800 font-mono">{statMetrics.eligibleCount}</div>
                </div>
                <div className="p-2.5 bg-teal-50/60 rounded-lg border border-teal-200">
                  <div className="text-[11px] text-teal-700">Worked on Holiday</div>
                  <div className="text-base font-bold text-teal-800 font-mono">{statMetrics.workedCount}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Total Payout</div>
                  <div className="text-base font-bold text-[#2F6F5E] font-mono">
                    Rs. {statMetrics.totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Search & Filter row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SearchInput
                  value={statSearch}
                  onChange={setStatSearch}
                  placeholder="Search employee or EPF..."
                />

                <select
                  value={statPlantFilter}
                  onChange={e => setStatPlantFilter(e.target.value)}
                  className="form-input text-xs py-1 px-2.5 h-8 max-w-[160px]"
                >
                  <option value="ALL">All Plants</option>
                  {customerList.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>

                {/* Filter chips */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setStatFilterStatus('ALL')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      statFilterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatFilterStatus('WORKED')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      statFilterStatus === 'WORKED' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Worked
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatFilterStatus('NOT_WORKED')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      statFilterStatus === 'NOT_WORKED' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Not Worked
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatFilterStatus('ELIGIBLE')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      statFilterStatus === 'ELIGIBLE' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Eligible
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatFilterStatus('NOT_ELIGIBLE')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      statFilterStatus === 'NOT_ELIGIBLE' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ineligible
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3 text-center">Eligible (tick)</th>
                    <th className="py-2.5 px-3 text-center">Worked on holiday?</th>
                    <th className="py-2.5 px-3 text-right">Day Value (LKR)</th>
                    <th className="py-2.5 px-3 text-right">Holiday Value (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    statList.map(entry => (
                      <tr key={entry.epfNo} className="hover:bg-slate-50/70 transition-colors">
                        {/* Employee */}
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">
                            {entry.employeeName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500">
                              EPF: {entry.epfNo}
                            </span>
                            {entry.plantCode && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                                {entry.plantCode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Eligible tick */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleStatEligibilityToggle(entry.epfNo)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              entry.eligible
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="Click to toggle eligibility"
                          >
                            {entry.eligible ? (
                              <>
                                <CheckSquare size={13} className="text-emerald-700" />
                                <span>Yes</span>
                              </>
                            ) : (
                              <>
                                <Square size={13} className="text-slate-400" />
                                <span>No</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Worked on holiday? */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleStatWorkedToggle(entry.epfNo)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              entry.workedOnHoliday
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                            title="Auto-filled from attendance logs. Click to override."
                          >
                            {entry.workedOnHoliday ? (
                              <>
                                <Check size={13} className="text-emerald-700" />
                                <span>Worked</span>
                              </>
                            ) : (
                              <>
                                <span className="font-bold">—</span>
                                <span>Not worked</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Day Value (editable) */}
                        <td className="py-2 px-3 text-right">
                          <NumericInput
                            value={entry.dayValue}
                            onChange={e => handleStatDayValueChange(entry.epfNo, Number(e.target.value) || 0)}
                            className="form-input text-xs py-1 px-2 w-28 text-right font-mono bg-white border-slate-300 focus:border-[#2F6F5E]"
                          />
                        </td>

                        {/* Holiday Value */}
                        <td className="py-2 px-3 text-right">
                          <div className={`font-mono font-bold text-sm ${
                            !entry.eligible || entry.holidayValue === 0
                              ? 'text-slate-400'
                              : 'text-[#2F6F5E]'
                          }`}>
                            {entry.holidayValue.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {!entry.eligible
                              ? 'Ineligible (0)'
                              : entry.workedOnHoliday
                              ? 'Worked Rate'
                              : 'Not Worked Rate'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Bar inside Step 3 */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-600">
                Showing {statList.length} of {statMetrics.totalEmployees} employees.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportStatutoryExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                >
                  <FileSpreadsheet size={14} className="text-emerald-700" />
                  <span>Export Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatutoryHolidays}
                  disabled={isSavingStat}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2F6F5E] hover:bg-[#25584a] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSavingStat ? 'Saving...' : 'Save & Apply to Payslip'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
                      Current Plant: {form.plantCode || 'Not Set'}
                    </span>
                  )}
                </div>
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
                  {customerList.filter(c => !relevantPlants.some(rp => rp.code === c.code)).length > 0 && (
                    <optgroup label="── All Other Plants ──">
                      {customerList
                        .filter(c => !relevantPlants.some(rp => rp.code === c.code))
                        .map(c => (
                          <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {errors.plantCode && <p className="mt-1 text-xs text-red-500">{errors.plantCode}</p>}
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

            {/* Computed read-only StatChips with Plant Shift Rule badge */}
            <div className="flex flex-col gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <div className="flex gap-4 items-center">
                <div>
                  <span className="text-xs text-emerald-800 block font-medium">Total Working Hours</span>
                  <span className="text-lg font-bold font-mono text-emerald-950">{liveComputed.hours.toFixed(1)} hrs</span>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  <span className="text-xs text-emerald-800 block font-medium">Calculated OT</span>
                  <span className={`text-lg font-bold font-mono ${liveComputed.ot > 0 ? 'text-[#C08A2E]' : 'text-emerald-900'}`}>{liveComputed.ot.toFixed(1)} hrs</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-600 bg-white/80 px-2 py-1 rounded border border-emerald-200/60 flex items-center justify-between">
                <span>
                  {liveComputed.countFromShiftStart
                    ? `Plant Shift Start: ${liveComputed.appliedShiftStart} (counted from ${liveComputed.startTimeStr})`
                    : `Actual arrival: ${liveComputed.startTimeStr}`}
                  {liveComputed.capped ? ` (capped at ${liveComputed.maxHoursCap} hrs)` : ''}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">Plant Rule</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-slate-600">No of Meals</label>
                <NumericInput
                  integer
                  value={form.noOfMeal || 0}
                  onChange={e => {
                    const count = Number(e.target.value || 0);
                    const emp = employeeList.find(em => (em.epfNo || '').trim().toLowerCase() === (form.epfNo || '').trim().toLowerCase());
                    const plantObj = customerList.find(c => c.code === form.plantCode || c.name === form.plantCode);
                    const rate = emp?.mealValue != null ? Number(emp.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200);
                    setForm(prev => ({
                      ...prev,
                      noOfMeal: count,
                      totalMealValue: count * rate
                    }));
                  }}
                  className="mt-1 w-full form-input text-right mono-numeric"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Meal Type</label>
                <select
                  value={form.mealType || 'Standard'}
                  onChange={e => setForm({ ...form, mealType: e.target.value })}
                  className="mt-1 w-full form-input text-xs"
                >
                  <option value="Standard">Standard</option>
                  <option value="Staff Meal">Staff Meal</option>
                  <option value="Subsidized">Subsidized</option>
                  <option value="Special">Special</option>
                  <option value="Free Meal">Free Meal</option>
                </select>
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

              <button
                type="button"
                onClick={handleAddNewUploadRow}
                className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium flex items-center gap-1 shadow-2xs"
              >
                + Add Entry
              </button>

              <button type="button" className="px-2.5 py-1 text-xs border rounded hover:bg-slate-50 font-medium" onClick={exportUploadRows}>
                Export Excel
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

          {/* Plant Shift Logic Info Banner */}
          <div className="mx-4 my-2.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Plant Shift Logic:
            </span>
            <span>
              <strong>Plant A</strong> (shift starts at 7:30): Hours count from max(ClockIn, 07:30) (e.g. 06:00 to 16:00 = 8.5 hrs).
            </span>
            <span>
              <strong>Plant B</strong> (actual arrival): Hours count from ClockIn, capped up to 9 hrs (e.g. 06:00 to 16:00 = 9 hrs capped).
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="min-w-[1600px] w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600 sticky top-0 z-10 border-b">
                <tr>
                  <th className="px-2 py-2">Validation Status</th>
                  <th className="px-2 py-2">EPF / Employee *</th>
                  <th className="px-2 py-2">Employee Name</th>
                  <th className="px-2 py-2">Plant Code *</th>
                  <th className="px-2 py-2">Section Code</th>
                  <th className="px-2 py-2">Day In</th>
                  <th className="px-2 py-2">Day Out</th>
                  <th className="px-2 py-2">Time In</th>
                  <th className="px-2 py-2">Time Out</th>
                  <th className="px-2 py-2">Workday</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">OT</th>
                  <th className="px-2 py-2">Shift</th>
                  <th className="px-2 py-2">Meals</th>
                  <th className="px-2 py-2">Meal Type</th>
                  <th className="px-2 py-2">Meal Value</th>
                  <th className="px-2 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploadRows.map((row, index) => {
                  const val = validateUploadRow(row, uploadRows, rows, employeeList);
                  const matchedEmp = employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase());
                  const empDisplayName = row.employeeName || (matchedEmp ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim() : '-');
                  const plantObj = customerList.find(c => c.code === row.plantCode || c.name === row.plantCode);

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
                        <div className="flex flex-col gap-1">
                          <select
                            value={row.epfNo || ''}
                            onChange={e => {
                              const newEpf = e.target.value;
                              const clean = newEpf.trim().toLowerCase();
                              const matched = clean ? employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === clean) : undefined;
                              if (matched) {
                                const autoPlant = (matched.plantCode ? matched.plantCode.split(' ')[0].trim() : '') || row.plantCode || uploadDefaultPlant || (customerList[0]?.code || '');
                                const targetPlantObj = customerList.find(c => c.code === autoPlant || c.name === autoPlant);
                                const autoSection = matched.sectionCode || row.sectionCode || uploadDefaultSection || (sectionList[0]?.code || '');
                                const autoName = `${matched.firstName} ${matched.lastName || ''}`.trim();
                                const autoSalary = resolveEmployeeBasicSalary(matched, sectionList);
                                const mealType = matched.mealType || 'Standard';
                                const mealRate = matched.mealValue != null ? Number(matched.mealValue) : (targetPlantObj?.mealValue != null ? Number(targetPlantObj.mealValue) : 200);
                                const noOfMeals = row.noOfMeal ?? 1;
                                const totalMealVal = noOfMeals * mealRate;
                                const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', targetPlantObj, autoPlant);

                                updateUploadRow(index, {
                                  epfNo: matched.epfNo,
                                  employeeName: autoName,
                                  plantCode: autoPlant,
                                  customerCode: autoPlant,
                                  sectionCode: autoSection,
                                  basicSalary: autoSalary,
                                  dayAllowance: matched.dayAllowance ?? row.dayAllowance ?? 0,
                                  nightAllowance: matched.nightAllowance ?? row.nightAllowance ?? 0,
                                  mealType,
                                  totalMealValue: totalMealVal,
                                  totalWorkingHours: computed.hours,
                                  totalOt: computed.ot
                                });
                              } else {
                                updateUploadRow(index, { epfNo: newEpf });
                              }
                            }}
                            className={`form-input w-36 text-xs font-mono ${val.errors.some(er => er.includes('EPF')) ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : ''}`}
                          >
                            <option value="">Select Employee...</option>
                            {employeeList.map(emp => (
                              <option key={emp.epfNo} value={emp.epfNo}>
                                {emp.epfNo} - {emp.firstName} {emp.lastName || ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-slate-700 truncate block max-w-[120px]" title={empDisplayName}>
                          {empDisplayName}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.plantCode || ''} 
                          onChange={e => {
                            const newPlant = e.target.value;
                            const targetPlantObj = customerList.find(c => c.code === newPlant || c.name === newPlant);
                            const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', targetPlantObj, newPlant);
                            const mealRate = matchedEmp?.mealValue != null ? Number(matchedEmp.mealValue) : (targetPlantObj?.mealValue != null ? Number(targetPlantObj.mealValue) : 200);
                            const noOfMeals = row.noOfMeal ?? 1;

                            updateUploadRow(index, { 
                              plantCode: newPlant, 
                              customerCode: newPlant,
                              totalWorkingHours: computed.hours,
                              totalOt: computed.ot,
                              totalMealValue: noOfMeals * mealRate
                            });
                          }} 
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
                          value={excelDate(row.dayIn) || ''} 
                          onChange={e => updateUploadRow(index, { dayIn: e.target.value, dayOut: row.dayOut || e.target.value })} 
                          className={`form-input w-32 text-xs ${val.errors.some(er => er.includes('Date')) ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="date" 
                          value={excelDate(row.dayOut) || excelDate(row.dayIn) || ''} 
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
                            const computed = computePlantHours(newTimeIn, row.timeOut || '', plantObj, row.plantCode);
                            updateUploadRow(index, { timeIn: newTimeIn, totalWorkingHours: computed.hours, totalOt: computed.ot });
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
                            const computed = computePlantHours(row.timeIn || '', newTimeOut, plantObj, row.plantCode);
                            updateUploadRow(index, { timeOut: newTimeOut, totalWorkingHours: computed.hours, totalOt: computed.ot });
                          }} 
                          className="form-input w-24 text-xs" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.workingDays === 0.5 || row.halfDay === 1 || row.halfDay === 0.5 ? '0.5' : '1'} 
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateUploadRow(index, { 
                              workingDays: val, 
                              halfDay: val === 0.5 ? 0.5 : 0 
                            });
                          }} 
                          className="form-input w-28 text-xs font-medium"
                        >
                          <option value="1">1 - Full Day</option>
                          <option value="0.5">0.5 - Half Day</option>
                        </select>
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
                          value={row.noOfMeal ?? 1} 
                          onChange={e => {
                            const count = Number(e.target.value || 0);
                            const mealRate = matchedEmp?.mealValue != null ? Number(matchedEmp.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200);
                            updateUploadRow(index, { 
                              noOfMeal: count,
                              totalMealValue: count * mealRate 
                            });
                          }} 
                          className="form-input w-14 text-xs text-right" 
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.mealType || 'Standard'}
                          onChange={e => updateUploadRow(index, { mealType: e.target.value })}
                          className="form-input w-28 text-xs"
                        >
                          <option value="Standard">Standard</option>
                          <option value="Staff Meal">Staff Meal</option>
                          <option value="Subsidized">Subsidized</option>
                          <option value="Special">Special</option>
                          <option value="Free Meal">Free Meal</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <NumericInput 
                          value={row.totalMealValue ?? 0} 
                          onChange={e => updateUploadRow(index, { totalMealValue: Number(e.target.value || 0) })} 
                          className="form-input w-20 text-xs text-right mono-numeric" 
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
        </div>
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
