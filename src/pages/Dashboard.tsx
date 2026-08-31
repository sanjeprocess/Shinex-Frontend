import React, { useEffect, useState } from 'react'
import { list as listEmployees } from '../mocks/employees'
import { list as listAttendance } from '../mocks/attendance'
import { list as listLeaves } from '../mocks/leaves'
import { list as listSections } from '../mocks/sections'
import { list as listLoans } from '../mocks/loans'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [employees, setEmployees] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [loans, setLoans] = useState<any[]>([])

  useEffect(() => {
    listEmployees().then(setEmployees)
    listAttendance().then(setAttendance)
    listLeaves().then(setLeaves)
    listSections().then(setSections)
    listLoans().then(setLoans)
  }, [])

  const totalEmployees = employees.length
  const today = new Date().toISOString().slice(0, 10)
  const presentToday = attendance.filter(a => a.dayIn === today).length
  const leavesThisMonth = leaves.filter(l => (l.start || l.leaveStartDate || '').startsWith(today.slice(0, 7))).length
  const activeLoansCount = loans.length

  const activity = [
    ...attendance.map(a => ({ type: 'attendance', date: a.dayIn || '', text: `${a.epfNo || ''} ${a.shift || ''} ${a.timeIn || ''}` })),
    ...leaves.map(l => ({ type: 'leave', date: l.start || l.leaveStartDate || '', text: `${l.epfNo || ''} ${l.leaveType || ''} ${l.start || l.leaveStartDate || ''}` }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10)

  const bySection = sections.map(s => ({ name: s.name, count: employees.filter(e => e.sectionCode === s.code).length }))

  const upcomingLeaves = leaves.filter(l => (l.start || l.leaveStartDate || '') >= today).slice(0, 5).map(l => ({ ...l }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Employees</span>
          <strong className="block text-2xl text-slate-800 font-bold mt-1">{totalEmployees}</strong>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Present Today</span>
          <strong className="block text-2xl text-emerald-600 font-bold mt-1">{presentToday}</strong>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Leaves This Month</span>
          <strong className="block text-2xl text-amber-600 font-bold mt-1">{leavesThisMonth}</strong>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Active Loans</span>
          <strong className="block text-2xl text-blue-600 font-bold mt-1">{activeLoansCount}</strong>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-flat border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Active Sections</span>
          <strong className="block text-2xl text-slate-800 font-bold mt-1">{sections.length}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 p-5 bg-white rounded-xl shadow-flat border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-3 text-sm">Employees by Section</h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bySection}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="Employee Count" fill="#2F6F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h4 className="font-semibold text-slate-800 mt-6 mb-3 text-sm">Recent Activity Log</h4>
          <div className="space-y-2">
            {activity.length === 0 ? (
              <div className="text-xs text-slate-500">No recent activity logged</div>
            ) : (
              activity.map((a, idx) => (
                <div key={idx} className="text-xs text-slate-700 p-2 bg-slate-50 rounded-lg flex items-center gap-2">
                  <strong className="mono-numeric text-slate-800">{a.date}</strong> — <span>{a.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl shadow-flat border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-3 text-sm">Upcoming / Active Leaves</h4>
          <div className="space-y-2">
            {upcomingLeaves.length === 0 ? (
              <div className="text-xs text-slate-500">No upcoming leaves</div>
            ) : (
              upcomingLeaves.map(l => (
                <div key={l.id} className="text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <strong className="text-slate-800">{l.epfNo}</strong> — <span className="font-semibold text-amber-700">{l.leaveType}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">{l.start || l.leaveStartDate} to {l.end || l.leaveEndDate}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
