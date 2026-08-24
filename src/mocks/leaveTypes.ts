export type LeaveType = {
  code: string;
  name: string;
};

export const leaveTypes: LeaveType[] = [
  { code: 'ANU', name: 'Annual' },
  { code: 'CAS', name: 'Casual' },
  { code: 'MED', name: 'Medical' },
  { code: 'NOP', name: 'No Pay' }
];

export const list = () => Promise.resolve([...leaveTypes]);
export const create = (record: LeaveType) => {
  leaveTypes.push(record);
  return Promise.resolve(record);
};
export const update = (code: string, patch: Partial<LeaveType>) => {
  const index = leaveTypes.findIndex(type => type.code === code);
  if (index === -1) return Promise.resolve(null as any);
  leaveTypes[index] = { ...leaveTypes[index], ...patch };
  return Promise.resolve(leaveTypes[index]);
};
export const remove = (code: string) => {
  const index = leaveTypes.findIndex(type => type.code === code);
  if (index >= 0) leaveTypes.splice(index, 1);
  return Promise.resolve();
};
