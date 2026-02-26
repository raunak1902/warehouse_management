/**
 * src/components/LifecycleActionModal.jsx
 * ─────────────────────────────────────────
 * Generic modal for requesting any lifecycle step change.
 * Used from: Devices page, Barcode scan result, Requests page.
 *
 * Props:
 *   device      — Device or DeviceSet object (must have .id, .code, .lifecycleStatus, ._isSet)
 *   onClose     — callback
 *   onSuccess   — callback(updatedStep)
 *   forceStep   — optional: pre-select a specific step (e.g. 'report_issue')
 */

import { useState, useMemo } from 'react'
import {
  X, Shield, AlertTriangle, Wrench, CheckCircle2, Send, Loader2,
  ChevronRight, Layers, Monitor, Info, ArrowRight, Truck, Package,
  Wrench as WrenchIcon, RotateCcw, Zap, AlertCircle,
} from 'lucide-react'
import {
  lifecycleRequestApi, STEP_META, VALID_NEXT_STEPS, HEALTH_OPTIONS,
} from '../api/lifecycleRequestApi'
import { normaliseRole } from '../App'

// ── Step icon map ──────────────────────────────────────────────────────────────
const STEP_ICONS = {
  assigning:         ChevronRight,
  ready_to_deploy:   CheckCircle2,
  in_transit:        Truck,
  received:          Package,
  installed:         WrenchIcon,
  active:            Zap,
  under_maintenance: Wrench,
  return_initiated:  RotateCcw,
  returned:          Package,
  lost:              AlertTriangle,
}

const currentUserRole = () => {
  try { return JSON.parse(localStorage.getItem('user'))?.role ?? '' } catch { return '' }
}

