import api from '../api/axios';

export type Attendance = {
  id: string; // client-side identifier (UUID or year_month_epfNo_dayIn)
  atttYear: string;            // Attt_Year (NCHAR(4))
  attMonth: string;            // Att_Month (NCHAR(2))
  epfNo: string;               // EPF_No (NCHAR(10))
  employeeName?: string;       // Employee_Name (NVARCHAR(100))
  plantCode: string;           // Plant_Code (NCHAR(10))
  sectionCode?: string;        // Section_Code (Optional)
  customerCode?: string;       // Customer_Code (Optional)
  workingDays?: number;        // Working_Days (FLOAT)
  otCalAuto?: string;          // OT_Cal_Auto (NCHAR(1)) - 'Y'/'N'
  noOfStaff?: number;          // No_Of_Staff (FLOAT)
  attAllowance?: string;       // Att_Allowance (NCHAR(1)) - 'Y'/'N'
  dasForAttAllowance?: number; // Das_for_Att_Alowance (FLOAT)
  poyaSaturdayNormal?: string; // Poya_Saturday_normal (NCHAR(1)) - 'Y'/'N'
  basicSalary?: number;        // Basic_Salary (FLOAT)
  dayAllowance?: number;       // Day_Allowance (FLOAT)
  nightAllowance?: number;     // Night_Allowance (FLOAT)
  dayIn: string;               // Day_in (DATE) - "yyyy-MM-dd"
  timeIn: string;              // Time_IN (TIME(7)) - "HH:mm"
  dayOut?: string;             // Day_out (DATETIME) - "yyyy-MM-ddTHH:mm"
  timeOut?: string;            // Time_Out (TIME(7)) - "HH:mm"
  halfDay?: number;            // Half_Day (FLOAT) - 0 or 0.5 or 1
  totalWorkingHours?: number;  // Total_Working_Hours (FLOAT)
  totalOt?: number;            // Total_OT (FLOAT)
  normalDay?: string;          // Normal_Day (NCHAR(1)) - 'Y'/'N'
  saturdayPoya?: string;       // Saturday_Poya (NCHAR(1)) - 'Y'/'N'
  specialDay?: string;         // Special_Day (CHAR(1)) - 'Y'/'N'
  lateAllowNo?: string;        // Late_Allow_No (NCHAR(11))
  dayShift?: string;           // Day_shift (NCHAR(1)) - 'Y'/'N'
  secondShift?: string;        // second_Shift (NCHAR(1)) - 'Y'/'N'
  nightShift?: string;         // Night_Shift (NCHAR(1)) - 'Y'/'N'
  fullNight?: string;          // Full_Night (NCHAR(1)) - 'Y'/'N'
  noOfMeal?: number;           // No_of_Meal (FLOAT)
  mealType?: string;           // Meal_Type (NVARCHAR(50))
  totalMealValue?: number;     // Total_Meal_Value (FLOAT)
  statutoryHolidays?: number;  // Statutory_holidays (FLOAT)
  sundayPoyaExtra?: number;    // Sunday_Poya_Extra (FLOAT)
  businessCenter: string;      // Business_Center (NCHAR(100))
};

function normalizeLocalDateTime(dateValue?: string, fallbackTime?: string): string | undefined {
  if (!dateValue) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateValue)) return dateValue;

  const baseDate = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
  const time = (fallbackTime || '00:00').trim();
  return `${baseDate}T${time}`.length === 16 ? `${baseDate}T${time}:00` : `${baseDate}T${time}`;
}

function fromApi(a: any): Attendance {
  return {
    id: `${a.attYear || a.atttYear}_${a.attMonth}_${a.epfNo}_${a.dayIn}`,
    atttYear: String(a.attYear || a.atttYear || '').trim(),
    attMonth: String(a.attMonth || '').trim(),
    epfNo: String(a.epfNo || '').trim(),
    employeeName: String(a.employeeName || a.empName || '').trim() || undefined,
    plantCode: String(a.plantCode || '').trim(),
    sectionCode: String(a.sectionCode || '').trim() || undefined,
    customerCode: String(a.customerCode || '').trim() || undefined,
    workingDays: a.workingDays,
    otCalAuto: String(a.otCalAuto || '').trim(),
    noOfStaff: a.noOfStaff,
    attAllowance: String(a.attAllowance || '').trim(),
    dasForAttAllowance: a.daysForAttAllowance ?? a.dasForAttAllowance,
    poyaSaturdayNormal: String(a.poyaSaturdayNormal || '').trim(),
    basicSalary: a.basicSalary,
    dayAllowance: a.dayAllowance,
    nightAllowance: a.nightAllowance,
    dayIn: a.dayIn || '',
    timeIn: a.timeIn || '',
    dayOut: a.dayOut || '',
    timeOut: a.timeOut || '',
    halfDay: a.halfDay,
    totalWorkingHours: a.totalWorkingHours,
    totalOt: a.totalOt,
    normalDay: String(a.normalDay || '').trim(),
    saturdayPoya: String(a.saturdayPoya || '').trim(),
    specialDay: String(a.specialDay || '').trim(),
    lateAllowNo: String(a.lateAllowNo || '').trim(),
    dayShift: String(a.dayShift || '').trim(),
    secondShift: String(a.secondShift || '').trim(),
    nightShift: String(a.nightShift || '').trim(),
    fullNight: String(a.fullNight || '').trim(),
    noOfMeal: a.noOfMeal,
    mealType: String(a.mealType || '').trim() || undefined,
    totalMealValue: a.totalMealValue,
    statutoryHolidays: a.statutoryHolidays,
    sundayPoyaExtra: a.sundayPoyaExtra,
    businessCenter: String(a.businessCenter || '').trim()
  };
}

