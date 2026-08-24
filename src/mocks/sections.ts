export type Section = { code: string; name: string };
export const sections: Section[] = [
  { code: '001', name: 'Janitor' },
  { code: '002', name: 'Supervisor' },
  { code: '003', name: 'Area Manager' },
  { code: '004', name: 'Head Office' },
];
export const list = () => Promise.resolve([...sections]);
export const getByCode = (c: string) => Promise.resolve(sections.find(s => s.code === c));
export const create = (s: Section) => { sections.push(s); return Promise.resolve(s); }
export const update = (code: string, patch: Partial<Section>) => { const idx = sections.findIndex(x=>x.code===code); if (idx===-1) return Promise.resolve(null as any); sections[idx] = {...sections[idx], ...patch}; return Promise.resolve(sections[idx]); }
export const remove = (code: string) => { const idx = sections.findIndex(x=>x.code===code); if (idx>=0) sections.splice(idx,1); return Promise.resolve(); }
