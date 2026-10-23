import api from '../api/axios';

export type Section = { 
  code: string; 
  name: string; 
  businessCenter?: string;
  basicSalary?: number;
};

export const sections: Section[] = [];

export const list = async (businessCenter?: string): Promise<Section[]> => {
  const activeBc = businessCenter || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
  const res = await api.get('/sections', { params });
  if (!Array.isArray(res.data)) {
    throw new Error('Section endpoint returned an invalid response.');
  }
  return res.data.map((s: any) => ({
    code: (s.sectionCode || s.code || '').trim(),
    name: (s.sectionName || s.name || '').trim(),
    businessCenter: (s.businessCenter || '').trim(),
    basicSalary: s.basicSalary == null || s.basicSalary === '' ? 0 : Number(s.basicSalary)
  })).filter((section: Section) => !cleanBc || cleanBc === 'ALL'
    || section.businessCenter?.trim().toUpperCase() === cleanBc);
};

export const getByCode = async (c: string): Promise<Section | undefined> => {
  const all = await list();
  return all.find(s => s.code === c);
};

export const getNextSectionCode = async (businessCenter?: string): Promise<string> => {
  const res = await api.get('/sections/next-code', { params: { businessCenter } });
  if (typeof res.data === 'string' && res.data.trim()) {
    return res.data.trim();
  }
  throw new Error('The server did not provide the next section code.');
};

export const create = async (s: Section): Promise<Section> => {
  const bc = s.businessCenter?.trim();
  if (!bc) throw new Error('A business center is required to create a section.');
  const basicSalary = s.basicSalary != null ? Number(s.basicSalary) : 0;

  const payload = { 
    sectionCode: s.code, 
    sectionName: s.name, 
    businessCenter: bc,
    basicSalary: basicSalary
  };
  await api.post('/sections', payload);
  return { ...s, businessCenter: bc, basicSalary };
};

export const update = async (code: string, patch: Partial<Section>): Promise<Section> => {
  const bc = patch.businessCenter?.trim();
  if (!bc) throw new Error('A business center is required to update a section.');
  const basicSalary = patch.basicSalary != null ? Number(patch.basicSalary) : undefined;

  const payload = { 
    sectionCode: code, 
    sectionName: patch.name, 
    businessCenter: bc,
    ...(basicSalary != null ? { basicSalary } : {})
  };
  await api.put(`/sections/${encodeURIComponent(code)}`, payload);
  return { code, ...patch, businessCenter: bc, ...(basicSalary != null ? { basicSalary } : {}) } as Section;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  await api.delete(`/sections/${encodeURIComponent(cleanCode)}`);
};
