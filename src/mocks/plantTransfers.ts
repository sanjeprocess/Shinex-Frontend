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

export const list = async (businessCenter?: string): Promise<PlantTransfer[]> => {
  const activeBc = businessCenter || localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';
  const response = await api.get('/plant-transfers', {
    params: cleanBc && cleanBc !== 'ALL' ? { businessCenter: cleanBc } : {}
  });
  if (!Array.isArray(response.data)) {
    throw new Error('Plant transfer endpoint returned an invalid response.');
  }
  return response.data;
};

export const create = async (transfer: Omit<PlantTransfer, 'id'> & { id?: string }): Promise<PlantTransfer> => {
  const activeBc = localStorage.getItem('hsb_active_bc') || '';
  const cleanBc = activeBc.split(' / ')[0].trim();
  const response = await api.post('/plant-transfers', {
    ...transfer,
    id: transfer.id || uuid(),
    businessCenter: transfer.businessCenter || cleanBc,
    createdAt: new Date().toISOString()
  });
  return response.data;
};

export const update = async (id: string, patch: Partial<PlantTransfer>): Promise<PlantTransfer> => {
  const response = await api.put(`/plant-transfers/${encodeURIComponent(id)}`, patch);
  return response.data;
};

export const remove = async (id: string): Promise<void> => {
  await api.delete(`/plant-transfers/${encodeURIComponent(id)}`);
};
