import api from '../api/axios';

export type Attendance = {
  id: string; // client-side identifier (UUID)
  atttYear: string;            // Attt_Year (NCHAR(4))
  attMonth: string;            // Att_Month (NCHAR(2))
  epfNo: string;               // EPF_No (NCHAR(10))
  plantCode: string;           // Plant_Code (NCHAR(10))
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
  totalMealValue?: number;     // Total_Meal_Value (FLOAT)
  statutoryHolidays?: number;  // Statutory_holidays (FLOAT)
  sundayPoyaExtra?: number;    // Sunday_Poya_Extra (FLOAT)
  businessCenter: string;      // Business_Center (NCHAR(100))
};

export const list = async (): Promise<Attendance[]> => {
  try {
    const res = await api.get('/attendance');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((a: any) => ({
        id: `${a.attYear || a.atttYear}_${a.attMonth}_${a.epfNo}_${a.dayIn}`,
        atttYear: (a.attYear || a.atttYear || '').trim(),
        attMonth: (a.attMonth || '').trim(),
        epfNo: (a.epfNo || '').trim(),
        plantCode: (a.plantCode || '').trim(),
        workingDays: a.workingDays,
        otCalAuto: (a.otCalAuto || '').trim(),
        noOfStaff: a.noOfStaff,
        attAllowance: (a.attAllowance || '').trim(),
        dasForAttAllowance: a.daysForAttAllowance || a.dasForAttAllowance,
        poyaSaturdayNormal: (a.poyaSaturdayNormal || '').trim(),
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
        normalDay: (a.normalDay || '').trim(),
        saturdayPoya: (a.saturdayPoya || '').trim(),
        specialDay: (a.specialDay || '').trim(),
        lateAllowNo: (a.lateAllowNo || '').trim(),
        dayShift: (a.dayShift || '').trim(),
        secondShift: (a.secondShift || '').trim(),
        nightShift: (a.nightShift || '').trim(),
        fullNight: (a.fullNight || '').trim(),
        noOfMeal: a.noOfMeal,
        totalMealValue: a.totalMealValue,
        statutoryHolidays: a.statutoryHolidays,
        sundayPoyaExtra: a.sundayPoyaExtra,
        businessCenter: (a.businessCenter || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load attendance from API', err);
  }
  return [];
};

export const listByEmployee = async (epf: string): Promise<Attendance[]> => {
  try {
    const res = await api.get(`/attendance/by-employee/${epf}`);
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {}
  const all = await list();
  return all.filter(a => a.epfNo === epf);
};

export const create = async (rec: Attendance): Promise<Attendance> => {
  const payload = {
    ...rec,
    attYear: rec.atttYear || '2026',
    daysForAttAllowance: rec.dasForAttAllowance
  };
  await api.post('/attendance', payload);
  return rec;
};

export const update = async (id: string, patch: Partial<Attendance>): Promise<Attendance> => {
  const parts = id.split('_');
  if (parts.length >= 4) {
    const [year, month, epfNo, dayIn] = parts;
    const payload = {
      ...patch,
      attYear: patch.atttYear || year,
      attMonth: month,
      epfNo: epfNo,
      dayIn: dayIn,
      daysForAttAllowance: patch.dasForAttAllowance
    };
    await api.put(`/attendance/${year}/${month}/${epfNo}/${dayIn}`, payload);
  }
  return { id, ...patch } as Attendance;
};

export const remove = async (id: string): Promise<void> => {
  const parts = id.split('_');
  if (parts.length >= 4) {
    const [year, month, epfNo, dayIn] = parts;
    await api.delete(`/attendance/${year}/${month}/${epfNo}/${dayIn}`);
  }
};
