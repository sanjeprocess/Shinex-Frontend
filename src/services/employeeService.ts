import { Employee } from '../types/employee';
import * as employeeMocks from '../mocks/employees';
import { logAuditAction } from '../utils/auditLogger';

export const list = async (): Promise<Employee[]> => {
  return employeeMocks.list();
};

export const getById = async (epf: string): Promise<Employee | undefined> => {
  return employeeMocks.getById(epf);
};

export const create = async (e: Employee): Promise<Employee> => {
  const result = await employeeMocks.create(e);
  logAuditAction({
    action: 'CREATE',
    module: 'EMPLOYEE',
    entityId: e.epfNo,
    details: `Added new employee ${e.epfNo} (${e.firstName} ${e.lastName || ''}) with basic salary LKR ${e.basicSalary || 0}`
  });
  return result;
};

export const update = async (epf: string, e: Partial<Employee>): Promise<Employee> => {
  const result = await employeeMocks.update(epf, e);
  logAuditAction({
    action: 'UPDATE',
    module: 'EMPLOYEE',
    entityId: epf,
    details: `Updated employee ${epf} details (${e.firstName || ''} ${e.lastName || ''})`
  });
  return result;
};

export const remove = async (epf: string): Promise<void> => {
  await employeeMocks.remove(epf);
  logAuditAction({
    action: 'DELETE',
    module: 'EMPLOYEE',
    entityId: epf,
    details: `Removed employee record ${epf}`
  });
};
