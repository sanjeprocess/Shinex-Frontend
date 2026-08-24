export type TransactionAddition = {
  epfNo: string;
  addCode: string;
  businessCenter: string;
  addAmount: number;
  everyMonth: string | boolean | null;
  addMonth: number;
  addYear: string;
};

const transactionAdditions: TransactionAddition[] = [
  {
    epfNo: 'EPF00001',
    addCode: 'A01',
    businessCenter: '001',
    addAmount: 2000,
    everyMonth: 'Y',
    addMonth: 7,
    addYear: '2026'
  },
  {
    epfNo: 'EPF00002',
    addCode: 'A02',
    businessCenter: '001',
    addAmount: 1500,
    everyMonth: 'N',
    addMonth: 8,
    addYear: '2026'
  },
  {
    epfNo: 'EPF00003',
    addCode: 'A01',
    businessCenter: '002',
    addAmount: 2500,
    everyMonth: 'Y',
    addMonth: 8,
    addYear: '2026'
  },
  {
    epfNo: 'EPF00005',
    addCode: 'A03',
    businessCenter: '002',
    addAmount: 800,
    everyMonth: 'N',
    addMonth: 9,
    addYear: '2026'
  }
];

const matches = (row: TransactionAddition, epfNo: string, addCode: string, addMonth: number, addYear: string) => {
  return row.epfNo === epfNo && row.addCode === addCode && row.addMonth === addMonth && row.addYear === addYear;
};

export const list = () => Promise.resolve([...transactionAdditions]);

export const create = (record: TransactionAddition) => {
  transactionAdditions.push(record);
  return Promise.resolve(record);
};

export const update = (epfNo: string, addCode: string, addMonth: number, addYear: string, patch: Partial<TransactionAddition>) => {
  const index = transactionAdditions.findIndex(row => matches(row, epfNo, addCode, addMonth, addYear));
  if (index === -1) return Promise.resolve(null as any);
  transactionAdditions[index] = { ...transactionAdditions[index], ...patch };
  return Promise.resolve(transactionAdditions[index]);
};

export const remove = (epfNo: string, addCode: string, addMonth: number, addYear: string) => {
  const index = transactionAdditions.findIndex(row => matches(row, epfNo, addCode, addMonth, addYear));
  if (index >= 0) transactionAdditions.splice(index, 1);
  return Promise.resolve();
};
