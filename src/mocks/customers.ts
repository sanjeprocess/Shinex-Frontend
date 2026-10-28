import api from '../api/axios';

export type Customer = {
  id: string;
  code: string;
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  contactName?: string;
  contactNo?: string;
  email?: string;
  workingDays?: number;
  otAuto?: boolean;
  minStaffQty?: number;
  attendanceAllowance?: string | number;
  daysToWorkForAllowance?: number;
  businessCenter?: string;
  profitCenter?: string;
  documentUrl?: string;
  countFromShiftStart?: boolean;
  shiftStart?: string;
  maxHoursCap?: number | null;
  mealValue?: number;
};

export const customers: Customer[] = [];

export const list = async (businessCenter?: string): Promise<Customer[]> => {
  const activeBc = businessCenter || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const res = await api.get('/customers', { params });
  if (!Array.isArray(res.data)) {
    throw new Error('Customer endpoint returned an invalid response.');
  }
  const shiftSettingsCache = JSON.parse(localStorage.getItem('hsb_plant_shift_settings') || '{}');
  return res.data.map((c: any) => {
    const code = (c.code || c.custCode || '').trim();
    const cached = shiftSettingsCache[code] || {};
    return {
      id: code,
      code,
      name: (c.name || c.custName || '').trim(),
      address1: (c.address1 || '').trim(),
      address2: (c.address2 || '').trim(),
      address3: (c.address3 || '').trim(),
      contactName: (c.contactName || '').trim(),
      contactNo: (c.contactNo || '').trim(),
      email: (c.email || '').trim(),
      workingDays: c.workingDays == null ? undefined : Number(c.workingDays),
      otAuto: c.otCalculationAuto === 'Y' || c.otCalculationAuto === true || c.otAuto === true,
      minStaffQty: c.minStaffQty == null ? undefined : Number(c.minStaffQty),
      attendanceAllowance: c.attendanceAllowance ?? undefined,
      daysToWorkForAllowance: c.daysToWorkForAttAllowance == null ? undefined : Number(c.daysToWorkForAttAllowance),
      businessCenter: (c.businessCenter || '').trim(),
      profitCenter: (c.profitCenter || '').trim(),
      documentUrl: (c.docPath || c.documentUrl || '').trim(),
      countFromShiftStart: c.countFromShiftStart != null ? Boolean(c.countFromShiftStart) : (cached.countFromShiftStart != null ? cached.countFromShiftStart : undefined),
      shiftStart: c.shiftStart || cached.shiftStart || undefined,
      maxHoursCap: c.maxHoursCap != null ? Number(c.maxHoursCap) : (cached.maxHoursCap != null ? cached.maxHoursCap : undefined),
      mealValue: c.mealValue != null ? Number(c.mealValue) : (cached.mealValue != null ? cached.mealValue : 200)
    };
  }).filter((customer: Customer) => !cleanBc || cleanBc === 'ALL'
    || customer.businessCenter?.trim().toUpperCase() === cleanBc);
};

export const create = async (r: Customer): Promise<Customer> => {
  const code = (r.code || '').trim();

  const payload = {
    custCode: code,
    custName: r.name,
    address1: r.address1,
    address2: r.address2,
    address3: r.address3,
    contactName: r.contactName,
    contactNo: r.contactNo,
    email: r.email,
    workingDays: r.workingDays,
    otCalculationAuto: r.otAuto ? 'Y' : 'N',
    minStaffQty: r.minStaffQty,
    attendanceAllowance: r.attendanceAllowance === '' || r.attendanceAllowance == null ? null : String(r.attendanceAllowance),
    daysToWorkForAttAllowance: r.daysToWorkForAllowance ?? null,
    businessCenter: r.businessCenter || null,
    profitCenter: r.profitCenter || null,
    docPath: r.documentUrl && r.documentUrl.length < 500 ? r.documentUrl : null,
    countFromShiftStart: r.countFromShiftStart,
    shiftStart: r.shiftStart,
    maxHoursCap: r.maxHoursCap,
    mealValue: r.mealValue
  };

  try {
    const shiftSettingsCache = JSON.parse(localStorage.getItem('hsb_plant_shift_settings') || '{}');
    shiftSettingsCache[code] = {
      countFromShiftStart: r.countFromShiftStart,
      shiftStart: r.shiftStart,
      maxHoursCap: r.maxHoursCap,
      mealValue: r.mealValue
    };
    localStorage.setItem('hsb_plant_shift_settings', JSON.stringify(shiftSettingsCache));
  } catch {}

  await api.post('/customers', payload);
  return r;
};

export const update = async (code: string, patch: Partial<Customer>): Promise<Customer> => {
  const cleanCode = code.trim();

  const payload = {
    custCode: cleanCode,
    custName: patch.name,
    address1: patch.address1,
    address2: patch.address2,
    address3: patch.address3,
    contactName: patch.contactName,
    contactNo: patch.contactNo,
    email: patch.email,
    workingDays: patch.workingDays,
    otCalculationAuto: patch.otAuto ? 'Y' : 'N',
    minStaffQty: patch.minStaffQty,
    attendanceAllowance: patch.attendanceAllowance === '' || patch.attendanceAllowance == null ? null : String(patch.attendanceAllowance),
    daysToWorkForAttAllowance: patch.daysToWorkForAllowance ?? null,
    businessCenter: patch.businessCenter || null,
    profitCenter: patch.profitCenter || null,
    docPath: patch.documentUrl && patch.documentUrl.length < 500 ? patch.documentUrl : null,
    countFromShiftStart: patch.countFromShiftStart,
    shiftStart: patch.shiftStart,
    maxHoursCap: patch.maxHoursCap,
    mealValue: patch.mealValue
  };

  try {
    const shiftSettingsCache = JSON.parse(localStorage.getItem('hsb_plant_shift_settings') || '{}');
    shiftSettingsCache[cleanCode] = {
      ...(shiftSettingsCache[cleanCode] || {}),
      ...(patch.countFromShiftStart !== undefined ? { countFromShiftStart: patch.countFromShiftStart } : {}),
      ...(patch.shiftStart !== undefined ? { shiftStart: patch.shiftStart } : {}),
      ...(patch.maxHoursCap !== undefined ? { maxHoursCap: patch.maxHoursCap } : {}),
      ...(patch.mealValue !== undefined ? { mealValue: patch.mealValue } : {})
    };
    localStorage.setItem('hsb_plant_shift_settings', JSON.stringify(shiftSettingsCache));
  } catch {}

  await api.put(`/customers/${encodeURIComponent(cleanCode)}`, payload);
  return { code: cleanCode, ...patch } as Customer;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  await api.delete(`/customers/${encodeURIComponent(cleanCode)}`);
};
