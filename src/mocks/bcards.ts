import api from '../api/axios';

export type BCardRecord = {
  epfNo: string;
  bFill?: string;
  bFillDate?: string;
  bRegistered?: string;
  bRegDate?: string;
  bSign?: string;
  bSignDate?: string;
  bIssue?: string;
  bIssueDate?: string;
  businessCenter?: string;
};

export const list = async (): Promise<BCardRecord[]> => {
  try {
    const res = await api.get('/bcards');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((b: any) => ({
        epfNo: (b.epfNo || '').trim(),
        bFill: (b.bFill || 'N').trim(),
        bFillDate: b.bFillDate || '',
        bRegistered: (b.bRegistered || 'N').trim(),
        bRegDate: b.bRegDate || '',
        bSign: (b.bSign || 'N').trim(),
        bSignDate: b.bSignDate || '',
        bIssue: (b.bIssue || 'N').trim(),
        bIssueDate: b.bIssueDate || '',
        businessCenter: (b.businessCenter || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load B-Cards from API', err);
  }
  return [];
};

export const getByEpf = async (epfNo: string): Promise<BCardRecord | undefined> => {
  try {
    const res = await api.get(`/bcards/${encodeURIComponent(epfNo)}`);
    if (res.data) return res.data;
  } catch {}
  const all = await list();
  return all.find(b => b.epfNo === epfNo);
};

export const create = async (b: BCardRecord): Promise<BCardRecord> => {
  const payload = {
    epfNo: b.epfNo.trim(),
    bFill: b.bFill || 'N',
    bFillDate: b.bFillDate || null,
    bRegistered: b.bRegistered || 'N',
    bRegDate: b.bRegDate || null,
    bSign: b.bSign || 'N',
    bSignDate: b.bSignDate || null,
    bIssue: b.bIssue || 'N',
    bIssueDate: b.bIssueDate || null,
    businessCenter: b.businessCenter || '001'
  };
  await api.post('/bcards', payload);
  return b;
};

export const update = async (epfNo: string, patch: Partial<BCardRecord>): Promise<BCardRecord> => {
  const payload = {
    epfNo: epfNo.trim(),
    bFill: patch.bFill || 'N',
    bFillDate: patch.bFillDate || null,
    bRegistered: patch.bRegistered || 'N',
    bRegDate: patch.bRegDate || null,
    bSign: patch.bSign || 'N',
    bSignDate: patch.bSignDate || null,
    bIssue: patch.bIssue || 'N',
    bIssueDate: patch.bIssueDate || null,
    businessCenter: patch.businessCenter || '001'
  };
  await api.put(`/bcards/${encodeURIComponent(epfNo)}`, payload);
  return { epfNo, ...patch } as BCardRecord;
};

export const remove = async (epfNo: string): Promise<void> => {
  await api.delete(`/bcards/${encodeURIComponent(epfNo)}`);
};
