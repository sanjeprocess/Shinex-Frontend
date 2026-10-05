import React, { useEffect, useState } from 'react';
import { AdminUser, list, create, update, remove } from '../../mocks/admins';
import { list as listBC, BusinessCenter } from '../../mocks/businessCenters';
import { toast } from 'sonner';
import { getCurrentUser, isSuperAdmin, AdminPermissions, DEFAULT_MODULE_PERMISSIONS, SUPERADMIN_MODULE_PERMISSIONS } from '../../utils/permissions';
import { list as listEmployees } from '../../mocks/employees';
import {
  Shield, ShieldOff, Eye, EyeOff, Lock, Unlock, Users, Settings,
  Database, ClipboardList, FileText, BarChart2, ArrowRightLeft,
  Calendar, CreditCard, BookOpen, MinusCircle, PlusCircle, Crown, Ban
} from 'lucide-react';

type ModKey = keyof AdminPermissions['modules'];

const MODULE_GROUPS: { label: string; icon: React.ReactNode; color: string; modules: { key: ModKey; label: string }[] }[] = [
  {
    label: 'Transaction Data',
    icon: <Database size={14} />,
    color: 'blue',
    modules: [
      { key: 'employees',     label: 'Employees' },
      { key: 'attendance',    label: 'Attendance' },
      { key: 'leaves',        label: 'Leaves' },
      { key: 'loans',         label: 'Loans' },
      { key: 'additions',     label: 'Tx Additions' },
      { key: 'deductions',    label: 'Tx Deductions' },
      { key: 'plantTransfers',label: 'Plant Transfers' },
    ],
  },
  {
    label: 'Master Data',
    icon: <Settings size={14} />,
    color: 'purple',
    modules: [
      { key: 'masterSections',   label: 'Sections' },
      { key: 'masterCustomers',  label: 'Customers/Plants' },
      { key: 'masterBCenters',   label: 'Business Centers' },
      { key: 'masterAdditions',  label: 'Addition Types' },
      { key: 'masterDeductions', label: 'Deduction Types' },
    ],
  },
  {
    label: 'Reports & Process',
    icon: <BarChart2 size={14} />,
    color: 'emerald',
    modules: [
      { key: 'reports',    label: 'Reports' },
      { key: 'process',    label: 'Monthly Process' },
      { key: 'payAdvice',  label: 'Pay Advice' },
      { key: 'audit',      label: 'Audit Log' },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  blue:    'text-blue-400 bg-blue-500/10 border-blue-500/30',
  purple:  'text-purple-400 bg-purple-500/10 border-purple-500/30',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

function ModulePermissionGrid({
  perms,
  onChange,
  disabled
}: {
  perms: AdminPermissions['modules'];
  onChange: (next: AdminPermissions['modules']) => void;
  disabled: boolean;
}) {
  const toggle = (key: ModKey, field: 'view' | 'edit', val: boolean) => {
    const next = { ...perms, [key]: { ...perms[key], [field]: val } };
    // If hiding, also disable edit
    if (field === 'view' && !val) next[key].edit = false;
    // If enabling edit, ensure view is also enabled
    if (field === 'edit' && val) next[key].view = true;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {MODULE_GROUPS.map(group => (
        <div key={group.label} className={`border rounded-xl overflow-hidden border-slate-700/60`}>
          <div className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${COLOR_MAP[group.color]} border-b border-slate-700/60`}>
            {group.icon}
            {group.label}
          </div>
          <div className="divide-y divide-slate-700/40">
            {group.modules.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40 transition-colors">
                <span className={`text-sm font-medium ${!perms[key]?.view ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {label}
                </span>
                <div className="flex items-center gap-3">
                  {/* View toggle */}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(key, 'view', !perms[key]?.view)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      perms[key]?.view
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-slate-700/60 text-slate-500 border-slate-600/40 hover:bg-slate-700'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={perms[key]?.view ? 'Click to hide' : 'Click to show'}
                  >
                    {perms[key]?.view ? <Eye size={11} /> : <EyeOff size={11} />}
                    {perms[key]?.view ? 'Visible' : 'Hidden'}
                  </button>

                  {/* Edit toggle */}
                  <button
                    type="button"
                    disabled={disabled || !perms[key]?.view}
                    onClick={() => toggle(key, 'edit', !perms[key]?.edit)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      perms[key]?.edit
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                        : 'bg-slate-700/60 text-slate-400 border-slate-600/40 hover:bg-slate-700'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={perms[key]?.edit ? 'Click to make read-only' : 'Click to allow editing'}
                  >
                    {perms[key]?.edit ? <Unlock size={11} /> : <Lock size={11} />}
                    {perms[key]?.edit ? 'Edit' : 'Read-only'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Preset templates for quick assignment
const PRESETS: { label: string; desc: string; icon: React.ReactNode; modules: AdminPermissions['modules'] }[] = [
  {
    label: 'Full Access',
    desc: 'View & edit everything',
    icon: <Crown size={14} />,
    modules: { ...DEFAULT_MODULE_PERMISSIONS },
  },
  {
    label: 'Master Data Only',
    desc: 'Can only edit master tables, view-only on transactions',
    icon: <Database size={14} />,
    modules: {
      employees:        { view: true,  edit: false },
      attendance:       { view: true,  edit: false },
      leaves:           { view: true,  edit: false },
      loans:            { view: true,  edit: false },
      additions:        { view: true,  edit: false },
      deductions:       { view: true,  edit: false },
      plantTransfers:   { view: true,  edit: false },
      masterSections:   { view: true,  edit: true },
      masterCustomers:  { view: true,  edit: true },
      masterBCenters:   { view: true,  edit: true },
      masterAdditions:  { view: true,  edit: true },
      masterDeductions: { view: true,  edit: true },
      reports:          { view: true,  edit: false },
      process:          { view: false, edit: false },
      payAdvice:        { view: false, edit: false },
      audit:            { view: false, edit: false },
    },
  },
  {
    label: 'Transactions Only',
    desc: 'Can edit transactions, view-only on master data',
    icon: <ClipboardList size={14} />,
    modules: {
      employees:        { view: true,  edit: true },
      attendance:       { view: true,  edit: true },
      leaves:           { view: true,  edit: true },
      loans:            { view: true,  edit: true },
      additions:        { view: true,  edit: true },
      deductions:       { view: true,  edit: true },
      plantTransfers:   { view: true,  edit: true },
      masterSections:   { view: true,  edit: false },
      masterCustomers:  { view: true,  edit: false },
      masterBCenters:   { view: true,  edit: false },
      masterAdditions:  { view: true,  edit: false },
      masterDeductions: { view: true,  edit: false },
      reports:          { view: true,  edit: false },
      process:          { view: true,  edit: false },
      payAdvice:        { view: true,  edit: false },
      audit:            { view: false, edit: false },
    },
  },
  {
    label: 'View Only',
    desc: 'Read-only access across all modules',
    icon: <Eye size={14} />,
    modules: (() => {
      const m: any = {};
      Object.keys(DEFAULT_MODULE_PERMISSIONS).forEach(k => { m[k] = { view: true, edit: false }; });
      return m as AdminPermissions['modules'];
    })(),
  },
];

export default function AdminControlPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [centers, setCenters] = useState<BusinessCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formLoginName, setFormLoginName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN' | 'SUPERADMIN'>('ADMIN');
  const [formBC, setFormBC] = useState('ALL');
  const [formBlocked, setFormBlocked] = useState(false);
  const [formCanViewSite, setFormCanViewSite] = useState(true);
  const [formAccessLevel, setFormAccessLevel] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_WRITE');
  const [formCanManageUsers, setFormCanManageUsers] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formNicNumber, setFormNicNumber] = useState('');
  const [formModules, setFormModules] = useState<AdminPermissions['modules']>({ ...DEFAULT_MODULE_PERMISSIONS });
  const [employees, setEmployees] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'permissions'>('account');

  const canManageUsers = getCurrentUser().canManageUsers;
  const currentIsSuperAdmin = isSuperAdmin();

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminList, bcList] = await Promise.all([list(), listBC()]);
      setAdmins(adminList);
      setCenters(bcList);
    } catch {
      toast.error('Failed to load administrator accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    listEmployees().then(setEmployees);
  }, []);

  const resetForm = () => {
    setFormLoginName(''); setFormPassword(''); setFormFullName(''); setFormNicNumber('');
    setFormRole('ADMIN'); setFormBC('ALL'); setFormBlocked(false);
    setFormCanViewSite(true); setFormAccessLevel('READ_WRITE'); setFormCanManageUsers(false);
    setFormModules({ ...DEFAULT_MODULE_PERMISSIONS });
    setActiveTab('account');
  };

  const handleOpenCreate = () => {
    setEditingAdmin(null);
    resetForm();
    setFormBC(centers[0]?.code || 'ALL');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormLoginName(admin.loginName);
    setFormPassword('');
    setFormFullName(admin.fullName || '');
    setFormNicNumber(admin.nicNumber || '');
    setFormRole(admin.role);
    setFormBC(admin.clientBusinessCode || 'ALL');
    setFormBlocked(admin.isBlocked);
    setFormCanViewSite(admin.canViewSite);
    setFormAccessLevel(admin.accessLevel);
    setFormCanManageUsers(admin.canManageUsers);
    setFormModules(admin.modulePermissions ? { ...admin.modulePermissions } : { ...DEFAULT_MODULE_PERMISSIONS });
    setActiveTab('account');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLoginName.trim()) { toast.error('Username is required'); return; }
    if (!editingAdmin && !formFullName.trim()) { toast.error('Full Name is required'); return; }
    if (!editingAdmin && !formNicNumber.trim()) { toast.error('NIC Number is required'); return; }
    if (!editingAdmin && !formPassword.trim()) { toast.error('Password is required for new accounts'); return; }

    setSubmitting(true);
    try {
      const businessCode = formBC.split(' - ', 2)[0].trim();
      const isSA = formRole === 'SUPERADMIN';
      const modulePerms = isSA ? { ...SUPERADMIN_MODULE_PERMISSIONS } : formModules;

      if (editingAdmin) {
        await update(editingAdmin.loginName, {
          role: formRole, clientBusinessCode: businessCode,
          fullName: formFullName.trim(), nicNumber: formNicNumber.trim(),
          isBlocked: formBlocked, canViewSite: formCanViewSite,
          accessLevel: formAccessLevel, canManageUsers: formCanManageUsers,
          modulePermissions: modulePerms,
          password: formPassword.trim() ? formPassword.trim() : undefined
        });
        toast.success(`Administrator "${editingAdmin.loginName}" updated successfully`);
      } else {
        await create({
          loginName: formLoginName.trim(), password: formPassword.trim(),
          role: formRole, clientBusinessCode: businessCode,
          fullName: formFullName.trim(), nicNumber: formNicNumber.trim(),
          isBlocked: formBlocked, canViewSite: formCanViewSite,
          accessLevel: formAccessLevel, canManageUsers: formCanManageUsers,
          modulePermissions: modulePerms,
        });
        toast.success(`Administrator "${formLoginName}" created successfully`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Failed to save administrator';
      toast.error(typeof msg === 'string' ? msg : 'Error saving admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;
    if (deletingAdmin.loginName.toLowerCase() === 'superadmin') {
      toast.error('The primary superadmin account cannot be deleted');
      setDeletingAdmin(null); return;
    }
    try {
      await remove(deletingAdmin.loginName);
      toast.success(`Administrator "${deletingAdmin.loginName}" deleted`);
      setDeletingAdmin(null); loadData();
    } catch {
      toast.error('Failed to delete administrator');
    }
  };

  const filteredAdmins = admins.filter(a =>
    a.loginName.toLowerCase().includes(search.toLowerCase()) ||
    (a.clientBusinessCode && a.clientBusinessCode.toLowerCase().includes(search.toLowerCase())) ||
    a.role.toLowerCase().includes(search.toLowerCase()) ||
    (a.fullName && a.fullName.toLowerCase().includes(search.toLowerCase()))
  );

  const isPrimaryRoot = (admin: AdminUser) => admin.loginName.toLowerCase() === 'superadmin';
  const isSuperAdminForm = formRole === 'SUPERADMIN';

  // Permission summary badge helper
  const getPermSummary = (admin: AdminUser) => {
    if (admin.role === 'SUPERADMIN') return { label: 'Full Control', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' };
    if (admin.isBlocked) return { label: 'Blocked', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
    const mods = admin.modulePermissions || DEFAULT_MODULE_PERMISSIONS;
    const keys = Object.keys(mods) as ModKey[];
    const editCount = keys.filter(k => mods[k]?.edit).length;
    const viewCount = keys.filter(k => mods[k]?.view).length;
    if (editCount === keys.length) return { label: 'Full Edit', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' };
    if (editCount === 0 && viewCount === keys.length) return { label: 'View Only', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
    if (editCount === 0) return { label: 'Restricted View', color: 'text-rose-300 bg-rose-500/10 border-rose-500/20' };
    return { label: `${editCount} Edit / ${viewCount} View`, color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#17202A] via-[#1B2631] to-[#12161C] p-6 rounded-2xl border border-slate-700/60 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#3F9884]/20 rounded-xl border border-[#3F9884]/40">
            <Shield className="w-6 h-6 text-[#3F9884]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Control Panel</h1>
              {currentIsSuperAdmin && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Crown size={10} /> SUPER ADMIN
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">Manage administrator accounts, assign roles, and control per-module visibility & edit permissions.</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={!canManageUsers}
          className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#3F9884] text-white px-5 py-2.5 rounded-xl font-medium shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Users size={16} /> Add Administrator
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', val: admins.length, color: 'blue', icon: <Users size={20} /> },
          { label: 'Super Admins', val: admins.filter(a => a.role === 'SUPERADMIN').length, color: 'amber', icon: <Crown size={20} /> },
          { label: 'Active Admins', val: admins.filter(a => !a.isBlocked && a.role === 'ADMIN').length, color: 'emerald', icon: <Shield size={20} /> },
          { label: 'Blocked', val: admins.filter(a => a.isBlocked).length, color: 'rose', icon: <Ban size={20} /> },
        ].map(({ label, val, color, icon }) => (
          <div key={label} className="bg-[#1B2028] border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg border bg-${color}-500/10 text-${color}-400 border-${color}-500/20`}>{icon}</div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold">{label}</div>
              <div className={`text-2xl font-bold text-${color}-300`}>{val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Table */}
      <div className="bg-[#1B2028] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-700/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by username, name, role, or center..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#3F9884] focus:ring-1 focus:ring-[#3F9884]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{filteredAdmins.length}</span> of {admins.length} administrators
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#14181F] text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="px-6 py-4">Administrator</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Business Center</th>
                <th className="px-6 py-4">Access Level</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#3F9884] border-t-transparent rounded-full animate-spin" />
                    Loading administrators...
                  </div>
                </td></tr>
              ) : filteredAdmins.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  No administrator accounts match your search.
                </td></tr>
              ) : filteredAdmins.map(admin => {
                const isRoot = isPrimaryRoot(admin);
                const perm = getPermSummary(admin);
                return (
                  <tr key={admin.loginName} className="hover:bg-[#202732] transition-colors duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          admin.role === 'SUPERADMIN'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : admin.isBlocked
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {admin.loginName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2 flex-wrap">
                            {admin.loginName}
                            {isRoot && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">Primary Root</span>}
                            {admin.isBlocked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium flex items-center gap-1"><Ban size={9} />Blocked</span>}
                          </div>
                          <div className="text-xs text-slate-400">{admin.fullName || 'No full name'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {admin.role === 'SUPERADMIN' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Crown size={11} /> SUPERADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <Shield size={11} /> ADMIN
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-slate-200 font-medium text-sm">
                        {admin.clientBusinessCode || 'ALL'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${perm.color}`}>
                        {perm.label}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${admin.isBlocked ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {admin.isBlocked ? '🔴 Blocked' : '🟢 Active'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {admin.canViewSite ? <Eye size={10} className="inline mr-0.5" /> : <EyeOff size={10} className="inline mr-0.5" />}
                          {admin.canViewSite ? 'Site visible' : 'Site hidden'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {admin.canManageUsers ? '👥 Manage users' : 'No user mgmt'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(admin)}
                          disabled={!canManageUsers}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/60 hover:border-slate-600"
                          title="Edit Administrator"
                        >
                          <Settings size={12} /> Edit
                        </button>

                        {isRoot ? (
                          <span className="p-1.5 text-slate-500 cursor-not-allowed" title="Protected account">
                            <Lock size={14} />
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingAdmin(admin)}
                            disabled={!canManageUsers}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-rose-700/30 hover:border-rose-500/40"
                            title="Delete Administrator"
                          >
                            <Ban size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add / Edit Admin Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="flex flex-col bg-[#1a2332] text-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden" style={{ maxHeight: '92vh' }}>
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700/60 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {editingAdmin
                    ? <><Settings size={18} className="text-[#3F9884]" /> Edit: {editingAdmin.loginName}</>
                    : <><Users size={18} className="text-[#3F9884]" /> Add New Administrator</>}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Configure account details and granular module permissions</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">✕</button>
            </div>

            {/* Tab Bar */}
            <div className="flex shrink-0 border-b border-slate-700/60 px-6">
              {(['account', 'permissions'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? 'text-[#3F9884] border-[#3F9884]'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  {tab === 'account' ? '👤 Account Details' : '🔐 Module Permissions'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="min-h-0 flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

                {/* ── ACCOUNT TAB ── */}
                {activeTab === 'account' && (
                  <>
                    {/* Full Name + NIC */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Full Name *</label>
                        <input
                          type="text" autoComplete="off" placeholder="e.g. Sunil Perera"
                          value={formFullName}
                          onChange={e => { if (e.target.value && !/^[a-zA-Z\s.\-']+$/.test(e.target.value)) return; setFormFullName(e.target.value); }}
                          className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884] text-sm"
                          required={!editingAdmin}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">NIC Number *</label>
                        <input
                          type="text" autoComplete="off" placeholder="e.g. 199512345678"
                          value={formNicNumber}
                          onChange={e => {
                            setFormNicNumber(e.target.value);
                            const emp = employees.find(i => String(i.nicNo || '').trim().toLowerCase() === e.target.value.trim().toLowerCase());
                            if (emp) setFormFullName(`${emp.firstName || ''} ${emp.lastName || ''}`.trim());
                          }}
                          className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884] text-sm"
                          required={!editingAdmin}
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username (Login ID)</label>
                      <input
                        type="text" autoComplete="off" placeholder="e.g. admin_colombo"
                        value={formLoginName}
                        onChange={e => setFormLoginName(e.target.value)}
                        disabled={!!editingAdmin}
                        className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white disabled:opacity-60 focus:outline-none focus:border-[#3F9884] text-sm"
                        required
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        {editingAdmin ? 'New Password (leave blank to keep current)' : 'Password *'}
                      </label>
                      <input
                        type="password" autoComplete="new-password"
                        value={formPassword}
                        onChange={e => setFormPassword(e.target.value)}
                        placeholder={editingAdmin ? '••••••••' : 'Enter password'}
                        className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884] text-sm"
                        required={!editingAdmin}
                      />
                    </div>

                    {/* Role + BC */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">System Role</label>
                        <select
                          value={formRole}
                          onChange={e => {
                            const r = e.target.value as 'ADMIN' | 'SUPERADMIN';
                            setFormRole(r);
                            if (r === 'SUPERADMIN') {
                              setFormModules({ ...SUPERADMIN_MODULE_PERMISSIONS });
                              setFormCanManageUsers(true);
                              setFormAccessLevel('READ_WRITE');
                              setFormCanViewSite(true);
                            }
                          }}
                          disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'}
                          className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white disabled:opacity-60 focus:outline-none focus:border-[#3F9884] text-sm"
                        >
                          <option value="ADMIN">ADMIN — Standard</option>
                          <option value="SUPERADMIN">SUPERADMIN — Full Control</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Assigned Business Center</label>
                        <select
                          value={formBC}
                          onChange={e => setFormBC(e.target.value)}
                          className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884] text-sm"
                        >
                          <option value="ALL">ALL — All Business Centers</option>
                          {centers.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Account Flags */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Block Account */}
                      <button
                        type="button"
                        disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin' || isSuperAdminForm}
                        onClick={() => setFormBlocked(b => !b)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          formBlocked
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:border-slate-600'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span className="flex items-center gap-2">
                          {formBlocked ? <ShieldOff size={15} /> : <Shield size={15} />}
                          Block Account
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${formBlocked ? 'bg-rose-500/30' : 'bg-slate-700'}`}>
                          {formBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </button>

                      {/* Site Visibility */}
                      <button
                        type="button"
                        disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin' || isSuperAdminForm}
                        onClick={() => setFormCanViewSite(v => !v)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          formCanViewSite
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span className="flex items-center gap-2">
                          {formCanViewSite ? <Eye size={15} /> : <EyeOff size={15} />}
                          Site Visibility
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${formCanViewSite ? 'bg-emerald-500/30' : 'bg-slate-700'}`}>
                          {formCanViewSite ? 'Visible' : 'Hidden'}
                        </span>
                      </button>

                      {/* Manage Users */}
                      <button
                        type="button"
                        disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin' || isSuperAdminForm}
                        onClick={() => setFormCanManageUsers(v => !v)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          formCanManageUsers
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:border-blue-500/50'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span className="flex items-center gap-2">
                          <Users size={15} />
                          Manage Users
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${formCanManageUsers ? 'bg-blue-500/30' : 'bg-slate-700'}`}>
                          {formCanManageUsers ? 'Allowed' : 'Denied'}
                        </span>
                      </button>

                      {/* Access Level */}
                      <button
                        type="button"
                        disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin' || isSuperAdminForm}
                        onClick={() => setFormAccessLevel(a => a === 'READ_WRITE' ? 'READ_ONLY' : 'READ_WRITE')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          formAccessLevel === 'READ_WRITE'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:border-amber-500/50'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span className="flex items-center gap-2">
                          {formAccessLevel === 'READ_WRITE' ? <Unlock size={15} /> : <Lock size={15} />}
                          Global Access
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${formAccessLevel === 'READ_WRITE' ? 'bg-amber-500/30' : 'bg-slate-700'}`}>
                          {formAccessLevel === 'READ_WRITE' ? 'Edit' : 'Read-only'}
                        </span>
                      </button>
                    </div>

                    {isSuperAdminForm && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                        <Crown size={13} />
                        SUPERADMIN accounts automatically have full access to all modules and cannot be restricted.
                      </div>
                    )}
                  </>
                )}

                {/* ── PERMISSIONS TAB ── */}
                {activeTab === 'permissions' && (
                  <div className="space-y-5">
                    {/* Quick Presets */}
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Quick Presets</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PRESETS.map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={isSuperAdminForm}
                            onClick={() => setFormModules({ ...preset.modules })}
                            className="flex flex-col items-start px-3 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 hover:border-[#3F9884]/50 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200 mb-0.5">
                              {preset.icon} {preset.label}
                            </span>
                            <span className="text-[11px] text-slate-400 leading-tight">{preset.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {isSuperAdminForm ? (
                      <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
                        <Crown size={16} />
                        SUPERADMIN has unrestricted access to all modules. Module permissions cannot be modified.
                      </div>
                    ) : (
                      <ModulePermissionGrid
                        perms={formModules}
                        onChange={setFormModules}
                        disabled={isSuperAdminForm}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 flex justify-between items-center gap-3 px-6 py-4 border-t border-slate-700/60 bg-[#1a2332]">
                <div className="flex gap-2">
                  {activeTab === 'permissions' && (
                    <button type="button" onClick={() => setActiveTab('account')}
                      className="px-4 py-2.5 text-sm rounded-xl text-slate-300 hover:bg-slate-700/60 border border-slate-700 transition-colors">
                      ← Account
                    </button>
                  )}
                  {activeTab === 'account' && (
                    <button type="button" onClick={() => setActiveTab('permissions')}
                      className="px-4 py-2.5 text-sm rounded-xl text-[#3F9884] hover:bg-[#3F9884]/10 border border-[#3F9884]/40 transition-colors">
                      Module Permissions →
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-sm rounded-xl font-medium text-slate-300 hover:bg-slate-700/60 transition-colors border border-slate-700">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="px-6 py-2.5 text-sm rounded-xl font-semibold bg-[#2F6F5E] hover:bg-[#3F9884] text-white shadow-lg transition-all duration-200 disabled:opacity-60">
                    {submitting ? 'Saving...' : editingAdmin ? 'Save Changes' : 'Create Admin'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B2028] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
                <Ban size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Administrator</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete administrator account <span className="font-bold text-white">"{deletingAdmin.loginName}"</span>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeletingAdmin(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-700/60 border border-slate-700">Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg">Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
