import * as mock from '../mocks/employees';
import { Employee } from '../types/employee';

// TODO: swap these implementations for axios calls to /api/employees when backend is ready
export const list = (params?: { page?: number; size?: number; search?: string }) => {
  // naive pagination on mock
  return mock.list();
};

export const getById = (epf: string) => mock.getById(epf);
export const create = (e: Employee) => mock.create(e);
export const update = (epf: string, e: Partial<Employee>) => mock.update(epf, e);
export const remove = (epf: string) => mock.remove(epf);

export const upload = (file: File) => {
  // fake upload with progress and summary
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ totalRows: 10, inserted: 2, updated: 8, failed: 0, errors: [] });
    }, 1200);
  });
};
