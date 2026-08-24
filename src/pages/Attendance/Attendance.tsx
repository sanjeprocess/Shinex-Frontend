import React, { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Sun, Sunset, Moon, Star } from 'lucide-react'
import SearchInput from '../../components/SearchInput'
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
  remove as removeAttendance,
  Attendance
} from '../../mocks/attendance'
import { v4 as uuid } from 'uuid'

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
    dayOut: new Date().toISOString().split('T')[0],
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

  useEffect(() => {
    refresh()
    listEmployees().then(setEmployeeList)
    listCustomers().then(setCustomerList)
    listBC().then(setBcList)
  }, [])

  function refresh() {
    listAttendance().then(setRows)
  }

  // Add flow
  function handleAdd() {
    const empty = { ...defaultForm }
    empty.businessCenter = localStorage.getItem('hsb_active_bc') || empty.businessCenter
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
    if (!String(form.epfNo || '').trim()) next.epfNo = 'Employee is required'
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

    const { hours, ot } = computeHours(form.timeIn, form.timeOut)
    const toSave: Attendance = {
      ...form,
      totalWorkingHours: hours,
      totalOt: ot
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
    } catch (err) {
      console.error('Save failed', err)
      toast.error('Save failed')
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
  function handleEmployeeChange(epf: string | null) {
    if (!epf) return
    const emp = employeeList.find(e => e.epfNo === epf)
    if (emp) {
      setForm(prev => ({
        ...prev,
        epfNo: epf,
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
    return computeHours(form.timeIn, form.timeOut)
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
                <input type="number" value={form.workingDays || 0} onChange={e => setForm({ ...form, workingDays: Number(e.target.value) })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-slate-600">No Of Staff (Plant)</label>
                <input type="number" value={form.noOfStaff || 0} onChange={e => setForm({ ...form, noOfStaff: Number(e.target.value) })} className="mt-1 w-full form-input" />
              </div>
              <div>
                <label className="block text-slate-600">Das for Att Allowance</label>
                <input type="number" value={form.dasForAttAllowance || 0} onChange={e => setForm({ ...form, dasForAttAllowance: Number(e.target.value) })} className="mt-1 w-full form-input" />
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
                <input type="number" value={form.basicSalary || 0} onChange={e => setForm({ ...form, basicSalary: Number(e.target.value) })} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Day Allowance</label>
                <input type="number" value={form.dayAllowance || 0} onChange={e => setForm({ ...form, dayAllowance: Number(e.target.value) })} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Night Allowance</label>
                <input type="number" value={form.nightAllowance || 0} onChange={e => setForm({ ...form, nightAllowance: Number(e.target.value) })} className="mt-1 w-full form-input text-right font-mono mono-numeric" />
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
                <input type="number" value={form.sundayPoyaExtra || 0} onChange={e => setForm({ ...form, sundayPoyaExtra: Number(e.target.value) })} className="w-full form-input" />
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
                <input type="number" value={form.noOfMeal || 0} onChange={e => setForm({ ...form, noOfMeal: Number(e.target.value) })} className="mt-1 w-full form-input text-right mono-numeric" />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Total Meal Value</label>
                <input type="number" value={form.totalMealValue || 0} onChange={e => setForm({ ...form, totalMealValue: Number(e.target.value) })} className="mt-1 w-full form-input text-right mono-numeric" />
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

      <ConfirmDialog open={!!confirm} title="Delete Entry" message="Are you sure you want to delete this attendance log?" onConfirm={handleDeleteConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
