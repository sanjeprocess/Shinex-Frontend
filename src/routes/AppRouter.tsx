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

// Transaction pages
import EmployeeAdditions from '../pages/Additions/EmployeeAdditions'
import EmployeeDeductions from '../pages/Deductions/EmployeeDeductions'
import LeavesPage from '../pages/Leave/Leaves'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Simple test-mode auth: check localStorage flag set by the Login page
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('hsb_test_auth')
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
        <Route path="employees" element={<EmployeesList />} />
        <Route path="attendance" element={<AttendancePage />} />

        {/* Transactions */}
        <Route path="employee-additions" element={<EmployeeAdditions />} />
        <Route path="employee-deductions" element={<EmployeeDeductions />} />
        <Route path="leaves" element={<LeavesPage />} />

        {/* Masters */}
        <Route path="business-centers" element={<BusinessCentersPage />} />
        <Route path="sections" element={<SectionsPage />} />
        <Route path="additions" element={<AdditionsPage />} />
        <Route path="deductions" element={<DeductionsPage />} />
        <Route path="customers" element={<CustomersPage />} />
      </Route>
    </Routes>
  )
}
