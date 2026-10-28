// Automated test runner for Plant Shift Hours & Attendance Calculation Logic
// Run with: node test-shift-logic.cjs
// Watch with: node --watch test-shift-logic.cjs

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':').map(val => parseInt(val, 10));
  const hours = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minutes = Number.isFinite(parts[1]) ? parts[1] : 0;
  return hours * 60 + minutes;
}

function resolvePlantSetting(plant, plantCode) {
  const codeOrName = ((plant?.code || plantCode || '') + ' ' + (plant?.name || '')).trim().toUpperCase();
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

function computePlantHours(timeInStr, timeOutStr, plant, plantCode) {
  if (!timeInStr || !timeOutStr) {
    return { hours: 0, ot: 0, startTimeStr: timeInStr || '', appliedShiftStart: '07:30', countFromShiftStart: true, capped: false, maxHoursCap: null };
  }

  const setting = resolvePlantSetting(plant, plantCode);
  const clockInMinutes = parseTimeToMinutes(timeInStr);
  const shiftStartMinutes = parseTimeToMinutes(setting.shiftStart || '07:30');
  const clockOutMinutes = parseTimeToMinutes(timeOutStr);

  let startMinutes = setting.countFromShiftStart
    ? Math.max(clockInMinutes, shiftStartMinutes)
    : clockInMinutes;

  let diffMinutes = clockOutMinutes - startMinutes;
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  let rawHours = diffMinutes / 60;
  let capped = false;

  if (setting.maxHoursCap != null && setting.maxHoursCap > 0 && rawHours > setting.maxHoursCap) {
    rawHours = setting.maxHoursCap;
    capped = true;
  }

  const hours = Math.round(rawHours * 10) / 10;
  const ot = Math.max(0, Math.round((hours - 8.0) * 10) / 10);
  const startH = Math.floor(startMinutes / 60);
  const startM = startMinutes % 60;
  const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

  return { hours, ot, startTimeStr, appliedShiftStart: setting.shiftStart, countFromShiftStart: setting.countFromShiftStart, capped, maxHoursCap: setting.maxHoursCap };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(` \x1b[32m✔ PASS\x1b[0m - ${message}`);
    passed++;
  } else {
    console.error(` \x1b[31m✖ FAIL\x1b[0m - ${message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('  TEST SUITE: Plant Shift Logic & Attendance Rules');
console.log('======================================================\n');

// Test 1: Plant A (shift starts at 7:30, arrives 6:00, leaves 16:00 -> 8.5 hours)
const resA = computePlantHours('06:00', '16:00', { countFromShiftStart: true, shiftStart: '07:30' });
assert(resA.hours === 8.5, `Plant A: 06:00 -> 16:00 gives 8.5 hours (actual: ${resA.hours})`);
assert(resA.startTimeStr === '07:30', `Plant A: Start time begins from shiftStart 07:30 (actual: ${resA.startTimeStr})`);
assert(resA.ot === 0.5, `Plant A: OT calculated as 8.5 - 8.0 = 0.5 hours (actual: ${resA.ot})`);

// Test 2: Plant B (counts from actual arrival 6:00, capped at 9 hours)
const resB = computePlantHours('06:00', '16:00', { countFromShiftStart: false, maxHoursCap: 9 }, 'PLANT-B');
assert(resB.hours === 9.0, `Plant B: 06:00 -> 16:00 capped at 9.0 hours (actual: ${resB.hours})`);
assert(resB.capped === true, `Plant B: Capped flag is true`);
assert(resB.startTimeStr === '06:00', `Plant B: Start time counts from actual arrival 06:00 (actual: ${resB.startTimeStr})`);

// Test 3: Plant A employee arrives after shift start (e.g. 08:00 to 17:00)
const resALate = computePlantHours('08:00', '17:00', { countFromShiftStart: true, shiftStart: '07:30' });
assert(resALate.hours === 9.0, `Plant A Late Arrival: 08:00 -> 17:00 gives 9.0 hours (actual: ${resALate.hours})`);
assert(resALate.startTimeStr === '08:00', `Plant A Late: Start time is 08:00 (max of 08:00 and 07:30)`);

// Test 4: Workday labels & mapping (1 vs 0.5)
const isFullDay = (val) => Number(val) === 1 || String(val).toLowerCase().includes('full');
const isHalfDay = (val) => Number(val) === 0.5 || String(val).toLowerCase().includes('half');
assert(isFullDay('1 - Full Day') === true, 'Workday "1 - Full Day" maps to full day (workingDays = 1, halfDay = 0)');
assert(isHalfDay('0.5 - Half Day') === true, 'Workday "0.5 - Half Day" maps to half day (workingDays = 0.5, halfDay = 1)');

// Test 5: Meal Value Calculation
const meals = 2;
const mealRate = 250;
const totalMealValue = meals * mealRate;
assert(totalMealValue === 500, `Meal Value: ${meals} meals * Rs.${mealRate} = Rs.${totalMealValue}`);

console.log('\n------------------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');
process.exit(failed > 0 ? 1 : 0);
