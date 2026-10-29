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
  getMonth as getStatutoryMonth,
  saveHoliday as saveStatutoryHoliday,
  removeHoliday as removeStatutoryHoliday,
  setStatus as setStatutoryStatus,
  StatutoryMonth,
  StatutoryStatus
} from '../../services/statutoryHolidayService'
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
  sundaypoyaextra: 'sundayPoyaExtra', businesscenter: 'businessCenter',
  // Attendance Transaction form fields (plant / employee level)
  year: 'atttYear', month: 'attMonth', employeeid: 'epfNo', empid: 'epfNo', epf: 'epfNo',
  otcalauto: 'otCalAuto', otcalculateauto: 'otCalAuto', otcalcauto: 'otCalAuto', otauto: 'otCalAuto',
  poyasaturdaynormal: 'poyaSaturdayNormal', poyasaturdaynormalrate: 'poyaSaturdayNormal', poyasatnormal: 'poyaSaturdayNormal',
  noofstaff: 'noOfStaff', numberofstaff: 'noOfStaff',
  attallowance: 'attAllowance', attendanceallowance: 'attAllowance',
  dasforattallowance: 'dasForAttAllowance', dasforattalowance: 'dasForAttAllowance',
  daysforattallowance: 'dasForAttAllowance', daysforattendanceallowance: 'dasForAttAllowance',
  lateallowno: 'lateAllowNo', notallowlate: 'lateAllowNo', secondshift2nd: 'secondShift', '2ndshift': 'secondShift',
  // Common header names used in client attendance sheets
  employeeno: 'epfNo', empno: 'epfNo', epfnumber: 'epfNo', employeeepf: 'epfNo', employeecode: 'epfNo',
  employee: 'employeeName', fullname: 'employeeName',
  plant: 'plantCode', customer: 'customerCode', section: 'sectionCode',
  date: 'dayIn', attendancedate: 'dayIn', workdate: 'dayIn', indate: 'dayIn', datein: 'dayIn',
  outdate: 'dayOut', dateout: 'dayOut',
  intime: 'timeIn', checkin: 'timeIn', clockin: 'timeIn', starttime: 'timeIn', in: 'timeIn',
  outtime: 'timeOut', checkout: 'timeOut', clockout: 'timeOut', endtime: 'timeOut', out: 'timeOut',
  workinghours: 'totalWorkingHours', workhours: 'totalWorkingHours', totalworkhours: 'totalWorkingHours', hours: 'totalWorkingHours',
  ot: 'totalOt', othours: 'totalOt', totalothours: 'totalOt', totalothm: 'totalOt',
  numberofmeal: 'noOfMeal', numberofmeals: 'noOfMeal', statutoryholiday: 'statutoryHolidays',
  shift: 'shiftName' as any, daytype: 'dayTypeName' as any
}

const excelYesNoFields = new Set<keyof Attendance>([
  'otCalAuto', 'attAllowance', 'poyaSaturdayNormal', 'lateAllowNo',
  'normalDay', 'saturdayPoya', 'specialDay', 'dayShift', 'secondShift', 'nightShift', 'fullNight'
])

// 'Y' / 'N' from Excel cells such as Y, Yes, 1, True, ✓; blank stays blank so masters can fill it
function excelYN(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return ''
  return ['y', 'yes', '1', 'true', 'x', '✓', '✔'].includes(text) ? 'Y' : 'N'
}

