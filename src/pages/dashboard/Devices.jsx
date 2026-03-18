import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Smartphone,
  LayoutGrid,
  Monitor,
  Tablet as TabletIcon,
  Tv,
  Search,
  ChevronRight,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  QrCode,
  X,
  Plus,
  Filter,
  MapPin,
  Tag,
  Ruler,
  Box,
  Package,
  Truck,
  Link2,
  Layers,
  Battery,
  Check,
  ChevronDown,
  Info,
  ScanBarcode,
  Camera,
  Warehouse,
  ArrowRight,
  PackagePlus,
  ShieldCheck,
  Mouse,
  Zap,
  Heart,
  RefreshCw,
  Loader2,
  History,
  Building2,
  Activity,
  Pencil,
  Send,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Lock,
  Wrench,
  Trash2,
  Settings,
  MoreVertical,
  Printer,
} from 'lucide-react'
import ScheduleDeleteModal    from '../../components/ScheduleDeleteModal'
import DeletionsDrawerButton   from '../../components/PendingDeletionsPanel'
import { deletionRequestApi } from '../../api/deletionRequestApi'
import {
  useInventory,
  getDeviceLifecycleStatus,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
} from '../../context/InventoryContext'
import {
  ALL_PRODUCT_TYPES,
  PRODUCT_TYPES,
  getSizesForProductType,
  getBrandsForProductType,
  getCodePrefix,
  DEVICE_COLORS,
  getIndianLocationHierarchyForFilter,
  normalizeCode,
  getNextAutoCode,
  validateDeviceCode,
  DEVICE_HEALTH_STATUS,
} from '../../config/deviceConfig'
import {
  getAllTypes,
  resolveTypeId,
  getTypeLabel,
  getColorClasses,
  addCustomType as addCustomTypeToRegistry,
  deleteCustomType as deleteCustomTypeFromRegistry,
} from '../../config/deviceTypeRegistry'
import CommandCentre from './CommandCentre'
import WarehouseLocationSelector from '../../components/WarehouseLocationSelector'
import { AddDeviceRequestForm } from '../../components/InventoryRequestPanel'
import { useCatalogue } from '../../context/CatalogueContext'
import { hasRole, ROLES } from '../../App'
import { inventoryRequestApi } from '../../api/inventoryRequestApi'
import BarcodeScanner from '../../components/BarcodeScanner'
import SetBarcodeGenerator from '../../components/SetBarcodeGenerator'
import BarcodeResultCard from '../../components/BarcodeResultCard'
import MoveDeviceModal  from '../../components/MoveDeviceModal'
import EditDeviceModal  from '../../components/EditDeviceModal'
import BulkBarcodeGenerator from '../../components/BulkBarcodeGenerator'
import PrintQRModal         from '../../components/PrintQRModal'
import DeviceTimeline from '../../components/DeviceTimeline'
import HealthUpdateModal, { LostHealthBanner } from '../../components/HealthUpdateModal'
import { lifecycleRequestApi, STEP_META, HEALTH_REQUIRES_PROOF, MAX_PROOF_FILES } from '../../api/lifecycleRequestApi'
import { ProofUploadPanel, useProofFiles } from '../../components/ProofUpload'
import {
  calculateSetHealth,
  getComponentHealthSummary,
  getHealthDisplayInfo,
  normalizeHealth as normalizeHealthUtil
} from '../../utils/setHealthUtils'

// Normalize legacy health status values to canonical ones used throughout the system.
// Ground team requests may have written 'damaged', 'needs_repair', 'critical' into the DB.
const normalizeHealth = (v) => {
  if (!v) return 'ok'
  const map = { damaged: 'damage', needs_repair: 'repair', critical: 'damage' }
  return map[v] ?? v
}

const HEALTH_STYLE = {
  ok:     { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: '✓ OK' },
  repair: { badge: 'bg-amber-100   text-amber-800   border-amber-200',   label: '🔧 Repair' },
  damage: { badge: 'bg-red-100     text-red-800     border-red-200',     label: '⚠ Damage' },
}
const getHealthStyle = (raw) => HEALTH_STYLE[normalizeHealth(raw)] ?? HEALTH_STYLE.ok

const LIFECYCLE_OPTIONS = [
  { value: 'all', label: 'All Devices', icon: Layers, desc: 'View all devices in system' },
  { value: 'deployed', label: 'Deployed', icon: Truck, desc: 'In use by client at location' },
  { value: 'assigning', label: 'Assigning', icon: Link2, desc: 'Ordered, not yet deployed' },
  { value: 'warehouse', label: 'In Warehouse', icon: Package, desc: 'In Warehouse A, B or C' },
]

const PRODUCT_TYPE_ICONS = {
  tv: Tv,
  TV: Tv,
  tablet: TabletIcon,
  TAB: TabletIcon,
  'touch-tv': Tv,
  TTV: Tv,
  'a-stand': LayoutGrid,
  AST: LayoutGrid,
  'i-stand': Monitor,
  IST: Monitor,
  'tablet-stand': TabletIcon,
  TST: TabletIcon,
  stand: LayoutGrid,
  istand: Monitor,
  MB: Box,
  BAT: Battery,
  MSE: Mouse,
  W: Zap,
}

// SET TYPES CONFIG
// deviceType values use canonical forms (from deviceConfig.js) to match any variation:
// - 'stand' matches: "stand", "a-stand", "A stand", "A-Frame Stand", etc.
// - 'istand' matches: "istand", "i-stand", "I stand", "I-Frame Stand", etc.
// - 'mediaBox' matches: "mediaBox", "Media Box", "MB", etc.
// - 'battery' matches: "battery", "Battery Pack", etc.
// - 'fabrication' matches: "fabrication", "Tablet Stand", etc.
const SET_TYPES = {
  aStand: {
    label: 'A-Frame Standee',
    icon: LayoutGrid,
    color: 'orange',
    components: [
      { key: 'stand', label: 'A-Frame Stand', icon: LayoutGrid, inventoryKey: 'aFrameStands', deviceType: 'stand' },
      { key: 'tv', label: 'TV (43" or larger)', icon: Monitor, inventoryKey: 'tvs', deviceType: 'tv' },
      { key: 'mediaBox', label: 'Media Box', icon: Tv, inventoryKey: 'mediaBoxes', deviceType: 'mediaBox' },
    ]
  },
  iStand: {
    label: 'I-Frame Standee',
    icon: Monitor,
    color: 'blue',
    components: [
      { key: 'stand', label: 'I-Frame Stand', icon: Monitor, inventoryKey: 'iFrameStands', deviceType: 'istand' },
      { key: 'tv', label: 'TV (43" or larger)', icon: Monitor, inventoryKey: 'tvs', deviceType: 'tv' },
      { key: 'mediaBox', label: 'Media Box', icon: Tv, inventoryKey: 'mediaBoxes', deviceType: 'mediaBox' },
    ]
  },
  tabletCombo: {
    label: 'Tablet Combo',
    icon: Smartphone,
    color: 'purple',
    components: [
      { key: 'tablet', label: 'Tablet', icon: Smartphone, inventoryKey: 'tablets', deviceType: 'tablet' },
      { key: 'battery', label: 'Battery', icon: Battery, inventoryKey: 'batteries', deviceType: 'battery' },
      { key: 'fabrication', label: 'Tablet Stand (Fabrication)', icon: LayoutGrid, inventoryKey: 'fabricationTablet', deviceType: 'fabrication' },
    ]
  }
}

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  upcoming: 'bg-sky-100 text-sky-800 border-sky-200',
  warehouse: 'bg-slate-100 text-slate-800 border-slate-200',
}


// ─────────────────────────────────────────────────────────────────────────────
// DEVICE DETAIL MODAL
// Redesigned "View" modal: hardware identity + live status + mini timeline
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—'

const fmtDate = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—'

// Returns current local datetime as a datetime-local input value (e.g. "2026-03-10T15:47")
const nowLocalDatetime = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// Compact row used in both sections
const DetailRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400 font-medium flex-shrink-0">{label}</span>
    <span className="text-xs font-semibold text-gray-800 text-right">{children}</span>
  </div>
)


// HealthUpdateModal (shared component) is imported from ./HealthUpdateModal
// — no local HealthReportModal needed here.

