import React, { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import api from '../../api/axios'
import ReportFilters, { employeeFullName, plantKey, useReportFilters } from '../../components/reports/ReportFilters'
import PaySheetView, { drawPaySheetPage, newPaySheetPdf, payrollFromSummary, renderPaySheetCanvas, type PayrollCalculation, type PaySheetSize } from '../../components/reports/PaySheetView'
import type { MonthlySummary } from '../../mocks/monthlySummary'
import { formatCurrency } from '../../utils/reportHelpers'

type ResultRow = {
  epfNo: string
  name: string
  plant: string
  status: 'Included' | 'No pay this month' | 'Could not load'
  days?: number
  gross?: number
  deductions?: number
  net?: number
}

const STATUS_CLASS: Record<ResultRow['status'], string> = {
  Included: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'No pay this month': 'bg-slate-50 text-slate-600 border-slate-200',
  'Could not load': 'bg-rose-50 text-rose-700 border-rose-200',
}

/** One action: a single PDF holding one pay sheet page for every employee of the selection. */
export default function EmployeePaySheetsPage() {
  const filters = useReportFilters()
  const { year, month, plant, businessCenter, businessCenters, employees } = filters

  const [running, setRunning] = useState<PaySheetSize | null>(null)
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<ResultRow[]>([])
  const [sheet, setSheet] = useState<{ employee: any; calc: PayrollCalculation } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setResults([])
  }, [year, month, plant, businessCenter])

  const selected = useMemo(() => {
    const byEpf = new Map<string, any>()
    employees.forEach(e => {
      const key = (e.epfNo || '').trim().toUpperCase()
      if (key && !byEpf.has(key) && (!plant || plantKey(e.plantCode) === plantKey(plant))) byEpf.set(key, e)
    })
    return Array.from(byEpf.values()).sort((a, b) =>
      plantKey(a.plantCode).localeCompare(plantKey(b.plantCode)) ||
      a.epfNo.localeCompare(b.epfNo, undefined, { numeric: true })
    )
  }, [employees, plant])

  const companyOf = (employee: any) => {
    const code = (employee.businessCenter || '').split(' / ')[0].trim()
    return businessCenters.find((c: any) => c.code === code || c.name === code)?.name || ''
  }

  async function downloadAll(size: PaySheetSize) {
    const total = selected.length
    if (!total) {
      toast.error('No employees for the selected filters')
      return
    }
    setRunning(size)
    setResults([])
    try {
      // A failed summary is reported; a pay sheet is never printed from guessed figures
      const summaries: (MonthlySummary | null)[] = new Array(total).fill(null)
      let loaded = 0
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < total && mounted.current) {
          const index = nextIndex++
          try {
            const response = await api.get<MonthlySummary>('/process/monthly-summary', {
              params: { epfNo: selected[index].epfNo, year, month }
            })
            summaries[index] = response.data
          } catch (err) {
            console.error('Monthly summary failed', selected[index].epfNo, err)
          }
          loaded++
          setProgress(`Loading pay ${loaded} of ${total}...`)
        }
      }
      await Promise.all(Array.from({ length: 6 }, worker))
      if (!mounted.current) return

      const rows: ResultRow[] = []
      const printable: { employee: any; calc: PayrollCalculation }[] = []
      selected.forEach((emp, index) => {
        const base = { epfNo: emp.epfNo, name: employeeFullName(emp), plant: emp.plantCode || '' }
        const summary = summaries[index]
        if (!summary) {
          rows.push({ ...base, status: 'Could not load' })
          return
        }
        const days = Number(summary.attendance?.workingDays || 0)
        if (days === 0 && Number(summary.grossSalary || 0) === 0) {
          rows.push({ ...base, status: 'No pay this month' })
          return
        }
        const employee = { ...emp, basicSalary: summary.basicSalary ?? emp.basicSalary }
        const calc = payrollFromSummary(summary, employee)
        printable.push({ employee, calc })
        rows.push({ ...base, status: 'Included', days, gross: calc.grossSalary, deductions: calc.totalDeductions, net: calc.netSalary })
      })
      setResults(rows)

      if (!printable.length) {
        toast.error('No employee has pay for this month')
        return
      }

      const pdf = await newPaySheetPdf(size)
      for (let i = 0; i < printable.length; i++) {
        if (!mounted.current) return
        setProgress(`Creating page ${i + 1} of ${printable.length}...`)
        await new Promise(resolve => setTimeout(resolve))
        flushSync(() => setSheet(printable[i]))
        const canvas = await renderPaySheetCanvas(sheetRef.current as HTMLElement)
        if (i > 0) pdf.addPage()
        drawPaySheetPage(pdf, canvas, { companyName: companyOf(printable[i].employee), month, year, size })
        canvas.width = 0
        canvas.height = 0
      }
      pdf.save(`Employee_Pay_Sheets_${year}_${month}${plant ? `_${plantKey(plant)}` : ''}_${size}.pdf`)

      const failed = rows.filter(r => r.status === 'Could not load').length
      if (failed) toast.error(`${printable.length} pay sheets created, but ${failed} could not load. See the list below.`)
      else toast.success(`${printable.length} pay sheets created`)
    } catch (err) {
      console.error('Bulk pay sheet PDF failed', err)
      toast.error('Could not create the pay sheet PDF')
    } finally {
      if (mounted.current) {
        setRunning(null)
        setProgress('')
        setSheet(null)
      }
    }
  }

  const included = results.filter(r => r.status === 'Included')
  const totals = included.reduce((acc, r) => ({
    gross: acc.gross + (r.gross || 0),
    deductions: acc.deductions + (r.deductions || 0),
    net: acc.net + (r.net || 0),
  }), { gross: 0, deductions: 0, net: 0 })

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-flat border border-slate-200 space-y-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">All Employee Pay Sheets</h1>
          <p className="text-xs text-slate-500 mt-0.5">One PDF with one page for every employee. Employees with no pay this month are left out.</p>
        </div>
        <fieldset disabled={running !== null} className="flex flex-wrap items-center gap-3">
          <ReportFilters filters={filters} />
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          {(['A4', 'A5'] as PaySheetSize[]).map(size => (
            <button
              key={size}
              type="button"
              onClick={() => downloadAll(size)}
              disabled={running !== null || selected.length === 0}
              className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md disabled:opacity-50"
            >
              <Download size={16} />
              <span>{running === size ? 'Creating PDF...' : `Download All ${size} PDF`}</span>
            </button>
          ))}
          <span className="text-xs text-slate-600" aria-live="polite">
            {progress || `${selected.length} employee${selected.length === 1 ? '' : 's'} selected`}
          </span>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2">EPF</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Plant</th>
                <th className="px-3 py-2">PDF</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Deductions</th>
                <th className="px-3 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.epfNo}>
                  <td className="px-3 py-1.5 font-mono">{r.epfNo}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5">{r.plant}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{r.days ?? ''}</td>
                  <td className="px-3 py-1.5 text-right">{r.gross != null ? formatCurrency(r.gross) : ''}</td>
                  <td className="px-3 py-1.5 text-right">{r.deductions != null ? formatCurrency(r.deductions) : ''}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{r.net != null ? formatCurrency(r.net) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td className="px-3 py-2" colSpan={5}>Total: {included.length} pay sheet{included.length === 1 ? '' : 's'}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.gross)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.deductions)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* The sheet being captured for the PDF, off screen */}
      {sheet && (
        <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 680 }}>
          <PaySheetView ref={sheetRef} employee={sheet.employee} calc={sheet.calc} month={month} year={year} activeBc={businessCenter} />
        </div>
      )}
    </div>
  )
}
