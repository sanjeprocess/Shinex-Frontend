import api from '../api/axios';

export type LeaveType = {
  code: string;
  name: string;
};

export const list = async (): Promise<LeaveType[]> => {
  try {
    const res = await api.get('/leave-types');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((l: any) => ({
        code: (l.leaveType || l.leaveTypeCode || l.code || '').trim(),
        name: (l.leaveName || l.leaveTypeName || l.name || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load leave types from API', err);
  }
  return [];
};

export const create = async (record: LeaveType): Promise<LeaveType> => {
  const payload = { leaveType: record.code.trim(), leaveName: record.name.trim() };
  await api.post('/leave-types', payload);
  return record;
};

export const update = async (code: string, patch: Partial<LeaveType>): Promise<LeaveType> => {
  const normalizedCode = code.trim();
  const payload = { leaveType: normalizedCode, leaveName: patch.name?.trim() };
  await api.put(`/leave-types/${encodeURIComponent(normalizedCode)}`, payload);
  return { code: normalizedCode, ...patch } as LeaveType;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/leave-types/${encodeURIComponent(code)}`);
};
