import { v4 as uuid } from 'uuid';

export type Attendance = {
  id: string; // client-side identifier (UUID)
  
  // Database Column Mapping:
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

const make = (
  year: string,
  month: string,
  epf: string,
  plant: string,
  dayIn: string,
  timeIn: string,
  timeOut: string,
  shift: 'Day' | '2nd' | 'Night' | 'Full Night',
  dayType: 'Normal' | 'SaturdayPoya' | 'Special',
  bc: string,
  basic: number = 35000,
  dayAllow: number = 100,
  nightAllow: number = 150
): Attendance => {
  const totalHours = 8.5;
  const ot = Math.random() > 0.6 ? 2.0 : 0.0;
  return {
    id: uuid(),
    atttYear: year,
    attMonth: month,
    epfNo: epf,
    plantCode: plant,
    workingDays: 26,
    otCalAuto: 'Y',
    noOfStaff: 6,
    attAllowance: 'Y',
    dasForAttAllowance: 22,
    poyaSaturdayNormal: 'N',
    basicSalary: basic,
    dayAllowance: dayAllow,
    nightAllowance: nightAllow,
    dayIn,
    timeIn,
    dayOut: `${dayIn}T${timeOut}`,
    timeOut,
    halfDay: 0,
    totalWorkingHours: totalHours,
    totalOt: ot,
    normalDay: dayType === 'Normal' ? 'Y' : 'N',
    saturdayPoya: dayType === 'SaturdayPoya' ? 'Y' : 'N',
    specialDay: dayType === 'Special' ? 'Y' : 'N',
    lateAllowNo: 'LATE001',
    dayShift: shift === 'Day' ? 'Y' : 'N',
    secondShift: shift === '2nd' ? 'Y' : 'N',
    nightShift: shift === 'Night' ? 'Y' : 'N',
    fullNight: shift === 'Full Night' ? 'Y' : 'N',
    noOfMeal: 1,
    totalMealValue: 120,
    statutoryHolidays: 0,
    sundayPoyaExtra: 0,
    businessCenter: bc
  };
};

export const attendance: Attendance[] = [
  // Sunil (EPF00001) - Plant 130013 - BC 001 - Day Shift
  make('2026', '08', 'EPF00001', '130013', '2026-08-01', '08:00', '17:00', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-02', '08:15', '17:05', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-03', '08:00', '17:00', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-04', '08:10', '17:10', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-05', '08:00', '17:00', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-08', '08:00', '17:00', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-09', '08:05', '17:15', 'Day', 'Normal', '001', 45000, 150, 0),
  make('2026', '08', 'EPF00001', '130013', '2026-08-10', '08:00', '17:00', 'Day', 'Normal', '001', 45000, 150, 0),

  // Kamal (EPF00002) - Plant 130014 - BC 001 - Day Shift
  make('2026', '08', 'EPF00002', '130014', '2026-08-01', '08:30', '17:30', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-02', '08:20', '17:00', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-03', '08:25', '17:10', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-04', '08:20', '17:00', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-05', '08:20', '17:20', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-08', '08:30', '17:30', 'Day', 'Normal', '001', 37000, 100, 0),
  make('2026', '08', 'EPF00002', '130014', '2026-08-09', '08:20', '17:00', 'Day', 'Normal', '001', 37000, 100, 0),

  // Nimal (EPF00003) - Plant 130015 - BC 002 - Night Shift
  make('2026', '08', 'EPF00003', '130015', '2026-08-01', '20:00', '05:00', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-02', '20:10', '05:10', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-03', '20:00', '05:00', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-04', '20:00', '05:00', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-05', '20:15', '05:05', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-08', '20:00', '05:00', 'Night', 'Normal', '002', 52000, 0, 200),
  make('2026', '08', 'EPF00003', '130015', '2026-08-09', '20:00', '05:00', 'Night', 'Normal', '002', 52000, 0, 200),

  // Ruwan (EPF00004) - Plant 130013 - BC 001 - Day Shift
  make('2026', '08', 'EPF00004', '130013', '2026-08-01', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-02', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-03', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-04', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-05', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-08', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
  make('2026', '08', 'EPF00004', '130013', '2026-08-09', '08:00', '17:00', 'Day', 'Normal', '001', 33000, 100, 0),
];

export const list = () => Promise.resolve([...attendance]);
export const listByEmployee = (epf: string) => Promise.resolve(attendance.filter(a => a.epfNo === epf));
export const create = (rec: Attendance) => { attendance.push(rec); return Promise.resolve(rec); };
export const update = (id: string, patch: Partial<Attendance>) => {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx === -1) return Promise.resolve(null as any);
  attendance[idx] = { ...attendance[idx], ...patch };
  return Promise.resolve(attendance[idx]);
};
export const remove = (id: string) => {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) attendance.splice(idx, 1);
  return Promise.resolve();
};
