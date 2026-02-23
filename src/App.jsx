import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { InventoryProvider } from './context/InventoryContext'
import Login from './pages/Login'
import Dashboard, { Client, Devices, Location, Assigning, Delivery, GroundTeam, Makesets, Installation, Return } from './pages/dashboard'
import SuperAdmin from './pages/superadmin/SuperAdmin'
import Requests from './pages/requests/Requests'
import Layout from './components/Layout'

// ─── Role constants — single source of truth ─────────────────────────────────
export const ROLES = {
  SUPERADMIN: 'superadmin',
  MANAGER:    'manager',
  GROUNDTEAM: 'groundteam',
}

// Normalise role string from backend (removes spaces, lowercases)
export const normaliseRole = (role) => role?.toLowerCase().replace(/[\s_-]/g, '') ?? ''

// Check if user has one of the given roles
export const hasRole = (userRole, ...allowed) =>
  allowed.map(r => r.toLowerCase().replace(/[\s_-]/g, '')).includes(normaliseRole(userRole))

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    const handleAuthExpired = () => handleLogout()
    window.addEventListener('auth-expired', handleAuthExpired)
    return () => window.removeEventListener('auth-expired', handleAuthExpired)
  }, [])

  const handleLogin = () => {
    const storedUser = JSON.parse(localStorage.getItem('user'))
    setUser(storedUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // Where to send user after login based on role
  const defaultRoute = (role) => {
    if (hasRole(role, ROLES.GROUNDTEAM)) return '/requests'
    return '/dashboard'
  }

  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) return <Navigate to="/login" replace />
    if (allowedRoles && !hasRole(user.role, ...allowedRoles)) {
      return <Navigate to={defaultRoute(user.role)} replace />
    }
    return children
  }

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={user ? <Navigate to={defaultRoute(user.role)} replace /> : <Login onLogin={handleLogin} />}
        />

        {/* Protected shell */}
        <Route
          path="/"
          element={
            user ? (
              <InventoryProvider>
                <Layout userRole={user.role} onLogout={handleLogout}>
                  <Outlet />
                </Layout>
              </InventoryProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* ── Dashboard & admin features: SuperAdmin + Manager only ── */}
          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Dashboard userRole={user?.role} />
            </ProtectedRoute>
          } />
          <Route path="dashboard/client" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Client />
            </ProtectedRoute>
          } />
          <Route path="dashboard/location" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Location />
            </ProtectedRoute>
          } />
          <Route path="dashboard/delivery" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Delivery />
            </ProtectedRoute>
          } />
          <Route path="dashboard/ground-team" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <GroundTeam />
            </ProtectedRoute>
          } />
          <Route path="dashboard/installation" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Installation />
            </ProtectedRoute>
          } />
          <Route path="dashboard/return" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.MANAGER]}>
              <Return />
            </ProtectedRoute>
          } />

          {/* ── Devices, Sets, Assigning: all roles (GroundTeam sees request UI) ── */}
          <Route path="dashboard/devices" element={<Devices userRole={user?.role} />} />
          <Route path="dashboard/makesets" element={<Makesets userRole={user?.role} />} />
          <Route path="dashboard/assigning" element={<Assigning userRole={user?.role} />} />

          {/* ── Requests: all roles see this (different view per role) ── */}
          <Route path="requests" element={<Requests userRole={user?.role} />} />

          {/* ── SuperAdmin panel: SuperAdmin only ── */}
          <Route path="super-admin" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
              <SuperAdmin />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to={defaultRoute(user?.role)} replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App