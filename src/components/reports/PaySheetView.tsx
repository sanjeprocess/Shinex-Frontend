import React, { forwardRef } from 'react'
import { FileText } from 'lucide-react'
import type { jsPDF } from 'jspdf'
import type { MonthlySummary } from '../../mocks/monthlySummary'

export type PaySheetSize = 'A4' | 'A5'

// Pay sheet figures, taken from the backend Monthly Summary
export function payrollFromSummary(monthlyData: MonthlySummary, employee: any) {
  const normalDays = monthlyData.normalDays !== undefined ? monthlyData.normalDays : (monthlyData.attendance?.workingDays || 0)
  const normalRate = monthlyData.normalRate !== undefined ? monthlyData.normalRate : (monthlyData.basicSalary || Number(employee.basicSalary || 840))
  const normalAmount = monthlyData.normalAmount !== undefined ? monthlyData.normalAmount : Math.round(normalDays * normalRate * 100) / 100

  const nightDays = monthlyData.nightDays !== undefined ? monthlyData.nightDays : 0
  const nightRate = monthlyData.nightRate !== undefined ? monthlyData.nightRate : (monthlyData.nightAllowance || Number(employee.nightAllowance || 0))
  const nightAmount = monthlyData.nightAmount !== undefined ? monthlyData.nightAmount : (nightDays > 0 ? Math.round(nightDays * nightRate * 100) / 100 : 0)

  const poyaDays = monthlyData.poyaDays !== undefined ? monthlyData.poyaDays : 0
  const poyaRate = monthlyData.poyaRate !== undefined ? monthlyData.poyaRate : Math.round(normalRate * 1.5 * 100) / 100
  const poyaAmount = monthlyData.poyaAmount !== undefined ? monthlyData.poyaAmount : (poyaDays > 0 ? (monthlyData.poyaDayExtra || 0) : 0)

  const otHours = monthlyData.overtimeHours !== undefined ? monthlyData.overtimeHours : (monthlyData.attendance?.otHours || 0)
  const otRate = monthlyData.overtimeRate !== undefined ? monthlyData.overtimeRate : (monthlyData.attendance?.otRate || Math.round((normalRate / 8 * 1.5) * 100) / 100)
  const otAmount = otHours > 0 ? (monthlyData.overtimeAmount !== undefined ? monthlyData.overtimeAmount : Math.round(otHours * otRate * 100) / 100) : 0

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

  // Night shift days are shown on the Night line with their day pay; the totals above stay as calculated
  const nightNormalDays = Math.max(0, Math.min(normalDays, nightDays,
    monthlyData.nightNormalDays !== undefined ? monthlyData.nightNormalDays : (poyaDays > 0 ? 0 : nightDays)))
  const nightDayPay = Math.round(nightNormalDays * normalRate * 100) / 100
  // Day off days are shown on the Day Off line at the basic day rate; the totals stay as calculated
  const dayOffDays = Math.max(0, Math.min(normalDays - nightNormalDays, Number(monthlyData.dayOffDays || 0)))
  const dayOffAmount = Math.round(dayOffDays * normalRate * 100) / 100
  const shownNormalDays = Math.round((normalDays - nightNormalDays - dayOffDays) * 100) / 100
  const shownNormalAmount = Math.round((normalAmount - nightDayPay - dayOffAmount) * 100) / 100
  const shownNightAmount = Math.round((nightAmount + nightDayPay) * 100) / 100
  const shownNightRate = nightNormalDays > 0 && nightDays > 0 ? Math.round(shownNightAmount / nightDays * 100) / 100 : nightRate

  return {
    basicSalary: normalRate,
    normalDays: shownNormalDays,
    normalRate,
    normalAmount: shownNormalAmount,
    dayOffDays,
    dayOffRate: normalRate,
    dayOffAmount,
    nightDays,
    nightRate: shownNightRate,
    nightAmount: shownNightAmount,
    poyaDays,
    poyaRate,
    poyaAmount,
    // OT is by the minute: hours to two decimals (2 h 02 min = 2.03)
    otHours: Math.round(otHours * 100) / 100,
    otRate,
    otAmount,
    incentive,
    statutoryDays: monthlyData.attendance?.statutoryHolidayCount || 0,
    statutoryHolidayAmount,
    // OT worked on statutory holidays: (Daily Rate / 9) x 2, already in statutoryHolidayAmount
    statutoryOtHours: Math.round(Number(monthlyData.statutoryOtHours || 0) * 100) / 100,
    statutoryOtRate: Number(monthlyData.statutoryOtRate || 0),
    // Statutory holiday pay on two lines: the Working / Not Working value, and the holiday OT (2x)
    statutoryOtAmount: Number(monthlyData.statutoryOtAmount || 0),
    statutoryValueAmount: Math.round((statutoryHolidayAmount - Number(monthlyData.statutoryOtAmount || 0)) * 100) / 100,
    // Shown on the pay sheet: days worked and every OT hour (normal and statutory holiday)
    workingDays: Number(monthlyData.attendance?.workingDays || 0),
    totalOtHours: Math.round((monthlyData.totalOtHours !== undefined ? Number(monthlyData.totalOtHours) : otHours + Number(monthlyData.statutoryOtHours || 0)) * 100) / 100,
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

export type PayrollCalculation = ReturnType<typeof payrollFromSummary>

// Fixed render width so A4 and A5 get the same layout, independent of the screen size
export async function renderPaySheetCanvas(element: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  // html2canvas places text using a tiny gif it adds to this page. Tailwind's img { display: block }
  // spoils that measurement and every line is drawn too low, so only that gif is put back inline
  const textMeasureFix = document.createElement('style')
  textMeasureFix.textContent = 'img[src^="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP"] { display: inline-block !important; }'
  document.head.appendChild(textMeasureFix)
  try {
    return await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: 1000,
      onclone: (doc: Document) => {
        // ~680px wide fills a portrait page with readable text; taller sheets are scaled down below
        const el = doc.querySelector('[data-paysheet]') as HTMLElement | null
        if (el) el.style.width = '680px'
      }
    })
  } finally {
    textMeasureFix.remove()
  }
}

