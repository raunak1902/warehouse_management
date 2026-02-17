import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { InventoryProvider } from './context/InventoryContext'
import Login from './pages/Login'
import Dashboard, { Client, Devices, Location, Assigning, Delivery, GroundTeam, Installation, Return } from './pages/dashboard'
import SuperAdmin from './pages/superadmin/SuperAdmin'
import Layout from './components/Layout'

function App() {

  const [user, setUser] = useState(null)

  // ✅ On app load, check token
  useEffect(() => {
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")

    if (token && storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  // Add this new useEffect
useEffect(() => {
  const handleAuthExpired = () => {
    handleLogout()
  }

  window.addEventListener('auth-expired', handleAuthExpired)
  return () => window.removeEventListener('auth-expired', handleAuthExpired)
}, [])

  const handleLogin = (role) => {
    const storedUser = JSON.parse(localStorage.getItem("user"))
    setUser(storedUser)
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
  }

  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) {
      return <Navigate to="/login" />
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" />
    }

    return children
  }

  return (
    <Router>
      <Routes>

        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          } 
        />

        {/* Protected Layout - InventoryProvider only mounts AFTER login */}
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
              <Navigate to="/login" />
            )
          }
        >
          <Route path="dashboard" element={<Dashboard userRole={user?.role} />} />
          <Route path="dashboard/client" element={<Client />} />
          <Route path="dashboard/devices" element={<Devices />} />
          <Route path="dashboard/location" element={<Location />} />
          <Route path="dashboard/assigning" element={<Assigning />} />
          <Route path="dashboard/ground-team" element={<GroundTeam />} />
          <Route path="dashboard/delivery" element={<Delivery />} /> 
          <Route path="dashboard/installation" element={<Installation />} />
          <Route path="dashboard/return" element={<Return />} />

          {/* Role-Based Route */}
          <Route 
            path="super-admin" 
            element={
              <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
                <SuperAdmin />
              </ProtectedRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>

      </Routes>
    </Router>
  )
}

export default App