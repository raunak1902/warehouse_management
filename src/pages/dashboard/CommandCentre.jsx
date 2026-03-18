/**
 * src/pages/dashboard/CommandCentre.jsx
 * ───────────────────────────────────────
 * Manager/SuperAdmin only panel — wider modal with tab navigation.
 * Tabs: Product Types | Set Types | Brands | Sizes | Colors
 *
 * BUG FIX: ProductTypesSection was calling `setFormAndRef` which didn't exist
 * in that scope — the prefix field now correctly calls `setForm`.
 */

import { useState, useRef, useEffect } from 'react'
import {
  Settings, Plus, Trash2, ChevronDown, ChevronUp, Package,
  Layers, Tag, Ruler, Palette, X, Check, AlertCircle,
  Tv, Tablet, Monitor, LayoutGrid, Box, Battery, Mouse,
  Zap, Smartphone, Wifi, Plug, HardDrive, Camera, Speaker,
  Keyboard, Printer, Server, Save, Edit2, RefreshCw, Hash,
  EyeOff, RotateCcw, Warehouse, MapPin, Building2, ChevronRight,
} from 'lucide-react'
import { useCatalogue, ICON_NAMES, COLOR_OPTIONS, getColorClasses } from '../../context/CatalogueContext'

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP = {
  Tv, Tablet, Monitor, LayoutGrid, Box, Package, Battery, Mouse,
  Zap, Layers, Smartphone, Wifi, Plug, HardDrive, Camera, Speaker,
  Keyboard, Printer, Server,
}
const DynIcon = ({ name, className }) => {
  const Comp = ICON_MAP[name] || Package
  return <Comp className={className} />
}

// ── Derive initials-style Type ID from a display name ────────────────────────
// "Power Plug" → "PP", "I-Frame Stand" → "IFS", "Camera" → "CAM"
function deriveTypeId(name) {
  const words = name.trim().split(/[\s\-_]+/).filter(Boolean)
  if (words.length === 1) return words[0].toUpperCase().slice(0, 4)
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 6)
}

// ── Color swatch dot ──────────────────────────────────────────────────────────
const ColorDot = ({ color, size = 'sm' }) => {
  const cc = getColorClasses(color)
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  return <span className={`inline-block rounded-full border ${sz} ${cc.bg} ${cc.border}`} />
}

