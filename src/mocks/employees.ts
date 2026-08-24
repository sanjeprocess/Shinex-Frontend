import { Employee } from '../types/employee';

const make = (epf: string, fn: string, ln: string, plant: string, section: string, bc: string, salary: number): Employee => ({
  epfNo: epf,
  nicNo: '900000000V',
  firstName: fn,
  lastName: ln,
  plantCode: plant,
  sectionCode: section,
  dateOfBirth: '1990-01-01',
  hiredDate: '2020-06-15',
  hiredMonth: 'June',
  statusActive: true,
  basicSalary: salary,
  dayAllowance: 0,
  nightAllowance: 0,
  sundayPoyaExtra: 0,
  bankAccountNumber: '1234567890',
  bankName: 'Sample Bank',
  branchName: 'Main Branch',
  branchCode: '001',
  swift: 'SBINLKSL',
  businessCenter: bc,
  bCardYes: Math.random() > 0.5,
});

export const employees: Employee[] = [
  make('EPF00001', 'Sunil', 'Perera', '130013', '001', '001', 45000),
  make('EPF00002', 'Kamal', 'Fernando', '130014', '001', '001', 37000),
  make('EPF00003', 'Nimal', 'Silva', '130015', '002', '002', 52000),
  make('EPF00004', 'Ruwan', 'Kumar', '130016', '003', '001', 33000),
  make('EPF00005', 'Saman', 'Jayasuriya', '130017', '002', '002', 41000),
  make('EPF00006', 'Mala', 'Fernando', '130013', '004', '001', 60000),
  make('EPF00007', 'Asha', 'Perera', '130014', '004', '002', 58000),
  make('EPF00008', 'Ravi', 'Kumar', '130015', '003', '001', 29000),
  make('EPF00009', 'Chathura', 'De Silva', '130016', '001', '002', 36000),
  make('EPF00010', 'Nadeesha', 'Wickramasinghe', '130017', '002', '001', 47000),
];

export const list = () => Promise.resolve([...employees]);
export const getById = (epf: string) => Promise.resolve(employees.find(e => e.epfNo === epf));
export const create = (e: Employee) => { employees.push(e); return Promise.resolve(e); };
export const update = (epf: string, e: Partial<Employee>) => {
  const idx = employees.findIndex(x => x.epfNo === epf);
  if (idx === -1) return Promise.resolve(null as any);
  employees[idx] = { ...employees[idx], ...e };
  return Promise.resolve(employees[idx]);
};
export const remove = (epf: string) => { const idx = employees.findIndex(x => x.epfNo === epf); if (idx >= 0) employees.splice(idx,1); return Promise.resolve(); };
