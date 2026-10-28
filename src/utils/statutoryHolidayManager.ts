export interface StatutoryHolidaySettings {
  workedRateType: 'multiplier' | 'fixed';
  workedRateValue: number; // e.g. 2.0x or Rs. 2000
  notWorkedRateType: 'multiplier' | 'fixed';
  notWorkedRateValue: number; // e.g. 1.0x or Rs. 200
}

export const DEFAULT_STATUTORY_SETTINGS: StatutoryHolidaySettings = {
  workedRateType: 'multiplier',
  workedRateValue: 2.0, // 2x Day Rate for worked
  notWorkedRateType: 'multiplier',
  notWorkedRateValue: 1.0 // 1x Day Rate for not worked
};

export interface StatutoryMonthConfig {
  year: string;
  month: string;
  hasHoliday: boolean;
  holidayDates: string[]; // YYYY-MM-DD
  holidayName?: string;
}

export interface EmployeeStatutoryEntry {
  epfNo: string;
  employeeName: string;
  plantCode?: string;
  sectionCode?: string;
  eligible: boolean;
  workedOnHoliday: boolean;
  dayValue: number;
  holidayValue: number;
}

const SETTINGS_KEY = 'hsb_statutory_holiday_admin_settings';
const CONFIG_PREFIX = 'hsb_statutory_holiday_config_';
const ENTRIES_PREFIX = 'hsb_statutory_holiday_entries_';

export function getStatutorySettings(): StatutoryHolidaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workedRateType: parsed.workedRateType || 'multiplier',
        workedRateValue: parsed.workedRateValue != null ? Number(parsed.workedRateValue) : 2.0,
        notWorkedRateType: parsed.notWorkedRateType || 'multiplier',
        notWorkedRateValue: parsed.notWorkedRateValue != null ? Number(parsed.notWorkedRateValue) : 1.0
      };
    }
  } catch {}
  return { ...DEFAULT_STATUTORY_SETTINGS };
}

export function saveStatutorySettings(settings: StatutoryHolidaySettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function getStatutoryMonthConfig(year: string, month: string): StatutoryMonthConfig {
  const cleanYear = year.trim();
  const cleanMonth = String(month).trim().padStart(2, '0');
  const key = `${CONFIG_PREFIX}${cleanYear}_${cleanMonth}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    year: cleanYear,
    month: cleanMonth,
    hasHoliday: false,
    holidayDates: [],
    holidayName: ''
  };
}

export function saveStatutoryMonthConfig(config: StatutoryMonthConfig): void {
  const cleanYear = config.year.trim();
  const cleanMonth = String(config.month).trim().padStart(2, '0');
  const key = `${CONFIG_PREFIX}${cleanYear}_${cleanMonth}`;
  try {
    localStorage.setItem(key, JSON.stringify({
      ...config,
      year: cleanYear,
      month: cleanMonth
    }));
  } catch {}
}

export function getEmployeeStatutoryEntries(year: string, month: string): Record<string, EmployeeStatutoryEntry> {
  const cleanYear = year.trim();
  const cleanMonth = String(month).trim().padStart(2, '0');
  const key = `${ENTRIES_PREFIX}${cleanYear}_${cleanMonth}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveEmployeeStatutoryEntries(
  year: string,
  month: string,
  entries: Record<string, EmployeeStatutoryEntry>
): void {
  const cleanYear = year.trim();
  const cleanMonth = String(month).trim().padStart(2, '0');
  const key = `${ENTRIES_PREFIX}${cleanYear}_${cleanMonth}`;
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    // Also broadcast an event so components listening can update
    window.dispatchEvent(new CustomEvent('hsb_statutory_holiday_saved', {
      detail: { year: cleanYear, month: cleanMonth, entries }
    }));
  } catch {}
}

/**
 * Computes holiday value for an employee based on eligibility, worked status, and admin settings.
 * - If not eligible: 0
 * - If worked: Worked Rate (multiplier of day rate OR fixed amount)
 * - If not worked: Not Worked Rate (multiplier of day rate OR fixed amount)
 */
export function computeHolidayValue(
  dayValue: number,
  eligible: boolean,
  workedOnHoliday: boolean,
  settings: StatutoryHolidaySettings
): number {
  if (!eligible) return 0;

  const validDayValue = Number(dayValue) || 0;
  let result = 0;

  if (workedOnHoliday) {
    if (settings.workedRateType === 'multiplier') {
      result = validDayValue * (Number(settings.workedRateValue) || 0);
    } else {
      result = Number(settings.workedRateValue) || 0;
    }
  } else {
    if (settings.notWorkedRateType === 'multiplier') {
      result = validDayValue * (Number(settings.notWorkedRateValue) || 0);
    } else {
      result = Number(settings.notWorkedRateValue) || 0;
    }
  }

  return Math.round(result * 100) / 100;
}

/**
 * Auto-detects if an employee worked on any of the specified holiday dates
 * using the attendance rows already in the system.
 */
export function detectEmployeeWorkedOnHoliday(
  epfNo: string,
  holidayDates: string[],
  attendanceRows: any[]
): boolean {
  if (!epfNo || !holidayDates || holidayDates.length === 0 || !attendanceRows || attendanceRows.length === 0) {
    return false;
  }
  const cleanEpf = epfNo.trim().toLowerCase();
  const dateSet = new Set(holidayDates.map(d => d.trim()));

  return attendanceRows.some(row => {
    const rowEpf = (row.epfNo || '').trim().toLowerCase();
    if (rowEpf !== cleanEpf) return false;

    let day = (row.dayIn || '').trim();
    if (day.includes('T')) day = day.split('T')[0];

    if (!dateSet.has(day)) return false;

    // Check if employee actually worked on this holiday
    const workingDays = Number(row.workingDays || (row.halfDay === 1 ? 0.5 : 0));
    const hours = Number(row.totalWorkingHours || 0);
    const hasPunchTimes = Boolean(row.timeIn && row.timeOut);

    return workingDays > 0 || hours > 0 || hasPunchTimes;
  });
}
