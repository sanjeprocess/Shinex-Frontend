import api from '../api/axios';
import { v4 as uuid } from 'uuid';

export type PlantTransfer = {
  id: string;
  epfNo: string;
  employeeName: string;
  fromPlant: string;
  toPlant: string;
  transferDate: string;
  endDate?: string;
  daysWorked: number;
  profitCenter?: string;
  transferType: 'Temporary Support' | 'Permanent Transfer' | 'Special Project';
  status: 'Active' | 'Completed';
  workDetails: string;
  businessCenter: string;
  createdAt?: string;
};

const STORAGE_KEY = 'hsb_plant_transfers';

const initialMockTransfers: PlantTransfer[] = [
  {
    id: 'tr-001',
    epfNo: '91EPF001',
    employeeName: 'Kasun Bandara',
    fromPlant: 'PL001 (Plant A)',
    toPlant: 'PL002 (Plant B)',
    transferDate: new Date().toISOString().slice(0, 10),
    daysWorked: 5,
    profitCenter: 'PC-WEST-OPS',
    transferType: 'Temporary Support',
    status: 'Active',
    workDetails: 'Assigned to assist with high-volume quality inspection and machine calibration.',
    businessCenter: '001'
  },
  {
    id: 'tr-002',
    epfNo: '91EPF002',
    employeeName: 'Nimal Perera',
    fromPlant: 'PL001 (Plant A)',
    toPlant: 'PL003 (Plant C)',
    transferDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    daysWorked: 5,
    profitCenter: 'PC-EAST-MFG',
    transferType: 'Temporary Support',
    status: 'Completed',
    workDetails: 'Completed 5-day scheduled maintenance support on production line 2.',
    businessCenter: '001'
  }
];

function getStoredTransfers(): PlantTransfer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMockTransfers));
      return initialMockTransfers;
    }
    return JSON.parse(raw);
  } catch {
    return initialMockTransfers;
  }
}

function saveTransfers(items: PlantTransfer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to persist plant transfers to localStorage', err);
  }
}

export const list = async (businessCenter?: string): Promise<PlantTransfer[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim().toUpperCase() : '';

  try {
    const res = await api.get('/plant-transfers', {
      params: cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {}
    });
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    // Fall back to local store
  }

  const all = getStoredTransfers();
  if (!cleanBc || cleanBc === 'ALL') {
    return all;
  }

  return all.filter(t => {
    const tBc = (t.businessCenter || '').trim().toUpperCase();
    return !tBc || tBc === cleanBc || tBc.startsWith(cleanBc) || cleanBc.startsWith(tBc);
  });
};

export const create = async (t: Omit<PlantTransfer, 'id'> & { id?: string }): Promise<PlantTransfer> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '001';
  const cleanBc = activeBc.split(' / ')[0].trim();

  const record: PlantTransfer = {
    ...t,
    id: t.id || uuid(),
    businessCenter: t.businessCenter || cleanBc,
    createdAt: new Date().toISOString()
  };

  try {
    await api.post('/plant-transfers', record);
  } catch {
    // Fallback store
  }

  const list = getStoredTransfers();
  list.unshift(record);
  saveTransfers(list);
  return record;
};

export const update = async (id: string, patch: Partial<PlantTransfer>): Promise<PlantTransfer> => {
  try {
    await api.put('/plant-transfers/' + encodeURIComponent(id), patch);
  } catch {}

  const list = getStoredTransfers();
  const index = list.findIndex(item => item.id === id);
  if (index >= 0) {
    list[index] = { ...list[index], ...patch };
    saveTransfers(list);
    return list[index];
  }
  throw new Error('Plant transfer record not found');
};

export const remove = async (id: string): Promise<void> => {
  try {
    await api.delete('/plant-transfers/' + encodeURIComponent(id));
  } catch {}

  const list = getStoredTransfers().filter(item => item.id !== id);
  saveTransfers(list);
};
