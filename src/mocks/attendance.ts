import api from '../api/axios';

export type Attendance = {
  id: string; // client-side identifier (UUID or year_month_epfNo_dayIn)
  atttYear: string;            // Attt_Year (NCHAR(4))
  attMonth: string;            // Att_Month (NCHAR(2))
  epfNo: string;               // EPF_No (NCHAR(10))
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
  totalMealValue?: number;     // Total_Meal_Value (FLOAT)
  statutoryHolidays?: number;  // Statutory_holidays (FLOAT)
  sundayPoyaExtra?: number;    // Sunday_Poya_Extra (FLOAT)
  businessCenter: string;      // Business_Center (NCHAR(100))
};

const STORAGE_KEY = 'hsb_attendance_data';

// Initial sample attendance illustrating multi-plant work in the same month:
// e.g., 91EPF001 worked in PL001 from 01 to 10, and in PL002 from 11 to 20
function generateInitialAttendance(): Attendance[] {
  const records: Attendance[] = [];
  const year = '2026';
  const month = '09';

  // 91EPF001 in Plant PL001 for days 01 to 10
  for (let d = 1; d <= 10; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dayIn = `${year}-${month}-${dayStr}`;
    records.push({
      id: `${year}_${month}_91EPF001_${dayIn}`,
      atttYear: year,
      attMonth: month,
      epfNo: '91EPF001',
      plantCode: 'PL001',
      customerCode: 'PL001',
      sectionCode: 'SEC001',
      workingDays: 1,
      otCalAuto: 'Y',
      noOfStaff: 5,
      attAllowance: 'Y',
      dasForAttAllowance: 22,
      basicSalary: 1200,
      dayAllowance: 50,
      nightAllowance: 0,
      dayIn: dayIn,
      timeIn: '08:00',
      dayOut: dayIn,
      timeOut: '16:00',
      halfDay: 0,
      totalWorkingHours: 8,
      totalOt: 0,
      normalDay: 'Y',
      saturdayPoya: 'N',
      specialDay: 'N',
      dayShift: 'Y',
      secondShift: 'N',
      nightShift: 'N',
      fullNight: 'N',
      noOfMeal: 1,
      totalMealValue: 120,
      businessCenter: '001'
    });
  }

  // 91EPF001 in Plant PL002 for days 11 to 18
  for (let d = 11; d <= 18; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dayIn = `${year}-${month}-${dayStr}`;
    records.push({
      id: `${year}_${month}_91EPF001_${dayIn}`,
      atttYear: year,
      attMonth: month,
      epfNo: '91EPF001',
      plantCode: 'PL002',
      customerCode: 'PL002',
      sectionCode: 'SEC002',
      workingDays: 1,
      otCalAuto: 'Y',
      noOfStaff: 5,
      attAllowance: 'Y',
      dasForAttAllowance: 22,
      basicSalary: 1200,
      dayAllowance: 50,
      nightAllowance: 0,
      dayIn: dayIn,
      timeIn: '08:00',
      dayOut: dayIn,
      timeOut: '17:30',
      halfDay: 0,
      totalWorkingHours: 9.5,
      totalOt: 1.5,
      normalDay: 'Y',
      saturdayPoya: 'N',
      specialDay: 'N',
      dayShift: 'Y',
      secondShift: 'N',
      nightShift: 'N',
      fullNight: 'N',
      noOfMeal: 1,
      totalMealValue: 120,
      businessCenter: '001'
    });
  }

  return records;
}

function getStoredAttendance(): Attendance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = generateInitialAttendance();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return generateInitialAttendance();
  }
}

function saveStoredAttendance(items: Attendance[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to persist attendance to localStorage', err);
  }
}

function normalizeLocalDateTime(dateValue?: string, fallbackTime?: string): string | undefined {
  if (!dateValue) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateValue)) return dateValue;

  const baseDate = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
  const time = (fallbackTime || '00:00').trim();
  return `${baseDate}T${time}`.length === 16 ? `${baseDate}T${time}:00` : `${baseDate}T${time}`;
}

