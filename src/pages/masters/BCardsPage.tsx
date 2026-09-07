import React, { useEffect, useState } from 'react';
import { BCardRecord, list, create, update, remove } from '../../mocks/bcards';
import { list as listEmployees } from '../../mocks/employees';
import { Employee } from '../../types/employee';
import { list as listBC, BusinessCenter } from '../../mocks/businessCenters';
import SearchableEmployeeSelect from '../../components/shared/SearchableEmployeeSelect';
import { toast } from 'sonner';

export default function BCardsPage() {
  const [bCards, setBCards] = useState<BCardRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centers, setCenters] = useState<BusinessCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<BCardRecord | null>(null);
  const [formEpf, setFormEpf] = useState('');
  const [formBC, setFormBC] = useState('001');

  // Stages
  const [formBFill, setFormBFill] = useState('Y');
  const [formBFillDate, setFormBFillDate] = useState('');
  const [formBReg, setFormBReg] = useState('N');
  const [formBRegDate, setFormBRegDate] = useState('');
  const [formBSign, setFormBSign] = useState('N');
  const [formBSignDate, setFormBSignDate] = useState('');
  const [formBIssue, setFormBIssue] = useState('N');
  const [formBIssueDate, setFormBIssueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deletingCard, setDeletingCard] = useState<BCardRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cardsData, empData, bcData] = await Promise.all([list(), listEmployees(), listBC()]);
      setBCards(cardsData);
      setEmployees(empData);
      setCenters(bcData);
    } catch {
      toast.error('Failed to load EPF B-Card records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingCard(null);
    setFormEpf('');
    setFormBC(centers[0]?.code || '001');
    setFormBFill('Y');
    setFormBFillDate(new Date().toISOString().split('T')[0]);
    setFormBReg('N');
    setFormBRegDate('');
    setFormBSign('N');
    setFormBSignDate('');
    setFormBIssue('N');
    setFormBIssueDate('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: BCardRecord) => {
    setEditingCard(card);
    setFormEpf(card.epfNo);
    setFormBC(card.businessCenter || '001');
    setFormBFill(card.bFill || 'N');
    setFormBFillDate(card.bFillDate || '');
    setFormBReg(card.bRegistered || 'N');
    setFormBRegDate(card.bRegDate || '');
    setFormBSign(card.bSign || 'N');
    setFormBSignDate(card.bSignDate || '');
    setFormBIssue(card.bIssue || 'N');
    setFormBIssueDate(card.bIssueDate || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEpf.trim()) {
      toast.error('Please select an employee');
      return;
    }

    setSubmitting(true);
    try {
      const record: BCardRecord = {
        epfNo: formEpf.trim(),
        bFill: formBFill,
        bFillDate: formBFillDate || undefined,
        bRegistered: formBReg,
        bRegDate: formBRegDate || undefined,
        bSign: formBSign,
        bSignDate: formBSignDate || undefined,
        bIssue: formBIssue,
        bIssueDate: formBIssueDate || undefined,
        businessCenter: formBC
      };

      if (editingCard) {
        await update(editingCard.epfNo, record);
        toast.success(`B-Card record for EPF #${editingCard.epfNo} updated`);
      } else {
        await create(record);
        toast.success(`B-Card record for EPF #${formEpf} created`);
      }
      setIsModalOpen(false);
      loadData();
    } catch {
      toast.error('Failed to save B-Card record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCard) return;
    try {
      await remove(deletingCard.epfNo);
      toast.success(`B-Card record for EPF #${deletingCard.epfNo} deleted`);
      setDeletingCard(null);
      loadData();
    } catch {
      toast.error('Failed to delete B-Card record');
    }
  };

  const getEmpName = (epf: string) => {
    const emp = employees.find(e => e.epfNo === epf);
    return emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : 'Unknown Employee';
  };

  const filteredCards = bCards.filter(c =>
    c.epfNo.toLowerCase().includes(search.toLowerCase()) ||
    getEmpName(c.epfNo).toLowerCase().includes(search.toLowerCase()) ||
    (c.businessCenter && c.businessCenter.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#17202A] via-[#1B2631] to-[#12161C] p-6 rounded-2xl border border-slate-700/60 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#3F9884]/20 rounded-xl border border-[#3F9884]/40">
              <svg className="w-6 h-6 text-[#3F9884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">EPF B-Card Management</h1>
              <p className="text-sm text-slate-400">Track and manage employee EPF B-Card registration, filling, signing, and issuance lifecycle.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-[#2F6F5E] hover:bg-[#3F9884] text-white px-5 py-2.5 rounded-xl font-medium shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Record New B-Card
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-[#1B2028] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-700/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by EPF or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#3F9884]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{filteredCards.length}</span> records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#14181F] text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Filled Status</th>
                <th className="px-6 py-4">Registered Status</th>
                <th className="px-6 py-4">Signed Status</th>
                <th className="px-6 py-4">Issued Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading B-Card records...</td>
                </tr>
              ) : filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No B-Card records found.</td>
                </tr>
              ) : (
                filteredCards.map(card => (
                  <tr key={card.epfNo} className="hover:bg-[#202732] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">EPF #{card.epfNo}</div>
                      <div className="text-xs text-[#3F9884]">{getEmpName(card.epfNo)}</div>
                    </td>

                    <td className="px-6 py-4">
                      {card.bFill === 'Y' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          ✓ Filled {card.bFillDate && `(${card.bFillDate})`}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {card.bRegistered === 'Y' ? (
                        <span className="inline-flex items-center gap-1 text-blue-400 font-medium text-xs bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                          ✓ Reg {card.bRegDate && `(${card.bRegDate})`}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {card.bSign === 'Y' ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-xs bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                          ✓ Signed {card.bSignDate && `(${card.bSignDate})`}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {card.bIssue === 'Y' ? (
                        <span className="inline-flex items-center gap-1 text-purple-400 font-medium text-xs bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                          ✓ Issued {card.bIssueDate && `(${card.bIssueDate})`}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(card)}
                          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
                          title="Edit B-Card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingCard(card)}
                          className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-lg transition-colors"
                          title="Delete B-Card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B2028] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {editingCard ? `Update B-Card — EPF #${editingCard.epfNo}` : 'Record Employee EPF B-Card'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Employee</label>
                {editingCard ? (
                  <input
                    type="text"
                    disabled
                    value={`EPF #${editingCard.epfNo} - ${getEmpName(editingCard.epfNo)}`}
                    className="w-full bg-[#12161C] border border-slate-600 rounded-xl px-4 py-2.5 text-white opacity-60"
                  />
                ) : (
                  <SearchableEmployeeSelect
                    value={formEpf}
                    onChange={(epf) => setFormEpf(epf || '')}
                    placeholder="Search employee by name or EPF..."
                  />
                )}
              </div>

              {/* Stages Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-[#12161C] p-3 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">B-Card Filled</label>
                    <select
                      value={formBFill}
                      onChange={e => setFormBFill(e.target.value)}
                      className="bg-[#1B2028] border border-slate-600 rounded-md px-2 py-1 text-xs text-white"
                    >
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>
                  {formBFill === 'Y' && (
                    <input
                      type="date"
                      value={formBFillDate}
                      onChange={e => setFormBFillDate(e.target.value)}
                      className="w-full bg-[#1B2028] border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  )}
                </div>

                <div className="bg-[#12161C] p-3 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">B-Card Registered</label>
                    <select
                      value={formBReg}
                      onChange={e => setFormBReg(e.target.value)}
                      className="bg-[#1B2028] border border-slate-600 rounded-md px-2 py-1 text-xs text-white"
                    >
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>
                  {formBReg === 'Y' && (
                    <input
                      type="date"
                      value={formBRegDate}
                      onChange={e => setFormBRegDate(e.target.value)}
                      className="w-full bg-[#1B2028] border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  )}
                </div>

                <div className="bg-[#12161C] p-3 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">B-Card Signed</label>
                    <select
                      value={formBSign}
                      onChange={e => setFormBSign(e.target.value)}
                      className="bg-[#1B2028] border border-slate-600 rounded-md px-2 py-1 text-xs text-white"
                    >
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>
                  {formBSign === 'Y' && (
                    <input
                      type="date"
                      value={formBSignDate}
                      onChange={e => setFormBSignDate(e.target.value)}
                      className="w-full bg-[#1B2028] border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  )}
                </div>

                <div className="bg-[#12161C] p-3 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">B-Card Issued</label>
                    <select
                      value={formBIssue}
                      onChange={e => setFormBIssue(e.target.value)}
                      className="bg-[#1B2028] border border-slate-600 rounded-md px-2 py-1 text-xs text-white"
                    >
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>
                  {formBIssue === 'Y' && (
                    <input
                      type="date"
                      value={formBIssueDate}
                      onChange={e => setFormBIssueDate(e.target.value)}
                      className="w-full bg-[#1B2028] border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-sm font-semibold bg-[#2F6F5E] hover:bg-[#3F9884] text-white rounded-xl shadow-lg disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingCard ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B2028] border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete B-Card Record</h3>
            <p className="text-sm text-slate-300">Are you sure you want to delete the EPF B-Card record for EPF #{deletingCard.epfNo}?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingCard(null)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-xl">Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
