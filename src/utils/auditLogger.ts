import api from '../api/axios'

export type AuditLogEntry = {
  id?: number | string
  timestamp?: string
  performedBy?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  module: string
  entityId?: string
  details: string
}

export async function logAuditAction(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  module: string
  entityId?: string
  details: string
}) {
  let userName = 'System Admin';
  try {
    const profileRaw = localStorage.getItem('hsb_user_profile');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      if (p.fullName && p.fullName.trim()) {
        userName = p.fullName.trim();
      }
    }
  } catch {}

  if (userName === 'System Admin') {
    userName =
      localStorage.getItem('user_full_name') ||
      localStorage.getItem('user_name') ||
      localStorage.getItem('hsb_test_user') ||
      'System Admin';
  }

  const logPayload = {
    performedBy: userName,
    action: params.action,
    module: params.module,
    entityId: params.entityId || 'N/A',
    details: params.details,
    timestamp: new Date().toISOString()
  }

  try {
    const cached = JSON.parse(localStorage.getItem('hsb_audit_logs') || '[]')
    cached.unshift({ ...logPayload, id: Date.now() })
    localStorage.setItem('hsb_audit_logs', JSON.stringify(cached.slice(0, 300)))
  } catch {}

  try {
    await api.post('/audit-logs', logPayload)
  } catch (err) {
    console.warn('Failed to persist audit log to backend:', err)
  }
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const res = await api.get('/audit-logs')
    if (res.data && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        // Sync latest DB data to localStorage
        localStorage.setItem('hsb_audit_logs', JSON.stringify(res.data))
        return res.data
      } else {
        // DB is empty — clear localStorage cache too
        localStorage.removeItem('hsb_audit_logs')
        return []
      }
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem('hsb_audit_logs') || '[]')
    return cached
  } catch {
    return []
  }
}
