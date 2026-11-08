import type { PayrollCalculation } from '../components/reports/PaySheetView'
import { displayTime } from './easyTime'

const NAVY = 'FF0F172A'
const GREEN_TEXT = 'FF065F46'
const GREEN_FILL = 'FFD1FAE5'
const ROSE_TEXT = 'FF881337'
const ROSE_FILL = 'FFFFE4E6'
const SLATE_FILL = 'FFF1F5F9'
const LINE = 'FFCBD5E1'
const MONEY = '#,##0.00;-#,##0.00;"-"'
const QUANTITY = '0.##;-0.##;"-"'

export type PaySheetExcelData = {
  companyName: string
  month: string
  year: string
  employee: any
  calc: PayrollCalculation
  activeBc: string
  plantFilter: string
  attendance: any[]
  transfers: any[]
  additions: any[]
  deductions: any[]
  leaves: any[]
  loans: any[]
}

const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const hairline = { top: { style: 'thin' as const, color: { argb: LINE } }, bottom: { style: 'thin' as const, color: { argb: LINE } }, left: { style: 'thin' as const, color: { argb: LINE } }, right: { style: 'thin' as const, color: { argb: LINE } } }
const numberOr = (value: unknown) => (value === '' || value == null || Number.isNaN(Number(value)) ? value ?? '' : Number(value))

