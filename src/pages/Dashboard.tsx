import React, { useEffect, useState } from 'react'
import { list as listEmployees } from '../mocks/employees'
import { list as listAttendance } from '../mocks/attendance'
import { list as listLeaves } from '../mocks/leaves'
import { list as listSections } from '../mocks/sections'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [employees, setEmployees] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])

  useEffect(()=>{ listEmployees().then(setEmployees); listAttendance().then(setAttendance); listLeaves().then(setLeaves); listSections().then(setSections) }, [])

  const totalEmployees = employees.length
  const today = new Date().toISOString().slice(0,10)
  const presentToday = attendance.filter(a=>a.dayIn === today).length
  const leavesThisMonth = leaves.filter(l=> l.start && l.start.startsWith(today.slice(0,7))).length
  const activeSections = sections.length

  // Recent activity: combine attendance and leaves by date
  const activity = [
    ...attendance.map(a=> ({type:'attendance', date: a.dayIn, text: `${a.epfNo} ${a.shift || ''} ${a.timeIn || ''}` })),
    ...leaves.map(l=> ({type:'leave', date: l.start, text: `${l.epfNo} ${l.leaveType} ${l.start}` }))
  ].sort((a,b)=> b.date.localeCompare(a.date)).slice(0,10)

  const bySection = sections.map(s => ({ name: s.name, count: employees.filter(e=>e.sectionCode===s.code).length }))

  const upcomingLeaves = leaves.filter(l => l.start >= today).slice(0,5).map(l => ({ ...l }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-flat">Total Employees<br /><strong>{totalEmployees}</strong></div>
        <div className="p-4 bg-white rounded-xl shadow-flat">Present Today<br /><strong>{presentToday}</strong></div>
        <div className="p-4 bg-white rounded-xl shadow-flat">Leaves This Month<br /><strong>{leavesThisMonth}</strong></div>
        <div className="p-4 bg-white rounded-xl shadow-flat">Active Sections<br /><strong>{activeSections}</strong></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 p-4 bg-white rounded-xl shadow-flat">
          <h4 className="font-semibold mb-2">Employees by Section</h4>
          <div style={{height:200}}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bySection}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2F6F5E" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Recent Activity</h4>
          <div className="space-y-2">
            {activity.map((a,idx)=> (
              <div key={idx} className="text-sm text-slate-700"><strong className="mono-numeric">{a.date}</strong> — {a.text}</div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-flat">
          <h4 className="font-semibold mb-2">Upcoming / Active Leaves</h4>
          <div className="space-y-2">
            {upcomingLeaves.length === 0 ? (<div className="text-sm text-slate-500">No upcoming leaves</div>) : upcomingLeaves.map(l=> (
              <div key={l.id} className="text-sm"><strong>{l.epfNo}</strong> — {l.leaveType} ({l.start} to {l.end})</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
