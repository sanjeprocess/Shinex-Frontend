import { v4 as uuid } from 'uuid';

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

export const businessCenters: BusinessCenter[] = [
  { id: uuid(), code: '001', name: 'SHINEX FACILITY MANAGEMENT (PVT) LTD', address: 'No. 123 Facility Rd', tel: '011-2345678', email: 'facility@shinex.com', web: 'www.shinex-facility.com', epfReg: 'EPF123', vatReg: 'VAT123', brNo: 'BR001', fax: '011-2345679' },
  { id: uuid(), code: '002', name: 'SHINEX HOUSEKEEPING SERVICES (PVT) LTD', address: 'No. 9 Clean St', tel: '011-8765432', email: 'hk@shinex.com', web: 'www.shinex-hk.com', epfReg: 'EPF124', vatReg: 'VAT124', brNo: 'BR002', fax: '011-8765433' },
];

export const list = () => Promise.resolve([...businessCenters]);
export const getByCode = (code: string) => Promise.resolve(businessCenters.find(b => b.code === code));
export const create = (b: BusinessCenter) => { businessCenters.push(b); return Promise.resolve(b); }
export const update = (code: string, patch: Partial<BusinessCenter>) => { const idx = businessCenters.findIndex(x=>x.code===code); if (idx===-1) return Promise.resolve(null as any); businessCenters[idx] = {...businessCenters[idx], ...patch}; return Promise.resolve(businessCenters[idx]); }
export const remove = (code: string) => { const idx = businessCenters.findIndex(x=>x.code===code); if (idx>=0) businessCenters.splice(idx,1); return Promise.resolve(); }
