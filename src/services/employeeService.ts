import { Employee } from '../types/employee';
import api from '../api/axios';
import { logAuditAction } from '../utils/auditLogger';

export const list = async (): Promise<Employee[]> => {
  const response = await api.get<Employee[]>('/employees');
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
  const response = await api.put<Employee>(`/employees/${encodeURIComponent(epf)}`, normalizeEmployee({ ...e, epfNo: epf }));
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
    bankName: e.bankName?.trim()
  };
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
