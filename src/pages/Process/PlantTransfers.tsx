import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  ArrowRightLeft, 
  Building2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Plus, 
  ArrowRight,
  Save,
  UserCheck,
  History
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import NumericInput from '../../components/NumericInput';
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect';
import { list as listTransfers, create as createTransfer, update as updateTransfer, remove as removeTransfer, PlantTransfer } from '../../mocks/plantTransfers';
import { list as listEmployees, update as updateEmployee } from '../../services/employeeService';
import { list as listPlants, Customer } from '../../mocks/customers';
import { PROFIT_CENTERS } from '../../constants/profitCenters';

export default function PlantTransfersPage() {
  const [transfers, setTransfers] = useState<PlantTransfer[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [plants, setPlants] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Completed'>('ALL');

  const defaultForm: Partial<PlantTransfer> = {
    epfNo: '',
    employeeName: '',
    fromPlant: '',
    toPlant: '',
    transferDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    daysWorked: 1,
    profitCenter: '',
    transferType: 'Temporary Support',
    status: 'Active',
    workDetails: '',
    businessCenter: localStorage.getItem('hsb_active_bc') || '001'
  };

  const [form, setForm] = useState<Partial<PlantTransfer>>(defaultForm);
  const [errors, setErrors] = useState<{ epfNo?: string; toPlant?: string; transferDate?: string }>({});

  // Quick Manual Plant Assignment state (Feature 3)
  const [assignEpf, setAssignEpf] = useState<string | null>(null);
  const [assignPlant, setAssignPlant] = useState<string>('');
  const [assignDate, setAssignDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [assignType, setAssignType] = useState<string>('Permanent Transfer');
  const [assignRemarks, setAssignRemarks] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  function refresh() {
    const activeBc = localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';

    setLoading(true);
    listTransfers(cleanBc)
      .then(setTransfers)
      .finally(() => setLoading(false));

    listEmployees(cleanBc).then(setEmployees).catch(console.error);
    listPlants(cleanBc).then(setPlants).catch(console.error);
  }

  useEffect(() => {
    refresh();
    const handleBcChange = () => refresh();
    window.addEventListener('hsb_bc_change', handleBcChange);
    window.addEventListener('storage', handleBcChange);
    return () => {
      window.removeEventListener('hsb_bc_change', handleBcChange);
      window.removeEventListener('storage', handleBcChange);
    };
  }, []);

  function handleOpenCreate() {
    setErrors({});
    const firstEmp = employees[0];
    const initialFromPlant = firstEmp?.plantCode ? (plants.find(p => p.code === firstEmp.plantCode)?.name || firstEmp.plantCode) : '';
    
    setForm({
      ...defaultForm,
      epfNo: firstEmp?.epfNo || '',
      employeeName: firstEmp ? (firstEmp.firstName + ' ' + (firstEmp.lastName || '')).trim() : '',
      fromPlant: initialFromPlant,
      toPlant: plants[0]?.code ? (plants[0].code + ' (' + plants[0].name + ')') : '',
      profitCenter: plants[0]?.profitCenter || '',
      businessCenter: localStorage.getItem('hsb_active_bc') || '001'
    });
    setEditingId(null);
    setOpen(true);
  }

  function handleOpenEdit(item: PlantTransfer) {
    setErrors({});
    setForm({ ...item });
    setEditingId(item.id);
    setOpen(true);
  }

  function handleEmployeeSelect(epf: string | null) {
    if (!epf) return;
    const emp = employees.find(e => e.epfNo === epf);
    if (emp) {
      const plantObj = plants.find(p => p.code === emp.plantCode);
      const plantDisplay = plantObj ? (plantObj.code + ' (' + plantObj.name + ')') : (emp.plantCode || 'Main Plant');
      setForm(prev => ({
        ...prev,
        epfNo: emp.epfNo,
        employeeName: (emp.firstName + ' ' + (emp.lastName || '')).trim(),
        fromPlant: plantDisplay,
        businessCenter: emp.businessCenter || prev.businessCenter
      }));
    }
  }

  function validate() {
    const nextErrors: typeof errors = {};
    if (!form.epfNo?.trim()) nextErrors.epfNo = 'Employee is required';
    if (!form.toPlant?.trim()) nextErrors.toPlant = 'Destination plant is required';
    if (!form.transferDate?.trim()) nextErrors.transferDate = 'Transfer date is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      toast.error('Please complete all required fields.');
      return;
    }

    try {
      const targetPlantCode = form.toPlant ? form.toPlant.split(' ')[0].trim() : '';
      if (form.epfNo && targetPlantCode) {
        try {
          await updateEmployee(form.epfNo, { plantCode: targetPlantCode });
        } catch (e) {
          console.warn('Could not update employee master plant', e);
        }
      }

      if (editingId) {
        await updateTransfer(editingId, form as PlantTransfer);
        toast.success('Plant transfer record updated.');
      } else {
        await createTransfer(form as any);
        toast.success('Plant transfer record logged successfully.');
      }
      setOpen(false);
      refresh();
    } catch (error) {
      console.error('Failed to save transfer', error);
      toast.error('Failed to save plant transfer record.');
    }
  }

  async function handleSaveAssignment() {
    if (!assignEpf) {
      toast.error('Please select an employee');
      return;
    }
    if (!assignPlant) {
      toast.error('Please select a target plant');
      return;
    }
    const emp = employees.find(e => e.epfNo === assignEpf);
    if (!emp) return;

    setAssigning(true);
    try {
      const targetPlantCode = assignPlant.split(' ')[0].trim();
      // 1. Update employee's current plant in master
      await updateEmployee(assignEpf, { plantCode: targetPlantCode });

      // 2. Log transfer record
      const selectedPlantObj = plants.find(p => p.code === targetPlantCode);
      const currentPlantObj = plants.find(p => p.code === emp.plantCode);
      const fromDisplay = currentPlantObj ? `${currentPlantObj.code} (${currentPlantObj.name})` : (emp.plantCode || 'Base Plant');
      const toDisplay = selectedPlantObj ? `${selectedPlantObj.code} (${selectedPlantObj.name})` : assignPlant;

      await createTransfer({
        epfNo: assignEpf,
        employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
        fromPlant: fromDisplay,
        toPlant: toDisplay,
        transferDate: assignDate || new Date().toISOString().slice(0, 10),
        transferType: assignType as any,
        profitCenter: selectedPlantObj?.profitCenter || '',
        workDetails: assignRemarks || 'Manual Plant Assignment',
        status: 'Active',
        businessCenter: emp.businessCenter || localStorage.getItem('hsb_active_bc') || '001',
        daysWorked: 1
      });

      toast.success(`Plant assignment saved! ${emp.firstName} is now assigned to ${targetPlantCode}.`);
      setAssignPlant('');
      setAssignRemarks('');
      refresh();
    } catch (err) {
      console.error('Failed to save plant assignment', err);
      toast.error('Failed to save plant assignment.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleMarkComplete(item: PlantTransfer) {
    try {
      await updateTransfer(item.id, { 
        status: 'Completed',
        endDate: new Date().toISOString().slice(0, 10)
      });
      toast.success('Transfer marked as completed for ' + item.employeeName);
      refresh();
    } catch {
      toast.error('Failed to update transfer status');
    }
  }

  async function handleDeleteConfirm() {
    if (!confirmDelete) return;
    try {
      await removeTransfer(confirmDelete);
      toast.success('Transfer record deleted.');
      setConfirmDelete(null);
      refresh();
    } catch {
      toast.error('Failed to delete transfer record.');
    }
  }

  const activeBc = localStorage.getItem('hsb_active_bc') || 'All';

  // Statistics
  const totalTransfers = transfers.length;
  const activeAssignments = transfers.filter(t => t.status === 'Active').length;
  const totalDaysWorked = transfers.reduce((acc, curr) => acc + (Number(curr.daysWorked) || 0), 0);
  const completedTransfers = transfers.filter(t => t.status === 'Completed').length;

  // Filtered List
  const filteredData = useMemo(() => {
    return transfers.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      const text = (t.epfNo + ' ' + t.employeeName + ' ' + t.fromPlant + ' ' + t.toPlant + ' ' + (t.profitCenter || '') + ' ' + t.workDetails).toLowerCase();
      return text.includes(q.toLowerCase());
    });
  }, [transfers, statusFilter, q]);

  const tableData = filteredData.map(r => ({
    id: r.id,
    employee: (
      <div>
        <span className="font-semibold text-slate-800 mono-numeric text-xs">{r.epfNo}</span>
        <span className="block text-slate-600 text-xs font-medium">{r.employeeName}</span>
      </div>
    ),
    transferDate: (
      <div>
        <span className="mono-numeric text-xs font-medium text-slate-700">{r.transferDate}</span>
        {r.endDate && <span className="block text-[11px] text-slate-400">until {r.endDate}</span>}
      </div>
    ),
    plantRoute: (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{r.fromPlant || 'Base Plant'}</span>
        <ArrowRight size={13} className="text-teal-600 shrink-0" />
        <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">{r.toPlant}</span>
      </div>
    ),
    duration: (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs mono-numeric border border-blue-200">
        <Clock size={12} /> {r.daysWorked} {r.daysWorked === 1 ? 'day' : 'days'}
      </span>
    ),
    profitCenter: (
      <span className="text-xs text-slate-700 font-medium">{r.profitCenter || '—'}</span>
    ),
    statusBadge: (
      <div className="flex items-center gap-2">
        {r.status === 'Active' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Active Support
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
            <CheckCircle2 size={12} /> Completed
          </span>
        )}
        {r.status === 'Active' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMarkComplete(r); }}
            className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition"
            title="Mark as completed & returned"
          >
            Complete
          </button>
        )}
      </div>
    ),
    workDetails: (
      <p className="text-xs text-slate-600 line-clamp-2 max-w-xs">{r.workDetails || '—'}</p>
    )
  }));

  const selectedAssignEmp = useMemo(() => {
    if (!assignEpf) return null;
    return employees.find(e => e.epfNo === assignEpf) || null;
  }, [employees, assignEpf]);

  const selectedEmpTransfers = useMemo(() => {
    if (!assignEpf) return [];
    return transfers.filter(t => t.epfNo === assignEpf);
  }, [transfers, assignEpf]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="text-teal-600" size={22} />
            Employee Plant Transfers & Roaming Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 size={13} className="text-teal-600" />
            Active Business Center Scope: <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{activeBc}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by EPF, name, plant, details..." />
          <button 
            className="bg-[#2F6F5E] hover:bg-[#265b4d] text-white px-3.5 py-1.5 rounded-md font-medium text-sm transition shadow-sm flex items-center gap-1.5"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Log Plant Transfer</span>
          </button>
        </div>
      </div>

      {/* Manual Plant Assignment Card (Feature 3 & 4) */}
      <div className="bg-white p-5 rounded-2xl shadow-flat border border-slate-200/80">
        <div className="flex items-center justify-between mb-3 border-b pb-2.5">
          <div className="flex items-center gap-2">
            <UserCheck className="text-[#2F6F5E]" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">Manual Plant Assignment & Current Plant Setter</h3>
          </div>
          <span className="text-[11px] text-slate-500 italic">Select an employee and target plant, then click Save to commit assignment.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Employee *</label>
            <SearchableEmployeeSelect 
              value={assignEpf} 
              employees={employees}
              onChange={(epf) => setAssignEpf(epf)}
              placeholder="Select employee..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Target Plant / Customer *</label>
            <select
              value={assignPlant}
              onChange={e => setAssignPlant(e.target.value)}
              className="w-full form-input text-xs"
            >
              <option value="">Select Plant to Assign</option>
              {plants.map(p => (
                <option key={p.code} value={p.code + ' (' + p.name + ')'}>
                  {p.code} - {p.name} {p.profitCenter ? ' [' + p.profitCenter + ']' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Effective / Transfer Date</label>
            <input
              type="date"
              value={assignDate}
              onChange={e => setAssignDate(e.target.value)}
              className="w-full form-input text-xs"
            />
          </div>

          <div>
            <button
              type="button"
              disabled={assigning || !assignEpf || !assignPlant}
              onClick={handleSaveAssignment}
              className="w-full bg-[#2F6F5E] hover:bg-[#25584a] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Save size={16} />
              <span>{assigning ? 'Saving...' : 'Save Plant Assignment'}</span>
            </button>
          </div>
        </div>

        {selectedAssignEmp && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Current Assigned Plant:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                {selectedAssignEmp.plantCode ? (plants.find(p => p.code === selectedAssignEmp.plantCode)?.name ? `${selectedAssignEmp.plantCode} - ${plants.find(p => p.code === selectedAssignEmp.plantCode)?.name}` : selectedAssignEmp.plantCode) : 'No Plant Assigned'}
              </span>
            </div>

            {selectedEmpTransfers.length > 0 && (
              <div className="flex items-center gap-2 text-slate-600">
                <History size={14} className="text-teal-600" />
                <span>Previous Movements ({selectedEmpTransfers.length}):</span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-md">
                  {selectedEmpTransfers.map(t => `${t.transferDate}: ${t.toPlant}`).join(' | ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Transfers Logged</span>
            <strong className="block text-2xl text-slate-800 font-bold mt-0.5">{totalTransfers}</strong>
          </div>
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <ArrowRightLeft size={20} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Active Cross-Plant Staff</span>
            <strong className="block text-2xl text-amber-600 font-bold mt-0.5">{activeAssignments}</strong>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Support Days Worked</span>
            <strong className="block text-2xl text-blue-600 font-bold mt-0.5">{totalDaysWorked} <span className="text-xs text-slate-500 font-normal">days</span></strong>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Completed Transfers</span>
            <strong className="block text-2xl text-emerald-600 font-bold mt-0.5">{completedTransfers}</strong>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={'px-3 py-1.5 rounded-lg text-xs font-medium transition ' + (statusFilter === 'ALL' ? 'bg-[#2F6F5E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          All Transfers ({totalTransfers})
        </button>
        <button
          onClick={() => setStatusFilter('Active')}
          className={'px-3 py-1.5 rounded-lg text-xs font-medium transition ' + (statusFilter === 'Active' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          Active Assignments ({activeAssignments})
        </button>
        <button
          onClick={() => setStatusFilter('Completed')}
          className={'px-3 py-1.5 rounded-lg text-xs font-medium transition ' + (statusFilter === 'Completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          Completed ({completedTransfers})
        </button>
      </div>

      {/* Transfers DataTable */}
      <DataTable
        columns={[
          { key: 'employee', label: 'Employee' },
          { key: 'transferDate', label: 'Transfer Date' },
          { key: 'plantRoute', label: 'Plant Movement (From → To)' },
          { key: 'duration', label: 'Days Worked' },
          { key: 'profitCenter', label: 'Profit Center' },
          { key: 'statusBadge', label: 'Status' },
          { key: 'workDetails', label: 'Work Details / Remarks' },
          { key: 'id', label: 'Actions' }
        ]}
        data={tableData}
        onEdit={(id) => {
          const item = transfers.find(t => t.id === id);
          if (item) handleOpenEdit(item);
        }}
        onDelete={(id) => setConfirmDelete(id)}
      />

      {/* Create / Edit Modal */}
      <Modal 
        title={editingId ? 'Edit Plant Transfer Record' : 'Log New Plant Transfer'} 
        open={open} 
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col space-y-4">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Employee *</label>
              <SearchableEmployeeSelect 
                value={form.epfNo} 
                employees={employees}
                onChange={(epf) => handleEmployeeSelect(epf)} 
              />
              {errors.epfNo && <p className="text-xs text-red-500">{errors.epfNo}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Home / Base Plant</label>
                <input
                  value={form.fromPlant || ''}
                  readOnly
                  className="mt-1 w-full form-input bg-slate-100 text-slate-700 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Transferred Destination Plant *</label>
                <select
                  value={form.toPlant || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const selectedPlant = plants.find(p => val.startsWith(p.code));
                    setForm(prev => ({
                      ...prev,
                      toPlant: val,
                      profitCenter: selectedPlant?.profitCenter || prev.profitCenter
                    }));
                    if (errors.toPlant) setErrors(prev => ({ ...prev, toPlant: undefined }));
                  }}
                  className={'mt-1 w-full form-input text-xs ' + (errors.toPlant ? 'border-red-300 ring-2 ring-red-100' : '')}
                >
                  <option value="">Select destination plant</option>
                  {plants.map(p => (
                    <option key={p.code} value={p.code + ' (' + p.name + ')'}>
                      {p.code} - {p.name} {p.profitCenter ? ' [' + p.profitCenter + ']' : ''}
                    </option>
                  ))}
                </select>
                {errors.toPlant && <p className="text-xs text-red-500">{errors.toPlant}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Profit Center</label>
                <select
                  value={form.profitCenter || ''}
                  onChange={e => setForm(prev => ({ ...prev, profitCenter: e.target.value }))}
                  className="mt-1 w-full form-input text-xs"
                >
                  <option value="">Select Profit Center</option>
                  {PROFIT_CENTERS.map(pc => (
                    <option key={pc} value={pc}>{pc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Transfer Type</label>
                <select
                  value={form.transferType || 'Temporary Support'}
                  onChange={e => setForm(prev => ({ ...prev, transferType: e.target.value as any }))}
                  className="mt-1 w-full form-input text-xs"
                >
                  <option value="Temporary Support">Temporary Support</option>
                  <option value="Permanent Transfer">Permanent Transfer</option>
                  <option value="Special Project">Special Project</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Transfer Date *</label>
                <input
                  type="date"
                  value={form.transferDate || ''}
                  onChange={e => {
                    setForm(prev => ({ ...prev, transferDate: e.target.value }));
                    if (errors.transferDate) setErrors(prev => ({ ...prev, transferDate: undefined }));
                  }}
                  className={'mt-1 w-full form-input text-xs ' + (errors.transferDate ? 'border-red-300 ring-2 ring-red-100' : '')}
                />
                {errors.transferDate && <p className="text-xs text-red-500">{errors.transferDate}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">End Date (Optional)</label>
                <input
                  type="date"
                  value={form.endDate || ''}
                  onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1 w-full form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Days Worked</label>
                <NumericInput
                  integer
                  value={form.daysWorked || 1}
                  onChange={e => setForm(prev => ({ ...prev, daysWorked: Number(e.target.value) || 1 }))}
                  className="mt-1 w-full form-input text-xs mono-numeric"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                value={form.status || 'Active'}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                className="mt-1 w-full form-input text-xs"
              >
                <option value="Active">Active (Currently Roaming / Supporting)</option>
                <option value="Completed">Completed (Returned to Home Plant)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Work Details / Scope of Assignment</label>
              <textarea
                rows={3}
                value={form.workDetails || ''}
                onChange={e => setForm(prev => ({ ...prev, workDetails: e.target.value }))}
                placeholder="Detail reasons, tasks, machinery worked on, or project deliverables..."
                className="mt-1 w-full form-input text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0 bg-white">
            <button 
              type="button" 
              onClick={() => setOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-[#2F6F5E] hover:bg-[#25584a] text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 transition"
            >
              <Save size={16} />
              <span>{editingId ? 'Update Transfer' : 'Save Transfer Record'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Plant Transfer Record"
        message="Are you sure you want to delete this plant transfer log entry?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
