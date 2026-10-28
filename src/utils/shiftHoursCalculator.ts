export interface PlantShiftSetting {
  countFromShiftStart?: boolean;
  shiftStart?: string; // e.g. "07:30"
  maxHoursCap?: number | null; // e.g. 9
  mealValue?: number | null;
  code?: string;
  name?: string;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  // Handle formats like "07:30", "07:30:00", "7:30"
  const parts = String(timeStr).split(':').map(val => parseInt(val, 10));
  const hours = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minutes = Number.isFinite(parts[1]) ? parts[1] : 0;
  return hours * 60 + minutes;
}

/**
 * Resolves shift timing rules for a plant.
 * - Plant A (or plants with countFromShiftStart = true): Shift starts at 07:30.
 *   If employee arrives before shift start (e.g. 06:00), hours start counting only from 07:30.
 * - Plant B (or plants with countFromShiftStart = false): Counts from actual arrival (e.g. 06:00).
 *   Capped at 9 hours (e.g. 06:00 to 15:00 max).
 */
export function resolvePlantSetting(plant?: any, plantCode?: string): PlantShiftSetting {
  const codeOrName = ((plant?.code || plantCode || '') + ' ' + (plant?.name || '')).trim().toUpperCase();
  
  // Plant B check: e.g. "Plant B", "B", "PLANT-B", or plants with explicitly false countFromShiftStart
  const isPlantB = codeOrName.includes('PLANT B') || codeOrName === 'B' || codeOrName.startsWith('B ') || codeOrName.endsWith(' B');

  const hasCountSetting = plant && typeof plant.countFromShiftStart === 'boolean';
  const hasShiftStart = plant && typeof plant.shiftStart === 'string' && plant.shiftStart.trim() !== '';
  const hasCap = plant && (typeof plant.maxHoursCap === 'number' || (plant.maxHoursCap != null && plant.maxHoursCap !== ''));

  return {
    countFromShiftStart: hasCountSetting ? plant.countFromShiftStart : (isPlantB ? false : true),
    shiftStart: hasShiftStart ? plant.shiftStart : '07:30',
    maxHoursCap: hasCap ? (Number(plant.maxHoursCap) || null) : (isPlantB ? 9 : null),
    mealValue: plant?.mealValue != null ? Number(plant.mealValue) : 200,
    code: plant?.code || plantCode,
    name: plant?.name
  };
}

export interface ShiftComputationResult {
  hours: number;
  ot: number;
  startTimeStr: string;
  appliedShiftStart: string;
  countFromShiftStart: boolean;
  capped: boolean;
  maxHoursCap: number | null;
}

export function computePlantHours(
  timeInStr: string,
  timeOutStr: string,
  plant?: any,
  plantCode?: string
): ShiftComputationResult {
  if (!timeInStr || !timeOutStr) {
    return {
      hours: 0,
      ot: 0,
      startTimeStr: timeInStr || '',
      appliedShiftStart: '07:30',
      countFromShiftStart: true,
      capped: false,
      maxHoursCap: null
    };
  }

  const setting = resolvePlantSetting(plant, plantCode);
  const clockInMinutes = parseTimeToMinutes(timeInStr);
  const shiftStartMinutes = parseTimeToMinutes(setting.shiftStart || '07:30');
  const clockOutMinutes = parseTimeToMinutes(timeOutStr);

  let startMinutes = clockInMinutes;
  if (setting.countFromShiftStart) {
    // If true: startTime = max(clockIn, shiftStart)
    startMinutes = Math.max(clockInMinutes, shiftStartMinutes);
  } else {
    // If false: startTime = clockIn
    startMinutes = clockInMinutes;
  }

  let diffMinutes = clockOutMinutes - startMinutes;
  if (diffMinutes < 0) {
    // Cross midnight
    diffMinutes += 24 * 60;
  }

  let rawHours = diffMinutes / 60;
  let capped = false;

  // For Plant B / capped plants, apply cap: hours = min(hours, 9)
  if (setting.maxHoursCap != null && setting.maxHoursCap > 0 && rawHours > setting.maxHoursCap) {
    rawHours = setting.maxHoursCap;
    capped = true;
  }

  const hours = Math.round(rawHours * 10) / 10;
  const ot = Math.max(0, Math.round((hours - 8.0) * 10) / 10);

  const startH = Math.floor(startMinutes / 60);
  const startM = startMinutes % 60;
  const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

  return {
    hours,
    ot,
    startTimeStr,
    appliedShiftStart: setting.shiftStart || '07:30',
    countFromShiftStart: !!setting.countFromShiftStart,
    capped,
    maxHoursCap: setting.maxHoursCap || null
  };
}