export async function newPaySheetPdf(size: PaySheetSize) {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: size.toLowerCase() })
}

// Draws one pay sheet on the current PDF page: the sheet is scaled to fit the page, never split
export function drawPaySheetPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  { companyName, month, year, size }: { companyName: string; month: string; year: string; size: PaySheetSize }
) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = size === 'A4' ? 10 : 6
  const scale = size === 'A4' ? 1 : 0.8

  // Header as PDF text: company, title and period
  let y = margin + 5 * scale
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14 * scale)
  pdf.text((companyName || 'Employee Pay Sheet').toUpperCase(), margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9 * scale)
  pdf.text(`Period: ${month.padStart(2, '0')}/${year}`, pageW - margin, y, { align: 'right' })
  y += 5 * scale
  pdf.text(`EMPLOYEE PAY SHEET  -  ${size}`, margin, y)
  if (companyName) pdf.text(`Company: ${companyName}`, pageW - margin, y, { align: 'right' })
  y += 2.5 * scale
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageW - margin, y)
  y += 3

  // Fit the sheet in the space left: full width, or smaller if it is taller than the page
  const availW = pageW - margin * 2
  const availH = pageH - margin - y
  const ratio = canvas.width / canvas.height
  let w = availW
  let h = w / ratio
  if (h > availH) {
    h = availH
    w = h * ratio
  }
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', (pageW - w) / 2, y, w, h)
}

interface PaySheetViewProps {
  employee: any
  calc: PayrollCalculation | null
  month: string
  year: string
  activeBc: string
}

