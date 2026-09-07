import api from '../api/axios';

export type BusinessCenter = {
  id: string;
  code: string;
  name: string;
  address?: string;
  tel?: string;
  email?: string;
  web?: string;
  epfReg?: string;
  vatReg?: string;
  brNo?: string;
  fax?: string;
};

export const businessCenters: BusinessCenter[] = [];

export const list = async (): Promise<BusinessCenter[]> => {
  try {
    const res = await api.get('/business-centers');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((b: any) => ({
        id: (b.code || b.companyId || b.id || '').trim(),
        code: (b.code || b.companyId || '').trim(),
        name: (b.name || b.companyName || '').trim(),
        address: (b.address || b.companyAddress || '').trim(),
        tel: (b.tel || b.telNo || '').trim(),
        email: (b.email || b.emailId || '').trim(),
        web: (b.web || b.webAddress || '').trim(),
        epfReg: (b.epfReg || '').trim(),
        vatReg: (b.vatReg || '').trim(),
        brNo: (b.brNo || '').trim(),
        fax: (b.fax || b.faxNo || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load business centers from API', err);
  }
  return [];
};

export const getByCode = async (code: string): Promise<BusinessCenter | undefined> => {
  const all = await list();
  return all.find(b => b.code === code);
};

export const create = async (b: BusinessCenter): Promise<BusinessCenter> => {
  const code = b.code.trim().slice(0, 10);
  const payload = {
    code, companyId: code,
    name: b.name?.trim() || null, companyName: b.name?.trim() || null,
    address: b.address?.trim() || null, companyAddress: b.address?.trim() || null,
    tel: b.tel?.trim() || null, telNo: b.tel?.trim() || null,
    email: b.email?.trim() || null, emailId: b.email?.trim() || null,
    web: b.web?.trim() || null, webAddress: b.web?.trim() || null,
    epfReg: b.epfReg?.trim() || null, vatReg: b.vatReg?.trim() || null,
    brNo: b.brNo?.trim() || null, fax: b.fax?.trim() || null, faxNo: b.fax?.trim() || null
  };
  await api.post('/business-centers', payload);
  return b;
};

export const update = async (code: string, patch: Partial<BusinessCenter>): Promise<BusinessCenter> => {
  const normalizedCode = code.trim().slice(0, 10);
  const payload = {
    code: normalizedCode, companyId: normalizedCode,
    name: patch.name?.trim() || null, companyName: patch.name?.trim() || null,
    address: patch.address?.trim() || null, companyAddress: patch.address?.trim() || null,
    tel: patch.tel?.trim() || null, telNo: patch.tel?.trim() || null,
    email: patch.email?.trim() || null, emailId: patch.email?.trim() || null,
    web: patch.web?.trim() || null, webAddress: patch.web?.trim() || null,
    epfReg: patch.epfReg?.trim() || null, vatReg: patch.vatReg?.trim() || null,
    brNo: patch.brNo?.trim() || null, fax: patch.fax?.trim() || null, faxNo: patch.fax?.trim() || null
  };
  await api.put(`/business-centers/${encodeURIComponent(normalizedCode)}`, payload);
  return { code: normalizedCode, ...patch } as BusinessCenter;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/business-centers/${encodeURIComponent(code)}`);
};
