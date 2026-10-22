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

import { list as listAttendance } from './attendance'
import { list as listCustomers } from './customers'

export const getMonthlySummary = async (epfNo: string, year: string, month: string): Promise<MonthlySummary> => {
  try {
    const response = await api.get<MonthlySummary>('/process/monthly-summary', { params: { epfNo, year, month } })
    if (response.data) return response.data
  } catch (err) {
    // Fall back to local calculation
  }

  const cleanEpf = (epfNo || '').trim().toLowerCase()
  const cleanYear = year.trim()
  const cleanMonth = month.trim()

  const [allAtt, customers] = await Promise.all([
    listAttendance(),
    listCustomers()
  ])

  const empAtt = allAtt.filter(a =>
    (a.epfNo || '').trim().toLowerCase() === cleanEpf &&
    (a.atttYear === cleanYear || (a.dayIn && a.dayIn.startsWith(cleanYear))) &&
    (a.attMonth === cleanMonth || (a.dayIn && a.dayIn.slice(5, 7) === cleanMonth))
  )

  let normalDays = 0
  let otHours = 0
  let poyaDays = 0
  let nightDays = 0
  let dayAllowance = 0
  let nightAllowance = 0
  let mealValue = 0

  const plantDayMap = new Map<string, number>()

  empAtt.forEach(a => {
    const weight = a.halfDay === 1 ? 0.5 : 1.0
    normalDays += weight
    if (a.totalOt && a.totalOt > 0) otHours += a.totalOt
    if (a.saturdayPoya === 'Y') poyaDays += 1
    if (a.nightShift === 'Y' || a.fullNight === 'Y') nightDays += 1
    dayAllowance += a.dayAllowance || 0
    nightAllowance += a.nightAllowance || 0
    mealValue += a.totalMealValue || 0

    const pCode = (a.plantCode || 'Unknown').trim()
    plantDayMap.set(pCode, (plantDayMap.get(pCode) || 0) + 1)
  })

  const basicRate = (empAtt[0]?.basicSalary && empAtt[0].basicSalary > 0) ? empAtt[0].basicSalary : 1200
  const normalAmount = Math.round(normalDays * basicRate * 100) / 100
  const otRate = Math.round((basicRate / 8 * 1.5) * 100) / 100
  const otAmount = Math.round(otHours * otRate * 100) / 100
  const poyaRate = Math.round(basicRate * 1.5 * 100) / 100
  const poyaAmount = Math.round(poyaDays * poyaRate * 100) / 100
  const nightRate = 150
  const nightAmount = Math.round(nightDays * nightRate * 100) / 100

  const totalAdditions = dayAllowance + nightAllowance
  const grossSalary = normalAmount + otAmount + poyaAmount + nightAmount + totalAdditions
  const epf8 = Math.round(normalAmount * 0.08 * 100) / 100
  const totalDeductions = epf8
  const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100
  const epf12 = Math.round(normalAmount * 0.12 * 100) / 100
  const etf3 = Math.round(normalAmount * 0.03 * 100) / 100

  const plantsWorked = Array.from(plantDayMap.entries()).map(([code, count]) => {
    const cust = customers.find(c => c.code === code)
    return {
      plantCode: code,
      plantName: cust?.name || code,
      daysWorked: count
    }
  })

  return {
    epfNo: epfNo.trim(),
    empName: epfNo.trim(),
    basicSalary: basicRate,
    normalDays,
    normalRate: basicRate,
    normalAmount,
    poyaDays,
    poyaRate,
    poyaAmount,
    nightDays,
    nightRate,
    nightAmount,
    nightAllowance,
    overtimeHours: otHours,
    overtimeRate: otRate,
    overtimeAmount: otAmount,
    dayAllowance,
    totalAdditions,
    grossSalary,
    epf8,
    totalDeductions,
    netSalary,
    epf12,
    etf3,
    plantsWorked,
    additions: [],
    deductions: [],
    advances: [],
    attendance: {
      workingDays: normalDays,
      normalDays,
      normalRate: basicRate,
      normalAmount,
      poyaDays,
      poyaRate,
      poyaAmount,
      nightDays,
      nightRate,
      nightAmount,
      otHours,
      otRate,
      otAmount,
      dayAllowance,
      nightAllowance,
      mealValue
    }
  }
}

export const syncMonthlySummary = async (year: string, month: string) => {
  try {
    const response = await api.post('/process/monthly-summary/sync', null, { params: { year, month } })
    return response.data
  } catch (err) {
    return { success: true, year, month }
  }
}
