import api from '../api/axios';

export type AdditionType = { code: string; name: string; value: number; addToEpf?: boolean; addToBasic?: boolean; addOther?: boolean };

export const list = async (): Promise<AdditionType[]> => {
  try {
    const res = await api.get('/addition-types');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((a: any) => ({
        code: (a.additionCode || a.code || '').trim(),
        name: (a.additionName || a.name || '').trim(),
        value: a.additionValue || a.value || 0,
        addToEpf: a.addToEpf === 'Y' || a.addToEpf === true,
        addToBasic: a.addToBasic === 'Y' || a.addToBasic === true,
        addOther: a.addOther === 'Y' || a.addOther === true
      }));
    }
  } catch (err) {
    console.error('Failed to load additions from API', err);
  }
  return [];
};

export const create = async (r: AdditionType): Promise<AdditionType> => {
  const payload = {
    additionCode: r.code,
    additionName: r.name,
    additionValue: r.value,
    addToEpf: r.addToEpf ? 'Y' : 'N',
    addToBasic: r.addToBasic ? 'Y' : 'N',
    addOther: r.addOther ? 'Y' : 'N'
  };
  await api.post('/addition-types', payload);
  return r;
};

export const update = async (code: string, patch: Partial<AdditionType>): Promise<AdditionType> => {
  const payload = {
    additionCode: code,
    additionName: patch.name,
    additionValue: patch.value,
    addToEpf: patch.addToEpf ? 'Y' : 'N',
    addToBasic: patch.addToBasic ? 'Y' : 'N',
    addOther: patch.addOther ? 'Y' : 'N'
  };
  await api.put(`/addition-types/${code}`, payload);
  return { code, ...patch } as AdditionType;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/addition-types/${encodeURIComponent(code)}`);
};
