

import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'

export default function DataTable<T>({ columns, data, onEdit, onDelete }: { columns: { key: string; label: string; className?: string }[]; data: T[]; onEdit?: (id: any)=>void; onDelete?: (id: any)=>void }) {
  return (
    <div className="bg-white rounded-xl shadow-flat overflow-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr>
            {columns.map(c => <th key={c.key} className={`px-4 py-2 text-left ${c.className || ''}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td className="px-4 py-6 text-center" colSpan={columns.length}>No records</td></tr>
          ) : data.map((row: any, idx) => (
            <tr key={idx} className="row-hover hover:bg-slate-50">
              {columns.map(c => (
                <td key={c.key} className={`px-4 py-2 ${c.className || ''}`}>
                  {c.key === 'id' ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onEdit && onEdit(row[c.key])} title="Edit" className="p-1 text-slate-600 hover:text-[#3F9884] rounded">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => onDelete && onDelete(row[c.key])} title="Delete" className="p-1 text-slate-600 hover:text-[#B3462C] rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