// ── Small pill badge ──────────────────────────────────────────────────────────
const Pill = ({ children, onRemove, colorClass = 'bg-white border-gray-200 text-gray-700' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
    {children}
    {onRemove && (
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5 opacity-60 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
)

// ── Collapsible section wrapper (used for Brands/Sizes/Colors) ─────────────
const Section = ({ icon: Icon, title, count, children, defaultOpen = false, accentColor = 'primary' }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary-600" />
          </div>
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium tabular-nums">
            {count}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 bg-gray-50/50 p-5">{children}</div>}
    </div>
  )
}

// ── Simple add/list manager (brands, sizes, colors) ───────────────────────────
const SimpleListManager = ({ items, onAdd, onDelete, placeholder, label }) => {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  const handleAdd = async () => {
    if (!input.trim()) return
    setAdding(true); setErr('')
    try { await onAdd(input.trim()); setInput('') }
    catch (e) { setErr(e.message) }
    finally { setAdding(false) }
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-300 bg-white outline-none transition"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 flex items-center gap-1.5 transition"
        >
          {adding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
      </div>
      {err && <p className="text-red-500 text-xs mb-2">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <Pill key={item.id || i} onRemove={() => onDelete(item.id)}>
            {item.name || item.value}
          </Pill>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 italic">No {label} added yet</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TYPES SECTION
// ─────────────────────────────────────────────────────────────────────────────
const ProductTypesSection = () => {
  const { productTypes, addProductType, updateProductType, deleteProductType, fetchInactiveProductTypes } = useCatalogue()
  const EMPTY = { typeId: '', label: '', prefix: '', icon: 'Package', color: 'gray' }
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(false)
  const [typeIdManuallyEdited, setTypeIdManuallyEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deactivatingId, setDeactivatingId] = useState(null)
  // When delete is blocked by existing devices, store { typeId, label, message }
  // so we can offer the "Deactivate instead" option inline.
  const [blockedDelete, setBlockedDelete] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [inactiveTypes, setInactiveTypes] = useState([])
  const [loadingInactive, setLoadingInactive] = useState(false)
  const [reactivatingId, setReactivatingId] = useState(null)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  // Auto-derive typeId and prefix from label
  const handleLabelChange = (value) => {
    const derived = deriveTypeId(value)
    setForm(f => ({
      ...f,
      label: value,
      typeId: typeIdManuallyEdited ? f.typeId : derived,
      prefix: prefixManuallyEdited ? f.prefix : derived,
    }))
  }

  const handleTypeIdChange = (value) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setTypeIdManuallyEdited(true)
    setForm(f => ({ ...f, typeId: clean }))
  }

  const handlePrefixChange = (value) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setPrefixManuallyEdited(true)
    // ✅ BUG FIX: was calling `setFormAndRef` which doesn't exist in this scope
    setForm(f => ({ ...f, prefix: clean }))
  }

  const handleSave = async () => {
    if (!form.typeId || !form.label || !form.prefix) { setErr('All fields are required'); return }
    setSaving(true); setErr('')
    try {
      await addProductType(form)
      setForm(EMPTY)
      setPrefixManuallyEdited(false)
      setTypeIdManuallyEdited(false)
      setShowForm(false)
      setSuccess('Product type added!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (typeId, label) => {
    if (!window.confirm(`Delete product type "${label}"?\n\nThis cannot be undone. Types with existing devices cannot be deleted.`)) return
    setDeletingId(typeId)
    setBlockedDelete(null)
    setErr('')
    try {
      await deleteProductType(typeId)
      setSuccess(`"${label}" deleted.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      const msg = e.message || 'Failed to delete product type'
      // Backend returns "Cannot delete — N device(s) use this type. Deactivate instead."
      // Detect this and surface a proper deactivate prompt instead of a plain error string.
      if (msg.toLowerCase().includes('deactivate')) {
        setBlockedDelete({ typeId, label, message: msg })
      } else {
        setErr(msg)
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeactivate = async (typeId, label) => {
    if (!window.confirm(`Deactivate "${label}"?\n\nThe type will be hidden from all dropdowns. Existing devices keep their type — they just won\'t appear in the "add device" form until the type is re-activated.`)) return
    setDeactivatingId(typeId)
    setBlockedDelete(null)
    setErr('')
    try {
      await updateProductType(typeId, { isActive: false })
      setSuccess(`"${label}" deactivated and hidden from dropdowns.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setErr(e.message || 'Failed to deactivate product type')
    } finally {
      setDeactivatingId(null)
    }
  }

  const handleToggleInactive = async () => {
    if (showInactive) { setShowInactive(false); return }
    setLoadingInactive(true)
    try {
      const all = await fetchInactiveProductTypes()
      setInactiveTypes(all.filter(t => !t.isActive && !t.isBuiltin))
      setShowInactive(true)
    } catch (e) {
      setErr(e.message || 'Failed to load deactivated types')
    } finally {
      setLoadingInactive(false)
    }
  }

  const handleReactivate = async (typeId, label) => {
    setReactivatingId(typeId)
    setErr('')
    try {
      await updateProductType(typeId, { isActive: true })
      setInactiveTypes(prev => prev.filter(t => t.typeId !== typeId))
      setSuccess(`"${label}" re-activated and visible in dropdowns again.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setErr(e.message || 'Failed to re-activate product type')
    } finally {
      setReactivatingId(null)
    }
  }

  const handleCancel = () => {
    setForm(EMPTY)
    setPrefixManuallyEdited(false)
    setTypeIdManuallyEdited(false)
    setErr('')
    setShowForm(false)
  }

  const previewColor = getColorClasses(form.color)

  return (
    <div className="space-y-4">
      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-3 py-2.5 rounded-xl">
          <Check className="w-3.5 h-3.5 flex-shrink-0" /> {success}
        </div>
      )}

      {/* Error banner (delete errors shown here, add errors shown inside the form) */}
      {err && !showForm && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </div>
      )}

      {/* Blocked-delete banner: delete failed because devices use this type — offer Deactivate */}
      {blockedDelete && !showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">Cannot delete &quot;{blockedDelete.label}&quot;</p>
              <p className="text-xs text-amber-700 mt-0.5">{blockedDelete.message}</p>
              <p className="text-xs text-amber-600 mt-1">
                <strong>Deactivating</strong> hides the type from all dropdowns so no new devices can be added under it,
                while keeping your existing devices intact.
              </p>
            </div>
            <button onClick={() => setBlockedDelete(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={() => setBlockedDelete(null)}
              className="flex-1 py-2 border border-amber-200 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeactivate(blockedDelete.typeId, blockedDelete.label)}
              disabled={deactivatingId === blockedDelete.typeId}
              className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1.5 transition"
            >
              {deactivatingId === blockedDelete.typeId
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <Trash2 className="w-3 h-3" />}
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Existing types grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {productTypes.map(t => {
          const cc = getColorClasses(t.color)
          return (
            <div
              key={t.typeId}
              className={`group relative flex items-center gap-2.5 p-3 rounded-xl border ${cc.border} ${cc.bg} transition-all`}
            >
              {/* Color accent strip */}
              <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${cc.text.replace('text-', 'bg-')}`} />
              <div className={`w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0`}>
                <DynIcon name={t.icon} className={`w-4 h-4 ${cc.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${cc.text}`}>{t.label}</p>
                <p className="text-xs text-gray-400 font-mono">{t.prefix}-001</p>
              </div>
              {!t.isBuiltin && (
                <button
                  onClick={() => handleDelete(t.typeId, t.label)}
                  disabled={deletingId === t.typeId}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300 transition-all rounded-lg hover:bg-white/60 disabled:opacity-60"
                  title="Remove type"
                >
                  {deletingId === t.typeId
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                </button>
              )}
            </div>
          )
        })}

        {/* Add new button card */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-primary-300 text-primary-500 hover:border-primary-400 hover:bg-primary-50/50 transition-all text-xs font-semibold min-h-[72px]"
          >
            <Plus className="w-4 h-4" />
            New Type
          </button>
        )}
      </div>

      {/* ── Deactivated types panel ─────────────────────────────────── */}
      <div>
        <button
          onClick={handleToggleInactive}
          disabled={loadingInactive}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
        >
          {loadingInactive
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : showInactive
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />}
          {showInactive ? 'Hide' : 'Show'} deactivated types
          {showInactive && inactiveTypes.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full tabular-nums">{inactiveTypes.length}</span>
          )}
        </button>

        {showInactive && (
          <div className="mt-2 space-y-1.5">
            {inactiveTypes.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-1">No deactivated types.</p>
            ) : (
              inactiveTypes.map(t => {
                const cc = getColorClasses(t.color)
                return (
                  <div key={t.typeId} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cc.bg} border ${cc.border}`}>
                        <DynIcon name={t.icon} className={`w-3.5 h-3.5 ${cc.text}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500">{t.label}</p>
                        <p className="text-xs text-gray-400 font-mono">{t.prefix}-001 · deactivated</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleReactivate(t.typeId, t.label)}
                      disabled={reactivatingId === t.typeId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 disabled:opacity-40 transition"
                    >
                      {reactivatingId === t.typeId
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Check className="w-3 h-3" />}
                      Re-activate
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Add new form — slides in below grid */}
      {showForm && (
        <div className="bg-white border border-primary-200 rounded-2xl p-4 shadow-sm space-y-4 relative overflow-hidden">
          {/* Preview accent header */}
          <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${previewColor.bg}`} />

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-500" />
              New Product Type
            </p>
            {/* Live preview pill */}
            {(form.label || form.icon) && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${previewColor.bg} ${previewColor.text} ${previewColor.border}`}>
                <DynIcon name={form.icon} className="w-3 h-3" />
                {form.label || 'Preview'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Display Name */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Display Name <span className="text-red-400">*</span></label>
              <input
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Power Plug"
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-300 outline-none transition bg-gray-50/50"
              />
            </div>

            {/* Type ID */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                Type ID <span className="text-red-400">*</span>
                <span className="text-gray-400 font-normal">(unique key)</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  value={form.typeId}
                  onChange={e => handleTypeIdChange(e.target.value)}
                  placeholder="e.g. PP"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-300 outline-none transition bg-gray-50/50"
                />
              </div>
              {!typeIdManuallyEdited && form.label && (
                <p className="text-xs text-primary-400 mt-1">Auto-suggested · click to override</p>
              )}
            </div>

            {/* Code Prefix */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                Code Prefix <span className="text-red-400">*</span>
              </label>
              <input
                value={form.prefix}
                onChange={e => handlePrefixChange(e.target.value)}
                placeholder="e.g. PP"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-300 outline-none transition bg-gray-50/50"
              />
              {form.prefix
                ? <p className="text-xs text-gray-400 mt-1 font-mono">{form.prefix}-001, {form.prefix}-002…</p>
                : <p className="text-xs text-gray-400 mt-1">Generates device codes</p>
              }
            </div>

            {/* Icon */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Icon</label>
              <div className="flex gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${previewColor.bg} ${previewColor.border}`}>
                  <DynIcon name={form.icon} className={`w-4 h-4 ${previewColor.text}`} />
                </div>
                <select
                  value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50/50"
                >
                  {ICON_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Color Theme</label>
              <div className="flex gap-2">
                <ColorDot color={form.color} size="lg" />
                <select
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50/50"
                >
                  {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.typeId || !form.label || !form.prefix}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Type
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT EDITOR (shared between add & edit set type forms)
// ─────────────────────────────────────────────────────────────────────────────
const SlotEditor = ({ slots, productTypes, onChange, pendingRef }) => {
  const [slotForm, setSlotForm] = useState({ label: '', deviceTypeId: '' })
  if (pendingRef) pendingRef.current = slotForm

  const addSlot = () => {
    if (!slotForm.deviceTypeId || !slotForm.label) return
    onChange([...slots, { slotKey: slotForm.deviceTypeId, label: slotForm.label, deviceTypeId: slotForm.deviceTypeId }])
    setSlotForm({ label: '', deviceTypeId: '' })
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">Component Slots</p>
      <div className="space-y-1.5 mb-3">
        {slots.length === 0 && <p className="text-xs text-gray-400 italic px-1">No slots added yet — add at least one</p>}
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm">
            <span className="text-gray-700">
              {slot.label}
              <span className="text-gray-400 text-xs ml-1.5 font-mono">({slot.deviceTypeId})</span>
            </span>
            <button onClick={() => onChange(slots.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select
          value={slotForm.deviceTypeId}
          onChange={e => {
            const t = productTypes.find(pt => pt.typeId === e.target.value)
            setSlotForm(f => ({ ...f, deviceTypeId: e.target.value, label: t?.label || '' }))
          }}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
        >
          <option value="">Select device type…</option>
          {productTypes.map(t => <option key={t.typeId} value={t.typeId}>{t.label}</option>)}
        </select>
        <input
          value={slotForm.label}
          onChange={e => setSlotForm(f => ({ ...f, label: e.target.value }))}
          placeholder="Display label"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        />
        <button
          onClick={addSlot}
          disabled={!slotForm.deviceTypeId || !slotForm.label}
          className="px-3 py-2 bg-gray-700 text-white rounded-xl text-sm hover:bg-gray-800 disabled:opacity-40 transition"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SET TYPE EDIT CARD (inline)
// ─────────────────────────────────────────────────────────────────────────────
const SetTypeEditCard = ({ st, productTypes, onSave, onCancel }) => {
  const { updateSetType, refetch } = useCatalogue()
  const pendingSlotRef = useRef({ label: '', deviceTypeId: '' })
  const initSlots = (st.componentSlots || []).map(s => ({
    slotKey: s.slotKey || s.deviceTypeId || '',
    label: s.label || '',
    deviceTypeId: s.deviceTypeId || s.deviceType || s.type || '',
  }))
  const [editForm, setEditForm] = useState({ label: st.label, color: st.color || 'gray', componentSlots: initSlots })
  const editFormRef = useRef(editForm)
  const setEditFormAndRef = (updater) => {
    setEditForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      editFormRef.current = next
      return next
    })
  }
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    const latest = editFormRef.current
    if (!latest.label.trim()) { setErr('Set Name is required'); return }
    const pending = pendingSlotRef.current
    const slotsToSave = (pending?.deviceTypeId && pending?.label)
      ? [...latest.componentSlots, { slotKey: pending.deviceTypeId, label: pending.label, deviceTypeId: pending.deviceTypeId }]
      : latest.componentSlots
    if (slotsToSave.length === 0) { setErr('At least one component slot is required'); return }
    setSaving(true); setErr('')
    try {
      await updateSetType(st.setTypeId, {
        label: latest.label.trim(),
        color: latest.color,
        componentSlots: slotsToSave.map(s => ({ slotKey: s.slotKey || s.deviceTypeId, label: s.label, deviceTypeId: s.deviceTypeId })),
      })
      await refetch()
      onSave()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
          <Edit2 className="w-4 h-4" /> Editing: <span className="font-mono text-amber-700">{st.setTypeId}</span>
        </p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-amber-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Set Name *</label>
          <input
            value={editForm.label}
            onChange={e => setEditFormAndRef(f => ({ ...f, label: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Color</label>
          <select
            value={editForm.color}
            onChange={e => setEditFormAndRef(f => ({ ...f, color: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none"
          >
            {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Set Type ID <span className="text-gray-300">(locked)</span></label>
          <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono text-gray-400">{st.setTypeId}</div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Code Prefix <span className="text-gray-300">(locked)</span></label>
          <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono text-gray-400">{st.prefix}-001</div>
        </div>
      </div>
      <SlotEditor
        slots={editForm.componentSlots}
        productTypes={productTypes}
        onChange={slots => setEditFormAndRef(f => ({ ...f, componentSlots: slots }))}
        pendingRef={pendingSlotRef}
      />
      {err && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5" /> {err}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2 transition"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SET TYPES SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SetTypesSection = () => {
  const { setTypes, productTypes, addSetType, updateSetType, fetchInactiveSetTypes } = useCatalogue()
  const EMPTY = { setTypeId: '', label: '', prefix: '', icon: 'Layers', color: 'gray', componentSlots: [] }
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef(form)
  const setFormAndRef = (updater) => {
    setForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      formRef.current = next
      return next
    })
  }
  const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const addFormPendingSlotRef = useRef({ label: '', deviceTypeId: '' })

  // Deactivate / reactivate state
  const [deactivatingId, setDeactivatingId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [inactiveTypes, setInactiveTypes] = useState([])
  const [loadingInactive, setLoadingInactive] = useState(false)
  const [reactivatingId, setReactivatingId] = useState(null)

  const handleLabelChange = (value) => {
    const derived = deriveTypeId(value)
    setFormAndRef(f => ({
      ...f,
      label: value,
      setTypeId: f.setTypeId || value.trim().replace(/\s+/g, '_').slice(0, 20),
      prefix: prefixManuallyEdited ? f.prefix : derived,
    }))
  }

  const handleSave = async () => {
    const latestForm = formRef.current
    const pending = addFormPendingSlotRef.current
    const slots = (pending?.deviceTypeId && pending?.label)
      ? [...latestForm.componentSlots, { slotKey: pending.deviceTypeId, label: pending.label, deviceTypeId: pending.deviceTypeId }]
      : latestForm.componentSlots
    if (!latestForm.setTypeId || !latestForm.label || !latestForm.prefix || slots.length === 0) {
      setErr('All fields and at least one component slot are required'); return
    }
    setSaving(true); setErr('')
    try {
      await addSetType({ ...latestForm, componentSlots: slots })
      setFormAndRef(EMPTY)
      setPrefixManuallyEdited(false)
      setShowForm(false)
      setSuccess('Set type added!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (setTypeId, label) => {
    if (!window.confirm(`Deactivate "${label}"?\n\nThis set type will be hidden from all dropdowns. Existing sets keep their type — they just won't appear in the "create set" form until reactivated.`)) return
    setDeactivatingId(setTypeId)
    setErr('')
    try {
      await updateSetType(setTypeId, { isActive: false })
      setSuccess(`"${label}" deactivated and hidden from dropdowns.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setErr(e.message || 'Failed to deactivate set type')
    } finally {
      setDeactivatingId(null)
    }
  }

  const handleToggleInactive = async () => {
    if (showInactive) { setShowInactive(false); return }
    setLoadingInactive(true)
    try {
      const all = await fetchInactiveSetTypes()
      setInactiveTypes(all.filter(t => !t.isActive))
      setShowInactive(true)
    } catch (e) {
      setErr(e.message || 'Failed to load deactivated set types')
    } finally {
      setLoadingInactive(false)
    }
  }

  const handleReactivate = async (setTypeId, label) => {
    setReactivatingId(setTypeId)
    setErr('')
    try {
      await updateSetType(setTypeId, { isActive: true })
      setInactiveTypes(prev => prev.filter(t => t.setTypeId !== setTypeId))
      setSuccess(`"${label}" re-activated and visible in dropdowns again.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setErr(e.message || 'Failed to re-activate set type')
    } finally {
      setReactivatingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {success && (
        <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-3 py-2.5 rounded-xl">
          <Check className="w-3.5 h-3.5" /> {success}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5" /> {err}
        </div>
      )}

      {/* Existing set types */}
      <div className="space-y-2">
        {setTypes.map(st => (
          editingId === st.setTypeId
            ? (
              <SetTypeEditCard
                key={st.setTypeId}
                st={st}
                productTypes={productTypes}
                onSave={() => { setEditingId(null); setSuccess('Set type updated!'); setTimeout(() => setSuccess(''), 3000) }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={st.setTypeId} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3.5 group hover:border-gray-300 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${getColorClasses(st.color).bg} border ${getColorClasses(st.color).border}`}>
                    <Layers className={`w-4 h-4 ${getColorClasses(st.color).text}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{st.label}</p>
                    <p className="text-xs text-gray-400">
                      <span className="font-mono">{st.prefix}-001</span>
                      <span className="mx-1.5">·</span>
                      {(st.componentSlots || []).length} component{(st.componentSlots || []).length !== 1 ? 's' : ''}
                      {st.isBuiltin && <span className="ml-1.5 text-gray-300">(built-in)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(st.setTypeId); setSuccess('') }}
                    className="p-1.5 hover:text-amber-500 text-gray-300 transition rounded-lg hover:bg-amber-50"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeactivate(st.setTypeId, st.label)}
                    disabled={deactivatingId === st.setTypeId}
                    className="p-1.5 hover:text-orange-500 text-gray-300 transition rounded-lg hover:bg-orange-50 disabled:opacity-40"
                    title="Deactivate (hide from dropdowns)"
                  >
                    {deactivatingId === st.setTypeId
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <EyeOff className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>
            )
        ))}
      </div>

      {/* Show deactivated toggle */}
      <button
        onClick={handleToggleInactive}
        disabled={loadingInactive}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
      >
        {loadingInactive
          ? <RefreshCw className="w-3 h-3 animate-spin" />
          : showInactive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        }
        {showInactive ? 'Hide deactivated' : 'Show deactivated set types'}
      </button>

      {/* Inactive set types list */}
      {showInactive && (
        <div className="space-y-1.5">
          {inactiveTypes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No deactivated set types.</p>
          ) : inactiveTypes.map(st => (
            <div key={st.setTypeId} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 border border-gray-200">
                  <Layers className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-500 text-sm line-through">{st.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{st.prefix}-001</p>
                </div>
              </div>
              <button
                onClick={() => handleReactivate(st.setTypeId, st.label)}
                disabled={reactivatingId === st.setTypeId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition disabled:opacity-40"
              >
                {reactivatingId === st.setTypeId
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <RotateCcw className="w-3 h-3" />
                }
                Reactivate
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary-300 text-primary-500 hover:border-primary-400 hover:bg-primary-50/50 transition text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add New Set Type
        </button>
      ) : (
        <div className="bg-white border border-primary-200 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-500" /> New Set Type
            </p>
            <button onClick={() => { setShowForm(false); setFormAndRef(EMPTY); setErr('') }} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Set Name <span className="text-red-400">*</span></label>
              <input
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Tent Card"
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Set Type ID <span className="text-red-400">*</span></label>
              <input
                value={form.setTypeId}
                onChange={e => setFormAndRef(f => ({ ...f, setTypeId: e.target.value.replace(/\s+/g, '').slice(0, 20) }))}
                placeholder="e.g. tentCard"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Code Prefix <span className="text-red-400">*</span></label>
              <input
                value={form.prefix}
                onChange={e => { setPrefixManuallyEdited(true); setFormAndRef(f => ({ ...f, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })) }}
                placeholder="e.g. TCARD"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50"
              />
              {form.prefix && <p className="text-xs text-gray-400 mt-1 font-mono">{form.prefix}-001, {form.prefix}-002…</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Color</label>
              <select value={form.color} onChange={e => setFormAndRef(f => ({ ...f, color: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50">
                {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <SlotEditor
            slots={form.componentSlots}
            productTypes={productTypes}
            onChange={slots => setFormAndRef(f => ({ ...f, componentSlots: slots }))}
            pendingRef={addFormPendingSlotRef}
          />

          {err && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5" /> {err}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setFormAndRef(EMPTY); setErr('') }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Set Type
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSES SECTION
// Full CRUD for Warehouse → Zone hierarchy. Both can be freely added/deleted
// at any time. Zones expand inline beneath each warehouse card.
// ─────────────────────────────────────────────────────────────────────────────
const WarehousesSection = () => {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [zones, setZones] = useState({})
  const [zonesLoading, setZonesLoading] = useState({})

  // Add-warehouse form
  const [showAddWH, setShowAddWH] = useState(false)
  const [whForm, setWhForm] = useState({ name: '', city: '' })
  const [whSaving, setWhSaving] = useState(false)
  const [whErr, setWhErr] = useState('')

  // Edit-warehouse — { id, name, city }
  const [editingWH, setEditingWH] = useState(null)
  const [editWHSaving, setEditWHSaving] = useState(false)
  const [editWHErr, setEditWHErr] = useState('')

  // Add-zone form — keyed by warehouseId
  const [zoneInputs, setZoneInputs] = useState({})
  const [zoneSaving, setZoneSaving] = useState({})
  const [zoneErr, setZoneErr] = useState({})

  // Edit-zone — { warehouseId, zoneId, name }
  const [editingZone, setEditingZone] = useState(null)
  const [editZoneSaving, setEditZoneSaving] = useState(false)
  const [editZoneErr, setEditZoneErr] = useState('')

  const token = () => localStorage.getItem('token')
  const authHdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  // ── Fetch all warehouses ────────────────────────────────────────────────────
  const fetchWarehouses = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/warehouses', { headers: authHdr() })
      const data = await r.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchWarehouses() }, [])

  // ── Fetch zones for a warehouse (on expand) ─────────────────────────────────
  const fetchZones = async (wid) => {
    setZonesLoading(p => ({ ...p, [wid]: true }))
    try {
      const r = await fetch(`/api/warehouses/${wid}/zones`, { headers: authHdr() })
      const data = await r.json()
      setZones(p => ({ ...p, [wid]: Array.isArray(data) ? data : [] }))
    } catch { /* silent */ } finally {
      setZonesLoading(p => ({ ...p, [wid]: false }))
    }
  }

  const toggleWarehouse = (wid) => {
    if (editingWH?.id === wid) return   // don't collapse while editing
    if (expandedId === wid) { setExpandedId(null); return }
    setExpandedId(wid)
    if (!zones[wid]) fetchZones(wid)
  }

  // ── Add warehouse ───────────────────────────────────────────────────────────
  const handleAddWarehouse = async () => {
    if (!whForm.name.trim()) { setWhErr('Name is required'); return }
    setWhSaving(true); setWhErr('')
    try {
      const r = await fetch('/api/warehouses', {
        method: 'POST',
        headers: authHdr(),
        body: JSON.stringify({ name: whForm.name.trim(), city: whForm.city.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setWhErr(data.error || 'Failed to create warehouse'); return }
      setWarehouses(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
      setWhForm({ name: '', city: '' })
      setShowAddWH(false)
    } catch { setWhErr('Network error') } finally { setWhSaving(false) }
  }

  // ── Edit warehouse ──────────────────────────────────────────────────────────
  const startEditWH = (wh, e) => {
    e.stopPropagation()
    setEditingWH({ id: wh.id, name: wh.name, city: wh.city || '' })
    setEditWHErr('')
    // Make sure it's expanded so edit form is visible
    if (expandedId !== wh.id) {
      setExpandedId(wh.id)
      if (!zones[wh.id]) fetchZones(wh.id)
    }
  }

  const handleSaveWH = async () => {
    if (!editingWH.name.trim()) { setEditWHErr('Name is required'); return }
    setEditWHSaving(true); setEditWHErr('')
    try {
      const r = await fetch(`/api/warehouses/${editingWH.id}`, {
        method: 'PUT',
        headers: authHdr(),
        body: JSON.stringify({ name: editingWH.name.trim(), city: editingWH.city.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setEditWHErr(data.error || 'Failed to update'); return }
      setWarehouses(p => p.map(w => w.id === editingWH.id ? { ...w, name: data.name, city: data.city } : w)
        .sort((a, b) => a.name.localeCompare(b.name)))
      setEditingWH(null)
    } catch { setEditWHErr('Network error') } finally { setEditWHSaving(false) }
  }

  // ── Delete warehouse ────────────────────────────────────────────────────────
  const handleDeleteWarehouse = async (wid, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this warehouse? This cannot be undone.')) return
    try {
      await fetch(`/api/warehouses/${wid}`, { method: 'DELETE', headers: authHdr() })
      setWarehouses(p => p.filter(w => w.id !== wid))
      if (expandedId === wid) setExpandedId(null)
      if (editingWH?.id === wid) setEditingWH(null)
    } catch { /* silent */ }
  }

  // ── Add zone ────────────────────────────────────────────────────────────────
  const handleAddZone = async (wid) => {
    const name = (zoneInputs[wid] || '').trim()
    if (!name) { setZoneErr(p => ({ ...p, [wid]: 'Zone name is required' })); return }
    setZoneSaving(p => ({ ...p, [wid]: true })); setZoneErr(p => ({ ...p, [wid]: '' }))
    try {
      const r = await fetch(`/api/warehouses/${wid}/zones`, {
        method: 'POST',
        headers: authHdr(),
        body: JSON.stringify({ name }),
      })
      const data = await r.json()
      if (!r.ok) { setZoneErr(p => ({ ...p, [wid]: data.error || 'Failed' })); return }
      setZones(p => ({ ...p, [wid]: [...(p[wid] || []), data].sort((a, b) => a.name.localeCompare(b.name)) }))
      setZoneInputs(p => ({ ...p, [wid]: '' }))
      setWarehouses(p => p.map(w => w.id === wid
        ? { ...w, _count: { ...w._count, zones: (w._count?.zones || 0) + 1 } }
        : w
      ))
    } catch { setZoneErr(p => ({ ...p, [wid]: 'Network error' })) }
    finally { setZoneSaving(p => ({ ...p, [wid]: false })) }
  }

  // ── Edit zone ───────────────────────────────────────────────────────────────
  const startEditZone = (wid, zone) => {
    setEditingZone({ warehouseId: wid, zoneId: zone.id, name: zone.name })
    setEditZoneErr('')
  }

  const handleSaveZone = async () => {
    if (!editingZone.name.trim()) { setEditZoneErr('Name is required'); return }
    setEditZoneSaving(true); setEditZoneErr('')
    try {
      const { warehouseId, zoneId } = editingZone
      const r = await fetch(`/api/warehouses/${warehouseId}/zones/${zoneId}`, {
        method: 'PUT',
        headers: authHdr(),
        body: JSON.stringify({ name: editingZone.name.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setEditZoneErr(data.error || 'Failed to update'); return }
      setZones(p => ({
        ...p,
        [warehouseId]: (p[warehouseId] || [])
          .map(z => z.id === zoneId ? { ...z, name: data.name } : z)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      setEditingZone(null)
    } catch { setEditZoneErr('Network error') } finally { setEditZoneSaving(false) }
  }

  // ── Delete zone ─────────────────────────────────────────────────────────────
  const handleDeleteZone = async (wid, zid) => {
    try {
      await fetch(`/api/warehouses/${wid}/zones/${zid}`, { method: 'DELETE', headers: authHdr() })
      setZones(p => ({ ...p, [wid]: (p[wid] || []).filter(z => z.id !== zid) }))
      setWarehouses(p => p.map(w => w.id === wid
        ? { ...w, _count: { ...w._count, zones: Math.max(0, (w._count?.zones || 1) - 1) } }
        : w
      ))
      if (editingZone?.zoneId === zid) setEditingZone(null)
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading warehouses…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {warehouses.length === 0 && !showAddWH && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Warehouse className="w-10 h-10 mx-auto mb-2 opacity-30" />
          No warehouses yet. Add one below.
        </div>
      )}

      {warehouses.map(wh => {
        const isOpen = expandedId === wh.id
        const whZones = zones[wh.id] || []
        const loadingZones = zonesLoading[wh.id]
        const isEditingThisWH = editingWH?.id === wh.id

        return (
          <div key={wh.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">

            {/* ── Warehouse header ── */}
            {isEditingThisWH ? (
              // ── Inline edit form for warehouse ──
              <div className="px-4 py-3 space-y-2 bg-amber-50/60 border-b border-amber-100">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Edit2 className="w-3 h-3" /> Editing warehouse
                </p>
                <div className="flex gap-2">
                  <input
                    value={editingWH.name}
                    onChange={e => setEditingWH(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveWH(); if (e.key === 'Escape') setEditingWH(null) }}
                    placeholder="Warehouse name"
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                  />
                  <input
                    value={editingWH.city}
                    onChange={e => setEditingWH(p => ({ ...p, city: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveWH(); if (e.key === 'Escape') setEditingWH(null) }}
                    placeholder="City (optional)"
                    className="w-32 px-3 py-2 text-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                  />
                </div>
                {editWHErr && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {editWHErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingWH(null)}
                    className="flex-1 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveWH}
                    disabled={editWHSaving}
                    className="flex-1 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1 transition"
                  >
                    {editWHSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              // ── Normal warehouse header row ──
              <div className="flex items-center gap-2 px-4 py-3.5">
                <button
                  onClick={() => toggleWarehouse(wh.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{wh.name}</p>
                    {wh.city && <p className="text-xs text-gray-400 truncate">{wh.city}</p>}
                  </div>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium tabular-nums flex-shrink-0">
                    {wh._count?.zones ?? whZones.length} zone{(wh._count?.zones ?? whZones.length) !== 1 ? 's' : ''}
                  </span>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  }
                </button>
                {/* Edit warehouse */}
                <button
                  onClick={e => startEditWH(wh, e)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition flex-shrink-0"
                  title="Edit warehouse"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {/* Delete warehouse */}
                <button
                  onClick={e => handleDeleteWarehouse(wh.id, e)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
                  title="Delete warehouse"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ── Zones panel (expanded) ── */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-2">
                {loadingZones ? (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 py-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading zones…
                  </p>
                ) : whZones.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1 italic">No zones yet — add one below.</p>
                ) : (
                  whZones.map(zone => {
                    const isEditingThisZone = editingZone?.zoneId === zone.id

                    return isEditingThisZone ? (
                      // ── Inline edit form for zone ──
                      <div key={zone.id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-2">
                        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> Editing zone
                        </p>
                        <div className="flex gap-2">
                          <input
                            value={editingZone.name}
                            onChange={e => setEditingZone(p => ({ ...p, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveZone(); if (e.key === 'Escape') setEditingZone(null) }}
                            autoFocus
                            className="flex-1 px-3 py-1.5 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                          />
                          <button
                            onClick={() => setEditingZone(null)}
                            className="px-2 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveZone}
                            disabled={editZoneSaving}
                            className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 flex items-center gap-1 transition"
                          >
                            {editZoneSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                        </div>
                        {editZoneErr && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {editZoneErr}
                          </p>
                        )}
                      </div>
                    ) : (
                      // ── Normal zone row ──
                      <div
                        key={zone.id}
                        className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 group"
                      >
                        <div className="flex items-center gap-2.5">
                          <MapPin className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 font-medium">{zone.name}</span>
                          {zone.description && (
                            <span className="text-xs text-gray-400 truncate max-w-[140px]">{zone.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => startEditZone(wh.id, zone)}
                            className="p-1 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition"
                            title="Edit zone"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(wh.id, zone.id)}
                            className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                            title="Delete zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Add zone inline */}
                <div className="flex gap-2 pt-1">
                  <input
                    value={zoneInputs[wh.id] || ''}
                    onChange={e => setZoneInputs(p => ({ ...p, [wh.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddZone(wh.id)}
                    placeholder="New zone name… (e.g. Repair Section)"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  />
                  <button
                    onClick={() => handleAddZone(wh.id)}
                    disabled={zoneSaving[wh.id]}
                    className="px-3 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 flex items-center gap-1.5 transition"
                  >
                    {zoneSaving[wh.id] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
                {zoneErr[wh.id] && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {zoneErr[wh.id]}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Add warehouse form ── */}
      {showAddWH ? (
        <div className="bg-white border border-primary-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-500" /> New Warehouse
            </p>
            <button onClick={() => { setShowAddWH(false); setWhForm({ name: '', city: '' }); setWhErr('') }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Warehouse Name <span className="text-red-400">*</span>
              </label>
              <input
                value={whForm.name}
                onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddWarehouse()}
                placeholder="e.g. Main Warehouse - Mumbai"
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">City (optional)</label>
              <input
                value={whForm.city}
                onChange={e => setWhForm(f => ({ ...f, city: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddWarehouse()}
                placeholder="e.g. Mumbai"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50"
              />
            </div>
          </div>

          {whErr && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5" /> {whErr}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setShowAddWH(false); setWhForm({ name: '', city: '' }); setWhErr('') }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleAddWarehouse}
              disabled={whSaving}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {whSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Warehouse
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddWH(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary-300 text-primary-500 hover:border-primary-400 hover:bg-primary-50/50 transition text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add New Warehouse
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'product-types', label: 'Product Types', icon: Package   },
  { id: 'set-types',     label: 'Set Types',     icon: Layers    },
  { id: 'attributes',   label: 'Attributes',    icon: Palette   },
  { id: 'warehouses',   label: 'Warehouses',    icon: Warehouse },
]

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND CENTRE — wider modal with tabs
// Props: open (bool), onClose (fn)
// ─────────────────────────────────────────────────────────────────────────────
export default function CommandCentre({ open, onClose }) {
  const {
    productTypes, setTypes,
    brandsRaw, sizesRaw, colorsRaw,
    addBrand, deleteBrand,
    addSize, deleteSize,
    addColor, deleteColor,
    locationPresetsRaw, addLocationPreset, deleteLocationPreset,
  } = useCatalogue()

  const [activeTab, setActiveTab] = useState('product-types')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const tabCounts = {
    'product-types': productTypes.length,
    'set-types':     setTypes.length,
    'attributes':    brandsRaw.length + sizesRaw.length + colorsRaw.length + locationPresetsRaw.length,
    'warehouses':    null, // loaded lazily inside WarehousesSection
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — centred, wider */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Modal Header ── */}
          <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-primary-600 to-primary-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-base leading-tight">Catalogue</p>
                <p className="text-xs text-primary-200 mt-0.5">
                  {productTypes.length} types · {brandsRaw.length} brands · {sizesRaw.length} sizes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/20 text-white/70 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Warning banner ── */}
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">Changes are immediately visible to all ground team members.</p>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex items-center gap-1 px-6 pt-4 pb-0 flex-shrink-0 border-b border-gray-100">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all border-b-2 -mb-px ${
                    active
                      ? 'text-primary-700 border-primary-600 bg-primary-50/60'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tabCounts[tab.id] !== null && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs tabular-nums font-semibold ${
                      active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tabCounts[tab.id]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/40">
            {activeTab === 'product-types' && <ProductTypesSection />}

            {activeTab === 'set-types' && <SetTypesSection />}

            {activeTab === 'attributes' && (
              <div className="space-y-3">
                <Section icon={Tag} title="Brands" count={brandsRaw.length} defaultOpen>
                  <SimpleListManager
                    items={brandsRaw}
                    onAdd={addBrand}
                    onDelete={deleteBrand}
                    placeholder="e.g. Samsung, Sony…"
                    label="brands"
                  />
                </Section>
                <Section icon={Ruler} title="Sizes" count={sizesRaw.length}>
                  <SimpleListManager
                    items={sizesRaw.map(s => ({ ...s, name: s.value }))}
                    onAdd={addSize}
                    onDelete={deleteSize}
                    placeholder='e.g. 55", Standard…'
                    label="sizes"
                  />
                </Section>
                <Section icon={Palette} title="Colors" count={colorsRaw.length}>
                  <SimpleListManager
                    items={colorsRaw}
                    onAdd={addColor}
                    onDelete={deleteColor}
                    placeholder="e.g. Black, Space Gray…"
                    label="colors"
                  />
                </Section>
                <Section icon={MapPin} title="Location Presets" count={locationPresetsRaw.length}>
                  <div className="text-xs text-gray-400 mb-3 flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                    These appear as quick-pick chips in the Specific Location field when adding devices.
                    The field stays free-text — presets are suggestions only.
                  </div>
                  <SimpleListManager
                    items={locationPresetsRaw}
                    onAdd={addLocationPreset}
                    onDelete={deleteLocationPreset}
                    placeholder="e.g. Rack A, Shelf 3, Bin 12…"
                    label="location presets"
                  />
                </Section>
              </div>
            )}

            {activeTab === 'warehouses' && <WarehousesSection />}
          </div>
        </div>
      </div>
    </>
  )
}