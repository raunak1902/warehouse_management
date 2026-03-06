/**
 * src/components/HealthUpdateModal.jsx
 * ─────────────────────────────────────
 * Single shared modal for all health status update requests.
 * Used from: BarcodeResultCard, Devices (DeviceDetailModal), Requests (NextStepPanel).
 *
 * Rules enforced here:
 *  • repair / damage / lost  → proof + note required
 *  • ok (from repair/damage) → proof + note required  (clearance proof)
 *  • ok (fresh / never bad)  → no proof, no note
 *  • lost                    → terminal; this modal is never shown for lost devices
 *                              (callers must render <LostHealthBanner> instead)
 */

import { useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Paperclip, Zap, ArrowRight } from 'lucide-react'
import { lifecycleRequestApi, HEALTH_OPTIONS, healthNeedsProof, MAX_PROOF_FILES } from '../api/lifecycleRequestApi'
import { ProofUploadPanel, useProofFiles } from './ProofUpload'

// ─────────────────────────────────────────────────────────────
// LostHealthBanner — shown instead of the modal trigger button
// when a device's healthStatus === 'lost'
// ─────────────────────────────────────────────────────────────
export const LostHealthBanner = () => (
  <div className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl cursor-not-allowed select-none">
    <span className="text-lg flex-shrink-0">🔒</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-gray-600">Device is Lost</p>
      <p className="text-[11px] text-gray-400 mt-0.5">Health updates are not available for lost devices.</p>
    </div>
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded-full flex-shrink-0">
      Locked
    </span>
  </div>
)

