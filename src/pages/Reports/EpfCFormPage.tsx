import React, { useState, useEffect } from 'react'
import A4Report, { A4ReportColumn } from '../../components/reports/A4Report'
import { list as listEmployees, Employee } from '../../mocks/employees'
import { list as listBC } from '../../mocks/businessCenters'
import { getMonthlySummary } from '../../mocks/monthlySummary'
import { formatCurrency } from '../../utils/reportHelpers'
import { Settings, X, Save } from 'lucide-react'

export interface EpfCompanySettings {
  companyName: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  addressLine4: string
  epfRegNo: string
  surcharge: string
  chequeNo: string
  bankName: string
  branchName: string
}

const DEFAULT_SETTINGS: EpfCompanySettings = {
  companyName: 'SHINEX HOUSE KEEPING SERVICES (PVT) LTD',
  addressLine1: 'NO:414',
  addressLine2: 'BATHALAHENAWATHTHA',
  addressLine3: 'GONAWALA',
  addressLine4: 'KELANIYA',
  epfRegNo: 'I/30466',
  surcharge: '',
  chequeNo: '',
  bankName: 'Commercial Bank',
  branchName: 'Kiribathgoda',
}

const SETTINGS_KEY = 'hsb_epf_company_settings'

function loadSettings(): EpfCompanySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: EpfCompanySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {}
}