/** One workbook: the pay sheet laid out for printing on one page, and the employee's records on a second sheet. */
export async function downloadPaySheetExcel(data: PaySheetExcelData, fileName: string) {
  const { default: ExcelJS } = await import('exceljs')
  const { companyName, month, year, employee, calc, activeBc, plantFilter } = data
  const workbook = new ExcelJS.Workbook()
  const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
  const period = `${month.padStart(2, '0')}/${year}`

  // ---------- Pay Sheet
  const sheet = workbook.addWorksheet('Pay Sheet', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0, footer: 0 } }
  })
  sheet.columns = [{ width: 62 }, { width: 9 }, { width: 9 }, { width: 13 }, { width: 16 }]

  const band = (text: string, color: string, background: string) => {
    const row = sheet.addRow([text])
    sheet.mergeCells(row.number, 1, row.number, 5)
    row.height = 20
    row.getCell(1).font = { bold: true, color: { argb: color } }
    row.getCell(1).fill = fill(background)
    row.getCell(1).alignment = { vertical: 'middle', wrapText: true }
    return row
  }
  // Label + day + hour + rate + amount; zero shows as "-" through the number format
  const line = (label: string, day?: number | null, hour?: number | null, rate?: number | null, amount?: number | null) => {
    const row = sheet.addRow([label, day ?? null, hour ?? null, rate ?? null, amount ?? null])
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.border = hairline
      cell.alignment = { vertical: 'middle', horizontal: column === 1 ? 'left' : 'right', wrapText: column === 1 }
    })
    row.getCell(2).numFmt = QUANTITY
    row.getCell(3).numFmt = QUANTITY
    row.getCell(4).numFmt = MONEY
    row.getCell(5).numFmt = MONEY
    return row
  }
  const total = (label: string, amount: number, color: string, background: string, size = 11) => {
    const row = line(label, null, null, null, amount)
    row.height = size > 11 ? 24 : 20
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, color: { argb: color }, size }
      cell.fill = fill(background)
    })
    return row
  }

  const title = sheet.addRow([(companyName || 'Employee Pay Sheet').toUpperCase()])
  sheet.mergeCells(title.number, 1, title.number, 3)
  sheet.mergeCells(title.number, 4, title.number, 5)
  title.height = 26
  title.getCell(1).font = { bold: true, size: 15, color: { argb: NAVY } }
  title.getCell(1).alignment = { vertical: 'middle' }
  title.getCell(4).value = `Period: ${period}`
  title.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }

  const subtitle = band(`EMPLOYEE PAY SHEET  ·  ${fullName} - ${employee.epfNo}`, 'FFFFFFFF', NAVY)
  subtitle.height = 24

  const details: [string, unknown, string, unknown][] = [
    ['NIC No', employee.nicNo || '—', 'Business Center', employee.businessCenter || activeBc],
    ['Current Plant', employee.plantCode || '—', 'Section', employee.sectionCode || '—'],
    ['Daily Rate (Normal)', Number(employee.basicSalary || 0), 'Hired Date', employee.hiredDate || '—'],
    ['Bank Account', `${employee.bankName || 'Bank'} — ${employee.bankAccountNumber || '—'}`, 'Plant Filter', plantFilter]
  ]
  details.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
    const row = sheet.addRow([`${leftLabel}:  ${typeof leftValue === 'number' ? `LKR ${leftValue.toLocaleString()}` : leftValue}`, null, null, `${rightLabel}:  ${rightValue}`])
    sheet.mergeCells(row.number, 1, row.number, 3)
    sheet.mergeCells(row.number, 4, row.number, 5)
    row.getCell(1).font = { color: { argb: NAVY } }
    row.getCell(4).font = { color: { argb: NAVY } }
    row.getCell(4).alignment = { wrapText: true }
  })
  sheet.addRow([])

  band('EARNINGS & ALLOWANCES / கொடுப்பனவுகள் / ඉපැයීම්', GREEN_TEXT, GREEN_FILL)
  const header = sheet.addRow(['Description / விவரம் / විස්තරය', 'Day', 'Hour', 'Rate (LKR)', 'Amount (LKR)'])
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: NAVY } }
    cell.fill = fill(SLATE_FILL)
    cell.border = hairline
  })
  ;[2, 3, 4, 5].forEach(column => { header.getCell(column).alignment = { horizontal: 'right', vertical: 'middle', wrapText: true } })
  line('NORMAL / பொது / සාමාන්‍ය', calc.normalDays, null, calc.normalRate, calc.normalAmount)
  line('NIGHT / இரவு / රාත්‍රී', calc.nightDays, null, calc.nightRate, calc.nightAmount)
  line('POYA / SUNDAY / ஞாயிறு / போயா / ඉරිදා / පෝය', calc.poyaDays, null, calc.poyaRate, calc.poyaAmount)
  line('OVERTIME / மேலதிக நேரம் / අතිකාල (1.5× rate)', null, calc.otHours, calc.otRate, calc.otAmount)
  line('INCENTIVE / ஊக்கத்தொகை / දිරිගැන්වීම් දීමනාව', null, null, null, calc.incentive)
  line('ATTENDANCE ALLOWANCE / கலந்துகொள்ளல் படி / පැමිණීමේ දීමනාව')
  line('ATTENDANCE BONUS / வருகை போனஸ் / පැමිණීමේ බෝනස්')
  line('STATUTORY HOLIDAY / சட்டப்பூர்வ விடுமுறை / ව්‍යවස්ථාපිත නිවාඩු', calc.statutoryDays, calc.statutoryOtHours || null, calc.statutoryOtHours > 0 ? calc.statutoryOtRate : null, calc.statutoryHolidayAmount)
  line('OTHER ADDITIONS / மற்றவை / වෙනත් එකතු කිරීම්', null, null, null, calc.totalAdditions)
  total('GROSS SALARY / மொத்த சம்பளம் / දළ වැටුප', calc.grossSalary, GREEN_TEXT, GREEN_FILL)
  sheet.addRow([])

  band('DEDUCTIONS / கழிவுகள் / අඩු කිරීම්', ROSE_TEXT, ROSE_FILL)
  line('E.P.F. 8% / ஊ.சே.நி. 8% / සේ.අ.අ. 8%', null, null, null, calc.epf8)
  line('ADVANCE / முற்பணம் / අත්තිකාරම්', null, null, null, calc.advance)
  line('TELEPHONE / தொலைபேசி / දුරකථනය', null, null, null, calc.telephone)
  line('MEAL / உணவு / ආහාරය', null, null, null, calc.meal)
  line('ABSENT / வராதிருத்தல் / නොපැමිණීම', null, null, null, calc.absent)
  line('LOAN / கடன் / ණය', null, null, null, calc.loan)
  line('DEATH DONATION / இறப்பு நன்கொடை / මරණ ආධාර', null, null, null, calc.deathDonation)
  total('TOTAL DEDUCTION / மொத்த கழிவு / මුළු අඩුකිරීම', calc.totalDeductions, ROSE_TEXT, ROSE_FILL)
  sheet.addRow([])

  total('NET SALARY / நிகர சம்பளம் / ශුද්ධ වැටුප', calc.netSalary, 'FFFFFFFF', NAVY, 13)
  sheet.addRow([])

  band('COMPANY CONTRIBUTION / நிறுவன பங்களிப்பு / සමාගම් දායකත්වය', NAVY, SLATE_FILL)
  line('E.P.F. 12% / ஊ.சே.நி. 12% / සේ.අ.අ. 12%', null, null, null, calc.epf12)
  line('E.T.F. 3% / ஊ.பொ.நி. 3% / සේ.අ.අ.අ. 3%', null, null, null, calc.etf3)

  // ---------- Records
  const records = workbook.addWorksheet('Records', { views: [{ showGridLines: false }] })
  records.columns = [{ width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }]
  const section = (name: string, headers: string[], rows: unknown[][]) => {
    const heading = records.addRow([name])
    records.mergeCells(heading.number, 1, heading.number, 7)
    heading.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    heading.getCell(1).fill = fill(NAVY)
    const head = records.addRow(headers)
    head.eachCell(cell => {
      cell.font = { bold: true, color: { argb: NAVY } }
      cell.fill = fill(SLATE_FILL)
      cell.border = hairline
    })
    if (!rows.length) records.addRow(['No records']).getCell(1).font = { italic: true, color: { argb: 'FF64748B' } }
    rows.forEach(values => records.addRow(values).eachCell(cell => { cell.border = hairline }))
    records.addRow([])
  }
  section('Attendance History', ['Date', 'Time In', 'Time Out', 'Total Hours', 'OT Hours', 'Plant Code', 'Business Center'],
    data.attendance.map(a => [a.dayIn, displayTime(a.timeIn), displayTime(a.timeOut), numberOr(a.totalWorkingHours ?? 0), numberOr(a.totalOt ?? 0), a.plantCode || '', a.businessCenter || '']))
  section('Plant Transfer Movements', ['Transfer Date', 'From Plant', 'To Plant', 'Duration Days', 'Status', 'Work Details'],
    data.transfers.map(t => [t.transferDate, t.fromPlant || '', t.toPlant || '', numberOr(t.daysWorked || 1), t.status || 'Active', t.workDetails || '']))
  section('Additions History', ['Code', 'Amount', 'Month', 'Year', 'Every Month'],
    data.additions.map(a => [a.addCode, numberOr(a.addAmount), a.addMonth, a.addYear, a.everyMonth || 'N']))
  section('Deductions History', ['Code', 'Amount', 'Month', 'Year', 'Every Month'],
    data.deductions.map(d => [d.didCode, numberOr(d.didAmount), d.addMonth, d.addYear, d.everyMonth || 'N']))
  section('Leave History', ['Type', 'Start Date', 'End Date', 'Days', 'Year', 'Month'],
    data.leaves.map(l => [l.leaveType, l.start || l.leaveStartDate || '', l.end || l.leaveEndDate || '', numberOr(l.leaveDays || 0), l.leaveYear || '', l.leaveMonth || '']))
  section('Loan History', ['Loan ID', 'Amount', 'Start Date', 'Duration Months', 'Business Unit'],
    data.loans.map(l => [l.loanId, numberOr(l.loanAmount), l.loanStartDate, numberOr(l.loanDuration), l.businessUnit || '']))

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
