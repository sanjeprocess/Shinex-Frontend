import api from '../api/axios';
import { logAuditAction } from '../utils/auditLogger';

export type LoanRecord = {
  id: string;
  loanId: string;
  epfNo: string;
  loanAmount: number;
  loanStartDate: string;
  loanEndDate?: number | string;
  loanDuration: number;
  businessUnit: string;
  businessCenter?: string;
};

export const loans: LoanRecord[] = [];

export const list = async (): Promise<LoanRecord[]> => {
  try {
    const res = await api.get('/loans');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((l: any) => ({
        id: (l.loanId || l.id || '').trim(),
        loanId: (l.loanId || l.id || '').trim(),
        epfNo: (l.epfNo || l.empEpfNo || '').trim(),
        loanAmount: l.loanAmount || 0,
        loanStartDate: l.loanStartDate || '',
        loanEndDate: l.loanEndDate || 0,
        loanDuration: l.loanDuration || 0,
        businessUnit: (l.businessUnit || l.businessCenter || '').trim(),
        businessCenter: (l.businessUnit || l.businessCenter || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load loans from API', err);
  }
  return [];
};

export const listByEmployee = async (epf: string): Promise<LoanRecord[]> => {
  const all = await list();
  return all.filter(l => l.epfNo === epf);
};

export const create = async (record: LoanRecord): Promise<LoanRecord> => {
  const payload = {
    loanId: record.loanId,
    epfNo: record.epfNo,
    loanAmount: record.loanAmount,
    loanStartDate: record.loanStartDate,
    loanDuration: record.loanDuration,
    businessUnit: record.businessUnit || record.businessCenter
  };
  await api.post('/loans', payload);
  logAuditAction({
    action: 'CREATE',
    module: 'LOAN',
    entityId: record.loanId,
    details: `Issued loan ${record.loanId} of LKR ${record.loanAmount} to EPF ${record.epfNo} (Duration: ${record.loanDuration} months)`
  });
  return record;
};

export const update = async (id: string, patch: Partial<LoanRecord>): Promise<LoanRecord> => {
  const payload = {
    loanId: id,
    epfNo: patch.epfNo,
    loanAmount: patch.loanAmount,
    loanStartDate: patch.loanStartDate,
    loanDuration: patch.loanDuration,
    businessUnit: patch.businessUnit || patch.businessCenter
  };
  await api.put(`/loans/${id}`, payload);
  logAuditAction({
    action: 'UPDATE',
    module: 'LOAN',
    entityId: id,
    details: `Updated loan record ${id} details`
  });
  return { id, loanId: id, ...patch } as LoanRecord;
};

export const remove = async (id: string): Promise<void> => {
  await api.delete(`/loans/${id}`);
  logAuditAction({
    action: 'DELETE',
    module: 'LOAN',
    entityId: id,
    details: `Deleted loan record ${id}`
  });
};
