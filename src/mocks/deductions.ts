export type DeductionType = { code: string; name: string; amount: number; isLoan?: boolean; isUniform?: boolean; addOther?: boolean };
export const deductions: DeductionType[] = [
  { code: 'D01', name: 'Uniform Deduction', amount: 300, isLoan: false, isUniform: true, addOther: false },
  { code: 'D02', name: 'Loan Repayment', amount: 2000, isLoan: true, isUniform: false, addOther: false },
];
export const list = () => Promise.resolve([...deductions]);
export const create = (r: DeductionType) => { deductions.push(r); return Promise.resolve(r) }
export const update = (code: string, patch: Partial<DeductionType>) => { const idx = deductions.findIndex(a=>a.code===code); if (idx===-1) return Promise.resolve(null as any); deductions[idx] = {...deductions[idx], ...patch}; return Promise.resolve(deductions[idx]); }
export const remove = (code: string) => { const idx = deductions.findIndex(a=>a.code===code); if (idx>=0) deductions.splice(idx,1); return Promise.resolve(); }
