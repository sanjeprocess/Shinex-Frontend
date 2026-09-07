import api from '../api/axios';

export type AdminUser = {
  loginName: string;
  role: 'SUPERADMIN' | 'ADMIN';
  clientBusinessCode?: string;
  fullName?: string;
  nicNumber?: string;
  password?: string;
  isBlocked: boolean;
  canViewSite: boolean;
  accessLevel: 'READ_ONLY' | 'READ_WRITE';
  canManageUsers: boolean;
};

const flag = (value: unknown, fallback = false) =>
  value === undefined || value === null ? fallback : value === true || value === 'Y' || value === '1' || value === 'true';

export const list = async (): Promise<AdminUser[]> => {
  try {
    const res = await api.get('/admins');
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((u: any) => ({
        loginName: (u.loginName || '').trim(),
        role: (u.role || 'ADMIN').toUpperCase() as 'SUPERADMIN' | 'ADMIN',
        clientBusinessCode: (u.clientBusinessCode || '').trim()
        ,fullName: (u.fullName || '').trim(), nicNumber: (u.nicNumber || '').trim()
        ,isBlocked: flag(u.blocked ?? u.isBlocked)
        ,canViewSite: flag(u.canViewSite, true)
        ,accessLevel: u.accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY'
        ,canManageUsers: flag(u.canManageUsers)
      }));
    }
  } catch (err) {
    console.error('Failed to load admins from API', err);
  }
  return [];
};

export const create = async (admin: AdminUser): Promise<AdminUser> => {
  const payload = {
    loginName: admin.loginName.trim(),
    password: admin.password,
    role: admin.role,
    clientBusinessCode: (admin.clientBusinessCode || 'ALL').split(' - ')[0].trim()
    ,fullName: admin.fullName?.trim(), nicNumber: admin.nicNumber?.trim()
    ,blocked: admin.isBlocked
    ,canViewSite: admin.canViewSite
    ,accessLevel: admin.accessLevel
    ,canManageUsers: admin.canManageUsers
  };
  const res = await api.post('/admins', payload);
  return res.data || admin;
};

export const update = async (loginName: string, patch: Partial<AdminUser>): Promise<AdminUser> => {
  const payload: any = {
    role: patch.role,
    clientBusinessCode: patch.clientBusinessCode?.split(' - ')[0].trim()
    ,blocked: patch.isBlocked
    ,canViewSite: patch.canViewSite
    ,accessLevel: patch.accessLevel
    ,canManageUsers: patch.canManageUsers
  };
  if (patch.password && patch.password.trim().length > 0) {
    payload.password = patch.password.trim();
  }
  const res = await api.put(`/admins/${encodeURIComponent(loginName)}`, payload);
  return res.data || { loginName, ...patch };
};

export const remove = async (loginName: string): Promise<void> => {
  await api.delete(`/admins/${encodeURIComponent(loginName)}`);
};
