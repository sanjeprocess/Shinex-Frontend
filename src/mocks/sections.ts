import api from '../api/axios';

export type Section = { code: string; name: string };

export const sections: Section[] = [];

export const list = async (): Promise<Section[]> => {
  try {
    const res = await api.get('/sections');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((s: any) => ({
        code: (s.sectionCode || s.code || '').trim(),
        name: (s.sectionName || s.name || '').trim()
      }));
    }
  } catch (err) {
    console.error('Failed to load sections from API', err);
  }
  return [];
};

export const getByCode = async (c: string): Promise<Section | undefined> => {
  const all = await list();
  return all.find(s => s.code === c);
};

export const create = async (s: Section): Promise<Section> => {
  const payload = { sectionCode: s.code, sectionName: s.name };
  await api.post('/sections', payload);
  return s;
};

export const update = async (code: string, patch: Partial<Section>): Promise<Section> => {
  const payload = { sectionCode: code, sectionName: patch.name };
  await api.put(`/sections/${code}`, payload);
  return { code, ...patch } as Section;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/sections/${encodeURIComponent(code)}`);
};
