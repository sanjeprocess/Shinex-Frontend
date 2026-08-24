import { v4 as uuid } from 'uuid';

// The real backend table has no primary key; this is a local surrogate used for mock CRUD only.
// When moved to the real DB, add a proper identity PK such as `Leave_ID INT IDENTITY(1,1) PRIMARY KEY`.
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

export const leaves: LeaveRecord[] = [
  {
    id: uuid(),
    leaveYear: '2026',
    leaveMonth: '07',
    empNo: 'EPF00001',
    epfNo: 'EPF00001',
    leaveType: 'ANU',
    leaveDays: 5,
    leaveStartDate: '2026-07-20',
    leaveEndDate: '2026-07-24',
    businessCenter: '001',
    start: '2026-07-20',
    end: '2026-07-24',
    days: 5
  },
  {
    id: uuid(),
    leaveYear: '2026',
    leaveMonth: '08',
    empNo: 'EPF00003',
    epfNo: 'EPF00003',
    leaveType: 'MED',
    leaveDays: 2,
    leaveStartDate: '2026-08-03',
    leaveEndDate: '2026-08-04',
    businessCenter: '002',
    start: '2026-08-03',
    end: '2026-08-04',
    days: 2
  },
  {
    id: uuid(),
    leaveYear: '2026',
    leaveMonth: '08',
    empNo: 'EPF00005',
    epfNo: 'EPF00005',
    leaveType: 'CAS',
    leaveDays: 1,
    leaveStartDate: '2026-08-10',
    leaveEndDate: '2026-08-10',
    businessCenter: '002',
    start: '2026-08-10',
    end: '2026-08-10',
    days: 1
  }
];

export const list = () => Promise.resolve([...leaves]);
export const listByEmployee = (epf: string) => Promise.resolve(leaves.filter(record => record.empNo === epf || record.epfNo === epf));
export const create = (record: LeaveRecord) => {
  leaves.push(record);
  return Promise.resolve(record);
};
export const update = (id: string, patch: Partial<LeaveRecord>) => {
  const index = leaves.findIndex(record => record.id === id);
  if (index === -1) return Promise.resolve(null as any);
  leaves[index] = { ...leaves[index], ...patch };
  return Promise.resolve(leaves[index]);
};
export const remove = (id: string) => {
  const index = leaves.findIndex(record => record.id === id);
  if (index >= 0) leaves.splice(index, 1);
  return Promise.resolve();
};