const PaySheetView = forwardRef<HTMLDivElement, PaySheetViewProps>(function PaySheetView({ employee, calc, month, year, activeBc }, ref) {
  return (
    <div ref={ref} data-paysheet className="space-y-5 print:space-y-2 bg-white">
    {/* Master Employee Summary Card */}
    <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 print:p-2 print:rounded-lg print:border-slate-300 print-page-break-avoid">
      <div className="flex items-center gap-4 mb-3 pb-3 border-b print:mb-1.5 print:pb-1.5 print:gap-2">
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
          <p className="text-xs text-slate-500 mt-0.5 print:hidden">
            NIC: <strong className="text-slate-700">{employee.nicNo || '—'}</strong> &bull; Section: <strong className="text-slate-700">{employee.sectionCode || '—'}</strong> &bull; BC: <strong className="text-slate-700">{employee.businessCenter || activeBc}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs print:grid-cols-4 print:text-[9px] print:gap-x-1.5 print:gap-y-0.5">
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
    {calc && (
      <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden print:rounded-lg print:border-slate-300 print-page-break-avoid">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between print:bg-slate-800 print:py-1.5">
          <div>
            <h3 className="font-bold text-xs tracking-wide flex items-center gap-1.5 text-emerald-400 print:text-[10px]">
              <FileText size={14} />
              PAY SHEET &bull; {month.padStart(2, '0')}/{year}
            </h3>
            <p className="text-[11px] text-slate-300 print:text-[8px]">
              NAME & EPF: {employee.firstName} {employee.lastName || ''} - {employee.epfNo}
            </p>
          </div>
          <span className="text-xs bg-emerald-900/90 text-emerald-200 px-3 py-1 rounded-full border border-emerald-600 font-mono font-bold print:text-[9px] print:py-0.5">
            Net Salary: LKR {calc.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Earnings Table */}
        <div className="p-3 border-b border-slate-200 print:p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 print:text-[9px]">
              Earnings & Allowances / கொடுப்பனவுகள் / ඉපැයීම්
            </h4>
            <span className="text-[11px] font-semibold text-slate-700 print:text-[8.5px]">
              Working Days: <span className="font-mono">{calc.workingDays}</span>
              <span className="text-slate-300 mx-1.5">|</span>
              OT Hours: <span className="font-mono text-amber-800">{calc.totalOtHours}</span>
            </span>
          </div>
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
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">NORMAL / பொது / සාමාන්‍ය</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-700">{calc.normalDays}</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-700">{calc.normalRate.toFixed(2)}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.normalAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">DAY OFF / விடுமுறை நாள் / නිවාඩු දිනය</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-700">{calc.dayOffDays > 0 ? calc.dayOffDays : '—'}</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-700">{calc.dayOffDays > 0 ? calc.dayOffRate.toFixed(2) : '—'}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.dayOffAmount > 0 ? calc.dayOffAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">NIGHT / இரவு / රාත්‍රී</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-700">{calc.nightDays > 0 ? calc.nightDays : '—'}</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-700">{calc.nightDays > 0 ? calc.nightRate.toFixed(2) : (calc.nightRate > 0 ? calc.nightRate.toFixed(2) : '—')}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.nightAmount > 0 ? calc.nightAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-700">{calc.poyaDays > 0 ? calc.poyaDays : '—'}</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-700">{calc.poyaDays > 0 ? calc.poyaRate.toFixed(2) : '—'}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.poyaAmount > 0 ? calc.poyaAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">OVERTIME / மேலதிக நேரம் / අතිකාල (1.5× rate)</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-amber-700 font-bold">{calc.otHours > 0 ? calc.otHours : '—'}</td>
                  <td className={`px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap ${calc.otHours > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{calc.otHours > 0 ? calc.otRate.toFixed(2) : '—'}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-amber-900">{calc.otAmount > 0 ? calc.otAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.incentive > 0 ? calc.incentive.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-700">{calc.statutoryDays || '—'}</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.statutoryValueAmount > 0 ? calc.statutoryValueAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">STATUTORY HOLIDAY OT / சட்டப்பூர்வ விடுமுறை மேலதிக நேரம் / ව්‍යවස්ථාපිත නිවාඩු අතිකාල (2× rate)</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className={`px-2 py-1 print:py-[1px] text-center ${calc.statutoryOtHours > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>{calc.statutoryOtHours > 0 ? calc.statutoryOtHours : '—'}</td>
                  <td className={`px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap ${calc.statutoryOtHours > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{calc.statutoryOtHours > 0 ? calc.statutoryOtRate.toFixed(2) : '—'}</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-amber-900">{calc.statutoryOtAmount > 0 ? calc.statutoryOtAmount.toFixed(2) : '—'}</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1 print:py-[1px] font-sans font-medium text-slate-800">OTHER ADDITIONS / மற்றவை / වෙනත් එකතු කිරීම්</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2 py-1 print:py-[1px] text-center text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap text-slate-400">—</td>
                  <td className="px-2.5 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-900">{calc.totalAdditions > 0 ? calc.totalAdditions.toFixed(2) : '—'}</td>
                </tr>
                <tr className="bg-emerald-50 font-bold font-sans border-t-2 border-emerald-300 print:bg-slate-100">
                  <td className="px-2.5 py-1.5 print:py-0.5 text-emerald-950 font-bold" colSpan={4}>GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප</td>
                  <td className="px-2.5 py-1.5 print:py-0.5 text-right whitespace-nowrap text-emerald-950 font-mono font-bold">LKR {calc.grossSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions & Company Contributions */}
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-[3fr_2fr] print:p-2 print:gap-2">
          <div className="border border-slate-200 rounded-xl overflow-hidden print:rounded print:border-slate-300">
            <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 font-bold text-rose-900 text-[11px] uppercase tracking-wider print:text-[8.5px] print:py-1">
              Deductions / கழிவுகள் / අඩු කිරීම්
            </div>
            <table className="w-full text-left text-xs divide-y divide-slate-100 font-mono print:text-[8.5px]">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-rose-700">LKR {calc.epf8.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">ADVANCE / முற்பணம் / අත්තිකාරම්</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">{calc.advance > 0 ? `LKR ${calc.advance.toFixed(2)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">TELEPHONE / தொலைபேசி / දුරකථනය</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">{calc.telephone > 0 ? `LKR ${calc.telephone.toFixed(2)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">MEAL / உணவு / ආහාරය</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">{calc.meal > 0 ? `LKR ${calc.meal.toFixed(2)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">LOAN / கடன் / ණය</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">{calc.loan > 0 ? `LKR ${calc.loan.toFixed(2)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර</td>
                  <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">{calc.deathDonation > 0 ? `LKR ${calc.deathDonation.toFixed(2)}` : '—'}</td>
                </tr>
                <tr className="bg-rose-50 font-bold font-sans border-t border-rose-200 print:bg-slate-100">
                  <td className="px-3 py-1.5 print:py-0.5 text-rose-950 font-bold">TOTAL DEDUCTION / மொத்த கழிவு</td>
                  <td className="px-3 py-1.5 print:py-0.5 text-right whitespace-nowrap text-rose-950 font-mono font-bold">LKR {calc.totalDeductions.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
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
                    <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">E.P.F. 12% (Company) / ஊ.சே.நி. 12%</td>
                    <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">LKR {calc.epf12.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1 print:py-[1px] font-sans text-slate-700">E.T.F. 3% (Company) / ஊ.பொ.நி. 3%</td>
                    <td className="px-3 py-1 print:py-[1px] text-right whitespace-nowrap font-semibold text-slate-800">LKR {calc.etf3.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between font-sans print:p-2">
              <span className="font-bold text-xs text-emerald-950 print:text-[9px]">FINAL NET SALARY:</span>
              <span className="font-mono text-sm font-black text-emerald-900 print:text-xs">
                LKR {calc.netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  )
})

export default PaySheetView
