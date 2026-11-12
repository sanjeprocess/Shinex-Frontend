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
import TableCellSearch, { CellSearchOption } from '../../components/shared/TableCellSearch'
import EasyTimeInput from '../../components/shared/EasyTimeInput'
import { reportYears } from '../../components/reports/ReportFilters'
import { displayTime, parseEasyTime } from '../../utils/easyTime'
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
import { computePlantHours, minWorkHoursFor, resolvePlantSetting, shiftEndFor } from '../../utils/shiftHoursCalculator'
import { logAuditAction } from '../../utils/auditLogger'
import {
  getMonth as getStatutoryMonth,
  saveHoliday as saveStatutoryHoliday,
  removeHoliday as removeStatutoryHoliday,
  StatutoryMonth
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
function computeHours(timeInStr: string, timeOutStr: string, plant?: any, plantCode?: string, minWorkHours?: number, dayIn?: string): { hours: number; ot: number } {
  const result = computePlantHours(timeInStr, timeOutStr, plant, plantCode, minWorkHours, dayIn);
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
  normalday: 'normalDay', saturdaypoya: 'saturdayPoya', specialday: 'specialDay', dayoff: 'dayOff',
  dayshift: 'dayShift', secondshift: 'secondShift', nightshift: 'nightShift', fullnight: 'fullNight',
  noofmeal: 'noOfMeal', noofmeals: 'noOfMeal', meals: 'noOfMeal', meal: 'noOfMeal',
  totalmealvalue: 'totalMealValue', mealvalue: 'totalMealValue', statutoryholidays: 'statutoryHolidays',
  sundaypoyaextra: 'sundayPoyaExtra', businesscenter: 'businessCenter',
  // Attendance Transaction form fields (plant / employee level)
  year: 'atttYear', month: 'attMonth', employeeid: 'epfNo', empid: 'epfNo', epf: 'epfNo',
  otcalauto: 'otCalAuto', otcalculateauto: 'otCalAuto', otcalcauto: 'otCalAuto', otauto: 'otCalAuto',
  sundaypoya: 'saturdayPoya', poya: 'saturdayPoya', minworkhours: 'minWorkHours',
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
  shift: 'shiftName' as any, daytype: 'dayTypeName' as any,
  // Branch attendance sheets
  comcode: 'plantCode', ename: 'employeeName', companyname: 'plantName' as any
}

const excelYesNoFields = new Set<keyof Attendance>([
  'otCalAuto', 'attAllowance', 'lateAllowNo',
  'normalDay', 'saturdayPoya', 'specialDay', 'dayShift', 'secondShift', 'nightShift', 'fullNight', 'dayOff'
])

// 'Y' / 'N' from Excel cells such as Y, Yes, 1, True, ✓; blank stays blank so masters can fill it
function excelYN(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return ''
  return ['y', 'yes', '1', 'true', 'x', '✓', '✔'].includes(text) ? 'Y' : 'N'
}

// OT Calculate Auto: ticked = from the hours; unticked = the value entered by hand is kept
function otFromHours(otCalAuto: string | undefined, computedOt: number, currentOt?: number): number {
  return otCalAuto === 'N' ? (currentOt ?? 0) : computedOt
}

// Sunday Poya extra when the row has none: employee master value, else 1.5x day rate (same as payroll)
function defaultSundayPoyaExtra(employee: any, dayRate: number): number {
  const fromEmployee = Number(employee?.sundayPoyaExtra) || 0
  return fromEmployee > 0 ? fromEmployee : Math.round(dayRate * 1.5 * 100) / 100
}

// Time In / Out for a shift: day shift follows the plant master start and end
function shiftDefaultTimes(shift: string, plant?: any, plantCode?: string, dayIn?: string): { timeIn: string; timeOut: string } {
  if (shift === '2nd') return { timeIn: '16:00', timeOut: '00:00' }
  if (shift === 'Night') return { timeIn: '20:00', timeOut: '04:00' }
  const setting = resolvePlantSetting(plant, plantCode)
  return { timeIn: setting.shiftStart || '07:30', timeOut: shiftEndFor(plant, plantCode, dayIn) }
}

// Employees the Employee master assigns to a plant
function plantStaffCount(plant: any, employeeList: any[], customerList: any[]): number {
  if (!plant) return 0
  return new Set(employeeList
    .filter(emp => resolvePlantRef(emp.plantCode, customerList) === plant.code)
    .map(emp => (emp.epfNo || '').trim().toUpperCase())
    .filter(Boolean)).size
}

// Plant level fields of the Attendance Transaction form, taken from the Plant master
function plantMasterValues(plant: any, staffCount: number): Partial<Attendance> {
  if (!plant) return {}
  const allowance = plant.attendanceAllowance
  return {
    otCalAuto: plant.otAuto ? 'Y' : 'N',
    noOfStaff: staffCount,
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  // Below 1 is an Excel time cell; 7.30 or 1630 is a time typed as a plain number
  if (typeof value === 'number' && value < 1) {
    const totalSeconds = Math.round(value * 86400)
    return `${String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  const parsed = parseEasyTime(text)
  if (!parsed) return text
  return parsed.length === 5 ? `${parsed}:00` : parsed
}

const normalizeName = (name: unknown) => String(name ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

// Employees a name from Excel can mean: the exact full name, otherwise every word of it ("DAMMIKA JAYALATH")
function findEmployeesByName(name: unknown, employeeList: any[]): any[] {
  const target = normalizeName(name)
  if (!/[A-Z]/.test(target)) return []
  const fullNames = employeeList.map(emp => ({ emp, full: normalizeName(`${emp.firstName || ''} ${emp.lastName || ''}`) }))
  const exact = fullNames.filter(item => item.full === target)
  if (exact.length) return exact.map(item => item.emp)
  const words = target.split(' ')
  return fullNames.filter(item => words.every(word => item.full.split(' ').includes(word))).map(item => item.emp)
}

// Plant reference from Excel or the employee master ("P01", "p01 ", "P01 / Name" or the plant name) to its code
function resolvePlantRef(ref: string | undefined, customerList: any[]): string {
  const text = (ref || '').trim()
  if (!text) return ''
  // Whole code first, so plants whose codes start alike ("BA POL", "BA RID") stay separate
  const key = text.split('/')[0].trim().toUpperCase()
  const match = customerList.find(c => (c.code || '').trim().toUpperCase() === key)
    || customerList.find(c => (c.name || '').trim().toUpperCase() === text.toUpperCase())
  return match ? match.code : text.split('/')[0].trim()
}

// Branch sheets write OT as hours.minutes (2.3 = 2 h 30 min). A column is read that way only when it has
// .15 / .3 / .45 values and none of the quarter-hour decimals (.25 / .5 / .75) that decimal OT uses
function otColumnIsHoursMinutes(values: unknown[]): boolean {
  const minutes = values
    .map(value => String(value ?? '').trim())
    .filter(text => text !== '' && Number.isFinite(Number(text)))
    .map(text => Math.round((Number(text) % 1) * 100))
  return minutes.some(m => m === 15 || m === 30 || m === 45)
    && !minutes.some(m => m === 25 || m === 50 || m === 75 || m > 59)
}

const hoursMinutesToHours = (value: number) => Math.round((Math.trunc(value) + Math.round((value % 1) * 100) / 60) * 100) / 100

function parseAttendanceRows(
  data: unknown[][],
  businessCenter: string,
  defaultPlant?: string,
  defaultSection?: string,
  employeeList: any[] = [],
  customerList: any[] = [],
  transfers: any[] = [],
  nameNotes: { matched: number; unclear: number; otHoursMinutes?: boolean } = { matched: 0, unclear: 0 }
): Attendance[] {
  if (!data.length) return []
  // "Day_In (yyyy-MM-dd)" -> "dayin": hints in brackets are ignored
  const headers = data[0].map(value => String(value ?? '').replace(/\(.*?\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  const otColumn = headers.findIndex(header => excelFieldMap[header] === 'totalOt')
  const otHoursMinutes = otColumn >= 0 && otColumnIsHoursMinutes(data.slice(1).map(row => row[otColumn]))
  nameNotes.otHoursMinutes = otHoursMinutes
  return data.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const record: Partial<Attendance> = {
      id: uuid(), atttYear: '', attMonth: '', epfNo: '',
      plantCode: '', customerCode: '', sectionCode: '',
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
        // "Day" / "2nd" / "Night" text column; old "Full Night" sheets count as Night
        const text = String(value ?? '').trim().toLowerCase()
        if (!text) return
        const shift = text.includes('night') ? 'nightShift' : (text.includes('2') || text.includes('second')) ? 'secondShift' : 'dayShift'
        ;(['dayShift', 'secondShift', 'nightShift', 'fullNight'] as const).forEach(f => { (record as any)[f] = f === shift ? 'Y' : 'N' })
      }
      else if ((field as string) === 'plantName') {
        // Used only when it is the exact name of a plant; Com_Code / Plant_Code wins
        const text = String(value ?? '').trim().toUpperCase()
        const plant = text ? customerList.find(c => (c.name || '').trim().toUpperCase() === text) : undefined
        if (plant) record.customerCode = plant.code
      }
      else if ((field as string) === 'dayTypeName') {
        // "Normal" / "Sunday Poya" / "Special" / "Day Off" text column; a day off is a normal day ticked Day Off
        const text = String(value ?? '').trim().toLowerCase()
        if (!text) return
        if (text.replace(/[^a-z]/g, '') === 'dayoff') {
          (record as any).dayOff = 'Y'
          return
        }
        const type = text.includes('special') ? 'specialDay' : (text.includes('poya') || text.includes('sun') || text.includes('sat')) ? 'saturdayPoya' : 'normalDay'
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
      } else if (['basicSalary', 'dayAllowance', 'nightAllowance', 'halfDay', 'totalWorkingHours', 'totalOt', 'minWorkHours', 'noOfMeal', 'totalMealValue', 'statutoryHolidays', 'sundayPoyaExtra'].includes(field)) {
        const text = String(value ?? '').trim()
        if (text === '') return // blank: filled from the Employee / Plant master below
        const number = Number(text.replace(/^0+(?=\d)/, ''))
        ;(record as any)[field] = !Number.isFinite(number) ? 0 : field === 'totalOt' && otHoursMinutes ? hoursMinutesToHours(number) : number
      } else if (field === 'businessCenter') (record as any)[field] = String(value ?? '').trim() || businessCenter
      else (record as any)[field] = String(value ?? '').trim()
    })

    const dayInVal = record.dayIn || ''
    const yearFromDate = dayInVal.includes('-') ? dayInVal.split('-')[0] : ''
    const monthFromDate = dayInVal.includes('-') ? dayInVal.split('-')[1] : ''

    // "D M CHANDRALATHA - E73": the EPF No at the end of the name
    const nameWithEpf = !record.epfNo && record.employeeName ? /^(.*\S)\s*-\s*([A-Za-z]{0,4}\d+)$/.exec(record.employeeName.trim()) : null
    if (nameWithEpf) {
      record.employeeName = nameWithEpf[1].trim()
      record.epfNo = nameWithEpf[2]
    }
    let cleanEpf = (record.epfNo || '').trim().toLowerCase()
    let matchedEmployee = cleanEpf ? employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf) : undefined
    // No such EPF: the Employee ID cell or the name column can still find the employee
    if (!matchedEmployee && (cleanEpf || record.employeeName)) {
      const idMatches = findEmployeesByName(record.epfNo, employeeList)
      const matches = idMatches.length ? idMatches : findEmployeesByName(record.employeeName, employeeList)
      if (matches.length === 1) {
        matchedEmployee = matches[0]
        record.epfNo = matches[0].epfNo
        record.employeeName = `${matches[0].firstName} ${matches[0].lastName || ''}`.trim()
        cleanEpf = (record.epfNo || '').trim().toLowerCase()
        nameNotes.matched++
      } else if (matches.length > 1) {
        // Never guess between two people: the row waits for the user to pick one
        if (idMatches.length) record.employeeName = record.epfNo
        record.epfNo = ''
        cleanEpf = ''
        nameNotes.unclear++
      }
    }
    // A transfer active on that date overrides the employee's home plant
    const activeTransfer = transfers.find(t => (t.epfNo || '').trim().toLowerCase() === cleanEpf
      && t.transferDate && dayInVal >= t.transferDate && (!t.endDate || dayInVal <= t.endDate))
    const autoPlant = resolvePlantRef(record.plantCode || record.customerCode, customerList)
      || resolvePlantRef(activeTransfer?.toPlant, customerList)
      || resolvePlantRef(matchedEmployee?.plantCode, customerList)
      || defaultPlant || ''
    const autoSection = record.sectionCode || matchedEmployee?.sectionCode || defaultSection || ''
    const autoName = record.employeeName || (matchedEmployee ? `${matchedEmployee.firstName} ${matchedEmployee.lastName || ''}`.trim() : '')
    const autoSalary = (record.basicSalary != null && record.basicSalary > 0) ? record.basicSalary : (matchedEmployee?.basicSalary || 0)

    const plantObj = customerList.find(c => c.code === autoPlant || c.name === autoPlant)
    const plantDefaults = plantMasterValues(plantObj, plantStaffCount(plantObj, employeeList, customerList))
    if (record.fullNight === 'Y') record.nightShift = 'Y'
    const hasShift = [record.dayShift, record.secondShift, record.nightShift].includes('Y')
    const hasDayType = [record.normalDay, record.saturdayPoya, record.specialDay].includes('Y')
    const isNightShift = record.nightShift === 'Y'
    const shiftName = isNightShift ? 'Night' : record.secondShift === 'Y' ? '2nd' : 'Day'
    const isSundayPoya = record.saturdayPoya === 'Y'
    const mealRate = matchedEmployee?.mealValue != null ? Number(matchedEmployee.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
    const noOfMeals = record.noOfMeal != null ? Number(record.noOfMeal) : 1
    const totalMealValue = (record.totalMealValue != null && record.totalMealValue > 0) ? record.totalMealValue : (noOfMeals * mealRate)

    // Compute working hours and OT using Plant shift settings
    // Blank times come from the plant master; values in the Excel file win over calculated ones
    const defaultTimes = shiftDefaultTimes(shiftName, plantObj, autoPlant, dayInVal)
    const timeIn = record.timeIn || defaultTimes.timeIn
    const timeOut = record.timeOut || defaultTimes.timeOut
    const computed = computePlantHours(timeIn, timeOut, plantObj, autoPlant, record.minWorkHours, dayInVal)
    const totalWorkingHours = record.totalWorkingHours ?? computed.hours
    const otCalAuto = record.otCalAuto || plantDefaults.otCalAuto || 'Y'
    const totalOt = record.totalOt ?? otFromHours(otCalAuto, computed.ot)

    return {
      ...defaultAttendanceRecord,
      ...record,
      id: record.id || `${record.epfNo || 'row'}-${index}`,
      employeeName: autoName,
      atttYear: record.atttYear || yearFromDate,
      attMonth: record.attMonth || monthFromDate,
      plantCode: autoPlant,
      customerCode: autoPlant,
      sectionCode: autoSection,
      basicSalary: autoSalary,
      dayAllowance: record.dayAllowance ?? matchedEmployee?.dayAllowance ?? 0,
      nightAllowance: record.nightAllowance ?? (isNightShift ? (matchedEmployee?.nightAllowance ?? 0) : 0),
      // Excel value wins; blanks come from the Plant master
      otCalAuto,
      noOfStaff: record.noOfStaff || plantDefaults.noOfStaff || 0,
      attAllowance: record.attAllowance || plantDefaults.attAllowance || 'N',
      dasForAttAllowance: record.dasForAttAllowance ?? plantDefaults.dasForAttAllowance ?? 0,
      lateAllowNo: record.lateAllowNo || 'N',
      dayShift: hasShift ? (record.dayShift || 'N') : 'Y',
      secondShift: record.secondShift || 'N',
      nightShift: record.nightShift || 'N',
      fullNight: 'N',
      normalDay: hasDayType ? (record.normalDay || 'N') : 'Y',
      saturdayPoya: record.saturdayPoya || 'N',
      specialDay: record.specialDay || 'N',
      dayOff: record.dayOff || 'N',
      workingDays: (record.halfDay === 1 || record.halfDay === 0.5) ? 0.5 : (record.workingDays ?? 1),
      halfDay: record.halfDay ?? (record.workingDays === 0.5 ? 1 : 0),
      noOfMeal: noOfMeals,
      totalMealValue,
      timeIn,
      timeOut,
      minWorkHours: computed.minWorkHours,
      totalWorkingHours,
      totalOt,
      sundayPoyaExtra: record.sundayPoyaExtra ?? (isSundayPoya ? defaultSundayPoyaExtra(matchedEmployee, Number(autoSalary) || 0) : 0),
      businessCenter: record.businessCenter || businessCenter
    } as Attendance
  })
}

function ageFrom(dateOfBirth?: string): number | null {
  const birth = dateOfBirth ? new Date(dateOfBirth) : null
  if (!birth || Number.isNaN(birth.getTime())) return null
  const today = new Date()
  const hadBirthday = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  return today.getFullYear() - birth.getFullYear() - (hadBirthday ? 0 : 1)
}

type StagedRowEdits = {
  update: (patch: Partial<Attendance>) => void
  setEmployee: (epf: string) => void
  setPlant: (plantCode: string) => void
  setTimeIn: (time: string) => void
  setTimeOut: (time: string) => void
  setDayIn: (date: string) => void
  setMinWorkHours: (hours: number | undefined) => void
  setMeals: (count: number, mealRate: number) => void
  setHalfDay: (half: boolean) => void
  setDayType: (type: 'Normal' | 'Poya' | 'Special') => void
  setShift: (shift: string) => void
}

function PanelField({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

// The clicked Excel row. Everything edits the same row as the table
function StagedRowDetails({ row, edits, employeeOptions, plantOptions, plants, sections, plantObj, employee, monthTotal, onClose }: {
  row: Attendance
  edits: StagedRowEdits
  employeeOptions: CellSearchOption[]
  plantOptions: CellSearchOption[]
  plants: any[]
  sections: Section[]
  plantObj: any
  employee: any
  monthTotal?: { ot: number; days: number }
  onClose: () => void
}) {
  const dayIn = excelDate(row.dayIn)
  const isHalf = row.workingDays === 0.5 || row.halfDay === 1 || row.halfDay === 0.5
  const isPoya = row.saturdayPoya === 'Y'
  const dayType = isPoya ? 'Poya' : row.specialDay === 'Y' ? 'Special' : 'Normal'
  const shift = row.secondShift === 'Y' ? '2nd' : (row.nightShift === 'Y' || row.fullNight === 'Y') ? 'Night' : 'Day'
  const mealRate = employee?.mealValue != null ? Number(employee.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
  const homePlant = employee ? resolvePlantRef(employee.plantCode, plants) : ''
  const input = 'form-input w-full text-sm h-9'
  const number = `${input} text-right`
  const stat = (label: string, value: React.ReactNode) => (
    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-xs text-slate-600">{label} <strong className="text-sm text-slate-900">{value}</strong></span>
  )

  return (
    <div data-staged-details className="bg-white border-b border-slate-200 p-4 space-y-4 text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold mr-2">{row.employeeName || 'New row'}</h4>
        {stat('Age', ageFrom(employee?.dateOfBirth) ?? '—')}
        {stat('Total OT', monthTotal ? monthTotal.ot.toFixed(2) : 0)}
        {stat('Total Days', monthTotal ? monthTotal.days : 0)}
        <button type="button" onClick={onClose} className="ml-auto px-3 py-1 text-xs border rounded font-medium hover:bg-slate-50">Close</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <PanelField label="Employee ID">
          <TableCellSearch options={employeeOptions} value={row.epfNo} onChange={edits.setEmployee} placeholder="EPF or name" ariaLabel="Employee ID" className={`${input} font-mono`} />
        </PanelField>
        <PanelField label="Name" className="col-span-2">
          <input value={row.employeeName || ''} onChange={e => edits.update({ employeeName: e.target.value })} className={input} />
        </PanelField>
        <PanelField label="Attended Plant" className="col-span-2">
          <TableCellSearch options={plantOptions} value={row.plantCode} onChange={edits.setPlant} showLabel placeholder="Search plant" ariaLabel="Attended Plant" invalid={!row.plantCode} className={input} />
          {homePlant && homePlant !== row.plantCode && <span className="block mt-1 text-xs text-amber-800">Home plant: <strong>{homePlant}</strong></span>}
        </PanelField>
        <PanelField label="Section">
          <select value={row.sectionCode || ''} onChange={e => edits.update({ sectionCode: e.target.value })} className={input}>
            <option value="">Select</option>
            {sections.map(sec => <option key={sec.code} value={sec.code}>{sec.code} - {sec.name}</option>)}
          </select>
        </PanelField>

        <PanelField label="Basic Salary">
          <NumericInput value={row.basicSalary ?? 0} onChange={e => edits.update({ basicSalary: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        <PanelField label="Day Allowance">
          <NumericInput value={row.dayAllowance ?? 0} onChange={e => edits.update({ dayAllowance: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        <PanelField label="Night Allowance">
          <NumericInput value={row.nightAllowance ?? 0} onChange={e => edits.update({ nightAllowance: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        <PanelField label="Number Of Meal">
          <NumericInput integer value={row.noOfMeal ?? 1} onChange={e => edits.setMeals(Number(e.target.value || 0), mealRate)} className={number} />
        </PanelField>
        <PanelField label="Total Meal Value">
          <NumericInput value={row.totalMealValue ?? 0} onChange={e => edits.update({ totalMealValue: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        {isPoya ? (
          <PanelField label="Extra Payment">
            <NumericInput value={row.sundayPoyaExtra ?? 0} onChange={e => edits.update({ sundayPoyaExtra: Number(e.target.value || 0) })} className={number} />
          </PanelField>
        ) : <div className="hidden xl:block" />}

        <PanelField label="Day In">
          <input type="date" value={dayIn} onChange={e => edits.setDayIn(e.target.value)} className={input} />
        </PanelField>
        <PanelField label="Day Out">
          <input type="date" value={excelDate(row.dayOut) || dayIn} onChange={e => edits.update({ dayOut: e.target.value })} className={input} />
        </PanelField>
        <PanelField label="Time In">
          <EasyTimeInput column="details-in" value={row.timeIn} onCommit={edits.setTimeIn} className={input} />
        </PanelField>
        <PanelField label="Time Out">
          <EasyTimeInput column="details-out" value={row.timeOut} onCommit={edits.setTimeOut} className={input} />
        </PanelField>
        <PanelField label="Total Work Hours">
          <NumericInput value={row.totalWorkingHours ?? ''} onChange={e => edits.update({ totalWorkingHours: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        <PanelField label="Total OT Hours">
          <NumericInput value={row.totalOt ?? ''} onChange={e => edits.update({ totalOt: Number(e.target.value || 0) })} className={number} />
        </PanelField>
        <PanelField label="Min Work Hours">
          <NumericInput value={row.minWorkHours ?? minWorkHoursFor(plantObj, row.plantCode, row.dayIn)} onChange={e => edits.setMinWorkHours(Number(e.target.value) || undefined)} className={number} />
        </PanelField>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {([['Normal', 'Normal Day'], ['Poya', 'Sunday Poya'], ['Special', 'Other Special Day']] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`day-type-${row.id}`} checked={dayType === value} onChange={() => edits.setDayType(value)} /> {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {([['Day', 'Day Shift'], ['2nd', '2nd Shift'], ['Night', 'Night Shift']] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`shift-${row.id}`} checked={shift === value} onChange={() => edits.setShift(value)} /> {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={isHalf} onChange={e => edits.setHalfDay(e.target.checked)} /> Half Day
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={row.dayOff === 'Y'} onChange={e => edits.update({ dayOff: e.target.checked ? 'Y' : 'N' })} /> Day Off
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={row.lateAllowNo === 'Y'} onChange={e => edits.update({ lateAllowNo: e.target.checked ? 'Y' : 'N' })} /> Not Allow Late
          </label>
        </div>
      </div>
    </div>
  )
}

// Save requests stay small (a large request body is refused before it reaches the server)
const BULK_SAVE_MAX_BYTES = 7500
const BULK_SAVE_MAX_ROWS = 25
// Requests sent at the same time
const BULK_SAVE_PARALLEL = 3

// Empty fields are left out of the request; the server reads a missing field as empty
function compactForSave(row: Attendance): Attendance {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined)) as Attendance
}

// Rows of one plant and month in requests of at most BULK_SAVE_MAX_BYTES / BULK_SAVE_MAX_ROWS
function saveBatches(rows: Attendance[]): Attendance[][] {
  const batches: Attendance[][] = []
  let batch: Attendance[] = []
  let bytes = 2
  rows.forEach(row => {
    const size = JSON.stringify(compactForSave(row)).length + 1
    if (batch.length && (bytes + size > BULK_SAVE_MAX_BYTES || batch.length >= BULK_SAVE_MAX_ROWS)) {
      batches.push(batch)
      batch = []
      bytes = 2
    }
    batch.push(row)
    bytes += size
  })
  if (batch.length) batches.push(batch)
  return batches
}

// The reason a save was refused, from the server's reply when it gives one
function saveErrorText(error: any): string {
  const status = error?.response?.status
  const data = error?.response?.data
  const detail = typeof data === 'string'
    ? data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    : data?.message || data?.error || ''
  return [status ? `status ${status}` : '', detail || error?.message || 'Bulk attendance save failed'].filter(Boolean).join(': ')
}

// A batch that timed out or met a server/network error is sent again; saving the same day again only updates it
async function saveBatchWithRetry(batch: Attendance[], attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await bulkSaveAttendance(batch.map(compactForSave))
    } catch (error: any) {
      const status = error?.response?.status
      const retry = !error?.response || error?.code === 'ECONNABORTED' || status >= 500
      if (attempt >= attempts || !retry) throw error
    }
  }
}

// A request refused as too large (403 / 413) is sent again in two halves, down to single rows
async function saveAdaptive(batch: Attendance[], onSaved: (rows: Attendance[], result: Awaited<ReturnType<typeof bulkSaveAttendance>>) => void): Promise<void> {
  try {
    onSaved(batch, await saveBatchWithRetry(batch))
  } catch (error: any) {
    const status = error?.response?.status
    if ((status === 403 || status === 413) && batch.length > 1) {
      const half = Math.ceil(batch.length / 2)
      await saveAdaptive(batch.slice(0, half), onSaved)
      await saveAdaptive(batch.slice(half), onSaved)
      return
    }
    throw error
  }
}

function validateUploadRow(
  row: Attendance,
  allUploadRows: Attendance[],
  savedRows: Attendance[],
  empList: any[],
  customerList: any[] = [],
  transfers: any[] = []
): {
  isValid: boolean;
  errors: string[];
  updatesSaved: boolean;
} {
  const errs: string[] = []
  let updatesSaved = false
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
    updatesSaved = savedRows.some(r => (r.epfNo || '').trim().toLowerCase() === cleanEpf && r.dayIn === row.dayIn)
    if (dupCount > 1) {
      errs.push('Duplicate row in Excel')
    }
  }

  // 4. Plant check
  if (!(row.plantCode || '').trim()) {
    errs.push('Missing Plant')
  } else if (cleanEpf && customerList.length) {
    // An employee of another plant only counts here when a plant transfer covers that day
    const employee = empList.find(e => (e.epfNo || '').trim().toLowerCase() === cleanEpf)
    const homePlant = employee ? resolvePlantRef(employee.plantCode, customerList) : ''
    const day = excelDate(row.dayIn)
    const transferred = transfers.some(t => (t.epfNo || '').trim().toLowerCase() === cleanEpf
      && t.transferDate && day >= t.transferDate && (!t.endDate || day <= t.endDate)
      && resolvePlantRef(t.toPlant, customerList) === row.plantCode)
    if (homePlant && homePlant !== row.plantCode && !transferred) {
      errs.push(`Employee belongs to plant ${homePlant}`)
    }
  }

  return {
    isValid: errs.length === 0,
    errors: errs,
    updatesSaved
  }
}

const defaultAttendanceRecord: Attendance = {
  id: '', atttYear: '', attMonth: '', epfNo: '', plantCode: '', dayIn: '', timeIn: '',
  businessCenter: ''
}

// Normalise a plant reference ("P01", "p01 ", "P01 / Plant Name") to its bare upper-case code
const normPlantCode = (value?: string | null) => (value || '').split(/\s|\//)[0].trim().toUpperCase()

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
    dayOff: 'N',
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

  // Rows restored from this browser, loaded before the masters, still need their plant's staff count
  useEffect(() => {
    setUploadRows(previous => {
      let changed = false
      const next = previous.map(row => {
        if (row.noOfStaff) return row
        const plant = customerList.find(c => c.code === row.plantCode || c.name === row.plantCode)
        const noOfStaff = plantStaffCount(plant, employeeList, customerList)
        if (!noOfStaff) return row
        changed = true
        return { ...row, noOfStaff }
      })
      return changed ? next : previous
    })
  }, [employeeList, customerList])

  // Filters for Year, Month, Employee, Plant
  const [exportOpen, setExportOpen] = useState(false)
  const [exportChoice, setExportChoice] = useState({ year: 'ALL', month: 'ALL', plant: 'ALL' })
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
  const [selectedStagedId, setSelectedStagedId] = useState<string | null>(null)
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
          const weight = (a.halfDay === 1 || a.halfDay === 0.5) ? 0.5 : 1.0
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
      const nameNotes: { matched: number; unclear: number; otHoursMinutes?: boolean } = { matched: 0, unclear: 0 }
      const parsed = parseAttendanceRows(
        XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }),
        localStorage.getItem('hsb_active_bc') || defaultForm.businessCenter,
        uploadDefaultPlant,
        uploadDefaultSection,
        employeeList,
        customerList,
        transfers,
        nameNotes
      )
      if (!parsed.length) {
        toast.error('The selected file contains no attendance rows.')
        return
      }
      setUploadRows(parsed)
      toast.success(`${parsed.length} attendance rows loaded for review`)
      if (nameNotes.otHoursMinutes) toast.info('The OT column was read as hours.minutes: 2.3 is 2 hours 30 minutes.')
      if (nameNotes.matched) toast.info(`${nameNotes.matched} rows found the employee by name. Please check them before saving.`)
      if (nameNotes.unclear) toast.error(`${nameNotes.unclear} rows have a name that fits more than one employee. Please choose the employee.`)
    } catch (error) {
      console.error('Attendance Excel import failed', error)
      toast.error('Unable to read the selected Excel file.')
    }
  }

  // From a plant card the row belongs to that plant and its dates; otherwise it follows the employee chosen
  function handleAddNewUploadRow(plantCode?: string) {
    const cardDate = plantCode === undefined ? '' : excelDate(uploadRows.find(r => (r.plantCode || '') === plantCode)?.dayIn);
    const today = cardDate || new Date().toISOString().split('T')[0];
    const defaultPlant = plantCode ?? uploadDefaultPlant;
    const defaultSection = uploadDefaultSection;
    const plantObj = customerList.find(c => c.code === defaultPlant || c.name === defaultPlant);
    const { timeIn: defaultTimeIn, timeOut: defaultTimeOut } = shiftDefaultTimes('Day', plantObj, defaultPlant, today);
    const computed = computePlantHours(defaultTimeIn, defaultTimeOut, plantObj, defaultPlant, undefined, today);
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
      ...plantMasterValues(plantObj, plantStaffCount(plantObj, employeeList, customerList)),
      totalOt: otFromHours(plantMasterValues(plantObj, 0).otCalAuto, computed.ot),
      minWorkHours: computed.minWorkHours,
      dayShift: 'Y',
      secondShift: 'N',
      nightShift: 'N',
      fullNight: 'N',
      noOfMeal: 1,
      totalMealValue: mealRate,
      normalDay: 'Y',
      saturdayPoya: 'N',
      specialDay: 'N',
      dayOff: 'N'
    };
    setUploadRows(prev => [newRow, ...prev]);
    setSelectedStagedId(newRow.id);
    showPlantCard(defaultPlant);
    toast.success('Added a new attendance entry row for editing.');
  }

  function updateUploadRow(index: number, patch: Partial<Attendance>) {
    setUploadRows(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  // Plant level fields (Attendance Transaction header) apply to every staged row of that plant
  function updatePlantRows(plantCode: string, patch: Partial<Attendance>) {
    setUploadRows(previous => previous.map(row => (row.plantCode || '') === plantCode ? { ...row, ...patch } : row))
  }

  function resetPlantRowsFromMaster(plantCode: string, plant: any) {
    setUploadRows(previous => previous.map(row => {
      if ((row.plantCode || '') !== plantCode) return row
      const computed = computePlantHours(row.timeIn || '', row.timeOut || '', plant, plantCode, undefined, row.dayIn)
      const master = plantMasterValues(plant, plantStaffCount(plant, employeeList, customerList))
      return { ...row, ...master, minWorkHours: computed.minWorkHours, totalWorkingHours: computed.hours, totalOt: otFromHours(master.otCalAuto, computed.ot, row.totalOt) }
    }))
  }

  // New times on many rows; each row recalculates hours and OT for its own date. A blank time stays as it is
  function applyStagedTimes(plant: any, indexes: Set<number>, timeIn: string, timeOut: string) {
    setUploadRows(previous => previous.map((row, rowIndex) => {
      if (!indexes.has(rowIndex)) return row
      const nextIn = timeIn || row.timeIn || ''
      const nextOut = timeOut || row.timeOut || ''
      const computed = computePlantHours(nextIn, nextOut, plant, row.plantCode, row.minWorkHours, row.dayIn)
      return { ...row, timeIn: nextIn, timeOut: nextOut, totalWorkingHours: computed.hours, totalOt: otFromHours(row.otCalAuto, computed.ot, row.totalOt) }
    }))
    toast.success(`Times applied to ${indexes.size} row${indexes.size === 1 ? '' : 's'}`)
  }

  // Ticking OT Calculate Auto recalculates the plant's rows; unticking keeps the values for manual editing
  function setPlantOtAuto(plantCode: string, plant: any, checked: boolean) {
    setUploadRows(previous => previous.map(row => {
      if ((row.plantCode || '') !== plantCode) return row
      if (!checked) return { ...row, otCalAuto: 'N' }
      const computed = computePlantHours(row.timeIn || '', row.timeOut || '', plant, plantCode, row.minWorkHours)
      return { ...row, otCalAuto: 'Y', totalOt: computed.ot }
    }))
  }

  // A row in another plant takes that plant's master values, and hours and OT recalculate
  function rowInPlant(row: Attendance, toPlant: string): Attendance {
    const target = customerList.find(c => c.code === toPlant)
    const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', target, toPlant, undefined, row.dayIn)
    const master = plantMasterValues(target, plantStaffCount(target, employeeList, customerList))
    return { ...row, ...master, plantCode: toPlant, customerCode: toPlant, minWorkHours: computed.minWorkHours, totalWorkingHours: computed.hours, totalOt: otFromHours(master.otCalAuto ?? row.otCalAuto, computed.ot, row.totalOt) }
  }

  function movePlantRows(fromPlant: string, toPlant: string) {
    setUploadRows(previous => previous.map(row => (row.plantCode || '') === fromPlant ? rowInPlant(row, toPlant) : row))
  }

  function showPlantCard(plantCode: string) {
    setCollapsedPlants(previous => {
      if (!previous.has(plantCode)) return previous
      const next = new Set(previous)
      next.delete(plantCode)
      return next
    })
  }

  function moveStagedRow(index: number, toPlant: string) {
    setUploadRows(previous => previous.map((row, rowIndex) => rowIndex === index ? rowInPlant(row, toPlant) : row))
    showPlantCard(toPlant)
  }

  // Row edits shared by the review table and the details panel
  function stagedRowEdits(index: number, row: Attendance, plantObj: any): StagedRowEdits {
    const recompute = (timeIn: string, timeOut: string, minWorkHours = row.minWorkHours) => computePlantHours(timeIn, timeOut, plantObj, row.plantCode, minWorkHours, row.dayIn)
    return {
      update: patch => updateUploadRow(index, patch),
      setEmployee: epf => handleStagedEmployeeChange(index, row, epf),
      setPlant: plantCode => moveStagedRow(index, plantCode),
      setTimeIn: timeIn => {
        const computed = recompute(timeIn, row.timeOut || '')
        updateUploadRow(index, { timeIn, totalWorkingHours: computed.hours, totalOt: otFromHours(row.otCalAuto, computed.ot, row.totalOt) })
      },
      setTimeOut: timeOut => {
        const computed = recompute(row.timeIn || '', timeOut)
        updateUploadRow(index, { timeOut, totalWorkingHours: computed.hours, totalOt: otFromHours(row.otCalAuto, computed.ot, row.totalOt) })
      },
      setDayIn: date => updateUploadRow(index, {
        // Saturdays and other days have different Min Work Hours
        minWorkHours: minWorkHoursFor(plantObj, row.plantCode, date),
        totalOt: otFromHours(row.otCalAuto, computePlantHours(row.timeIn || '', row.timeOut || '', plantObj, row.plantCode, undefined, date).ot, row.totalOt),
        dayIn: date,
        dayOut: row.dayOut || date,
        atttYear: date.slice(0, 4),
        attMonth: date.slice(5, 7)
      }),
      setMinWorkHours: minWorkHours => updateUploadRow(index, { minWorkHours, totalOt: otFromHours(row.otCalAuto, recompute(row.timeIn || '', row.timeOut || '', minWorkHours).ot, row.totalOt) }),
      setMeals: (count, mealRate) => updateUploadRow(index, { noOfMeal: count, totalMealValue: count * mealRate }),
      setHalfDay: half => updateUploadRow(index, half ? { workingDays: 0.5, halfDay: 0.5 } : { workingDays: 1, halfDay: 0 }),
      setDayType: type => {
        if (type === 'Poya') {
          handleStagedSundayPoya(index, row, true)
          return
        }
        updateUploadRow(index, { saturdayPoya: 'N', sundayPoyaExtra: 0, normalDay: type === 'Normal' ? 'Y' : 'N', specialDay: type === 'Special' ? 'Y' : 'N' })
      },
      setShift: shift => handleStagedShiftChange(index, row, shift)
    }
  }

  // Employee picked on a staged row: Excel-only values are replaced by the Employee master
  function handleStagedEmployeeChange(index: number, row: Attendance, newEpf: string) {
    const clean = newEpf.trim().toLowerCase()
    const matched = clean ? employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === clean) : undefined
    if (!matched) {
      updateUploadRow(index, { epfNo: newEpf })
      return
    }
    const activeTransfer = transfers.find(t => (t.epfNo || '').trim().toLowerCase() === clean
      && t.transferDate && excelDate(row.dayIn) >= t.transferDate && (!t.endDate || excelDate(row.dayIn) <= t.endDate))
    const plantCode = row.plantCode || resolvePlantRef(activeTransfer?.toPlant, customerList) || resolvePlantRef(matched.plantCode, customerList) || uploadDefaultPlant
    const plantObj = customerList.find(c => c.code === plantCode || c.name === plantCode)
    const plantValues = row.plantCode ? {} : plantMasterValues(plantObj, plantStaffCount(plantObj, employeeList, customerList))
    if (!row.plantCode) showPlantCard(plantCode)
    const mealRate = matched.mealValue != null ? Number(matched.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200)
    const isNight = row.nightShift === 'Y' || row.fullNight === 'Y'
    const computed = computePlantHours(row.timeIn || '08:00', row.timeOut || '16:00', plantObj, plantCode, row.minWorkHours)
    updateUploadRow(index, {
      ...plantValues,
      epfNo: matched.epfNo,
      employeeName: `${matched.firstName} ${matched.lastName || ''}`.trim(),
      plantCode,
      customerCode: plantCode,
      sectionCode: matched.sectionCode || row.sectionCode || uploadDefaultSection,
      basicSalary: resolveEmployeeBasicSalary(matched, sectionList),
      dayAllowance: matched.dayAllowance ?? 0,
      nightAllowance: isNight ? (matched.nightAllowance ?? 0) : 0,
      totalMealValue: (row.noOfMeal ?? 1) * mealRate,
      totalWorkingHours: computed.hours,
      totalOt: otFromHours(row.otCalAuto, computed.ot, row.totalOt)
    })
  }

  function handleStagedShiftChange(index: number, row: Attendance, shift: string) {
    const matched = employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase())
    const isNight = shift === 'Night'
    updateUploadRow(index, {
      dayShift: shift === 'Day' ? 'Y' : 'N',
      secondShift: shift === '2nd' ? 'Y' : 'N',
      nightShift: shift === 'Night' ? 'Y' : 'N',
      fullNight: 'N',
      nightAllowance: isNight ? (row.nightAllowance || matched?.nightAllowance || 0) : 0
    })
  }

  function handleStagedSundayPoya(index: number, row: Attendance, checked: boolean) {
    const matched = employeeList.find(emp => (emp.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase())
    updateUploadRow(index, {
      saturdayPoya: checked ? 'Y' : 'N',
      normalDay: checked ? 'N' : 'Y',
      specialDay: 'N',
      sundayPoyaExtra: checked ? (row.sundayPoyaExtra || defaultSundayPoyaExtra(matched, Number(row.basicSalary) || 0)) : 0
    })
  }

  const stagedValidation = useMemo(
    () => uploadRows.map(r => validateUploadRow(r, uploadRows, rows, employeeList, customerList, transfers)),
    [uploadRows, rows, employeeList, customerList, transfers]
  )

  const stagedMonthTotals = useMemo(() => {
    const keyOf = (row: Attendance) => `${(row.epfNo || '').trim().toLowerCase()}|${excelDate(row.dayIn).slice(0, 7)}`
    const stagedDays = new Set(uploadRows.map(row => `${(row.epfNo || '').trim().toLowerCase()}|${excelDate(row.dayIn)}`))
    const wanted = new Set(uploadRows.map(keyOf))
    const totals = new Map<string, { ot: number; days: number }>()
    const add = (row: Attendance) => {
      const key = keyOf(row)
      if (!wanted.has(key)) return
      const total = totals.get(key) || { ot: 0, days: 0 }
      const isHalf = row.workingDays === 0.5 || row.halfDay === 1 || row.halfDay === 0.5
      total.ot += Number(row.totalOt) || 0
      total.days += isHalf ? 0.5 : 1
      totals.set(key, total)
    }
    rows.forEach(row => {
      if (!stagedDays.has(`${(row.epfNo || '').trim().toLowerCase()}|${excelDate(row.dayIn)}`)) add(row)
    })
    uploadRows.forEach(add)
    return totals
  }, [uploadRows, rows])

  const employeeOptions = useMemo<CellSearchOption[]>(() => employeeList.map(emp => ({
    value: emp.epfNo,
    label: `${emp.epfNo} - ${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    detail: `Plant: ${emp.plantCode || '-'}`
  })), [employeeList])
  const plantOptions = useMemo<CellSearchOption[]>(() => customerList.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })), [customerList])

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
      val: validateUploadRow(r, uploadRows, rows, employeeList, customerList, transfers)
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
      const autoPlant = r.plantCode
      const autoSection = r.sectionCode || emp?.sectionCode || uploadDefaultSection

      return {
        ...r,
        employeeName: name,
        dayIn: cleanDayIn,
        dayOut: cleanDayOut,
        atttYear: yr,
        attMonth: mo,
        plantCode: autoPlant,
        customerCode: autoPlant,
        sectionCode: autoSection,
        // Ticked from the statutory holiday calendar (payroll itself reads the calendar)
        statutoryHolidays: stagedHolidayDates.has(cleanDayIn) ? 1 : 0
      }
    })

    setSaveError(null)
    setSaveSummaries([])
    // Saved in small requests, a few at a time; a refused request stops the save and unsaved rows stay staged
    const savedIds = new Set<string>()
    const groups = new Map<string, { plantCode: string; year: string; month: string; employees: Set<string>; inserted: number; updated: number; failed: number }>()
    let failure: string | null = null
    // Plant by plant and month by month: a batch never mixes plants or months
    const byPlantMonth = new Map<string, Attendance[]>()
    enrichedValid.forEach(r => {
      const key = `${(r.plantCode || '').trim().toUpperCase()}|${excelDate(r.dayIn).slice(0, 7)}`
      byPlantMonth.set(key, [...(byPlantMonth.get(key) || []), r])
    })
    const batches: Attendance[][] = []
    byPlantMonth.forEach(list => batches.push(...saveBatches(list)))
    const showProgress = batches.length > 1
    if (showProgress) toast.loading(`Saving 0 of ${enrichedValid.length} rows...`, { id: 'bulk-save-progress' })
    const recordSaved = (batch: Attendance[], result: Awaited<ReturnType<typeof bulkSaveAttendance>>) => {
      batch.forEach(r => savedIds.add(r.id))
      if (showProgress) {
        toast.loading(`Saving ${savedIds.size} of ${enrichedValid.length} rows (plant ${batch[0].plantCode})...`, { id: 'bulk-save-progress' })
      }
      result.summaries.forEach(summary => {
        const key = `${summary.plantCode}|${summary.year}|${summary.month}`
        const group = groups.get(key) || { plantCode: summary.plantCode, year: summary.year, month: summary.month, employees: new Set<string>(), inserted: 0, updated: 0, failed: 0 }
        group.inserted += summary.inserted || 0
        group.updated += summary.updated || 0
        group.failed += summary.failed || 0
        batch.filter(r => (r.plantCode || '').trim().toUpperCase() === (summary.plantCode || '').trim().toUpperCase())
          .forEach(r => group.employees.add((r.epfNo || '').trim().toUpperCase()))
        groups.set(key, group)
      })
    }
    const queue = [...batches]
    const worker = async () => {
      while (!failure && queue.length) {
        const batch = queue.shift()!
        try {
          await saveAdaptive(batch, recordSaved)
        } catch (error: any) {
          console.error('Bulk attendance save failed', error)
          failure = failure || saveErrorText(error)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(BULK_SAVE_PARALLEL, queue.length) }, worker))
    toast.dismiss('bulk-save-progress')

    const summaryLines = Array.from(groups.values()).map(g =>
      `Plant ${g.plantCode} – ${g.year}/${g.month} – ${g.employees.size} employees – ${g.inserted + g.updated} rows saved (inserted ${g.inserted}, updated ${g.updated}, failed ${g.failed})`)
    const unsavedRows = validRows.filter(r => !savedIds.has(r.id))
    setUploadRows([...otherRows, ...invalidRows, ...unsavedRows])
    if (savedIds.size > 0) {
      setLastSavedTimestamp(new Date().toLocaleString())
      setSaveSummaries(summaryLines)
      await listAttendance(localStorage.getItem('hsb_active_bc') || '').then(setRows)
    }

    if (failure) {
      // The error bar already starts with "Not saved to the database:"
      const msg = savedIds.size > 0
        ? `${unsavedRows.length} rows were not saved (${failure}). ${savedIds.size} of ${enrichedValid.length} rows were saved; the rest are still in the preview.`
        : failure
      setSaveError(msg)
      toast.error(`Not saved to the database: ${msg}`)
      return
    }

    setSaveError(null)
    toast.success(`${summaryLines.join('\n')}${invalidCount > 0 ? `\n${invalidCount} invalid rows retained for review.` : ''}`)
    // Switch to logs tab and reset filters so newly saved rows are immediately visible
    setFilterYear('ALL')
    setFilterMonth('ALL')
    setFilterPlant('ALL')
    setFilterEmployee('ALL')
    setActiveTab('logs')
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
    exportAttendanceRows(uploadRows, 'attendance-updated.xlsx', true)
  }

  function openExportDialog() {
    setExportChoice({ year: filterYear, month: filterMonth, plant: filterPlant })
    setExportOpen(true)
  }

  // Saved attendance of the chosen month and plant; the file can be edited and imported again
  const exportHomePlants = useMemo(() => {
    const homes = new Map<string, string>()
    employeeList.forEach(emp => homes.set((emp.epfNo || '').trim().toLowerCase(), resolvePlantRef(emp.plantCode, customerList)))
    return homes
  }, [employeeList, customerList])
  const inExportPlant = (row: Attendance) => exportChoice.plant === 'ALL'
    || resolvePlantRef(row.plantCode, customerList) === exportChoice.plant
    || exportHomePlants.get((row.epfNo || '').trim().toLowerCase()) === exportChoice.plant
  const inExportPeriod = (row: Attendance) => {
    const date = excelDate(row.dayIn)
    if (exportChoice.year !== 'ALL' && (row.atttYear || date.slice(0, 4)) !== exportChoice.year) return false
    return exportChoice.month === 'ALL' || (row.attMonth || date.slice(5, 7)) === exportChoice.month
  }

  // Months that do have saved rows for the plant, shown when the chosen month has none
  const exportOtherMonths = useMemo(() => {
    if (!exportOpen) return []
    const counts = new Map<string, number>()
    rows.filter(inExportPlant).forEach(row => {
      const month = excelDate(row.dayIn).slice(0, 7)
      if (month) counts.set(month, (counts.get(month) || 0) + 1)
    })
    return Array.from(counts.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [exportOpen, exportChoice, rows, exportHomePlants])

  const exportUnsaved = exportOpen ? uploadRows.filter(row => inExportPlant(row) && inExportPeriod(row)).length : 0

  const exportMatches = useMemo(() => {
    if (!exportOpen) return []
    return rows
      .filter(row => inExportPlant(row) && inExportPeriod(row))
      .sort((a, b) =>
        (a.plantCode || '').localeCompare(b.plantCode || '') ||
        (a.epfNo || '').localeCompare(b.epfNo || '', undefined, { numeric: true }) ||
        excelDate(a.dayIn).localeCompare(excelDate(b.dayIn)))
  }, [exportOpen, exportChoice, rows, customerList, exportHomePlants])

  function exportSavedRows() {
    if (!exportMatches.length) {
      toast.error('There are no attendance rows to export for this month and plant.')
      return
    }
    const period = [exportChoice.year, exportChoice.month, exportChoice.plant].filter(v => v !== 'ALL').join('-')
    exportAttendanceRows(exportMatches, `attendance${period ? `-${period}` : ''}.xlsx`, false)
    setExportOpen(false)
  }

  function exportAttendanceRows(list: Attendance[], fileName: string, staged: boolean) {
    const exportRows = list.map(row => {
      const { id, ...record } = row
      const isHalf = record.workingDays === 0.5 || record.halfDay === 1 || record.halfDay === 0.5
      const workdayText = isHalf ? '0.5 - Half Day' : '1 - Full Day'
      return {
        Attt_Year: record.atttYear,
        Att_Month: record.attMonth,
        EPF_No: record.epfNo,
        Employee_Name: record.employeeName || (() => {
          const emp = employeeList.find(e => (e.epfNo || '').trim() === (record.epfNo || '').trim())
          return emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : ''
        })(),
        Plant_Code: record.plantCode,
        Plant_Name: customerList.find(c => c.code === record.plantCode)?.name || '',
        Section_Code: record.sectionCode,
        OT_Cal_Auto: record.otCalAuto || 'N',
        No_Of_Staff: record.noOfStaff ?? 0,
        Att_Allowance: record.attAllowance || 'N',
        Das_for_Att_Alowance: record.dasForAttAllowance ?? 0,
        Workday: workdayText,
        Working_Days: record.workingDays ?? (isHalf ? 0.5 : 1),
        Day_in: record.dayIn,
        Time_IN: displayTime(record.timeIn),
        Day_out: String(record.dayOut || '').slice(0, 10),
        Time_Out: displayTime(record.timeOut),
        Half_Day: isHalf ? 0.5 : 0,
        Total_Working_Hours: record.totalWorkingHours,
        Min_Work_Hours: record.minWorkHours,
        Total_OT: record.totalOt,
        Shift: record.secondShift === 'Y' ? '2nd' : (record.nightShift === 'Y' || record.fullNight === 'Y') ? 'Night' : 'Day',
        Day_shift: record.dayShift,
        second_Shift: record.secondShift,
        Night_Shift: record.nightShift,
        No_of_Meal: record.noOfMeal ?? 1,
        Total_Meal_Value: record.totalMealValue ?? 0,
        Basic_Salary: record.basicSalary,
        Day_Allowance: record.dayAllowance,
        Night_Allowance: record.nightAllowance,
        Normal_Day: record.normalDay,
        Saturday_Poya: record.saturdayPoya,
        Special_Day: record.specialDay,
        Day_Off: record.dayOff || 'N',
        Late_Allow_No: record.lateAllowNo || 'N',
        Statutory_holidays: staged ? (stagedHolidayDates.has(excelDate(record.dayIn)) ? 1 : 0) : (record.statutoryHolidays ?? 0),
        Sunday_Poya_Extra: record.sundayPoyaExtra,
        Business_Center: record.businessCenter
      }
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Attendance')
    // Second sheet to look up an Employee ID by name; import reads only the first sheet
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeList.map(emp => ({
      EPF_No: emp.epfNo,
      Employee_Name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      Plant_Code: emp.plantCode || '',
      Section_Code: emp.sectionCode || ''
    }))), 'Employees')
    XLSX.writeFile(workbook, fileName)
    toast.success(`Exported ${list.length} attendance rows to ${fileName}`)
  }

  // Add flow
  function handleAdd() {
    const todayStr = new Date().toISOString().split('T')[0]
    const empty = {
      ...defaultForm,
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
    const { hours, ot: computedOt } = computeHours(form.timeIn || '', form.timeOut || '', plantObj, form.plantCode, form.minWorkHours, form.dayIn);
    const ot = otFromHours(form.otCalAuto, computedOt, form.totalOt);
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
      // Plant by plant (all of one plant's attendance together), then date, then EPF No
      .sort((a, b) =>
        (a.plantCode || '').trim().localeCompare((b.plantCode || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
        || String(a.dayIn || '').slice(0, 10).localeCompare(String(b.dayIn || '').slice(0, 10))
        || (a.epfNo || '').trim().localeCompare((b.epfNo || '').trim(), undefined, { numeric: true, sensitivity: 'base' }))
  }, [rows, employeeList, q, filterYear, filterMonth, filterEmployee, filterPlant])

  // Employee filter choices: with a plant picked, only that plant's employees and anyone with attendance there
  const filterEmployeeOptions = useMemo(() => {
    if (filterPlant === 'ALL') return employeeList
    const plant = filterPlant.trim()
    const worked = new Set(rows.filter(r => (r.plantCode || '').trim() === plant).map(r => (r.epfNo || '').trim().toUpperCase()))
    return employeeList.filter(e => resolvePlantRef(e.plantCode, customerList) === plant || worked.has((e.epfNo || '').trim().toUpperCase()))
  }, [employeeList, customerList, rows, filterPlant])

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

  async function runStat(action: () => Promise<void>, failMessage: string, reload = true) {
    setStatBusy(true)
    try {
      await action()
      if (reload) await loadStatutory()
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
    const holidayYear = date.slice(0, 4)
    const holidayMonth = date.slice(5, 7)
    const otherMonth = holidayYear !== statYear || holidayMonth !== statMonth
    const notWorkingValue = parseStatValue('Not Working Value', statNew.notWorkingValue)
    const workingValue = parseStatValue('Working Value', statNew.workingValue)
    if (notWorkingValue === null || workingValue === null) return

    runStat(async () => {
      const month = otherMonth ? await getStatutoryMonth(holidayYear, holidayMonth, localStorage.getItem('hsb_active_bc') || '') : statData
      if (month?.holidays.some(h => h.holidayDate === date)) {
        toast.error('This date is already a statutory holiday')
        return
      }
      await saveStatutoryHoliday({ holidayDate: date, holidayName: statNew.holidayName, workingValue, notWorkingValue })
      // Keep the values for the next holiday; most months use the same amounts
      setStatNew(prev => ({ ...prev, date: '', holidayName: '' }))
      toast.success(`Statutory holiday ${date} added`)
      // The new period reloads the panel
      if (otherMonth) {
        setStatYear(holidayYear)
        setStatMonth(holidayMonth)
      }
    }, 'Failed to add statutory holiday', !otherMonth)
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

    if (emp?.plantCode) codes.add(normPlantCode(emp.plantCode))

    empTransfers.forEach(t => {
      if (t.fromPlant) codes.add(normPlantCode(t.fromPlant))
      if (t.toPlant) codes.add(normPlantCode(t.toPlant))
    })

    const filtered = customerList.filter(c => codes.has(normPlantCode(c.code)))
    if (filtered.length === 0 && emp?.plantCode) {
      const cleanHome = emp.plantCode.split(/\s|\//)[0].trim()
      return [{ code: cleanHome, name: emp.plantCode }]
    }
    return filtered
  }, [form.epfNo, employeeList, empTransfers, customerList])

  // Resolve a plant reference (code, "CODE / Name", or name) to the customer master code
  function resolvePlantCode(ref: string | undefined): string {
    if (!ref) return ''
    const key = normPlantCode(ref)
    const match = customerList.find(c => normPlantCode(c.code) === key)
      || customerList.find(c => (c.name || '').trim().toUpperCase() === ref.trim().toUpperCase())
    return match ? match.code : ref.split(/\s|\//)[0].trim()
  }

  // New entries take Time In / Out and Min Work Hours from the plant master; edits keep their saved values
  function plantFormDefaults(plant: any, plantCode: string, current: Attendance): Partial<Attendance> {
    if (isEditing) return {}
    const setting = resolvePlantSetting(plant, plantCode)
    const otCalAuto = plant ? (plant.otAuto ? 'Y' : 'N') : current.otCalAuto
    const isDay = current.secondShift !== 'Y' && current.nightShift !== 'Y' && current.fullNight !== 'Y'
    return isDay
      ? { otCalAuto, minWorkHours: minWorkHoursFor(plant, plantCode, current.dayIn), timeIn: setting.shiftStart, timeOut: shiftEndFor(plant, plantCode, current.dayIn) }
      : { otCalAuto, minWorkHours: minWorkHoursFor(plant, plantCode, current.dayIn) }
  }

  function handleEmployeeChange(epf: string | null) {
    if (!epf) return
    const emp = employeeList.find(e => e.epfNo === epf)
    const activeTransfer = transfers.find(t => t.epfNo === epf && String(t.status || '').toLowerCase() === 'active')

    // Plant comes from the employee master; an active plant transfer overrides it
    const effectivePlant = resolvePlantCode(activeTransfer?.toPlant || emp?.plantCode)

    if (emp) {
      const autoSalary = resolveEmployeeBasicSalary(emp);
      const isNight = form.nightShift === 'Y' || form.fullNight === 'Y';
      const plantObj = customerList.find(c => c.code === effectivePlant);
      const mealRate = emp.mealValue != null ? Number(emp.mealValue) : (plantObj?.mealValue != null ? Number(plantObj.mealValue) : 200);
      const noOfMeals = form.noOfMeal ?? 1;
      setForm(prev => ({
        ...prev,
        epfNo: epf,
        plantCode: effectivePlant,
        customerCode: effectivePlant,
        businessCenter: emp.businessCenter || prev.businessCenter || localStorage.getItem('hsb_active_bc') || '',
        basicSalary: autoSalary,
        dayAllowance: emp.dayAllowance || 0,
        nightAllowance: isNight ? (emp.nightAllowance || 0) : 0,
        totalMealValue: noOfMeals * mealRate,
        ...plantFormDefaults(plantObj, effectivePlant, prev)
      }))
    } else {
      setForm(prev => ({ ...prev, epfNo: epf, plantCode: effectivePlant, customerCode: effectivePlant }))
    }
    if (effectivePlant && errors.plantCode) setErrors(prev => ({ ...prev, plantCode: undefined }))
  }

  const isSundayPoya = form.saturdayPoya === 'Y'
  const selectedDayType = form.specialDay === 'Y' ? 'Special' : 'Normal'

  function handleDayTypeChange(type: 'Normal' | 'Special') {
    setForm(prev => ({
      ...prev,
      normalDay: type === 'Normal' ? 'Y' : 'N',
      specialDay: type === 'Special' ? 'Y' : 'N',
      saturdayPoya: 'N',
      sundayPoyaExtra: 0
    }))
  }

  function handleSundayPoyaChange(checked: boolean) {
    const currentEmp = employeeList.find(e => (e.epfNo || '').trim() === (form.epfNo || '').trim());
    setForm(prev => ({
      ...prev,
      saturdayPoya: checked ? 'Y' : 'N',
      normalDay: checked ? 'N' : 'Y',
      specialDay: 'N',
      sundayPoyaExtra: checked ? (prev.sundayPoyaExtra && prev.sundayPoyaExtra > 0 ? prev.sundayPoyaExtra : defaultSundayPoyaExtra(currentEmp, prev.basicSalary || 0)) : 0
    }))
  }

  const selectedShift = form.secondShift === 'Y' ? '2nd' : ((form.nightShift === 'Y' || form.fullNight === 'Y') ? 'Night' : 'Day')

  function handleShiftChange(shift: 'Day' | '2nd' | 'Night') {
    const isNight = shift === 'Night';
    const currentEmp = employeeList.find(e => (e.epfNo || '').trim() === (form.epfNo || '').trim());
    const empNightAllowance = currentEmp?.nightAllowance || 0;

    const currentPlant = customerList.find(c => c.code === form.plantCode || c.name === form.plantCode);
    const { timeIn: nextTimeIn, timeOut: nextTimeOut } = shiftDefaultTimes(shift, currentPlant, form.plantCode, form.dayIn);
    const { hours, ot: computedOt } = computeHours(nextTimeIn, nextTimeOut, currentPlant, form.plantCode, form.minWorkHours, form.dayIn);
    const ot = otFromHours(form.otCalAuto, computedOt, form.totalOt);

    setForm(prev => ({
      ...prev,
      dayShift: shift === 'Day' ? 'Y' : 'N',
      secondShift: shift === '2nd' ? 'Y' : 'N',
      nightShift: shift === 'Night' ? 'Y' : 'N',
      fullNight: 'N',
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
    return computePlantHours(form.timeIn || '', form.timeOut || '', currentPlant, form.plantCode, form.minWorkHours, form.dayIn);
  }, [form.timeIn, form.timeOut, form.plantCode, form.minWorkHours, form.dayIn, customerList]);

  const formPlantSetting = resolvePlantSetting(customerList.find(c => c.code === form.plantCode || c.name === form.plantCode), form.plantCode)

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
      total: Math.round(eligible.reduce((sum, e) => sum + (Number(e.payTotal ?? e.total) || 0), 0) * 100) / 100
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
      dayTypeNode = <span className="tag-pill bg-violet-50 text-violet-700 border border-violet-200">Sunday Poya</span>
    } else if (r.specialDay === 'Y') {
      dayTypeNode = <span className="tag-pill bg-rose-50 text-rose-700 border border-rose-200">Special</span>
    }
    if (r.dayOff === 'Y') {
      dayTypeNode = (
        <div className="flex flex-col items-start gap-0.5">
          {dayTypeNode}
          <span className="tag-pill bg-sky-50 text-sky-700 border border-sky-200">Day Off</span>
        </div>
      )
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
      <span className="mono-numeric text-[#C08A2E] font-medium">{otVal.toFixed(2)}</span>
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
      totalHours: (Number(r.totalWorkingHours) || 0).toFixed(2),
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
            className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium btn-press shadow-xs"
            onClick={openExportDialog}
            title="Export attendance to Excel by month and plant"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span>Export Excel</span>
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
                          {group.totalOt.toFixed(2)} hrs
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
                    Eligible employees get the Working or Not Working value for each holiday; Working is taken from attendance. Hours after the first 9 on a holiday are paid as holiday OT (Day Rate ÷ 9 × 2). The monthly total is paid as Statutory Holiday Pay.
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
                                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-semibold ${line.status === 'W' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                        {line.status === 'W' ? 'Working' : 'Not Working'}
                                      </span>
                                      <div className="text-[10px] text-slate-500">
                                        Rs. {Number(line.amount).toLocaleString()}
                                        {line.status === 'W' && Number(line.workedHours) > 0 && <> · worked {Number(line.workedHours)} h</>}
                                      </div>
                                      {Number(line.otHours) > 0 && (
                                        <div className="text-[10px] text-amber-800">
                                          OT {Number(line.otHours)} h · Rs. {Number(line.otAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>
                              ))}
                              <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                                Rs. {Number(emp.payTotal ?? emp.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {Number(emp.otAmount) > 0 && (
                                  <div className="text-[10px] font-normal text-slate-500">
                                    {Number(emp.total).toLocaleString()} + OT {Number(emp.otAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
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
            <option value="ALL">All Employees ({filterEmployeeOptions.length})</option>
            {filterEmployeeOptions.map(e => (
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
            onChange={e => {
              const plant = e.target.value
              setFilterPlant(plant)
              // An employee of another plant would show nothing, so the employee filter starts again
              if (plant !== 'ALL' && filterEmployee !== 'ALL') {
                const epf = filterEmployee.trim().toUpperCase()
                const employee = employeeList.find(x => (x.epfNo || '').trim().toUpperCase() === epf)
                const inPlant = resolvePlantRef(employee?.plantCode, customerList) === plant.trim()
                  || rows.some(r => (r.plantCode || '').trim() === plant.trim() && (r.epfNo || '').trim().toUpperCase() === epf)
                if (!inPlant) setFilterEmployee('ALL')
              }
            }}
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
                <SearchableEmployeeSelect employees={employeeList} customers={customerList} value={form.epfNo} onChange={(epf) => { handleEmployeeChange(epf || ''); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} />
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
                      Current Plant: {form.plantCode ? `${form.plantCode}${customerList.find(c => c.code === form.plantCode)?.name ? ' - ' + customerList.find(c => c.code === form.plantCode)?.name : ''}` : 'Not Set'}
                    </span>
                  )}
                </div>
                <select 
                  value={form.plantCode} 
                  onChange={e => { 
                    const selectedPlant = customerList.find(c => c.code === e.target.value);
                    setForm({ ...form, plantCode: e.target.value, customerCode: e.target.value, ...plantFormDefaults(selectedPlant, e.target.value, form) }); 
                    if (errors.plantCode) setErrors(prev => ({ ...prev, plantCode: undefined })) 
                  }} 
                  className={`w-full form-input ${errors.plantCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                >
                  <option value="">Select plant</option>
                  {relevantPlants.map(c => {
                    const emp = employeeList.find(e => e.epfNo === form.epfNo);
                    const code = normPlantCode(c.code);
                    const isCurrent = !!emp?.plantCode && normPlantCode(emp.plantCode) === code;
                    const isFromPlant = empTransfers.some(t => !!t.fromPlant && normPlantCode(t.fromPlant) === code);
                    const isToPlant = empTransfers.some(t => !!t.toPlant && normPlantCode(t.toPlant) === code);
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
                      attMonth: mo,
                      // New entries: Saturdays and other days have different Min Work Hours
                      ...(isEditing ? {} : { minWorkHours: minWorkHoursFor(customerList.find(c => c.code === prev.plantCode), prev.plantCode, newDate) })
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
                <span className="text-xs font-semibold text-slate-600">Day Entry</span>
                <select
                  value={form.halfDay === 1 || form.halfDay === 0.5 ? 'half' : 'full'}
                  onChange={e => setForm({ ...form, halfDay: e.target.value === 'half' ? 0.5 : 0 })}
                  className="form-input w-36 text-xs"
                >
                  <option value="full">Full Day</option>
                  <option value="half">Half Day</option>
                </select>
              </div>
            </div>

            {/* Computed read-only StatChips with Plant Shift Rule badge */}
            <div className="flex flex-col gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <div className="flex gap-4 items-center">
                <div>
                  <label className="text-xs text-emerald-800 block font-medium">Min Work Hours</label>
                  <NumericInput
                    value={form.minWorkHours ?? liveComputed.minWorkHours}
                    onChange={e => setForm(prev => ({ ...prev, minWorkHours: Number(e.target.value) || undefined }))}
                    className="form-input w-16 text-xs text-right mono-numeric mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-xs text-emerald-800 block font-medium">Total Working Hours</span>
                  <span className="text-lg font-bold font-mono text-emerald-950">{liveComputed.hours.toFixed(2)} hrs</span>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  {form.otCalAuto === 'N' ? (
                    <>
                      <label className="text-xs text-emerald-800 block font-medium">OT Hours (Manual)</label>
                      <NumericInput
                        value={form.totalOt ?? 0}
                        onChange={e => setForm(prev => ({ ...prev, totalOt: Number(e.target.value || 0) }))}
                        className="form-input w-20 text-xs text-right mono-numeric mt-0.5"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-emerald-800 block font-medium">Calculated OT</span>
                      <span className={`text-lg font-bold font-mono ${liveComputed.ot > 0 ? 'text-[#C08A2E]' : 'text-emerald-900'}`}>{liveComputed.ot.toFixed(2)} hrs</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-slate-600 bg-white/80 px-2 py-1 rounded border border-emerald-200/60 flex items-center justify-between">
                <span>
                  {liveComputed.countFromShiftStart
                    ? `Plant Shift Start: ${liveComputed.appliedShiftStart} (counted from ${liveComputed.startTimeStr})`
                    : `Actual arrival: ${liveComputed.startTimeStr}`}
                  {liveComputed.capped ? ` (capped at ${liveComputed.maxHoursCap} hrs)` : ''}
                  {` · Plant ${formPlantSetting.shiftStart} - ${formPlantSetting.shiftEnd}`}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">Plant Rule</span>
              </div>
            </div>
          </section>

          {/* Section 5: Day Type */}
          <section className="space-y-3">
            <h4 className="font-semibold mb-1">Day Type</h4>
            <div className="flex rounded-lg bg-slate-100 p-0.5 border">
              <button type="button" onClick={() => handleDayTypeChange('Normal')} className={`flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all ${selectedDayType === 'Normal' && !isSundayPoya ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Normal</button>
              <button type="button" onClick={() => handleDayTypeChange('Special')} className={`flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all ${selectedDayType === 'Special' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Special</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2 flex items-center justify-between p-1 bg-white border rounded">
                <span className="text-slate-600 font-medium">Sunday Poya</span>
                <Toggle checked={isSundayPoya} onChange={handleSundayPoyaChange} />
              </div>
              <div className="col-span-2 flex items-center justify-between p-1 bg-white border rounded">
                <span className="text-slate-600 font-medium">Day Off <span className="text-[10px] text-slate-400">(paid at the basic day rate)</span></span>
                <Toggle checked={form.dayOff === 'Y'} onChange={checked => setForm(prev => ({ ...prev, dayOff: checked ? 'Y' : 'N' }))} />
              </div>
              {isSundayPoya && (
                <div className="col-span-2">
                  <label className="block text-slate-600 mb-1">Sunday Poya Extra Payment</label>
                  <NumericInput value={form.sundayPoyaExtra || 0} onChange={e => handleNumericInput('sundayPoyaExtra', 'Sunday/Poya extra payment', e.target.value)} className="w-full form-input" />
                </div>
              )}
            </div>
          </section>

          {/* Section 6: Shift */}
          <section className="space-y-2">
            <h4 className="font-semibold mb-1">Shift</h4>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-100 border">
              {[
                { name: 'Day', icon: Sun },
                { name: '2nd', icon: Sunset },
                { name: 'Night', icon: Moon }
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">Default Plant:</span>
                <select
                  value={uploadDefaultPlant}
                  onChange={e => setUploadDefaultPlant(e.target.value)}
                  className="form-input text-xs !py-0.5 !px-2 h-8 w-40"
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
                  className="form-input text-xs !py-0.5 !px-2 h-8 w-40"
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
                onClick={() => handleAddNewUploadRow()}
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
                        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Employee Plant:</span>
                        <select
                          value={group.plantCode}
                          onChange={e => movePlantRows(group.plantCode, e.target.value)}
                          title="Moves every row of this card. To move one row, use the Plant column of that row."
                          className={`form-input text-xs font-medium !py-0.5 !px-2 h-8 w-64 ${group.plantCode ? '' : 'border-red-400 bg-red-50'}`}
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
                          onClick={() => handleAddNewUploadRow(group.plantCode)}
                          className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium"
                        >
                          + Add Row
                        </button>
                        <button
                          type="button"
                          disabled={!plantObj}
                          onClick={() => {
                            resetPlantRowsFromMaster(group.plantCode, plantObj)
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
                        <input type="checkbox" checked={first?.otCalAuto === 'Y'} onChange={e => setPlantOtAuto(group.plantCode, plantObj, e.target.checked)} />
                        <span>OT Calculate Auto</span>{variesHint('otCalAuto')}
                      </label>
                      <span className="flex items-center gap-1.5">
                        <span>Plant Start - End:</span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono" title="From the Plant master">{setting.shiftStart} - {setting.shiftEnd}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span>Working Days:</span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono" title="From the Plant master">{plantObj?.workingDays ?? '—'}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span title="Employees assigned to this plant in the Employee master">Number Of Staff:</span>
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

                  {!collapsed && (() => {
                    const selected = group.items.find(item => item.row.id === selectedStagedId)
                    if (!selected) return <div className="px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100">Click a row to see and edit its details here.</div>
                    return (
                      <StagedRowDetails
                        row={selected.row}
                        edits={stagedRowEdits(selected.index, selected.row, plantObj)}
                        employeeOptions={employeeOptions}
                        plantOptions={plantOptions}
                        plants={customerList}
                        sections={sectionList}
                        plantObj={plantObj}
                        employee={employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === (selected.row.epfNo || '').trim().toLowerCase())}
                        monthTotal={stagedMonthTotals.get(`${(selected.row.epfNo || '').trim().toLowerCase()}|${excelDate(selected.row.dayIn).slice(0, 7)}`)}
                        onClose={() => setSelectedStagedId(null)}
                      />
                    )
                  })()}
                  {!collapsed && (
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="min-w-[1000px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-600 sticky top-0 z-10 border-b">
                          <tr>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Employee ID</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2" title="The plant this day was worked at. Changing it moves only this row.">Plant</th>
                            <th className="px-3 py-2">Day In</th>
                            <th className="px-3 py-2">Time In</th>
                            <th className="px-3 py-2">Time Out</th>
                            <th className="px-3 py-2 text-right">Hours</th>
                            <th className="px-3 py-2 text-right">OT</th>
                            <th className="px-3 py-2">Notes</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.items.map(({ row, index }, position) => {
                            const val = stagedValidation[index] || { isValid: true, errors: [], updatesSaved: false }
                            const matchedEmp = employeeList.find(e => (e.epfNo || '').trim().toLowerCase() === (row.epfNo || '').trim().toLowerCase())
                            const empDisplayName = row.employeeName || (matchedEmp ? `${matchedEmp.firstName} ${matchedEmp.lastName || ''}`.trim() : '-')
                            const dayInValue = excelDate(row.dayIn)
                            const isHalfDay = row.workingDays === 0.5 || row.halfDay === 1 || row.halfDay === 0.5
                            const edits = stagedRowEdits(index, row, plantObj)
                            const isSelected = row.id === selectedStagedId
                            const rowsBelow = group.items.slice(position + 1).map(i => i.index)
                            const notes = [
                              isHalfDay && 'Half Day',
                              row.saturdayPoya === 'Y' && 'Sunday Poya',
                              row.specialDay === 'Y' && 'Special',
                              row.dayOff === 'Y' && 'Day Off',
                              row.secondShift === 'Y' && '2nd Shift',
                              (row.nightShift === 'Y' || row.fullNight === 'Y') && 'Night',
                              stagedHolidayDates.has(dayInValue) && 'Holiday'
                            ].filter(Boolean) as string[]

                            return (
                              <tr
                                key={row.id || index}
                                onClick={() => setSelectedStagedId(row.id)}
                                onFocusCapture={() => setSelectedStagedId(row.id)}
                                className={`cursor-pointer ${isSelected ? 'bg-emerald-50 outline outline-2 -outline-offset-2 outline-emerald-500' : val.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/60'}`}
                              >
                                <td className="px-3 py-1.5">
                                  {val.isValid ? (
                                    val.updatesSaved ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200" title="This employee and date is already saved; saving replaces it">Will update</span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Valid</span>
                                    )
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      {val.errors.map((e, ei) => (
                                        <span key={ei} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">{e}</span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <TableCellSearch
                                    options={employeeOptions}
                                    value={row.epfNo}
                                    onChange={edits.setEmployee}
                                    placeholder="EPF or name"
                                    ariaLabel="Employee ID of this row"
                                    invalid={val.errors.some(er => er.includes('EPF'))}
                                    className="w-32 text-xs font-mono"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className="block max-w-[160px] truncate text-slate-800" title={empDisplayName}>{empDisplayName}</span>
                                </td>
                                <td className="px-3 py-1.5">
                                  <TableCellSearch
                                    options={plantOptions}
                                    value={row.plantCode}
                                    onChange={edits.setPlant}
                                    showLabel
                                    placeholder="Search plant"
                                    ariaLabel="Plant of this row"
                                    invalid={!row.plantCode}
                                    className="w-40 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input
                                    type="date"
                                    aria-label="Day In of this row"
                                    value={dayInValue || ''}
                                    onChange={e => edits.setDayIn(e.target.value)}
                                    className={`form-input w-32 text-xs ${val.errors.some(er => er.includes('Date')) ? 'border-red-400 bg-red-50' : ''}`}
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <EasyTimeInput column="in" value={row.timeIn} onCommit={edits.setTimeIn} className="w-28 text-xs" />
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  <EasyTimeInput column="out" value={row.timeOut} onCommit={edits.setTimeOut} className="w-28 text-xs" />
                                  <button
                                    type="button"
                                    disabled={rowsBelow.length === 0}
                                    onClick={() => applyStagedTimes(plantObj, new Set(rowsBelow), row.timeIn || '', row.timeOut || '')}
                                    title="Copy this row's Time In and Time Out to all rows below in this plant"
                                    aria-label="Copy times to rows below"
                                    className="ml-1 px-1.5 py-1 border rounded text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                  >
                                    ↓
                                  </button>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">{row.totalWorkingHours ?? '—'}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{row.totalOt ?? '—'}</td>
                                <td className="px-3 py-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {notes.map(note => <span key={note} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700 whitespace-nowrap">{note}</span>)}
                                  </div>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <button
                                    type="button"
                                    title="Remove Row"
                                    aria-label="Remove Row"
                                    onClick={event => { event.stopPropagation(); setUploadRows(prev => prev.filter((_, rIdx) => rIdx !== index)) }}
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

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Export Attendance to Excel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Edit the file and use Import Excel to update these days.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
              <label className="block">
                Year
                <select aria-label="Export year" value={exportChoice.year} onChange={e => setExportChoice({ ...exportChoice, year: e.target.value })} className="mt-1 w-full form-input text-xs">
                  <option value="ALL">All years</option>
                  {reportYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                Month
                <select aria-label="Export month" value={exportChoice.month} onChange={e => setExportChoice({ ...exportChoice, month: e.target.value })} className="mt-1 w-full form-input text-xs">
                  <option value="ALL">All months</option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block col-span-2">
                Plant
                <select aria-label="Export plant" value={exportChoice.plant} onChange={e => setExportChoice({ ...exportChoice, plant: e.target.value })} className="mt-1 w-full form-input text-xs">
                  <option value="ALL">All plants</option>
                  {customerList.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </select>
              </label>
            </div>
            {exportUnsaved > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                {exportUnsaved} row{exportUnsaved === 1 ? ' is' : 's are'} in the upload preview and not saved yet, so {exportUnsaved === 1 ? 'it is' : 'they are'} not in this export. Click Save first.
              </p>
            )}
            {exportMatches.length === 0 && (
              <div className="text-xs text-slate-600 space-y-1.5">
                <p>{exportOtherMonths.length ? 'Saved attendance for this plant is in:' : 'No attendance is saved for this plant yet.'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {exportOtherMonths.slice(0, 12).map(([period, count]) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setExportChoice({ ...exportChoice, year: period.slice(0, 4), month: period.slice(5, 7) })}
                      className="px-2 py-1 border rounded font-medium hover:bg-slate-50"
                    >
                      {period} ({count})
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-600">{exportMatches.length} attendance row{exportMatches.length === 1 ? '' : 's'}, {new Set(exportMatches.map(r => r.epfNo)).size} employee{new Set(exportMatches.map(r => r.epfNo)).size === 1 ? '' : 's'}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setExportOpen(false)} className="px-3 py-1.5 text-xs border rounded font-medium hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={exportSavedRows} disabled={!exportMatches.length} className="px-3 py-1.5 text-xs bg-[#2F6F5E] text-white rounded font-semibold hover:bg-[#26594b] disabled:opacity-50">Export Excel</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
