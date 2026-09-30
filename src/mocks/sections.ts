import api from '../api/axios';

export type Section = { 
  code: string; 
  name: string; 
  businessCenter?: string;
  basicSalary?: number;
};

export const sections: Section[] = [];

const LOCAL_SECTIONS_META_KEY = 'hsb_sections_meta';

type SectionMeta = { bc?: string; basicSalary?: number };

function getLocalSectionMeta(): Record<string, SectionMeta> {
  try {
    const raw = localStorage.getItem(LOCAL_SECTIONS_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const result: Record<string, SectionMeta> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') {
        result[k] = { bc: v };
      } else if (v && typeof v === 'object') {
        result[k] = v as SectionMeta;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveLocalSectionMeta(code: string, bc: string, basicSalary?: number) {
  try {
    const current = getLocalSectionMeta();
    current[code.trim()] = { bc, basicSalary: basicSalary != null ? Number(basicSalary) : 0 };
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
        const meta = localMeta[code] || {};
        const bc = (s.businessCenter || meta.bc || '').trim();
        const basicSalary = s.basicSalary != null && s.basicSalary !== '' 
          ? Number(s.basicSalary) 
          : (meta.basicSalary != null ? Number(meta.basicSalary) : 0);
        return {
          code,
          name: (s.sectionName || s.name || '').trim(),
          businessCenter: bc,
          basicSalary: basicSalary
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

export const getNextSectionCode = async (businessCenter?: string): Promise<string> => {
  try {
    const res = await api.get('/sections/next-code', { params: { businessCenter } });
    if (res.data && typeof res.data === 'string' && res.data.trim()) {
      return res.data.trim();
    }
  } catch (err) {
    console.warn('API get next section code fallback', err);
  }

  // Fallback calculation from client-side list
  const currentSections = await list();
  let maxNum = 0;
  for (const s of currentSections) {
    if (s.code) {
      const digits = s.code.replace(/\D/g, '');
      if (digits) {
        const n = parseInt(digits, 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }
  return String(maxNum + 1).padStart(3, '0');
};

export const create = async (s: Section): Promise<Section> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = s.businessCenter || cleanBc;
  const basicSalary = s.basicSalary != null ? Number(s.basicSalary) : 0;

  const payload = { 
    sectionCode: s.code, 
    sectionName: s.name, 
    businessCenter: bc,
    basicSalary: basicSalary
  };
  await api.post('/sections', payload);
  saveLocalSectionMeta(s.code, bc, basicSalary);
  return { ...s, businessCenter: bc, basicSalary };
};

export const update = async (code: string, patch: Partial<Section>): Promise<Section> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = patch.businessCenter || cleanBc;
  const basicSalary = patch.basicSalary != null ? Number(patch.basicSalary) : undefined;

  const payload = { 
    sectionCode: code, 
    sectionName: patch.name, 
    businessCenter: bc,
    ...(basicSalary != null ? { basicSalary } : {})
  };
  await api.put(`/sections/${encodeURIComponent(code)}`, payload);
  saveLocalSectionMeta(code, bc, basicSalary);
  return { code, ...patch, businessCenter: bc, ...(basicSalary != null ? { basicSalary } : {}) } as Section;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  try {
    const current = getLocalSectionMeta();
    delete current[cleanCode];
    localStorage.setItem(LOCAL_SECTIONS_META_KEY, JSON.stringify(current));
  } catch {}

  await api.delete(`/sections/${encodeURIComponent(cleanCode)}`);
};

