import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInventory } from '../../context/InventoryContext'
import { deviceMatchesSlot } from '../../config/deviceTypeRegistry'
import {
  ChevronLeft, ChevronRight, MapPin, TrendingUp, Package, Box,
  Tv, Smartphone, Battery, Monitor, Layout as LayoutIcon, Sparkles,
  Bell, AlertCircle, AlertTriangle, CheckCircle, Truck, RotateCcw,
  Activity, Clock, ArrowUpRight, MousePointer, Zap, Radio,
  BarChart3, Layers, Users,
} from 'lucide-react'

// ── SVG Donut Chart (zero dependencies) ───────────────────────────────────────
function DonutChart({ segments, size = 130, stroke = 22, label, sublabel }) {
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)
  const r    = (size - stroke) / 2
  const cx   = size / 2
  const cy   = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  const arcs = segments.map((seg, i) => {
    const dash = (seg.pct / 100) * circ
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none" stroke={seg.color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        style={{ cursor: seg.onClick ? 'pointer' : 'default', transition: 'stroke-dasharray 0.9s ease' }}
        onClick={seg.onClick}
        onMouseEnter={() => setTooltip({ label: seg.label, count: seg.count, pct: seg.pct, color: seg.color })}
        onMouseLeave={() => setTooltip(null)}
      />
    )
    offset += dash
    return el
  })
  return (
    <div ref={containerRef} className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {arcs}
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-gray-800 leading-none">{label}</span>
        {sublabel && <span className="text-[10px] text-gray-400 mt-0.5">{sublabel}</span>}
      </div>
      {/* Floating tooltip — appears above the donut */}
      {tooltip && (
        <div className="absolute z-50 pointer-events-none"
          style={{ bottom: size + 8, left: '50%', transform: 'translateX(-50%)' }}>
          <div className="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2.5 text-center whitespace-nowrap"
            style={{ border: `2px solid ${tooltip.color}` }}>
            <div className="text-lg font-bold leading-none" style={{ color: tooltip.color }}>{tooltip.count}</div>
            <div className="text-xs font-medium text-white mt-0.5">{tooltip.label}</div>
            <div className="text-xs text-gray-300 mt-0.5">{tooltip.pct.toFixed(1)}% of total</div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 -mt-1.5" style={{ border: `0 solid ${tooltip.color}`, borderBottomWidth: 2, borderRightWidth: 2 }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pipeline step component ────────────────────────────────────────────────────
function PipelineStep({ label, value, color, onClick, isLast }) {
  return (
    <div className="flex items-center flex-1 min-w-0">
      <div onClick={onClick}
        className={`flex-1 text-center py-2.5 px-1 rounded-lg ${color} text-white cursor-pointer hover:opacity-85 active:scale-95 transition-all`}>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[9px] mt-0.5 opacity-90 truncate">{label}</p>
      </div>
      {!isLast && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mx-0.5" />}
    </div>
  )
}

const Dashboard = ({ userRole }) => {
  const {
    devices, deviceSets, dashboardStats, reminders,
    refresh, getClientById,
  } = useInventory()

  const navigate     = useNavigate()
  const scrollRef    = useRef(null)
  const [scrollPos, setScrollPos] = useState(0)
  const [showReminders, setShowReminders] = useState(false)

  // navigate devices + show matching sets inline
  const navCombined = (lc, slc) =>
    navigate(`/dashboard/devices?exactLifecycle=${lc}&setLifecycle=${slc || lc}`)

  // auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh])

  // ── Material carousel config ────────────────────────────────────────────────
  const materials = [
    { id:'tv',          icon:Tv,           label:'TVs',           count: dashboardStats?.materialsInStock?.tv         ||0, grad:'from-purple-500 to-purple-600', bg:'bg-purple-50',  border:'border-purple-200', text:'text-purple-700', filter:'tv' },
    { id:'tablet',      icon:Smartphone,   label:'Tablets',       count: dashboardStats?.materialsInStock?.tablet      ||0, grad:'from-orange-500 to-orange-600', bg:'bg-orange-50',  border:'border-orange-200', text:'text-orange-700', filter:'tablet' },
    { id:'mediaBox',    icon:Box,          label:'Media Boxes',   count: dashboardStats?.materialsInStock?.mediaBox    ||0, grad:'from-green-500 to-green-600',  bg:'bg-green-50',   border:'border-green-200',  text:'text-green-700',  filter:'mediaBox' },
    { id:'battery',     icon:Battery,      label:'Batteries',     count: dashboardStats?.materialsInStock?.battery     ||0, grad:'from-blue-500 to-blue-600',    bg:'bg-blue-50',    border:'border-blue-200',   text:'text-blue-700',   filter:'battery' },
    { id:'aStand',      icon:LayoutIcon,   label:'A-Stands',      count: dashboardStats?.materialsInStock?.aStand      ||0, grad:'from-amber-500 to-amber-600',  bg:'bg-amber-50',   border:'border-amber-200',  text:'text-amber-700',  filter:'stand' },
    { id:'iStand',      icon:Monitor,      label:'I-Stands',      count: dashboardStats?.materialsInStock?.iStand      ||0, grad:'from-indigo-500 to-indigo-600',bg:'bg-indigo-50',  border:'border-indigo-200', text:'text-indigo-700', filter:'istand' },
    { id:'tabletStand', icon:Smartphone,   label:'Tablet Stands', count: dashboardStats?.materialsInStock?.tabletStand ||0, grad:'from-pink-500 to-pink-600',    bg:'bg-pink-50',    border:'border-pink-200',   text:'text-pink-700',   filter:'fabrication' },
    { id:'mouse',       icon:MousePointer, label:'Mouse',         count: dashboardStats?.materialsInStock?.mouse       ||0, grad:'from-cyan-500 to-cyan-600',    bg:'bg-cyan-50',    border:'border-cyan-200',   text:'text-cyan-700',   filter:'mouse' },
    { id:'charger',     icon:Zap,          label:'Chargers',      count: dashboardStats?.materialsInStock?.charger     ||0, grad:'from-yellow-500 to-yellow-600',bg:'bg-yellow-50',  border:'border-yellow-200', text:'text-yellow-700', filter:'charger' },
    { id:'touchTv',     icon:Radio,        label:'Touch TVs',     count: dashboardStats?.materialsInStock?.touchTv     ||0, grad:'from-rose-500 to-rose-600',    bg:'bg-rose-50',    border:'border-rose-200',   text:'text-rose-700',   filter:'touch-tv' },
  ]

  const scrollCarousel = (dir) => {
    const el = scrollRef.current; if (!el) return
    const next = dir === 'left' ? Math.max(0, scrollPos - 300) : scrollPos + 300
    el.scrollTo({ left: next, behavior: 'smooth' }); setScrollPos(next)
  }

  // ── Health donut data ───────────────────────────────────────────────────────
  const hd = dashboardStats?.healthDistribution || { ok:0, repair:0, damage:0 }
  const hTotal = hd.ok + hd.repair + hd.damage
  const hp = hTotal > 0
    ? { ok: (hd.ok/hTotal)*100, repair: (hd.repair/hTotal)*100, damage: (hd.damage/hTotal)*100 }
    : { ok:0, repair:0, damage:0 }

  // ── Lifecycle donut data ────────────────────────────────────────────────────
  const lcTotal = devices?.length || 0
  const lcSegs = dashboardStats ? [
    { label:'Warehouse', count: dashboardStats.locationInsights.warehouse, color:'#818cf8', pct: lcTotal>0?(dashboardStats.locationInsights.warehouse/lcTotal)*100:0, onClick:()=>navigate('/dashboard/devices?status=warehouse') },
    { label:'Deploying', count: dashboardStats.outOfWarehouse.total,       color:'#fbbf24', pct: lcTotal>0?(dashboardStats.outOfWarehouse.total/lcTotal)*100:0,       onClick:()=>navCombined('assigning,assign_requested,assigned,ready_to_deploy,in_transit,received','assigning,assign_requested,assigned,ready_to_deploy,in_transit,received') },
    { label:'Active',    count: dashboardStats.deployedSets.active,        color:'#34d399', pct: lcTotal>0?(dashboardStats.deployedSets.active/lcTotal)*100:0,        onClick:()=>navCombined('active,deployed','active,deployed') },
    { label:'Returning', count: dashboardStats.returnPipeline.total,       color:'#fb7185', pct: lcTotal>0?(dashboardStats.returnPipeline.total/lcTotal)*100:0,       onClick:()=>navCombined('return_initiated,return_transit,returned','return_initiated,return_transit,returned') },
  ] : []

  // ── Buildable sets — exact same logic as Makesets stockAnalysis ────────────
  // Count real warehouse devices using deviceMatchesSlot, then Math.min per set type.
  const warehouseDevices = useMemo(
    () => (devices || []).filter(d => (d.lifecycleStatus === 'available' || d.lifecycleStatus === 'warehouse') && !d.setId),
    [devices]
  )
  const getAvailableByType = useCallback(
    (slotTypeId) => warehouseDevices.filter(d => deviceMatchesSlot(d, slotTypeId)).length,
    [warehouseDevices]
  )

  const buildableSets = useMemo(() => {
    const SET_TYPE_DEFS = [
      { key: 'aStand',      label: 'A-Stand Set',  url: '/dashboard/makesets?filterType=aStand',
        slots: [{ id:'AST', label:'A-Frame Stand' }, { id:'TV', label:'TV (43"+)' }, { id:'MB', label:'Media Box' }] },
      { key: 'iStand',      label: 'I-Stand Set',  url: '/dashboard/makesets?filterType=iStand',
        slots: [{ id:'IST', label:'I-Frame Stand' }, { id:'TV', label:'TV (43"+)' }, { id:'MB', label:'Media Box' }] },
      { key: 'tabletCombo', label: 'Tablet Combo', url: '/dashboard/makesets?filterType=tabletCombo',
        slots: [{ id:'TAB', label:'Tablet' }, { id:'BAT', label:'Battery Pack' }, { id:'TST', label:'Tablet Stand' }] },
    ]
    const types = SET_TYPE_DEFS.map(({ key, label, url, slots }) => {
      const counts = slots.map(s => ({ label: s.label, count: getAvailableByType(s.id) }))
      const maxSets = Math.min(...counts.map(c => c.count))
      const minCount = Math.min(...counts.map(c => c.count))
      const bottleneck = counts.find(c => c.count === minCount)
      return { key, label, url, buildable: maxSets, counts, bottleneck }
    })
    return { total: types.reduce((sum, t) => sum + t.buildable, 0), types }
  }, [getAvailableByType])

  // ── Recent activity — devices + sets combined ───────────────────────────────
  const recentActivity = useMemo(() => {
    const devs = (devices||[]).filter(d=>d.updatedAt).map(d=>({
      id:`dev-${d.id}`, code:d.code, kind:'device',
      status:d.lifecycleStatus||'available', timestamp:d.updatedAt,
      clientId:d.clientId, healthStatus:d.healthStatus, type:d.type,
    }))
    const sets = (deviceSets||[]).filter(s=>s.updatedAt).map(s=>({
      id:`set-${s.id}`, code:s.code, kind:'set',
      status:s.lifecycleStatus||'available', timestamp:s.updatedAt,
      clientId:s.clientId, healthStatus:s.healthStatus, setTypeName:s.setTypeName,
    }))
    return [...devs,...sets].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,15)
  }, [devices, deviceSets])

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now()-new Date(ts))/60000)
    if (m<1) return 'just now'
    if (m<60) return `${m}m ago`
    const h = Math.floor(m/60)
    if (h<24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  const statusBadge = (s) => {
    if (!s) return 'bg-gray-100 text-gray-600'
    if (['active','deployed'].includes(s)) return 'bg-emerald-100 text-emerald-700'
    if (s.includes('return')) return 'bg-rose-100 text-rose-700'
    if (['assigning','assign_requested','assigned'].includes(s)) return 'bg-blue-100 text-blue-700'
    if (['in_transit','ready_to_deploy','deploy_requested'].includes(s)) return 'bg-amber-100 text-amber-700'
    if (['available','warehouse'].includes(s)) return 'bg-slate-100 text-slate-600'
    if (s==='installed') return 'bg-teal-100 text-teal-700'
    if (s==='under_maintenance') return 'bg-orange-100 text-orange-700'
    if (s==='returned') return 'bg-gray-100 text-gray-600'
    return 'bg-gray-100 text-gray-600'
  }

  if (!dashboardStats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  )

  const totalDevices = devices?.length || 0
  const totalSets    = deviceSets?.length || 0

  return (
    <div className="space-y-5 pb-8">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            Dashboard <Sparkles className="w-6 h-6 text-orange-500 animate-pulse" />
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Welcome back, <span className="font-semibold text-gray-700 capitalize">{userRole}</span>
            <span className="ml-2 text-xs text-gray-400">· {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</span>
          </p>
        </div>
        {reminders?.length > 0 && (
          <button onClick={()=>setShowReminders(!showReminders)}
            className="relative flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all shadow-sm">
            <Bell className="w-5 h-5 text-orange-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Reminders</span>
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {reminders.length}
            </span>
          </button>
        )}
      </div>

      {/* ══ ROW 1: HERO KPI STRIP ════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label:'Total Devices',    value:totalDevices,                        icon:Package,       bg:'bg-slate-50',   border:'border-slate-200',   text:'text-slate-700',   onClick:()=>navigate('/dashboard/devices') },
          { label:'Total Sets',       value:totalSets,                           icon:Layers,        bg:'bg-blue-50',    border:'border-blue-200',    text:'text-blue-700',    onClick:()=>navigate('/dashboard/makesets') },
          { label:'Active / Live',    value:dashboardStats.activeDevices,        icon:Activity,      bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-700', onClick:()=>navCombined('active,deployed','active,deployed') },
          { label:'Out for Delivery', value:dashboardStats.outOfWarehouse.total, icon:Truck,         bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-700',   onClick:()=>navCombined('assigning,assign_requested,assigned,ready_to_deploy,deploy_requested,in_transit,received','assigning,assign_requested,assigned,ready_to_deploy,deploy_requested,in_transit,received') },
          { label:'Needs Attention',  value:dashboardStats.needsAttention.total, icon:AlertTriangle, bg:'bg-red-50',     border:'border-red-200',     text:'text-red-700',     onClick:()=>navigate('/dashboard/devices?health=repair,damage') },
        ].map(({ label, value, icon:Icon, bg, border, text, onClick }) => (
          <div key={label} onClick={onClick}
            className={`${bg} ${border} border rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group`}>
            <Icon className={`w-5 h-5 ${text} flex-shrink-0`} />
            <div className="min-w-0">
              <p className={`text-2xl font-bold leading-none ${text}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
            </div>
            <ArrowUpRight className={`w-3.5 h-3.5 ${text} ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`} />
          </div>
        ))}
      </div>

      {/* ══ ROW 2: MATERIALS CAROUSEL ════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Materials in Stock</h3>
            <p className="text-xs text-gray-400 mt-0.5">Loose components available in warehouse</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={()=>scrollCarousel('left')} disabled={scrollPos===0}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={()=>scrollCarousel('right')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        <div ref={scrollRef} onScroll={()=>scrollRef.current&&setScrollPos(scrollRef.current.scrollLeft)}
          className="flex gap-3 p-4 overflow-x-auto scroll-smooth" style={{scrollbarWidth:'none',msOverflowStyle:'none'}}>
          {materials.map(m => {
            const Icon = m.icon
            const isLow = m.count < 5
            return (
              <div key={m.id} onClick={()=>navigate(`/dashboard/devices?type=${m.filter}&status=available`)}
                className={`flex-shrink-0 w-36 ${m.bg} rounded-xl border-2 ${m.border} p-4 hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105 group relative`}>
                {isLow && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                    {m.count===0?'Out!':'Low!'}
                  </span>
                )}
                <div className={`p-2 bg-gradient-to-br ${m.grad} rounded-lg w-fit mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-3xl font-bold text-gray-900 leading-none">{m.count}</p>
                <p className={`text-xs font-medium ${m.text} mt-1.5`}>{m.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ══ ROW 3: DONUTS + SETS CARD ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Device Lifecycle Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900">Device Distribution</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Click a segment to drill down</p>
          <div className="flex items-center gap-5">
            <DonutChart segments={lcSegs} size={130} stroke={22} label={lcTotal} sublabel="devices" />
            <div className="flex-1 space-y-2.5">
              {lcSegs.map(d => (
                <div key={d.label} onClick={d.onClick}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors group">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}} />
                    <span className="text-xs text-gray-600">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-gray-800">{d.count}</span>
                    <ArrowUpRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sets: Warehouse + Can Build (split card) */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden flex flex-col">
          {/* Top: assembled in warehouse */}
          <div onClick={()=>navigate('/dashboard/makesets?lifecycle=available,warehouse,returned')}
            className="flex-1 p-5 bg-gradient-to-br from-blue-50 to-white border-b border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Sets in Warehouse</p>
                <p className="text-4xl font-bold text-blue-600">
                  {(dashboardStats.availableSets.aStand||0)+(dashboardStats.availableSets.iStand||0)+(dashboardStats.availableSets.tabletCombo||0)}
                </p>
              </div>
              <div className="p-2.5 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                { label:'A-Stand',      value:dashboardStats.availableSets.aStand||0,      url:'/dashboard/makesets?lifecycle=available,warehouse,returned&filterType=aStand' },
                { label:'I-Stand',      value:dashboardStats.availableSets.iStand||0,      url:'/dashboard/makesets?lifecycle=available,warehouse,returned&filterType=iStand' },
                { label:'Tablet Combo', value:dashboardStats.availableSets.tabletCombo||0, url:'/dashboard/makesets?lifecycle=available,warehouse,returned&filterType=tabletCombo' },
              ].map(({ label, value, url }) => (
                <div key={label} onClick={e=>{e.stopPropagation();navigate(url)}}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-blue-100 cursor-pointer transition-colors group/r">
                  <span className="text-gray-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-blue-600">{value}</span>
                    <ArrowUpRight className="w-3 h-3 text-blue-300 opacity-0 group-hover/r:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Bottom: can build now */}
          <div className="flex-1 p-5 bg-gradient-to-br from-violet-50 to-white">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Can Build Now</p>
                <p className="text-xs text-gray-400">Sets you can assemble from current stock</p>
              </div>
              <div className="p-2.5 bg-violet-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-violet-600" />
              </div>
            </div>
            <div className="space-y-1.5">
              {buildableSets.types.map(({ key, label, buildable, bottleneck, url }) => (
                <div key={key} onClick={()=>navigate(url)}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-violet-100 cursor-pointer transition-colors group/r">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-500 truncate">{label}</span>
                    {buildable===0 && bottleneck && (
                      <span className="text-red-400 text-[10px] hidden sm:inline">· need {bottleneck.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`font-bold ${buildable===0?'text-red-500':buildable<3?'text-amber-600':'text-violet-600'}`}>{buildable}</span>
                    <ArrowUpRight className="w-3 h-3 text-violet-300 opacity-0 group-hover/r:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 mt-1 italic">TV &amp; Media Box are shared — build one type at a time</p>
            </div>
          </div>
        </div>

        {/* Device Health Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900">Device Health</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Click to view affected devices</p>
          {hTotal > 0 ? (
            <div className="flex items-center gap-5">
              <DonutChart
                size={130} stroke={22}
                label={`${Math.round(hp.ok)}%`} sublabel="healthy"
                segments={[
                  { label:'Healthy',      count:hd.ok,     pct:hp.ok,     color:'#34d399', onClick:()=>navigate('/dashboard/devices?health=ok') },
                  { label:'Needs Repair', count:hd.repair, pct:hp.repair, color:'#fb923c', onClick:()=>navigate('/dashboard/devices?health=repair') },
                  { label:'Damaged',      count:hd.damage, pct:hp.damage, color:'#f43f5e', onClick:()=>navigate('/dashboard/devices?health=damage') },
                ]}
              />
              <div className="flex-1 space-y-3">
                {[
                  { label:'Healthy',      count:hd.ok,     pct:hp.ok,     color:'#34d399', bar:'bg-emerald-400', h:'ok' },
                  { label:'Needs Repair', count:hd.repair, pct:hp.repair, color:'#fb923c', bar:'bg-orange-400',  h:'repair' },
                  { label:'Damaged',      count:hd.damage, pct:hp.damage, color:'#f43f5e', bar:'bg-rose-500',    h:'damage' },
                ].map(({ label, count, pct, color, bar, h }) => (
                  <div key={h} onClick={()=>navigate(`/dashboard/devices?health=${h}`)} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{background:color}} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-700">{count}</span>
                        <ArrowUpRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} transition-all duration-1000`} style={{width:`${pct}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No health data</div>
          )}
        </div>
      </div>

      {/* ══ ROW 4: OPERATIONS PIPELINE ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Deployed */}
        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden hover:shadow-md transition-shadow">
          <div onClick={()=>navCombined('active,deployed,installed,under_maintenance','active,deployed,installed,under_maintenance')}
            className="px-5 py-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100 flex items-center justify-between cursor-pointer hover:bg-green-50 transition-colors group">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deployed</p>
              <p className="text-3xl font-bold text-green-600 mt-0.5">{dashboardStats.deployedSets.total}</p>
            </div>
            <div className="p-2.5 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {[
              { label:'Installed',      value:dashboardStats.deployedSets.installed,        lc:'installed',        dot:'bg-teal-400' },
              { label:'Active / Live',  value:dashboardStats.deployedSets.active,           lc:'active,deployed',  dot:'bg-emerald-500' },
              { label:'Maintenance',    value:dashboardStats.deployedSets.underMaintenance, lc:'under_maintenance', dot:'bg-orange-400' },
            ].map(({ label, value, lc, dot }) => (
              <div key={label} onClick={e=>{e.stopPropagation();navCombined(lc,lc)}}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-green-50 cursor-pointer transition-colors group/r">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-sm text-gray-600 flex-1">{label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-800">{value}</span>
                  <ArrowUpRight className="w-3 h-3 text-gray-300 opacity-0 group-hover/r:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Out of Warehouse — pipeline flow */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-md transition-shadow">
          <div onClick={()=>navCombined('assigning,assign_requested,assigned,ready_to_deploy,deploy_requested,in_transit,received','assigning,assign_requested,assigned,ready_to_deploy,deploy_requested,in_transit,received')}
            className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100 flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-colors group">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Out of Warehouse</p>
              <p className="text-3xl font-bold text-amber-600 mt-0.5">{dashboardStats.outOfWarehouse.total}</p>
            </div>
            <div className="p-2.5 bg-amber-100 rounded-lg group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1 mb-2">
              {[
                { label:'Assigning', value:dashboardStats.outOfWarehouse.assigning,     color:'bg-blue-500',   lc:'assigning,assign_requested,assigned' },
                { label:'Ready',     value:dashboardStats.outOfWarehouse.readyToDeploy, color:'bg-teal-500',   lc:'ready_to_deploy,deploy_requested' },
                { label:'Transit',   value:dashboardStats.outOfWarehouse.inTransit,     color:'bg-amber-500',  lc:'in_transit' },
                { label:'Received',  value:dashboardStats.outOfWarehouse.received,      color:'bg-purple-500', lc:'received' },
              ].map(({ label, value, color, lc }, i, arr) => (
                <PipelineStep key={label} label={label} value={value} color={color}
                  onClick={()=>navCombined(lc,lc)} isLast={i===arr.length-1} />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center">Assignment → deployment pipeline</p>
          </div>
        </div>

        {/* Return Pipeline — pipeline flow */}
        <div className="bg-white rounded-xl shadow-sm border border-rose-100 overflow-hidden hover:shadow-md transition-shadow">
          <div onClick={()=>navCombined('return_initiated,return_requested,return_transit,returned','return_initiated,return_requested,return_transit,returned')}
            className="px-5 py-4 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100 flex items-center justify-between cursor-pointer hover:bg-rose-50 transition-colors group">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Return Pipeline</p>
              <p className="text-3xl font-bold text-rose-600 mt-0.5">{dashboardStats.returnPipeline.total}</p>
            </div>
            <div className="p-2.5 bg-rose-100 rounded-lg group-hover:scale-110 transition-transform">
              <RotateCcw className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1 mb-2">
              {[
                { label:'Initiated', value:dashboardStats.returnPipeline.returnInitiated, color:'bg-rose-500',  lc:'return_initiated,return_requested' },
                { label:'Transit',   value:dashboardStats.returnPipeline.returnTransit,   color:'bg-pink-500',  lc:'return_transit' },
                { label:'Returned',  value:dashboardStats.returnPipeline.returned,        color:'bg-slate-400', lc:'returned' },
              ].map(({ label, value, color, lc }, i, arr) => (
                <PipelineStep key={label} label={label} value={value} color={color}
                  onClick={()=>navCombined(lc,lc)} isLast={i===arr.length-1} />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center">Return → transit → back in stock</p>
          </div>
        </div>
      </div>

      {/* ══ ROW 5: LOW STOCK + RECENT ACTIVITY ═══════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Low Stock (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-white flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" /> Low Stock Alerts
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Items below 5 units</p>
            </div>
            {dashboardStats.lowStockAlerts.length > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {dashboardStats.lowStockAlerts.length} alerts
              </span>
            )}
          </div>
          <div className="p-4 flex-1">
            {dashboardStats.lowStockAlerts.length > 0 ? (
              <div className="space-y-2">
                {dashboardStats.lowStockAlerts.map(alert => {
                  const mat = materials.find(m=>m.id===alert.type)
                  const Icon = mat?.icon || Package
                  return (
                    <div key={alert.type} onClick={()=>navigate(`/dashboard/devices?type=${mat?.filter||alert.type}&status=available`)}
                      className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors group">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 bg-gradient-to-br ${mat?.grad||'from-gray-400 to-gray-500'} rounded-lg`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{mat?.label||alert.type}</p>
                          <p className="text-[10px] text-gray-400">{alert.count===0?'Out of stock':'Running low'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xl font-bold ${alert.count===0?'text-red-600':'text-yellow-600'}`}>{alert.count}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle className="w-10 h-10 mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-600">All stock healthy</p>
                <p className="text-xs text-gray-400 mt-1">No items below 5 units</p>
              </div>
            )}
          </div>
          {/* Health issues footer */}
          {dashboardStats.needsAttention.total > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-red-50">
              <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Device Health Issues
              </p>
              <div className="flex gap-2">
                {[
                  { label:'Needs Repair', value:dashboardStats.needsAttention.repair, h:'repair', cls:'bg-orange-100 text-orange-700 border-orange-200' },
                  { label:'Damaged',      value:dashboardStats.needsAttention.damage, h:'damage', cls:'bg-red-100 text-red-700 border-red-200' },
                ].filter(x=>x.value>0).map(({ label, value, h, cls }) => (
                  <div key={h} onClick={()=>navigate(`/dashboard/devices?health=${h}`)}
                    className={`flex-1 border rounded-lg p-2.5 text-center cursor-pointer hover:opacity-80 transition-opacity ${cls}`}>
                    <p className="text-xl font-bold leading-none">{value}</p>
                    <p className="text-[10px] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Recent Activity
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest updates across devices &amp; sets — click to filter</p>
            </div>
            <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
              {recentActivity.length} items
            </span>
          </div>
          <div className="divide-y divide-gray-50 overflow-y-auto" style={{maxHeight:'340px'}}>
            {recentActivity.length > 0 ? recentActivity.map(activity => {
              const client = activity.clientId ? getClientById(activity.clientId) : null
              const isSet = activity.kind === 'set'
              const navUrl = isSet
                ? `/dashboard/makesets?lifecycle=${activity.status}`
                : `/dashboard/devices?exactLifecycle=${activity.status}`
              return (
                <div key={activity.id} onClick={()=>navigate(navUrl)}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-indigo-50 cursor-pointer transition-colors group">
                  <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold
                    ${isSet?'bg-violet-100 text-violet-700':'bg-indigo-100 text-indigo-700'}`}>
                    {isSet?'SET':'DEV'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{activity.code}</span>
                      {isSet && activity.setTypeName && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{activity.setTypeName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusBadge(activity.status)}`}>
                        {(activity.status||'').replace(/_/g,' ')}
                      </span>
                      {client && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{client.name}
                        </span>
                      )}
                      {activity.healthStatus && activity.healthStatus!=='ok' && (
                        <span className="text-[10px] text-orange-600 font-medium">⚠ {activity.healthStatus}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(activity.timestamp)}</span>
                    <ArrowUpRight className="w-3 h-3 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )
            }) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Activity className="w-10 h-10 mb-2" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ ROW 6: QUICK ACTIONS ═════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to:'/dashboard/devices',  icon:Package,   label:'View Devices',     border:'hover:border-orange-400', iconCls:'text-orange-500' },
            { to:'/dashboard/makesets', icon:Box,       label:'Make Sets',        border:'hover:border-blue-400',   iconCls:'text-blue-500' },
            { to:'/dashboard/client',   icon:Users,     label:'Assign to Client', border:'hover:border-green-400',  iconCls:'text-green-500' },
            { to:'/dashboard/return',   icon:RotateCcw, label:'Process Returns',  border:'hover:border-rose-400',   iconCls:'text-rose-500' },
          ].map(({ to, icon:Icon, label, border, iconCls }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-3 p-3.5 bg-white rounded-lg border-2 border-gray-200 ${border} hover:shadow-md transition-all group`}>
              <Icon className={`w-5 h-5 ${iconCls} group-hover:scale-110 transition-transform flex-shrink-0`} />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}

export default Dashboard