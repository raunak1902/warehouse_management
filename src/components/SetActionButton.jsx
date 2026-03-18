/**
 * SetActionButton.jsx
 * ─────────────────────────────────────────────────────────────
 * Shared set lifecycle action component.
 * Used by both SetBarcodeGenerator (click path) and BarcodeResultCard (scan path).
 *
 * Exports:
 *   SetActionButton   — main lifecycle action button for a set
 *   PendingBanner     — shown when a pending request exists
 *   HealthConfirm     — health + proof confirmation panel
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  X, Clock, CheckCircle2, AlertTriangle, ArrowRight,
  RotateCcw, Truck, Package, Paperclip,
} from 'lucide-react'
import { useInventory, HEALTH_COLORS } from '../context/InventoryContext'
import {
  PROOF_CONFIG, HEALTH_REQUIRES_PROOF, HEALTH_OPTIONS,
  MAX_PROOF_FILES,
} from '../api/lifecycleRequestApi'
import {
  isImage, isVideo, isPdf, ProofUploadPanel,
} from './ProofUpload'
import AssignToClientModal from "./Assigntoclientmodal"
import HealthUpdateModal, { LostHealthBanner } from './HealthUpdateModal'
import LifecycleActionModal from './LifecycleActionModal'

// ─────────────────────────────────────────────────────────────
// HEALTH CONFIRM PANEL
// ─────────────────────────────────────────────────────────────
export const HealthConfirm = ({ currentHealth, stepLabel, toStep, onConfirm, onCancel, busy }) => {
  const [health,        setHealth]        = useState(currentHealth || 'ok')
  const [note,          setNote]          = useState('')
  const [proofFiles,    setProofFiles]    = useState([])
  const [proofPreviews, setProofPreviews] = useState([])
  const [submitError,   setSubmitError]   = useState(null)

  const needsNote = health !== 'ok'

  const stepProofCfg   = toStep ? PROOF_CONFIG[toStep] : null
  const healthTrigger  = HEALTH_REQUIRES_PROOF.includes(health)
  const effectiveProof = useMemo(() => {
    if (stepProofCfg) return stepProofCfg
    if (healthTrigger) return {
      required:   true,
      accept:     'image/*,video/*,application/pdf',
      allowVideo: true,
      allowPdf:   true,
      label:      'Health Condition Evidence',
      hint:       '🩺 Proof required when marking damaged or in need of repair.',
    }
    return null
  }, [stepProofCfg, healthTrigger])

  const proofRequired = !!effectiveProof?.required
  const proofMissing  = proofRequired && proofFiles.length === 0
  const canSubmit     = (!needsNote || note.trim().length > 0) && !proofMissing

  const handleHealthChange = (val) => {
    setHealth(val)
    setProofFiles([])
    setProofPreviews([])
    setSubmitError(null)
  }

  const addFiles = useCallback((incoming) => {
    setProofFiles(prev => {
      const next = [...prev, ...incoming].slice(0, MAX_PROOF_FILES)
      const startIdx = prev.length
      next.slice(startIdx).forEach((file, i) => {
        if (isImage(file) || isVideo(file)) {
          const url = URL.createObjectURL(file)
          setProofPreviews(pp => { const u = [...pp]; u[startIdx + i] = url; return u })
        }
      })
      return next
    })
  }, [])

  const removeFile = useCallback((idx) => {
    setProofFiles(p => p.filter((_, i) => i !== idx))
    setProofPreviews(p => p.filter((_, i) => i !== idx))
  }, [])

  const handleConfirm = () => {
    if (!canSubmit) {
      if (proofMissing) setSubmitError('Please attach at least one proof file before submitting.')
      return
    }
    setSubmitError(null)
    onConfirm(health, needsNote ? note.trim() : null, proofFiles)
  }

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Confirm health &amp; attach proof</p>
        <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">→ {stepLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HEALTH_OPTIONS.filter(o => o.value !== 'lost').map(opt => (
          <button key={opt.value} onClick={() => handleHealthChange(opt.value)}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-all
              ${health === opt.value
                ? opt.cls + ' ring-2 ring-offset-1 ' + opt.dot.replace('bg-', 'ring-')
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
            {opt.label}
          </button>
        ))}
      </div>

      {needsNote && (
        <div>
          <p className="text-xs text-amber-700 font-medium mb-1">
            ⚠ Note required for {health === 'repair' ? 'Needs Repair' : 'Damaged'} status:
          </p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Describe the issue…"
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm resize-none bg-white" />
        </div>
      )}

      {effectiveProof && (
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
            {effectiveProof.label}
            <span className="text-red-500">*</span>
          </p>
          <ProofUploadPanel
            proofConfig={effectiveProof}
            files={proofFiles}
            previews={proofPreviews}
            onAdd={addFiles}
            onRemove={removeFile}
          />
        </div>
      )}

      {!effectiveProof && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">No proof required for this step.</p>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{submitError}</p>
        </div>
      )}

      {proofFiles.length > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700 font-medium">
            {proofFiles.length} proof file{proofFiles.length > 1 ? 's' : ''} ready
          </p>
          <div className="flex gap-0.5 ml-auto text-sm">
            {proofFiles.map((f, i) => (
              <span key={i}>{isImage(f) ? '📷' : isVideo(f) ? '🎥' : '📄'}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleConfirm}
          disabled={!canSubmit || busy}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {busy ? 'Submitting…' : 'Confirm & Submit Request'}
        </button>
        <button onClick={onCancel} disabled={busy}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PENDING BANNER
// ─────────────────────────────────────────────────────────────
export const PendingBanner = ({ pending, currentUserId, isManager, onWithdraw, onApprove, onReject, busy }) => {
  const [showReject, setShowReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const isOwn      = pending.requestedById === currentUserId
  const stepLabel  = pending.stepLabel || pending.toStep
  const submitter  = pending.requestedByName || 'Unknown'
  const submittedAt = pending.createdAt
    ? new Date(pending.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : ''

  if (showReject) {
    return (
      <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200">
        <p className="text-sm font-semibold text-red-800">Rejection reason:</p>
        <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
          placeholder="Required…" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none" />
        <div className="flex gap-2">
          <button onClick={() => onReject(pending.id, rejectNote)} disabled={!rejectNote.trim() || busy}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Confirm Reject'}
          </button>
          <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Back</button>
        </div>
      </div>
    )
  }

  const healthWarning = pending.healthStatus && pending.healthStatus !== 'ok'
  const healthOpt     = HEALTH_OPTIONS.find(o => o.value === pending.healthStatus)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            ⏳ <span className="font-bold">{stepLabel}</span> request pending
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Submitted by <span className="font-semibold">{isOwn ? 'you' : submitter}</span>
            {submittedAt && <span className="text-amber-500"> · {submittedAt}</span>}
          </p>
        </div>
      </div>

      {healthWarning && (
        <div className={`mx-3 mt-2 px-3 py-2 rounded-lg border text-xs font-medium flex items-start gap-2 ${healthOpt?.cls || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Health: {healthOpt?.label}</span>
            {pending.healthNote && <p className="mt-0.5 font-normal opacity-90">{pending.healthNote}</p>}
          </div>
        </div>
      )}

      <div className="px-3 pb-3 pt-1">
        {isManager ? (
          <div className="flex gap-2">
            <button onClick={() => onApprove(pending.id)} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Approve'}
            </button>
            <button onClick={() => setShowReject(true)} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200">
              <X className="w-4 h-4" />Reject
            </button>
          </div>
        ) : isOwn ? (
          <button onClick={() => onWithdraw(pending.id)} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-100 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" />{busy ? 'Withdrawing…' : 'Withdraw Request'}
          </button>
        ) : (
          <p className="text-xs text-amber-600 text-center py-1">
            🔒 Only <span className="font-semibold">{submitter}</span> or a manager can withdraw this request.
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SET ACTION BUTTON — full lifecycle for a set
// ─────────────────────────────────────────────────────────────
const buttonPulseStyles = `
  @keyframes button-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(239,68,68,0); }
    50%       { transform: scale(1.02); box-shadow: 0 0 15px rgba(239,68,68,0.4); }
  }
  .animate-button-pulse { animation: button-pulse 1.5s ease-in-out infinite; }
`

const SetActionButton = ({ device, currentUserId, isManager, onAction }) => {
  const {
    submitSetLifecycleStep, getSetPendingRequest,
    withdrawLifecycleRequest, approveLifecycleRequest,
    rejectLifecycleRequest,
  } = useInventory()

  const onActionRef = useRef(onAction)
  useEffect(() => { onActionRef.current = onAction }, [onAction])

  const [pending,         setPending]         = useState(undefined)
  const [busy,            setBusy]            = useState(false)
  const [runError,        setRunError]        = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [note,            setNote]            = useState('')
  const [showNote,        setShowNote]        = useState(false)
  const [healthStep,      setHealthStep]      = useState(null)
  const [showHealthModal, setShowHealthModal] = useState(false)
  // showReturnModal: opens LifecycleActionModal pre-set to 'returned'
  const [showReturnModal, setShowReturnModal] = useState(false)

  const status = device.lifecycleStatus

  const askHealth = (toStep, stepLabel, extraNote = null) =>
    setHealthStep({ toStep, stepLabel, extraNote })

  const confirmHealth = (health, healthNote, proofFiles = []) => {
    if (!healthStep) return
    const { toStep, extraNote } = healthStep
    setHealthStep(null)
    run(() => submitSetLifecycleStep(device.id, toStep, extraNote, health, healthNote, proofFiles))
  }

  // Fetch pending on mount / status change
  useEffect(() => {
    let cancelled = false
    setPending(undefined)
    getSetPendingRequest(device.id)
      .then(r => { if (!cancelled) setPending(r ?? null) })
      .catch(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [device.id, device.lifecycleStatus, getSetPendingRequest])

  // Poll every 5s while pending exists
  useEffect(() => {
    if (!pending) return
    const interval = setInterval(async () => {
      try {
        const fresh = await getSetPendingRequest(device.id)
        if (fresh && fresh.status === 'pending') return
        if (onActionRef.current) await onActionRef.current()
        try {
          const latest = await getSetPendingRequest(device.id)
          setPending(latest ?? null)
        } catch { setPending(null) }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [pending, device.id, getSetPendingRequest])

  const run = async (fn) => {
    setBusy(true)
    setRunError(null)
    try {
      const result = await fn()
      if (result && result.status === 'pending') {
        setPending(result)
      } else {
        if (onActionRef.current) await onActionRef.current()
        try {
          const fresh = await getSetPendingRequest(device.id)
          setPending(fresh ?? null)
        } catch { setPending(null) }
      }
    } catch (e) {
      setRunError(e.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = (requestId) => run(() => withdrawLifecycleRequest(requestId))
  const handleApprove  = (requestId) => run(() => approveLifecycleRequest(requestId))
  const handleReject   = (requestId, rejNote) => run(() => rejectLifecycleRequest(requestId, rejNote))

  const isLost = device.healthStatus === 'lost'

  const healthReportBtn = isLost ? (
    <LostHealthBanner />
  ) : (
    <button
      onClick={() => setShowHealthModal(true)}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-sm font-semibold hover:bg-cyan-100 transition-colors"
    >
      🩺 Report Health Status
    </button>
  )

  const healthModal = showHealthModal && (
    <HealthUpdateModal
      device={device}
      isManager={isManager}
      onClose={() => setShowHealthModal(false)}
      onDone={() => { setShowHealthModal(false); onAction && onAction() }}
    />
  )

  // ── Health confirm in progress ──
  if (healthStep) {
    return (
      <>
        <HealthConfirm
          currentHealth={device.healthStatus}
          stepLabel={healthStep.stepLabel}
          toStep={healthStep.toStep}
          onConfirm={confirmHealth}
          onCancel={() => setHealthStep(null)}
          busy={busy}
        />
        {healthModal}
      </>
    )
  }

  // ── Loading ──
  if (pending === undefined) {
    return (
      <>
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Loading status…
        </div>
        {healthModal}
      </>
    )
  }

  // ── Pending request exists ──
  if (pending) {
    return (
      <>
        <PendingBanner
          pending={pending}
          currentUserId={currentUserId}
          isManager={isManager}
          onWithdraw={handleWithdraw}
          onApprove={handleApprove}
          onReject={handleReject}
          busy={busy}
        />
        {healthReportBtn}
        {healthModal}
      </>
    )
  }

  // ── Error banner ──
  const errorBanner = runError ? (
    <div className="flex items-start gap-2 p-2.5 mb-2 bg-red-50 border border-red-200 rounded-xl">
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 flex-1">{runError}</p>
      <button onClick={() => setRunError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null

  // ── Proof pill ──
  const proofPill = (
    <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
      <Paperclip className="w-2.5 h-2.5" />Proof
    </span>
  )

  // ── Action by status ──
  const getAction = () => {
    if (status === 'available' || status === 'warehouse' || status === 'returned') {
      return (
        <>
          {errorBanner}
          <button onClick={() => setShowAssignModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700">
            <ArrowRight className="w-4 h-4" />Assign Set to Client
          </button>
          {showAssignModal && (
            <AssignToClientModal
              device={device}
              onClose={() => setShowAssignModal(false)}
              onSuccess={() => { setShowAssignModal(false); onAction && onAction() }}
            />
          )}
        </>
      )
    }

    if (status === 'assigning' || status === 'assign_requested' || status === 'assigned') {
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1 text-blue-600" />
            Set assigned to <strong>{device.client?.name || 'client'}</strong>. Mark as ready to deploy when packed.
          </div>
          <button onClick={() => askHealth('ready_to_deploy', 'Ready to Deploy')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700">
            <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Ready to Deploy'}{proofPill}
          </button>
        </div>
      )
    }

    if (status === 'ready_to_deploy' || status === 'deploy_requested') {
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1 text-teal-600" />
            Set ready to deploy. Mark as In Transit once it leaves warehouse.
          </div>
          <button onClick={() => askHealth('in_transit', 'In Transit')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600">
            <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark In Transit'}{proofPill}
          </button>
        </div>
      )
    }

    if (status === 'in_transit') {
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Truck className="w-4 h-4 inline mr-1" />Set is in transit. Confirm receipt at client site.
          </div>
          <button onClick={() => askHealth('received', 'Received at Site')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700">
            <Package className="w-4 h-4" />{busy ? 'Submitting…' : 'Confirm Received at Site'}{proofPill}
          </button>
        </div>
      )
    }

    if (status === 'received') {
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
            <Package className="w-4 h-4 inline mr-1" />Set received at site. Mark as installed once setup is complete.
          </div>
          <button onClick={() => askHealth('installed', 'Installed')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Installed'}{proofPill}
          </button>
        </div>
      )
    }

    if (status === 'installed') {
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />Set is installed. Mark as Active once running.
          </div>
          <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Active / Live'}{proofPill}
          </button>
        </div>
      )
    }

    if (status === 'active' || status === 'deployed') {
      if (showNote) {
        return (
          <div className="space-y-2 p-3 bg-rose-50 rounded-xl border border-rose-200">
            <p className="text-sm font-semibold text-rose-800">Return reason:</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Reason for return…" className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={() => { setShowNote(false); askHealth('return_initiated', 'Return Initiated', note) }}
                disabled={!note.trim() || busy}
                className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                Next: Confirm Health
              </button>
              <button onClick={() => setShowNote(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )
      }
      return (
        <>
          {errorBanner}
          <div className="flex gap-2">
            <button onClick={() => askHealth('under_maintenance', 'Under Maintenance')} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold hover:bg-orange-200">
              <AlertTriangle className="w-4 h-4" />{busy ? '…' : 'Under Maintenance'}{proofPill}
            </button>
            <button onClick={() => setShowNote(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold hover:bg-rose-200 animate-button-pulse">
              <RotateCcw className="w-4 h-4" />Request Return
            </button>
          </div>
        </>
      )
    }

    if (status === 'under_maintenance') {
      if (showNote) {
        return (
          <div className="space-y-2 p-3 bg-rose-50 rounded-xl border border-rose-200">
            <p className="text-sm font-semibold text-rose-800">Return reason:</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Reason for return…" className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={() => { setShowNote(false); askHealth('return_initiated', 'Return Initiated', note) }}
                disabled={!note.trim() || busy}
                className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                Next: Confirm Health
              </button>
              <button onClick={() => setShowNote(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )
      }
      return (
        <div className="space-y-2">
          {errorBanner}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">🛠 Set is under maintenance.</div>
          <div className="flex gap-2">
            <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Mark Active Again'}{proofPill}
            </button>
            <button onClick={() => setShowNote(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold hover:bg-rose-200">
              <RotateCcw className="w-4 h-4" />Request Return
            </button>
          </div>
        </div>
      )
    }

    if (status === 'return_initiated' || status === 'return_requested') {
      return (
        <>
          {errorBanner}
          <button onClick={() => askHealth('return_transit', 'Return In Transit')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-semibold text-sm hover:bg-pink-700 disabled:opacity-50">
            <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Set Picked Up — Now In Transit'}{proofPill}
          </button>
        </>
      )
    }

    if (status === 'return_transit') {
      return (
        <>
          {errorBanner}
          <button onClick={() => setShowReturnModal(true)} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-600 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 disabled:opacity-50">
            <Package className="w-4 h-4" />
            {busy ? 'Submitting…' : 'Confirm Set Received at Warehouse'}
            <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Paperclip className="w-2.5 h-2.5" />Proof + Location
            </span>
          </button>
          {showReturnModal && (
            <LifecycleActionModal
              device={device}
              forceStep="returned"
              onClose={() => setShowReturnModal(false)}
              onSuccess={() => {
                setShowReturnModal(false)
                onAction && onAction()
              }}
            />
          )}
        </>
      )
    }

    if (status === 'returned') {
      return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 text-center">
          ✅ Set returned to warehouse. Ready for re-assignment.
        </div>
      )
    }

    if (status === 'lost') {
      return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
          ❌ Set marked as lost.
        </div>
      )
    }

    return null
  }

  return (
    <>
      <style>{buttonPulseStyles}</style>
      <div className="space-y-2">
        {getAction()}
        {healthReportBtn}
        {healthModal}
      </div>
    </>
  )
}

export default SetActionButton