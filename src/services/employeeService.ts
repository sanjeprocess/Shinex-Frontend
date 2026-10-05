import { Employee } from '../types/employee';
import api from '../api/axios';
import { logAuditAction } from '../utils/auditLogger';

export const list = async (businessCenter?: string): Promise<Employee[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const response = await api.get<Employee[]>('/employees', { params });
  if (Array.isArray(response.data)) {
    return response.data.map((e: any) => ({
      ...e,
      branchName: e.branchName || e.bankBranchName || '',
      bankBranchName: e.bankBranchName || e.branchName || ''
    }));
  }
  return response.data;
};

export const getById = async (epf: string): Promise<Employee | undefined> => {
  try {
    const response = await api.get<Employee>(`/employees/${encodeURIComponent(epf)}`);
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) return undefined;
    throw error;
  }
};

export const getNextEpfNo = async (businessCenter?: string): Promise<string> => {
  try {
    const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get<{ nextEpf: string }>('/employees/next-epf', { params });
    if (res.data?.nextEpf) {
      return res.data.nextEpf;
    }
  } catch (err) {
    console.warn('Failed to fetch next EPF from server, falling back to local calculation', err);
  }

  try {
    const emps = await list(businessCenter);
    let maxNum = 0;
    let maxDigits = 3;
    emps.forEach(e => {
      const epf = (e.epfNo || '').trim().toUpperCase();
      let numPart = '';
      if (epf.startsWith('91EPF')) {
        numPart = epf.slice(5).trim();
      } else if (epf.startsWith('EPF')) {
        numPart = epf.slice(3).trim();
      } else {
        numPart = epf.replace(/\D/g, '');
      }
      if (numPart) {
        const val = parseInt(numPart, 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
          if (numPart.length > maxDigits) maxDigits = numPart.length;
        }
      }
    });
    const nextVal = maxNum + 1;
    return `91EPF${String(nextVal).padStart(Math.max(3, maxDigits), '0')}`;
  } catch {
    return '91EPF001';
  }
};

export const create = async (e: Employee): Promise<Employee> => {
  const response = await api.post<Employee>('/employees', normalizeEmployee(e));
  const result = response.data;
  logAuditAction({
    action: 'CREATE',
    module: 'EMPLOYEE',
    entityId: e.epfNo,
    details: `Added new employee ${e.epfNo} (${e.firstName} ${e.lastName || ''}) with basic salary LKR ${e.basicSalary || 0}`
  });
  return result;
};

export const update = async (epf: string, e: Partial<Employee>): Promise<Employee> => {
  const fullEmployee = { ...e, epfNo: epf, firstName: e.firstName || '' } as Employee;
  const response = await api.put<Employee>(`/employees/${encodeURIComponent(epf)}`, normalizeEmployee(fullEmployee));
  const result = response.data;
  logAuditAction({
    action: 'UPDATE',
    module: 'EMPLOYEE',
    entityId: epf,
    details: `Updated employee ${epf} details (${e.firstName || ''} ${e.lastName || ''})`
  });
  return result;
};

function normalizeEmployee(e: Employee): Employee {
  const hiredDate = e.hiredDate?.trim() || '';
  const hiredMonth = hiredDate ? hiredDate.slice(5, 7) : (e.hiredMonth || '').trim();
  return {
    ...e,
    epfNo: e.epfNo.trim().slice(0, 10),
    firstName: e.firstName.trim(),
    lastName: e.lastName?.trim(),
    plantCode: (e.plantCode || '').split(' / ')[0].trim(),
    businessCenter: (e.businessCenter || '').split(' / ')[0].trim(),
    dateOfBirth: e.dateOfBirth?.trim(),
    hiredDate,
    hiredMonth,
    bankName: e.bankName?.trim(),
    branchName: e.branchName?.trim(),
    bankBranchName: e.branchName?.trim(),
    bankAccountNumber: e.bankAccountNumber?.trim(),
    swift: e.swift?.trim()
  } as any;
}

export const remove = async (epf: string): Promise<void> => {
  await api.delete(`/employees/${encodeURIComponent(epf)}`);
  logAuditAction({
    action: 'DELETE',
    module: 'EMPLOYEE',
    entityId: epf,
    details: `Removed employee record ${epf}`
  });
};
