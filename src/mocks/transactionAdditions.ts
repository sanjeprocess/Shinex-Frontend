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

export const list = async (businessCenter?: string): Promise<TransactionAddition[]> => {
  try {
    const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/transaction-additions', { params });
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
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const payload = {
    ...record,
    businessCenter: record.businessCenter || cleanBc,
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
  await api.delete(`/transaction-additions/${encodeURIComponent(epfNo)}/${encodeURIComponent(addCode)}`);
};
