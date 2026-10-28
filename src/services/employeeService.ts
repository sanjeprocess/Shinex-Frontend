import { Employee } from '../types/employee';
import api from '../api/axios';
import { logAuditAction } from '../utils/auditLogger';

export const list = async (businessCenter?: string): Promise<Employee[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const response = await api.get<Employee[]>('/employees', { params });
  const empMealCache = JSON.parse(localStorage.getItem('hsb_employee_meal_settings') || '{}');
  const empStatCache = JSON.parse(localStorage.getItem('hsb_employee_statutory_settings') || '{}');
  if (Array.isArray(response.data)) {
    return response.data.map((e: any) => {
      const epf = (e.epfNo || '').trim();
      const cached = empMealCache[epf] || {};
      const cachedStat = empStatCache[epf] || {};
      return {
        ...e,
        branchName: e.branchName || e.bankBranchName || '',
        bankBranchName: e.bankBranchName || e.branchName || '',
        mealType: e.mealType || cached.mealType || 'Standard',
        mealValue: e.mealValue != null ? Number(e.mealValue) : (cached.mealValue != null ? Number(cached.mealValue) : 200),
        statutoryHolidayEligible: e.statutoryHolidayEligible !== undefined
          ? Boolean(e.statutoryHolidayEligible)
          : (cachedStat.eligible !== undefined ? Boolean(cachedStat.eligible) : true),
        dayRate: e.dayRate != null ? Number(e.dayRate) : (cachedStat.dayRate != null ? Number(cachedStat.dayRate) : (e.basicSalary ? Number(e.basicSalary) : 2000))
      };
    });
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
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const response = await api.get<{ nextEpf?: string }>('/employees/next-epf', { params });
  if (!response.data?.nextEpf) {
    throw new Error('The server did not provide the next EPF number.');
  }
  return response.data.nextEpf;
};

export const create = async (e: Employee): Promise<Employee> => {
  try {
    const empMealCache = JSON.parse(localStorage.getItem('hsb_employee_meal_settings') || '{}');
    empMealCache[e.epfNo.trim()] = {
      mealType: e.mealType || 'Standard',
      mealValue: e.mealValue != null ? Number(e.mealValue) : 200
    };
    localStorage.setItem('hsb_employee_meal_settings', JSON.stringify(empMealCache));

    const empStatCache = JSON.parse(localStorage.getItem('hsb_employee_statutory_settings') || '{}');
    empStatCache[e.epfNo.trim()] = {
      eligible: e.statutoryHolidayEligible !== undefined ? Boolean(e.statutoryHolidayEligible) : true,
      dayRate: e.dayRate != null ? Number(e.dayRate) : (e.basicSalary ? Number(e.basicSalary) : 2000)
    };
    localStorage.setItem('hsb_employee_statutory_settings', JSON.stringify(empStatCache));
  } catch {}

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
  try {
    const empMealCache = JSON.parse(localStorage.getItem('hsb_employee_meal_settings') || '{}');
    empMealCache[epf.trim()] = {
      ...(empMealCache[epf.trim()] || {}),
      ...(e.mealType !== undefined ? { mealType: e.mealType } : {}),
      ...(e.mealValue !== undefined ? { mealValue: Number(e.mealValue) } : {})
    };
    localStorage.setItem('hsb_employee_meal_settings', JSON.stringify(empMealCache));

    const empStatCache = JSON.parse(localStorage.getItem('hsb_employee_statutory_settings') || '{}');
    empStatCache[epf.trim()] = {
      ...(empStatCache[epf.trim()] || {}),
      ...(e.statutoryHolidayEligible !== undefined ? { eligible: Boolean(e.statutoryHolidayEligible) } : {}),
      ...(e.dayRate !== undefined ? { dayRate: Number(e.dayRate) } : {})
    };
    localStorage.setItem('hsb_employee_statutory_settings', JSON.stringify(empStatCache));
  } catch {}

  const payload: any = { ...e, epfNo: epf.trim() };
  if (payload.firstName != null) payload.firstName = payload.firstName.trim();
  if (payload.lastName != null) payload.lastName = payload.lastName.trim();
  if (payload.plantCode != null) payload.plantCode = payload.plantCode.split(' / ')[0].trim();
  if (payload.businessCenter != null) payload.businessCenter = payload.businessCenter.split(' / ')[0].trim();
  const response = await api.put<Employee>(`/employees/${encodeURIComponent(epf)}`, payload);
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
