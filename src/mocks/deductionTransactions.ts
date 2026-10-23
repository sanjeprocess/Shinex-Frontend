import api from '../api/axios';
import { v4 as uuid } from 'uuid';

export type DeductionTransaction = {
  id: string;
  epfNo: string;
  employeeName?: string;
  didCode: string;
  deductionName?: string;
  isLoan?: boolean;
  isUniform?: boolean;
  businessCenter: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalAmount: number;
  monthlyCut: number;
  status: 'Active' | 'Completed';
  createdAt?: string;
  notes?: string;
};

/**
 * Computes months cut so far, remaining balance, and status based on salary deduction rules:
 * - Deducts monthly cut only for months between Start Date and End Date.
 * - Stops deducting after End Date or when remaining balance reaches 0.
 * - The last month deducts only the remaining balance.
 */
export function computeDeductionMetrics(
  item: DeductionTransaction,
  refDate: Date = new Date()
): {
  monthsCutSoFar: number;
  totalMonthsWindow: number;
  remainingBalance: number;
  status: 'Active' | 'Completed';
} {
  const [sY, sM] = (item.startDate || '').split('-').map(Number);
  const [eY, eM] = (item.endDate || '').split('-').map(Number);

  if (!sY || !sM || !eY || !eM) {
    return {
      monthsCutSoFar: 0,
      totalMonthsWindow: 0,
      remainingBalance: item.totalAmount || 0,
      status: item.status || 'Active'
    };
  }

  const sIndex = sY * 12 + sM;
  const eIndex = eY * 12 + eM;
  const totalMonthsWindow = Math.max(0, eIndex - sIndex + 1);

  const curYear = refDate.getFullYear();
  const curMonth = refDate.getMonth() + 1;
  const curIndex = curYear * 12 + curMonth;

  let elapsedMonths = 0;
  if (curIndex >= sIndex) {
    elapsedMonths = Math.min(totalMonthsWindow, curIndex - sIndex + 1);
  }

  // Max months needed to repay at monthlyCut rate
  const maxRepayMonths = item.monthlyCut > 0 ? Math.ceil(item.totalAmount / item.monthlyCut) : 0;
  const monthsCutSoFar = Math.min(elapsedMonths, maxRepayMonths);

  let deductedSoFar = 0;
  for (let m = 0; m < monthsCutSoFar; m++) {
    const remainingBeforeMonth = item.totalAmount - deductedSoFar;
    const thisMonthCut = (remainingBeforeMonth <= item.monthlyCut || m === totalMonthsWindow - 1)
      ? remainingBeforeMonth
      : item.monthlyCut;
    deductedSoFar += thisMonthCut;
    if (deductedSoFar >= item.totalAmount) break;
  }

  const remainingBalance = Math.max(0, Math.round((item.totalAmount - deductedSoFar) * 100) / 100);
  const isCompleted = item.status === 'Completed' || remainingBalance <= 0 || curIndex > eIndex;

  return {
    monthsCutSoFar,
    totalMonthsWindow,
    remainingBalance,
    status: isCompleted ? 'Completed' : 'Active'
  };
}

export const list = async (businessCenter?: string): Promise<DeductionTransaction[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const response = await api.get('/deduction-transactions', {
    params: cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {}
  });
  if (!Array.isArray(response.data)) {
    throw new Error('Deduction transaction endpoint returned an invalid response.');
  }
  return response.data;
};

export const create = async (
  t: Omit<DeductionTransaction, 'id' | 'status'> & { id?: string; status?: 'Active' | 'Completed' }
): Promise<DeductionTransaction> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc.split(' / ')[0].trim();

  const record: DeductionTransaction = {
    ...t,
    id: t.id || uuid(),
    businessCenter: t.businessCenter || cleanBc,
    status: t.status || 'Active',
    createdAt: new Date().toISOString()
  };

  const response = await api.post('/deduction-transactions', record);
  return response.data;
};

export const update = async (id: string, patch: Partial<DeductionTransaction>): Promise<DeductionTransaction> => {
  const response = await api.put(`/deduction-transactions/${encodeURIComponent(id)}`, patch);
  return response.data;
};

export const remove = async (id: string): Promise<void> => {
  await api.delete(`/deduction-transactions/${encodeURIComponent(id)}`);
};

/**
 * Calculates the monthly deduction amount for a specific employee and payroll month/year.
 *
 * Salary rule:
 * - Deduct the monthly cut only for months between Start Date and End Date.
 * - After the end date, or when the balance reaches 0, stop deducting.
 * - The last month deducts only the remaining balance.
 */
export const getMonthlyDeduction = async (
  epfNo: string,
  year: number | string,
  month: number | string
): Promise<number> => {
  const cleanEpf = String(epfNo || '').trim().toLowerCase();
  if (!cleanEpf) return 0;

  const targetYear = Number(year);
  const targetMonth = Number(month);
  if (!targetYear || !targetMonth) return 0;

  if (targetMonth < 1 || targetMonth > 12) {
    throw new Error('Month must be between 1 and 12.');
  }
  const response = await api.get('/deduction-transactions/monthly-deduction', {
    params: { year: targetYear, month: targetMonth }
  });
  if (!Array.isArray(response.data)) {
    throw new Error('Monthly deduction endpoint returned an invalid response.');
  }
  const employee = response.data.find((row: any) => String(row.epfNo || '').trim().toLowerCase() === cleanEpf);
  return Number(employee?.monthlyDeduction || 0);
};
