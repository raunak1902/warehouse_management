/**
 * src/components/MoveDeviceModal.jsx
 * ─────────────────────────────────────
 * Quick "Move Device" modal — updates warehouse location only.
 * Accessible to all roles (ground team + manager + superadmin).
 * Calls PATCH /api/devices/:id/location
 * Calls onSuccess(updatedDevice) so parent can refresh state in-place.
 */

import { useState } from 'react'
import { MapPin, X, ArrowRight, Save, RefreshCw, AlertCircle, Building2 } from 'lucide-react'
import WarehouseLocationSelector from './WarehouseLocationSelector'

const authHdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

// Readable breadcrumb from device warehouse fields
function LocationBreadcrumb({ device }) {
  const parts = [
    device.warehouse?.name || (device.warehouseId ? `Warehouse #${device.warehouseId}` : null),
    device.warehouseZone,
    device.warehouseSpecificLocation,
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

export default function MoveDeviceModal({ device, onSuccess, onClose }) {
  const [warehouseId,           setWarehouseId]           = useState(device.warehouseId || null)
  const [zone,                  setZone]                  = useState(device.warehouseZone || '')
  const [specificLocation,      setSpecificLocation]      = useState(device.warehouseSpecificLocation || '')
  const [notes,                 setNotes]                 = useState('')
  const [saving,                setSaving]                = useState(false)
  const [error,                 setError]                 = useState('')

  const unchanged =
    warehouseId === (device.warehouseId || null) &&
    zone        === (device.warehouseZone || '') &&
    specificLocation === (device.warehouseSpecificLocation || '')

  const handleSave = async () => {
    if (!warehouseId) { setError('Please select a warehouse'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/devices/${device.id}/location`, {
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
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Move Device</h3>
              <p className="text-xs text-gray-400 font-mono">{device.code}</p>
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
            <LocationBreadcrumb device={device} />
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-teal-600 font-semibold bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100">
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

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Moved after client return, placed in repair zone"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-gray-50/50"
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
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
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