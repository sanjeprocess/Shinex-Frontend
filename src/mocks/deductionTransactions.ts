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

const STORAGE_KEY = 'hsb_deduction_transactions';

const initialMockDeductions: DeductionTransaction[] = [
  {
    id: 'dt-001',
    epfNo: '91EPF001',
    employeeName: 'Kasun Bandara',
    didCode: 'DUD001',
    deductionName: 'Company Uniform Kit',
    isLoan: false,
    isUniform: true,
    businessCenter: '001',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    totalAmount: 6000,
    monthlyCut: 1000,
    status: 'Active',
    createdAt: '2026-01-01T08:00:00Z',
    notes: 'Uniform deposit deduction (6 installments)'
  },
  {
    id: 'dt-002',
    epfNo: '91EPF002',
    employeeName: 'Nimal Perera',
    didCode: 'DUD002',
    deductionName: 'Festival Welfare Loan',
    isLoan: true,
    isUniform: false,
    businessCenter: '001',
    startDate: '2026-01-01',
    endDate: '2026-05-31',
    totalAmount: 10000,
    monthlyCut: 2500,
    status: 'Active',
    createdAt: '2026-01-01T08:00:00Z',
    notes: 'Welfare distress loan'
  }
];

function getStoredTransactions(): DeductionTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMockDeductions));
      return initialMockDeductions;
    }
    return JSON.parse(raw);
  } catch {
    return initialMockDeductions;
  }
}

function saveTransactions(items: DeductionTransaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to persist deduction transactions to localStorage', err);
  }
}

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
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';

  try {
    const res = await api.get('/deduction-transactions', {
      params: cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {}
    });
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // Fall back to local store
  }

  const all = getStoredTransactions();
  if (!cleanBc || cleanBc === 'ALL') {
    return all;
  }

  return all.filter(t => {
    const tBc = (t.businessCenter || '').trim().toUpperCase();
    return !tBc || tBc === cleanBc || tBc.startsWith(cleanBc) || cleanBc.startsWith(tBc);
  });
};

export const create = async (
  t: Omit<DeductionTransaction, 'id' | 'status'> & { id?: string; status?: 'Active' | 'Completed' }
): Promise<DeductionTransaction> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();

  const record: DeductionTransaction = {
    ...t,
    id: t.id || uuid(),
    businessCenter: t.businessCenter || cleanBc,
    status: t.status || 'Active',
    createdAt: new Date().toISOString()
  };

  try {
    await api.post('/deduction-transactions', record);
  } catch {
    // Fallback store
  }

  const list = getStoredTransactions();
  list.unshift(record);
  saveTransactions(list);
  return record;
};

export const update = async (id: string, patch: Partial<DeductionTransaction>): Promise<DeductionTransaction> => {
  try {
    await api.put('/deduction-transactions/' + encodeURIComponent(id), patch);
  } catch {}

  const list = getStoredTransactions();
  const index = list.findIndex(item => item.id === id);
  if (index >= 0) {
    list[index] = { ...list[index], ...patch };
    saveTransactions(list);
    return list[index];
  }
  throw new Error('Deduction transaction record not found');
};

export const remove = async (id: string): Promise<void> => {
  try {
    await api.delete('/deduction-transactions/' + encodeURIComponent(id));
  } catch {}

  const list = getStoredTransactions().filter(item => item.id !== id);
  saveTransactions(list);
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

  const targetIndex = targetYear * 12 + targetMonth;
  const all = await list();

  const empTransactions = all.filter(t => (t.epfNo || '').trim().toLowerCase() === cleanEpf);

  let totalDeduction = 0;

  for (const trans of empTransactions) {
    if (trans.status === 'Completed') continue;
    if (!trans.startDate || !trans.endDate) continue;

    const [sY, sM] = trans.startDate.split('-').map(Number);
    const [eY, eM] = trans.endDate.split('-').map(Number);
    if (!sY || !sM || !eY || !eM) continue;

    const sIndex = sY * 12 + sM;
    const eIndex = eY * 12 + eM;

    // Check if target month is within [sIndex, eIndex]
    if (targetIndex < sIndex || targetIndex > eIndex) {
      continue;
    }

    // Calculate prior months deducted
    const priorMonths = targetIndex - sIndex;
    let priorDeducted = 0;

    for (let m = 0; m < priorMonths; m++) {
      const remainingBefore = trans.totalAmount - priorDeducted;
      const cut = (remainingBefore <= trans.monthlyCut || (sIndex + m) === eIndex)
        ? remainingBefore
        : trans.monthlyCut;
      priorDeducted += cut;
      if (priorDeducted >= trans.totalAmount) break;
    }

    if (priorDeducted >= trans.totalAmount) {
      // Balance was already paid off
      continue;
    }

    const remainingBeforeThisMonth = trans.totalAmount - priorDeducted;
    const deductionThisMonth = (targetIndex === eIndex || remainingBeforeThisMonth <= trans.monthlyCut)
      ? remainingBeforeThisMonth
      : trans.monthlyCut;

    totalDeduction += deductionThisMonth;
  }

  return Math.round(totalDeduction * 100) / 100;
};
