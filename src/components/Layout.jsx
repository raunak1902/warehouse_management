import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, LogOut, Menu, X, Users, Smartphone,
  MapPin, Link2, UsersRound, Wrench, RotateCcw, Truck, Layers, ChevronRight,
  ClipboardList, Shield, Bell, Clock, CheckCircle2, XCircle, ChevronRight as Arrow,
} from 'lucide-react'
import { normaliseRole, ROLES } from '../App'
import { STEP_META } from '../api/lifecycleRequestApi'
import { useSSENotifications } from '../hooks/useSSENotifications'
import NotificationToast from './NotificationToast'
import LoginBriefing from './LoginBriefing'

// ── Notification Bell ─────────────────────────────────────────────────────────
const API = '/api/lifecycle-requests'
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const NotificationBell = ({ userRole }) => {
  const role = normaliseRole(userRole)
  const canManage = role === ROLES.SUPERADMIN || role === ROLES.MANAGER
  const navigate = useNavigate()

  const [requests, setRequests]     = useState([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [animating, setAnimating]   = useState(false)
  const [prevCount, setPrevCount]   = useState(0)
  const dropdownRef                 = useRef(null)
  const bellRef                     = useRef(null)

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const pendingCount    = pendingRequests.length

  const fetchRequests = useCallback(async () => {
    if (!canManage) return
    try {
      setLoading(true)
      const res = await fetch(API, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setRequests(data)
      // Animate bell if new requests came in
      const newCount = data.filter(r => r.status === 'pending').length
      if (newCount > prevCount && prevCount !== 0) {
        setAnimating(true)
        setTimeout(() => setAnimating(false), 600)
      }
      setPrevCount(newCount)
    } catch (_) {}
    finally { setLoading(false) }
  }, [canManage, prevCount])

  // Poll every 30s
  useEffect(() => {
    if (!canManage) return
    fetchRequests()
    const id = setInterval(fetchRequests, 30000)
    return () => clearInterval(id)
  }, [canManage, fetchRequests])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!canManage) return null

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 60)   return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Step label/color resolved from STEP_META (lifecycle system)
  const getStepLabel = (step) => STEP_META[step]?.label ?? step ?? 'Request'
  const getStepEmoji = (step) => STEP_META[step]?.emoji ?? '📋'
  const getStepColor = (step) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-700', teal: 'bg-teal-100 text-teal-700',
      amber: 'bg-amber-100 text-amber-700', purple: 'bg-purple-100 text-purple-700',
      indigo: 'bg-indigo-100 text-indigo-700', green: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700', rose: 'bg-rose-100 text-rose-700',
      slate: 'bg-slate-100 text-slate-700', red: 'bg-red-100 text-red-700',
    }
    return colorMap[STEP_META[step]?.color] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => { setOpen(o => !o); if (!open) fetchRequests() }}
        className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all
          ${open ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
          ${animating ? 'animate-bounce' : ''}`}
        title="Pending Requests"
      >
        <Bell size={20} className={pendingCount > 0 ? 'text-primary-600' : ''} />

        {/* Badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white
            text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm
            ring-2 ring-white animate-pulse">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-primary-600" />
              <span className="font-semibold text-sm text-gray-800">Pending Requests</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/requests') }}
              className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1"
            >
              View all <Arrow size={12} />
            </button>
          </div>

          {/* Request list */}
          <div className="overflow-y-auto" style={{ maxHeight: '380px' }}>
            {loading && pendingRequests.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <CheckCircle2 size={32} className="mb-2 text-green-400" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs mt-0.5">No pending requests</p>
              </div>
            ) : (
              pendingRequests.map((req, i) => (
                <button
                  key={req.id}
                  onClick={() => { setOpen(false); navigate('/requests') }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    {/* Dot */}
                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getStepColor(req.toStep)}`}>
                          {getStepEmoji(req.toStep)} {getStepLabel(req.toStep)}
                        </span>
                        {(req.deviceId || req.setId) && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            #{req.deviceId || req.setId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {req.requestedBy?.name && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users size={10} />{req.requestedBy.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{timeAgo(req.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {pendingCount > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { setOpen(false); navigate('/requests') }}
                className="w-full py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                Review {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  // ── Real-time SSE notifications (managers + admins only) ───────────────────
  const { toasts, dismissToast } = useSSENotifications(canManage)

  // ── Subscription urgency badge on Return nav item ────────────────────────────
  // UPDATED SECTION - Uses new notification count endpoint
  const [subUrgentCount, setSubUrgentCount] = useState(0)
  const [subHighlightIds, setSubHighlightIds] = useState({ deviceIds: [], setIds: [] })
  
  const fetchSubscriptionCount = useCallback(async () => {
    if (!canManage) return
    try {
      const res = await fetch('/api/returns/notification-count', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) return
      const data = await res.json()
      setSubUrgentCount(data.count || 0)
      setSubHighlightIds({ deviceIds: data.deviceIds || [], setIds: data.setIds || [] })
    } catch (_) {}
  }, [canManage])

  useEffect(() => {
    if (!canManage) return
    fetchSubscriptionCount()
    // Re-check every 5 minutes
    const id = setInterval(fetchSubscriptionCount, 5 * 60 * 1000)
    
    // Listen for subscription updates (from Return page)
    const handleUpdate = () => fetchSubscriptionCount()
    window.addEventListener('subscription-updated', handleUpdate)
    
    return () => {
      clearInterval(id)
      window.removeEventListener('subscription-updated', handleUpdate)
    }
  }, [canManage, fetchSubscriptionCount])

  // ── Login briefing — show once per session when pending requests exist ──────
  const BRIEFING_KEY = 'edsignage_briefing_shown'
  const [showBriefing, setShowBriefing] = useState(() => {
    if (!canManage) return false
    const alreadyShown = sessionStorage.getItem(BRIEFING_KEY)
    if (!alreadyShown) {
      sessionStorage.setItem(BRIEFING_KEY, '1')
      return true
    }
    return false
  })
  const userName = (() => { try { return JSON.parse(localStorage.getItem('user'))?.name ?? '' } catch { return '' } })()

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
      { path: '/dashboard/return',       icon: RotateCcw,  label: 'Return', urgentCount: subUrgentCount, highlightIds: subHighlightIds },
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

  // UPDATED NavLink component - Makes Return badge clickable and adds shake animation
  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon
    const active = isActive(item.path)
    const hasUrgentBadge = item.urgentCount > 0

    const handleClick = (e) => {
      if (item.path === '/dashboard/return' && hasUrgentBadge) {
        e.preventDefault()
        const { deviceIds = [], setIds = [] } = item.highlightIds || {}
        const parts = [
          ...deviceIds.map(id => `device-${id}`),
          ...setIds.map(id => `set-${id}`),
        ]
        const highlightParam = parts.length > 0 ? parts.join(',') : 'all'
        navigate(`/dashboard/return?highlight=${highlightParam}`)
        if (mobile) setSidebarOpen(false)
      }
    }

    if (mobile) {
      return (
        <Link
          to={item.path}
          onClick={handleClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            active ? 'bg-primary-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon size={20} className={active ? 'text-white' : 'text-gray-500'} />
          <span className="text-sm font-medium flex-1">{item.label}</span>
          {hasUrgentBadge && !active && (
            <span className={`text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full
              ${item.urgentCount > 0 ? 'animate-shake' : ''}`}>
              {item.urgentCount}
            </span>
          )}
          {active && <ChevronRight size={16} className="ml-auto text-white/70" />}
        </Link>
      )
    }
    
    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
          active
            ? 'bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 font-medium shadow-sm'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon size={20} className={active ? 'text-primary-600' : ''} />
        <span className="flex-1">{item.label}</span>
        {hasUrgentBadge && !active && (
          <span className={`text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full ml-auto
            ${item.urgentCount > 0 ? 'animate-shake' : ''}`}>
            {item.urgentCount}
          </span>
        )}
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
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-30">
          <div className="text-sm text-gray-500 font-medium">
            Welcome back, <span className="text-gray-800 font-semibold">{userRole}</span>
          </div>
          <NotificationBell userRole={userRole} />
        </header>

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-700 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <h1 className="font-bold text-lg text-primary-600">EDSignage</h1>
          <NotificationBell userRole={userRole} />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Real-time toast notifications ──────────────────────────────────── */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* ── Login briefing modal ─────────────────────────────────────────────── */}
      {showBriefing && (
        <LoginBriefing
          userName={userName}
          onDismiss={() => setShowBriefing(false)}
        />
      )}

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