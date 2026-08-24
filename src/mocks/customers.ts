import { v4 as uuid } from 'uuid'
export type Customer = { id: string; code: string; name: string; address1?: string; address2?: string; address3?: string; contactName?: string; contactNo?: string; email?: string; workingDays?: number; otAuto?: boolean; minStaffQty?: number; attendanceAllowance?: number; daysToWorkForAllowance?: number }
export const customers: Customer[] = [
  { id: uuid(), code: '130013', name: 'Green Park Office Complex', address1: 'No.1 Green Ave', contactName: 'Mr. Silva', contactNo: '011-2345678', email: 'contact@greenpark.com', workingDays: 26, otAuto: true, minStaffQty: 5, attendanceAllowance: 500, daysToWorkForAllowance: 20 },
  { id: uuid(), code: '130014', name: 'City Hospital', address1: 'Main Street', contactName: 'Ms. Perera', contactNo: '011-8765432', email: 'hr@cityhospital.com', workingDays: 26, otAuto: false, minStaffQty: 3, attendanceAllowance: 300, daysToWorkForAllowance: 20 },
  { id: uuid(), code: '130015', name: 'Blue Factory', address1: 'Industrial Zone', contactName: 'Mr. Kumar', contactNo: '011-5566778', email: 'admin@bluefactory.com', workingDays: 26, otAuto: true, minStaffQty: 8, attendanceAllowance: 800, daysToWorkForAllowance: 20 },
]
export const list = () => Promise.resolve([...customers])
export const create = (r: Customer) => { customers.push(r); return Promise.resolve(r) }
export const update = (code: string, patch: Partial<Customer>) => { const idx = customers.findIndex(a=>a.code===code); if (idx===-1) return Promise.resolve(null as any); customers[idx] = {...customers[idx], ...patch}; return Promise.resolve(customers[idx]); }
export const remove = (code: string) => { const idx = customers.findIndex(a=>a.code===code); if (idx>=0) customers.splice(idx,1); return Promise.resolve(); }
