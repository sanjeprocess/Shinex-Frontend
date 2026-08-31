import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchInput from '../../components/SearchInput'
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect'
import { list as listLoans, create as createLoan, update as updateLoan, remove as removeLoan, LoanRecord } from '../../mocks/loans'
import { list as listEmployees } from '../../mocks/employees'

export default function LoansPage() {
  const [rows, setRows] = useState<LoanRecord[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const defaultForm: Partial<LoanRecord> = {
    loanId: '',
    epfNo: '',
    loanAmount: 0,
    loanStartDate: new Date().toISOString().slice(0, 10),
    loanDuration: 12,
    businessUnit: localStorage.getItem('hsb_active_bc') || '001'
  }
  const [form, setForm] = useState<Partial<LoanRecord>>(defaultForm)
  const [errors, setErrors] = useState<{ loanId?: string; epfNo?: string; loanAmount?: string }>({})

  useEffect(() => {
    refresh()
    listEmployees().then(setEmployees)
  }, [])

  function refresh() {
    listLoans().then(setRows)
  }

  function onOpenCreate() {
    setErrors({})
    setForm({
      ...defaultForm,
      loanId: `L${Date.now().toString().slice(-6)}`,
      businessUnit: localStorage.getItem('hsb_active_bc') || '001'
    })
    setEditingId(null)
    setOpen(true)
  }

  function onEdit(row: LoanRecord) {
    setErrors({})
    setForm({ ...row })
    setEditingId(row.loanId)
    setOpen(true)
  }

  function validate() {
    const next: { loanId?: string; epfNo?: string; loanAmount?: string } = {}
    if (!String(form.loanId || '').trim()) next.loanId = 'Loan ID is required'
    if (!String(form.epfNo || '').trim()) next.epfNo = 'Employee is required'
    if (!form.loanAmount || Number(form.loanAmount) <= 0) next.loanAmount = 'Loan Amount must be greater than 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSave() {
    if (!validate()) {
      toast.error('Please complete the required fields')
      return
    }

    try {
      const rec: LoanRecord = {
        id: form.loanId!,
        loanId: form.loanId!,
        epfNo: form.epfNo!,
        loanAmount: Number(form.loanAmount),
        loanStartDate: form.loanStartDate || new Date().toISOString().slice(0, 10),
        loanDuration: Number(form.loanDuration || 12),
        businessUnit: form.businessUnit || '001'
      }

      if (editingId) {
        await updateLoan(editingId, rec)
        toast.success('Loan updated')
      } else {
        await createLoan(rec)
        toast.success('Loan issued successfully')
      }
      setOpen(false)
      refresh()
    } catch (err) {
      toast.error('Failed to save loan record')
    }
  }

  function onDeleteConfirm() {
    if (deletingId) {
      removeLoan(deletingId)
        .then(() => {
          setDeletingId(null)
          refresh()
          toast.success('Loan deleted')
        })
        .catch(() => toast.error('Failed to delete loan'))
    }
  }

  const tableData = rows
    .filter(r => {
      const emp = employees.find(e => e.epfNo === r.epfNo)
      const empName = emp ? `${emp.firstName} ${emp.lastName || ''}`.toLowerCase() : ''
      const searchStr = `${r.loanId} ${r.epfNo} ${empName} ${r.businessUnit}`.toLowerCase()
      return searchStr.includes(q.toLowerCase())
    })
    .map(r => {
      const emp = employees.find(e => e.epfNo === r.epfNo)
      return {
        id: r.loanId,
        loanId: r.loanId,
        epfNo: r.epfNo,
        empName: emp ? `${emp.firstName} ${emp.lastName || ''}` : '—',
        amount: `Rs. ${Number(r.loanAmount).toLocaleString()}`,
        startDate: r.loanStartDate,
        duration: `${r.loanDuration} Months`,
        businessUnit: r.businessUnit
      }
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Employee Loan Transactions</h2>
          <p className="text-xs text-slate-500">Manage employee loans, start dates, and durations (TBL_T_Lone)</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search loans by ID, EPF or employee..." />
          <button className="bg-[#2F6F5E] text-white px-3.5 py-1.5 rounded-md btn-press text-sm font-medium" onClick={onOpenCreate}>
            + Issue New Loan
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'loanId', label: 'Loan ID', className: 'mono-numeric font-medium' },
          { key: 'epfNo', label: 'EPF No', className: 'mono-numeric' },
          { key: 'empName', label: 'Employee Name' },
          { key: 'amount', label: 'Loan Amount', className: 'mono-numeric font-semibold text-[#2F6F5E]' },
          { key: 'startDate', label: 'Start Date', className: 'mono-numeric' },
          { key: 'duration', label: 'Duration' },
          { key: 'businessUnit', label: 'Business Unit' },
          { key: 'id', label: 'Actions' }
        ]}
        data={tableData}
        onEdit={(id) => {
          const row = rows.find(r => r.loanId === id)
          if (row) onEdit(row)
        }}
        onDelete={(id) => setDeletingId(id)}
      />

      <Modal title={editingId ? 'Edit Loan Record' : 'Issue New Loan'} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 font-medium">Loan ID</label>
            <input
              disabled={!!editingId}
              className={`mt-1 w-full form-input mono-numeric ${errors.loanId ? 'border-red-300 ring-2 ring-red-100' : ''}`}
              value={form.loanId || ''}
              onChange={e => setForm({ ...form, loanId: e.target.value })}
            />
            {errors.loanId && <p className="mt-1 text-xs text-red-500">{errors.loanId}</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-medium mb-1">Employee</label>
            <SearchableEmployeeSelect
              value={form.epfNo}
              onChange={(epf) => {
                setForm(prev => ({ ...prev, epfNo: epf || '' }))
                if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: undefined }))
              }}
            />
            {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 font-medium">Loan Amount (LKR)</label>
              <input
                type="number"
                className={`mt-1 w-full form-input ${errors.loanAmount ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                value={form.loanAmount || ''}
                onChange={e => setForm({ ...form, loanAmount: Number(e.target.value) })}
              />
              {errors.loanAmount && <p className="mt-1 text-xs text-red-500">{errors.loanAmount}</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-600 font-medium">Duration (Months)</label>
              <input
                type="number"
                className="mt-1 w-full form-input"
                value={form.loanDuration || ''}
                onChange={e => setForm({ ...form, loanDuration: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 font-medium">Start Date</label>
              <input
                type="date"
                className="mt-1 w-full form-input"
                value={form.loanStartDate || ''}
                onChange={e => setForm({ ...form, loanStartDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 font-medium">Business Unit</label>
              <input
                className="mt-1 w-full form-input"
                value={form.businessUnit || ''}
                onChange={e => setForm({ ...form, businessUnit: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button onClick={() => setOpen(false)} className="px-3.5 py-1.5 text-sm rounded-md border">Cancel</button>
            <button onClick={onSave} className="px-3.5 py-1.5 text-sm rounded-md bg-[#2F6F5E] text-white font-medium">Save Loan</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Delete Loan Record"
        message={`Are you sure you want to delete loan ${deletingId}?`}
        onConfirm={onDeleteConfirm}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
