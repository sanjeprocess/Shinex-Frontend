import React, { useEffect, useState } from 'react';
import { AdminUser, list, create, update, remove } from '../../mocks/admins';
import { list as listBC, BusinessCenter } from '../../mocks/businessCenters';
import { toast } from 'sonner';
import { getCurrentUser } from '../../utils/permissions';
import { list as listEmployees } from '../../mocks/employees';

export default function AdminControlPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [centers, setCenters] = useState<BusinessCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirm Modal
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null);
  const canManageUsers = getCurrentUser().canManageUsers;

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminList, bcList] = await Promise.all([list(), listBC()]);
      setAdmins(adminList);
      setCenters(bcList);
    } catch (err) {
      toast.error('Failed to load administrator accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    listEmployees().then(setEmployees);
  }, []);

  const handleOpenCreate = () => {
    setEditingAdmin(null);
    setFormLoginName('');
    setFormPassword('');
    setFormFullName('');
    setFormNicNumber('');
    setFormRole('ADMIN');
    setFormBC(centers[0]?.code || 'ALL');
    setFormBlocked(false); setFormCanViewSite(true); setFormAccessLevel('READ_WRITE'); setFormCanManageUsers(false);
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
    setFormBlocked(admin.isBlocked); setFormCanViewSite(admin.canViewSite); setFormAccessLevel(admin.accessLevel); setFormCanManageUsers(admin.canManageUsers);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLoginName.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!editingAdmin && !formFullName.trim()) { toast.error('Full Name is required'); return; }
    if (!editingAdmin && !formNicNumber.trim()) { toast.error('NIC Number is required'); return; }
    if (!editingAdmin && !formPassword.trim()) {
      toast.error('Password is required for new accounts');
      return;
    }

    setSubmitting(true);
    try {
      const businessCode = formBC.split(' - ', 2)[0].trim();
      if (editingAdmin) {
        await update(editingAdmin.loginName, {
          role: formRole,
          clientBusinessCode: businessCode,
          fullName: formFullName.trim(), nicNumber: formNicNumber.trim(),
          isBlocked: formBlocked, canViewSite: formCanViewSite, accessLevel: formAccessLevel, canManageUsers: formCanManageUsers,
          password: formPassword.trim() ? formPassword.trim() : undefined
        });
        toast.success(`Administrator "${editingAdmin.loginName}" updated successfully`);
      } else {
        await create({
          loginName: formLoginName.trim(),
          password: formPassword.trim(),
          role: formRole,
          clientBusinessCode: businessCode
          ,fullName: formFullName.trim(), nicNumber: formNicNumber.trim()
          ,isBlocked: formBlocked, canViewSite: formCanViewSite, accessLevel: formAccessLevel, canManageUsers: formCanManageUsers
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
      setDeletingAdmin(null);
      return;
    }
    try {
      await remove(deletingAdmin.loginName);
      toast.success(`Administrator "${deletingAdmin.loginName}" deleted`);
      setDeletingAdmin(null);
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete administrator');
    }
  };

  const filteredAdmins = admins.filter(a =>
    a.loginName.toLowerCase().includes(search.toLowerCase()) ||
    (a.clientBusinessCode && a.clientBusinessCode.toLowerCase().includes(search.toLowerCase())) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  const totalSuperAdmins = admins.filter(a => a.role === 'SUPERADMIN').length;
  const totalRegularAdmins = admins.filter(a => a.role === 'ADMIN').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#17202A] via-[#1B2631] to-[#12161C] p-6 rounded-2xl border border-slate-700/60 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#3F9884]/20 rounded-xl border border-[#3F9884]/40">
              <svg className="w-6 h-6 text-[#3F9884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Control Panel</h1>
              <p className="text-sm text-slate-400">Manage administrator accounts, assign access roles, and oversee business centers.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          disabled={!canManageUsers}
          className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#3F9884] text-white px-5 py-2.5 rounded-xl font-medium shadow-lg transition-all duration-200 hover:shadow-[#3F9884]/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Administrator
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1B2028] border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Total Accounts</div>
            <div className="text-2xl font-bold text-white">{admins.length}</div>
          </div>
        </div>

        <div className="bg-[#1B2028] border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Superadmins</div>
            <div className="text-2xl font-bold text-amber-300">{totalSuperAdmins}</div>
          </div>
        </div>

        <div className="bg-[#1B2028] border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Standard Admins</div>
            <div className="text-2xl font-bold text-emerald-400">{totalRegularAdmins}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-[#1B2028] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        {/* Search & Filter Bar */}
        <div className="p-5 border-b border-slate-700/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by username, role, or center..."
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#14181F] text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="px-6 py-4">Administrator Account</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Assigned Business Center</th>
                <th className="px-6 py-4">Permissions</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#3F9884] border-t-transparent rounded-full animate-spin"></div>
                      Loading administrators...
                    </div>
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No administrator accounts match your search.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map(admin => {
                  const isPrimarySuperAdmin = admin.loginName.toLowerCase() === 'superadmin';
                  return (
                    <tr key={admin.loginName} className="hover:bg-[#202732] transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            admin.role === 'SUPERADMIN'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {admin.loginName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {admin.loginName}
                              {isPrimarySuperAdmin && (
                                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 font-medium">
                                  Primary Root
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">Login ID: {admin.loginName}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <div className={admin.isBlocked ? 'text-rose-400' : 'text-emerald-400'}>{admin.isBlocked ? 'Blocked' : 'Active'}</div>
                        <div className="text-slate-400">{admin.canViewSite ? 'Site visible' : 'Site hidden'} · {admin.accessLevel === 'READ_WRITE' ? 'Edit' : 'Read only'}</div>
                        <div className="text-slate-500">{admin.canManageUsers ? 'User management' : 'No user management'}</div>
                      </td>

                      <td className="px-6 py-4">
                        {admin.role === 'SUPERADMIN' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 011.341 1.341l-.8 1.599L18.677 11H20a1 1 0 110 2h-1.323l-1.582 3.954.8 1.599a1 1 0 01-1.341 1.341l-1.599-.8L11 18.677V20a1 1 0 11-2 0v-1.323l-3.954-1.582-1.599.8a1 1 0 01-1.341-1.341l.8-1.599L1.323 13H0a1 1 0 110-2h1.323l1.582-3.954-.8-1.599a1 1 0 011.341-1.341l1.599.8L9 4.323V3a1 1 0 011-1zm0 5a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
                            </svg>
                            SUPERADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            ADMIN
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-slate-200 font-medium">
                          {admin.clientBusinessCode || 'ALL (Full Access)'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(admin)}
                            disabled={!canManageUsers}
                            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
                            title="Edit Administrator"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {isPrimarySuperAdmin ? (
                            <span className="p-1.5 text-slate-500 cursor-not-allowed" title="Protected account cannot be deleted">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </span>
                          ) : (
                            <button
                              onClick={() => setDeletingAdmin(admin)}
                              disabled={!canManageUsers}
                              className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-lg transition-colors"
                              title="Delete Administrator"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
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

      {/* Add / Edit Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-h-[85vh] flex flex-col bg-[#1e293b] text-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingAdmin ? `Edit Administrator: ${editingAdmin.loginName}` : 'Add New Administrator'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="min-h-0 flex flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4 smooth-scroll overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">FULL NAME *</label>
                  <input type="text" placeholder="e.g. Sunil Perera" value={formFullName} onChange={e => {
                    const value = e.target.value;
                    if (value && !/^[a-zA-Z\s.\-']+$/.test(value)) return;
                    setFormFullName(value);
                  }} autoComplete="off" className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884]" required={!editingAdmin} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">NIC NUMBER *</label>
                  <input type="text" placeholder="e.g. 199512345678 or 951234567V" value={formNicNumber} onChange={e => {
                    const value = e.target.value;
                    setFormNicNumber(value);
                    const employee = employees.find(item => String(item.nicNo || '').trim().toLowerCase() === value.trim().toLowerCase());
                    if (employee) setFormFullName(`${employee.firstName || ''} ${employee.lastName || ''}`.trim());
                  }} autoComplete="off" className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884]" required={!editingAdmin} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username (Login ID)</label>
                <input
                  type="text"
                 autoComplete="off"
                  value={formLoginName}
                  onChange={e => setFormLoginName(e.target.value)}
                  disabled={!!editingAdmin}
                  placeholder="e.g. admin_colombo"
                  className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white disabled:opacity-60 focus:outline-none focus:border-[#3F9884]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formBlocked} onChange={e => setFormBlocked(e.target.checked)} disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'} /> Block Account</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formCanViewSite} onChange={e => setFormCanViewSite(e.target.checked)} disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'} /> Site Visibility</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formCanManageUsers} onChange={e => setFormCanManageUsers(e.target.checked)} disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'} /> Manage Users</label>
                <label className="flex items-center gap-2">Access
                  <select value={formAccessLevel} onChange={e => setFormAccessLevel(e.target.value as 'READ_ONLY' | 'READ_WRITE')} disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'} className="bg-[#12161C] border border-slate-600 rounded px-2 py-1">
                    <option value="READ_ONLY">Read only</option><option value="READ_WRITE">Edit allowed</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  {editingAdmin ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                 autoComplete="new-password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder={editingAdmin ? '••••••••' : 'Enter password'}
                  className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884]"
                  required={!editingAdmin}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">System Role</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as any)}
                  disabled={editingAdmin?.loginName.toLowerCase() === 'superadmin'}
                  className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white disabled:opacity-60 focus:outline-none focus:border-[#3F9884]"
                >
                  <option value="ADMIN">ADMIN (Standard Admin Access)</option>
                  <option value="SUPERADMIN">SUPERADMIN (Full Access + Admin Control Tab)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Assigned Business Center</label>
                <select
                  value={formBC}
                  onChange={e => setFormBC(e.target.value)}
                  className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3F9884]"
                >
                  <option value="ALL">ALL (All Business Centers)</option>
                  {centers.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              </div>
              <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-700/60 bg-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm rounded-xl font-medium text-slate-300 hover:bg-slate-700/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl font-semibold bg-[#2F6F5E] hover:bg-[#3F9884] text-white shadow-lg transition-all duration-200 disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingAdmin ? 'Save Changes' : 'Create Admin'}
                </button>
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
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
              <button
                onClick={() => setDeletingAdmin(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-700/60"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
