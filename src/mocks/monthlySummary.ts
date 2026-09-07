import api from '../api/axios'

export type MonthlySummary = {
  epfNo: string
  empName: string
  basicSalary: number
  totalAdditions: number
  totalDeductions: number
  netSalary: number
  additions: Array<{ code: string; name: string; amount: number; addEpf?: boolean; addToBasic?: boolean }>
  deductions: Array<{ code: string; name: string; amount: number }>
  advances: Array<{ loanId: string; amount: number }>
  attendance: { workingDays?: number; otHours?: number; dayAllowance?: number; nightAllowance?: number; mealValue?: number }
}

export const getMonthlySummary = async (epfNo: string, year: string, month: string) => {
  const response = await api.get<MonthlySummary>('/process/monthly-summary', { params: { epfNo, year, month } })
  return response.data
}
