/**
 * src/components/EditDeviceModal.jsx
 * ─────────────────────────────────────
 * Manager/SuperAdmin → directly edits hardware attributes (brand, size, model, color, gpsId)
 * Ground Team        → fills in proposed changes → raises edit_device inventory request
 * No code or type changes allowed.
 * Calls onSuccess(updatedDevice) after manager edits.
 */

import { useState, useMemo } from 'react'
import { Pencil, X, Save, RefreshCw, AlertCircle, Send, CheckCircle, Tag, Ruler, Box, Palette, Hash } from 'lucide-react'
import { useCatalogue } from '../context/CatalogueContext'
import { inventoryRequestApi } from '../api/inventoryRequestApi'

const authHdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const FieldRow = ({ icon: Icon, label, current, value, onChange, options, disabled }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 text-gray-400" />} {label}
      {current && <span className="ml-auto text-gray-400 font-normal">Currently: <span className="text-gray-600">{current}</span></span>}
    </label>
    {options ? (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50 disabled:opacity-60"
      >
        <option value="">— unchanged —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Leave blank to keep current"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50 disabled:opacity-60"
      />
    )}
  </div>
)

export default function EditDeviceModal({ device, isManager, onSuccess, onClose }) {
  const { brands: catalogueBrands, sizes: catalogueSizes, colors: catalogueColors } = useCatalogue()

  const [form, setForm] = useState({
    brand: '',
    size:  '',
    model: '',
    color: '',
    gpsId: '',
  })
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }))

  // Build the diff: only include fields that were actually filled in / changed
  const proposedChanges = useMemo(() => {
    const changes = {}
    if (form.brand && form.brand !== device.brand) changes.brand = form.brand
    if (form.size  && form.size  !== device.size)  changes.size  = form.size
    if (form.model && form.model !== device.model) changes.model = form.model
    if (form.color && form.color !== device.color) changes.color = form.color
    if (form.gpsId && form.gpsId !== device.gpsId) changes.gpsId = form.gpsId
    return changes
  }, [form, device])

  const hasChanges = Object.keys(proposedChanges).length > 0

  // Manager: direct PUT
  const handleManagerSave = async () => {
    if (!hasChanges) { setError('No changes made'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/devices/${device.id}`, {
        method: 'PUT',
        headers: authHdr(),
        body: JSON.stringify(proposedChanges),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Failed to update device'); return }
      onSuccess(data)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  // Ground team: raise inventory request
  const handleGroundRequest = async () => {
    if (!hasChanges) { setError('No changes proposed'); return }
    setSaving(true); setError('')
    try {
      await inventoryRequestApi.requestEditDevice({
        targetDeviceId:   device.id,
        targetDeviceCode: device.code,
        proposedChanges,
        note: note.trim() || null,
      })
      setDone(true)
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to send request')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Request Sent</h3>
          <p className="text-sm text-gray-500 mb-6">Your edit request for <span className="font-mono font-semibold text-gray-700">{device.code}</span> has been sent to the manager for approval.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isManager ? 'Edit Device' : 'Request Device Edit'}
              </h3>
              <p className="text-xs text-gray-400 font-mono">{device.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {!isManager && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Ground Team — Change Request</p>
              <p>Fill in the fields you want to change. A manager will review and apply the changes.</p>
            </div>
          )}

          {/* Fields */}
          <FieldRow icon={Tag}    label="Brand"  current={device.brand} value={form.brand} onChange={set('brand')} options={catalogueBrands.length ? catalogueBrands : null} />
          <FieldRow icon={Ruler}  label="Size"   current={device.size}  value={form.size}  onChange={set('size')}  options={catalogueSizes.length ? catalogueSizes : null} />
          <FieldRow icon={Box}    label="Model"  current={device.model} value={form.model} onChange={set('model')} />
          <FieldRow icon={Palette} label="Color" current={device.color} value={form.color} onChange={set('color')} options={catalogueColors.length ? catalogueColors : null} />
          <FieldRow icon={Hash}   label="GPS ID" current={device.gpsId} value={form.gpsId} onChange={set('gpsId')} />

          {/* Diff preview */}
          {hasChanges && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 mb-1">Changes</p>
              {Object.entries(proposedChanges).map(([field, newVal]) => (
                <div key={field} className="flex items-center gap-2 text-xs">
                  <span className="capitalize text-gray-500 w-12">{field}</span>
                  <span className="line-through text-gray-400">{device[field] || '—'}</span>
                  <span className="text-gray-300">→</span>
                  <span className="font-semibold text-emerald-700">{newVal}</span>
                </div>
              ))}
            </div>
          )}

          {/* Note — ground team only */}
          {!isManager && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Reason / Note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Wrong color recorded during initial entry"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-gray-50/50"
              />
            </div>
          )}

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
              onClick={isManager ? handleManagerSave : handleGroundRequest}
              disabled={saving || !hasChanges}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {saving
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : isManager ? <Save className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />
              }
              {saving ? 'Saving…' : isManager ? 'Save Changes' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}