export default function EpfCFormPage() {
  const [year, setYear] = useState<string>('2024')
  const [month, setMonth] = useState<string>('12')
  const [businessCenter, setBusinessCenter] = useState<string>(
    localStorage.getItem('hsb_active_bc') || 'ALL'
  )

  const [settings, setSettings] = useState<EpfCompanySettings>(loadSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [draftSettings, setDraftSettings] = useState<EpfCompanySettings>(settings)

  const [businessCenters, setBusinessCenters] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [isFallback, setIsFallback] = useState<boolean>(false)
  const [epfRows, setEpfRows] = useState<
    Array<{
      name: string
      nic: string
      epfNo: string
      earning: number
    }>
  >([])

  useEffect(() => {
    listBC()
      .then(setBusinessCenters)
      .catch(() => [])
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const cleanBc = businessCenter && businessCenter !== 'ALL' ? businessCenter.split(' / ')[0].trim() : ''
      const emps: Employee[] = await listEmployees(cleanBc).catch(() => [])

      if (emps.length > 0) {
        // Fetch earnings from monthly summary or basic salary for each employee
        const summaries = await Promise.all(
          emps.map(async emp => {
            try {
              const summary = await getMonthlySummary(emp.epfNo, year, month)
              const earning = summary.normalAmount || summary.grossSalary || emp.basicSalary || 18000
              const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.epfNo
              return {
                name: fullName,
                nic: emp.nicNo || '—',
                epfNo: emp.epfNo,
                earning,
              }
            } catch {
              const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.epfNo
              return {
                name: fullName,
                nic: emp.nicNo || '—',
                epfNo: emp.epfNo,
                earning: emp.basicSalary || 18000,
              }
            }
          })
        )
        setEpfRows(summaries)
        setIsFallback(false)
        return
      }

      // Default sample matching prototype
      const defaultRows = [
        { name: 'U D RAMYALATHA', nic: '196884504816', epfNo: '72', earning: 18060 },
        { name: 'D M CHANDRALATHA', nic: '707872381V', epfNo: '73', earning: 17640 },
        { name: 'W A PEMALATHA', nic: '196656304485', epfNo: '74', earning: 18900 },
        { name: 'W S WARNA MANEL', nic: '676960988V', epfNo: '76', earning: 18900 },
        { name: 'J B S WARNALATHA MENIKE', nic: '196373600930', epfNo: '78', earning: 12600 },
      ]
      setEpfRows(defaultRows)
      setIsFallback(true)
    } catch {
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalEarning = epfRows.reduce((a, b) => a + b.earning, 0)
  const total20 = Math.round(totalEarning * 0.2 * 100) / 100
  const employer12 = Math.round(totalEarning * 0.12 * 100) / 100
  const employee8 = Math.round(totalEarning * 0.08 * 100) / 100

  const surchargeVal = parseFloat(settings.surcharge) || 0
  const grandContributionVal = total20 + surchargeVal

  const columns: A4ReportColumn[] = [
    { header: 'EMPLOYEE NAME', align: 'left' },
    { header: 'N.I.C No', align: 'left' },
    { header: 'EPF NO', align: 'left' },
    { header: 'TOTAL 20%', align: 'right' },
    { header: 'EMPLOYER 12%', align: 'right' },
    { header: 'EMPLOYEE 8%', align: 'right' },
    { header: 'TOTAL EARNING', align: 'right' },
  ]

  const customHeaderRow = (
    <>
      <tr>
        <th rowSpan={2} style={{ verticalAlign: 'middle', textDecoration: 'none', fontWeight: 'bold' }}>
          EMPLOYEE NAME
        </th>
        <th rowSpan={2} style={{ verticalAlign: 'middle', textDecoration: 'none', fontWeight: 'bold' }}>
          N.I.C No
        </th>
        <th rowSpan={2} style={{ verticalAlign: 'middle', textDecoration: 'none', fontWeight: 'bold' }}>
          EPF NO
        </th>
        <th colSpan={3} style={{ textAlign: 'center', textDecoration: 'none', fontWeight: 'bold' }}>
          CONTRIBUTION (RS.)
        </th>
        <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'right', textDecoration: 'none', fontWeight: 'bold' }}>
          TOTAL EARNING
        </th>
      </tr>
      <tr>
        <th className="n" style={{ textDecoration: 'none', fontWeight: 'bold' }}>TOTAL 20%</th>
        <th className="n" style={{ textDecoration: 'none', fontWeight: 'bold' }}>EMPLOYER 12%</th>
        <th className="n" style={{ textDecoration: 'none', fontWeight: 'bold' }}>EMPLOYEE 8%</th>
      </tr>
    </>
  )

  const displayRows = epfRows.map(r => {
    const r20 = r.earning * 0.2
    const r12 = r.earning * 0.12
    const r8 = r.earning * 0.08
    return [
      r.name,
      r.nic,
      r.epfNo,
      formatCurrency(r20),
      formatCurrency(r12),
      formatCurrency(r8),
      formatCurrency(r.earning),
    ]
  })

  const totalRow = [
    <span key="gt" colSpan={3} style={{ fontWeight: 'bold' }}>Grand Total</span>,
    '',
    '',
    formatCurrency(total20),
    formatCurrency(employer12),
    formatCurrency(employee8),
    formatCurrency(totalEarning),
  ]

  const handleOpenSettings = () => {
    setDraftSettings(settings)
    setIsSettingsOpen(true)
  }

  const handleSaveSettings = () => {
    setSettings(draftSettings)
    saveSettings(draftSettings)
    setIsSettingsOpen(false)
  }

  const filterControls = (
    <>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Year:</label>
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Month:</label>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return (
              <option key={m} value={m}>
                {m}
              </option>
            )
          })}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Business Center:</label>
        <select
          value={businessCenter}
          onChange={e => setBusinessCenter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[170px]"
        >
          <option value="ALL">All Business Centers</option>
          {businessCenters.map((b: any) => (
            <option key={b.code || b.id} value={b.code}>
              {b.code} - {b.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleOpenSettings}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-300 shadow-sm"
      >
        <Settings className="w-3.5 h-3.5" />
        Company Settings
      </button>
    </>
  )

  const customTopBlock = () => (
    <div className="epf-boxes-container">
      {/* Top Left Company Box */}
      <div className="epf-company-box">
        <b>{settings.companyName}</b>
        <div>{settings.addressLine1}</div>
        <div>{settings.addressLine2}</div>
        <div>{settings.addressLine3}</div>
        <div>{settings.addressLine4}</div>
      </div>

      {/* Top Right EPF Details Table */}
      <table className="epf-kv-table">
        <tbody>
          <tr className="epf-kv-header">
            <td colSpan={2}>C FORM EPF Act NO:15 of 1958</td>
          </tr>
          <tr>
            <td>EPF Registration NO</td>
            <td className="epf-val">{settings.epfRegNo}</td>
          </tr>
          <tr>
            <td>Contribution For the Month of</td>
            <td className="epf-val">
              {year} / {month}
            </td>
          </tr>
          <tr>
            <td>Contribution</td>
            <td className="epf-val">{formatCurrency(total20)}</td>
          </tr>
          <tr>
            <td>Surcharge</td>
            <td className="epf-val">
              {surchargeVal > 0 ? formatCurrency(surchargeVal) : ''}
            </td>
          </tr>
          <tr>
            <td>Total Contribution</td>
            <td className="epf-val">{formatCurrency(grandContributionVal)}</td>
          </tr>
          <tr>
            <td>Chequ No:</td>
            <td className="epf-val">{settings.chequeNo}</td>
          </tr>
          <tr>
            <td>Bank Name : {settings.bankName}</td>
            <td className="epf-val"></td>
          </tr>
          <tr>
            <td>Branch Name : {settings.branchName}</td>
            <td className="epf-val"></td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <A4Report
        orientation="portrait"
        title="" // Top block serves as header
        columns={columns}
        customHeaderRow={customHeaderRow}
        rows={displayRows}
        totalRow={totalRow}
        customTopBlock={customTopBlock}
        rowsPerPage={22}
        isLoading={loading}
        isFallback={isFallback}
        filterControls={filterControls}
        onGenerate={loadData}
      />

      {/* Editable Company Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                EPF C Form Company Settings
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={draftSettings.companyName}
                  onChange={e => setDraftSettings({ ...draftSettings, companyName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={draftSettings.addressLine1}
                    onChange={e => setDraftSettings({ ...draftSettings, addressLine1: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={draftSettings.addressLine2}
                    onChange={e => setDraftSettings({ ...draftSettings, addressLine2: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Address Line 3</label>
                  <input
                    type="text"
                    value={draftSettings.addressLine3}
                    onChange={e => setDraftSettings({ ...draftSettings, addressLine3: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City / Line 4</label>
                  <input
                    type="text"
                    value={draftSettings.addressLine4}
                    onChange={e => setDraftSettings({ ...draftSettings, addressLine4: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">EPF Registration NO</label>
                  <input
                    type="text"
                    value={draftSettings.epfRegNo}
                    onChange={e => setDraftSettings({ ...draftSettings, epfRegNo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Surcharge (Rs.)</label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={draftSettings.surcharge}
                    onChange={e => setDraftSettings({ ...draftSettings, surcharge: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cheque No</label>
                  <input
                    type="text"
                    value={draftSettings.chequeNo}
                    onChange={e => setDraftSettings({ ...draftSettings, chequeNo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={draftSettings.bankName}
                    onChange={e => setDraftSettings({ ...draftSettings, bankName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={draftSettings.branchName}
                    onChange={e => setDraftSettings({ ...draftSettings, branchName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
