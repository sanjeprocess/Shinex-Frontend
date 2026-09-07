import api from '../api/axios';

export type TransactionDeduction = {
  epfNo: string;
  didCode: string;
  businessCenter: string;
  didAmount: number;
  everyMonth: string | boolean | null;
  addMonth: string;
  addYear: string;
};

export const list = async (): Promise<TransactionDeduction[]> => {
  try {
    const res = await api.get('/transaction-deductions');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((d: any) => ({
        epfNo: (d.epfNo || '').trim(),
        didCode: (d.didCode || '').trim(),
        businessCenter: (d.businessCenter || '').trim(),
        didAmount: d.didAmount || 0,
        everyMonth: d.everyMonth,
        addMonth: String(d.addMonth || ''),
        addYear: String(d.addYear || '')
      }));
    }
  } catch (err) {
    console.error('Failed to load transaction deductions from API', err);
  }
  return [];
};

export const create = async (record: TransactionDeduction): Promise<TransactionDeduction> => {
  const payload = {
    ...record,
    everyMonth: record.everyMonth === true ? 'Y' : record.everyMonth === false ? 'N' : record.everyMonth
  };
  await api.post('/transaction-deductions', payload);
  return record;
};

export const update = async (epfNo: string, didCode: string, addMonth: string, addYear: string, patch: Partial<TransactionDeduction>): Promise<TransactionDeduction> => {
  const payload = {
    ...patch,
    epfNo,
    didCode,
    addMonth: String(addMonth),
    addYear: String(addYear),
    everyMonth: patch.everyMonth === true ? 'Y' : patch.everyMonth === false ? 'N' : patch.everyMonth
  };
  await api.put(`/transaction-deductions/${epfNo}/${didCode}`, payload);
  return { epfNo, didCode, addMonth, addYear, ...patch } as TransactionDeduction;
};

export const remove = async (epfNo: string, didCode: string, addMonth: string, addYear: string): Promise<void> => {
  await api.delete(`/transaction-deductions/${encodeURIComponent(epfNo)}/${encodeURIComponent(didCode)}`);
};
