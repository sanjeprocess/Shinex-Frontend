import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import A4Report from '../../components/reports/A4Report'
import ReportFilters, { cleanBusinessCenter, useReportFilters } from '../../components/reports/ReportFilters'
import api from '../../api/axios'
import { formatCurrency } from '../../utils/reportHelpers'

type CompanyTotal = { plantCode: string; companyName: string; netSalary: number; epf12: number; etf3: number }

export default function SalarySheetTotalPage() {
  const filters = useReportFilters()
  const { year, month, businessCenter } = filters
  const [data, setData] = useState<CompanyTotal[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/reports/salary-sheet-total', {
        params: { businessCenter: cleanBusinessCenter(businessCenter), year, month }
      })
      setData(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      setData([])
      console.error('Salary sheet total could not be loaded', error)
      toast.error('Salary sheet total could not be loaded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [businessCenter, year, month])

  const sum = (pick: (row: CompanyTotal) => number) => data.reduce((total, row) => total + Number(pick(row) || 0), 0)

  return (
    <A4Report
      orientation="portrait"
      title="Salary Sheet Total"
      subtitle={`Month OF ${month} / ${year}`}
      columns={[
        { header: 'Company Name', width: '52%' },
        { header: 'Total Net Salary', align: 'right' },
        { header: 'E.P.F 12%', align: 'right' },
        { header: 'E.T.F 3%', align: 'right' },
      ]}
      rows={data.map(row => [
        row.companyName,
        formatCurrency(row.netSalary),
        formatCurrency(row.epf12),
        formatCurrency(row.etf3),
      ])}
      totalRow={['Total', formatCurrency(sum(r => r.netSalary)), formatCurrency(sum(r => r.epf12)), formatCurrency(sum(r => r.etf3))]}
      rowsPerPage={28}
      isLoading={loading}
      emptyMessage="No salary data for the selected filters."
      filterControls={<ReportFilters filters={filters} showPlant={false} />}
      onGenerate={loadData}
    />
  )
}
