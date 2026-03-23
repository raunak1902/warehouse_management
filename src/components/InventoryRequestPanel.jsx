/**
 * src/components/InventoryRequestPanel.jsx
 * ──────────────────────────────────────────
 * Used in:
 *   - Devices.jsx: replaces direct "Add Device" / "Bulk Add" for ground team
 *   - Makesets.jsx: replaces direct "Make Set" / "Break Set" for ground team
 *   - Requests.jsx: manager sees pending inventory requests with approve/reject
 *
 * Ground team: sees a form that raises a request.
 * Manager: sees a list of pending requests with approve/reject actions.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Check, X, RefreshCw, AlertCircle,
  PackagePlus, Layers, Scissors, Send, RotateCcw,
  Tag, Ruler, Palette, Box, Cpu, Hash, Calendar,
} from 'lucide-react'
import { useCatalogue } from '../context/CatalogueContext'
import inventoryRequestApi from '../api/inventoryRequestApi'
import { ROLES, normaliseRole } from '../config/roles'
import WarehouseLocationSelector from './WarehouseLocationSelector'

// Format datetime with time for display on cards
const fmtDateTime = (dt) =>
  dt ? new Date(dt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : null

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }
  const labels = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

// ── Chip — small inline label/value pill ──────────────────────────────────────
const Chip = ({ icon: Icon, label, value }) => {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
      {Icon && <Icon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </span>
  )
}

// ── Request type meta ─────────────────────────────────────────────────────────
const getRequestMeta = (req) => {
  switch (req.requestType) {
    case 'add_device':
      return {
        icon: PackagePlus,
        iconBg: 'bg-primary-50',
        iconColor: 'text-primary-600',
        accentBorder: 'border-l-primary-400',
        title: `Add ${req.deviceTypeName || req.deviceTypeId}`,
        subtitle: '1 device',
      }
    case 'bulk_add':
      return {
        icon: PackagePlus,
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        accentBorder: 'border-l-violet-400',
        title: `Bulk Add ${req.deviceTypeName || req.deviceTypeId}`,
        subtitle: `${req.quantity} devices`,
      }
    case 'make_set':
      return {
        icon: Layers,
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
        accentBorder: 'border-l-teal-400',
        title: `Make Set: ${req.setTypeName || req.setTypeId}`,
        subtitle: req.setName ? `"${req.setName}"` : 'New set',
      }
    case 'break_set':
      return {
        icon: Scissors,
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        accentBorder: 'border-l-orange-400',
        title: `Break Set #${req.targetSetId}`,
        subtitle: 'Disassemble set',
      }
    default:
      return {
        icon: PackagePlus,
        iconBg: 'bg-gray-50',
        iconColor: 'text-gray-600',
        accentBorder: 'border-l-gray-300',
        title: req.requestType,
        subtitle: '',
      }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY REQUEST CARD (shown in Requests page)
// ─────────────────────────────────────────────────────────────────────────────
export const InventoryRequestCard = ({ request, userRole, onAction, onResubmit }) => {
  const isManager = normaliseRole(userRole) === ROLES.MANAGER || normaliseRole(userRole) === ROLES.SUPERADMIN
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [acting, setActing] = useState(false)

  const meta = getRequestMeta(request)
  const Icon = meta.icon

  const handleApprove = async () => {
    setActing(true)
    try {
      await inventoryRequestApi.approve(request.id)
      onAction?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) return
    setActing(true)
    try {
      await inventoryRequestApi.reject(request.id, rejectNote)
      setRejecting(false)
      onAction?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setActing(false)
    }
  }

  // Approve button label — shows what will be created
  const approveLabel = () => {
    if (acting) return null
    const code = request.expectedCodeRange
    if (request.requestType === 'add_device' && code)
      return `Approve — creates ${code}`
    if (request.requestType === 'bulk_add' && code)
      return `Approve — creates ${code}`
    if (request.requestType === 'make_set')
      return code ? `Approve — creates ${code}` : `Approve — create set`
    if (request.requestType === 'break_set')
      return `Approve — disassemble`
    return 'Approve'
  }

  const isAddRequest = request.requestType === 'add_device' || request.requestType === 'bulk_add'
  const isSetRequest = request.requestType === 'make_set' || request.requestType === 'break_set'

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${meta.accentBorder} rounded-xl overflow-hidden shadow-sm`}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${meta.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <Icon className={`w-4 h-4 ${meta.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm">{meta.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {meta.subtitle} · by <span className="font-medium text-gray-500">{request.requestedByName}</span> · {new Date(request.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* ── Details body — always visible ────────────────────────────────── */}
      <div className="px-4 pb-3 space-y-3">

        {/* Device details chips */}
        {isAddRequest && (
          <div className="flex flex-wrap gap-1.5">
            <Chip icon={Tag}      label="Brand"  value={request.brand} />
            <Chip icon={Ruler}    label="Size"   value={request.size} />
            <Chip icon={Cpu}      label="Model"  value={request.model} />
            <Chip icon={Palette}  label="Color"  value={request.color} />
            {request.quantity > 1 && (
              <Chip icon={Hash} label="Qty" value={`${request.quantity}`} />
            )}
            {request.inDate && (
              <Chip icon={Calendar} label="IN Date" value={fmtDateTime(request.inDate)} />
            )}
          </div>
        )}

        {/* Make set details */}
        {request.requestType === 'make_set' && (
          <div className="space-y-2">
            {/* Summary chips */}
            <div className="flex flex-wrap gap-1.5">
              {request.setName && <Chip icon={Box} label="Name" value={request.setName} />}
              {request.setTypeName && <Chip icon={Layers} label="Type" value={request.setTypeName} />}
              {Array.isArray(request.reservedDeviceIds) && (
                <Chip icon={Hash} label="Components" value={`${request.reservedDeviceIds.length} devices`} />
              )}
            </div>

            {/* Expected set code box — shown while pending */}
            {request.status === 'pending' && request.expectedCodeRange && (
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                <div className="flex-shrink-0 text-lg">🔢</div>
                <div>
                  <p className="text-xs text-teal-600 font-medium">Expected set code after approval:</p>
                  <p className="font-mono font-bold text-teal-800 text-sm tracking-wide">{request.expectedCodeRange}</p>
                  <p className="text-xs text-teal-400 mt-0.5">Print &amp; paste on the set box before delivery</p>
                </div>
              </div>
            )}

            {/* Component breakdown — device codes + types */}
            {Array.isArray(request.reservedDevices) && request.reservedDevices.length > 0 && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Reserved Components</p>
                {request.reservedDevices.map((d, i) => (
                  <div key={d.id || i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-gray-800 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                      {d.code}
                    </span>
                    {d.type && (
                      <span className="text-gray-500">{d.type}</span>
                    )}
                    {d.brand && (
                      <span className="text-gray-400">· {d.brand}</span>
                    )}
                    {d.model && (
                      <span className="text-gray-400 truncate max-w-[100px]">· {d.model}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Break set details */}
        {request.requestType === 'break_set' && request.note && (
          <p className="text-xs text-gray-500 italic">"{request.note}"</p>
        )}

        {/* Note */}
        {request.note && isAddRequest && (
          <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-1.5">"{request.note}"</p>
        )}

        {/* Expected codes box — pending add requests */}
        {isAddRequest && request.status === 'pending' && request.expectedCodeRange && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
            <div className="flex-shrink-0 text-lg">🔢</div>
            <div>
              <p className="text-xs text-primary-600 font-medium">
                Expected code{request.quantity > 1 ? 's' : ''} after approval:
              </p>
              <p className="font-mono font-bold text-primary-800 text-sm tracking-wide">
                {request.expectedCodeRange}
              </p>
              {request.quantity > 1 && (
                <p className="text-xs text-primary-400 mt-0.5">
                  {request.quantity} devices — print &amp; paste on hardware before delivery
                </p>
              )}
            </div>
          </div>
        )}

        {/* Rejection note */}
        {request.rejectionNote && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-red-700 text-xs">
              <span className="font-semibold">Rejected:</span> {request.rejectionNote}
            </p>
          </div>
        )}

        {/* Approved result */}
        {request.status === 'approved' && !request.createdSetId && request.approvedCodeRange && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-emerald-700 text-xs font-semibold mb-0.5">✅ Added to database</p>
            <p className="font-mono font-bold text-emerald-800 text-sm">{request.approvedCodeRange}</p>
            <p className="text-emerald-600 text-xs mt-1">
              Devices section → search by code → Download QR
            </p>
          </div>
        )}
        {request.status === 'approved' && request.createdSetId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-emerald-700 text-xs font-semibold mb-0.5">✅ Set created</p>
            {request.approvedCodeRange && (
              <p className="font-mono font-bold text-emerald-800 text-sm">{request.approvedCodeRange}</p>
            )}
            <p className="text-emerald-600 text-xs mt-1">
              Make Sets section → find the set → Download QR
            </p>
          </div>
        )}
      </div>

      {/* ── Manager actions ───────────────────────────────────────────────── */}
      {isManager && request.status === 'pending' && (
        <div className="border-t border-gray-100 px-4 py-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (required)"
                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none h-16 focus:ring-2 focus:ring-red-300"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={acting || !rejectNote.trim()}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {acting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Confirm Reject
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {acting
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Approving...</>
                  : <><Check className="w-3.5 h-3.5" /> {approveLabel()}</>
                }
              </button>
              <button
                onClick={() => setRejecting(true)}
                className="px-4 py-2.5 border-2 border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Ground team: re-submit if rejected ───────────────────────────── */}
      {!isManager && request.status === 'rejected' && onResubmit && (
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            onClick={() => onResubmit(request)}
            className="w-full py-2 border border-primary-300 text-primary-600 rounded-lg text-sm font-semibold hover:bg-primary-50 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3 h-3" /> Re-submit Request
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD DEVICE REQUEST FORM (ground team)
// Replaces the direct "Add Device" modal for ground team
// ─────────────────────────────────────────────────────────────────────────────
export const AddDeviceRequestForm = ({ onSuccess, onCancel, prefillData = null }) => {
  const { productTypes, brands, sizes, colors } = useCatalogue()
  const [form, setForm] = useState({
    deviceTypeId: prefillData?.deviceTypeId || '',
    deviceTypeName: prefillData?.deviceTypeName || '',
    quantity: prefillData?.quantity || 1,
    brand: prefillData?.brand || '',
    size: prefillData?.size || '',
    model: prefillData?.model || '',
    color: prefillData?.color || '',
    gpsId: prefillData?.gpsId || '',
    inDate: prefillData?.inDate || '',
    healthStatus: 'ok',
    note: prefillData?.note || '',
    warehouseId: prefillData?.warehouseId || null,
    warehouseZone: prefillData?.warehouseZone || '',
    warehouseSpecificLocation: prefillData?.warehouseSpecificLocation || '',
  })
  const [isBulk, setIsBulk] = useState((prefillData?.quantity || 1) > 1)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  // Brand/Size search
  const [brandSearch, setBrandSearch] = useState('')
  const [sizeSearch, setSizeSearch] = useState('')
  const filteredBrands = brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()))
  const filteredSizes = sizes.filter(s => s.toLowerCase().includes(sizeSearch.toLowerCase()))

  const handleSubmit = async () => {
    if (!form.deviceTypeId) { setErr('Product type is required'); return }
    if (!form.warehouseId) { setErr('Warehouse location is required'); return }
    if (!form.inDate) { setErr('IN Date is required'); return }
    setSubmitting(true)
    setErr('')
    try {
      const payload = {
        ...form,
        quantity: isBulk ? parseInt(form.quantity) : 1,
      }
      if (isBulk && payload.quantity > 1) {
        await inventoryRequestApi.requestBulkAdd(payload)
      } else {
        await inventoryRequestApi.requestAddDevice(payload)
      }
      onSuccess?.()
    } catch (e) {
      setErr(e.response?.data?.error || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bulk toggle */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isBulk} onChange={e => setIsBulk(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded" />
          <span className="text-sm font-medium text-gray-700">Bulk Add (multiple devices)</span>
        </label>
        {isBulk && (
          <input
            type="number" min="2" max="500"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500"
            placeholder="Qty"
          />
        )}
      </div>

      {/* Product type */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Product Type *</label>
        <select
          value={form.deviceTypeId}
          onChange={e => {
            const t = productTypes.find(pt => pt.typeId === e.target.value)
            setForm(f => ({ ...f, deviceTypeId: e.target.value, deviceTypeName: t?.label || '' }))
          }}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 ${!form.deviceTypeId ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
        >
          <option value="">Select product type</option>
          {productTypes.map(t => <option key={t.typeId} value={t.typeId}>{t.label}</option>)}
        </select>
      </div>

      {/* Brand with search */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Brand</label>
        <input
          value={brandSearch || form.brand}
          onChange={e => { setBrandSearch(e.target.value); setForm(f => ({ ...f, brand: e.target.value })) }}
          list="brand-options"
          placeholder="Search or type brand…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
        <datalist id="brand-options">
          {filteredBrands.map(b => <option key={b} value={b} />)}
        </datalist>
      </div>

      {/* Size with search */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Size</label>
        <input
          value={sizeSearch || form.size}
          onChange={e => { setSizeSearch(e.target.value); setForm(f => ({ ...f, size: e.target.value })) }}
          list="size-options"
          placeholder='Search or type size e.g. 55"…'
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
        <datalist id="size-options">
          {filteredSizes.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      {/* Model */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Model</label>
        <input
          value={form.model}
          onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
          placeholder="e.g. QN55Q80C"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Color</label>
        <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">Select color</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Warehouse Location */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">
          Warehouse Location * <span className="text-red-500">required</span>
        </label>
        <WarehouseLocationSelector
          warehouseId={form.warehouseId}
          zone={form.warehouseZone}
          specificLocation={form.warehouseSpecificLocation}
          onWarehouseChange={id => setForm(f => ({ ...f, warehouseId: id }))}
          onZoneChange={z => setForm(f => ({ ...f, warehouseZone: z }))}
          onSpecificLocationChange={sl => setForm(f => ({ ...f, warehouseSpecificLocation: sl }))}
          required={true}
        />
      </div>

      {/* IN Date */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">IN Date * (date entered warehouse)</label>
        <input
          type="date"
          value={form.inDate}
          onChange={e => setForm(f => ({ ...f, inDate: e.target.value }))}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 ${!form.inDate ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
        />
      </div>

      {/* GPS ID */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">GPS ID (optional)</label>
        <input
          value={form.gpsId}
          onChange={e => setForm(f => ({ ...f, gpsId: e.target.value }))}
          placeholder="Optional tracking ID"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Note */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Note (optional)</label>
        <textarea
          value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="Any additional info for manager…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-16 focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {err && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {err}
        </div>
      )}

      {/* Info callout */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
        <strong>📋 Request will be sent to manager for approval.</strong> Device codes and barcodes will be generated only after approval.
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !form.deviceTypeId || !form.warehouseId || !form.inDate}
          className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Request
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY REQUESTS LIST — used in Requests.jsx
// ─────────────────────────────────────────────────────────────────────────────
export const InventoryRequestsList = ({ userRole, highlightId }) => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [resubmitData, setResubmitData] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await inventoryRequestApi.getAll(filter !== 'all' ? { status: filter } : {})
      setRequests(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const isManager = normaliseRole(userRole) === ROLES.MANAGER || normaliseRole(userRole) === ROLES.SUPERADMIN

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={fetchRequests} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Resubmit form */}
      {resubmitData && (
        <div className="mb-4 bg-white border border-primary-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary-500" /> Re-submitting Request
          </p>
          <AddDeviceRequestForm
            prefillData={resubmitData}
            onSuccess={() => { setResubmitData(null); fetchRequests() }}
            onCancel={() => setResubmitData(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No {filter} inventory requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              id={`req-${req.id}`}
              className={`rounded-xl transition-all duration-700 ${
                highlightId === req.id
                  ? 'ring-2 ring-primary-400 ring-offset-2 shadow-lg shadow-primary-100'
                  : ''
              }`}
            >
              <InventoryRequestCard
                request={req}
                userRole={userRole}
                onAction={fetchRequests}
                onResubmit={!isManager ? (r) => setResubmitData(r) : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InventoryRequestsList