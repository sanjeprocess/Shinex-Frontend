import api from '../api/axios';
import { Employee } from '../types/employee';

export const employees: Employee[] = [];

export const list = async (businessCenter?: string): Promise<Employee[]> => {
  const activeBc = businessCenter || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const res = await api.get('/employees', { params });
  if (!Array.isArray(res.data)) {
    throw new Error('Employee endpoint returned an invalid response.');
  }
  return res.data.map((e: any) => ({
        epfNo: (e.epfNo || '').trim(),
        nicNo: (e.nicNo || '').trim(),
        firstName: (e.firstName || e.empName || '').trim(),
        lastName: (e.lastName || e.empNam1 || '').trim(),
        dateOfBirth: e.dateOfBirth || '',
        gender: (e.gender || '').trim(),
        address: (e.address || '').trim(),
        homeContact: (e.contactNo || e.homeContact || '').trim(),
        mobile: (e.mobileNo || e.mobile || '').trim(),
        email: (e.emailAddress || e.email || '').trim(),
        plantCode: (e.plantCode || '').trim(),
        sectionCode: (e.sectionCode || '').trim(),
        businessCenter: (e.businessCenter || '').trim(),
        hiredDate: e.hiredDate || '',
        hiredMonth: (e.hiredMonth || '').trim(),
        statusActive: true,
        basicSalary: e.basicSalary || 0,
        dayAllowance: e.dayAllowance || 0,
        nightAllowance: e.nightAllowance || 0,
        sundayPoyaExtra: e.sundayPoyaExtra || 0,
        bankAccountNumber: (e.bankAccountNumber || '').trim(),
        bankName: (e.bankName || '').trim(),
        branchName: (e.bankBranchName || e.branchName || '').trim(),
        branchCode: (e.branchCode || '').trim(),
        swift: (e.swift || '').trim(),
        bCardYes: e.bCardYes === 'Y' || e.bCardYes === true,
        deathDonation: e.dethDenotion === 'Y' || e.deathDonation === true
  }));
};

export const getById = async (epf: string): Promise<Employee | undefined> => {
  try {
    const res = await api.get(`/employees/${encodeURIComponent(epf)}`);
    return res.data || undefined;
  } catch (error: any) {
    if (error?.response?.status === 404) return undefined;
    throw error;
  }
};

export const create = async (e: Employee): Promise<Employee> => {
  const payload = {
    ...e,
    contactNo: e.homeContact || e.mobile,
    mobileNo: e.mobile,
    emailAddress: e.email,
    bankBranchName: e.branchName,
    bCardYes: e.bCardYes ? 'Y' : 'N',
    dethDenotion: e.deathDonation ? 'Y' : 'N'
  };
  await api.post('/employees', payload);
  return e;
};

export const update = async (epf: string, e: Partial<Employee>): Promise<Employee> => {
  const payload = {
    ...e,
    epfNo: epf,
    contactNo: e.homeContact || e.mobile,
    mobileNo: e.mobile,
    emailAddress: e.email,
    bankBranchName: e.branchName,
    bCardYes: e.bCardYes ? 'Y' : 'N',
    dethDenotion: e.deathDonation ? 'Y' : 'N'
  };
  await api.put(`/employees/${epf}`, payload);
  return { epfNo: epf, ...e } as Employee;
};

export const remove = async (epf: string): Promise<void> => {
  await api.delete(`/employees/${encodeURIComponent(epf)}`);
};
