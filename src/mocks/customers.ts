import api from '../api/axios';

export type Customer = { id: string; code: string; name: string; address1?: string; address2?: string; address3?: string; contactName?: string; contactNo?: string; email?: string; workingDays?: number; otAuto?: boolean; minStaffQty?: number; attendanceAllowance?: number; daysToWorkForAllowance?: number };

export const customers: Customer[] = [];

export const list = async (): Promise<Customer[]> => {
  try {
    const res = await api.get('/customers');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((c: any) => ({
        id: (c.code || c.custCode || '').trim(),
        code: (c.code || c.custCode || '').trim(),
        name: (c.name || c.custName || '').trim(),
        address1: (c.address1 || '').trim(),
        address2: (c.address2 || '').trim(),
        address3: (c.address3 || '').trim(),
        contactName: (c.contactName || '').trim(),
        contactNo: (c.contactNo || '').trim(),
        email: (c.email || '').trim(),
        workingDays: c.workingDays ? Number(c.workingDays) : 26,
        otAuto: c.otCalculationAuto === 'Y' || c.otAuto === true,
        minStaffQty: c.minStaffQty ? Number(c.minStaffQty) : 0,
        attendanceAllowance: c.attendanceAllowance ? Number(c.attendanceAllowance) : 0,
        daysToWorkForAllowance: c.daysToWorkForAttAllowance ? Number(c.daysToWorkForAttAllowance) : 0
      }));
    }
  } catch (err) {
    console.error('Failed to load customers from API', err);
  }
  return [];
};

export const create = async (r: Customer): Promise<Customer> => {
  const payload = {
    custCode: r.code,
    custName: r.name,
    address1: r.address1,
    address2: r.address2,
    address3: r.address3,
    contactName: r.contactName,
    contactNo: r.contactNo,
    email: r.email,
    workingDays: r.workingDays,
    otCalculationAuto: r.otAuto ? 'Y' : 'N',
    minStaffQty: r.minStaffQty,
    attendanceAllowance: r.attendanceAllowance ? String(r.attendanceAllowance) : '0',
    daysToWorkForAttAllowance: r.daysToWorkForAllowance
  };
  await api.post('/customers', payload);
  return r;
};

export const update = async (code: string, patch: Partial<Customer>): Promise<Customer> => {
  const payload = {
    custCode: code,
    custName: patch.name,
    address1: patch.address1,
    address2: patch.address2,
    address3: patch.address3,
    contactName: patch.contactName,
    contactNo: patch.contactNo,
    email: patch.email,
    workingDays: patch.workingDays,
    otCalculationAuto: patch.otAuto ? 'Y' : 'N',
    minStaffQty: patch.minStaffQty,
    attendanceAllowance: patch.attendanceAllowance ? String(patch.attendanceAllowance) : undefined,
    daysToWorkForAttAllowance: patch.daysToWorkForAllowance
  };
  await api.put(`/customers/${code}`, payload);
  return { code, ...patch } as Customer;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/customers/${code}`);
};
