import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Printer, Download, RefreshCw } from 'lucide-react'
import ReportFilters, { cleanBusinessCenter, employeeFullName, plantKey, useReportFilters } from '../../components/reports/ReportFilters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'
import '../../components/reports/a4report.css'

type SheetRow = { epfNo: string; employeeName: string; plantCode: string; plantName: string; netSalary: number }
type BankLine = { name: string; account: string; netSalary: number }
type Company = { plantCode: string; companyName: string; lines: BankLine[]; total: number }

const ROWS_PER_PAGE = 40

// Short bank code printed after the account number, as on the bank list (8880035768 COM)
const BANK_CODES: Array<[RegExp, string]> = [
  [/commercial/i, 'COM'],
  [/ceylon|^boc$/i, 'BOC'],
  [/people/i, 'PEO'],
  [/savings|^nsb$/i, 'NSB'],
  [/hatton|^hnb$/i, 'HNB'],
  [/sampath/i, 'SAM'],
  [/seylan/i, 'SEY'],
  [/nations trust|^ntb$/i, 'NTB'],
  [/dfcc/i, 'DFCC'],
  [/ndb|national development/i, 'NDB'],
  [/pan asia/i, 'PAB'],
  [/union/i, 'UBC'],
  [/standard chartered/i, 'SCB'],
  [/hsbc/i, 'HSBC'],
  [/cargills/i, 'CAR'],
  [/amana/i, 'AMA'],
]

export function bankCode(bankName?: string | null): string {
  const name = (bankName || '').trim()
  if (!name) return ''
  const known = BANK_CODES.find(([pattern]) => pattern.test(name))
  if (known) return known[1]
  return name.length <= 4 ? name.toUpperCase() : name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
}

export default function SalaryBankListPage() {
  const filters = useReportFilters()
  const { year, month, businessCenter, employees } = filters
  const [data, setData] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reports/salary-sheet', {
        params: { businessCenter: cleanBusinessCenter(businessCenter), year, month }
      })
      setData(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      setData([])
      console.error('Salary bank list could not be loaded', error)
      toast.error('Salary bank list could not be loaded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  // One list per company, in the same order as the Salary Sheet Total
  const companies = useMemo<Company[]>(() => {
    const byEpf = new Map(employees.map(e => [(e.epfNo || '').trim().toUpperCase(), e]))
    const groups = new Map<string, Company>()
    data.forEach(row => {
      const key = plantKey(row.plantCode)
      const company = groups.get(key) || { plantCode: row.plantCode, companyName: row.plantName || row.plantCode, lines: [], total: 0 }
      const employee = byEpf.get((row.epfNo || '').trim().toUpperCase())
      const account = (employee?.bankAccountNumber || '').trim()
      company.lines.push({
        name: (employeeFullName(employee) || row.employeeName || row.epfNo).toUpperCase(),
        account: account ? `${account} ${bankCode(employee?.bankName)}`.trim() : '',
        netSalary: Number(row.netSalary) || 0
      })
      company.total += Number(row.netSalary) || 0
      groups.set(key, company)
    })
    return Array.from(groups.values())
      .map(c => ({ ...c, lines: c.lines.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
  }, [data, employees])

  // Each company starts on a new page; a long list carries on over the next pages
  const pages = useMemo(() => companies.flatMap(company => {
    const chunks: { company: Company; lines: BankLine[]; last: boolean }[] = []
    for (let i = 0; i < Math.max(company.lines.length, 1); i += ROWS_PER_PAGE) {
      chunks.push({ company, lines: company.lines.slice(i, i + ROWS_PER_PAGE), last: i + ROWS_PER_PAGE >= company.lines.length })
    }
    return chunks
  }), [companies])

  const subtitle = `Month OF ${month} / ${year}`

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = '@page { size: A4 portrait; margin: 0; }'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    companies.forEach((company, index) => {
      if (index > 0) doc.addPage()
      autoTable(doc, {
        startY: 26,
        head: [
          [{ content: company.companyName, colSpan: 3, styles: { halign: 'left', fontStyle: 'normal' } }],
          [{ content: 'Name', styles: { halign: 'center' } }, { content: 'Account No', styles: { halign: 'center' } }, { content: 'Net Salary', styles: { halign: 'center' } }]
        ],
        body: company.lines.map(line => [line.name, line.account, formatCurrency(line.netSalary)]),
        foot: [[{ content: 'Total', colSpan: 2, styles: { halign: 'right' } }, formatCurrency(company.total)]],
        showFoot: 'lastPage',
        margin: { top: 26, left: 15, right: 15, bottom: 15 },
        styles: { font: 'times', fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], cellPadding: 0.9 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2 },
        footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 45 }, 2: { halign: 'right' } },
        didDrawPage: () => {
          const pageWidth = doc.internal.pageSize.getWidth()
          doc.setFont('times', 'bold')
          doc.setFontSize(13)
          doc.text('Salary Bank List', pageWidth / 2, 14, { align: 'center' })
          doc.setFontSize(10)
          doc.text(subtitle, 15, 21)
        }
      })
    })
    const pageCount = doc.getNumberOfPages()
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page)
      doc.setFont('times', 'normal')
      doc.setFontSize(8)
      doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
    }
    doc.save(`salary_bank_list_${year}_${month}.pdf`)
  }

  return (
    <div className="a4-screen-wrapper">
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <ReportFilters filters={filters} showPlant={false} />
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Generate
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={loading || companies.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print
            </button>
            <button
              onClick={exportPdf}
              disabled={loading || companies.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {!loading && companies.length === 0 && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 max-w-lg mx-auto shadow-sm">
          <p className="text-base font-medium">No salary data for the selected filters.</p>
          <p className="text-xs text-slate-400 mt-1">Select your filter criteria and click Generate.</p>
        </div>
      )}

      {companies.length > 0 && (
        <div className="a4-scroll-area">
          {pages.map(({ company, lines, last }, pageIdx) => (
            <div key={`bank-page-${pageIdx}`} className="a4-page portrait p">
              <div className="a4-header">
                <div className="a4-meta-left" />
                <h1 style={{ textDecoration: 'underline' }}>Salary Bank List</h1>
                <div className="a4-meta-right" />
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '3mm' }}>{subtitle}</div>
              <table className="a4-table">
                <thead>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 'normal' }}>{company.companyName}</td>
                  </tr>
                  <tr>
                    <th style={{ width: '52%', textAlign: 'center' }}>Name</th>
                    <th style={{ width: '26%', textAlign: 'center' }}>Account No</th>
                    <th style={{ textAlign: 'center' }}>Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, rowIdx) => (
                    <tr key={`bank-row-${pageIdx}-${rowIdx}`}>
                      <td>{line.name}</td>
                      <td>{line.account}</td>
                      <td className="n">{formatCurrency(line.netSalary)}</td>
                    </tr>
                  ))}
                  {last && (
                    <tr className="t total-row">
                      <td colSpan={2} className="n">Total</td>
                      <td className="n">{formatCurrency(company.total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="a4-footer-page">Page {pageIdx + 1} of {pages.length}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
