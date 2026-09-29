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
};

export const customers: Customer[] = [];

const LOCAL_PLANTS_META_KEY = 'hsb_plants_meta';

function getLocalMeta(): Record<string, { profitCenter?: string; businessCenter?: string; documentUrl?: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_PLANTS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalMeta(code: string, data: { profitCenter?: string; businessCenter?: string; documentUrl?: string }) {
  try {
    const current = getLocalMeta();
    current[code.trim()] = { ...current[code.trim()], ...data };
    localStorage.setItem(LOCAL_PLANTS_META_KEY, JSON.stringify(current));
  } catch {}
}

export const list = async (businessCenter?: string): Promise<Customer[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const localMeta = getLocalMeta();

  try {
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/customers', { params });
    if (res.data && Array.isArray(res.data)) {
      const mapped = res.data.map((c: any) => {
        const code = (c.code || c.custCode || '').trim();
        const meta = localMeta[code] || {};
        return {
          id: code,
          code: code,
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
          businessCenter: (c.businessCenter || meta.businessCenter || '').trim(),
          profitCenter: (c.profitCenter || meta.profitCenter || '').trim(),
          documentUrl: (c.docPath || c.documentUrl || meta.documentUrl || '').trim()
        };
      });

      if (cleanBc && cleanBc !== 'ALL') {
        return mapped.filter(p => {
          const pBc = (p.businessCenter || '').trim().toUpperCase();
          if (!pBc) return true;
          return pBc === cleanBc || pBc.startsWith(cleanBc) || cleanBc.startsWith(pBc);
        });
      }
      return mapped;
    }
  } catch (err) {
    console.error('Failed to load customers from API', err);
  }
  return [];
};

export const create = async (r: Customer): Promise<Customer> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const code = (r.code || '').trim();

  saveLocalMeta(code, {
    profitCenter: r.profitCenter,
    businessCenter: r.businessCenter || cleanBc,
    documentUrl: r.documentUrl
  });

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
    businessCenter: r.businessCenter || cleanBc || null,
    profitCenter: r.profitCenter || null,
    docPath: r.documentUrl && r.documentUrl.length < 500 ? r.documentUrl : null
  };

  try {
    await api.post('/customers', payload);
  } catch (err) {
    console.warn('API create plant fallback to local store', err);
  }
  return r;
};

export const update = async (code: string, patch: Partial<Customer>): Promise<Customer> => {
  const cleanCode = code.trim();
  saveLocalMeta(cleanCode, {
    profitCenter: patch.profitCenter,
    businessCenter: patch.businessCenter,
    documentUrl: patch.documentUrl
  });

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
    docPath: patch.documentUrl && patch.documentUrl.length < 500 ? patch.documentUrl : null
  };

  try {
    await api.put(`/customers/${encodeURIComponent(cleanCode)}`, payload);
  } catch (err) {
    console.warn('API update plant fallback to local store', err);
  }
  return { code: cleanCode, ...patch } as Customer;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  try {
    const current = getLocalMeta();
    delete current[cleanCode];
    localStorage.setItem(LOCAL_PLANTS_META_KEY, JSON.stringify(current));
  } catch {}

  try {
    await api.delete(`/customers/${encodeURIComponent(cleanCode)}`);
  } catch {}
};
