import api from '../api/axios'

export type MonthlySummary = {
  epfNo: string
  empName: string
  businessCenter?: string
  plantCode?: string
  sectionCode?: string
  basicSalary: number
  normalDays?: number
  normalRate?: number
  normalAmount?: number
  poyaDays?: number
  poyaRate?: number
  poyaAmount?: number
  nightDays?: number
  nightRate?: number
  nightAmount?: number
  nightAllowance?: number
  poyaDayExtra?: number
  overtimeHours?: number
  overtimeRate?: number
  overtimeAmount?: number
  dayAllowance?: number
  statutoryHolidayAmount?: number
  totalAdditions: number
  grossSalary: number

  epf8?: number
  advanceDeduction?: number
  telephoneDeduction?: number
  mealDeduction?: number
  absentDeduction?: number
  loanDeduction?: number
  deathDonation?: number
  totalDeductions: number

  netSalary: number

  epf12?: number
  etf3?: number

  plantsWorked?: Array<{
    plantCode: string
    plantName: string
    daysWorked: number
  }>

  additions: Array<{ code: string; name: string; amount: number; addEpf?: boolean; addToBasic?: boolean }>
  deductions: Array<{ code: string; name: string; amount: number }>
  advances: Array<{ loanId: string; amount: number }>
  attendance: { 
    workingDays?: number
    normalDays?: number
    normalRate?: number
    normalAmount?: number
    poyaDays?: number
    poyaRate?: number
    poyaAmount?: number
    nightDays?: number
    nightRate?: number
    nightAmount?: number
    otHours?: number
    otRate?: number
    otAmount?: number
    dayAllowance?: number
    nightAllowance?: number
    mealValue?: number
    poyaDayExtra?: number
    statutoryHolidayCount?: number
    statutoryHolidayAmount?: number
  }
}

export const getMonthlySummary = async (epfNo: string, year: string, month: string) => {
  const response = await api.get<MonthlySummary>('/process/monthly-summary', { params: { epfNo, year, month } })
  return response.data
}

export const syncMonthlySummary = async (year: string, month: string) => {
  try {
    const response = await api.post('/process/monthly-summary/sync', null, { params: { year, month } })
    return response.data
  } catch (err) {
    return { success: true, year, month }
  }
}
