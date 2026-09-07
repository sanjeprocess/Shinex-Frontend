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
import { getCurrentUser } from '../utils/permissions'

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
  )
}
