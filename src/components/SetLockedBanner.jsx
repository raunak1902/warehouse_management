/**
 * src/components/SetLockedBanner.jsx
 * ────────────────────────────────────
 * Shown whenever a device that belongs to a set is accessed for a lifecycle action.
 * Blocks the action and guides the user to the set instead.
 *
 * Props:
 *   device        — device object with .setId and .code
 *   setCode       — display code of the parent set (e.g. "ASET-001")
 *   onGoToSet     — optional callback: navigate to the set view
 *   isSuperAdmin  — bool: if true, show the emergency override toggle
 *   onOverride    — callback(true) when superadmin activates override
 */

import { useState } from 'react'
import { Lock, Layers, ArrowRight, AlertTriangle, ShieldAlert } from 'lucide-react'

const SetLockedBanner = ({ device, setCode, onGoToSet, isSuperAdmin = false, onOverride }) => {
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const label = setCode || (device?.setId ? `Set #${device.setId}` : 'a set')

  const handleOverrideConfirm = () => {
    if (!overrideReason.trim()) return
    onOverride?.(true, overrideReason.trim())
    setShowOverrideConfirm(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main lock banner */}
      <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-800 leading-tight">
            Part of Set — Action Locked
          </p>
          <p className="text-xs text-orange-600 mt-1 leading-relaxed">
            <span className="font-mono font-semibold">{device?.code}</span> belongs to{' '}
            <span className="font-mono font-semibold">{label}</span>.
            Lifecycle steps must be performed on the <strong>set</strong>, not individual components.
          </p>
          <p className="text-[11px] text-orange-500 mt-1">
            💡 Health status updates (damage / repair reports) are still allowed individually.
          </p>
        </div>
      </div>

      {/* Set badge + link */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border border-orange-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-500" />
          <span className="text-xs text-gray-500">Parent Set</span>
          <span className="font-mono font-bold text-sm text-orange-700">{label}</span>
        </div>
        {onGoToSet && (
          <button
            onClick={onGoToSet}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200
              text-orange-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Go to Set <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* SuperAdmin override section */}
      {isSuperAdmin && (
        <div className="border border-red-200 rounded-xl overflow-hidden">
          {!showOverrideConfirm ? (
            <button
              onClick={() => setShowOverrideConfirm(true)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100
                text-red-700 text-xs font-semibold transition-colors text-left"
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>Emergency Override (SuperAdmin only)</span>
              <span className="ml-auto text-[10px] text-red-400 font-normal">
                Use only in emergencies
              </span>
            </button>
          ) : (
            <div className="p-4 bg-red-50 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-800">Override Set Lock</p>
                  <p className="text-[11px] text-red-600 mt-0.5">
                    This action will be logged with your name and reason. Use only when absolutely necessary.
                  </p>
                </div>
              </div>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={2}
                placeholder="Reason for emergency override (required)…"
                className="w-full px-3 py-2 border-2 border-red-300 rounded-xl text-xs outline-none
                  focus:ring-2 focus:ring-red-400 resize-none bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowOverrideConfirm(false); setOverrideReason('') }}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 border border-gray-200
                    rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideConfirm}
                  disabled={!overrideReason.trim()}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg
                    hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SetLockedBanner