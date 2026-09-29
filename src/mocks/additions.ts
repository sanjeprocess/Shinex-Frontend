import api from '../api/axios';

export type AdditionType = {
  code: string;
  name: string;
  value: number;
  addToEpf?: boolean;
  addToBasic?: boolean;
  addOther?: boolean;
  businessCenter?: string;
};

const LOCAL_ADDITIONS_META_KEY = 'hsb_additions_meta';

function getLocalAdditionMeta(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_ADDITIONS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAdditionMeta(code: string, bc: string) {
  try {
    const current = getLocalAdditionMeta();
    current[code.trim()] = bc;
    localStorage.setItem(LOCAL_ADDITIONS_META_KEY, JSON.stringify(current));
  } catch {}
}

export const list = async (businessCenter?: string): Promise<AdditionType[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const localMeta = getLocalAdditionMeta();

  try {
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/addition-types', { params });
    if (res.data && Array.isArray(res.data)) {
      const mapped = res.data.map((a: any) => {
        const code = (a.additionCode || a.code || '').trim();
        const bc = (a.businessCenter || localMeta[code] || '').trim();
        return {
          code,
          name: (a.additionName || a.name || '').trim(),
          value: a.additionValue || a.value || 0,
          addToEpf: a.addToEpf === 'Y' || a.addToEpf === true,
          addToBasic: a.addToBasic === 'Y' || a.addToBasic === true,
          addOther: a.addOther === 'Y' || a.addOther === true,
          businessCenter: bc
        };
      });

      if (cleanBc && cleanBc !== 'ALL') {
        return mapped.filter(a => {
          const aBc = (a.businessCenter || '').trim().toUpperCase();
          if (!aBc) return true;
          return aBc === cleanBc || aBc.startsWith(cleanBc) || cleanBc.startsWith(aBc);
        });
      }
      return mapped;
    }
  } catch (err) {
    console.error('Failed to load additions from API', err);
  }
  return [];
};

export const create = async (r: AdditionType): Promise<AdditionType> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = r.businessCenter || cleanBc;

  saveLocalAdditionMeta(r.code, bc);

  const payload = {
    additionCode: r.code,
    additionName: r.name,
    additionValue: r.value,
    addToEpf: r.addToEpf ? 'Y' : 'N',
    addToBasic: r.addToBasic ? 'Y' : 'N',
    addOther: r.addOther ? 'Y' : 'N',
    businessCenter: bc
  };
  try {
    await api.post('/addition-types', payload);
  } catch (err) {
    console.warn('API create addition fallback', err);
  }
  return { ...r, businessCenter: bc };
};

export const update = async (code: string, patch: Partial<AdditionType>): Promise<AdditionType> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = patch.businessCenter || cleanBc;

  saveLocalAdditionMeta(code, bc);

  const payload = {
    additionCode: code,
    additionName: patch.name,
    additionValue: patch.value,
    addToEpf: patch.addToEpf ? 'Y' : 'N',
    addToBasic: patch.addToBasic ? 'Y' : 'N',
    addOther: patch.addOther ? 'Y' : 'N',
    businessCenter: bc
  };
  try {
    await api.put('/addition-types/' + encodeURIComponent(code), payload);
  } catch (err) {
    console.warn('API update addition fallback', err);
  }
  return { code, ...patch, businessCenter: bc } as AdditionType;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  try {
    const current = getLocalAdditionMeta();
    delete current[cleanCode];
    localStorage.setItem(LOCAL_ADDITIONS_META_KEY, JSON.stringify(current));
  } catch {}

  try {
    await api.delete('/addition-types/' + encodeURIComponent(cleanCode));
  } catch (err) {
    console.warn('API delete addition fallback', err);
  }
};
