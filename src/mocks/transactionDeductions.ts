export type TransactionDeduction = {
  epfNo: string;
  didCode: string;
  businessCenter: string;
  didAmount: number;
  everyMonth: string | boolean | null;
  addMonth: string;
  addYear: string;
};

const transactionDeductions: TransactionDeduction[] = [
  {
    epfNo: 'EPF00001',
    didCode: 'D01',
    businessCenter: '001',
    didAmount: 2500,
    everyMonth: 'Y',
    addMonth: '07',
    addYear: '2026'
  },
  {
    epfNo: 'EPF00001',
    didCode: 'D02',
    businessCenter: '001',
    didAmount: 1500,
    everyMonth: 'N',
    addMonth: '07',
    addYear: '2026'
  },
  {
    epfNo: 'EPF00002',
    didCode: 'D01',
    businessCenter: '001',
    didAmount: 2200,
    everyMonth: 'Y',
    addMonth: '08',
    addYear: '2026'
  },
  {
    epfNo: 'EPF00003',
    didCode: 'D02',
    businessCenter: '002',
    didAmount: 1800,
    everyMonth: 'N',
    addMonth: '08',
    addYear: '2026'
  },
  {
    epfNo: 'EPF00004',
    didCode: 'D01',
    businessCenter: '001',
    didAmount: 3100,
    everyMonth: 'Y',
    addMonth: '09',
    addYear: '2026'
  }
];

const matches = (row: TransactionDeduction, epfNo: string, didCode: string, addMonth: string, addYear: string) => {
  return row.epfNo === epfNo && row.didCode === didCode && row.addMonth === addMonth && row.addYear === addYear;
};

export const list = () => Promise.resolve([...transactionDeductions]);

export const create = (record: TransactionDeduction) => {
  transactionDeductions.push(record);
  return Promise.resolve(record);
};

export const update = (epfNo: string, didCode: string, addMonth: string, addYear: string, patch: Partial<TransactionDeduction>) => {
  const index = transactionDeductions.findIndex(row => matches(row, epfNo, didCode, addMonth, addYear));
  if (index === -1) return Promise.resolve(null as any);
  transactionDeductions[index] = { ...transactionDeductions[index], ...patch };
  return Promise.resolve(transactionDeductions[index]);
};

export const remove = (epfNo: string, didCode: string, addMonth: string, addYear: string) => {
  const index = transactionDeductions.findIndex(row => matches(row, epfNo, didCode, addMonth, addYear));
  if (index >= 0) transactionDeductions.splice(index, 1);
  return Promise.resolve();
};