// ─────────────────────────────────────────────────────────────
// HealthUpdateModal
// Props:
//   device     — full device object (needs .id, .code, .healthStatus)
//   isManager  — bool, controls auto-approve notice + button label
//   onClose    — called when modal dismissed without action
//   onDone     — called after successful submit (parent refreshes)
// ─────────────────────────────────────────────────────────────
const HealthUpdateModal = ({ device, isManager, onClose, onDone }) => {
  const currentHealth = device.healthStatus || 'ok'

  // Pre-select current health so user sees where they're starting from
  const [health,      setHealth]      = useState(currentHealth)
  const [healthNote,  setHealthNote]  = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const proof = useProofFiles()

  const needsProof = healthNeedsProof(health, currentHealth)
  const proofMissing = needsProof && proof.files.length === 0
  const noteRequired = needsProof
  // Submitting the same health that's already set is a no-op — disable it
  const isUnchanged = health === currentHealth
  const canSubmit = !isUnchanged && health && (!noteRequired || healthNote.trim()) && !proofMissing

  const handleHealthChange = (val) => {
    setHealth(val)
    // Reset proof/note when switching options to avoid stale data
    if (!healthNeedsProof(val, currentHealth)) {
      setHealthNote('')
      proof.reset()
    }
    setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (isUnchanged)             setSubmitError('Select a different health status to submit a change.')
      else if (proofMissing)       setSubmitError('Attach at least one photo or document as proof.')
      else if (!healthNote.trim()) setSubmitError('Please describe the issue.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await lifecycleRequestApi.create(
        {
          deviceId:    device.id,
          toStep:      'health_update',
          healthStatus: health,
          healthNote:  noteRequired ? healthNote.trim() : undefined,
        },
        proof.files,
      )
      setDone(true)
      setTimeout(() => onDone(), 1200)
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  // Exclude 'lost' from options if device is already lost (terminal — but caller
  // should have shown LostHealthBanner instead). Also show all 4 options otherwise.
  const availableOptions = HEALTH_OPTIONS.filter(opt => {
    // Can't re-select lost if already lost (shouldn't reach here, but safety net)
    if (currentHealth === 'lost') return false
    return true
  })

  // Helper: label for the note field changes depending on transition type
  const noteLabel = health === 'ok'
    ? 'Clearance Note'
    : health === 'lost'
    ? 'Loss Description'
    : 'Issue Description'

  const notePlaceholder = health === 'ok'
    ? 'Describe how the issue was resolved or confirmed working…'
    : health === 'lost'
    ? 'Where and when was it last seen? Any incident details…'
    : 'What is wrong? Any visible damage or symptoms…'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-cyan-400 to-blue-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-lg flex-shrink-0">
              🩺
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm leading-tight">Report Health Status</h3>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{device.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Current health indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current:</span>
            <CurrentHealthPill health={currentHealth} />
          </div>

          {/* Role notice */}
          {isManager ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-semibold">As a manager, this will apply immediately.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">This will be sent to a manager for approval.</p>
            </div>
          )}

          {/* Health options grid */}
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">
              New Health Status <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableOptions.map(opt => {
                const isSelected = health === opt.value
                const isCurrent  = opt.value === currentHealth
                const willNeedProof = healthNeedsProof(opt.value, currentHealth)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleHealthChange(opt.value)}
                    className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all relative
                      ${isSelected
                        ? opt.cls + ' shadow-sm'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                      }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${opt.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold leading-tight ${isSelected ? '' : 'text-gray-700'}`}>
                        {opt.label}
                        {isCurrent && (
                          <span className="ml-1 text-[9px] font-semibold text-gray-400 normal-case">(current)</span>
                        )}
                      </p>
                      <p className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'opacity-70' : 'text-gray-400'}`}>
                        {opt.sub}
                      </p>
                      {willNeedProof && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-indigo-500 mt-1">
                          <Paperclip className="w-2.5 h-2.5" />proof req.
                        </span>
                      )}
                      {opt.value === 'ok' && currentHealth === 'ok' && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-500 mt-1">
                          no proof needed
                        </span>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clearance notice when returning to ok from bad state */}
          {health === 'ok' && ['repair', 'damage'].includes(currentHealth) && (
            <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 font-medium">
                Clearing a previous issue requires proof that the device is now fully operational.
              </p>
            </div>
          )}

          {/* Same-value notice */}
          {isUnchanged && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500">Select a different status to submit a change.</p>
            </div>
          )}

          {/* Note field */}
          {noteRequired && !isUnchanged && (
            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                {noteLabel} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={healthNote}
                onChange={e => setHealthNote(e.target.value)}
                rows={3}
                placeholder={notePlaceholder}
                maxLength={400}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400 resize-none"
              />
              <p className="text-[10px] text-gray-400 text-right mt-0.5">{healthNote.length}/400</p>
            </div>
          )}

          {/* Proof upload */}
          {needsProof && !isUnchanged && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3 text-indigo-400" />
                  Proof Attachment <span className="text-rose-500">*</span>
                </p>
                {proof.files.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {proof.files.length}/{MAX_PROOF_FILES} ready
                  </span>
                )}
              </div>
              <div className="p-3">
                <ProofUploadPanel
                  proofConfig={{
                    required:   true,
                    accept:     'image/*,video/*,application/pdf',
                    allowVideo: true,
                    allowPdf:   true,
                    hint: health === 'ok'
                      ? '📸 Attach a photo or video showing the device is working correctly.'
                      : health === 'lost'
                      ? '📎 Attach any evidence — last photo, video, or an incident report (PDF).'
                      : '📸 Attach a photo, short video, or document showing the issue.',
                  }}
                  files={proof.files}
                  previews={proof.previews}
                  onAdd={proof.add}
                  onRemove={proof.remove}
                  compact={true}
                />
              </div>
            </div>
          )}

          {/* No-proof reassurance for fresh ok */}
          {health === 'ok' && currentHealth === 'ok' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">No proof required — device is already in good condition.</p>
            </div>
          )}

          {/* Error */}
          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1">{submitError}</p>
              <button onClick={() => setSubmitError(null)}>
                <X className="w-3 h-3 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-extrabold transition-all shadow-sm
                ${done
                  ? 'bg-emerald-600'
                  : canSubmit && !submitting
                  ? 'bg-cyan-600 hover:bg-cyan-700 active:scale-95'
                  : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
              {done
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> {isManager ? 'Applied!' : 'Submitted!'}</>
                : submitting
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                : isManager
                ? <><Zap className="w-3.5 h-3.5" /> Apply Now</>
                : <><ArrowRight className="w-3.5 h-3.5" /> Submit Report</>
              }
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// Small inline pill showing current health with colour
const CurrentHealthPill = ({ health }) => {
  const map = {
    ok:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    repair: 'bg-amber-100   text-amber-700   border-amber-200',
    damage: 'bg-red-100     text-red-700     border-red-200',
    lost:   'bg-gray-100    text-gray-600    border-gray-300',
  }
  const labels = { ok: 'Healthy', repair: 'Needs Repair', damage: 'Damaged', lost: 'Lost' }
  const dots   = { ok: 'bg-emerald-500', repair: 'bg-amber-400', damage: 'bg-red-500', lost: 'bg-gray-400' }
  const cls = map[health] || map.ok
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[health] || dots.ok}`} />
      {labels[health] || health}
    </span>
  )
}

export default HealthUpdateModal