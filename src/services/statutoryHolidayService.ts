import api from '../api/axios';
import { logAuditAction } from '../utils/auditLogger';

export type StatutoryStatus = 'W' | 'N';

export interface StatutoryHoliday {
  holidayDate: string; // YYYY-MM-DD
  holidayName?: string;
  workingValue: number;    // paid if an eligible employee works on the holiday
  notWorkingValue: number; // paid if an eligible employee does not work on the holiday
}

export interface StatutoryHolidayLine {
  date: string;
  holidayName?: string;
  status: StatutoryStatus;
  source: 'MANUAL' | 'ATTENDANCE';
  amount: number;
}

export interface StatutoryEmployeeRow {
  epfNo: string;
  employeeName: string;
  plantCode?: string;
  eligible: boolean;
  total: number;
  lines: StatutoryHolidayLine[];
}

export interface StatutoryMonth {
  year: string;
  month: string;
  holidays: StatutoryHoliday[];
  employees: StatutoryEmployeeRow[];
}

export const getMonth = async (year: string, month: string, businessCenter?: string): Promise<StatutoryMonth> => {
  const cleanBc = businessCenter ? businessCenter.split(' / ')[0].trim() : '';
  const params: Record<string, string> = { year, month };
  if (cleanBc && cleanBc !== 'ALL') params.businessCenter = cleanBc;
  const response = await api.get<StatutoryMonth>('/statutory-holidays', { params });
  return {
    year: response.data?.year || year,
    month: response.data?.month || month,
    holidays: Array.isArray(response.data?.holidays) ? response.data.holidays : [],
    employees: Array.isArray(response.data?.employees) ? response.data.employees : []
  };
};

export const saveHoliday = async (holiday: StatutoryHoliday): Promise<StatutoryHoliday> => {
  const response = await api.put<StatutoryHoliday>(`/statutory-holidays/${holiday.holidayDate}`, {
    holidayName: holiday.holidayName?.trim() || '',
    workingValue: Number(holiday.workingValue) || 0,
    notWorkingValue: Number(holiday.notWorkingValue) || 0
  });
  logAuditAction({
    action: 'UPDATE',
    module: 'ATTENDANCE',
    entityId: holiday.holidayDate,
    details: `Statutory holiday ${holiday.holidayDate} saved (Working LKR ${holiday.workingValue}, Not Working LKR ${holiday.notWorkingValue})`
  });
  return response.data;
};

export const removeHoliday = async (date: string): Promise<void> => {
  await api.delete(`/statutory-holidays/${date}`);
  logAuditAction({
    action: 'DELETE',
    module: 'ATTENDANCE',
    entityId: date,
    details: `Removed statutory holiday ${date}`
  });
};

/** status 'AUTO' clears the manual selection so attendance decides again. */
export const setStatus = async (date: string, epfNo: string, status: StatutoryStatus | 'AUTO'): Promise<void> => {
  await api.put(`/statutory-holidays/${date}/status`, { epfNo, status });
};
