import api from '../api/axios';

export type LeaveRecord = {
  id: string;
  leaveYear: string;
  leaveMonth: string;
  empNo: string;
  epfNo?: string;
  leaveType: string;
  leaveDays: number;
  leaveStartDate: string;
  leaveEndDate: string;
  businessCenter: string;
  start?: string;
  end?: string;
  days?: number;
};

export const list = async (): Promise<LeaveRecord[]> => {
  try {
    const res = await api.get('/leaves');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((l: any) => ({
        id: l.leaveId ? String(l.leaveId) : `${l.leaveYear}_${l.leaveMonth}_${l.empNo}_${l.leaveStartDate}`,
        leaveYear: (l.leaveYear || '').trim(),
        leaveMonth: (l.leaveMonth || '').trim(),
        empNo: (l.empNo || '').trim(),
        epfNo: (l.empNo || '').trim(),
        leaveType: (l.leaveType || '').trim(),
        leaveDays: l.leaveDays || 0,
        leaveStartDate: l.leaveStartDate || '',
        leaveEndDate: l.leaveEndDate || '',
        businessCenter: (l.businessCenter || '').trim(),
        start: l.leaveStartDate || '',
        end: l.leaveEndDate || '',
        days: l.leaveDays || 0
      }));
    }
  } catch (err) {
    console.error('Failed to load leaves from API', err);
  }
  return [];
};

export const listByEmployee = async (epf: string): Promise<LeaveRecord[]> => {
  const all = await list();
  return all.filter(record => record.empNo === epf || record.epfNo === epf);
};

export const create = async (record: LeaveRecord): Promise<LeaveRecord> => {
  const payload = {
    leaveYear: record.leaveYear,
    leaveMonth: record.leaveMonth,
    empNo: record.empNo || record.epfNo,
    leaveType: record.leaveType,
    leaveDays: record.leaveDays || record.days,
    leaveStartDate: record.leaveStartDate || record.start,
    leaveEndDate: record.leaveEndDate || record.end,
    businessCenter: record.businessCenter
  };
  const res = await api.post('/leaves', payload);
  return { ...record, id: res.data?.leaveId ? String(res.data.leaveId) : record.id };
};

export const update = async (id: string, patch: Partial<LeaveRecord>): Promise<LeaveRecord> => {
  const payload = {
    leaveId: isNaN(Number(id)) ? undefined : Number(id),
    leaveYear: patch.leaveYear,
    leaveMonth: patch.leaveMonth,
    empNo: patch.empNo || patch.epfNo,
    leaveType: patch.leaveType,
    leaveDays: patch.leaveDays || patch.days,
    leaveStartDate: patch.leaveStartDate || patch.start,
    leaveEndDate: patch.leaveEndDate || patch.end,
    businessCenter: patch.businessCenter
  };
  await api.put(`/leaves/${id}`, payload);
  return { id, ...patch } as LeaveRecord;
};

export const remove = async (id: string): Promise<void> => {
  await api.delete(`/leaves/${id}`);
};
