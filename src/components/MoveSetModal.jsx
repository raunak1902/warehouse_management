/**
 * src/components/MoveSetModal.jsx
 * ─────────────────────────────────────
 * Move Set modal — updates warehouse location for a set AND all its component devices.
 * Mirrors MoveDeviceModal pattern.
 * Calls PATCH /api/sets/:id/location
 */

import { useState } from 'react'
import { MapPin, X, ArrowRight, Save, RefreshCw, AlertCircle, Building2, Package, Info } from 'lucide-react'
import WarehouseLocationSelector from './WarehouseLocationSelector'
import { API_URL } from '../config/api'

const authHdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

function LocationBreadcrumb({ set }) {
  const parts = [
    set.warehouse?.name || (set.warehouseId ? `Warehouse #${set.warehouseId}` : null),
    set.warehouseZone,
    set.warehouseSpecificLocation,
  ].filter(Boolean)

  if (!parts.length) {
    return <span className="text-gray-400 italic text-sm">No location set</span>
  }

  return (
    <span className="flex items-center gap-1 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">{p}</span>
        </span>
      ))}
    </span>
  )
}

export default function MoveSetModal({ set, onSuccess, onClose }) {
  const [warehouseId,      setWarehouseId]      = useState(set.warehouseId || null)
  const [zone,             setZone]             = useState(set.warehouseZone || '')
  const [specificLocation, setSpecificLocation] = useState(set.warehouseSpecificLocation || '')
  const [notes,            setNotes]            = useState('')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')

  const componentCount = set.components?.length ?? 0

  const unchanged =
    warehouseId === (set.warehouseId || null) &&
    zone        === (set.warehouseZone || '') &&
    specificLocation === (set.warehouseSpecificLocation || '')

  const handleSave = async () => {
    if (!warehouseId) { setError('Please select a warehouse'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API_URL}/api/sets/${set.id}/location`, {
        method: 'PATCH',
        headers: authHdr(),
        body: JSON.stringify({ warehouseId, warehouseZone: zone, warehouseSpecificLocation: specificLocation, notes }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Failed to update location'); return }
      onSuccess(data)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Move Set</h3>
              <p className="text-xs text-gray-400 font-mono">{set.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Current location */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Current Location
            </p>
            <LocationBreadcrumb set={set} />
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-violet-600 font-semibold bg-violet-50 px-3 py-1.5 rounded-full border border-violet-100">
              <ArrowRight className="w-3.5 h-3.5" /> Moving to
            </div>
          </div>

          {/* Warehouse Location Selector */}
          <WarehouseLocationSelector
            warehouseId={warehouseId}
            zone={zone}
            specificLocation={specificLocation}
            onWarehouseChange={setWarehouseId}
            onZoneChange={setZone}
            onSpecificLocationChange={setSpecificLocation}
            required={true}
          />

          {/* Cascade notice */}
          {componentCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-xl">
              <Info className="w-3.5 h-3.5 text-violet-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-700">
                <strong>{componentCount} component device{componentCount > 1 ? 's' : ''}</strong> will also be updated to this location automatically.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Moved after reorganisation, new storage area"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none resize-none bg-gray-50/50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || unchanged}
              className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Confirm Move'}
            </button>
          </div>

          {unchanged && (
            <p className="text-center text-xs text-gray-400">Change at least one location field to save</p>
          )}
        </div>
      </div>
    </div>
  )
}