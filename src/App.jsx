import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { CatalogueProvider } from './context/CatalogueContext'
import { InventoryProvider } from './context/InventoryContext'
import Login from './pages/Login'
import ForceChangePassword from './pages/ForceChangePassword'
import Dashboard, { Client, Devices, Location, Assigning, Delivery, GroundTeam, Makesets, Installation, Return } from './pages/dashboard'
import Movements from './pages/dashboard/Movements'
import SetHistory from './pages/dashboard/SetHistory'
import SuperAdmin from './pages/superadmin/SuperAdmin'
import Requests from './pages/requests/Requests'
import Layout from './components/Layout'

// ─── Role constants — imported from dedicated config (keeps this file Fast Refresh compatible)
import { ROLES, normaliseRole, hasRole } from './config/roles.js'
export { ROLES, normaliseRole, hasRole }

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

  const handlePasswordChanged = () => {
    // Re-read user from localStorage (mustChangePassword now false)
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
    // Force password change wall — user cannot access anything else until done
    if (user.mustChangePassword) {
      return <Navigate to="/change-password-required" replace />
    }
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

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={user ? defaultRoute(user.role) : '/login'} replace />}
        />

        {/* Force change password — wall shown when mustChangePassword=true */}
        <Route
          path="/change-password-required"
          element={
            user
              ? <ForceChangePassword onSuccess={handlePasswordChanged} />
              : <Navigate to="/login" replace />
          }
        />

        {/* Protected shell */}
        <Route
          path="/"
          element={
            user ? (
              <CatalogueProvider>
                <InventoryProvider>
                  <Layout userRole={user.role} onLogout={handleLogout}>
                    <Outlet />
                  </Layout>
                </InventoryProvider>
              </CatalogueProvider>
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

          {/* ── Movements: all roles (ground team needs to track device moves) ── */}
          <Route path="dashboard/movements" element={<Movements userRole={user?.role} />} />
          <Route path="dashboard/set-history" element={<SetHistory userRole={user?.role} />} />

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