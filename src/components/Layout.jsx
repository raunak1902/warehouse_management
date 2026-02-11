import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Menu,
  X,
  Users,
  Smartphone,
  MapPin,
  Link2,
  UsersRound,
  Wrench,
  RotateCcw,
  Truck
} from 'lucide-react'

const Layout = ({ userRole, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(userRole === 'SuperAdmin' || userRole === 'Admin' ? [
      { path: '/super-admin', icon: Settings, label: 'Super Admin' },
    ] : []),
    { path: '/dashboard/client', icon: Users, label: 'Client' },
    { path: '/dashboard/devices', icon: Smartphone, label: 'Devices' },
    { path: '/dashboard/location', icon: MapPin, label: 'Location' },
    { path: '/dashboard/assigning', icon: Link2, label: 'Assigning' },
    { path: '/dashboard/delivery', icon: Truck, label: 'Delivery' },
    { path: '/dashboard/ground-team', icon: UsersRound, label: 'Ground Team' },
    { path: '/dashboard/installation', icon: Wrench, label: 'Installation' },
    { path: '/dashboard/return', icon: RotateCcw, label: 'Return' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen bg-background-main">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className={`font-bold text-xl text-primary-600 ${!sidebarOpen && 'hidden'}`}>
            EDSignage
          </h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 font-medium shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={20} className={isActive(item.path) ? 'text-primary-600' : ''} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className={`mb-3 ${!sidebarOpen && 'hidden'}`}>
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-800">{userRole}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout