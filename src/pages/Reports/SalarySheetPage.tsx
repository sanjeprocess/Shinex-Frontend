import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import A4Report, { A4ReportColumn } from '../../components/reports/A4Report'
import ReportFilters, { cleanBusinessCenter, useReportFilters } from '../../components/reports/ReportFilters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

type SheetRow = Record<string, any>

// Column order of the printed sheet; `header` is also used for the PDF export
const NUMBER_COLUMNS: Array<{ key: string; header: string; digits?: number }> = [
  { key: 'shift1Days', header: '1st Days' },
  { key: 'dayRate', header: '1st Rate' },
  { key: 'shift1Total', header: '1st Total' },
  { key: 'shift2Days', header: '2nd Days' },
  { key: 'dayRate', header: '2nd Rate' },
  { key: 'shift2Total', header: '2nd Total' },
  { key: 'poyaDays', header: 'Poya Days' },
  { key: 'poyaRate', header: 'Poya Rate' },
  { key: 'poyaTotal', header: 'Poya Total' },
  { key: 'otHours', header: 'OT HR' },
  { key: 'otRate', header: 'OT Rate' },
  { key: 'otTotal', header: 'OT Total' },
  { key: 'performanceAllowance', header: 'Performance Allow' },
  { key: 'transportAllowance', header: 'Transport Allow' },
  { key: 'attendanceAllowance', header: 'Att. Allowance' },
  { key: 'otherAdditions', header: 'Other Ad' },
  { key: 'grossSalary', header: 'Gross Salary' },
  { key: 'epf8', header: 'E.P.F' },
  { key: 'otherDeductions', header: 'Other Deduct' },
  { key: 'uniform', header: 'Uniform' },
  { key: 'advance', header: 'Advance' },
  { key: 'telephone', header: 'Telephone' },
  { key: 'mealCount', header: 'Meal No', digits: 0 },
  { key: 'mealValue', header: 'Meal Value' },
  { key: 'loan', header: 'Loan' },
  { key: 'totalDeductions', header: 'Total Deduct' },
  { key: 'netSalary', header: 'Net Salary' },
]

// Rates are not added up in the total line
const NOT_TOTALLED = new Set(['dayRate', 'poyaRate', 'otRate'])

const cellValue = (value: unknown, digits = 2) =>
  digits === 0 ? String(Math.round(Number(value) || 0)) : formatCurrency(Number(value) || 0)

export default function SalarySheetPage() {
  const filters = useReportFilters(true)
  const { year, month, businessCenter, plant, customers, businessCenters } = filters
  const [data, setData] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reports/salary-sheet', {
        params: { businessCenter: cleanBusinessCenter(businessCenter), year, month, plant: plant || undefined }
      })
      setData(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      setData([])
      console.error('Salary sheet could not be loaded', error)
      toast.error('Salary sheet could not be loaded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month, plant])

  const client = customers.find(c => c.code === plant)
  // Company line: the selected business center, or the one on the rows when "All" is selected
  const center = businessCenters.find((b: any) => b.code === (businessCenter !== 'ALL' ? businessCenter : data[0]?.businessCenter))

  const columns: A4ReportColumn[] = [
    { header: 'Name & E.P.F No' },
    ...NUMBER_COLUMNS.map(c => ({ header: c.header, align: 'right' as const })),
    { header: 'Signature' },
  ]

  const rows = data.map(row => [
    `${row.employeeName} - ${row.epfNo}`,
    ...NUMBER_COLUMNS.map(c => cellValue(row[c.key], c.digits)),
    '',
  ])

  const totalRow = data.length > 0 ? [
    'Total',
    ...NUMBER_COLUMNS.map(c => NOT_TOTALLED.has(c.key)
      ? ''
      : cellValue(data.reduce((sum, row) => sum + Number(row[c.key] || 0), 0), c.digits)),
    '',
  ] : undefined

  const vertical = (label: string) => <th rowSpan={2} className="ss-vertical"><span>{label}</span></th>
  const sub = (label: string) => <th className="ss-vertical"><span>{label}</span></th>

  const customHeaderRow = (
    <>
      <tr>
        <th rowSpan={3} className="ss-name">Name &amp; E.P.F No</th>
        <th colSpan={17} className="ss-group">SALARIES AND ALLOWANCES</th>
        <th colSpan={9} className="ss-group">DEDUCTIONS</th>
        <th rowSpan={3} className="ss-vertical"><span>Net Salary</span></th>
        <th rowSpan={3} className="ss-vertical"><span>Signature</span></th>
      </tr>
      <tr>
        <th colSpan={3} className="ss-group">1st Shift</th>
        <th colSpan={3} className="ss-group">2nd Shift</th>
        <th colSpan={3} className="ss-group">Sunday &amp; Poya</th>
        <th colSpan={3} className="ss-group">Over Time</th>
        {vertical('Performance Allow')}
        {vertical('Transport Allow')}
        {vertical('Att. Allowance')}
        {vertical('Other Ad')}
        {vertical('Gross Salary')}
        {vertical('E.P.F')}
        {vertical('Other Deduct')}
        {vertical('Uniform')}
        {vertical('Advance')}
        {vertical('Telephone')}
        {vertical('Meal No')}
        {vertical('Meal Value')}
        {vertical('Loan')}
        {vertical('Total Deduct')}
      </tr>
      <tr>
        {sub('6-2 Shift Days')}{sub('Rate')}{sub('Total')}
        {sub('2-10 Shift Days')}{sub('Rate')}{sub('Total')}
        {sub('Days')}{sub('Rate')}{sub('Total')}
        {sub('OT HR')}{sub('Rate')}{sub('Total')}
      </tr>
    </>
  )

  const topBlock = () => (
    <div className="ss-top-block">
      <div>{client?.name || 'All Clients'}</div>
      <div>{center?.name || ''}</div>
      <div>SALARY SHEET MONTH OF &nbsp; {month} &nbsp; {year}</div>
    </div>
  )

  return (
    <A4Report
      orientation="landscape"
      title="Salary Sheet"
      hideHeader
      customTopBlock={topBlock}
      columns={columns}
      customHeaderRow={customHeaderRow}
      rows={rows}
      totalRow={totalRow}
      rowsPerPage={16}
      tableClassName="salary-sheet"
      pdfFontSize={5}
      isLoading={loading}
      emptyMessage="No salary data for the selected filters."
      filterControls={<ReportFilters filters={filters} />}
      onGenerate={loadData}
    />
  )
}
