import api from '../api/axios'

export interface SalaryCalculationRecord {
  id?: number | string
  epfNo: string
  employeeName: string
  plantCode: string
  year: string
  month: string
  daysWorked: number
  otHours: number
  grossSalary: number
  epf8: number
  totalDeductions: number
  netSalary: number
  businessCenter?: string
  calculatedAt?: string
}

export async function calculateSalary(
  year: string,
  month: string,
  plant?: string
): Promise<SalaryCalculationRecord[]> {
  const params: Record<string, string> = { year, month }
  if (plant && plant !== 'ALL') {
    params.plant = plant
  }
  const response = await api.post<SalaryCalculationRecord[]>('/salary/calculate', null, { params })
  return response.data
}

export async function getSalaryCalculations(
  year?: string,
  month?: string,
  plant?: string
): Promise<SalaryCalculationRecord[]> {
  const params: Record<string, string> = {}
  if (year && year !== 'ALL') params.year = year
  if (month && month !== 'ALL') params.month = month
  if (plant && plant !== 'ALL') params.plant = plant

  const response = await api.get<SalaryCalculationRecord[]>('/salary', { params })
  return response.data
}
