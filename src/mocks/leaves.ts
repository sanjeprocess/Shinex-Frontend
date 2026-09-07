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
  const empNo = String(record.empNo || record.epfNo || '').split(/\s[-–]\s/)[0].trim().slice(0, 10);
  const leaveType = String(record.leaveType || '').match(/\(([A-Za-z0-9]{1,3})\)$/)?.[1]
    || String(record.leaveType || '').split(/\s[-–]\s/)[0].trim().slice(0, 3);
  const payload = {
    leaveYear: String(record.leaveYear || '').trim().slice(0, 4),
    leaveMonth: String(record.leaveMonth || '').trim().padStart(2, '0').slice(-2),
    empNo,
    leaveType,
    leaveDays: Number(record.leaveDays ?? record.days ?? 0),
    leaveStartDate: String(record.leaveStartDate || record.start || '').slice(0, 10),
    leaveEndDate: String(record.leaveEndDate || record.end || '').slice(0, 10),
    businessCenter: String(record.businessCenter || '').trim().slice(0, 100)
  };
  const res = await api.post('/leaves', payload);
  return { ...record, id: res.data?.leaveId ? String(res.data.leaveId) : record.id };
};

export const update = async (id: string, patch: Partial<LeaveRecord>): Promise<LeaveRecord> => {
  const empNo = String(patch.empNo || patch.epfNo || '').split(/\s[-–]\s/)[0].trim().slice(0, 10);
  const leaveType = String(patch.leaveType || '').match(/\(([A-Za-z0-9]{1,3})\)$/)?.[1]
    || String(patch.leaveType || '').split(/\s[-–]\s/)[0].trim().slice(0, 3);
  const payload = {
    leaveId: isNaN(Number(id)) ? undefined : Number(id),
    leaveYear: String(patch.leaveYear || '').trim().slice(0, 4),
    leaveMonth: String(patch.leaveMonth || '').trim().padStart(2, '0').slice(-2),
    empNo,
    leaveType,
    leaveDays: Number(patch.leaveDays ?? patch.days ?? 0),
    leaveStartDate: String(patch.leaveStartDate || patch.start || '').slice(0, 10),
    leaveEndDate: String(patch.leaveEndDate || patch.end || '').slice(0, 10),
    businessCenter: String(patch.businessCenter || '').trim().slice(0, 100)
  };
  await api.put(`/leaves/${id}`, payload);
  return { id, ...patch } as LeaveRecord;
};

export const remove = async (id: string): Promise<void> => {
  await api.delete(`/leaves/${encodeURIComponent(id)}`);
};
