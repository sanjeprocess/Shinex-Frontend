export type AdditionType = { code: string; name: string; value: number; addToEpf?: boolean; addToBasic?: boolean; addOther?: boolean };
export const additions: AdditionType[] = [
  { code: 'A01', name: 'Performance Allowance', value: 2000, addToEpf: false, addToBasic: false, addOther: false },
  { code: 'A02', name: 'Transport Allowance', value: 1500, addToEpf: false, addToBasic: false, addOther: false },
  { code: 'A03', name: 'Meal Allowance', value: 500, addToEpf: false, addToBasic: false, addOther: false },
];
export const list = () => Promise.resolve([...additions]);
export const create = (r: AdditionType) => { additions.push(r); return Promise.resolve(r) }
export const update = (code: string, patch: Partial<AdditionType>) => { const idx = additions.findIndex(a=>a.code===code); if (idx===-1) return Promise.resolve(null as any); additions[idx] = {...additions[idx], ...patch}; return Promise.resolve(additions[idx]); }
export const remove = (code: string) => { const idx = additions.findIndex(a=>a.code===code); if (idx>=0) additions.splice(idx,1); return Promise.resolve(); }
