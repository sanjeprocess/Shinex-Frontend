import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  CalendarOff, 
  CreditCard, 
  Building2, 
  ArrowRightLeft, 
  ArrowUpRight, 
  Clock, 
  TrendingUp, 
  Activity, 
  Sun, 
  Moon, 
  Star, 
  Sunset,
  PlusCircle,
  FileText,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { list as listEmployees } from '../mocks/employees';
import { list as listAttendance } from '../mocks/attendance';
import { list as listLeaves } from '../mocks/leaves';
import { list as listSections } from '../mocks/sections';
import { list as listLoans } from '../mocks/loans';
import { list as listTransfers, PlantTransfer } from '../mocks/plantTransfers';
import { list as listPlants } from '../mocks/customers';

export default function Dashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<PlantTransfer[]>([]);
  const [plants, setPlants] = useState<any[]>([]);

  function loadDashboardData() {
    const activeBc = localStorage.getItem('hsb_active_bc') || '';
    const cleanBc = activeBc ? activeBc.split(' / ')[0].trim() : '';

    listEmployees(cleanBc).then(setEmployees).catch(() => {});
    listAttendance(cleanBc).then(setAttendance).catch(() => {});
    listLeaves(cleanBc).then(setLeaves).catch(() => {});
    listSections(cleanBc).then(setSections).catch(() => {});
    listLoans(cleanBc).then(setLoans).catch(() => {});
    listTransfers(cleanBc).then(setTransfers).catch(() => {});
    listPlants(cleanBc).then(setPlants).catch(() => {});
  }

  useEffect(() => {
    loadDashboardData();
    const handleBc = () => loadDashboardData();
    window.addEventListener('hsb_bc_change', handleBc);
    window.addEventListener('storage', handleBc);
    return () => {
      window.removeEventListener('hsb_bc_change', handleBc);
      window.removeEventListener('storage', handleBc);
    };
  }, []);

  const totalEmployees = employees.length;
  const today = new Date().toISOString().slice(0, 10);
  const presentTodayRecords = attendance.filter(a => a.dayIn === today);
  const presentToday = presentTodayRecords.length;
  const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
  
  const leavesThisMonth = leaves.filter(l => (l.start || l.leaveStartDate || '').startsWith(today.slice(0, 7))).length;
  const activeLoansCount = loans.length;
  const activeTransfers = transfers.filter(t => t.status === 'Active');

  // Shift Distribution from attendance
  const dayShifts = attendance.filter(a => a.dayShift === 'Y').length;
  const secondShifts = attendance.filter(a => a.secondShift === 'Y').length;
  const nightShifts = attendance.filter(a => a.nightShift === 'Y').length;
  const fullNightShifts = attendance.filter(a => a.fullNight === 'Y').length;

  const shiftData = [
    { name: 'Day Shift', value: dayShifts || 10, color: '#2F6F5E', icon: Sun },
    { name: '2nd Shift', value: secondShifts || 4, color: '#D97706', icon: Sunset },
    { name: 'Night Shift', value: nightShifts || 3, color: '#4F46E5', icon: Moon },
    { name: 'Full Night', value: fullNightShifts || 1, color: '#9333EA', icon: Star }
  ];

  const bySection = sections.map(s => ({
    name: s.name,
    count: employees.filter(e => e.sectionCode === s.code).length
  })).filter(s => s.count > 0 || sections.length <= 6);

  const upcomingLeaves = leaves
    .filter(l => (l.start || l.leaveStartDate || '') >= today)
    .slice(0, 4);

  const activeBc = localStorage.getItem('hsb_active_bc') || '001 / Main Operation';

  return (
    <div className="space-y-6 pb-8">
      {/* Modern Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#12161C] via-[#1E293B] to-[#134E4A] p-6 text-white shadow-md border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <ShieldCheck size={13} /> Live System Synchronized
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 text-xs font-medium border border-teal-500/30">
                <Building2 size={13} /> {activeBc}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Shinex HR & Operations Command Hub</h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl">
              Real-time enterprise workforce monitoring, cross-plant roaming deployments, attendance operations, and payroll analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/attendance"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <UserCheck size={15} />
              <span>Mark Attendance</span>
            </Link>
            <Link
              to="/plant-transfers"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <ArrowRightLeft size={15} />
              <span>Plant Transfers</span>
            </Link>
            <Link
              to="/employees"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-xs transition border border-white/10"
            >
              <Users size={15} />
              <span>Manage Staff</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Workforce */}
        <div className="p-4 bg-white rounded-2xl shadow-flat border border-slate-200 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Staff</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="block text-3xl font-extrabold text-slate-800 tracking-tight">{totalEmployees}</strong>
            <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium mt-1">
              <TrendingUp size={13} /> Active in selected center
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div className="p-4 bg-white rounded-2xl shadow-flat border border-slate-200 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Present Today</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="block text-3xl font-extrabold text-emerald-600 tracking-tight">{presentToday}</strong>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium mt-1">
              <span className="font-semibold">{attendanceRate}%</span> turnout rate
            </div>
          </div>
        </div>

        {/* Cross-Plant Roaming Transfers */}
        <div className="p-4 bg-white rounded-2xl shadow-flat border border-slate-200 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Plant Transfers</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowRightLeft size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="block text-3xl font-extrabold text-amber-600 tracking-tight">{activeTransfers.length}</strong>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mt-1">
              <Clock size={13} /> Active roaming staff
            </div>
          </div>
        </div>

        {/* Leaves This Month */}
        <div className="p-4 bg-white rounded-2xl shadow-flat border border-slate-200 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Leaves (Month)</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarOff size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="block text-3xl font-extrabold text-indigo-600 tracking-tight">{leavesThisMonth}</strong>
            <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium mt-1">
              <span className="font-semibold">{upcomingLeaves.length}</span> upcoming scheduled
            </div>
          </div>
        </div>

        {/* Active Loans */}
        <div className="p-4 bg-white rounded-2xl shadow-flat border border-slate-200 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Loans</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="block text-3xl font-extrabold text-blue-600 tracking-tight">{activeLoansCount}</strong>
            <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium mt-1">
              <span>Installments active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Section Distribution & Cross-Plant Live Roaming Widget */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Distribution */}
          <div className="p-5 bg-white rounded-2xl shadow-flat border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Department & Section Headcount</h3>
                <p className="text-xs text-slate-500">Employee allocation per operational division</p>
              </div>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                {sections.length} Active Sections
              </span>
            </div>

            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySection} barSize={28}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#5EEAD4' }}
                  />
                  <Bar dataKey="count" name="Staff Count" fill="#2F6F5E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cross-Plant Roaming & Transfers Active Feed */}
          <div className="p-5 bg-white rounded-2xl shadow-flat border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-teal-600" />
                  Active Cross-Plant Roaming Deployments
                </h3>
                <p className="text-xs text-slate-500">Employees temporarily supporting other plants and profit centers</p>
              </div>
              <Link
                to="/plant-transfers"
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                View all ({transfers.length}) <ChevronRight size={14} />
              </Link>
            </div>

            {activeTransfers.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <ArrowRightLeft size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-medium text-slate-600">No active cross-plant transfers currently logged</p>
                <Link to="/plant-transfers" className="text-xs text-teal-600 hover:underline font-semibold mt-1 inline-block">
                  + Log a plant transfer
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTransfers.slice(0, 4).map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs mono-numeric">{t.epfNo}</span>
                        <span className="font-semibold text-slate-700 text-xs">— {t.employeeName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          {t.transferType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="text-slate-600">{t.fromPlant || 'Base'}</span>
                        <span className="text-teal-600 font-bold">→</span>
                        <span className="font-semibold text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded">{t.toPlant}</span>
                        {t.profitCenter && <span className="text-[11px] text-slate-400">({t.profitCenter})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 mono-numeric">
                        {t.daysWorked} {t.daysWorked === 1 ? 'day' : 'days'}
                      </span>
                      <span className="text-[11px] text-slate-400">Since {t.transferDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Shift Distribution & Upcoming Leaves */}
        <div className="space-y-6">
          {/* Shift Distribution Cards */}
          <div className="p-5 bg-white rounded-2xl shadow-flat border border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm mb-1">Shift Operations Breakdown</h3>
            <p className="text-xs text-slate-500 mb-4">Current shift allocation</p>

            <div className="space-y-3">
              {shiftData.map((shift, idx) => {
                const Icon = shift.icon;
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: shift.color }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <strong className="block text-xs text-slate-800 font-bold">{shift.name}</strong>
                        <span className="text-[11px] text-slate-500">Assigned crew</span>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mono-numeric">{shift.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Leaves */}
          <div className="p-5 bg-white rounded-2xl shadow-flat border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Scheduled Leaves</h3>
              <Link to="/leaves" className="text-xs text-teal-600 hover:underline font-medium">View all</Link>
            </div>

            {upcomingLeaves.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No leaves currently scheduled for upcoming dates
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingLeaves.map(l => (
                  <div key={l.id} className="p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between transition">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-bold text-slate-800 mono-numeric">{l.epfNo}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          {l.leaveType}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {l.start || l.leaveStartDate} to {l.end || l.leaveEndDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
