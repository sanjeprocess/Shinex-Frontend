import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import EmployeesList from '../pages/Employees/EmployeesList'
import AttendancePage from '../pages/Attendance/Attendance'
import BusinessCentersPage from '../pages/masters/BusinessCenters'
import SectionsPage from '../pages/masters/Sections'
import AdditionsPage from '../pages/masters/Additions'
import DeductionsPage from '../pages/masters/Deductions'
import CustomersPage from '../pages/masters/Customers'
import BCardsPage from '../pages/masters/BCardsPage'

// Transaction pages
import EmployeeAdditions from '../pages/Additions/EmployeeAdditions'
import EmployeeDeductions from '../pages/Deductions/EmployeeDeductions'
import LeavesPage from '../pages/Leave/Leaves'
import LoansPage from '../pages/Loans/LoansPage'
import ReportsPage from '../pages/Reports/ReportsPage'
import EmployeeHistoryPage from '../pages/Reports/EmployeeHistoryPage'
import AuditLogPage from '../pages/Audit/AuditLogPage'
import AdminControlPage from '../pages/Admin/AdminControlPage'
import MonthlyBreakdown from '../pages/Process/MonthlyBreakdown'
import PlantTransfersPage from '../pages/Process/PlantTransfers'
import { getCurrentUser, canViewModule, AdminPermissions } from '../utils/permissions'

type ModKey = keyof AdminPermissions['modules']

// ─── Route Guards ─────────────────────────────────────────────────────────────

/** Must be logged in and not blocked */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('hsb_auth_token')
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  return isAuthenticated && user && !user.isBlocked ? <>{children}</> : <Navigate to="/login" replace />
}

/** Module-level access guard — redirects to dashboard if the module is hidden for this user */
const ModuleRoute = ({
  children,
  mod,
}: {
  children: React.ReactNode
  mod: ModKey
}) => {
  const user = getCurrentUser()
  // SUPERADMIN always has access
  if (['SUPERADMIN', 'SUPER_ADMIN'].includes(user.role)) return <>{children}</>
  // Must be able to view the site AND the specific module
  if (!user.canViewSite || !canViewModule(mod)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

/** SUPERADMIN-only route */
const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const role = typeof window !== 'undefined' ? localStorage.getItem('hsb_user_role') : null
  return role?.toUpperCase() === 'SUPERADMIN' ? <>{children}</> : <Navigate to="/" replace />
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard — always accessible */}
        <Route index element={<Dashboard />} />

        {/* ── Transaction Data ── */}
        <Route path="employees"          element={<ModuleRoute mod="employees">    <EmployeesList />       </ModuleRoute>} />
        <Route path="attendance"         element={<ModuleRoute mod="attendance">   <AttendancePage />      </ModuleRoute>} />
        <Route path="employee-additions" element={<ModuleRoute mod="additions">    <EmployeeAdditions />   </ModuleRoute>} />
        <Route path="employee-deductions"element={<ModuleRoute mod="deductions">   <EmployeeDeductions />  </ModuleRoute>} />
        <Route path="leaves"             element={<ModuleRoute mod="leaves">       <LeavesPage />          </ModuleRoute>} />
        <Route path="loans"              element={<ModuleRoute mod="loans">        <LoansPage />           </ModuleRoute>} />
        <Route path="plant-transfers"    element={<ModuleRoute mod="plantTransfers"><PlantTransfersPage /> </ModuleRoute>} />

        {/* ── Process ── */}
        <Route path="monthly-breakdown"  element={<ModuleRoute mod="process">      <MonthlyBreakdown />    </ModuleRoute>} />

        {/* ── Reports ── */}
        <Route path="reports"            element={<ModuleRoute mod="reports">      <ReportsPage />         </ModuleRoute>} />
        <Route path="employee-history"   element={<ModuleRoute mod="payAdvice">    <EmployeeHistoryPage /> </ModuleRoute>} />
        <Route path="audit-logs"         element={<ModuleRoute mod="audit">        <AuditLogPage />        </ModuleRoute>} />

        {/* ── Master Data ── */}
        <Route path="business-centers"   element={<ModuleRoute mod="masterBCenters">  <BusinessCentersPage /> </ModuleRoute>} />
        <Route path="sections"           element={<ModuleRoute mod="masterSections">  <SectionsPage />        </ModuleRoute>} />
        <Route path="bcards"             element={<ModuleRoute mod="masterSections">  <BCardsPage />          </ModuleRoute>} />
        <Route path="additions"          element={<ModuleRoute mod="masterAdditions"> <AdditionsPage />       </ModuleRoute>} />
        <Route path="deductions"         element={<ModuleRoute mod="masterDeductions"><DeductionsPage />      </ModuleRoute>} />
        <Route path="customers"          element={<ModuleRoute mod="masterCustomers"> <CustomersPage />       </ModuleRoute>} />

        {/* ── Superadmin Only ── */}
        <Route
          path="admin-control"
          element={
            <SuperAdminRoute>
              <AdminControlPage />
            </SuperAdminRoute>
          }
        />
      </Route>
    </Routes>
  )
}
