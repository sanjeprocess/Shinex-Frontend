import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import A4Report from '../../components/reports/A4Report'
import ReportFilters, { cleanBusinessCenter, employeeFullName, plantKey, useReportFilters } from '../../components/reports/ReportFilters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

export default function UniformReportPage() {
  const filters = useReportFilters()
  const { year, month, businessCenter, plant, customers, employees } = filters
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reports/uniform', {
        params: { businessCenter: cleanBusinessCenter(businessCenter), year, month: Number(month) }
      })
      setData(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      setData([])
      console.error('Uniform report could not be loaded', error)
      toast.error('Uniform report could not be loaded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  const rows = data
    .map(item => ({ item, employee: employees.find(e => (e.epfNo || '').trim() === (item.epfNo || '').trim()) }))
    .filter(({ employee }) => !plant || plantKey(employee?.plantCode) === plantKey(plant))
    .sort((a, b) => (a.item.epfNo || '').localeCompare(b.item.epfNo || '', undefined, { numeric: true }))

  const total = rows.reduce((sum, { item }) => sum + Number(item.monthlyCut || 0), 0)
  const client = customers.find(c => c.code === plant)

  return (
    <A4Report
      orientation="portrait"
      title="Uniform Report"
      metaLeft={(
        <div>
          <div>Year {year} &nbsp; Month {month}</div>
          <div>Client Name {client?.name || 'All Clients'}</div>
        </div>
      )}
      columns={[
        { header: 'Emp_ID', width: '20%' },
        { header: 'Name', width: '55%' },
        { header: 'Value', align: 'right', width: '25%' },
      ]}
      rows={rows.map(({ item, employee }) => [
        item.epfNo,
        employeeFullName(employee) || item.employeeName || item.epfNo,
        formatCurrency(item.monthlyCut),
      ])}
      totalRow={['', 'Total', formatCurrency(total)]}
      rowsPerPage={28}
      isLoading={loading}
      emptyMessage="No uniform deductions for the selected filters."
      filterControls={<ReportFilters filters={filters} />}
      onGenerate={loadData}
    />
  )
}
