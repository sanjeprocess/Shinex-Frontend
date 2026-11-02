import React from 'react'
import A4Report from '../../components/reports/A4Report'
import ReportFilters, { employeeFullName, plantKey, useReportFilters } from '../../components/reports/ReportFilters'

/** Blank sheet for one client: employees sign and write the advance they request. */
export default function AdvanceRequestSheetPage() {
  const filters = useReportFilters(true)
  const { year, month, plant, customers, employees } = filters

  const client = customers.find(c => c.code === plant)
  const rows = employees
    .filter(e => !plant || plantKey(e.plantCode) === plantKey(plant))
    .sort((a, b) => (a.epfNo || '').trim().localeCompare((b.epfNo || '').trim(), undefined, { numeric: true }))
    .map(e => [e.epfNo, employeeFullName(e), '', ''])

  const metaLeft = (
    <div>
      <div>Year {year} &nbsp; Month {month}</div>
      <div>Client Name {client?.name || ''}</div>
    </div>
  )

  return (
    <A4Report
      orientation="portrait"
      title="Advance Report Request Sheet"
      metaLeft={metaLeft}
      columns={[
        { header: 'Emp_ID', width: '15%' },
        { header: 'Name', width: '50%' },
        { header: 'Value', width: '15%' },
        { header: 'Signature', width: '20%' },
      ]}
      rows={rows}
      rowsPerPage={32}
      emptyMessage="No employees for the selected client."
      filterControls={<ReportFilters filters={filters} allPlantsOption={false} />}
    />
  )
}
