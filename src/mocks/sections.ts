import api from '../api/axios';

export type Section = { code: string; name: string; businessCenter?: string };

export const sections: Section[] = [];

const LOCAL_SECTIONS_META_KEY = 'hsb_sections_meta';

function getLocalSectionMeta(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_SECTIONS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSectionMeta(code: string, bc: string) {
  try {
    const current = getLocalSectionMeta();
    current[code.trim()] = bc;
    localStorage.setItem(LOCAL_SECTIONS_META_KEY, JSON.stringify(current));
  } catch {}
}

export const list = async (businessCenter?: string): Promise<Section[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const localMeta = getLocalSectionMeta();

  try {
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/sections', { params });
    if (res.data && Array.isArray(res.data)) {
      const mapped = res.data.map((s: any) => {
        const code = (s.sectionCode || s.code || '').trim();
        const bc = (s.businessCenter || localMeta[code] || '').trim();
        return {
          code,
          name: (s.sectionName || s.name || '').trim(),
          businessCenter: bc
        };
      });

      if (cleanBc && cleanBc !== 'ALL') {
        return mapped.filter(s => {
          const sBc = (s.businessCenter || '').trim().toUpperCase();
          if (!sBc) return true; // Unassigned sections available
          return sBc === cleanBc || sBc.startsWith(cleanBc) || cleanBc.startsWith(sBc);
        });
      }
      return mapped;
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
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = s.businessCenter || cleanBc;

  saveLocalSectionMeta(s.code, bc);

  const payload = { sectionCode: s.code, sectionName: s.name, businessCenter: bc };
  try {
    await api.post('/sections', payload);
  } catch (err) {
    console.warn('API create section fallback', err);
  }
  return { ...s, businessCenter: bc };
};

export const update = async (code: string, patch: Partial<Section>): Promise<Section> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = patch.businessCenter || cleanBc;

  saveLocalSectionMeta(code, bc);

  const payload = { sectionCode: code, sectionName: patch.name, businessCenter: bc };
  try {
    await api.put(`/sections/${encodeURIComponent(code)}`, payload);
  } catch (err) {
    console.warn('API update section fallback', err);
  }
  return { code, ...patch, businessCenter: bc } as Section;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  try {
    const current = getLocalSectionMeta();
    delete current[cleanCode];
    localStorage.setItem(LOCAL_SECTIONS_META_KEY, JSON.stringify(current));
  } catch {}

  try {
    await api.delete(`/sections/${encodeURIComponent(cleanCode)}`);
  } catch (err) {
    console.warn('API delete section fallback', err);
  }
};