// Plant level fields of the Attendance Transaction form, taken from the Plant master
function plantMasterValues(plant?: any): Partial<Attendance> {
  if (!plant) return {}
  const allowance = plant.attendanceAllowance
  return {
    otCalAuto: plant.otAuto ? 'Y' : 'N',
    noOfStaff: plant.minStaffQty != null ? Number(plant.minStaffQty) : 0,
    attAllowance: allowance != null && allowance !== '' && allowance !== 'N' && Number(allowance) !== 0 ? 'Y' : 'N',
    dasForAttAllowance: plant.daysToWorkForAllowance != null ? Number(plant.daysToWorkForAllowance) : 0
  }
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
  // "Day_In (yyyy-MM-dd)" -> "dayin": hints in brackets are ignored
  const headers = data[0].map(value => String(value ?? '').replace(/\(.*?\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''))
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
      else if ((field as string) === 'shiftName') {
        // "Day" / "2nd" / "Night" / "Full Night" text column
        const text = String(value ?? '').trim().toLowerCase()
        if (!text) return
        const shift = text.includes('full') ? 'fullNight' : text.includes('night') ? 'nightShift' : (text.includes('2') || text.includes('second')) ? 'secondShift' : 'dayShift'
        ;(['dayShift', 'secondShift', 'nightShift', 'fullNight'] as const).forEach(f => { (record as any)[f] = f === shift ? 'Y' : 'N' })
      }
      else if ((field as string) === 'dayTypeName') {
        // "Normal" / "Saturday and Poya" / "Special" text column
        const text = String(value ?? '').trim().toLowerCase()
        if (!text) return
        const type = text.includes('special') ? 'specialDay' : (text.includes('poya') || text.includes('sat')) ? 'saturdayPoya' : 'normalDay'
        ;(['normalDay', 'saturdayPoya', 'specialDay'] as const).forEach(f => { (record as any)[f] = f === type ? 'Y' : 'N' })
      }
      else if (excelYesNoFields.has(field)) {
        const yn = excelYN(value)
        if (yn) (record as any)[field] = yn
      }
      else if (field === 'noOfStaff' || field === 'dasForAttAllowance') {
        const text = String(value ?? '').trim()
        if (text !== '' && Number.isFinite(Number(text))) (record as any)[field] = Number(text)
      }
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
        const text = String(value ?? '').trim()
        if (text === '') return // blank: filled from the Employee / Plant master below
        const number = Number(text.replace(/^0+(?=\d)/, ''))
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
    const plantDefaults = plantMasterValues(plantObj)
    const hasShift = [record.dayShift, record.secondShift, record.nightShift, record.fullNight].includes('Y')
    const hasDayType = [record.normalDay, record.saturdayPoya, record.specialDay].includes('Y')
    const isNightShift = record.nightShift === 'Y' || record.fullNight === 'Y'
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
      nightAllowance: record.nightAllowance ?? (isNightShift ? (matchedEmployee?.nightAllowance ?? 0) : 0),
      // Excel value wins; blanks come from the Plant master
      otCalAuto: record.otCalAuto || plantDefaults.otCalAuto || 'Y',
      noOfStaff: record.noOfStaff ?? plantDefaults.noOfStaff ?? 0,
      attAllowance: record.attAllowance || plantDefaults.attAllowance || 'N',
      dasForAttAllowance: record.dasForAttAllowance ?? plantDefaults.dasForAttAllowance ?? 0,
      poyaSaturdayNormal: record.poyaSaturdayNormal || 'N',
      lateAllowNo: record.lateAllowNo || 'N',
      dayShift: hasShift ? (record.dayShift || 'N') : 'Y',
      secondShift: record.secondShift || 'N',
      nightShift: record.nightShift || 'N',
      fullNight: record.fullNight || 'N',
      normalDay: hasDayType ? (record.normalDay || 'N') : 'Y',
      saturdayPoya: record.saturdayPoya || 'N',
      specialDay: record.specialDay || 'N',
      workingDays: (record.halfDay === 1 || record.halfDay === 0.5) ? 0.5 : (record.workingDays ?? 1),
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

  // View Mode: 'logs' (Daily logs table) or 'savedRecords' (Month & Plant wise summary)
  const [activeTab, setActiveTab] = useState<'logs' | 'savedRecords'>('logs')

  // Statutory holidays of the selected month (stored on the server and used by the payslip)
  const [statYear, setStatYear] = useState<string>(() => String(new Date().getFullYear()))
  const [statMonth, setStatMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [statData, setStatData] = useState<StatutoryMonth | null>(null)
  const [statLoading, setStatLoading] = useState(false)
  const [statHasHoliday, setStatHasHoliday] = useState(false)
  const [statDrafts, setStatDrafts] = useState<Record<string, { holidayName: string; workingValue: string; notWorkingValue: string }>>({})
  const [statNew, setStatNew] = useState({ date: '', holidayName: '', workingValue: '', notWorkingValue: '' })
  const [statSearch, setStatSearch] = useState('')
  const [statShowIneligible, setStatShowIneligible] = useState(false)
  const [statBusy, setStatBusy] = useState(false)
  const [statConfirm, setStatConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null)
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
  const [collapsedPlants, setCollapsedPlants] = useState<Set<string>>(new Set())
  // Statutory holiday dates for every month present in the staged Excel rows
  const [stagedHolidayDates, setStagedHolidayDates] = useState<Set<string>>(new Set())

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

  // Plant level fields (Attendance Transaction header) apply to every staged row of that plant
  function updatePlantRows(plantCode: string, patch: Partial<Attendance>) {
    setUploadRows(previous => previous.map(row => (row.plantCode || '') === plantCode ? { ...row, ...patch } : row))
  }

  function movePlantRows(fromPlant: string, toPlant: string) {
    const target = customerList.find(c => c.code === toPlant)
    setUploadRows(previous => previous.map(row => {
      if ((row.plantCode || '') !== fromPlant) return row
      const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', target, toPlant)
      return { ...row, ...plantMasterValues(target), plantCode: toPlant, customerCode: toPlant, totalWorkingHours: computed.hours, totalOt: computed.ot }
    }))
  }

  // Employee picked on a staged row: Excel-only values are replaced by the Employee master
  function handleStagedEmployeeChange(index: number, row: Attendance, newEpf: string) {
    const clean = newEpf.trim().toLowerCase()
    const matched = clean ? employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === clean) : undefined
    if (!matched) {
      updateUploadRow(index, { epfNo: newEpf })
      return
    }
    const plantCode = row.plantCode || (matched.plantCode ? matched.plantCode.split(' ')[0].trim() : '') || uploadDefaultPlant || (customerList[0]?.code || '')
    const plantObj = customerList.find(c => c.code === plantCode || c.name === plantCode)
    const mealRate = matched.mealValue != null ? Number(matched.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
    const isNight = row.nightShift === 'Y' || row.fullNight === 'Y'
    const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', plantObj, plantCode)
    updateUploadRow(index, {
      epfNo: matched.epfNo,
      employeeName: `${matched.firstName} ${matched.lastName || ''}`.trim(),
      plantCode,
      customerCode: plantCode,
      sectionCode: matched.sectionCode || row.sectionCode || uploadDefaultSection || (sectionList[0]?.code || ''),
      basicSalary: resolveEmployeeBasicSalary(matched, sectionList),
      dayAllowance: matched.dayAllowance ?? 0,
      nightAllowance: isNight ? (matched.nightAllowance ?? 0) : 0,
      mealType: matched.mealType || 'Standard',
      totalMealValue: (row.noOfMeal ?? 1) * mealRate,
      totalWorkingHours: computed.hours,
      totalOt: computed.ot
    })
  }

  function handleStagedShiftChange(index: number, row: Attendance, shift: string) {
    const matched = employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase())
    const isNight = shift === 'Night' || shift === 'Full Night'
    updateUploadRow(index, {
      dayShift: shift === 'Day' ? 'Y' : 'N',
      secondShift: shift === '2nd' ? 'Y' : 'N',
      nightShift: shift === 'Night' ? 'Y' : 'N',
      fullNight: shift === 'Full Night' ? 'Y' : 'N',
      nightAllowance: isNight ? (row.nightAllowance || matched?.nightAllowance || 0) : 0
    })
  }

  const stagedValidation = useMemo(
    () => uploadRows.map(r => validateUploadRow(r, uploadRows, rows, employeeList)),
    [uploadRows, rows, employeeList]
  )

  const stagedByPlant = useMemo(() => {
    const groups = new Map<string, Array<{ row: Attendance; index: number }>>()
    uploadRows.forEach((row, index) => {
      const code = row.plantCode || ''
      if (!groups.has(code)) groups.set(code, [])
      groups.get(code)!.push({ row, index })
    })
    return Array.from(groups.entries())
      .map(([plantCode, items]) => ({
        plantCode,
        items: items.sort((a, b) =>
          (a.row.epfNo || '').localeCompare(b.row.epfNo || '') || String(a.row.dayIn || '').localeCompare(String(b.row.dayIn || ''))
        )
      }))
      .sort((a, b) => a.plantCode.localeCompare(b.plantCode))
  }, [uploadRows])

  // Saves staged rows; with plantCode only that plant's rows are saved and the other plants stay staged
  async function handleBulkSaveValidated(plantCode?: string) {
    if (!uploadRows.length) {
      toast.error('Upload an attendance file first.')
      return
    }
    const scopeRows = plantCode === undefined ? uploadRows : uploadRows.filter(r => (r.plantCode || '') === plantCode)
    const otherRows = plantCode === undefined ? [] : uploadRows.filter(r => (r.plantCode || '') !== plantCode)
    if (!scopeRows.length) {
      toast.error('No staged rows for this plant.')
      return
    }
    const validated = scopeRows.map(r => ({
      row: r,
      val: validateUploadRow(r, uploadRows, rows, employeeList)
    }))
    const validRows = validated.filter(v => v.val.isValid).map(v => v.row)
    const invalidRows = validated.filter(v => !v.val.isValid).map(v => v.row)
    const invalidCount = invalidRows.length

    if (validRows.length === 0) {
      toast.error(`All ${scopeRows.length} rows have validation issues. Please correct them before saving.`)
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
        sectionCode: autoSection,
        // Ticked from the statutory holiday calendar (payroll itself reads the calendar)
        statutoryHolidays: stagedHolidayDates.has(cleanDayIn) ? 1 : 0
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

      setUploadRows([...otherRows, ...invalidRows])
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
        OT_Cal_Auto: record.otCalAuto || 'N',
        Poya_Saturday_normal: record.poyaSaturdayNormal || 'N',
        No_Of_Staff: record.noOfStaff ?? 0,
        Att_Allowance: record.attAllowance || 'N',
        Das_for_Att_Alowance: record.dasForAttAllowance ?? 0,
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
        Late_Allow_No: record.lateAllowNo || 'N',
        Statutory_holidays: stagedHolidayDates.has(excelDate(record.dayIn)) ? 1 : 0,
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

  // Keep the statutory holiday period in step with the Year / Month log filters
  useEffect(() => {
    if (filterYear !== 'ALL') setStatYear(filterYear)
    if (filterMonth !== 'ALL') setStatMonth(filterMonth)
  }, [filterYear, filterMonth])

  async function loadStatutory() {
    setStatLoading(true)
    try {
      const data = await getStatutoryMonth(statYear, statMonth, localStorage.getItem('hsb_active_bc') || '')
      setStatData(data)
      setStatHasHoliday(prev => data.holidays.length > 0 || (prev && statData?.year === data.year && statData?.month === data.month))
      setStatDrafts(Object.fromEntries(data.holidays.map(h => [h.holidayDate, {
        holidayName: h.holidayName || '',
        workingValue: String(Number(h.workingValue) || 0),
        notWorkingValue: String(Number(h.notWorkingValue) || 0)
      }])))
    } catch (err) {
      console.error('Failed to load statutory holidays', err)
      setStatData(null)
      toast.error('Could not load statutory holidays from the server')
    } finally {
      setStatLoading(false)
    }
  }

  const stagedPeriodsKey = useMemo(() => {
    const periods = new Set(uploadRows.map(r => excelDate(r.dayIn).slice(0, 7)).filter(p => /^\d{4}-\d{2}$/.test(p)))
    return Array.from(periods).sort().join(',')
  }, [uploadRows])

  useEffect(() => {
    if (!stagedPeriodsKey) {
      setStagedHolidayDates(new Set())
      return
    }
    let cancelled = false
    const bc = localStorage.getItem('hsb_active_bc') || ''
    Promise.all(stagedPeriodsKey.split(',').map(p =>
      getStatutoryMonth(p.slice(0, 4), p.slice(5, 7), bc).catch(() => null)
    )).then(months => {
      if (cancelled) return
      setStagedHolidayDates(new Set(months.flatMap(m => m ? m.holidays.map(h => h.holidayDate) : [])))
    })
    return () => { cancelled = true }
  }, [stagedPeriodsKey, statData])

  // Reload when the period changes or attendance is re-fetched (Working status is read from attendance)
  useEffect(() => {
    loadStatutory()
  }, [statYear, statMonth, rows])

  function parseStatValue(label: string, raw: string): number | null {
    const value = raw.trim() === '' ? 0 : Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      toast.error(`${label} must be a positive number`)
      return null
    }
    return Math.round(value * 100) / 100
  }

  async function runStat(action: () => Promise<void>, failMessage: string) {
    setStatBusy(true)
    try {
      await action()
      await loadStatutory()
    } catch (err: any) {
      console.error(failMessage, err)
      const detail = typeof err?.response?.data === 'string' ? `: ${err.response.data}` : ''
      toast.error(`${failMessage}${detail}`)
    } finally {
      setStatBusy(false)
    }
  }

  // "Statutory holiday in this month?" Yes / No
  function handleStatToggle(hasHoliday: boolean) {
    const existing = statData?.holidays || []
    if (hasHoliday || existing.length === 0) {
      setStatHasHoliday(hasHoliday)
      return
    }
    setStatConfirm({
      title: 'Remove Statutory Holidays',
      message: `Remove all ${existing.length} statutory holiday date(s) for ${statMonth}/${statYear}? Statutory holiday pay for this month will be Rs. 0.`,
      action: () => runStat(async () => {
        for (const h of existing) await removeStatutoryHoliday(h.holidayDate)
        setStatHasHoliday(false)
        toast.success(`Statutory holidays removed for ${statMonth}/${statYear}`)
      }, 'Failed to remove statutory holidays')
    })
  }

  function handleAddStatHoliday() {
    const date = statNew.date
    if (!date) {
      toast.error('Please select the holiday date')
      return
    }
    if (!date.startsWith(`${statYear}-${statMonth}-`)) {
      toast.error(`The holiday date must be in ${statMonth}/${statYear}`)
      return
    }
    if (statData?.holidays.some(h => h.holidayDate === date)) {
      toast.error('This date is already a statutory holiday')
      return
    }
    const notWorkingValue = parseStatValue('Not Working Value', statNew.notWorkingValue)
    const workingValue = parseStatValue('Working Value', statNew.workingValue)
    if (notWorkingValue === null || workingValue === null) return

    runStat(async () => {
      await saveStatutoryHoliday({ holidayDate: date, holidayName: statNew.holidayName, workingValue, notWorkingValue })
      // Keep the values for the next holiday; most months use the same amounts
      setStatNew(prev => ({ ...prev, date: '', holidayName: '' }))
      toast.success(`Statutory holiday ${date} added`)
    }, 'Failed to add statutory holiday')
  }

  function handleSaveStatHoliday(date: string) {
    const draft = statDrafts[date]
    if (!draft) return
    const notWorkingValue = parseStatValue('Not Working Value', draft.notWorkingValue)
    const workingValue = parseStatValue('Working Value', draft.workingValue)
    if (notWorkingValue === null || workingValue === null) return

    runStat(async () => {
      await saveStatutoryHoliday({ holidayDate: date, holidayName: draft.holidayName, workingValue, notWorkingValue })
      toast.success(`Statutory holiday ${date} updated`)
    }, 'Failed to update statutory holiday')
  }

  function handleRemoveStatHoliday(date: string) {
    setStatConfirm({
      title: 'Remove Statutory Holiday',
      message: `Remove the statutory holiday on ${date}? Working / Not Working selections for that day will also be removed.`,
      action: () => runStat(async () => {
        await removeStatutoryHoliday(date)
        toast.success(`Statutory holiday ${date} removed`)
      }, 'Failed to remove statutory holiday')
    })
  }

  function handleStatStatusChange(date: string, epfNo: string, status: StatutoryStatus | 'AUTO') {
    runStat(() => setStatutoryStatus(date, epfNo, status), 'Failed to update Working / Not Working')
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

  // Statutory holiday lookups for the logs table and the panel
  const statHolidayMap = useMemo(() => {
    return new Map((statData?.holidays || []).map(h => [h.holidayDate, h]))
  }, [statData])

  const statEmployeeMap = useMemo(() => {
    return new Map((statData?.employees || []).map(e => [(e.epfNo || '').trim().toLowerCase(), e]))
  }, [statData])

  const statEmployeeRows = useMemo(() => {
    const query = statSearch.trim().toLowerCase()
    return (statData?.employees || []).filter(e => {
      if (!statShowIneligible && !e.eligible) return false
      if (!query) return true
      return (e.epfNo || '').toLowerCase().includes(query) || (e.employeeName || '').toLowerCase().includes(query)
    })
  }, [statData, statSearch, statShowIneligible])

  const statTotals = useMemo(() => {
    const all = statData?.employees || []
    const eligible = all.filter(e => e.eligible)
    return {
      employees: all.length,
      eligible: eligible.length,
      workingDays: eligible.reduce((n, e) => n + e.lines.filter(l => l.status === 'W').length, 0),
      total: Math.round(eligible.reduce((sum, e) => sum + (Number(e.total) || 0), 0) * 100) / 100
    }
  }, [statData])

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

    // Statutory holiday label (+ Working / Not Working and value for eligible employees)
    const rowDate = String(r.dayIn || '').slice(0, 10)
    const statHoliday = statHolidayMap.get(rowDate)
    if (statHoliday) {
      const statEmp = statEmployeeMap.get((r.epfNo || '').trim().toLowerCase())
      const statLine = statEmp?.lines.find(l => l.date === rowDate)
      dayTypeNode = (
        <div className="flex flex-col items-start gap-0.5">
          {dayTypeNode}
          <span className="tag-pill bg-amber-50 text-amber-800 border border-amber-200" title={statHoliday.holidayName || 'Statutory Holiday'}>
            Statutory Holiday
          </span>
          {statEmp && (
            statEmp.eligible && statLine ? (
              <span className="text-[10px] text-slate-500">
                {statLine.status === 'W' ? 'Working' : 'Not Working'} · Rs. {Number(statLine.amount).toLocaleString()}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Not eligible</span>
            )
          )}
        </div>
      )
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

      {/* Tabs: Daily Logs vs Saved Records */}
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
      ) : (
        <div className="space-y-4">
          {/* Statutory Holidays of the selected month */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-flat overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <CalendarDays size={16} className="text-[#2F6F5E] mt-0.5" />
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Statutory Holidays</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Eligible employees get the Working or Not Working value for each holiday. The monthly total is paid as Statutory Holiday Pay.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statYear}
                  onChange={e => setStatYear(e.target.value)}
                  className="form-input text-xs py-1 px-2 h-8"
                >
                  {['2024', '2025', '2026', '2027', '2028'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={statMonth}
                  onChange={e => setStatMonth(e.target.value)}
                  className="form-input text-xs py-1 px-2 h-8"
                >
                  {[
                    { val: '01', name: 'Jan' }, { val: '02', name: 'Feb' }, { val: '03', name: 'Mar' },
                    { val: '04', name: 'Apr' }, { val: '05', name: 'May' }, { val: '06', name: 'Jun' },
                    { val: '07', name: 'Jul' }, { val: '08', name: 'Aug' }, { val: '09', name: 'Sep' },
                    { val: '10', name: 'Oct' }, { val: '11', name: 'Nov' }, { val: '12', name: 'Dec' },
                  ].map(m => (
                    <option key={m.val} value={m.val}>{m.val} - {m.name}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-600 font-medium ml-1">Statutory holiday in this month?</span>
                <div className="flex rounded-lg bg-slate-100 p-0.5 border">
                  <button
                    type="button"
                    disabled={statBusy}
                    onClick={() => handleStatToggle(true)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${statHasHoliday ? 'bg-[#2F6F5E] text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={statBusy}
                    onClick={() => handleStatToggle(false)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!statHasHoliday ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {statLoading && !statData ? (
              <div className="px-4 py-3 text-xs text-slate-500">Loading statutory holidays...</div>
            ) : !statHasHoliday ? (
              <div className="px-4 py-3 text-xs text-slate-500">
                No statutory holiday in {statMonth}/{statYear}. Statutory holiday pay for this month is <strong>Rs. 0</strong>.
              </div>
            ) : (
              <div className="p-3.5 space-y-4">
                {/* Holiday dates with their values */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="p-2.5">Holiday Date</th>
                        <th className="p-2.5">Holiday Name</th>
                        <th className="p-2.5">Not Working Value (LKR)</th>
                        <th className="p-2.5">Working Value (LKR)</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(statData?.holidays || []).map(h => {
                        const draft = statDrafts[h.holidayDate] || { holidayName: '', workingValue: '0', notWorkingValue: '0' }
                        const changed = draft.holidayName !== (h.holidayName || '') ||
                          Number(draft.workingValue) !== Number(h.workingValue) ||
                          Number(draft.notWorkingValue) !== Number(h.notWorkingValue)
                        const setDraft = (patch: Partial<typeof draft>) =>
                          setStatDrafts(prev => ({ ...prev, [h.holidayDate]: { ...draft, ...patch } }))
                        return (
                          <tr key={h.holidayDate}>
                            <td className="p-2.5 font-mono font-semibold text-slate-800">{h.holidayDate}</td>
                            <td className="p-2.5">
                              <input value={draft.holidayName} onChange={e => setDraft({ holidayName: e.target.value })} placeholder="e.g. Deepavali" className="form-input text-xs py-1 px-2 h-8 w-full min-w-[140px]" />
                            </td>
                            <td className="p-2.5">
                              <input type="number" min={0} step="0.01" value={draft.notWorkingValue} onChange={e => setDraft({ notWorkingValue: e.target.value })} className="form-input text-xs py-1 px-2 h-8 w-28 mono-numeric" />
                            </td>
                            <td className="p-2.5">
                              <input type="number" min={0} step="0.01" value={draft.workingValue} onChange={e => setDraft({ workingValue: e.target.value })} className="form-input text-xs py-1 px-2 h-8 w-28 mono-numeric" />
                            </td>
                            <td className="p-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={statBusy || !changed}
                                onClick={() => handleSaveStatHoliday(h.holidayDate)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 bg-[#2F6F5E] hover:bg-[#25584a] text-white rounded text-xs font-semibold disabled:opacity-40"
                              >
                                <Save size={12} />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                disabled={statBusy}
                                onClick={() => handleRemoveStatHoliday(h.holidayDate)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded text-xs font-semibold disabled:opacity-40"
                              >
                                <Trash2 size={12} />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="bg-emerald-50/40">
                        <td className="p-2.5">
                          <input
                            type="date"
                            value={statNew.date}
                            min={`${statYear}-${statMonth}-01`}
                            max={`${statYear}-${statMonth}-${String(new Date(Number(statYear), Number(statMonth), 0).getDate()).padStart(2, '0')}`}
                            onChange={e => setStatNew(prev => ({ ...prev, date: e.target.value }))}
                            className="form-input text-xs py-1 px-2 h-8"
                          />
                        </td>
                        <td className="p-2.5">
                          <input value={statNew.holidayName} onChange={e => setStatNew(prev => ({ ...prev, holidayName: e.target.value }))} placeholder="Holiday name (optional)" className="form-input text-xs py-1 px-2 h-8 w-full min-w-[140px]" />
                        </td>
                        <td className="p-2.5">
                          <input type="number" min={0} step="0.01" value={statNew.notWorkingValue} onChange={e => setStatNew(prev => ({ ...prev, notWorkingValue: e.target.value }))} placeholder="1000" className="form-input text-xs py-1 px-2 h-8 w-28 mono-numeric" />
                        </td>
                        <td className="p-2.5">
                          <input type="number" min={0} step="0.01" value={statNew.workingValue} onChange={e => setStatNew(prev => ({ ...prev, workingValue: e.target.value }))} placeholder="2000" className="form-input text-xs py-1 px-2 h-8 w-28 mono-numeric" />
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            disabled={statBusy}
                            onClick={handleAddStatHoliday}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#2F6F5E] hover:bg-[#25584a] text-white rounded text-xs font-semibold disabled:opacity-40"
                          >
                            + Add Holiday
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Employee Working / Not Working per holiday */}
                {(statData?.holidays.length || 0) > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">Eligible: <strong>{statTotals.eligible}</strong> of {statTotals.employees}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">Working days: <strong>{statTotals.workingDays}</strong></span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">Total pay: <strong>Rs. {statTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={statShowIneligible} onChange={e => setStatShowIneligible(e.target.checked)} />
                          <span>Show not eligible</span>
                        </label>
                        <input value={statSearch} onChange={e => setStatSearch(e.target.value)} placeholder="Search employee or EPF..." className="form-input text-xs py-1 px-2 h-8 w-48" />
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white text-slate-600 font-semibold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">Employee</th>
                            {(statData?.holidays || []).map(h => (
                              <th key={h.holidayDate} className="p-2.5">
                                <div className="font-mono">{h.holidayDate}</div>
                                {h.holidayName && <div className="text-[10px] font-normal text-slate-400">{h.holidayName}</div>}
                              </th>
                            ))}
                            <th className="p-2.5 text-right">Statutory Holiday Pay</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {statEmployeeRows.length === 0 ? (
                            <tr>
                              <td colSpan={(statData?.holidays.length || 0) + 2} className="p-6 text-center text-slate-400">
                                No eligible employees found. Tick "Statutory Holiday Eligible" on the employee profile.
                              </td>
                            </tr>
                          ) : statEmployeeRows.map(emp => (
                            <tr key={emp.epfNo} className={emp.eligible ? '' : 'bg-slate-50/70 text-slate-400'}>
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800">{emp.employeeName || emp.epfNo}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  EPF: {emp.epfNo}{emp.plantCode ? ` · ${emp.plantCode}` : ''}
                                  {!emp.eligible && <span className="ml-1.5 px-1 rounded bg-slate-200 text-slate-600 font-sans">Not eligible</span>}
                                </div>
                              </td>
                              {emp.lines.map(line => (
                                <td key={line.date} className="p-2.5">
                                  {emp.eligible ? (
                                    <div className="space-y-0.5">
                                      <select
                                        value={line.source === 'MANUAL' ? line.status : 'AUTO'}
                                        disabled={statBusy}
                                        onChange={e => handleStatStatusChange(line.date, emp.epfNo, e.target.value as StatutoryStatus | 'AUTO')}
                                        className="form-input text-xs py-0.5 px-1.5 h-7"
                                      >
                                        <option value="AUTO">From attendance</option>
                                        <option value="W">Working</option>
                                        <option value="N">Not Working</option>
                                      </select>
                                      <div className="text-[10px]">
                                        <span className={`font-semibold ${line.status === 'W' ? 'text-teal-700' : 'text-amber-700'}`}>
                                          {line.status === 'W' ? 'Working' : 'Not Working'}
                                        </span>
                                        <span className="text-slate-500"> · Rs. {Number(line.amount).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>
                              ))}
                              <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                                Rs. {Number(emp.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                  Uploaded Attendance Preview ({uploadRows.length} rows · {stagedByPlant.length} plant{stagedByPlant.length !== 1 ? 's' : ''})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {stagedValidation.filter(v => v.isValid).length} Valid
                </span>
                {stagedValidation.some(v => !v.isValid) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    {stagedValidation.filter(v => !v.isValid).length} Flagged
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Grouped by plant. Excel values are used first; empty cells are filled from the Employee and Plant masters. Plant fields in each header apply to all rows of that plant.
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
                onClick={() => handleBulkSaveValidated()}
              >
                Save All Plants ({stagedValidation.filter(v => v.isValid).length})
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

          {/* Plant-wise review: plant fields in the card header, employee + day fields per row */}
          <div className="px-4 pb-4 space-y-3">
            {stagedByPlant.map(group => {
              const plantObj = customerList.find(c => c.code === group.plantCode || c.name === group.plantCode)
              const first = group.items[0]?.row
              const plantRows = group.items.map(i => i.row)
              const varies = (field: keyof Attendance) => new Set(plantRows.map(r => String(r[field] ?? ''))).size > 1
              const validCount = group.items.filter(i => stagedValidation[i.index]?.isValid).length
              const employeeCount = new Set(plantRows.map(r => (r.epfNo || '').trim().toLowerCase()).filter(Boolean)).size
              const years = Array.from(new Set(plantRows.map(r => r.atttYear || excelDate(r.dayIn).slice(0, 4)).filter(Boolean))).join(', ')
              const months = Array.from(new Set(plantRows.map(r => r.attMonth || excelDate(r.dayIn).slice(5, 7)).filter(Boolean))).join(', ')
              const setting = resolvePlantSetting(plantObj, group.plantCode)
              const collapsed = collapsedPlants.has(group.plantCode)
              const toggleCollapsed = () => setCollapsedPlants(prev => {
                const next = new Set(prev)
                if (next.has(group.plantCode)) next.delete(group.plantCode)
                else next.add(group.plantCode)
                return next
              })
              const variesHint = (field: keyof Attendance) => varies(field)
                ? <span className="text-[10px] text-amber-700 ml-1" title="Rows of this plant have different values; changing it sets all rows">(varies)</span>
                : null

              return (
                <div key={group.plantCode || 'none'} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Plant header (blue section of the Attendance Transaction form) */}
                  <div className="bg-sky-50/70 border-b border-sky-100 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={toggleCollapsed} className="text-xs text-slate-500 hover:text-slate-800 w-4">
                          {collapsed ? '▸' : '▾'}
                        </button>
                        <span className="text-xs font-semibold text-slate-600">Employee Plant:</span>
                        <select
                          value={group.plantCode}
                          onChange={e => movePlantRows(group.plantCode, e.target.value)}
                          className={`form-input text-xs py-1 h-7 max-w-[220px] ${group.plantCode ? '' : 'border-red-400 bg-red-50'}`}
                        >
                          <option value="">Select Plant</option>
                          {customerList.map(c => (
                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-600">Year: <strong>{years || '—'}</strong></span>
                        <span className="text-[11px] text-slate-600">Month: <strong>{months || '—'}</strong></span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-700">
                          {employeeCount} employee{employeeCount !== 1 ? 's' : ''} · {group.items.length} row{group.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">{validCount} Valid</span>
                        {validCount < group.items.length && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 border border-rose-200 text-rose-700">{group.items.length - validCount} Flagged</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!plantObj}
                          onClick={() => {
                            updatePlantRows(group.plantCode, plantMasterValues(plantObj))
                            toast.success(`Plant ${group.plantCode} values reset from the Plant master`)
                          }}
                          className="px-2.5 py-1 text-xs border rounded bg-white hover:bg-slate-50 font-medium disabled:opacity-40"
                        >
                          Reset from Plant master
                        </button>
                        <button
                          type="button"
                          disabled={validCount === 0}
                          onClick={() => handleBulkSaveValidated(group.plantCode)}
                          className="px-3 py-1 text-xs bg-[#2F6F5E] text-white rounded font-semibold hover:bg-[#26594b] shadow-xs disabled:opacity-40"
                        >
                          Save this plant ({validCount})
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={first?.otCalAuto === 'Y'} onChange={e => updatePlantRows(group.plantCode, { otCalAuto: e.target.checked ? 'Y' : 'N' })} />
                        <span>OT Calculate Auto</span>{variesHint('otCalAuto')}
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={first?.poyaSaturdayNormal === 'Y'} onChange={e => updatePlantRows(group.plantCode, { poyaSaturdayNormal: e.target.checked ? 'Y' : 'N' })} />
                        <span>Poya / Saturday Normal Rate</span>{variesHint('poyaSaturdayNormal')}
                      </label>
                      <span className="flex items-center gap-1.5">
                        <span>Working Days:</span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono" title="From the Plant master">{plantObj?.workingDays ?? '—'}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span>Number Of Staff:</span>
                        <NumericInput integer value={first?.noOfStaff ?? 0} onChange={e => updatePlantRows(group.plantCode, { noOfStaff: Number(e.target.value || 0) })} className="form-input w-16 text-xs text-right h-7" />
                        {variesHint('noOfStaff')}
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={first?.attAllowance === 'Y'} onChange={e => updatePlantRows(group.plantCode, { attAllowance: e.target.checked ? 'Y' : 'N' })} />
                        <span>Attendance Allowance</span>{variesHint('attAllowance')}
                      </label>
                      <span className="flex items-center gap-1.5">
                        <span>Days for Attendance Allowance:</span>
                        <NumericInput integer value={first?.dasForAttAllowance ?? 0} onChange={e => updatePlantRows(group.plantCode, { dasForAttAllowance: Number(e.target.value || 0) })} className="form-input w-16 text-xs text-right h-7" />
                        {variesHint('dasForAttAllowance')}
                      </span>
                    </div>
                  </div>

                  {!collapsed && (
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="min-w-[2300px] w-full text-xs">
                        <thead className="bg-slate-50 text-left text-slate-600 sticky top-0 z-10 border-b">
                          <tr>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Employee ID *</th>
                            <th className="px-2 py-2">Employee Name</th>
                            <th className="px-2 py-2">Section</th>
                            <th className="px-2 py-2 bg-amber-50/60">Basic Salary</th>
                            <th className="px-2 py-2 bg-amber-50/60">Day Allowance</th>
                            <th className="px-2 py-2 bg-amber-50/60">Night Allowance</th>
                            <th className="px-2 py-2">Day In</th>
                            <th className="px-2 py-2">Day Out</th>
                            <th className="px-2 py-2">Time In</th>
                            <th className="px-2 py-2">Time Out</th>
                            <th className="px-2 py-2">Half Day</th>
                            <th className="px-2 py-2">Total Work Hours</th>
                            <th className="px-2 py-2" title="OT starts after 8 hours">Min Work Hours</th>
                            <th className="px-2 py-2">Total OT</th>
                            <th className="px-2 py-2">Day Type</th>
                            <th className="px-2 py-2">Shift</th>
                            <th className="px-2 py-2">Not Allow Late</th>
                            <th className="px-2 py-2">No. Of Meal</th>
                            <th className="px-2 py-2">Meal Type</th>
                            <th className="px-2 py-2">Total Meal Value</th>
                            <th className="px-2 py-2">Statutory Holiday</th>
                            <th className="px-2 py-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.items.map(({ row, index }) => {
                            const val = stagedValidation[index] || { isValid: true, errors: [] }
                            const matchedEmp = employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase())
                            const empDisplayName = row.employeeName || (matchedEmp ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim() : '-')
                            const mealRate = matchedEmp?.mealValue != null ? Number(matchedEmp.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
                            const dayInValue = excelDate(row.dayIn)
                            const isHalfDay = row.workingDays === 0.5 || row.halfDay === 1 || row.halfDay === 0.5
                            const shift = row.dayShift === 'Y' ? 'Day' : row.secondShift === 'Y' ? '2nd' : row.nightShift === 'Y' ? 'Night' : row.fullNight === 'Y' ? 'Full Night' : 'Day'
                            const dayType = row.saturdayPoya === 'Y' ? 'SaturdayPoya' : row.specialDay === 'Y' ? 'Special' : 'Normal'
                            const isStatutory = stagedHolidayDates.has(dayInValue)
                            const recompute = (timeIn: string, timeOut: string) => computePlantHours(timeIn, timeOut, plantObj, row.plantCode)

                            return (
                              <tr key={row.id || index} className={val.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/60'}>
                                <td className="px-2 py-1.5">
                                  {val.isValid ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Valid</span>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      {val.errors.map((e, ei) => (
                                        <span key={ei} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">⚠️ {e}</span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={row.epfNo || ''}
                                    onChange={e => handleStagedEmployeeChange(index, row, e.target.value)}
                                    className={`form-input w-36 text-xs font-mono ${val.errors.some(er => er.includes('EPF')) ? 'border-red-400 bg-red-50 ring-1 ring-red-200' : ''}`}
                                  >
                                    <option value="">Select Employee...</option>
                                    {row.epfNo && !matchedEmp && <option value={row.epfNo}>{row.epfNo} (unknown)</option>}
                                    {employeeList.map(emp => (
                                      <option key={emp.epfNo} value={emp.epfNo}>{emp.epfNo} - {emp.firstName} {emp.lastName || ''}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className="text-slate-700 truncate block max-w-[130px]" title={empDisplayName}>{empDisplayName}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <select value={row.sectionCode || ''} onChange={e => updateUploadRow(index, { sectionCode: e.target.value })} className="form-input w-28 text-xs">
                                    <option value="">Select</option>
                                    {sectionList.map(sec => (
                                      <option key={sec.code} value={sec.code}>{sec.code} - {sec.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5 bg-amber-50/30">
                                  <NumericInput value={row.basicSalary ?? 0} onChange={e => updateUploadRow(index, { basicSalary: Number(e.target.value || 0) })} className="form-input w-20 text-xs text-right mono-numeric" />
                                </td>
                                <td className="px-2 py-1.5 bg-amber-50/30">
                                  <NumericInput value={row.dayAllowance ?? 0} onChange={e => updateUploadRow(index, { dayAllowance: Number(e.target.value || 0) })} className="form-input w-20 text-xs text-right mono-numeric" />
                                </td>
                                <td className="px-2 py-1.5 bg-amber-50/30">
                                  <NumericInput value={row.nightAllowance ?? 0} onChange={e => updateUploadRow(index, { nightAllowance: Number(e.target.value || 0) })} className="form-input w-20 text-xs text-right mono-numeric" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="date"
                                    value={dayInValue || ''}
                                    onChange={e => updateUploadRow(index, {
                                      dayIn: e.target.value,
                                      dayOut: row.dayOut || e.target.value,
                                      atttYear: e.target.value.slice(0, 4),
                                      attMonth: e.target.value.slice(5, 7)
                                    })}
                                    className={`form-input w-32 text-xs ${val.errors.some(er => er.includes('Date')) ? 'border-red-400 bg-red-50' : ''}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="date" value={excelDate(row.dayOut) || dayInValue || ''} onChange={e => updateUploadRow(index, { dayOut: e.target.value })} className="form-input w-32 text-xs" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="time"
                                    step="1"
                                    value={row.timeIn || ''}
                                    onChange={e => {
                                      const computed = recompute(e.target.value, row.timeOut || '')
                                      updateUploadRow(index, { timeIn: e.target.value, totalWorkingHours: computed.hours, totalOt: computed.ot })
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
                                      const computed = recompute(row.timeIn || '', e.target.value)
                                      updateUploadRow(index, { timeOut: e.target.value, totalWorkingHours: computed.hours, totalOt: computed.ot })
                                    }}
                                    className="form-input w-24 text-xs"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isHalfDay}
                                    onChange={e => updateUploadRow(index, { workingDays: e.target.checked ? 0.5 : 1, halfDay: e.target.checked ? 0.5 : 0 })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <NumericInput value={row.totalWorkingHours ?? ''} onChange={e => updateUploadRow(index, { totalWorkingHours: Number(e.target.value || 0) })} className="form-input w-16 text-xs text-right" />
                                </td>
                                <td className="px-2 py-1.5 text-slate-600 font-mono">
                                  8{setting.maxHoursCap ? <span className="text-[10px] text-slate-400"> (cap {setting.maxHoursCap})</span> : null}
                                </td>
                                <td className="px-2 py-1.5">
                                  <NumericInput value={row.totalOt ?? ''} onChange={e => updateUploadRow(index, { totalOt: Number(e.target.value || 0) })} className="form-input w-16 text-xs text-right" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={dayType}
                                    onChange={e => updateUploadRow(index, {
                                      normalDay: e.target.value === 'Normal' ? 'Y' : 'N',
                                      saturdayPoya: e.target.value === 'SaturdayPoya' ? 'Y' : 'N',
                                      specialDay: e.target.value === 'Special' ? 'Y' : 'N'
                                    })}
                                    className="form-input w-32 text-xs"
                                  >
                                    <option value="Normal">Normal Day</option>
                                    <option value="SaturdayPoya">Saturday and Poya</option>
                                    <option value="Special">Other Special Day</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <select value={shift} onChange={e => handleStagedShiftChange(index, row, e.target.value)} className="form-input w-24 text-xs">
                                    <option value="Day">Day Shift</option>
                                    <option value="2nd">2nd Shift</option>
                                    <option value="Night">Night Shift</option>
                                    <option value="Full Night">Full Night</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <input type="checkbox" checked={row.lateAllowNo === 'Y'} onChange={e => updateUploadRow(index, { lateAllowNo: e.target.checked ? 'Y' : 'N' })} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <NumericInput
                                    integer
                                    value={row.noOfMeal ?? 1}
                                    onChange={e => {
                                      const count = Number(e.target.value || 0)
                                      updateUploadRow(index, { noOfMeal: count, totalMealValue: count * mealRate })
                                    }}
                                    className="form-input w-14 text-xs text-right"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <select value={row.mealType || 'Standard'} onChange={e => updateUploadRow(index, { mealType: e.target.value })} className="form-input w-28 text-xs">
                                    <option value="Standard">Standard</option>
                                    <option value="Staff Meal">Staff Meal</option>
                                    <option value="Subsidized">Subsidized</option>
                                    <option value="Special">Special</option>
                                    <option value="Free Meal">Free Meal</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <NumericInput value={row.totalMealValue ?? 0} onChange={e => updateUploadRow(index, { totalMealValue: Number(e.target.value || 0) })} className="form-input w-20 text-xs text-right mono-numeric" />
                                </td>
                                <td className="px-2 py-1.5 text-center" title="Set automatically from the Statutory Holidays calendar">
                                  {isStatutory ? (
                                    <span className="tag-pill bg-amber-50 text-amber-800 border border-amber-200">✓ Yes</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    title="Remove Row"
                                    onClick={() => setUploadRows(prev => prev.filter((_, rIdx) => rIdx !== index))}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
        </div>
      )}

      <ConfirmDialog
        open={!!statConfirm}
        title={statConfirm?.title || ''}
        message={statConfirm?.message || ''}
        onConfirm={() => { const action = statConfirm?.action; setStatConfirm(null); action?.() }}
        onCancel={() => setStatConfirm(null)}
      />
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