export const list = async (businessCenter?: string): Promise<Attendance[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const res = await api.get('/attendance', { params });
  if (!Array.isArray(res.data)) {
    throw new Error('Attendance endpoint returned an invalid response.');
  }
  return res.data.map(fromApi);
};

export const listByEmployee = async (epf: string): Promise<Attendance[]> => {
  const res = await api.get(`/attendance/by-employee/${encodeURIComponent(epf)}`);
  if (!Array.isArray(res.data)) {
    throw new Error('Attendance endpoint returned an invalid response.');
  }
  return res.data.map(fromApi);
};

export const create = async (rec: Attendance): Promise<Attendance> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const payload: Attendance = {
    ...rec,
    businessCenter: rec.businessCenter || cleanBc,
    dayOut: normalizeLocalDateTime(rec.dayOut, rec.timeOut),
    dasForAttAllowance: rec.dasForAttAllowance
  };
  const res = await api.post('/attendance', {
    ...payload,
    attYear: payload.atttYear,
    daysForAttAllowance: payload.dasForAttAllowance
  });
  return fromApi(res.data);
};

export const update = async (id: string, patch: Partial<Attendance>): Promise<Attendance> => {
  const parts = id.split('_');
  if (parts.length < 4) {
    throw new Error('Invalid attendance record identifier.');
  }
  const [year, month, epfNo, dayIn] = parts;
  const payload = {
    ...patch,
    attYear: patch.atttYear || year,
    attMonth: month,
    epfNo,
    dayIn,
    dayOut: normalizeLocalDateTime(patch.dayOut, patch.timeOut),
    daysForAttAllowance: patch.dasForAttAllowance
  };
  const res = await api.put(
    `/attendance/${encodeURIComponent(year)}/${encodeURIComponent(month)}/${encodeURIComponent(epfNo)}/${encodeURIComponent(dayIn)}`,
    payload
  );
  return fromApi(res.data);
};

export type BulkSaveSummary = {
  plantCode: string;
  year: string;
  month: string;
  employeeCount: number;
  totalRows: number;
  inserted: number;
  updated: number;
  failed: number;
  message: string;
};

export type BulkSaveResult = {
  status: string;
  totalSaved: number;
  inserted: number;
  updated: number;
  failed: number;
  summaries: BulkSaveSummary[];
  message: string;
  records?: Attendance[];
};

export const bulkSave = async (records: Attendance[]): Promise<BulkSaveResult> => {
  const res = await api.post('/attendance/bulk', records);
  const result = res.data;
  if (!result || !Array.isArray(result.summaries)) {
    throw new Error('Attendance bulk endpoint returned an invalid response.');
  }
  return {
    status: result.status,
    totalSaved: result.totalSaved,
    inserted: result.inserted,
    updated: result.updated,
    failed: result.failed,
    summaries: result.summaries,
    message: result.message,
    records: Array.isArray(result.records) ? result.records.map(fromApi) : undefined
  };
};

export type AttendancePlantRange = {
  epfNo: string;
  fromDate: string;
  toDate: string;
  plantCode: string;
  sectionCode?: string;
  businessCenter: string;
};

export const updatePlantRange = async (range: AttendancePlantRange): Promise<{ updatedRows: number }> => {
  const response = await api.put('/attendance/plant-range', range);
  return response.data;
};

export const remove = async (id: string): Promise<void> => {
  const parts = id.split('_');
  if (parts.length < 4) {
    throw new Error('Invalid attendance record identifier.');
  }
  const [year, month, epfNo, dayIn] = parts;
  await api.delete(
    `/attendance/${encodeURIComponent(year)}/${encodeURIComponent(month)}/${encodeURIComponent(epfNo)}/${encodeURIComponent(dayIn)}`
  );
};
