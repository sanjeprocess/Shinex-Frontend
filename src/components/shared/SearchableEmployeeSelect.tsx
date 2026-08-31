import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { useQuery } from '@tanstack/react-query'
import { employees as fallbackEmployees } from '../../mocks/employees'
import { sections } from '../../mocks/sections'
import { customers } from '../../mocks/customers'
import type { Employee } from '../../types/employee'

type EmployeeContext = {
  epfNo: string
  employeeName: string
  sectionName: string
  plantName: string
  businessCenter: string
}

export default function SearchableEmployeeSelect({
  value,
  onChange,
  placeholder = 'Search employee by EPF or name'
}: {
  value?: string | null;
  onChange: (epf: string | null, context?: EmployeeContext) => void;
  placeholder?: string
}) {
  const { data: list = [], isLoading } = useQuery(['master', 'employees'], async () => {
    try {
      const res = await api.get('/master/employees')
      return res.data || []
    } catch (err) {
      return []
    }
  })

  const [q, setQ] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const employeeCatalog = useMemo(() => {
    const merged = [...fallbackEmployees, ...list]
    const map = new Map<string, Employee>()
    merged.forEach((employee: Employee) => {
      if (employee?.epfNo) {
        map.set(employee.epfNo, { ...map.get(employee.epfNo), ...employee })
      }
    })
    return Array.from(map.values())
  }, [list])

  const selectedEmployee = useMemo(
    () => employeeCatalog.find((employee: Employee) => employee.epfNo === value) || null,
    [employeeCatalog, value]
  )

  useEffect(() => {
    if (selectedEmployee) {
      setQ(`${selectedEmployee.epfNo} - ${selectedEmployee.firstName} ${selectedEmployee.lastName || ''}`.trim())
    } else if (!value) {
      setQ('')
    }
  }, [selectedEmployee, value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedContext = useMemo<EmployeeContext | undefined>(() => {
    if (!selectedEmployee) return undefined

    const sectionName = sections.find((section: any) => section.code === selectedEmployee.sectionCode)?.name || '—'
    const plantName = customers.find((customer: any) => customer.code === selectedEmployee.plantCode)?.name || '—'
    const employeeName = `${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim() || '—'
    const businessCenter = selectedEmployee.businessCenter || localStorage.getItem('hsb_active_bc') || '—'

    return {
      epfNo: selectedEmployee.epfNo,
      employeeName,
      sectionName,
      plantName,
      businessCenter
    }
  }, [selectedEmployee])

  const options = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return employeeCatalog
    return employeeCatalog.filter((employee: Employee) => (
      `${employee.epfNo} ${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase().includes(s)
    ))
  }, [employeeCatalog, q])

  const handleSelect = (employee: Employee | null) => {
    if (!employee) {
      setQ('')
      setIsOpen(false)
      onChange(null, undefined)
      return
    }

    const label = `${employee.epfNo} - ${employee.firstName} ${employee.lastName || ''}`.trim()
    setQ(label)
    setIsOpen(false)

    const context: EmployeeContext = {
      epfNo: employee.epfNo,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || '—',
      sectionName: sections.find((section: any) => section.code === employee.sectionCode)?.name || '—',
      plantName: customers.find((customer: any) => customer.code === employee.plantCode)?.name || '—',
      businessCenter: employee.businessCenter || localStorage.getItem('hsb_active_bc') || '—'
    }

    onChange(employee.epfNo, context)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={q}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQ(e.target.value)
            setIsOpen(true)
            if (!e.target.value) onChange(null, undefined)
          }}
          placeholder={placeholder}
          className="w-full form-input pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto overscroll-contain scroll-smooth divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-4 text-sm text-slate-500">Loading employees...</div>
            ) : options.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No employees found</div>
            ) : (
              options.map((employee: Employee) => (
                <button
                  key={employee.epfNo}
                  type="button"
                  onClick={() => handleSelect(employee)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${value === employee.epfNo ? 'bg-slate-100 font-semibold' : ''}`}
                >
                  <div className="text-sm font-medium text-slate-800">{employee.epfNo} - {employee.firstName} {employee.lastName || ''}</div>
                  <div className="text-[11px] text-slate-500">{employee.businessCenter || 'No BC'} | Plant: {employee.plantCode || 'N/A'}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedContext && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="font-medium text-slate-700">Name:</span> {selectedContext.employeeName}</span>
            <span><span className="font-medium text-slate-700">Section:</span> {selectedContext.sectionName}</span>
            <span><span className="font-medium text-slate-700">Plant:</span> {selectedContext.plantName}</span>
            <span><span className="font-medium text-slate-700">BC:</span> <span className="mono-numeric">{selectedContext.businessCenter}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}