function DeviceDetailModal({ device, deviceSets, getClientById, getSubscriptionStatus, statusStyles, getHealthStyle, getDeviceTypeLabel, getDeviceLifecycleStatus, onClose, onViewBarcode, onDelete, isManager, onDeviceUpdated }) {
  const [showHealthReport,  setShowHealthReport]  = useState(false)
  const [showScheduleDelete, setShowScheduleDelete] = useState(false)
  const [showHistory,        setShowHistory]        = useState(false)
  const [showMoreMenu,       setShowMoreMenu]       = useState(false)
  const [showMoveDevice,     setShowMoveDevice]     = useState(false)
  const [showEditDevice,     setShowEditDevice]     = useState(false)
  const [localDevice,        setLocalDevice]        = useState(device)

  // Keep localDevice in sync if parent passes new device
  const currentDevice = localDevice || device
  const handleDeviceUpdated = (updated) => {
    setLocalDevice(updated)
    onDeviceUpdated?.(updated)
  }

  if (!device) return null

  const lifecycle    = getDeviceLifecycleStatus(device)
  const exactStep    = device.lifecycleStatus || 'available'
  const stepMeta     = STEP_META[exactStep]
  const hs           = getHealthStyle(device.healthStatus)
  const client       = device.clientId ? getClientById(device.clientId) : null
  const set          = device.setId ? deviceSets.find(s => s.id === device.setId || s.id === Number(device.setId)) : null

  // Determine location context
  const inWarehouse  = lifecycle === 'warehouse'
  const isDeployed   = lifecycle === 'deployed'
  const isAssigning  = lifecycle === 'assigning'

  // Subscription status
  const subStatus = client && device.subscriptionEnd
    ? getSubscriptionStatus(device.subscriptionEnd)
    : null

  // Step colour classes
  const stepBg   = stepMeta ? stepMeta.bgClass   : 'bg-gray-100'
  const stepText = stepMeta ? stepMeta.textClass  : 'text-gray-700'
  const stepBorder = stepMeta ? stepMeta.borderClass : 'border-gray-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto scroll-smooth"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-mono leading-tight">{device.code}</h2>
              <p className="text-xs text-gray-400">{getDeviceTypeLabel(device.type)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Three-dot menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(m => !m)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <>
                  {/* Click-away backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]">
                    <button
                      onClick={() => { setShowHistory(h => !h); setShowMoreMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <History className="w-4 h-4 text-indigo-500" />
                      {showHistory ? 'Hide History' : 'View History'}
                    </button>
                    {isManager && !device.setId && (
                      <button
                        onClick={() => { setShowScheduleDelete(true); setShowMoreMenu(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Schedule Deletion
                      </button>
                    )}
                    {isManager && device.setId && (
                      <div className="px-4 py-2.5 text-xs text-gray-400">
                        ⚠ Remove from set to delete
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowEditDevice(true)}
              className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
              title="Edit device details"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* ── LIVE STATUS CARD ───────────────────────────────────── */}
          <div className={`rounded-xl border p-4 space-y-3 ${stepBg} ${stepBorder}`}>
            <p className={`text-[10px] font-extrabold uppercase tracking-widest ${stepText} opacity-70`}>
              Current Status
            </p>

            {/* Big step badge */}
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{stepMeta?.emoji ?? '📋'}</span>
              <span className={`text-sm font-extrabold ${stepText}`}>
                {stepMeta?.label ?? exactStep}
              </span>
            </div>

            {/* Health */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                <Heart className="w-3 h-3" /> Health
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${hs.badge}`}>
                  {hs.label}
                </span>
                {device.healthStatus !== 'lost' && (
                  <button
                    type="button"
                    onClick={() => setShowHealthReport(true)}
                    title="Report health status"
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/60 hover:bg-white border border-black/10 hover:border-cyan-300 text-gray-400 hover:text-cyan-600 transition-all shadow-sm"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Location — context-sensitive */}
            {inWarehouse && (() => {
              const whParts = [
                currentDevice.warehouse?.name || (currentDevice.warehouseId ? `Warehouse #${currentDevice.warehouseId}` : null),
                currentDevice.warehouseZone,
                currentDevice.warehouseSpecificLocation,
              ].filter(Boolean)
              return (
                <div className="space-y-1.5">
                  <p className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                    <Building2 className="w-3 h-3" /> Warehouse Location
                  </p>
                  {whParts.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {whParts.map((p, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className={`text-[10px] ${stepText} opacity-40`}>›</span>}
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${stepBg} border ${stepBorder} ${stepText}`}>{p}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${stepText} opacity-50 italic`}>No location set</p>
                  )}
                </div>
              )
            })()}
            {isDeployed && (device.state || device.district || device.location) && (
              <div className="space-y-1.5">
                <p className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                  <MapPin className="w-3 h-3" /> Deployment Site
                </p>
                {device.state    && <div className="flex justify-between"><span className={`text-[11px] ${stepText} opacity-60`}>State</span><span className={`text-[11px] font-semibold ${stepText}`}>{device.state}</span></div>}
                {device.district && <div className="flex justify-between"><span className={`text-[11px] ${stepText} opacity-60`}>District</span><span className={`text-[11px] font-semibold ${stepText}`}>{device.district}</span></div>}
                {device.location && <div className="flex justify-between"><span className={`text-[11px] ${stepText} opacity-60`}>Site</span><span className={`text-[11px] font-semibold ${stepText}`}>{device.location}</span></div>}
              </div>
            )}
            {isAssigning && (
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Device in motion — check timeline for details</span>
              </div>
            )}

            {/* Client */}
            {client ? (
              <div className="pt-2 border-t border-black/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                    <User className="w-3 h-3" /> Client
                  </span>
                  <span className={`text-xs font-bold ${stepText}`}>{client.name}</span>
                </div>
                {device.subscriptionStart && device.subscriptionEnd && (
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                      <Calendar className="w-3 h-3" /> Subscription
                    </span>
                    <span className={`text-[11px] font-medium ${stepText}`}>
                      {fmtDate(device.subscriptionStart)} → {fmtDate(device.subscriptionEnd)}
                    </span>
                  </div>
                )}
                {subStatus && (
                  <div className="flex justify-end">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles[subStatus.type]}`}>
                      {subStatus.label}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-black/5">
                <span className={`text-xs font-medium ${stepText} opacity-70 flex items-center gap-1`}>
                  <User className="w-3 h-3" /> Client
                </span>
                <span className="text-xs text-gray-400">Unassigned</span>
              </div>
            )}
          </div>

          {/* ── HARDWARE IDENTITY ──────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
              Hardware
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-2 divide-y divide-gray-100">
              <DetailRow label="Type">{getDeviceTypeLabel(device.type)}</DetailRow>
              {set && (
                <DetailRow label="In Set">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                    <Layers className="w-3 h-3" />
                    {set.code || set.name || `Set #${device.setId}`}
                  </span>
                </DetailRow>
              )}
              {device.brand && <DetailRow label="Brand">{device.brand}</DetailRow>}
              {device.size  && <DetailRow label="Size">{device.size}</DetailRow>}
              {device.model && <DetailRow label="Model">{device.model}</DetailRow>}
              {device.color && <DetailRow label="Color">{device.color}</DetailRow>}
              {device.gpsId && <DetailRow label="GPS ID"><span className="font-mono">{device.gpsId}</span></DetailRow>}
              {device.mfgDate && (
                <DetailRow label="Entered Warehouse">
                  {fmt(device.mfgDate)}
                </DetailRow>
              )}
            </div>
          </div>

          {/* ── ACTIONS ───────────────────────────────────────────── */}
          <div className="space-y-2">
            {/* Move Device — locked when device is in a set */}
            {['available', 'warehouse', 'assigning', 'assign_requested', 'assigned', 'ready_to_deploy', 'deploy_requested', 'returned'].includes(exactStep) && (
              device.setId ? (
                <div className="w-full flex items-center gap-3 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
                  <Lock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-800">Cannot move individually</p>
                    <p className="text-[11px] text-orange-600">Part of set {set ? set.code : `#${device.setId}`} — move the set instead</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowMoveDevice(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors text-sm font-semibold"
                >
                  <MapPin className="w-4 h-4" /> Move Device
                </button>
              )
            )}
            {device.barcode && (
              <button
                onClick={() => onViewBarcode(device)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-semibold"
              >
                <QrCode className="w-4 h-4" /> View Barcode
              </button>
            )}
            {showScheduleDelete && (
              <ScheduleDeleteModal
                entity={device}
                entityType="device"
                onConfirm={async (reason) => onDelete(device.id, reason)}
                onClose={() => setShowScheduleDelete(false)}
              />
            )}
          </div>

          {/* ── INLINE HISTORY TIMELINE ──────────────────────────── */}
          {showHistory && (
            <div className="-mx-5 border-t border-indigo-100 overflow-hidden">
              <DeviceTimeline
                deviceId={device.id}
                deviceCode={device.code}
                onClose={() => setShowHistory(false)}
              />
            </div>
          )}
        </div>
      </div>

      {showMoveDevice && (
        <MoveDeviceModal
          device={currentDevice}
          onSuccess={handleDeviceUpdated}
          onClose={() => setShowMoveDevice(false)}
        />
      )}

      {showEditDevice && (
        <EditDeviceModal
          device={currentDevice}
          isManager={isManager}
          onSuccess={handleDeviceUpdated}
          onClose={() => setShowEditDevice(false)}
        />
      )}

      {showHealthReport && (
        <HealthUpdateModal
          device={device}
          isManager={(() => {
            const u = JSON.parse(localStorage.getItem('user') || '{}')
            const r = (u.role ?? '').toLowerCase().replace(/[\s_-]/g, '')
            return ['manager', 'superadmin'].includes(r)
          })()}
          onClose={() => setShowHealthReport(false)}
          onDone={() => setShowHealthReport(false)}
        />
      )}
    </div>
  )
}

function getDeviceTypeLabel(type) {
  // Registry resolves any type string (legacy or canonical) to a display label
  return getTypeLabel(type) || type || '—'
}

const Devices = ({ userRole } = {}) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Catalogue context (DB-backed types, brands, sizes, colors) ────────────
  const { productTypes, brands: catalogueBrands, sizes: catalogueSizes, colors: catalogueColors } = useCatalogue()

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isGroundTeam = hasRole(userRole, ROLES.GROUNDTEAM)
  const isManager    = hasRole(userRole, ROLES.MANAGER, ROLES.SUPERADMIN)

  // ── Ground team request form state ────────────────────────────────────────
  const [showAddRequestForm, setShowAddRequestForm] = useState(false)

  const {
    devices,
    clients,
    getClientById,
    getDevicesByType,
    getUniqueDeviceFilterOptions,
    addDevice,
    bulkAddDevices,
    componentInventory,
    deviceSets,
    createDeviceSet,
    deleteDeviceSet,
    disassembleSet,
    getAvailableDevicesForComponent,
    scanDevice,
    refresh,
    removeDevice,
  } = useInventory()

  // ── Pending lifecycle requests map: deviceId → true ──────────────────────
  // Fetched once on mount and whenever devices change, so the 🕐 badge is
  // always current without polling.
  const [pendingDeviceIds,      setPendingDeviceIds]      = useState(new Set())
  const [scheduledDeletionIds,  setScheduledDeletionIds]  = useState(new Set())
  const [showSetDeleteModal,  setShowSetDeleteModal]  = useState(false)

  // ── Refresh sets + devices on mount so search results are never stale ────────
  // Without this, deviceSets from InventoryContext can be from the initial app
  // load — missing any sets created since then (e.g. approved make_set requests).
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!devices.length) return
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch('/api/lifecycle-requests?status=pending', { headers })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const ids = new Set(rows.filter(r => r.deviceId).map(r => r.deviceId))
        setPendingDeviceIds(ids)
      })
      .catch(() => {})
    // Also fetch pending deletion requests so the button count + row badge stay current
    fetch('/api/deletion-requests?status=pending', { headers })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const ids = new Set(rows.filter(r => r.entityType === 'device').map(r => r.entityId))
        setScheduledDeletionIds(ids)
      })
      .catch(() => {})
  }, [devices])

  // ── URL Query Parameter Support ──────────────────────
  // Get initial filters from URL parameters
  const urlType = searchParams.get('type')
  const urlStatus = searchParams.get('status')
  const urlHealth = searchParams.get('health')
  // exactLifecycle: filters individual devices to specific lifecycleStatus values (comma-separated)
  const urlExactLifecycle = searchParams.get('exactLifecycle')
  // setLifecycle: when present, show a matching sets section below devices
  const urlSetLifecycle = searchParams.get('setLifecycle')

  const [lifecycleFilter, setLifecycleFilter] = useState(() => {
    if (urlStatus === 'available') return 'warehouse'
    if (urlStatus === 'active') return 'deployed'
    if (urlStatus) return urlStatus
    return 'all'
  })

  const [exactLifecycleFilter] = useState(() => urlExactLifecycle || null)

  // Sets matching the setLifecycle param — shown inline below the device list
  const matchingSets = useMemo(() => {
    if (!urlSetLifecycle) return []
    const steps = urlSetLifecycle.split(',')
    return deviceSets.filter(s => steps.includes(s.lifecycleStatus))
  }, [deviceSets, urlSetLifecycle])
  const [selectedType, setSelectedType] = useState(() => {
    if (urlType) return resolveTypeId(urlType) || urlType
    return null
  })
  
  const [searchCode, setSearchCode] = useState('')
  const [unifiedSearch, setUnifiedSearch] = useState('') // Unified search for both devices and sets
  const [searchResultType, setSearchResultType] = useState('all') // 'all', 'devices', 'sets'
  const [healthFilter, setHealthFilter] = useState(() => {
    return urlHealth || ''
  })
  const [detailDevice, setDetailDevice] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showCatalogue, setShowCatalogue] = useState(false)
  // Code preview for ground team (single add)
  const [addCodePreview, setAddCodePreview] = useState(null)   // { range, first, last }
  const [addCodePreviewLoading, setAddCodePreviewLoading] = useState(false)
  const [addSubmitSuccess, setAddSubmitSuccess] = useState(null) // { range, requestId }

  const [showFilters, setShowFilters] = useState(true)
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState('devices')
  
  // Make Set modal state
  const [showMakeSetModal, setShowMakeSetModal] = useState(false)
  const [selectedSetType, setSelectedSetType] = useState(null)
  const [selectedComponents, setSelectedComponents] = useState({})
  const [setName, setSetName] = useState('')
  const [expandedSet, setExpandedSet] = useState(null)
  
  // Barcode Scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [selectedSet, setSelectedSet]               = useState(null) // set object for detail modal
  const [showSetBarcode, setShowSetBarcode]           = useState(null) // set object for barcode generator

  // Bulk Add state
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [bulkQty, setBulkQty] = useState(10)
  const [bulkProductType, setBulkProductType] = useState('tv')
  const [bulkBrand, setBulkBrand] = useState('')
  const [bulkSize, setBulkSize] = useState('')
  const [bulkColor, setBulkColor] = useState('')
  const [bulkModel, setBulkModel] = useState('')
  const [bulkMfgDate, setBulkMfgDate] = useState('')
  const [bulkInDate, setBulkInDate] = useState('')
  const [bulkHealth, setBulkHealth] = useState('ok')
  const [bulkLifecycleStatus, setBulkLifecycleStatus] = useState('warehouse')
  const [bulkAdding, setBulkAdding] = useState(false)
  const [bulkAddProgress, setBulkAddProgress] = useState(0)
  const [showBulkBarcodes, setShowBulkBarcodes] = useState(false)
  const [showPrintQR,       setShowPrintQR]       = useState(false)
  const [bulkCreatedDevices, setBulkCreatedDevices] = useState([])
  // Code preview for ground team (bulk add)
  const [bulkCodePreview, setBulkCodePreview] = useState(null)
  const [bulkCodePreviewLoading, setBulkCodePreviewLoading] = useState(false)
  const [bulkSubmitSuccess, setBulkSubmitSuccess] = useState(null) // { range, requestId }

  // NEW: Barcode Generator state
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [selectedDeviceForBarcode, setSelectedDeviceForBarcode] = useState(null)

  // Filters
  const [filterClientId, setFilterClientId] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterPinpoint, setFilterPinpoint] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterModel, setFilterModel] = useState('')

  // Add device form state
  const [newProductType, setNewProductType] = useState('tv')
  const [newBrand, setNewBrand] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newGpsId, setNewGpsId] = useState('')
  const [newMfgDate, setNewMfgDate] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newDeviceCode, setNewDeviceCode] = useState('')
  const [newLifecycleStatus, setNewLifecycleStatus] = useState('warehouse')
  const [newHealth, setNewHealth] = useState('ok')
  // NEW: Warehouse location fields for Add Device form
  const [newWarehouseId,               setNewWarehouseId]               = useState(null)
  const [newWarehouseZone,             setNewWarehouseZone]             = useState('')
  const [newWarehouseSpecificLocation, setNewWarehouseSpecificLocation] = useState('')
  const [newInDate, setNewInDate] = useState('')
  // Custom product types — sourced from shared registry, reactive across pages
  const [customProductTypes, setCustomProductTypes] = useState(() => getAllTypes().filter(t => !t.isBuiltin))
  const [showAddTypeModal, setShowAddTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeCode, setNewTypeCode] = useState('')

  // Migrate legacy 'customProductTypes' localStorage key into the registry (runs once)
  useEffect(() => {
    const legacy = localStorage.getItem('customProductTypes')
    if (!legacy) return
    try {
      const old = JSON.parse(legacy)
      old.forEach(t => {
        try { addCustomTypeToRegistry({ id: t.code, label: t.label }) } catch { /* skip duplicates */ }
      })
    } catch { /* ignore parse errors */ }
    localStorage.removeItem('customProductTypes')
    setCustomProductTypes(getAllTypes().filter(t => !t.isBuiltin))
  }, [])

  // Re-read registry whenever any page adds/removes a custom device type
  useEffect(() => {
    const handler = () => setCustomProductTypes(getAllTypes().filter(t => !t.isBuiltin))
    window.addEventListener('device-types-updated', handler)
    return () => window.removeEventListener('device-types-updated', handler)
  }, [])
  // Sizes — custom free-text entry (brand/color now come from Catalogue context)
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [customSizeInput, setCustomSizeInput] = useState('')
  // Bulk size custom entry
  const [showBulkCustomSize, setShowBulkCustomSize] = useState(false)
  const [bulkCustomSizeInput, setBulkCustomSizeInput] = useState('')
  const [addingDevice, setAddingDevice] = useState(false)
  // ── Pinpoint suggestions (Step 19) ───────────────────────────────────────
  const [savedPinpoints, setSavedPinpoints] = useState([])

  // NEW: Whether the user has unlocked manual code editing
  const [codeEditMode, setCodeEditMode] = useState(false)

  const filterOptions = useMemo(() => getUniqueDeviceFilterOptions(), [getUniqueDeviceFilterOptions])
  const locationHierarchy = useMemo(() => getIndianLocationHierarchyForFilter(), [])

  const sizesForNewProduct = useMemo(() => getSizesForProductType(newProductType), [newProductType])
  const brandsForNewProduct = useMemo(() => getBrandsForProductType(newProductType), [newProductType])

  // Auto-computed next code for the selected product type (TV-1 = TV-001 are the same, normalized)
  // For custom types like 'custom-MSE', prefix is 'MSE'
  const getEffectivePrefix = (type) => {
    if (type && type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
    return getCodePrefix(type)
  }
  const suggestedCode = useMemo(() => {
    const prefix = getEffectivePrefix(newProductType)
    const existing = devices.filter(d => d.code && d.code.toUpperCase().startsWith(prefix + '-'))
    const occupied = new Set(existing.map(d => {
      const s = d.code.toUpperCase().slice(prefix.length + 1)
      return /^\d+$/.test(s) ? parseInt(s, 10) : 0
    }).filter(n => n > 0))
    // Find first available number (fills gaps, same logic as bulk add)
    let next = 1
    while (occupied.has(next)) next++
    return `${prefix}-${String(next).padStart(3, '0')}`
  }, [devices, newProductType])

  // The effective code that will be used — auto-assigned unless user unlocked edit mode
  const effectiveCode = codeEditMode ? newDeviceCode.trim() : suggestedCode

  const codeValidation = useMemo(() => {
    if (!effectiveCode) return { valid: false, error: 'Code is required.' }
    if (newProductType && newProductType.startsWith('custom-')) {
      const isDup = devices.some(d => d.code && d.code.toUpperCase() === effectiveCode.toUpperCase())
      return isDup ? { valid: false, error: 'This code already exists.' } : { valid: true, error: null }
    }
    return validateDeviceCode(effectiveCode, newProductType, devices)
  }, [effectiveCode, newProductType, devices])

  const getDevicesForLifecycle = (list) => {
    if (lifecycleFilter === 'all') return list
    return list.filter((d) => getDeviceLifecycleStatus(d) === lifecycleFilter)
  }

  const filteredDevices = useMemo(() => {
    let list = selectedType
      // Filter by canonical type ID — resolveTypeId maps any legacy type string to the ID
      ? devices.filter(d => resolveTypeId(d.type) === selectedType || d.type === selectedType)
      : devices
    list = getDevicesForLifecycle(list)
    if (lifecycleFilter !== 'warehouse' && filterClientId) list = list.filter((d) => d.clientId === Number(filterClientId))
    
    // Health filter support (from URL params)
    if (healthFilter) {
      const healthValues = healthFilter.split(',')
      list = list.filter((d) => healthValues.includes(d.healthStatus))
    }

    // Exact lifecycle step filter — overrides coarse bucket, from dashboard drill-down
    if (exactLifecycleFilter) {
      const steps = exactLifecycleFilter.split(',')
      list = list.filter((d) => steps.includes(d.lifecycleStatus))
    }
    
    if (filterState === 'Warehouse') {
      list = list.filter((d) => !(d.state || '').trim() && (d.location || ''))
      if (filterPinpoint) list = list.filter((d) => (d.location || '') === filterPinpoint)
    } else if (filterState) {
      list = list.filter((d) => (d.state || '') === filterState)
      if (filterDistrict) list = list.filter((d) => (d.district || '') === filterDistrict)
      if (filterPinpoint) list = list.filter((d) => (d.location || '') === filterPinpoint)
    }
    if (filterBrand) list = list.filter((d) => (d.brand || '') === filterBrand)
    if (filterSize) list = list.filter((d) => (d.size || '') === filterSize)
    if (filterModel) list = list.filter((d) => (d.model || '').toLowerCase().includes(filterModel.toLowerCase()))
    
    // Apply unified search or legacy searchCode
    const searchTerm = unifiedSearch || searchCode
    if (searchTerm) list = list.filter((d) => d.code.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return list
  }, [
    devices,
    selectedType,
    getDevicesByType,
    lifecycleFilter,
    filterClientId,
    healthFilter,
    filterState,
    filterDistrict,
    filterPinpoint,
    filterBrand,
    filterSize,
    filterModel,
    searchCode,
    unifiedSearch,
    exactLifecycleFilter,
  ])

  // ── Unified Search Results for Sets ──────────────────────────────────────────
  const filteredSets = useMemo(() => {
    if (!unifiedSearch) return []
    const q = unifiedSearch.toLowerCase()
    return deviceSets.filter(s => 
      s.code?.toLowerCase().includes(q) || 
      s.name?.toLowerCase().includes(q) || 
      s.barcode?.toLowerCase().includes(q) ||
      s.setTypeName?.toLowerCase().includes(q)
    )
  }, [deviceSets, unifiedSearch])

  // Determine if search looks like a set code (starts with known set type prefixes)
  const looksLikeSetCode = useMemo(() => {
    if (!unifiedSearch) return false
    const upper = unifiedSearch.toUpperCase()
    return upper.startsWith('AST-') || upper.startsWith('IST-') || upper.startsWith('TAB-') || upper.match(/^[A-Z]{2,4}-\d/)
  }, [unifiedSearch])

  // Smart display of results based on what was found
  const shouldShowDevices = searchResultType === 'all' || searchResultType === 'devices'
  const shouldShowSets = (searchResultType === 'all' || searchResultType === 'sets') && unifiedSearch
  const hasDeviceResults = filteredDevices.length > 0
  const hasSetResults = filteredSets.length > 0

  // ── Pagination ───────────────────────────────────────────────────────────────
  const ITEMS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 whenever filters change
  const prevFilterKey = useRef(null)
  const filterKey = [
    filteredDevices.length,
    filteredDevices[0]?.id ?? '',
  ].join('|')
  if (prevFilterKey.current !== null && prevFilterKey.current !== filterKey) {
    setCurrentPage(1)
  }
  prevFilterKey.current = filterKey

  const totalPages     = Math.max(1, Math.ceil(filteredDevices.length / ITEMS_PER_PAGE))
  const safePage       = Math.min(currentPage, totalPages)
  const paginatedDevices = filteredDevices.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  const counts = useMemo(() => {
    // Group devices by canonical type ID (resolves all legacy strings automatically)
    // Exclude devices that are already part of a set (setId is set)
    const out = {}
    devices.forEach((d) => {
      if (d.setId) return
      const canonicalId = resolveTypeId(d.type) || d.type
      if (!canonicalId) return
      const passes = lifecycleFilter === 'all' || getDeviceLifecycleStatus(d) === lifecycleFilter
      if (passes) {
        out[canonicalId] = (out[canonicalId] || 0) + 1
      }
    })
    // Ensure all registry types have a 0 entry even if no devices
    getAllTypes().forEach(t => {
      if (!(t.id in out)) out[t.id] = 0
    })
    return out
  }, [devices, lifecycleFilter])

  const lifecycleTotals = useMemo(() => {
    const out = { all: devices.length, deployed: 0, assigning: 0, warehouse: 0 }
    devices.forEach((d) => {
      const status = getDeviceLifecycleStatus(d)
      if (out[status] !== undefined) out[status] += 1
    })
    return out
  }, [devices])

  const handleAddDeviceOpen = () => {
    setNewProductType('tv')
    setNewBrand('')
    setNewSize('')
    setNewColor('')
    setNewGpsId('')
    setNewMfgDate('')
    setNewInDate(nowLocalDatetime())
    setNewModel('')
    setNewDeviceCode('')
    setNewHealth('ok')
    setNewWarehouseId(null)
    setNewWarehouseZone('')
    setNewWarehouseSpecificLocation('')
    setShowCustomSize(false)
    setCustomSizeInput('')
    setCodeEditMode(false)
    setAddSubmitSuccess(null)
    setAddCodePreview(null)
    setShowAddDevice(true)   // same modal for both roles
  }

  const handleProductTypeChange = (type) => {
    setNewProductType(type)
    setNewBrand('')
    setNewSize('')
    setNewDeviceCode('')    // Reset manual code when type changes so auto-code recalculates
    setCodeEditMode(false)  // Return to auto mode when type changes
  }

  const handleAddDeviceSubmit = async () => {
    const code = effectiveCode
    if (!codeValidation.valid && !isGroundTeam) return

    setAddingDevice(true)

    try {
      const deviceData = {
        code: isGroundTeam ? undefined : code.toUpperCase(),
        type: newProductType,
        deviceTypeId: newProductType,
        deviceTypeName: allProductTypes[newProductType] || newProductType,
        brand: newBrand || undefined,
        size: newSize || undefined,
        color: newColor || undefined,
        gpsId: newGpsId.trim() || undefined,
        inDate: newInDate || undefined,
        model: newModel.trim() || undefined,
        healthStatus: newHealth || 'ok',
        lifecycleStatus: 'warehouse',
        note: '',
        // NEW: warehouse location
        warehouseId:               newWarehouseId   || undefined,
        warehouseZone:             newWarehouseZone || undefined,
        warehouseSpecificLocation: newWarehouseSpecificLocation || undefined,
        expectedCodeRange: isGroundTeam && addCodePreview ? addCodePreview.range : undefined,
      }

      if (isGroundTeam) {
        const result = await inventoryRequestApi.requestAddDevice(deviceData)
        setAddSubmitSuccess({
          range: addCodePreview?.range || null,
          requestId: result?.id,
          typeName: allProductTypes[newProductType] || newProductType,
        })
      } else {
        const newDevice = await addDevice({ ...deviceData, code: code.toUpperCase() })
        setSelectedDeviceForBarcode(newDevice)
        setShowBarcodeModal(true)
        setNewLifecycleStatus('warehouse')
        setShowAddDevice(false)
      }
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setAddingDevice(false)
    }
  }

  // NEW: Handle viewing barcode for existing devices
  const handleViewBarcode = async (device) => {
    // Always fetch fresh device data from the API before opening the barcode
    // view — the context array can be stale if health/lifecycle changed since
    // last refresh, causing the barcode card to show outdated health status.
    if (device.barcode) {
      try {
        const fresh = await scanDevice(device.barcode)
        setSelectedDeviceForBarcode(fresh)
      } catch {
        // Fallback to cached data if fetch fails
        setSelectedDeviceForBarcode(device)
      }
    } else {
      setSelectedDeviceForBarcode(device)
    }
    setShowBarcodeModal(true)
  }

  // Bulk add handler
  const handleBulkAddOpen = () => {
    setBulkProductType('tv')
    setBulkBrand('')
    setBulkSize('')
    setBulkColor('')
    setBulkModel('')
    setBulkMfgDate('')
    setBulkInDate(nowLocalDatetime())
    setBulkHealth('ok')
    setBulkLifecycleStatus('warehouse')
    setBulkQty(10)
    setBulkAddProgress(0)
    setShowBulkCustomSize(false)
    setBulkCustomSizeInput('')
    setBulkSubmitSuccess(null)
    setBulkCodePreview(null)
    setShowBulkAdd(true)
  }

  const handleBulkAddSubmit = async () => {
    if (!bulkQty || bulkQty < 1 || bulkQty > 500) return
    setBulkAdding(true)
    setBulkAddProgress(0)
    try {
      const payload = {
        type: bulkProductType,
        deviceTypeId: bulkProductType,
        deviceTypeName: allProductTypes[bulkProductType] || bulkProductType,
        brand: bulkBrand || undefined,
        size: bulkSize || undefined,
        color: bulkColor || undefined,
        model: bulkModel || undefined,
        inDate: bulkInDate || undefined,
        healthStatus: bulkHealth || 'ok',
        lifecycleStatus: 'warehouse',
        quantity: bulkQty,
        expectedCodeRange: isGroundTeam && bulkCodePreview ? bulkCodePreview.range : undefined,
        // NEW: warehouse location
        warehouseId:               newWarehouseId               || undefined,
        warehouseZone:             newWarehouseZone             || undefined,
        warehouseSpecificLocation: newWarehouseSpecificLocation || undefined,
      }

      if (isGroundTeam) {
        const result = await inventoryRequestApi.requestBulkAdd(payload)
        setBulkSubmitSuccess({
          range: bulkCodePreview?.range || null,
          qty: bulkQty,
          requestId: result?.id,
          typeName: allProductTypes[bulkProductType] || bulkProductType,
        })
      } else {
        const result = await bulkAddDevices(payload)
        setBulkCreatedDevices(result.devices)
        setShowBulkAdd(false)
        setShowBulkBarcodes(true)
      }
    } catch (error) {
      alert('Bulk add failed: ' + (error.response?.data?.error || error.message))
    } finally {
      setBulkAdding(false)
    }
  }

  const canAddDevice = isGroundTeam
    ? !!newBrand && !!newSize && !!newColor && !!newModel && !!newInDate
    : codeValidation.valid && !!effectiveCode && !!newBrand && !!newSize && !!newColor && !!newModel && !!newInDate

  const hasActiveFilters = filterClientId || filterState || filterDistrict || filterPinpoint || filterBrand || filterSize || filterModel

  // Location dropdown
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [hoveredState, setHoveredState] = useState(null)
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const locationDropdownRef = useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setLocationDropdownOpen(false)
        setHoveredState(null)
        setHoveredDistrict(null)
      }
    }
    if (locationDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [locationDropdownOpen])

  const locationLabel = useMemo(() => {
    if (filterState === 'Warehouse') return filterPinpoint ? filterPinpoint : 'Warehouse'
    if (filterPinpoint && filterState && filterDistrict) return `${filterState} → ${filterDistrict} → ${filterPinpoint}`
    if (filterDistrict && filterState) return `${filterState} → ${filterDistrict}`
    if (filterState) return filterState
    return 'All locations'
  }, [filterState, filterDistrict, filterPinpoint])

  const handleLocationSelect = (state, district, pinpoint) => {
    setFilterState(state || '')
    setFilterDistrict(district || '')
    setFilterPinpoint(pinpoint || '')
    setLocationDropdownOpen(false)
    setHoveredState(null)
    setHoveredDistrict(null)
  }

  // ── Pinpoint suggestions: fetch from DB when state+district are selected ──
  useEffect(() => {
    if (!filterState || filterState === 'Warehouse') { setSavedPinpoints([]); return }
    const token = localStorage.getItem('token')
    const params = new URLSearchParams({ state: filterState })
    if (filterDistrict) params.set('district', filterDistrict)
    fetch(`/api/catalogue/pinpoints?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setSavedPinpoints)
      .catch(() => {})
  }, [filterState, filterDistrict])

  // ── Live code preview for ground team — single add modal ──────────────────
  useEffect(() => {
    if (!isGroundTeam || !showAddDevice || !newProductType) return
    setAddCodePreview(null)
    setAddCodePreviewLoading(true)
    const prefix = getCodePrefix(newProductType)
    const t = setTimeout(() => {
      const token = localStorage.getItem('token')
      fetch(`/api/devices/next-codes?prefix=${prefix}&qty=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setAddCodePreview(data) })
        .catch(() => {})
        .finally(() => setAddCodePreviewLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [isGroundTeam, showAddDevice, newProductType])

  // ── Live code preview for ground team — bulk add modal ───────────────────
  useEffect(() => {
    if (!isGroundTeam || !showBulkAdd || !bulkProductType || !bulkQty) return
    setBulkCodePreview(null)
    setBulkCodePreviewLoading(true)
    const prefix = getCodePrefix(bulkProductType)
    const qty = Math.max(1, parseInt(bulkQty) || 1)
    const t = setTimeout(() => {
      const token = localStorage.getItem('token')
      fetch(`/api/devices/next-codes?prefix=${prefix}&qty=${qty}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setBulkCodePreview(data) })
        .catch(() => {})
        .finally(() => setBulkCodePreviewLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [isGroundTeam, showBulkAdd, bulkProductType, bulkQty])

  // Make Set handlers
  const handleOpenMakeSetModal = () => {
    setShowMakeSetModal(true)
    setSelectedSetType(null)
    setSelectedComponents({})
    setSetName('')
  }

  const handleCloseMakeSetModal = () => {
    setShowMakeSetModal(false)
    setSelectedSetType(null)
    setSelectedComponents({})
    setSetName('')
  }

  const handleSetTypeSelect = (typeKey) => {
    setSelectedSetType(typeKey)
    setSelectedComponents({})
    setSetName('')
  }

  const handleComponentSelect = (componentKey, value) => {
    setSelectedComponents(prev => ({
      ...prev,
      [componentKey]: value
    }))
  }

  const canCreateSet = () => {
    if (!selectedSetType || !setName.trim()) return false
    
    const setType = SET_TYPES[selectedSetType]
    const allComponentsSelected = setType.components.every(
      comp => selectedComponents[comp.key]
    )
    
    return allComponentsSelected
  }

  const handleCreateSet = () => {
    if (!canCreateSet()) return

    const setType = SET_TYPES[selectedSetType]
    
    createDeviceSet({
      type: selectedSetType,
      name: setName.trim(),
      components: selectedComponents,
      setTypeLabel: setType.label,
    })

    handleCloseMakeSetModal()
  }

  const saveCustomType = () => {
    if (!newTypeName.trim() || !newTypeCode.trim()) return
    const code = newTypeCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    try {
      addCustomTypeToRegistry({ id: code, label: newTypeName.trim() })
      setCustomProductTypes(getAllTypes().filter(t => !t.isBuiltin))
    } catch (e) {
      alert(e.message)
      return
    }
    setNewTypeName(''); setNewTypeCode(''); setShowAddTypeModal(false)
  }

  const deleteCustomType = (id) => {
    deleteCustomTypeFromRegistry(id)
    setCustomProductTypes(getAllTypes().filter(t => !t.isBuiltin))
  }



  const allProductTypes = useMemo(
    () => Object.fromEntries(getAllTypes().map(t => [t.id, t.label])),
    [customProductTypes]
  )

  const handleDeleteSet = (setId) => {
    if (confirm('Are you sure you want to dismantle this set? Components will be returned to inventory.')) {
      deleteDeviceSet(setId)
    }
  }

  const getAvailableStock = (inventoryKey) => {
    return componentInventory[inventoryKey] || 0
  }

  return (
    <div className="space-y-6">
      {/* Catalogue drawer — manager only */}
      {isManager && <CommandCentre open={showCatalogue} onClose={() => setShowCatalogue(false)} />}

      {/* Header with Tabs */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Smartphone className="w-7 h-7 md:w-8 md:h-8 text-primary-600" />
              Devices & Sets
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Manage devices, create sets, and track inventory
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isManager && (
              <button
                type="button"
                onClick={() => setShowCatalogue(true)}
                className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium text-sm shadow-sm"
              >
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:inline">Catalogue</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrintQR(true)}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium text-sm shadow-sm"
            >
              <Printer className="w-4 h-4 text-violet-500" />
              <span className="hidden sm:inline">Print QR</span>
            </button>
            <Link
              to="/dashboard/movements"
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium text-sm shadow-sm"
            >
              <Truck className="w-4 h-4 text-teal-500" />
              <span className="hidden sm:inline">Movements</span>
            </Link>
            {isManager && (
              <DeletionsDrawerButton onRefreshDevices={refresh} pendingCount={scheduledDeletionIds.size} />
            )}
            <button
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-md text-sm"
            >
              <ScanBarcode className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Scan Barcode</span>
              <span className="sm:hidden">Scan</span>
            </button>
            <button
              type="button"
              onClick={handleBulkAddOpen}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm"
            >
              <PackagePlus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">{isGroundTeam ? 'Request Bulk Add' : 'Bulk Add'}</span>
              <span className="sm:hidden">Bulk</span>
            </button>
            <button
              type="button"
              onClick={handleAddDeviceOpen}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">{isGroundTeam ? 'Request Add' : 'Add Product'}</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 inline-flex gap-1">
          <button
            onClick={() => {}}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all bg-primary-600 text-white shadow-sm`}
          >
            <Smartphone className="w-4 h-4" />
            Devices
          </button>
          <button
            onClick={() => navigate('/dashboard/makesets')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all text-gray-600 hover:bg-gray-50`}
          >
            <Box className="w-4 h-4" />
            Make Sets
          </button>
        </div>
      </div>

      {/* Device list content */}
      <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">View by lifecycle</p>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex gap-3 flex-nowrap min-w-max">
            {LIFECYCLE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = lifecycleFilter === opt.value
              const total = lifecycleTotals[opt.value] ?? 0
              const style = isActive
                ? opt.value === 'deployed'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : opt.value === 'assigning'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-slate-600 text-white border-slate-600 shadow-md'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              return (
                <button
                  key={opt.value}
                  onClick={() => setLifecycleFilter(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-5 py-3 text-left transition-all min-w-[160px] ${style}`}
                  title={opt.desc}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white/20' : 'bg-gray-200/80'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className={`text-xl font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>{total}</p>
                  </div>
                </button>
              )
            })}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {lifecycleFilter === 'deployed' && 'Showing devices in use at client locations.'}
            {lifecycleFilter === 'assigning' && 'Showing devices assigned to clients but not yet at site.'}
            {lifecycleFilter === 'warehouse' && 'Showing devices in Warehouse A, B or C.'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-600" />
            Filters & views
          </span>
          {hasActiveFilters && (
            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
          )}
          <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
        </button>
        {showFilters && (
          <div className="border-t border-gray-200 p-4 space-y-6">
            <p className="text-sm text-gray-600">
              Counts below match your lifecycle view above. Click a card to filter by product type; use dropdowns for more filters.
            </p>

            {/* Individual items */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Box className="w-4 h-4" />
                Individual items
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {/* Registry-driven: all built-in + custom types, counts by canonical ID */
                getAllTypes().map((typeEntry) => {
                  const Icon = PRODUCT_TYPE_ICONS[typeEntry.id] || Box
                  const count = counts[typeEntry.id] ?? 0
                  const isSelected = selectedType === typeEntry.id
                  const colors = getColorClasses(typeEntry.color)
                  return (
                    <button
                      key={typeEntry.id}
                      type="button"
                      onClick={() => setSelectedType(isSelected ? null : typeEntry.id)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md shrink-0 bg-primary-100 text-primary-600">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{typeEntry.label}</p>
                          <p className="text-base font-bold text-primary-600">{count}</p>
                          <p className="text-xs text-gray-400 font-mono">{typeEntry.id}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sets */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Sets
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { typeKey: 'aStand',      label: 'A stand',  icon: LayoutGrid },
                  { typeKey: 'iStand',      label: 'I stand',  icon: Monitor },
                  { typeKey: 'tabletCombo', label: 'Tablet',   icon: TabletIcon },
                ].map(({ typeKey, label, icon: Icon }) => {
                  const setCount = deviceSets.filter(s => s.setType === typeKey).length
                  return (
                    <div
                      key={typeKey}
                      className="rounded-xl border-2 border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary-100 text-primary-600 shrink-0">
                          <Icon className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{label}</p>
                          <p className="text-xl font-bold text-primary-600">{setCount}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-gray-100">
              {lifecycleFilter !== 'warehouse' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                  <select
                    value={filterClientId}
                    onChange={(e) => setFilterClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Location dropdown */}
              <div className="relative" ref={locationDropdownRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</label>
                <button
                  type="button"
                  onClick={() => setLocationDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <span className="truncate">{locationLabel}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${locationDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {locationDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 max-h-[320px] flex">
                    <div className="overflow-y-auto py-1 min-w-[180px]">
                      <button
                        type="button"
                        onClick={() => handleLocationSelect('', '', '')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${!filterState ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                      >
                        All locations
                      </button>
                      {locationHierarchy.states.map((state) => (
                        <div
                          key={state}
                          className="relative group"
                          onMouseEnter={() => { setHoveredState(state); setHoveredDistrict(null) }}
                          onMouseLeave={() => setHoveredState(null)}
                        >
                          <button
                            type="button"
                            onClick={() => handleLocationSelect(state, '', '')}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && !filterDistrict ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                          >
                            <span>{state}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          </button>
                          {hoveredState === state && (locationHierarchy.districtsByState[state]?.length > 0) && (
                            <div
                              className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg"
                              onMouseEnter={() => setHoveredState(state)}
                              onMouseLeave={() => setHoveredDistrict(null)}
                            >
                              {locationHierarchy.districtsByState[state].map((district) => (
                                <div
                                  key={district}
                                  className="relative group"
                                  onMouseEnter={() => setHoveredDistrict(`${state}|${district}`)}
                                  onMouseLeave={() => setHoveredDistrict(null)}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleLocationSelect(state, district, '')}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && filterDistrict === district && !filterPinpoint ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                  >
                                    <span>{district}</span>
                                    {(locationHierarchy.locationsByStateDistrict[`${state}|${district}`]?.length > 0) && (
                                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                    )}
                                  </button>
                                  {hoveredDistrict === `${state}|${district}` && (locationHierarchy.locationsByStateDistrict[`${state}|${district}`]?.length > 0) && (
                                    <div className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg">
                                      {locationHierarchy.locationsByStateDistrict[`${state}|${district}`].map((loc) => (
                                        <button
                                          key={loc}
                                          type="button"
                                          onClick={() => handleLocationSelect(state, district, loc)}
                                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && filterDistrict === district && filterPinpoint === loc ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                        >
                                          {loc}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {hoveredState === state && (locationHierarchy.districtsByState[state]?.length === 0) && (locationHierarchy.locationsByStateDistrict[`${state}|`]?.length > 0) && (
                            <div
                              className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg"
                              onMouseEnter={() => setHoveredState(state)}
                            >
                              {locationHierarchy.locationsByStateDistrict[`${state}|`].map((loc) => (
                                <button
                                  key={loc}
                                  type="button"
                                  onClick={() => handleLocationSelect(state, '', loc)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && !filterDistrict && filterPinpoint === loc ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                >
                                  {loc}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Brand</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All brands</option>
                  {filterOptions.brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Size</label>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All sizes</option>
                  {filterOptions.sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Box className="w-3.5 h-3.5" /> Model</label>
                <input
                  type="text"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  placeholder="Search model..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device list table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 space-y-3">
          {/* Unified Search Bar */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices or sets (code, name, barcode)..."
                value={unifiedSearch}
                onChange={(e) => setUnifiedSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
              {unifiedSearch && (
                <button
                  onClick={() => setUnifiedSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            
            {/* Filter Toggle Buttons */}
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSearchResultType('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  searchResultType === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSearchResultType('devices')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  searchResultType === 'devices'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  Devices
                </span>
              </button>
              <button
                onClick={() => setSearchResultType('sets')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  searchResultType === 'sets'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Sets
                </span>
              </button>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center gap-2 flex-wrap">
            {lifecycleFilter === 'deployed' && <Truck className="w-5 h-5 text-emerald-600" />}
            {lifecycleFilter === 'assigning' && <Link2 className="w-5 h-5 text-amber-600" />}
            {lifecycleFilter === 'warehouse' && <Package className="w-5 h-5 text-slate-600" />}
            <h3 className="font-semibold text-gray-900">
              {selectedType ? getDeviceTypeLabel(selectedType) : 'All types'}
              {unifiedSearch && (
                <span className="text-gray-500 font-normal ml-2">
                  — {hasDeviceResults && shouldShowDevices && `${filteredDevices.length} device${filteredDevices.length !== 1 ? 's' : ''}`}
                  {hasDeviceResults && hasSetResults && shouldShowDevices && shouldShowSets && ', '}
                  {hasSetResults && shouldShowSets && `${filteredSets.length} set${filteredSets.length !== 1 ? 's' : ''}`}
                </span>
              )}
              {!unifiedSearch && (
                <span className="text-gray-500 font-normal ml-1">
                  — {filteredDevices.length} {lifecycleFilter === 'all' ? 'total' : lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'in warehouse'}
                </span>
              )}
            </h3>
            {selectedType && (
              <button type="button" onClick={() => setSelectedType(null)} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium hover:bg-primary-200 transition-colors">
                <X className="w-3 h-3" /> Clear type filter
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Brand</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">In Set</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Lifecycle</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned to</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Subscription</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Health</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-500">
                    No {lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'warehouse'} devices
                    {selectedType || filterClientId || filterState || filterBrand || filterSize || filterModel || searchCode ? '. Try clearing filters.' : '.'}
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device) => {
                  const lifecycle = getDeviceLifecycleStatus(device)
                  const client = device.clientId ? getClientById(device.clientId) : null
                  const subStatus = device.subscriptionStart && device.subscriptionEnd
                    ? getSubscriptionStatus(device.subscriptionEnd)
                    : { type: 'active', label: '—' }
                  const filterStatus = getSubscriptionFilterStatus(device.subscriptionStart, device.subscriptionEnd)

                  // ── Exact granular step for display ──────────────────────
                  const exactStep  = device.lifecycleStatus || 'available'
                  const stepLabel  = LIFECYCLE_LABELS[exactStep] || exactStep
                  const stepColors = LIFECYCLE_COLORS[exactStep] || LIFECYCLE_COLORS.available
                  const hasPending = pendingDeviceIds.has(device.id)
                  const isScheduledDeletion = scheduledDeletionIds.has(device.id)

                  // ── Location column logic ─────────────────────────────────
                  // In set → "In Set · ASET-001 · WH Delhi › Zone A"
                  // deployed / under_maintenance → full site location
                  // return_initiated / return_transit → client name + "Returning"
                  // assigning → installed → client name + target location if known
                  // warehouse / available / returned → warehouse name + zone + specific location
                  const locationDisplay = (() => {
                    const s = exactStep
                    // Device belongs to a set — show set code + set's warehouse location
                    if (device.setId) {
                      const set = deviceSets.find(ds => ds.id === device.setId || ds.id === Number(device.setId))
                      const setCode = set ? (set.code || set.name || `Set #${device.setId}`) : `Set #${device.setId}`
                      const locParts = set ? [
                        set.warehouse?.name || (set.warehouseId ? `WH #${set.warehouseId}` : null),
                        set.warehouseZone,
                        set.warehouseSpecificLocation,
                      ].filter(Boolean) : []
                      return locParts.length > 0
                        ? `In Set · ${setCode} · ${locParts.join(' › ')}`
                        : `In Set · ${setCode}`
                    }
                    if (s === 'active' || s === 'under_maintenance' || s === 'deployed') {
                      return [device.state, device.district, device.location].filter(Boolean).join(' → ') || '—'
                    }
                    if (s === 'return_initiated' || s === 'return_transit') {
                      return client ? `${client.name} · Returning` : 'Returning'
                    }
                    if (['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed'].includes(s)) {
                      const parts = []
                      if (client) parts.push(client.name)
                      const loc = [device.state, device.district].filter(Boolean).join(' → ')
                      if (loc) parts.push(loc)
                      return parts.join(' · ') || '—'
                    }
                    // warehouse / returned / available — build from structured warehouse fields
                    const whParts = [
                      device.warehouse?.name || (device.warehouseId ? `Warehouse #${device.warehouseId}` : null),
                      device.warehouseZone,
                      device.warehouseSpecificLocation,
                    ].filter(Boolean)
                    return whParts.length > 0 ? whParts.join(' › ') : (device.location || 'Warehouse')
                  })()

                  const LifecycleIcon = lifecycle === 'deployed' ? Truck : lifecycle === 'assigning' ? Link2 : Package

                  return (
                    <>
                    <tr key={device.id} className={`group hover:bg-gray-50 ${isScheduledDeletion ? 'bg-red-50/30' : hasPending ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-3 px-4 sticky left-0 bg-white z-10 border-r border-gray-100 group-hover:bg-gray-50">
                        <span className="inline-flex items-center gap-1.5 font-mono font-medium text-gray-900">
                          <QrCode className="w-4 h-4 text-gray-400" />
                          {device.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{getDeviceTypeLabel(device.type)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{device.brand || '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{device.size || '—'}</td>
                      <td className="py-3 px-4 text-sm">
                        {device.setId ? (() => {
                          const set = deviceSets.find(s => s.id === device.setId || s.id === Number(device.setId))
                          return (
                            <button
                              type="button"
                              onClick={() => set && setSelectedSet(set)}
                              title="View set details"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 hover:border-orange-300 transition-colors cursor-pointer"
                            >
                              <Layers className="w-3 h-3" />
                              {set ? (set.code || set.name || `Set #${device.setId}`) : `Set #${device.setId}`}
                            </button>
                          )
                        })() : (
                          <span className="text-gray-400 text-xs">Individual</span>
                        )}
                      </td>
                      {/* ── Lifecycle column: exact step + pending badge ── */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stepColors.bg} ${stepColors.text} border-transparent`}>
                              <LifecycleIcon className="w-3.5 h-3.5" />
                              {stepLabel}
                            </span>
                            {hasPending && (
                              <span
                                title="Awaiting manager approval"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300"
                              >
                                🕐 Pending
                              </span>
                            )}
                          </div>
                          {isScheduledDeletion && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                              ⏳ Pending Deletion
                            </span>
                          )}
                        </div>
                      </td>
                      {/* ── Location column ── */}
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {lifecycle === 'deployed' && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                        {lifecycle === 'assigning' && (
                          <span className="flex items-center gap-1 text-blue-700">
                            <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                        {lifecycle === 'warehouse' && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {client ? <span className="flex items-center gap-1 text-gray-700"><User className="w-3.5 h-3.5 text-gray-400" />{client.name}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {device.subscriptionEndDate ? (
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{fmtDate(device.subscriptionEndDate)}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const hs = getHealthStyle(device.healthStatus)
                          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${hs.badge}`}>{hs.label}</span>
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {device.barcode && (
                            <button type="button" onClick={() => handleViewBarcode(device)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View barcode">
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}

                          {device.setId && (
                            <span
                              title={`Part of a set — manage lifecycle via the set`}
                              className="p-1.5 text-orange-400 inline-flex items-center"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          )}
                          <button type="button" onClick={() => setDetailDevice(device)} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        </div>
                      </td>
                    </tr>

                  </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredDevices.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm px-4">
              No {lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'warehouse'} devices
              {selectedType || filterClientId || filterState || filterBrand || filterSize || filterModel || searchCode ? '. Try clearing filters.' : '.'}
            </div>
          ) : (
            paginatedDevices.map((device) => {
              const lifecycle = getDeviceLifecycleStatus(device)
              const client = device.clientId ? getClientById(device.clientId) : null
              const exactStep  = device.lifecycleStatus || 'available'
              const stepLabel  = LIFECYCLE_LABELS[exactStep] || exactStep
              const stepColors = LIFECYCLE_COLORS[exactStep] || LIFECYCLE_COLORS.available
              const hasPending = pendingDeviceIds.has(device.id)
              const isScheduledDeletion = scheduledDeletionIds.has(device.id)

              const locationDisplay = (() => {
                const s = exactStep
                // Device belongs to a set — show set code + set's warehouse location
                if (device.setId) {
                  const setObj = deviceSets.find(ds => ds.id === device.setId || ds.id === Number(device.setId))
                  const setCode = setObj ? (setObj.code || setObj.name || `Set #${device.setId}`) : `Set #${device.setId}`
                  const locParts = setObj ? [
                    setObj.warehouse?.name || (setObj.warehouseId ? `WH #${setObj.warehouseId}` : null),
                    setObj.warehouseZone,
                    setObj.warehouseSpecificLocation,
                  ].filter(Boolean) : []
                  return locParts.length > 0
                    ? `In Set · ${setCode} · ${locParts.join(' › ')}`
                    : `In Set · ${setCode}`
                }
                if (s === 'active' || s === 'under_maintenance' || s === 'deployed') {
                  return [device.state, device.district, device.location].filter(Boolean).join(' → ') || '—'
                }
                if (s === 'return_initiated' || s === 'return_transit') {
                  return client ? `${client.name} · Returning` : 'Returning'
                }
                if (['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed'].includes(s)) {
                  const parts = []
                  if (client) parts.push(client.name)
                  const loc = [device.state, device.district].filter(Boolean).join(' → ')
                  if (loc) parts.push(loc)
                  return parts.join(' · ') || '—'
                }
                // warehouse / returned / available — build from structured warehouse fields
                const whParts = [
                  device.warehouse?.name || (device.warehouseId ? `Warehouse #${device.warehouseId}` : null),
                  device.warehouseZone,
                  device.warehouseSpecificLocation,
                ].filter(Boolean)
                return whParts.length > 0 ? whParts.join(' › ') : (device.location || 'Warehouse')
              })()

              const LifecycleIcon = lifecycle === 'deployed' ? Truck : lifecycle === 'assigning' ? Link2 : Package
              const hs = getHealthStyle(device.healthStatus)
              const set = device.setId ? deviceSets.find(s => s.id === device.setId || s.id === Number(device.setId)) : null
              return (
                <div key={device.id} className={`p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors ${isScheduledDeletion ? 'bg-red-50/30' : hasPending ? 'bg-amber-50/40' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono font-bold text-gray-900 text-base flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-gray-400" />
                        {device.code}
                      </span>
                      <p className="text-sm text-gray-600 mt-0.5">{getDeviceTypeLabel(device.type)}{device.brand ? ` · ${device.brand}` : ''}{device.size ? ` · ${device.size}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hs.badge}`}>{hs.label}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {/* Exact lifecycle step badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stepColors.bg} ${stepColors.text}`}>
                      <LifecycleIcon className="w-3 h-3" />
                      {stepLabel}
                    </span>
                    {isScheduledDeletion && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                        ⏳ Pending Deletion
                      </span>
                    )}
                    {hasPending && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                        🕐 Pending
                      </span>
                    )}
                    {set && (
                      <button
                        type="button"
                        onClick={() => setSelectedSet(set)}
                        title="View set details"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3 h-3" />
                        {set.code || set.name || `Set #${device.setId}`}
                      </button>
                    )}
                    {client && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <User className="w-3 h-3" />
                        {client.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{locationDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {device.barcode && (
                        <button type="button" onClick={() => handleViewBarcode(device)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}

                      {device.setId && (
                        <span
                          title="Part of a set — manage lifecycle via the set"
                          className="p-2 text-orange-400 inline-flex items-center"
                        >
                          <Lock className="w-4 h-4" />
                        </span>
                      )}
                      <button type="button" onClick={() => setDetailDevice(device)} className="px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        View
                      </button>
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>
      </div>


      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {filteredDevices.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-white">
          {/* Count label */}
          <p className="text-sm text-gray-500 shrink-0">
            Showing{' '}
            <span className="font-semibold text-gray-700">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filteredDevices.length)}
            </span>
            {' '}of{' '}
            <span className="font-semibold text-gray-700">{filteredDevices.length}</span>
            {' '}devices
          </p>

          {/* Page buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg
                  hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>

              {/* Page numbers */}
              {(() => {
                const pages = []
                const delta = 2
                const left  = safePage - delta
                const right = safePage + delta

                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                    pages.push(i)
                  } else if (i === left - 1 || i === right + 1) {
                    pages.push('...')
                  }
                }

                return pages.map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[34px] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors
                        ${safePage === p
                          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                          : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      {p}
                    </button>
                  )
                )
              })()}

              {/* Next */}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg
                  hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Sets Search Results ───────────────────────────────────────────────── */}
      {shouldShowSets && hasSetResults && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-violet-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-600" />
              Sets Found
              <span className="px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded-full">
                {filteredSets.length}
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Click on any set to view details and components
            </p>
          </div>

          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSets.map((set) => {
              // Calculate actual health from components
              const calculatedHealth = calculateSetHealth(set.components)
              const healthInfo = getHealthDisplayInfo(calculatedHealth)
              const healthSummary = getComponentHealthSummary(set.components)
              const totalComps = set.components?.length || 0

              const setLifecycle = set.lifecycleStatus || 'available'
              const setStepMeta = STEP_META[setLifecycle]

              return (
                <div
                  key={set.id}
                  onClick={() => setSelectedSet(set)}
                  className={`rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer group bg-white
                    ${calculatedHealth === 'damage' ? 'border-2 border-red-300' : 
                      calculatedHealth === 'repair' ? 'border-2 border-amber-300' : 
                      calculatedHealth === 'lost' ? 'border-2 border-gray-300' : 
                      'border-2 border-gray-200 hover:border-violet-400'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900 text-sm font-mono">{set.code}</p>
                      <p className="text-xs text-gray-500">{set.setTypeName}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
                  </div>

                  {set.name && (
                    <p className="text-sm text-gray-700 font-medium mb-2 truncate">{set.name}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {/* Use calculated health */}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${healthInfo.badge}`}>
                      {healthInfo.label}
                    </span>
                    {setStepMeta && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${setStepMeta.bgClass} ${setStepMeta.textClass} ${setStepMeta.borderClass}`}>
                        {setStepMeta.label}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Package className="w-3.5 h-3.5" />
                      <span>{totalComps} component{totalComps !== 1 ? 's' : ''}</span>
                      {set.location && (
                        <>
                          <span className="mx-1">·</span>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{set.location}</span>
                        </>
                      )}
                    </div>

                    {totalComps > 0 && (
                      <div className="flex items-center gap-2 text-[10px] font-medium">
                        {healthSummary.ok > 0 && (
                          <span className="text-emerald-600 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> {healthSummary.ok}
                          </span>
                        )}
                        {healthSummary.repair > 0 && (
                          <span className="text-amber-600 flex items-center gap-0.5">
                            <Wrench className="w-3 h-3" /> {healthSummary.repair}
                          </span>
                        )}
                        {healthSummary.damage > 0 && (
                          <span className="text-red-600 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> {healthSummary.damage}
                          </span>
                        )}
                        {healthSummary.lost > 0 && (
                          <span className="text-gray-600 flex items-center gap-0.5">
                            <XCircle className="w-3 h-3" /> {healthSummary.lost}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Set Detail — opens SetBarcodeGenerator directly (unified UI) ─────── */}
      {selectedSet && (
        <SetBarcodeGenerator
          key={selectedSet.barcode || selectedSet.id}
          set={selectedSet}
          onClose={() => setSelectedSet(null)}
          onSetUpdated={(updated) => {
            setSelectedSet(null)
            refresh()
          }}
        />
      )}

      {/* Set Barcode Generator */}
      {showSetBarcode && (
        <SetBarcodeGenerator
          key={showSetBarcode.barcode || showSetBarcode.id}
          set={showSetBarcode}
          onClose={() => setShowSetBarcode(null)}
        />
      )}

      {/* Device detail modal */}
      {detailDevice && (
        <DeviceDetailModal
          device={detailDevice}
          deviceSets={deviceSets}
          getClientById={getClientById}
          getSubscriptionStatus={getSubscriptionStatus}
          statusStyles={statusStyles}
          getHealthStyle={getHealthStyle}
          getDeviceTypeLabel={getDeviceTypeLabel}
          getDeviceLifecycleStatus={getDeviceLifecycleStatus}
          onClose={() => setDetailDevice(null)}
          onViewBarcode={(d) => { setDetailDevice(null); handleViewBarcode(d) }}
          isManager={isManager}
          onDelete={async (id, reason) => {
            const result = await deletionRequestApi.scheduleDevice(id, reason)
            setDetailDevice(null)
            return result
          }}
        />
      )}

            {/* Add device modal */}
      {showAddDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAddDevice(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {isGroundTeam ? 'Request Add Product' : 'Add Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {isGroundTeam
                ? 'Fill in the details below. A manager will review and approve your request.'
                : 'All fields marked * are required. Select N/A where not applicable. Barcode auto-generated.'}
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Product type *</label>
                  {isManager && (
                    <button type="button" onClick={() => setShowAddTypeModal(true)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new type</button>
                  )}
                </div>
                <select value={newProductType} onChange={(e) => handleProductTypeChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                  {Object.entries(allProductTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Brand *</label>
                  {isManager && (
                    <span className="text-xs text-gray-400">Manage in Catalogue</span>
                  )}
                </div>
                <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newBrand ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select brand *</option>
                  <option value="N/A">N/A — Not Applicable</option>
                  {[...brandsForNewProduct, ...catalogueBrands.filter(b => !brandsForNewProduct.includes(b))].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Size *</label>
                  {isManager && (
                    <span className="text-xs text-gray-400">Manage in Catalogue</span>
                  )}
                </div>
                <select value={newSize} onChange={(e) => setNewSize(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newSize ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select size *</option>
                  <option value="N/A">N/A — Not Applicable</option>
                  {[...sizesForNewProduct, ...catalogueSizes.filter(s => !sizesForNewProduct.includes(s))].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <div className="flex gap-2">
                  <input type="text" value={newModel === 'N/A' ? '' : newModel} onChange={(e) => setNewModel(e.target.value)} disabled={newModel === 'N/A'} placeholder="e.g. Tab S8, Frame 55" className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newModel ? 'border-red-300 bg-red-50' : 'border-gray-200'} disabled:bg-gray-100 disabled:text-gray-400`} />
                  <button type="button" onClick={() => setNewModel(newModel === 'N/A' ? '' : 'N/A')} className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${newModel === 'N/A' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>N/A</button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Color *</label>
                  {isManager && (
                    <span className="text-xs text-gray-400">Manage in Catalogue</span>
                  )}
                </div>
                <select value={newColor} onChange={(e) => setNewColor(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newColor ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select color *</option>
                  <option value="N/A">N/A — Not Applicable</option>
                  {[...DEVICE_COLORS, ...catalogueColors.filter(col => !DEVICE_COLORS.includes(col))].map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS ID</label>
                <input
                  type="text"
                  value={newGpsId}
                  onChange={(e) => setNewGpsId(e.target.value)}
                  placeholder="Optional tracking ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IN Date &amp; Time * <span className="text-xs text-gray-400 font-normal">(When device entered warehouse)</span></label>
                <input type="datetime-local" value={newInDate} onChange={(e) => setNewInDate(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newInDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health / Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICE_HEALTH_STATUS.map((h) => (
                    <button key={h.value} type="button" onClick={() => setNewHealth(h.value)} className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${newHealth === h.value ? h.value === 'ok' ? 'bg-emerald-500 text-white border-emerald-500' : h.value === 'repair' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {h.value === 'ok' ? '✓ OK' : h.value === 'repair' ? '🔧 Repair' : '⚠ Damage'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Location *</label>
                <WarehouseLocationSelector
                  warehouseId={newWarehouseId}
                  zone={newWarehouseZone}
                  specificLocation={newWarehouseSpecificLocation}
                  onWarehouseChange={setNewWarehouseId}
                  onZoneChange={setNewWarehouseZone}
                  onSpecificLocationChange={setNewWarehouseSpecificLocation}
                  required={true}
                />
              </div>
              {!isGroundTeam && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Unique code *
                  </label>
                  {codeEditMode ? (
                    <button
                      type="button"
                      onClick={() => { setCodeEditMode(false); setNewDeviceCode('') }}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      ↩ Use auto-assigned
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCodeEditMode(true)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                      ✏ Edit manually
                    </button>
                  )}
                </div>

                {codeEditMode ? (
                  <>
                    <input
                      type="text"
                      value={newDeviceCode}
                      onChange={(e) => setNewDeviceCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder={`e.g. ${getCodePrefix(newProductType)}-001`}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 font-mono text-sm ${
                        newDeviceCode && !codeValidation.valid
                          ? 'border-red-400 focus:ring-red-400 bg-red-50'
                          : newDeviceCode && codeValidation.valid
                            ? 'border-green-400 focus:ring-green-400 bg-green-50'
                            : 'border-gray-200 focus:ring-primary-500'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must start with <span className="font-mono font-semibold text-gray-700">{getCodePrefix(newProductType)}-</span> followed by a number.
                      Tip: <button type="button" onClick={() => setNewDeviceCode(suggestedCode)} className="text-primary-600 hover:underline font-mono">{suggestedCode}</button>
                    </p>
                    {newDeviceCode && codeValidation.error && (
                      <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                        <span className="shrink-0">⚠</span> {codeValidation.error}
                      </p>
                    )}
                    {newDeviceCode && codeValidation.valid && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <span>✓</span> Code is unique and valid.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                    <span className="font-mono font-semibold text-primary-800 text-sm">{suggestedCode}</span>
                    <span className="ml-auto text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Auto-assigned</span>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-1.5">
                  Codes like <span className="font-mono">{getCodePrefix(newProductType)}-1</span>, <span className="font-mono">{getCodePrefix(newProductType)}-01</span>, <span className="font-mono">{getCodePrefix(newProductType)}-001</span> are treated as identical — no duplicates allowed.
                </p>
              </div>
              )}

              {/* Bottom info box — barcode for manager, request notice for ground team */}
              {isGroundTeam ? (
                <>
                  {/* Live code preview */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <p className="font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                      <span>🔢</span> Device code that will be created (after approval):
                    </p>
                    {addCodePreviewLoading ? (
                      <p className="text-gray-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
                      </p>
                    ) : addCodePreview ? (
                      <p className="font-mono font-bold text-primary-700 text-sm">{addCodePreview.range}</p>
                    ) : (
                      <p className="text-gray-400 italic">Select a product type to preview</p>
                    )}
                  </div>
                  {/* Approval notice */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Send className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-900">
                        <p className="font-medium">Request will be sent to manager for approval</p>
                        <p className="text-xs mt-1">Device code and barcode will be generated only after approval.</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <QrCode className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium">Barcode will be auto-generated</p>
                      <p className="text-xs mt-1">You can print/download the barcode after adding the device.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Footer — success state OR normal buttons */}
            {isGroundTeam && addSubmitSuccess ? (
              <div className="mt-6 space-y-3">
                {/* Success banner */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <p className="font-bold text-emerald-800 text-sm">Request Submitted!</p>
                  </div>
                  <p className="text-xs text-emerald-700 mb-1">
                    <span className="font-medium">{addSubmitSuccess.typeName}</span> — pending manager approval.
                  </p>
                  {addSubmitSuccess.range && (
                    <div className="mt-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Expected device code:</p>
                      <p className="font-mono font-bold text-primary-700">{addSubmitSuccess.range}</p>
                      <p className="text-xs text-gray-400 mt-1">This code will be confirmed after approval.</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (addSubmitSuccess.requestId && window.confirm('Withdraw this request?')) {
                        try {
                          await inventoryRequestApi.reject(addSubmitSuccess.requestId, 'Withdrawn by requester')
                          setShowAddDevice(false)
                          setAddSubmitSuccess(null)
                        } catch (e) { alert('Could not withdraw: ' + e.message) }
                      }
                    }}
                    className="flex-1 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    Withdraw Request
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddDevice(false); setAddSubmitSuccess(null) }}
                    className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddDevice(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddDeviceSubmit}
                  disabled={!canAddDevice || addingDevice}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingDevice ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isGroundTeam ? 'Submitting...' : 'Adding...'}
                    </>
                  ) : isGroundTeam ? (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  ) : (
                    'Add'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>

      {/* ── Matching Sets Section (shown when navigated from dashboard with setLifecycle param) ── */}
      {matchingSets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-2">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-violet-600" />
                Matching Sets ({matchingSets.length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Sets with the same lifecycle status</p>
            </div>
            <button
              onClick={() => navigate(`/dashboard/makesets?lifecycle=${urlSetLifecycle}`)}
              className="text-xs text-violet-600 font-medium hover:underline flex items-center gap-1"
            >
              View in Make Sets <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {matchingSets.map(set => (
              <div
                key={set.id}
                onClick={() => navigate(`/dashboard/makesets?lifecycle=${urlSetLifecycle}`)}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Box className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{set.code}</p>
                    <p className="text-xs text-gray-500">{set.setTypeName || set.setType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                    ${set.lifecycleStatus === 'active' || set.lifecycleStatus === 'deployed' ? 'bg-green-100 text-green-700 border-green-200' :
                      set.lifecycleStatus?.includes('return') ? 'bg-rose-100 text-rose-700 border-rose-200' :
                      set.lifecycleStatus === 'assigning' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {set.lifecycleStatus?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAddTypeModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Product Type</h3>
              <button type="button" onClick={() => setShowAddTypeModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g. Mouse, Keyboard, Router" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code Prefix * <span className="text-gray-400 font-normal text-xs">(2–4 uppercase letters, used in device codes)</span></label>
                <input type="text" value={newTypeCode} onChange={(e) => setNewTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} placeholder="e.g. MSE, KBD, RTR" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm font-mono" />
                <p className="text-xs text-gray-400 mt-1">Codes: {newTypeCode || 'XXX'}-001, {newTypeCode || 'XXX'}-002...</p>
              </div>
              {customProductTypes.length > 0 && (() => {
                const u = JSON.parse(localStorage.getItem('user') || '{}')
                const role = (u.role ?? '').toLowerCase().replace(/[\s_-]/g, '')
                const canDelete = ['manager', 'superadmin'].includes(role)
                return (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Custom types:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customProductTypes.map(t => (
                        <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs">
                          {t.label} <span className="font-mono opacity-60">({t.id})</span>
                          {canDelete && (
                            <button type="button" onClick={() => deleteCustomType(t.id)} className="text-primary-400 hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowAddTypeModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm">Cancel</button>
              <button type="button" onClick={saveCustomType} disabled={!newTypeName.trim() || !newTypeCode.trim()} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">Add Type</button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner 
          onClose={() => setShowBarcodeScanner(false)}
          onDeviceFound={(device) => {
            setShowBarcodeScanner(false)
            // Optionally show the device's barcode
            if (device.barcode) {
              handleViewBarcode(device)
            }
          }}
        />
      )}

      {/* Unified Barcode / Lifecycle Card */}
      {showBarcodeModal && selectedDeviceForBarcode && (
        <BarcodeResultCard
          key={selectedDeviceForBarcode.barcode || selectedDeviceForBarcode.id}
          device={{ ...selectedDeviceForBarcode, _isSet: false }}
          onClose={() => {
            setShowBarcodeModal(false)
            setSelectedDeviceForBarcode(null)
          }}
          onDeviceUpdated={(fresh) => {
            setSelectedDeviceForBarcode(fresh)
          }}
        />
      )}

      {/* BULK ADD MODAL */}
      {showBulkAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !bulkAdding && setShowBulkAdd(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-100 rounded-lg">
                {isGroundTeam ? <Send className="w-6 h-6 text-violet-600" /> : <PackagePlus className="w-6 h-6 text-violet-600" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isGroundTeam ? 'Request Bulk Add' : 'Bulk Add Products'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isGroundTeam
                    ? 'Fill in details and submit. Manager will review and approve.'
                    : 'All fields required. Codes and barcodes auto-generated.'}
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {/* Quantity — most important field, shown first */}
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                <label className="block text-sm font-semibold text-violet-900 mb-2">
                  How many devices? *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={bulkQty}
                    onChange={(e) => setBulkQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                    className="w-28 px-3 py-2 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 text-center font-bold text-lg"
                  />
                  <div className="text-sm text-violet-700">
                    <p>Will create <span className="font-bold">{bulkQty}</span> device{bulkQty !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-violet-500">Max 500 at a time</p>
                  </div>
                </div>
                {/* Quick-pick buttons */}
                <div className="flex gap-2 mt-3">
                  {[5, 10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBulkQty(n)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        bulkQty === n
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product type *</label>
                <select value={bulkProductType} onChange={(e) => { setBulkProductType(e.target.value); setBulkBrand(''); setBulkSize('') }} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500">
                  {Object.entries(allProductTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              {/* Shared fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Brand *</label>
                    {isManager && (
                      <span className="text-xs text-gray-400">Manage in Catalogue</span>
                    )}
                  </div>
                  <select value={bulkBrand} onChange={(e) => setBulkBrand(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkBrand ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select brand *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {[...getBrandsForProductType(bulkProductType), ...catalogueBrands.filter(b => !getBrandsForProductType(bulkProductType).includes(b))].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Size *</label>
                    {isManager && (
                      <span className="text-xs text-gray-400">Manage in Catalogue</span>
                    )}
                  </div>
                  <select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkSize ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select size *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {[...getSizesForProductType(bulkProductType), ...catalogueSizes.filter(s => !getSizesForProductType(bulkProductType).includes(s))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <div className="flex gap-2">
                  <input type="text" value={bulkModel === 'N/A' ? '' : bulkModel} onChange={(e) => setBulkModel(e.target.value)} disabled={bulkModel === 'N/A'} placeholder="e.g. Tab S8, Frame 55" className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 ${!bulkModel ? 'border-red-300 bg-red-50' : 'border-gray-200'} disabled:bg-gray-100`} />
                  <button type="button" onClick={() => setBulkModel(bulkModel === 'N/A' ? '' : 'N/A')} className={`px-3 py-2 text-xs font-semibold rounded-lg border ${bulkModel === 'N/A' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>N/A</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Color *</label>
                    {isManager && (
                      <span className="text-xs text-gray-400">Manage in Catalogue</span>
                    )}
                  </div>
                  <select value={bulkColor} onChange={(e) => setBulkColor(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkColor ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select color *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {[...DEVICE_COLORS, ...catalogueColors.filter(col => !DEVICE_COLORS.includes(col))].map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IN Date &amp; Time *</label>
                  <input type="datetime-local" value={bulkInDate} onChange={(e) => setBulkInDate(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkInDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health / Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICE_HEALTH_STATUS.map((h) => (
                    <button key={h.value} type="button" onClick={() => setBulkHealth(h.value)} className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${bulkHealth === h.value ? h.value === 'ok' ? 'bg-emerald-500 text-white border-emerald-500' : h.value === 'repair' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {h.value === 'ok' ? '✓ OK' : h.value === 'repair' ? '🔧 Repair' : '⚠ Damage'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Location *</label>
                <WarehouseLocationSelector
                  warehouseId={newWarehouseId}
                  zone={newWarehouseZone}
                  specificLocation={newWarehouseSpecificLocation}
                  onWarehouseChange={setNewWarehouseId}
                  onZoneChange={setNewWarehouseZone}
                  onSpecificLocationChange={setNewWarehouseSpecificLocation}
                  required={true}
                />
              </div>

              {/* Preview / info box */}
              {isGroundTeam ? (
                <div className="space-y-2">
                  {/* Live code preview */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <p className="font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                      <span>🔢</span> Device codes that will be created (after approval):
                    </p>
                    {bulkCodePreviewLoading ? (
                      <p className="text-gray-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
                      </p>
                    ) : bulkCodePreview ? (
                      <p className="font-mono font-bold text-primary-700 text-sm">{bulkCodePreview.range}
                        <span className="font-normal text-gray-400 ml-2">({bulkCodePreview.quantity} devices)</span>
                      </p>
                    ) : (
                      <p className="text-gray-400 italic">Select product type to preview codes</p>
                    )}
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <p className="font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                      <Send className="w-4 h-4" /> Request will be sent for approval
                    </p>
                    <p className="text-xs text-amber-700">Codes &amp; barcodes generated only after manager approves.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <p className="font-medium text-gray-700 mb-1">What will be created:</p>
                  <ul className="text-gray-600 space-y-0.5 text-xs">
                    <li>• <span className="font-semibold">{bulkQty}</span> {PRODUCT_TYPES[bulkProductType] || bulkProductType} devices</li>
                    <li>• Codes: <span className="font-mono">{getCodePrefix(bulkProductType)}-XXX</span> (auto-assigned, sequential)</li>
                    <li>• <span className="font-semibold">{bulkQty}</span> unique barcodes auto-generated</li>
                    <li>• All logged to database in one operation</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Footer — success state OR normal buttons */}
            {isGroundTeam && bulkSubmitSuccess ? (
              <div className="mt-6 space-y-3">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <p className="font-bold text-emerald-800 text-sm">Request Submitted!</p>
                  </div>
                  <p className="text-xs text-emerald-700 mb-1">
                    <span className="font-semibold">{bulkSubmitSuccess.qty}× {bulkSubmitSuccess.typeName}</span> — pending manager approval.
                  </p>
                  {bulkSubmitSuccess.range && (
                    <div className="mt-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Expected codes ({bulkSubmitSuccess.qty} devices):</p>
                      <p className="font-mono font-bold text-primary-700">{bulkSubmitSuccess.range}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Print these labels and paste them on the hardware before delivery.
                        Codes confirmed after manager approval.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (bulkSubmitSuccess.requestId && window.confirm('Withdraw this request?')) {
                        try {
                          await inventoryRequestApi.reject(bulkSubmitSuccess.requestId, 'Withdrawn by requester')
                          setShowBulkAdd(false)
                          setBulkSubmitSuccess(null)
                        } catch (e) { alert('Could not withdraw: ' + e.message) }
                      }
                    }}
                    className="flex-1 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    Withdraw Request
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowBulkAdd(false); setBulkSubmitSuccess(null) }}
                    className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowBulkAdd(false)}
                  disabled={bulkAdding}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddSubmit}
                  disabled={bulkAdding || bulkQty < 1 || !bulkBrand || !bulkSize || !bulkColor || !bulkModel || !bulkInDate}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {bulkAdding ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isGroundTeam ? 'Submitting...' : `Creating ${bulkQty} devices...`}
                    </>
                  ) : isGroundTeam ? (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Request ({bulkQty} device{bulkQty !== 1 ? 's' : ''})
                    </>
                  ) : (
                    <>
                      <PackagePlus className="w-5 h-5" />
                      Create {bulkQty} Device{bulkQty !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BULK BARCODE VIEWER — shown after bulk add completes */}
      {showBulkBarcodes && bulkCreatedDevices.length > 0 && (
        <BulkBarcodeGenerator
          devices={bulkCreatedDevices}
          onClose={() => {
            setShowBulkBarcodes(false)
            setBulkCreatedDevices([])
          }}
        />
      )}

      {/* PRINT QR MODAL — all devices + sets */}
      {showPrintQR && (
        <PrintQRModal
          devices={devices}
          deviceSets={deviceSets}
          onClose={() => setShowPrintQR(false)}
        />
      )}

      {/* Ground team: Add/Bulk Add device request form */}
      {showAddRequestForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddRequestForm(false)}
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xl">
            <AddDeviceRequestForm
              onSuccess={() => setShowAddRequestForm(false)}
              onCancel={() => setShowAddRequestForm(false)}
            />
          </div>
        </div>
      )}

      {/* Pinpoint datalist for filter suggestions */}
      <datalist id="pinpoint-suggestions">
        {savedPinpoints.map(p => <option key={p} value={p} />)}
      </datalist>

      {/* Set deletion modal */}
      {showSetDeleteModal && selectedSet && (
        <ScheduleDeleteModal
          entity={selectedSet}
          entityType="set"
          onConfirm={async (reason) => {
            const result = await deletionRequestApi.scheduleSet(selectedSet.id, reason)
            setShowSetDeleteModal(false)
            setSelectedSet(null)
            return result
          }}
          onClose={() => setShowSetDeleteModal(false)}
        />
      )}

      {/* Lifecycle actions are handled via Barcode scan or the Requests page */}
    </div>
  )
}

export default Devices