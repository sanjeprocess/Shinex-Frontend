import React, { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Sun, Sunset, Moon, Star } from 'lucide-react'
import SearchInput from '../../components/SearchInput'
import NumericInput from '../../components/NumericInput'
import DataTable from '../../components/DataTable'
import SlideOver from '../../components/SlideOver'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toggle from '../../components/Toggle'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listEmployees } from '../../services/employeeService'
import { list as listCustomers } from '../../mocks/customers'
import { list as listBC } from '../../mocks/businessCenters'
import {
  list as listAttendance,
  create as createAttendance,
  update as updateAttendance,
  bulkSave as bulkSaveAttendance,
  remove as removeAttendance,
  Attendance
} from '../../mocks/attendance'
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
  attyear: 'atttYear', attmonth: 'attMonth', epfno: 'epfNo', plantcode: 'plantCode',
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

function parseAttendanceRows(data: unknown[][], businessCenter: string): Attendance[] {
  if (!data.length) return []
  const headers = data[0].map(value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  return data.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const record: Partial<Attendance> = {
      id: uuid(), atttYear: '', attMonth: '', epfNo: '', plantCode: '', dayIn: '',
      timeIn: '', businessCenter
    }
    headers.forEach((header, column) => {
      const field = excelFieldMap[header]
      if (!field) return
      const value = row[column]
      if (field === 'dayIn') record[field] = excelDate(value)
      else if (field === 'dayOut') record[field] = excelDate(value)
      else if (field === 'timeIn' || field === 'timeOut') record[field] = excelTime(value)
      else if (['workingDays', 'basicSalary', 'dayAllowance', 'nightAllowance', 'halfDay', 'totalWorkingHours', 'totalOt', 'noOfMeal', 'totalMealValue', 'statutoryHolidays', 'sundayPoyaExtra'].includes(field)) {
        const number = Number(String(value ?? '').replace(/^0+(?=\d)/, ''))
        record[field] = Number.isFinite(number) ? number : 0
      } else if (field === 'businessCenter') record[field] = String(value ?? '').trim() || businessCenter
      else record[field] = String(value ?? '').trim()
    })
    return {
      ...defaultAttendanceRecord,
      ...record,
      id: record.id || `${record.epfNo || 'row'}-${index}`,
      attMonth: record.attMonth || '01',
      businessCenter: record.businessCenter || businessCenter
    } as Attendance
  })
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
    workingDays: 26,
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
    dayOut: `${new Date().toISOString().split('T')[0]}T17:00:00`,
    timeOut: '17:00',
    halfDay: 0,
    totalWorkingHours: 9.0,
    totalOt: 1.0,
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
  const [customerList, setCustomerList] = useState<any[]>([])
  const [bcList, setBcList] = useState<any[]>([])
  const [uploadRows, setUploadRows] = useState<Attendance[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refresh()
    listEmployees().then((employees) => {
      setEmployeeList(employees)
      const firstEmployee = employees.find((employee) => employee?.epfNo)
      if (!firstEmployee) return
      setForm((prev) => ({
        ...prev,
        epfNo: prev.epfNo || firstEmployee.epfNo,
        plantCode: prev.plantCode || firstEmployee.plantCode || '',
        businessCenter: prev.businessCenter || firstEmployee.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
        basicSalary: prev.basicSalary && prev.basicSalary !== 0 ? prev.basicSalary : (firstEmployee.basicSalary || 0),
        dayAllowance: prev.dayAllowance && prev.dayAllowance !== 0 ? prev.dayAllowance : (firstEmployee.dayAllowance || 0),
        nightAllowance: prev.nightAllowance && prev.nightAllowance !== 0 ? prev.nightAllowance : (firstEmployee.nightAllowance || 0)
      }))
    })
    listCustomers().then(setCustomerList)
    listBC().then(setBcList)
  }, [])

  function refresh() {
    listAttendance().then(setRows)
  }

  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const parsed = parseAttendanceRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }), localStorage.getItem('hsb_active_bc') || defaultForm.businessCenter)
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

  async function handleBulkSave() {
    if (!uploadRows.length) {
      toast.error('Upload an attendance file first.')
      return
    }
    const invalid = uploadRows.findIndex(row => !row.epfNo.trim() || !row.plantCode.trim() || !row.dayIn || !row.timeIn)
    if (invalid >= 0) {
      toast.error(`Please complete required fields in row ${invalid + 1}.`)
      return
    }
    try {
      await bulkSaveAttendance(uploadRows)
      toast.success(`${uploadRows.length} attendance rows saved`)
      setUploadRows([])
      refresh()
    } catch (error: any) {
      console.error('Bulk attendance save failed', error)
      toast.error(String(error?.response?.data?.message || 'Bulk attendance save failed'))
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

  function getDefaultEmployeeValues(employee?: any) {
    if (!employee) return {}
    return {
      epfNo: employee.epfNo || '',
      plantCode: employee.plantCode || '',
      businessCenter: employee.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
      basicSalary: employee.basicSalary || 0,
      dayAllowance: employee.dayAllowance || 0,
      nightAllowance: employee.nightAllowance || 0
    }
  }

  // Add flow
  function handleAdd() {
    const firstEmployee = employeeList.find((employee) => employee?.epfNo)
    const empty = {
      ...defaultForm,
      ...getDefaultEmployeeValues(firstEmployee),
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
    setForm({ ...row })
    setIsEditing(true)
    setEditingId(id)
    setOpen(true)
  }

  // Delete flow
  function handleDeleteConfirm() {
    if (!confirm) return
    removeAttendance(confirm).then(() => {
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
    const toSave: Attendance = {
      ...form,
      dayOut: normalizeLocalDateTime(form.dayOut, form.timeOut) || form.dayOut,
      totalWorkingHours: hours,
      totalOt: ot
    }

    const duplicate = !isEditing && rows.some((row) => 
      row.epfNo === toSave.epfNo &&
      row.dayIn === toSave.dayIn &&
      row.attMonth === toSave.attMonth &&
      row.atttYear === toSave.atttYear
    )

    if (duplicate) {
      toast.error('Attendance already exists for this employee on this date.')
      return
    }

    try {
      if (isEditing && editingId) {
        await updateAttendance(editingId, toSave)
        toast.success('Attendance updated')
      } else {
        await createAttendance({
          ...toSave,
          id: uuid()
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

  // Search & Filter
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const emp = employeeList.find(e => e.epfNo === r.epfNo)
      const empName = emp ? `${emp.firstName} ${emp.lastName || ''}`.toLowerCase() : ''
      const searchStr = `${r.epfNo} ${empName} ${r.plantCode} ${r.dayIn}`.toLowerCase()
      return searchStr.includes(q.toLowerCase())
    })
  }, [rows, employeeList, q])

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

  function handleEmployeeChange(epf: string | null) {
    if (!epf) return
    const emp = employeeList.find(e => e.epfNo === epf)
    if (emp) {
      setForm(prev => ({
        ...prev,
        epfNo: epf,
        plantCode: emp.plantCode || prev.plantCode || '',
        businessCenter: emp.businessCenter || prev.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
        basicSalary: emp.basicSalary || 0,
        dayAllowance: emp.dayAllowance || 0,
        nightAllowance: emp.nightAllowance || 0
      }))
    } else {
      setForm(prev => ({ ...prev, epfNo: epf }))
    }
  }

  const selectedDayType = form.normalDay === 'Y' ? 'Normal' : (form.saturdayPoya === 'Y' ? 'SaturdayPoya' : 'Special')

  function handleDayTypeChange(type: 'Normal' | 'SaturdayPoya' | 'Special') {
    setForm(prev => ({
      ...prev,
      normalDay: type === 'Normal' ? 'Y' : 'N',
      saturdayPoya: type === 'SaturdayPoya' ? 'Y' : 'N',
      specialDay: type === 'Special' ? 'Y' : 'N'
    }))
  }

  const selectedShift = form.dayShift === 'Y' ? 'Day' : (form.secondShift === 'Y' ? '2nd' : (form.nightShift === 'Y' ? 'Night' : 'Full Night'))

  function handleShiftChange(shift: 'Day' | '2nd' | 'Night' | 'Full Night') {
    setForm(prev => ({
      ...prev,
      dayShift: shift === 'Day' ? 'Y' : 'N',
      secondShift: shift === '2nd' ? 'Y' : 'N',
      nightShift: shift === 'Night' ? 'Y' : 'N',
      fullNight: shift === 'Full Night' ? 'Y' : 'N'
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
    { key: 'plant', label: 'Plant' },
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
      plant: r.plantCode,
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Attendance Logs</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name, EPF..." />
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
          <button type="button" className="bg-slate-700 text-white px-3 py-1 rounded-md btn-press" onClick={() => fileInputRef.current?.click()}>Excel File Upload</button>
          {uploadRows.length > 0 && <button type="button" className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md btn-press" onClick={handleBulkSave}>Emp Attendance Update</button>}
          {uploadRows.length > 0 && <button type="button" className="bg-[#C08A2E] text-white px-3 py-1 rounded-md btn-press" onClick={exportUploadRows}>Export Updated Excel</button>}
          <button type="button" className="bg-[#2F6F5E] text-white px-3 py-1 rounded-md btn-press" onClick={handleAdd}>Add Entry</button>
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
                <label className="block text-xs text-slate-600">Plant / Customer</label>
                <select value={form.plantCode} onChange={e => { setForm({ ...form, plantCode: e.target.value }); if (errors.plantCode) setErrors(prev => ({ ...prev, plantCode: undefined })) }} className={`mt-1 w-full form-input ${errors.plantCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
                  <option value="">Select plant</option>
                  {customerList.map(c => <option key={c.code} value={c.code}>{c.code} / {c.name}</option>)}
                </select>
                {errors.plantCode && <p className="mt-1 text-xs text-red-500">{errors.plantCode}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Employee</label>
                <SearchableEmployeeSelect value={form.epfNo} onChange={(epf) => { handleEmployeeChange(epf || ''); if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined })) }} />
                {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
              </div>
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
            <h4 className="font-semibold mb-2">Compensation Snapshot (Editable)</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Basic Salary</label>
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
                <label className="block text-xs text-slate-600">Day In (Date)</label>
                <input type="date" value={form.dayIn} onChange={e => { setForm({ ...form, dayIn: e.target.value }); if (errors.dayIn) setErrors(prev => ({ ...prev, dayIn: undefined })) }} className={`mt-1 w-full form-input ${errors.dayIn ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
                {errors.dayIn && <p className="mt-1 text-xs text-red-500">{errors.dayIn}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-600">Time In</label>
                <input type="time" value={form.timeIn} onChange={e => setForm({ ...form, timeIn: e.target.value })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Out (Date)</label>
                <input type="date" value={form.dayOut} onChange={e => setForm({ ...form, dayOut: e.target.value })} className="mt-1 w-full form-input" />
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
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold">Uploaded Attendance Preview ({uploadRows.length})</h3>
            <button type="button" className="text-sm text-slate-500 hover:text-slate-900" onClick={() => setUploadRows([])}>Clear</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">EPF No</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Time In</th>
                  <th className="px-3 py-2">Time Out</th><th className="px-3 py-2">Working Days</th><th className="px-3 py-2">Total Hours</th>
                  <th className="px-3 py-2">Total OT</th><th className="px-3 py-2">Meals</th><th className="px-3 py-2">Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploadRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.epfNo}</td>
                    <td className="px-3 py-2"><input type="date" value={row.dayIn || ''} onChange={e => updateUploadRow(index, { dayIn: e.target.value })} className="form-input w-36" /></td>
                    <td className="px-3 py-2"><input type="time" step="1" value={row.timeIn || ''} onChange={e => updateUploadRow(index, { timeIn: e.target.value })} className="form-input w-28" /></td>
                    <td className="px-3 py-2"><input type="time" step="1" value={(row.timeOut || '').slice(0, 8)} onChange={e => updateUploadRow(index, { timeOut: e.target.value })} className="form-input w-28" /></td>
                    <td className="px-3 py-2"><NumericInput integer value={row.workingDays ?? ''} onChange={e => updateUploadRow(index, { workingDays: Number(e.target.value || 0) })} className="form-input w-24" /></td>
                    <td className="px-3 py-2"><NumericInput value={row.totalWorkingHours ?? ''} onChange={e => updateUploadRow(index, { totalWorkingHours: Number(e.target.value || 0) })} className="form-input w-24" /></td>
                    <td className="px-3 py-2"><NumericInput value={row.totalOt ?? ''} onChange={e => updateUploadRow(index, { totalOt: Number(e.target.value || 0) })} className="form-input w-20" /></td>
                    <td className="px-3 py-2"><NumericInput integer value={row.noOfMeal ?? ''} onChange={e => updateUploadRow(index, { noOfMeal: Number(e.target.value || 0) })} className="form-input w-20" /></td>
                    <td className="px-3 py-2">
                      <select value={row.dayShift === 'Y' ? 'Day' : row.secondShift === 'Y' ? '2nd' : row.nightShift === 'Y' ? 'Night' : 'Full Night'} onChange={e => {
                        const shift = e.target.value
                        updateUploadRow(index, { dayShift: shift === 'Day' ? 'Y' : 'N', secondShift: shift === '2nd' ? 'Y' : 'N', nightShift: shift === 'Night' ? 'Y' : 'N', fullNight: shift === 'Full Night' ? 'Y' : 'N' })
                      }} className="form-input w-28">
                        <option>Day</option><option>2nd</option><option>Night</option><option>Full Night</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmDialog open={!!confirm} title="Delete Entry" message="Are you sure you want to delete this attendance log?" onConfirm={handleDeleteConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
