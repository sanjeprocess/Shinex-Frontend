export type AccessLevel = 'READ_ONLY' | 'READ_WRITE'

export type CurrentUser = {
  role: string
  isBlocked: boolean
  canViewSite: boolean
  accessLevel: AccessLevel
  canManageUsers: boolean
}

const truthy = (value: unknown, fallback: boolean) =>
  value === undefined || value === null ? fallback : value === true || value === 'Y' || value === '1' || value === 'true'

export function getCurrentUser(): CurrentUser {
  const role = (localStorage.getItem('hsb_user_role') || 'ADMIN').toUpperCase()
  const raw = localStorage.getItem('hsb_user_permissions')
  let data: Partial<CurrentUser> = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }
  const superAdmin = role === 'SUPERADMIN' || role === 'SUPER_ADMIN'
  return {
    role,
    isBlocked: superAdmin ? false : truthy(data.isBlocked, false),
    canViewSite: superAdmin ? true : truthy(data.canViewSite, true),
    accessLevel: superAdmin ? 'READ_WRITE' : data.accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY',
    canManageUsers: superAdmin ? true : truthy(data.canManageUsers, false)
  }
}

export const canWrite = () => getCurrentUser().accessLevel === 'READ_WRITE'
export const canEdit = () => isSuperAdmin() || canWrite()
export const isSuperAdmin = () => ['SUPERADMIN', 'SUPER_ADMIN'].includes(getCurrentUser().role)
