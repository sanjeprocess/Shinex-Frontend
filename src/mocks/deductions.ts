import api from '../api/axios';

export type DeductionType = { code: string; name: string; amount: number; isLoan?: boolean; isUniform?: boolean; addOther?: boolean };

export const list = async (): Promise<DeductionType[]> => {
  try {
    const res = await api.get('/deduction-types');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((d: any) => ({
        code: (d.dudCode || d.code || '').trim(),
        name: (d.dudName || d.name || '').trim(),
        amount: d.dudAmount || d.amount || 0,
        isLoan: d.ifLoan === 'Y' || d.isLoan === true,
        isUniform: d.ifUniform === 'Y' || d.isUniform === true,
        addOther: d.other === 'Y' || d.addOther === true
      }));
    }
  } catch (err) {
    console.error('Failed to load deductions from API', err);
  }
  return [];
};

export const create = async (r: DeductionType): Promise<DeductionType> => {
  const payload = {
    dudCode: r.code,
    dudName: r.name,
    dudAmount: r.amount,
    ifLoan: r.isLoan ? 'Y' : 'N',
    ifUniform: r.isUniform ? 'Y' : 'N',
    other: r.addOther ? 'Y' : 'N'
  };
  await api.post('/deduction-types', payload);
  return r;
};

export const update = async (code: string, patch: Partial<DeductionType>): Promise<DeductionType> => {
  const payload = {
    dudCode: code,
    dudName: patch.name,
    dudAmount: patch.amount,
    ifLoan: patch.isLoan ? 'Y' : 'N',
    ifUniform: patch.isUniform ? 'Y' : 'N',
    other: patch.addOther ? 'Y' : 'N'
  };
  await api.put(`/deduction-types/${code}`, payload);
  return { code, ...patch } as DeductionType;
};

export const remove = async (code: string): Promise<void> => {
  await api.delete(`/deduction-types/${encodeURIComponent(code)}`);
};
