import React, { useEffect, useId } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Printer, Download, RefreshCw } from 'lucide-react'
import './a4report.css'

export type A4ReportColumn = {
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
}

export type A4ReportCell = string | number | React.ReactNode

export type A4ReportRow = {
  cells: A4ReportCell[]
  isTotal?: boolean
}

export interface A4ReportProps {
  orientation: 'portrait' | 'landscape'
  title: string
  subtitle?: string
  metaLeft?: React.ReactNode
  printDate?: string
  columns: (string | A4ReportColumn)[]
  customHeaderRow?: React.ReactNode // For multi-row table headers (e.g. EPF C Form)
  rows: (A4ReportCell[] | A4ReportRow)[]
  totalRow?: A4ReportCell[]
  rowsPerPage?: number
  numericFromColIndex?: number
  customTopBlock?: (pageIndex: number, totalPages: number) => React.ReactNode
  isLoading?: boolean
  emptyMessage?: string
  onGenerate?: () => void
  onExportPdf?: () => void
  filterControls?: React.ReactNode
}

/** Formats a Date or date string to dd/MM/yyyy */
export function formatReportPrintDate(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Formats currency / numbers to 2 decimal places with thousands comma */
export function formatCurrency(n: number | string | undefined | null): string {
  if (n == null || n === '') return '0.00'
  const num = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function A4Report({
  orientation,
  title,
  subtitle,
  metaLeft,
  printDate = formatReportPrintDate(),
  columns,
  customHeaderRow,
  rows,
  totalRow,
  rowsPerPage,
  numericFromColIndex,
  customTopBlock,
  isLoading = false,
  emptyMessage = 'No data for the selected filters.',
  onGenerate,
  onExportPdf,
  filterControls,
}: A4ReportProps) {
  const styleId = useId()

  // Dynamic @page size injection for browser printing
  useEffect(() => {
    const styleElem = document.createElement('style')
    styleElem.id = `a4-print-style-${styleId}`
    styleElem.innerHTML = `@page { size: A4 ${orientation}; margin: 0; }`
    document.head.appendChild(styleElem)
    return () => {
      const el = document.getElementById(`a4-print-style-${styleId}`)
      if (el) el.remove()
    }
  }, [orientation, styleId])

  // Normalizing columns
  const normalizedCols: A4ReportColumn[] = columns.map((col, idx) => {
    if (typeof col === 'string') {
      const isNum = numericFromColIndex !== undefined && idx >= numericFromColIndex
      return { header: col, align: isNum ? 'right' : 'left' }
    }
    return col
  })

  // Normalizing rows
  const normalizedRows: A4ReportCell[][] = rows.map(r => {
    if (Array.isArray(r)) return r
    return r.cells
  })

  // Default pagination: ~28 for portrait, ~18 for landscape
  const effectiveRowsPerPage = rowsPerPage || (orientation === 'landscape' ? 18 : 28)

  // Splitting rows into pages
  const pages: A4ReportCell[][][] = []
  if (normalizedRows.length === 0) {
    pages.push([])
  } else {
    for (let i = 0; i < normalizedRows.length; i += effectiveRowsPerPage) {
      pages.push(normalizedRows.slice(i, i + effectiveRowsPerPage))
    }
  }

  const totalPages = pages.length

  const handlePrint = () => {
    window.print()
  }

  // Default PDF export handler using jsPDF + autoTable
  const handleExportDefaultPdf = () => {
    if (onExportPdf) {
      onExportPdf()
      return
    }

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    })

    // Prepare table columns & body for autoTable
    const head = [normalizedCols.map(c => c.header)]
    const body = normalizedRows.map(row =>
      row.map(cell => (typeof cell === 'object' && cell !== null ? '' : String(cell ?? '')))
    )

    let foot: string[][] | undefined = undefined
    if (totalRow) {
      foot = [totalRow.map(c => (typeof c === 'object' && c !== null ? '' : String(c ?? '')))]
    }

    const colStyles: Record<number, any> = {}
    normalizedCols.forEach((col, idx) => {
      if (col.align === 'right') {
        colStyles[idx] = { halign: 'right' }
      } else if (col.align === 'center') {
        colStyles[idx] = { halign: 'center' }
      }
    })

    // Header margin and positioning
    autoTable(doc, {
      head,
      body,
      foot,
      margin: { top: 28, left: 12, right: 12, bottom: 15 },
      styles: {
        font: 'times',
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.2,
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: { top: 0.5, bottom: 0.2, left: 0.2, right: 0.2 },
      },
      didDrawPage: data => {
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()

        doc.setFont('times', 'bold')
        doc.setFontSize(13)
        doc.text(title, pageWidth / 2, 16, { align: 'center' })

        if (subtitle) {
          doc.setFontSize(10)
          doc.text(subtitle, pageWidth / 2, 22, { align: 'center' })
        }

        doc.setFont('times', 'normal')
        doc.setFontSize(9)
        doc.text(printDate, pageWidth - 12, 16, { align: 'right' })

        // Footer Page N of M
        const pageStr = `Page ${data.pageNumber}`
        doc.setFontSize(8)
        doc.text(pageStr, pageWidth - 12, pageHeight - 8, { align: 'right' })
      },
      columnStyles: colStyles,
    })

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    doc.save(`${safeTitle}_${Date.now()}.pdf`)
  }

  return (
    <div className="a4-screen-wrapper">
      {/* Action / Filter Bar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {filterControls}
            {onGenerate && (
              <button
                onClick={onGenerate}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Generate
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || normalizedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print
            </button>
            <button
              onClick={handleExportDefaultPdf}
              disabled={isLoading || normalizedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && normalizedRows.length === 0 && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 max-w-lg mx-auto shadow-sm">
          <p className="text-base font-medium">{emptyMessage}</p>
          <p className="text-xs text-slate-400 mt-1">Select your filter criteria and click Generate.</p>
        </div>
      )}

      {/* A4 Sheet Area */}
      {(isLoading || normalizedRows.length > 0) && (
        <div className="a4-scroll-area">
          {pages.map((pageRows, pageIdx) => {
            const isLastPage = pageIdx === totalPages - 1

            return (
              <div
                key={`a4-page-${pageIdx}`}
                className={`a4-page ${orientation === 'landscape' ? 'landscape l' : 'portrait p'}`}
              >
                {/* Header */}
                <div className="a4-header">
                  <div className="a4-meta-left">{metaLeft}</div>
                  <h1>{title}</h1>
                  <div className="a4-meta-right">{printDate}</div>
                </div>

                {subtitle && <div className="a4-subtitle">{subtitle}</div>}

                {/* Custom top block (e.g. EPF boxes) */}
                {customTopBlock && customTopBlock(pageIdx, totalPages)}

                {/* Table */}
                <table className="a4-table">
                  <thead>
                    {customHeaderRow ? (
                      customHeaderRow
                    ) : (
                      <tr>
                        {normalizedCols.map((col, idx) => (
                          <th
                            key={`th-${idx}`}
                            className={col.align === 'right' ? 'n' : ''}
                            style={{ width: col.width }}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {pageRows.map((row, rowIdx) => (
                      <tr key={`tr-${pageIdx}-${rowIdx}`}>
                        {row.map((cell, colIdx) => {
                          const col = normalizedCols[colIdx]
                          const isNumeric = col?.align === 'right'
                          return (
                            <td key={`td-${colIdx}`} className={isNumeric ? 'n' : ''}>
                              {cell}
                            </td>
                          )
                        })}
                      </tr>
                    ))}

                    {/* Total Row on the last page */}
                    {isLastPage && totalRow && (
                      <tr className="t total-row">
                        {totalRow.map((cell, colIdx) => {
                          const col = normalizedCols[colIdx]
                          const isNumeric = col?.align === 'right'
                          return (
                            <td key={`tot-${colIdx}`} className={isNumeric ? 'n' : ''}>
                              {cell}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer Page N of M */}
                <div className="a4-footer-page">
                  Page {pageIdx + 1} of {totalPages}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
