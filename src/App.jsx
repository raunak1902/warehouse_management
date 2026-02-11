import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { InventoryProvider } from './context/InventoryContext'
import Login from './pages/Login'
import Dashboard, { Client, Devices, Location, Assigning, Delivery, GroundTeam, Installation, Return } from './pages/dashboard'
import SuperAdmin from './pages/superadmin/SuperAdmin'
import Layout from './components/Layout'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    // Check if user is logged in (in real app, this would check token/localStorage)
    const auth = localStorage.getItem('isAuthenticated')
    const role = localStorage.getItem('userRole')
    if (auth === 'true') {
      setIsAuthenticated(true)
      setUserRole(role)
    }
  }, [])

  const handleLogin = (role) => {
    setIsAuthenticated(true)
    setUserRole(role)
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('userRole', role)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUserRole(null)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('userRole')
  }

  const ProtectedRoute = ({ children, requiredRole }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" />
    }
    if (requiredRole && userRole !== requiredRole && userRole !== 'SuperAdmin' && userRole !== 'Admin') {
      return <Navigate to="/dashboard" />
    }
    return children
  }

  return (
    <InventoryProvider>
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          } 
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout userRole={userRole} onLogout={handleLogout}>
                <Outlet />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route path="dashboard" element={<Dashboard userRole={userRole} />} />
          <Route path="dashboard/client" element={<Client />} />
          <Route path="dashboard/devices" element={<Devices />} />
          <Route path="dashboard/location" element={<Location />} />
          <Route path="dashboard/assigning" element={<Assigning />} />
          <Route path="dashboard/ground-team" element={<GroundTeam />} />
          <Route path="dashboard/delivery" element={<Delivery />} /> 
          <Route path="dashboard/installation" element={<Installation />} />
          <Route path="dashboard/return" element={<Return />} />
          <Route 
            path="super-admin" 
            element={
              <ProtectedRoute requiredRole="Admin">
                <SuperAdmin />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </Router>
    </InventoryProvider>
  )
}

export default App