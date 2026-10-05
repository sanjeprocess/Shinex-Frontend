export type AccessLevel = 'READ_ONLY' | 'READ_WRITE'

// ─── Granular Module Permissions ───────────────────────────────────────────
export type ModulePermission = {
  view: boolean       // can see the module/page at all
  edit: boolean       // can edit/create/delete inside the module
}

// Master data = static reference tables (sections, customers, BCs, additions/deductions masters)
// Transaction data = live operational data (attendance, leaves, loans, additions/deductions tx, plant transfers)
export type AdminPermissions = {
  // Account status
  isBlocked: boolean
  canViewSite: boolean
  canManageUsers: boolean
  accessLevel: AccessLevel

  // Module-level visibility & write control (controlled by SUPERADMIN)
  modules: {
    employees:        ModulePermission  // Employees list & forms
    attendance:       ModulePermission  // Attendance page
    leaves:           ModulePermission  // Leaves page
    loans:            ModulePermission  // Loans page
    additions:        ModulePermission  // Transaction additions
    deductions:       ModulePermission  // Transaction deductions
    masterSections:   ModulePermission  // Master → Sections
    masterCustomers:  ModulePermission  // Master → Customers/Plants
    masterBCenters:   ModulePermission  // Master → Business Centers
    masterAdditions:  ModulePermission  // Master → Addition types
    masterDeductions: ModulePermission  // Master → Deduction types
    plantTransfers:   ModulePermission  // Plant Transfers
    reports:          ModulePermission  // Reports page
    process:          ModulePermission  // Monthly breakdown / payroll process
    payAdvice:        ModulePermission  // Pay advice / dossier
    audit:            ModulePermission  // Audit log
  }
}

export type CurrentUser = {
  role: string
  isBlocked: boolean
  canViewSite: boolean
  accessLevel: AccessLevel
  canManageUsers: boolean
  permissions: AdminPermissions
}

const truthy = (value: unknown, fallback: boolean): boolean =>
  value === undefined || value === null
    ? fallback
    : value === true || value === 'Y' || value === '1' || value === 'true'

export const DEFAULT_MODULE_PERMISSIONS: AdminPermissions['modules'] = {
  employees:        { view: true, edit: true },
  attendance:       { view: true, edit: true },
  leaves:           { view: true, edit: true },
  loans:            { view: true, edit: true },
  additions:        { view: true, edit: true },
  deductions:       { view: true, edit: true },
  masterSections:   { view: true, edit: true },
  masterCustomers:  { view: true, edit: true },
  masterBCenters:   { view: true, edit: true },
  masterAdditions:  { view: true, edit: true },
  masterDeductions: { view: true, edit: true },
  plantTransfers:   { view: true, edit: true },
  reports:          { view: true, edit: false },
  process:          { view: true, edit: true },
  payAdvice:        { view: true, edit: false },
  audit:            { view: true, edit: false },
}

export const SUPERADMIN_MODULE_PERMISSIONS: AdminPermissions['modules'] = {
  employees:        { view: true, edit: true },
  attendance:       { view: true, edit: true },
  leaves:           { view: true, edit: true },
  loans:            { view: true, edit: true },
  additions:        { view: true, edit: true },
  deductions:       { view: true, edit: true },
  masterSections:   { view: true, edit: true },
  masterCustomers:  { view: true, edit: true },
  masterBCenters:   { view: true, edit: true },
  masterAdditions:  { view: true, edit: true },
  masterDeductions: { view: true, edit: true },
  plantTransfers:   { view: true, edit: true },
  reports:          { view: true, edit: true },
  process:          { view: true, edit: true },
  payAdvice:        { view: true, edit: true },
  audit:            { view: true, edit: true },
}

function parseModulePermissions(raw: any): AdminPermissions['modules'] {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MODULE_PERMISSIONS }
  const keys = Object.keys(DEFAULT_MODULE_PERMISSIONS) as (keyof AdminPermissions['modules'])[]
  const result: any = {}
  keys.forEach(k => {
    const src = raw[k]
    if (src && typeof src === 'object') {
      result[k] = {
        view: truthy(src.view, DEFAULT_MODULE_PERMISSIONS[k].view),
        edit: truthy(src.edit, DEFAULT_MODULE_PERMISSIONS[k].edit)
      }
    } else {
      result[k] = { ...DEFAULT_MODULE_PERMISSIONS[k] }
    }
  })
  return result
}

export function getCurrentUser(): CurrentUser {
  const role = (localStorage.getItem('hsb_user_role') || 'ADMIN').toUpperCase()
  const rawPerm = localStorage.getItem('hsb_user_permissions')
  let data: any = {}
  try { data = rawPerm ? JSON.parse(rawPerm) : {} } catch { data = {} }

  const superAdmin = role === 'SUPERADMIN' || role === 'SUPER_ADMIN'

  const basePermissions: AdminPermissions = {
    isBlocked:      superAdmin ? false : truthy(data.isBlocked, false),
    canViewSite:    superAdmin ? true  : truthy(data.canViewSite, true),
    accessLevel:    superAdmin ? 'READ_WRITE' : (data.accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY'),
    canManageUsers: superAdmin ? true  : truthy(data.canManageUsers, false),
    modules:        superAdmin ? { ...SUPERADMIN_MODULE_PERMISSIONS } : parseModulePermissions(data.modules)
  }

  return {
    role,
    isBlocked:      basePermissions.isBlocked,
    canViewSite:    basePermissions.canViewSite,
    accessLevel:    basePermissions.accessLevel,
    canManageUsers: basePermissions.canManageUsers,
    permissions:    basePermissions
  }
}

// ─── Helper hooks / functions ──────────────────────────────────────────────
export const canWrite        = () => getCurrentUser().accessLevel === 'READ_WRITE'
export const isSuperAdmin    = () => ['SUPERADMIN', 'SUPER_ADMIN'].includes(getCurrentUser().role)
export const canEdit         = () => isSuperAdmin() || canWrite()

/** Can the current user view a specific module? */
export const canViewModule   = (mod: keyof AdminPermissions['modules']) =>
  getCurrentUser().permissions.modules[mod]?.view ?? true

/** Can the current user edit/write in a specific module? */
export const canEditModule   = (mod: keyof AdminPermissions['modules']) =>
  getCurrentUser().permissions.modules[mod]?.edit ?? false

/** Persist permissions to localStorage (called after login) */
export function setCurrentUserPermissions(role: string, permissions: Partial<AdminPermissions>) {
  localStorage.setItem('hsb_user_role', role)
  localStorage.setItem('hsb_user_permissions', JSON.stringify(permissions))
}
