import api from '../api/axios';

export type TransactionAddition = {
  epfNo: string;
  addCode: string;
  businessCenter: string;
  addAmount: number;
  everyMonth: string | boolean | null;
  addMonth: number;
  addYear: string;
};

export const list = async (): Promise<TransactionAddition[]> => {
  try {
    const res = await api.get('/transaction-additions');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((a: any) => ({
        epfNo: (a.epfNo || '').trim(),
        addCode: (a.addCode || '').trim(),
        businessCenter: (a.businessCenter || '').trim(),
        addAmount: a.addAmount || 0,
        everyMonth: a.everyMonth,
        addMonth: Number(a.addMonth),
        addYear: String(a.addYear || '')
      }));
    }
  } catch (err) {
    console.error('Failed to load transaction additions from API', err);
  }
  return [];
};

export const create = async (record: TransactionAddition): Promise<TransactionAddition> => {
  const payload = {
    ...record,
    addMonth: String(record.addMonth),
    everyMonth: record.everyMonth === true ? 'Y' : record.everyMonth === false ? 'N' : record.everyMonth
  };
  await api.post('/transaction-additions', payload);
  return record;
};

export const update = async (epfNo: string, addCode: string, addMonth: number, addYear: string, patch: Partial<TransactionAddition>): Promise<TransactionAddition> => {
  const payload = {
    ...patch,
    epfNo,
    addCode,
    addMonth: String(addMonth),
    addYear: String(addYear),
    everyMonth: patch.everyMonth === true ? 'Y' : patch.everyMonth === false ? 'N' : patch.everyMonth
  };
  await api.put(`/transaction-additions/${epfNo}/${addCode}`, payload);
  return { epfNo, addCode, addMonth, addYear, ...patch } as TransactionAddition;
};

export const remove = async (epfNo: string, addCode: string, addMonth: number, addYear: string): Promise<void> => {
  await api.delete(`/transaction-additions/${epfNo}/${addCode}`);
};
