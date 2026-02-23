import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, LogOut, Menu, X, Users, Smartphone,
  MapPin, Link2, UsersRound, Wrench, RotateCcw, Truck, Layers, ChevronRight,
  ClipboardList, Shield,
} from 'lucide-react'
import { normaliseRole, ROLES } from '../App'

// Role badge colours
const ROLE_STYLES = {
  superadmin: { label: 'Super Admin', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  manager:    { label: 'Manager',     bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  groundteam: { label: 'Ground Team', bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
}

const getRoleStyle = (role) =>
  ROLE_STYLES[normaliseRole(role)] ?? { label: role, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }

const Layout = ({ userRole, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const role = normaliseRole(userRole)
  const roleStyle = getRoleStyle(userRole)

  const isSuperAdmin = role === ROLES.SUPERADMIN
  const isManager    = role === ROLES.MANAGER
  const isGroundTeam = role === ROLES.GROUNDTEAM
  const canManage    = isSuperAdmin || isManager   // approve requests, see dashboard

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  // ── Build nav items per role ──────────────────────────────────────────────
  const menuItems = [
    // Dashboard — managers & superadmin
    ...(canManage ? [{ path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] : []),

    // SuperAdmin panel — superadmin only
    ...(isSuperAdmin ? [{ path: '/super-admin', icon: Shield, label: 'Super Admin' }] : []),

    // Manager & SuperAdmin full nav
    ...(canManage ? [
      { path: '/dashboard/client',       icon: Users,      label: 'Client' },
      { path: '/dashboard/devices',      icon: Smartphone, label: 'Devices' },
      { path: '/dashboard/makesets',     icon: Layers,     label: 'Make Sets' },
      { path: '/dashboard/location',     icon: MapPin,     label: 'Location' },
      { path: '/dashboard/assigning',    icon: Link2,      label: 'Assigning' },
      { path: '/dashboard/delivery',     icon: Truck,      label: 'Delivery' },
      { path: '/dashboard/ground-team',  icon: UsersRound, label: 'Ground Team' },
      { path: '/dashboard/installation', icon: Wrench,     label: 'Installation' },
      { path: '/dashboard/return',       icon: RotateCcw,  label: 'Return' },
    ] : []),

    // Ground Team limited nav
    ...(isGroundTeam ? [
      { path: '/dashboard/devices',   icon: Smartphone, label: 'Devices' },
      { path: '/dashboard/makesets',  icon: Layers,     label: 'Make Sets' },
      { path: '/dashboard/assigning', icon: Link2,      label: 'Assigning' },
    ] : []),

    // Requests — everyone (label differs per role)
    {
      path: '/requests',
      icon: ClipboardList,
      label: canManage ? 'Requests' : 'My Requests',
      badge: canManage, // show badge indicator for pending requests
    },
  ]

  // Mobile bottom nav
  const bottomNavItems = canManage
    ? [
        { path: '/dashboard',         icon: LayoutDashboard, label: 'Home' },
        { path: '/dashboard/devices', icon: Smartphone,      label: 'Devices' },
        { path: '/dashboard/makesets',icon: Layers,          label: 'Sets' },
        { path: '/requests',          icon: ClipboardList,   label: 'Requests' },
        { path: '__menu__',           icon: Menu,            label: 'More' },
      ]
    : [
        { path: '/dashboard/devices',   icon: Smartphone,  label: 'Devices' },
        { path: '/dashboard/makesets',  icon: Layers,      label: 'Sets' },
        { path: '/dashboard/assigning', icon: Link2,       label: 'Assigning' },
        { path: '/requests',            icon: ClipboardList, label: 'My Requests' },
        { path: '__menu__',             icon: Menu,         label: 'More' },
      ]

  const isActive = (path) => location.pathname === path

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon
    const active = isActive(item.path)
    if (mobile) {
      return (
        <Link
          to={item.path}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            active ? 'bg-primary-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon size={20} className={active ? 'text-white' : 'text-gray-500'} />
          <span className="text-sm font-medium">{item.label}</span>
          {active && <ChevronRight size={16} className="ml-auto text-white/70" />}
        </Link>
      )
    }
    return (
      <Link
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
          active
            ? 'bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 font-medium shadow-sm'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon size={20} className={active ? 'text-primary-600' : ''} />
        <span>{item.label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-primary-400" />}
      </Link>
    )
  }

  return (
    <div className="flex h-screen bg-background-main">

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shadow-sm flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-xl text-primary-600">EDSignage</h1>
        </div>

        {/* Role badge */}
        <div className={`mx-3 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2 ${roleStyle.bg}`}>
          <div className={`w-2 h-2 rounded-full ${roleStyle.dot}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${roleStyle.text}`}>
            {roleStyle.label}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => <NavLink key={item.path} item={item} />)}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-800 text-sm">{userRole}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm"
          >
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Mobile slide-over sidebar ─────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col transform transition-transform duration-300 md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
          <h1 className="font-bold text-xl text-white">EDSignage</h1>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg bg-white/20 text-white">
            <X size={20} />
          </button>
        </div>
        <div className={`px-5 py-3 border-b flex items-center gap-2 ${roleStyle.bg}`}>
          <div className={`w-2 h-2 rounded-full ${roleStyle.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${roleStyle.text}`}>{roleStyle.label}</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {menuItems.map((item) => <NavLink key={item.path} item={item} mobile />)}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 font-medium"
          >
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-700 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <h1 className="font-bold text-lg text-primary-600">EDSignage</h1>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-lg flex safe-area-bottom">
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const isMenuButton = item.path === '__menu__'
          const active = !isMenuButton && isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => isMenuButton ? setSidebarOpen(true) : navigate(item.path)}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors ${active ? 'text-primary-600' : 'text-gray-400'}`}
            >
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />}
              <div className={`p-1 rounded-lg ${active ? 'bg-primary-50' : ''}`}>
                <Icon size={20} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default Layout