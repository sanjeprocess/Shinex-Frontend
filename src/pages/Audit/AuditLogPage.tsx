import React, { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { fetchAuditLogs, AuditLogEntry } from '../../utils/auditLogger'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedModule, setSelectedModule] = useState<string>('ALL')
  const [selectedAction, setSelectedAction] = useState<string>('ALL')
  const [search, setSearch] = useState<string>('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    try {
      const data = await fetchAuditLogs()
      setLogs(data)
    } catch (err) {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedModule !== 'ALL' && log.module !== selectedModule) return false
      if (selectedAction !== 'ALL' && log.action !== selectedAction) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const str = `${log.performedBy || ''} ${log.module || ''} ${log.action || ''} ${log.entityId || ''} ${log.details || ''}`.toLowerCase()
        if (!str.includes(q)) return false
      }
      return true
    })
  }, [logs, selectedModule, selectedAction, search])

  function exportToExcel() {
    if (filteredLogs.length === 0) {
      toast.error('No logs to export')
      return
    }

    const headers = 'Timestamp,Admin User,Action,Module,Entity ID,Change Details'
    const rows = filteredLogs.map(l => {
      const time = l.timestamp ? new Date(l.timestamp).toLocaleString() : ''
      const user = String(l.performedBy || '').replace(/"/g, '""')
      const details = String(l.details || '').replace(/"/g, '""')
      return `"${time}","${user}","${l.action}","${l.module}","${l.entityId}","${details}"`
    })

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `System_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Audit logs exported to Excel!')
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12161C] to-[#1B2028] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#2F6F5E] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">System Audit Trail</span>
            <span className="text-slate-400 text-xs">Live Database Tracking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Change & Audit History</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track every addition, modification, and deletion with admin timestamps and change details.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
          >
            🔄 Refresh Logs
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#26594b] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-md"
          >
            📊 Export Audit Log (Excel)
          </button>
        </div>
      </div>

      {/* Filter Controls Card */}
      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Module</label>
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300 font-medium text-xs"
            >
              <option value="ALL">All Modules</option>
              <option value="EMPLOYEE">Employees</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="LOAN">Loans</option>
              <option value="SECTION">Sections</option>
              <option value="ADDITION">Additions</option>
              <option value="DEDUCTION">Deductions</option>
              <option value="LEAVE">Leaves</option>
              <option value="BUSINESS_CENTER">Business Centers</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Action</label>
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="w-full form-input bg-slate-50 border-slate-300 font-medium text-xs"
            >
              <option value="ALL">All Action Types</option>
              <option value="CREATE">CREATE (Additions)</option>
              <option value="UPDATE">UPDATE (Edits)</option>
              <option value="DELETE">DELETE (Removals)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search Audit Trail</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by admin name, details or ID..."
              className="w-full form-input bg-slate-50 border-slate-300 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Timeline Table */}
      <div className="bg-white rounded-2xl shadow-flat border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Recorded System Events ({filteredLogs.length})</h3>
          <span className="text-xs text-slate-500">Sorted by Newest First</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading system audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No audit history records found for the selected criteria.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log, idx) => {
              const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'
              const actionBg =
                log.action === 'CREATE'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : log.action === 'UPDATE'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200'

              return (
                <div key={log.id || idx} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actionBg}`}>
                        {log.action}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                        {log.module}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-500">
                        ID: {log.entityId}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 font-medium pt-0.5">
                      {log.details}
                    </p>
                  </div>

                  <div className="text-right text-xs space-y-0.5 min-w-[180px]">
                    <div className="font-semibold text-slate-700">{log.performedBy || 'System Admin'}</div>
                    <div className="text-[11px] text-slate-400 mono-numeric">{dateStr}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
