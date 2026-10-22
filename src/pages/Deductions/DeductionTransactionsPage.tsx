import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit3, ShieldAlert, CheckCircle2, Clock, Calendar, DollarSign, Shirt, Landmark } from 'lucide-react';
import SlideOver from '../../components/SlideOver';
import ConfirmDialog from '../../components/ConfirmDialog';
import NumericInput from '../../components/NumericInput';
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect';
import { list as listEmployees } from '../../services/employeeService';
import { list as listDeductionTypes, DeductionType } from '../../mocks/deductions';
import {
  list as listDeductionTransactions,
  create as createDeductionTransaction,
  update as updateDeductionTransaction,
  remove as removeDeductionTransaction,
  computeDeductionMetrics,
  DeductionTransaction
} from '../../mocks/deductionTransactions';

const money = (val: number | undefined) => `LKR ${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DeductionTransactionsPage() {
  const [rows, setRows] = useState<DeductionTransaction[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [deductionMasters, setDeductionMasters] = useState<DeductionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeBc = localStorage.getItem('hsb_active_bc') || 'ALL';
  const cleanBc = activeBc && activeBc !== 'ALL' ? activeBc.split(' / ')[0].trim() : '';

  const initialForm = {
    epfNo: '',
    didCode: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    totalAmount: 0,
    monthlyCut: 0,
    status: 'Active' as 'Active' | 'Completed',
    notes: ''
  };

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    Promise.all([
      listDeductionTransactions(cleanBc),
      listEmployees(cleanBc),
      listDeductionTypes(cleanBc)
    ])
      .then(([transList, empList, masterList]) => {
        setRows(transList);
        setEmployees(empList);
        setDeductionMasters(masterList);
      })
      .catch(err => {
        console.error('Failed to load deduction transaction data', err);
        toast.error('Failed to load deduction data');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const handleBc = () => refresh();
    window.addEventListener('hsb_bc_change', handleBc);
    window.addEventListener('storage', handleBc);
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc);
      window.removeEventListener('storage', handleBc);
    };
  }, [activeBc]);

  function handleOpenAdd() {
    setForm({
      ...initialForm,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
    });
    setIsEditing(false);
    setEditingId(null);
    setErrors({});
    setOpen(true);
  }

  function handleOpenEdit(item: DeductionTransaction) {
    setForm({
      epfNo: item.epfNo || '',
      didCode: item.didCode || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      totalAmount: item.totalAmount || 0,
      monthlyCut: item.monthlyCut || 0,
      status: item.status || 'Active',
      notes: item.notes || ''
    });
    setIsEditing(true);
    setEditingId(item.id);
    setErrors({});
    setOpen(true);
  }

  function handleDeductionSelect(code: string) {
    const master = deductionMasters.find(d => d.code === code);
    setForm(prev => ({
      ...prev,
      didCode: code,
      totalAmount: prev.totalAmount > 0 ? prev.totalAmount : (master?.amount || 0),
      monthlyCut: prev.monthlyCut > 0 ? prev.monthlyCut : Math.round((master?.amount || 0) / 6)
    }));
    if (errors.didCode) setErrors(prev => ({ ...prev, didCode: '' }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.epfNo.trim()) errs.epfNo = 'Employee is required';
    if (!form.didCode.trim()) errs.didCode = 'Deduction type is required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      errs.endDate = 'End date must be after start date';
    }
    if (form.totalAmount <= 0) errs.totalAmount = 'Total amount must be greater than 0';
    if (form.monthlyCut <= 0) errs.monthlyCut = 'Monthly cut must be greater than 0';
    if (form.monthlyCut > form.totalAmount) {
      errs.monthlyCut = 'Monthly cut cannot exceed total amount';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      toast.error('Please complete all required fields correctly');
      return;
    }

    const emp = employees.find(e => e.epfNo === form.epfNo);
    const master = deductionMasters.find(d => d.code === form.didCode);

    try {
      if (isEditing && editingId) {
        await updateDeductionTransaction(editingId, {
          epfNo: form.epfNo,
          employeeName: emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : form.epfNo,
          didCode: form.didCode,
          deductionName: master?.name || form.didCode,
          isLoan: master?.isLoan || false,
          isUniform: master?.isUniform || false,
          startDate: form.startDate,
          endDate: form.endDate,
          totalAmount: Number(form.totalAmount),
          monthlyCut: Number(form.monthlyCut),
          status: form.status,
          notes: form.notes
        });
        toast.success('Deduction transaction updated');
      } else {
        await createDeductionTransaction({
          epfNo: form.epfNo,
          employeeName: emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : form.epfNo,
          didCode: form.didCode,
          deductionName: master?.name || form.didCode,
          isLoan: master?.isLoan || false,
          isUniform: master?.isUniform || false,
          businessCenter: emp?.businessCenter || (cleanBc && cleanBc !== 'ALL' ? cleanBc : '001'),
          startDate: form.startDate,
          endDate: form.endDate,
          totalAmount: Number(form.totalAmount),
          monthlyCut: Number(form.monthlyCut),
          status: form.status,
          notes: form.notes
        });
        toast.success('Deduction transaction created');
      }
      setOpen(false);
      refresh();
    } catch (err) {
      console.error('Save failed', err);
      toast.error('Failed to save deduction transaction');
    }
  }

  async function handleDeleteConfirm() {
    if (!confirmDelete) return;
    try {
      await removeDeductionTransaction(confirmDelete);
      toast.success('Deduction transaction removed');
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      console.error('Delete failed', err);
      toast.error('Failed to delete transaction');
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const emp = employees.find(e => e.epfNo === r.epfNo);
      const name = emp ? `${emp.firstName} ${emp.lastName || ''}` : (r.employeeName || '');
      const searchTarget = `${r.epfNo} ${name} ${r.didCode} ${r.deductionName || ''}`.toLowerCase();
      return searchTarget.includes(q.toLowerCase().trim());
    });
  }, [rows, employees, q]);

  // Overall totals
  const totalDeductionsSum = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const activeCount = rows.filter(r => {
    const metrics = computeDeductionMetrics(r);
    return metrics.status === 'Active';
  }).length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-flat">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">Deduction Transactions</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#2F6F5E] border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#3F9884]"></span>
              {activeCount} Active Recurring
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track multi-month employee deductions (Uniform, Welfare Loans, Tools) with automatic monthly cut limits and date-range rules.
            <span className="ml-2 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Scope: {activeBc === 'ALL' ? 'All Business Centers' : activeBc}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-[#2F6F5E] hover:bg-[#25584a] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>Add Deduction</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Active Deductions</span>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Registered Principal</span>
            <div className="text-xl font-bold text-[#2F6F5E] mt-0.5">{money(totalDeductionsSum)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6F5E] flex items-center justify-center font-bold">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-flat flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Uniform & Loan Recoveries</span>
            <div className="text-xl font-bold text-slate-800 mt-0.5">
              {rows.filter(r => r.isLoan || r.isUniform).length} Records
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Landmark size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-flat overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by EPF, employee, or deduction..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2F6F5E]/30"
            />
          </div>
          <span className="text-xs text-slate-500">
            Showing {filteredRows.length} of {rows.length} transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Deduction Type</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Monthly Cut</th>
                <th className="px-4 py-3 text-center">Months Cut</th>
                <th className="px-4 py-3 text-right">Remaining Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No deduction transactions found. Click "+ Add Deduction" to record a new deduction.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const emp = employees.find(e => e.epfNo === row.epfNo);
                  const empName = emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (row.employeeName || 'Unknown');
                  const master = deductionMasters.find(d => d.code === row.didCode);
                  const isUniform = row.isUniform || master?.isUniform;
                  const isLoan = row.isLoan || master?.isLoan;
                  const metrics = computeDeductionMetrics(row);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-slate-800">{row.epfNo}</div>
                        <div className="text-slate-500 text-[11px] truncate max-w-[150px]">{empName}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{row.deductionName || master?.name || row.didCode}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">{row.didCode}</span>
                          {isUniform && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Shirt size={10} /> Uniform
                            </span>
                          )}
                          {isLoan && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Landmark size={10} /> Loan
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        <div className="text-[11px]">{row.startDate}</div>
                        <div className="text-[10px] text-slate-400">to {row.endDate}</div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                        {money(row.totalAmount)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">
                        {money(row.monthlyCut)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {metrics.monthsCutSoFar} / {metrics.totalMonthsWindow} mo
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        {money(metrics.remainingBalance)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {metrics.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#2F6F5E] border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3F9884]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <CheckCircle2 size={12} className="text-slate-500" />
                            Completed
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit Transaction"
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete Transaction"
                            onClick={() => setConfirmDelete(row.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit SlideOver */}
      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={isEditing ? 'Edit Deduction Transaction' : 'New Deduction Transaction'}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">Employee & Deduction Type</h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Employee (EPF No) <span className="text-red-500">*</span>
              </label>
              <SearchableEmployeeSelect
                employees={employees}
                value={form.epfNo}
                onChange={epf => {
                  setForm(prev => ({ ...prev, epfNo: epf || '' }));
                  if (errors.epfNo) setErrors(prev => ({ ...prev, epfNo: '' }));
                }}
              />
              {errors.epfNo && <p className="mt-1 text-xs text-red-500">{errors.epfNo}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deduction Type (From Master) <span className="text-red-500">*</span>
              </label>
              <select
                value={form.didCode}
                onChange={e => handleDeductionSelect(e.target.value)}
                className={`w-full form-input text-xs ${errors.didCode ? 'border-red-300 ring-2 ring-red-100' : ''}`}
              >
                <option value="">-- Select Deduction Type --</option>
                {deductionMasters.map(d => {
                  const flags = [
                    d.isUniform ? 'Uniform' : '',
                    d.isLoan ? 'Loan' : '',
                    d.addOther ? 'Other' : ''
                  ].filter(Boolean).join(', ');
                  return (
                    <option key={d.code} value={d.code}>
                      {d.code} - {d.name} {flags ? `[${flags}]` : ''} ({money(d.amount)})
                    </option>
                  );
                })}
              </select>
              {errors.didCode && <p className="mt-1 text-xs text-red-500">{errors.didCode}</p>}

              {/* Deduction Type Flags Indicator */}
              {form.didCode && (() => {
                const selected = deductionMasters.find(d => d.code === form.didCode);
                if (!selected) return null;
                return (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Master Flags:</span>
                    {selected.isUniform && (
                      <span className="px-2 py-0.5 rounded font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Uniform Deductible
                      </span>
                    )}
                    {selected.isLoan && (
                      <span className="px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Loan / Distress Recovery
                      </span>
                    )}
                    {!selected.isUniform && !selected.isLoan && (
                      <span className="px-2 py-0.5 rounded text-slate-600 bg-slate-100 border border-slate-200">
                        Standard Deduction
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">Schedule & Recovery Rule</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`w-full form-input text-xs ${errors.startDate ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className={`w-full form-input text-xs ${errors.endDate ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Amount (LKR) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={form.totalAmount}
                  onChange={e => setForm(prev => ({ ...prev, totalAmount: Number(e.target.value || 0) }))}
                  className={`w-full form-input text-xs ${errors.totalAmount ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.totalAmount && <p className="mt-1 text-xs text-red-500">{errors.totalAmount}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Cut Amount (LKR) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={form.monthlyCut}
                  onChange={e => setForm(prev => ({ ...prev, monthlyCut: Number(e.target.value || 0) }))}
                  className={`w-full form-input text-xs ${errors.monthlyCut ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.monthlyCut && <p className="mt-1 text-xs text-red-500">{errors.monthlyCut}</p>}
              </div>
            </div>

            {form.totalAmount > 0 && form.monthlyCut > 0 && (
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <span className="font-semibold">Calculation preview:</span> Approx.{' '}
                <strong>{Math.ceil(form.totalAmount / form.monthlyCut)} months</strong> to complete. Final month deduction will be{' '}
                <strong>{money(form.totalAmount % form.monthlyCut || form.monthlyCut)}</strong>.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full form-input text-xs"
              >
                <option value="Active">Active (Deduct each payroll run)</option>
                <option value="Completed">Completed (Stop deducting)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Reference</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional purpose, agreement details or notes..."
                rows={2}
                className="w-full form-input text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-[#2F6F5E] hover:bg-[#25584a] text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              {isEditing ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </div>
      </SlideOver>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Deduction Transaction"
        message="Are you sure you want to delete this deduction transaction record? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