export const list = async (businessCenter?: string): Promise<Attendance[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';

  try {
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/attendance', { params });
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const mapped = res.data.map((a: any) => ({
        id: `${a.attYear || a.atttYear}_${a.attMonth}_${a.epfNo}_${a.dayIn}`,
        atttYear: (a.attYear || a.atttYear || '').trim(),
        attMonth: (a.attMonth || '').trim(),
        epfNo: (a.epfNo || '').trim(),
        plantCode: (a.plantCode || '').trim(),
        sectionCode: (a.sectionCode || '').trim() || undefined,
        customerCode: (a.customerCode || '').trim() || undefined,
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
      saveStoredAttendance(mapped);
      return mapped;
    }
  } catch (err) {
    // API failed, fallback to local store
  }

  const all = getStoredAttendance();
  if (!cleanBc || cleanBc === 'ALL') {
    return all;
  }

  return all.filter(a => {
    const aBc = (a.businessCenter || '').trim().toUpperCase();
    return !aBc || aBc === cleanBc || aBc.startsWith(cleanBc) || cleanBc.startsWith(aBc);
  });
};

export const listByEmployee = async (epf: string): Promise<Attendance[]> => {
  try {
    const res = await api.get(`/attendance/by-employee/${epf}`);
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {}
  const all = await list();
  return all.filter(a => (a.epfNo || '').trim() === epf.trim());
};

export const create = async (rec: Attendance): Promise<Attendance> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const recordId = rec.id || `${rec.atttYear || '2026'}_${rec.attMonth || '01'}_${rec.epfNo}_${rec.dayIn}`;

  const payload: Attendance = {
    ...rec,
    id: recordId,
    businessCenter: rec.businessCenter || cleanBc,
    atttYear: rec.atttYear || '2026',
    dayOut: normalizeLocalDateTime(rec.dayOut, rec.timeOut),
    dasForAttAllowance: rec.dasForAttAllowance
  };

  try {
    await api.post('/attendance', {
      ...payload,
      attYear: payload.atttYear,
      daysForAttAllowance: payload.dasForAttAllowance
    });
  } catch {
    // Fallback store
  }

  const stored = getStoredAttendance();
  const existingIdx = stored.findIndex(item => item.id === recordId || (item.epfNo === payload.epfNo && item.dayIn === payload.dayIn));
  if (existingIdx >= 0) {
    stored[existingIdx] = payload;
  } else {
    stored.unshift(payload);
  }
  saveStoredAttendance(stored);

  return payload;
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
      dayOut: normalizeLocalDateTime(patch.dayOut, patch.timeOut),
      daysForAttAllowance: patch.dasForAttAllowance
    };
    try {
      await api.put(`/attendance/${year}/${month}/${epfNo}/${dayIn}`, payload);
    } catch {}
  }

  const stored = getStoredAttendance();
  const index = stored.findIndex(item => item.id === id);
  if (index >= 0) {
    stored[index] = { ...stored[index], ...patch };
    saveStoredAttendance(stored);
    return stored[index];
  }

  return { id, ...patch } as Attendance;
};

export const bulkSave = async (records: Attendance[]): Promise<void> => {
  try {
    await api.post('/attendance/bulk', records);
  } catch {
    // Fallback store
  }

  const stored = getStoredAttendance();
  const map = new Map<string, Attendance>();
  stored.forEach(r => map.set(r.id || `${r.atttYear}_${r.attMonth}_${r.epfNo}_${r.dayIn}`, r));

  records.forEach(r => {
    const key = r.id || `${r.atttYear}_${r.attMonth}_${r.epfNo}_${r.dayIn}`;
    map.set(key, { ...map.get(key), ...r, id: key });
  });

  saveStoredAttendance(Array.from(map.values()));
};

export const remove = async (id: string): Promise<void> => {
  const parts = id.split('_');
  if (parts.length >= 4) {
    const [year, month, epfNo, dayIn] = parts;
    try {
      await api.delete(`/attendance/${encodeURIComponent(year)}/${encodeURIComponent(month)}/${encodeURIComponent(epfNo)}/${encodeURIComponent(dayIn)}`);
    } catch {}
  }

  const stored = getStoredAttendance().filter(item => item.id !== id);
  saveStoredAttendance(stored);
};
