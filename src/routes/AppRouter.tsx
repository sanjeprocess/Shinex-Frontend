import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { getCurrentUser } from '../utils/permissions'

// Lazy-loaded pages
const Login = lazy(() => import('../pages/Login'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const EmployeesList = lazy(() => import('../pages/Employees/EmployeesList'))
const AttendancePage = lazy(() => import('../pages/Attendance/Attendance'))
const BusinessCentersPage = lazy(() => import('../pages/masters/BusinessCenters'))
const SectionsPage = lazy(() => import('../pages/masters/Sections'))
const AdditionsPage = lazy(() => import('../pages/masters/Additions'))
const DeductionsPage = lazy(() => import('../pages/masters/Deductions'))
const CustomersPage = lazy(() => import('../pages/masters/Customers'))
const BCardsPage = lazy(() => import('../pages/masters/BCardsPage'))

// Transaction pages
const EmployeeAdditions = lazy(() => import('../pages/Additions/EmployeeAdditions'))
const EmployeeDeductions = lazy(() => import('../pages/Deductions/EmployeeDeductions'))
const LeavesPage = lazy(() => import('../pages/Leave/Leaves'))
const LoansPage = lazy(() => import('../pages/Loans/LoansPage'))
const ReportsPage = lazy(() => import('../pages/Reports/ReportsPage'))
const EmployeeHistoryPage = lazy(() => import('../pages/Reports/EmployeeHistoryPage'))
const AuditLogPage = lazy(() => import('../pages/Audit/AuditLogPage'))
const AdminControlPage = lazy(() => import('../pages/Admin/AdminControlPage'))
const MonthlyBreakdown = lazy(() => import('../pages/Process/MonthlyBreakdown'))
const PlantTransfersPage = lazy(() => import('../pages/Process/PlantTransfers'))

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">Loading Page...</span>
    </div>
  </div>
)

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('hsb_auth_token')
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  return isAuthenticated && user && !user.isBlocked ? <>{children}</> : <Navigate to="/login" replace />
}

const SiteAccessRoute = ({ children }: { children: React.ReactNode }) => {
  return getCurrentUser().canViewSite ? <>{children}</> : <Navigate to="/" replace />
}

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const role = typeof window !== 'undefined' ? localStorage.getItem('hsb_user_role') : null
  const isSuperAdmin = role?.toUpperCase() === 'SUPERADMIN'
  return isSuperAdmin ? <>{children}</> : <Navigate to="/" replace />
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<SiteAccessRoute><EmployeesList /></SiteAccessRoute>} />
          <Route path="attendance" element={<SiteAccessRoute><AttendancePage /></SiteAccessRoute>} />

          {/* Transactions */}
          <Route path="employee-additions" element={<SiteAccessRoute><EmployeeAdditions /></SiteAccessRoute>} />
          <Route path="employee-deductions" element={<SiteAccessRoute><EmployeeDeductions /></SiteAccessRoute>} />
          <Route path="leaves" element={<SiteAccessRoute><LeavesPage /></SiteAccessRoute>} />
          <Route path="loans" element={<SiteAccessRoute><LoansPage /></SiteAccessRoute>} />
          <Route path="plant-transfers" element={<SiteAccessRoute><PlantTransfersPage /></SiteAccessRoute>} />
          <Route path="monthly-breakdown" element={<SiteAccessRoute><MonthlyBreakdown /></SiteAccessRoute>} />

          {/* Reports & Audit */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="employee-history" element={<EmployeeHistoryPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />

          {/* Superadmin Exclusive Route */}
          <Route
            path="admin-control"
            element={
              <SuperAdminRoute>
                <AdminControlPage />
              </SuperAdminRoute>
            }
          />

          {/* Masters */}
          <Route path="business-centers" element={<SiteAccessRoute><BusinessCentersPage /></SiteAccessRoute>} />
          <Route path="sections" element={<SiteAccessRoute><SectionsPage /></SiteAccessRoute>} />
          <Route path="bcards" element={<SiteAccessRoute><BCardsPage /></SiteAccessRoute>} />
          <Route path="additions" element={<SiteAccessRoute><AdditionsPage /></SiteAccessRoute>} />
          <Route path="deductions" element={<SiteAccessRoute><DeductionsPage /></SiteAccessRoute>} />
          <Route path="customers" element={<SiteAccessRoute><CustomersPage /></SiteAccessRoute>} />
        </Route>
      </Routes>
    </Suspense>
  )
}
