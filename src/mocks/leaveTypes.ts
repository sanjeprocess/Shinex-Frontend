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
        code: (l.leaveTypeCode || l.code || '').trim(),
        name: (l.leaveTypeName || l.name || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load leave types from API', err);
  }
  return [];
};

export const create = async (record: LeaveType): Promise<LeaveType> => {
  const payload = { leaveTypeCode: record.code, leaveTypeName: record.name };
  await api.post('/leave-types', payload);
  return record;
};

export const update = async (code: string, patch: Partial<LeaveType>): Promise<LeaveType> => {
  const payload = { leaveTypeCode: code, leaveTypeName: patch.name };
  await api.put(`/leave-types/${code}`, payload);
  return { code, ...patch } as LeaveType;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/leave-types/${code}`);
};