// ─────────────────────────────────────────────────────────────────────────────
const LifecycleActionModal = ({ device, onClose, onSuccess, forceStep = null }) => {
  const isSet       = !!device?._isSet
  const isManager   = ['manager', 'superadmin'].includes(normaliseRole(currentUserRole()))
  const currentStep = device?.lifecycleStatus ?? 'available'

  // Available next steps for this device
  const availableSteps = useMemo(() => {
    if (forceStep) return [forceStep]
    return VALID_NEXT_STEPS[currentStep] ?? []
  }, [currentStep, forceStep])

  const [selectedStep,   setSelectedStep]   = useState(availableSteps[0] ?? null)
  const [healthStatus,   setHealthStatus]   = useState('ok')
  const [healthNote,     setHealthNote]     = useState('')
  const [note,           setNote]           = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitted,      setSubmitted]      = useState(false)
  const [autoApproved,   setAutoApproved]   = useState(false)
  const [error,          setError]          = useState(null)

  const selectedMeta   = selectedStep ? STEP_META[selectedStep] : null
  const needsHealthNote = healthStatus !== 'ok'

  const canSubmit =
    selectedStep &&
    (!needsHealthNote || healthNote.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        toStep:       selectedStep,
        healthStatus,
        healthNote:   needsHealthNote ? healthNote.trim() : undefined,
        note:         note.trim() || undefined,
        ...(isSet ? { setId: device.id } : { deviceId: device.id }),
      }
      const res = await lifecycleRequestApi.create(body)
      setAutoApproved(!!res.autoApproved)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center
            ${autoApproved ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            {autoApproved
              ? <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              : <Send className="w-10 h-10 text-blue-600" />
            }
          </div>

          {autoApproved ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Done!</h2>
              <p className="text-gray-500 text-sm mb-4">
                <span className="font-semibold text-gray-700">{device.code}</span> has been
                moved to <span className="font-semibold text-gray-700">{selectedMeta?.label}</span>.
              </p>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800
                rounded-full text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Status Updated Immediately
              </span>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Sent!</h2>
              <p className="text-gray-500 text-sm mb-4">
                Your <span className="font-semibold text-gray-700">{selectedMeta?.label}</span> request
                for <span className="font-semibold text-gray-700">{device.code}</span> has been sent
                for approval.
              </p>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800
                rounded-full text-sm font-semibold">
                ⏳ Awaiting Admin Approval
              </span>
            </>
          )}

          <button
            onClick={() => { onSuccess?.(selectedStep); onClose() }}
            className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                {isSet
                  ? <Layers className="w-5 h-5 text-white" />
                  : <Monitor className="w-5 h-5 text-white" />
                }
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  Update Status
                </p>
                <p className="text-white font-bold text-lg leading-tight">{device.code}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current status pill */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-slate-400 text-xs">Current:</span>
            <span className="px-2 py-0.5 bg-white/10 text-white text-xs rounded-full font-medium">
              {STEP_META[currentStep]?.emoji} {STEP_META[currentStep]?.label ?? currentStep}
            </span>
            {availableSteps.length > 0 && (
              <>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400 text-xs">Moving to</span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {availableSteps.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No further steps available</p>
              <p className="text-gray-400 text-sm mt-1">
                This device is in a terminal state ({currentStep}).
              </p>
            </div>
          ) : (
            <>
              {/* Step selector */}
              {availableSteps.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Select next step</p>
                  <div className="space-y-2">
                    {availableSteps.map(step => {
                      const meta = STEP_META[step]
                      const Icon = STEP_ICONS[step] ?? ChevronRight
                      return (
                        <button
                          key={step}
                          onClick={() => setSelectedStep(step)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                            ${selectedStep === step
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base
                            ${selectedStep === step ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            {meta?.emoji}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold
                              ${selectedStep === step ? 'text-blue-700' : 'text-gray-800'}`}>
                              {meta?.label ?? step}
                            </p>
                          </div>
                          {selectedStep === step && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Single step — just show it as info */}
              {availableSteps.length === 1 && selectedStep && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-2xl">{selectedMeta?.emoji}</span>
                  <div>
                    <p className="font-semibold text-blue-800">{selectedMeta?.label}</p>
                    <p className="text-xs text-blue-600">Next step in the lifecycle</p>
                  </div>
                </div>
              )}

              {/* Health status */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Health Status <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {HEALTH_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setHealthStatus(opt.value); if (opt.value === 'ok') setHealthNote('') }}
                      className={`p-3 rounded-xl border-2 text-left transition-all
                        ${healthStatus === opt.value
                          ? opt.value === 'ok'      ? 'border-emerald-500 bg-emerald-50'
                          : opt.value === 'repair'  ? 'border-amber-500 bg-amber-50'
                          : opt.value === 'lost'    ? 'border-red-600 bg-red-50'
                          :                          'border-red-400 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <p className={`text-xs font-semibold
                        ${healthStatus === opt.value
                          ? opt.value === 'ok'    ? 'text-emerald-700'
                          : opt.value === 'repair'? 'text-amber-700'
                          : 'text-red-700'
                          : 'text-gray-700'
                        }`}>{opt.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {/* Mandatory note when health is not OK */}
                {needsHealthNote && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-red-600 mb-1">
                      Health note is required <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={healthNote}
                      onChange={e => setHealthNote(e.target.value)}
                      rows={3}
                      placeholder="Describe the issue in detail…"
                      className="w-full px-3 py-2 border-2 border-red-300 rounded-xl text-sm outline-none
                        focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      This note creates an audit trail of when and where the issue occurred.
                    </p>
                  </div>
                )}
              </div>

              {/* Optional note */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Any extra context for this update…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none
                    focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Manager auto-approve notice */}
              {isManager && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    As a Manager, this will be <strong>immediately applied</strong> — no separate approval needed.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {availableSteps.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 p-4 flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3
                bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl
                font-semibold text-sm hover:from-blue-700 hover:to-indigo-700
                disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{isManager ? 'Applying…' : 'Sending…'}</>
              ) : isManager ? (
                <><CheckCircle2 className="w-4 h-4" />Apply Now</>
              ) : (
                <><Send className="w-4 h-4" />Send Request</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LifecycleActionModal