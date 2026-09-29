import api from '../api/axios';

export type DeductionType = {
  code: string;
  name: string;
  amount: number;
  isLoan?: boolean;
  isUniform?: boolean;
  addOther?: boolean;
  businessCenter?: string;
};

const LOCAL_DEDUCTIONS_META_KEY = 'hsb_deductions_meta';

function getLocalDeductionMeta(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_DEDUCTIONS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalDeductionMeta(code: string, bc: string) {
  try {
    const current = getLocalDeductionMeta();
    current[code.trim()] = bc;
    localStorage.setItem(LOCAL_DEDUCTIONS_META_KEY, JSON.stringify(current));
  } catch {}
}

export const list = async (businessCenter?: string): Promise<DeductionType[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';
  const localMeta = getLocalDeductionMeta();

  try {
    const params = cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {};
    const res = await api.get('/deduction-types', { params });
    if (res.data && Array.isArray(res.data)) {
      const mapped = res.data.map((d: any) => {
        const code = (d.dudCode || d.code || '').trim();
        const bc = (d.businessCenter || localMeta[code] || '').trim();
        return {
          code,
          name: (d.dudName || d.name || '').trim(),
          amount: d.dudAmount || d.amount || 0,
          isLoan: d.ifLoan === 'Y' || d.isLoan === true,
          isUniform: d.ifUniform === 'Y' || d.isUniform === true,
          addOther: d.other === 'Y' || d.addOther === true,
          businessCenter: bc
        };
      });

      if (cleanBc && cleanBc !== 'ALL') {
        return mapped.filter(d => {
          const dBc = (d.businessCenter || '').trim().toUpperCase();
          if (!dBc) return true;
          return dBc === cleanBc || dBc.startsWith(cleanBc) || cleanBc.startsWith(dBc);
        });
      }
      return mapped;
    }
  } catch (err) {
    console.error('Failed to load deductions from API', err);
  }
  return [];
};

export const create = async (r: DeductionType): Promise<DeductionType> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = r.businessCenter || cleanBc;

  saveLocalDeductionMeta(r.code, bc);

  const payload = {
    dudCode: r.code,
    dudName: r.name,
    dudAmount: r.amount,
    ifLoan: r.isLoan ? 'Y' : 'N',
    ifUniform: r.isUniform ? 'Y' : 'N',
    other: r.addOther ? 'Y' : 'N',
    businessCenter: bc
  };
  try {
    await api.post('/deduction-types', payload);
  } catch (err) {
    console.warn('API create deduction fallback', err);
  }
  return { ...r, businessCenter: bc };
};

export const update = async (code: string, patch: Partial<DeductionType>): Promise<DeductionType> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const bc = patch.businessCenter || cleanBc;

  saveLocalDeductionMeta(code, bc);

  const payload = {
    dudCode: code,
    dudName: patch.name,
    dudAmount: patch.amount,
    ifLoan: patch.isLoan ? 'Y' : 'N',
    ifUniform: patch.isUniform ? 'Y' : 'N',
    other: patch.addOther ? 'Y' : 'N',
    businessCenter: bc
  };
  try {
    await api.put('/deduction-types/' + encodeURIComponent(code), payload);
  } catch (err) {
    console.warn('API update deduction fallback', err);
  }
  return { code, ...patch, businessCenter: bc } as DeductionType;
};

export const remove = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  try {
    const current = getLocalDeductionMeta();
    delete current[cleanCode];
    localStorage.setItem(LOCAL_DEDUCTIONS_META_KEY, JSON.stringify(current));
  } catch {}

  try {
    await api.delete('/deduction-types/' + encodeURIComponent(cleanCode));
  } catch (err) {
    console.warn('API delete deduction fallback', err);
  }
};
