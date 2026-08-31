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
  const payload = {
    code: b.code,
    companyId: b.code,
    name: b.name,
    companyName: b.name,
    address: b.address,
    companyAddress: b.address,
    tel: b.tel,
    telNo: b.tel,
    email: b.email,
    emailId: b.email,
    web: b.web,
    webAddress: b.web,
    epfReg: b.epfReg,
    vatReg: b.vatReg,
    brNo: b.brNo,
    fax: b.fax,
    faxNo: b.fax
  };
  await api.post('/business-centers', payload);
  return b;
};

export const update = async (code: string, patch: Partial<BusinessCenter>): Promise<BusinessCenter> => {
  const payload = {
    code: code,
    companyId: code,
    name: patch.name,
    companyName: patch.name,
    address: patch.address,
    companyAddress: patch.address,
    tel: patch.tel,
    telNo: patch.tel,
    email: patch.email,
    emailId: patch.email,
    web: patch.web,
    webAddress: patch.web,
    epfReg: patch.epfReg,
    vatReg: patch.vatReg,
    brNo: patch.brNo,
    fax: patch.fax,
    faxNo: patch.fax
  };
  await api.put(`/business-centers/${code}`, payload);
  return { code, ...patch } as BusinessCenter;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/business-centers/${code}`);
};
