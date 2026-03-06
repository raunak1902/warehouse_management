import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Download, Printer, Copy, Check, X, MapPin, Activity,
  ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2,
  ArrowRight, RotateCcw, Truck, Package, MoreVertical, Paperclip, Zap,
} from 'lucide-react'
import { useInventory, LIFECYCLE, LIFECYCLE_LABELS, LIFECYCLE_COLORS, HEALTH_COLORS } from '../context/InventoryContext'
import { PROOF_CONFIG, HEALTH_REQUIRES_PROOF, HEALTH_OPTIONS, healthNeedsProof, MAX_PROOF_FILES, MAX_FILE_SIZE_MB } from '../api/lifecycleRequestApi'
import { lifecycleRequestApi } from '../api/lifecycleRequestApi'
import {
  CameraModal, ProofFileCard, ProofUploadPanel,
  isImage, isVideo, isPdf, useProofFiles,
} from './ProofUpload'
import AssignToClientModal from './AssignToClientModal'
import LifecycleTimeline from './LifecycleTimeline'
import HealthUpdateModal, { LostHealthBanner } from './HealthUpdateModal'

// Steps that require proof (for the 📎 badge on buttons)
const STEPS_NEEDING_PROOF = new Set(
  Object.entries(PROOF_CONFIG).filter(([, v]) => v?.required).map(([k]) => k)
)

// Button pulse animation styles for return button
const buttonPulseStyles = `
  @keyframes button-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(239, 68, 68, 0); }
    50% { transform: scale(1.02); box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }
  }
  .animate-button-pulse {
    animation: button-pulse 1.5s ease-in-out infinite;
  }
`

// ─────────────────────────────────────────────────────────────
// LIFECYCLE STATUS BADGE
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = LIFECYCLE_COLORS[status] || LIFECYCLE_COLORS.warehouse
  const label  = LIFECYCLE_LABELS[status]  || status
  const isPending = status?.includes('_requested')
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isPending ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// HEALTH BADGE (inline editable)
// ─────────────────────────────────────────────────────────────
const HealthBadge = ({ current }) => {
  const colors = HEALTH_COLORS[current] || HEALTH_COLORS.ok
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {colors.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// HEALTH OPTIONS — imported from lifecycleRequestApi (canonical)
// ─────────────────────────────────────────────────────────────

const HealthConfirm = ({ currentHealth, stepLabel, toStep, onConfirm, onCancel, busy }) => {
  const [health,       setHealth]       = useState(currentHealth || 'ok')
  const [note,         setNote]         = useState('')
  const [proofFiles,   setProofFiles]   = useState([])
  const [proofPreviews,setProofPreviews]= useState([])
  const [submitError,  setSubmitError]  = useState(null)

  const needsNote   = health !== 'ok'

  // Proof config: step-specific OR health-triggered
  const stepProofCfg    = toStep ? PROOF_CONFIG[toStep] : null
  const healthTrigger   = HEALTH_REQUIRES_PROOF.includes(health)
  const effectiveProof  = useMemo(() => {
    if (stepProofCfg) return stepProofCfg
    if (healthTrigger) return {
      required:   true,
      accept:     'image/*,video/*,application/pdf',
      allowVideo: true,
      allowPdf:   true,
      label:      'Health Condition Evidence',
      hint:       '🩺 Proof is required when marking a device as damaged or in need of repair. Attach a photo or supporting document.',
    }
    return null
  }, [stepProofCfg, healthTrigger])
  const proofRequired = !!effectiveProof?.required
  const proofMissing  = proofRequired && proofFiles.length === 0
  const canSubmit     = (!needsNote || note.trim().length > 0) && !proofMissing

  // Reset proof when health changes (proof config may change)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Confirm health &amp; attach proof</p>
        <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">→ {stepLabel}</span>
      </div>

      {/* Health selector */}
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

      {/* Health note (required if not ok) */}
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

      {/* ── PROOF UPLOAD ─────────────────────────────────────── */}
      {effectiveProof && (
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
            {effectiveProof.label}
            <span className="text-red-500">*</span>
            {!stepProofCfg && healthTrigger && (
              <span className="text-[10px] text-red-500 font-normal ml-1">(required for this health status)</span>
            )}
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

      {/* No-proof hint for steps that don't need it */}
      {!effectiveProof && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">No proof required for this step.</p>
        </div>
      )}

      {/* Inline error (replaces browser alert) */}
      {submitError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{submitError}</p>
        </div>
      )}

      {/* Proof files ready badge */}
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

      {/* Actions */}
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
// PENDING REQUEST BANNER
// Shown when there is already a pending request for this device.
// Ground team sees: submitter info + Withdraw (own) or locked (others)
// Manager sees: submitter info + health warning + Approve / Reject
// ─────────────────────────────────────────────────────────────
const PendingBanner = ({ pending, currentUserId, isManager, onWithdraw, onApprove, onReject, busy }) => {
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

  // Health warning for manager
  const healthWarning = pending.healthStatus && pending.healthStatus !== 'ok'
  const healthOpt     = HEALTH_OPTIONS.find(o => o.value === pending.healthStatus)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
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

      {/* Health warning — shown to everyone if health is not ok */}
      {healthWarning && (
        <div className={`mx-3 mt-2 px-3 py-2 rounded-lg border text-xs font-medium flex items-start gap-2 ${healthOpt?.cls || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Health: {healthOpt?.label}</span>
            {pending.healthNote && <p className="mt-0.5 font-normal opacity-90">{pending.healthNote}</p>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pb-3 pt-1">
        {isManager ? (
          // Manager: approve or reject
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
          // Ground team — own request: can withdraw
          <button onClick={() => onWithdraw(pending.id)} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-100 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" />{busy ? 'Withdrawing…' : 'Withdraw Request'}
          </button>
        ) : (
          // Ground team — someone else's request: read-only
          <p className="text-xs text-amber-600 text-center py-1">
            🔒 Only <span className="font-semibold">{submitter}</span> or a manager can withdraw this request.
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CONTEXT-AWARE ACTION BUTTON
// On mount, fetches the pending request (if any) for this device.
// Re-fetches after every action so state is always fresh.
// ─────────────────────────────────────────────────────────────
const ActionButton = ({ device, currentUserId, isManager, onAction }) => {
  const { submitLifecycleStep, getPendingRequest,
          withdrawLifecycleRequest, approveLifecycleRequest,
          rejectLifecycleRequest, clients } = useInventory()

  const [pending, setPending]             = useState(undefined)
  const [busy, setBusy]                   = useState(false)
  const [runError, setRunError]           = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [note, setNote]                   = useState('')
  const [showNote, setShowNote]           = useState(false)
  // healthStep: null = not showing, otherwise { toStep, label, extraNote }
  const [healthStep, setHealthStep]       = useState(null)
  const [showHealthModal, setShowHealthModal] = useState(false)
  // Keep onAction in a ref so the polling interval always calls the latest version
  // without needing it as a useEffect dependency (which would cause spurious re-fires).
  const onActionRef = useRef(onAction)
  useEffect(() => { onActionRef.current = onAction }, [onAction])

  const status = device.lifecycleStatus

  // Ask for health confirmation before submitting any step
  const askHealth = (toStep, stepLabel, extraNote = null) => {
    setHealthStep({ toStep, stepLabel, extraNote })
  }

  const confirmHealth = (health, healthNote, proofFiles = []) => {
    if (!healthStep) return
    const { toStep, extraNote } = healthStep
    setHealthStep(null)
    run(() => submitLifecycleStep(device.id, toStep, extraNote, health, healthNote, proofFiles))
  }

  // Fetch pending request on mount and whenever device changes
  useEffect(() => {
    let cancelled = false
    setPending(undefined)
    getPendingRequest(device.id)
      .then(r => { if (!cancelled) setPending(r ?? null) })
      .catch(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [device.id, device.lifecycleStatus, getPendingRequest])

  // Poll every 5 seconds while a pending request exists so that when a manager
  // approves/rejects externally (e.g. from the Requests page), the barcode card
  // updates automatically without needing a manual refresh.
  useEffect(() => {
    // Only poll when there is an active pending request
    if (!pending) return

    const interval = setInterval(async () => {
      try {
        const fresh = await getPendingRequest(device.id)
        if (fresh && fresh.status === 'pending') {
          // Still pending — keep showing banner (no change needed)
          return
        }
        // Request was approved or rejected externally — re-fetch the device
        // so lifecycleStatus updates and the correct next step button shows.
        if (onActionRef.current) await onActionRef.current()
        try {
          const latest = await getPendingRequest(device.id)
          setPending(latest ?? null)
        } catch {
          setPending(null)
        }
      } catch {
        // silently ignore poll errors
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pending, device.id, getPendingRequest])

  const run = async (fn) => {
    setBusy(true)
    setRunError(null)
    try {
      const result = await fn()
      if (result && result.status === 'pending') {
        // Ground team submission: show PendingBanner immediately from the
        // returned request — no re-fetch needed.
        setPending(result)
      } else {
        // Approval / withdrawal / rejection:
        // Re-fetch the device first (for approve — status advances),
        // then fetch the actual pending state directly.
        // We do NOT set undefined here because rejection does NOT change
        // lifecycleStatus, so the useEffect watching device.lifecycleStatus
        // would never fire, leaving the component stuck on "Loading status…".
        if (onAction) await onAction()
        try {
          const fresh = await getPendingRequest(device.id)
          setPending(fresh ?? null)
        } catch {
          setPending(null)
        }
      }
    } catch (e) {
      setRunError(e.message || 'Request failed')
      setBusy(false)
    } finally {
      setBusy(false)
    }
  }

  const submit = (toStep, extraNote = null) =>
    run(() => submitLifecycleStep(device.id, toStep, extraNote))

  const handleWithdraw = (requestId) => run(() => withdrawLifecycleRequest(requestId))
  const handleApprove  = (requestId) => run(() => approveLifecycleRequest(requestId))
  const handleReject   = (requestId, rejNote) => run(() => rejectLifecycleRequest(requestId, rejNote))

  // Health modal — rendered as overlay above everything
  const healthModal = showHealthModal && (
    <HealthUpdateModal
      device={device}
      isManager={isManager}
      onClose={() => setShowHealthModal(false)}
      onDone={() => { setShowHealthModal(false); onAction && onAction() }}
    />
  )

  // Health report button — shows locked banner if device is lost, button otherwise
  const isLost = device.healthStatus === 'lost'
  const healthReportBtn = isLost ? (
    <LostHealthBanner />
  ) : (
    <button
      type="button"
      onClick={() => setShowHealthModal(true)}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-sm font-semibold hover:bg-cyan-100 transition-colors"
    >
      🩺 Report Health Status
    </button>
  )

  // If health confirmation is in progress, show it (no health btn — user is mid-flow)
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

  // If there is a pending request — show banner instead of action button
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

  // ── No pending request (confirmed null) — show the appropriate action button ──

  const errorBanner = runError ? (
    <div className="flex items-start gap-2 p-2.5 mb-2 bg-red-50 border border-red-200 rounded-xl">
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-700">{runError}</p>
      </div>
      <button onClick={() => setRunError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null

  // Helper: render the right action for the current lifecycle status
  // Result is wrapped below with the always-visible health report button.
  const getStatusContent = () => {
  // Available / Warehouse → open full 5-step assignment modal
  if (status === 'available' || status === 'warehouse' || status === 'returned') {
    return (
      <>
        {errorBanner}
        <button onClick={() => setShowAssignModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700">
          <ArrowRight className="w-4 h-4" />Request Assignment to Client
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

  // Assigning → ready to deploy
  if (status === 'assigning' || status === 'assign_requested' || status === 'assigned') {
    return (
      <div className="space-y-2">
        {errorBanner}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <CheckCircle2 className="w-4 h-4 inline mr-1 text-blue-600" />
          Assigned to <strong>{device.client?.name || 'client'}</strong>. Mark as ready to deploy when packed.
        </div>
        <button onClick={() => askHealth('ready_to_deploy', 'Ready to Deploy')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700">
          <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Ready to Deploy'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  // Ready to deploy → in transit
  if (status === 'ready_to_deploy' || status === 'deploy_requested') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
          <CheckCircle2 className="w-4 h-4 inline mr-1 text-teal-600" />
          Ready to deploy. Mark as In Transit once device leaves warehouse.
        </div>
        <button onClick={() => askHealth('in_transit', 'In Transit')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600">
          <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark In Transit'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  // In transit → received
  if (status === 'in_transit') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Truck className="w-4 h-4 inline mr-1" />Device is in transit. Confirm receipt at the client site.
        </div>
        <button onClick={() => askHealth('received', 'Received at Site')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700">
          <Package className="w-4 h-4" />{busy ? 'Submitting…' : 'Confirm Received at Site'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  // Received → installed
  if (status === 'received') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <Package className="w-4 h-4 inline mr-1" />Received at site. Mark as installed once setup is complete.
        </div>
        <button onClick={() => askHealth('installed', 'Installed')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700">
          <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Installed'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  // Installed → active
  if (status === 'installed') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
          <CheckCircle2 className="w-4 h-4 inline mr-1" />Device is installed. Mark as Active once running.
        </div>
        <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700">
          <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Active / Live'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  // Active → maintenance or return
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
      <div className="flex gap-2">
        <button onClick={() => askHealth('under_maintenance', 'Under Maintenance')} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold hover:bg-orange-200">
          <AlertTriangle className="w-4 h-4" />{busy ? '…' : 'Under Maintenance'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
        <button onClick={() => setShowNote(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold hover:bg-rose-200 animate-button-pulse">
          <RotateCcw className="w-4 h-4" />Request Return
        </button>
      </div>
    )
  }

  // Under maintenance → active or return
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
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">🛠 Device is under maintenance.</div>
        <div className="flex gap-2">
          <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Mark Active Again'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
          </button>
          <button onClick={() => setShowNote(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold hover:bg-rose-200">
            <RotateCcw className="w-4 h-4" />Request Return
          </button>
        </div>
      </div>
    )
  }

  // Return initiated — pending approval (shown via PendingBanner above, but fallback)
  if (status === 'return_initiated' || status === 'return_requested') {
    return (
      <button onClick={() => askHealth('return_transit', 'Return In Transit')} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-semibold text-sm hover:bg-pink-700 disabled:opacity-50">
        <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Device Picked Up — Now In Transit'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
      </button>
    )
  }

  // Return in transit → confirm received at warehouse
  if (status === 'return_transit') {
    return (
      <button onClick={() => askHealth('returned', 'Returned to Warehouse')} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-600 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 disabled:opacity-50">
        <Package className="w-4 h-4" />{busy ? 'Submitting…' : 'Confirm Received at Warehouse'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
      </button>
    )
  }

  // Returned
  if (status === 'returned') {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 text-center">
        ✅ Device returned to warehouse. Ready for re-assignment.
      </div>
    )
  }

  // Lost
  if (status === 'lost') {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
        ❌ Device marked as lost.
      </div>
    )
  }

  return null
  } // end getStatusContent

  // Always render: status action + health report button below + modal overlay
  return (
    <div className="space-y-2">
      {getStatusContent()}
      <button
        type="button"
        onClick={() => setShowHealthModal(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-sm font-semibold hover:bg-cyan-100 transition-colors"
      >
        🩺 Report Health Status
      </button>
      {healthModal}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SET ACTION BUTTON
// Identical flow to ActionButton but uses set-specific API calls.
// Does NOT touch the existing ActionButton — completely parallel.
// ─────────────────────────────────────────────────────────────
const SetActionButton = ({ device, currentUserId, isManager, onAction }) => {
  const { submitSetLifecycleStep, getSetPendingRequest,
          withdrawLifecycleRequest, approveLifecycleRequest,
          rejectLifecycleRequest, clients } = useInventory()

  const onActionRef = useRef(onAction)
  useEffect(() => { onActionRef.current = onAction }, [onAction])

  const [pending, setPending]               = useState(undefined)
  const [busy, setBusy]                     = useState(false)
  const [runError, setRunError]             = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [note, setNote]                     = useState('')
  const [showNote, setShowNote]             = useState(false)
  const [healthStep, setHealthStep]         = useState(null)

  const status = device.lifecycleStatus

  const askHealth = (toStep, stepLabel, extraNote = null) =>
    setHealthStep({ toStep, stepLabel, extraNote })

  const confirmHealth = (health, healthNote, proofFiles = []) => {
    if (!healthStep) return
    const { toStep, extraNote } = healthStep
    setHealthStep(null)
    run(() => submitSetLifecycleStep(device.id, toStep, extraNote, health, healthNote, proofFiles))
  }

  useEffect(() => {
    let cancelled = false
    setPending(undefined)
    getSetPendingRequest(device.id)
      .then(r => { if (!cancelled) setPending(r ?? null) })
      .catch(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [device.id, device.lifecycleStatus, getSetPendingRequest])

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
        } catch {
          setPending(null)
        }
      }
    } catch (e) {
      setRunError(e.message || 'Request failed')
      setBusy(false)
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = (requestId) => run(() => withdrawLifecycleRequest(requestId))
  const handleApprove  = (requestId) => run(() => approveLifecycleRequest(requestId))
  const handleReject   = (requestId, rejNote) => run(() => rejectLifecycleRequest(requestId, rejNote))

  if (healthStep) {
    return (
      <HealthConfirm
        currentHealth={device.healthStatus}
        stepLabel={healthStep.stepLabel}
        toStep={healthStep.toStep}
        onConfirm={confirmHealth}
        onCancel={() => setHealthStep(null)}
        busy={busy}
      />
    )
  }

  if (pending === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
        Loading status…
      </div>
    )
  }

  if (pending) {
    return (
      <PendingBanner
        pending={pending}
        currentUserId={currentUserId}
        isManager={isManager}
        onWithdraw={handleWithdraw}
        onApprove={handleApprove}
        onReject={handleReject}
        busy={busy}
      />
    )
  }

  // Available / Warehouse → open full 5-step assignment modal

  const errorBanner = runError ? (
    <div className="flex items-start gap-2 p-2.5 mb-2 bg-red-50 border border-red-200 rounded-xl">
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 flex-1">{runError}</p>
      <button onClick={() => setRunError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null

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
          <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Ready to Deploy'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  if (status === 'ready_to_deploy' || status === 'deploy_requested') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
          <CheckCircle2 className="w-4 h-4 inline mr-1 text-teal-600" />
          Set ready to deploy. Mark as In Transit once it leaves warehouse.
        </div>
        <button onClick={() => askHealth('in_transit', 'In Transit')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600">
          <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark In Transit'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  if (status === 'in_transit') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Truck className="w-4 h-4 inline mr-1" />Set is in transit. Confirm receipt at client site.
        </div>
        <button onClick={() => askHealth('received', 'Received at Site')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700">
          <Package className="w-4 h-4" />{busy ? 'Submitting…' : 'Confirm Received at Site'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  if (status === 'received') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <Package className="w-4 h-4 inline mr-1" />Set received at site. Mark as installed once setup is complete.
        </div>
        <button onClick={() => askHealth('installed', 'Installed')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700">
          <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Installed'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
      </div>
    )
  }

  if (status === 'installed') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
          <CheckCircle2 className="w-4 h-4 inline mr-1" />Set is installed. Mark as Active once running.
        </div>
        <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700">
          <CheckCircle2 className="w-4 h-4" />{busy ? 'Submitting…' : 'Mark Active / Live'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
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
      <div className="flex gap-2">
        <button onClick={() => askHealth('under_maintenance', 'Under Maintenance')} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold hover:bg-orange-200">
          <AlertTriangle className="w-4 h-4" />{busy ? '…' : 'Under Maintenance'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
        </button>
        <button onClick={() => setShowNote(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold hover:bg-rose-200 animate-button-pulse">
          <RotateCcw className="w-4 h-4" />Request Return
        </button>
      </div>
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
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">🛠 Set is under maintenance.</div>
        <div className="flex gap-2">
          <button onClick={() => askHealth('active', 'Active / Live')} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Mark Active Again'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
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
      <button onClick={() => askHealth('return_transit', 'Return In Transit')} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-semibold text-sm hover:bg-pink-700 disabled:opacity-50">
        <Truck className="w-4 h-4" />{busy ? 'Submitting…' : 'Set Picked Up — Now In Transit'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
      </button>
    )
  }

  if (status === 'return_transit') {
    return (
      <button onClick={() => askHealth('returned', 'Returned to Warehouse')} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-600 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 disabled:opacity-50">
        <Package className="w-4 h-4" />{busy ? 'Submitting…' : 'Confirm Set Received at Warehouse'} <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />Proof</span>
      </button>
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

// ─────────────────────────────────────────────────────────────
// DEVICE IN SET BANNER

// ─────────────────────────────────────────────────────────────────────────────
// BARCODE HEALTH MODAL
// ─────────────────────────────────────────────────────────────
// DeviceInSetBanner
// Shown when a scanned device belongs to a set.
// No lifecycle actions — only health change request allowed.
// Lost devices show a locked banner instead.
// ─────────────────────────────────────────────────────────────
const DeviceInSetBanner = ({ device, currentUserId, isManager, onAction }) => {
  const { getPendingRequest,
          withdrawLifecycleRequest, approveLifecycleRequest,
          rejectLifecycleRequest } = useInventory()

  const onActionRef = useRef(onAction)
  useEffect(() => { onActionRef.current = onAction }, [onAction])

  const [pending, setPending]         = useState(undefined)
  const [busy, setBusy]               = useState(false)
  const [runError, setRunError]       = useState(null)
  const [showHealthModal, setShowHealthModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPending(undefined)
    getPendingRequest(device.id)
      .then(r => { if (!cancelled) setPending(r ?? null) })
      .catch(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [device.id, device.healthStatus, getPendingRequest])

  useEffect(() => {
    if (!pending) return
    const interval = setInterval(async () => {
      try {
        const fresh = await getPendingRequest(device.id)
        if (fresh && fresh.status === 'pending') return
        if (onActionRef.current) await onActionRef.current()
        try {
          const latest = await getPendingRequest(device.id)
          setPending(latest ?? null)
        } catch { setPending(null) }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [pending, device.id, getPendingRequest])

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
          const fresh = await getPendingRequest(device.id)
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

  return (
    <div className="space-y-3">
      {/* Set info banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
        <p className="font-semibold text-blue-900 mb-0.5">Part of a Device Set</p>
        <p className="text-blue-700 text-xs">This device is part of a set. Lifecycle is managed through the set.</p>
      </div>

      {/* Inline error */}
      {runError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 flex-1">{runError}</p>
          <button onClick={() => setRunError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lost terminal banner OR pending/health-change button */}
      {isLost ? (
        <LostHealthBanner />
      ) : pending === undefined ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Loading…
        </div>
      ) : pending ? (
        <PendingBanner
          pending={pending}
          currentUserId={currentUserId}
          isManager={isManager}
          onWithdraw={handleWithdraw}
          onApprove={handleApprove}
          onReject={handleReject}
          busy={busy}
        />
      ) : (
        <button onClick={() => setShowHealthModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-sm font-semibold hover:bg-cyan-100 transition-colors">
          🩺 Request Health Status Change
        </button>
      )}

      {showHealthModal && (
        <HealthUpdateModal
          device={device}
          isManager={isManager}
          onClose={() => setShowHealthModal(false)}
          onDone={() => { setShowHealthModal(false); onAction && onAction() }}
        />
      )}
    </div>
  )
}



// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const BarcodeResultCard = ({ device: initialDevice, onClose, onDeviceUpdated }) => {
  const { scanDevice, refresh: refreshContext } = useInventory()
  const [device, setDevice] = useState(initialDevice)
  const [copied, setCopied] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef(null)

  // Read current user from localStorage (set at login)
  const currentUser  = JSON.parse(localStorage.getItem('user') || '{}')
  const currentUserId = currentUser.id ?? null
  const userRole      = (currentUser.role ?? '').toLowerCase().replace(/[\s_-]/g, '')
  const isManager     = ['manager', 'superadmin'].includes(userRole)

  // Close "more options" dropdown when clicking outside
  useEffect(() => {
    if (!showMore) return
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMore])

  // Re-fetch device from API after any lifecycle action so status reflects immediately.
  // Wrapped in useCallback so its identity stays stable across re-renders — prevents
  // the polling useEffect in ActionButton from re-firing when device state updates.
  const handleActionDone = useCallback(async () => {
    try {
      // Refresh both: the local card (scan fresh device) AND the global context
      // (so Devices page list, counts, progress bars all update immediately)
      const [fresh] = await Promise.all([
        scanDevice(device.barcode),
        refreshContext(),
      ])
      setDevice(fresh)
      onDeviceUpdated && onDeviceUpdated(fresh)
    } catch {
      // silently ignore — stale data is better than a crash
    }
  }, [scanDevice, refreshContext, device.barcode, onDeviceUpdated])

  const handleManualRefresh = async () => {
    try {
      const [fresh] = await Promise.all([
        scanDevice(device.barcode),
        refreshContext(),
      ])
      setDevice(fresh)
      onDeviceUpdated && onDeviceUpdated(fresh)
    } catch {
      // ignore
    }
  }

  // When parent gives us a freshly-scanned device, update local state
  const handleDeviceRefresh = (newDevice) => {
    setDevice(newDevice)
    onDeviceUpdated && onDeviceUpdated(newDevice)
  }

  const barcodeData = JSON.stringify({
    barcode: device.barcode,
    deviceCode: device.code,
    type: device.type,
    brand: device.brand,
    model: device.model,
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(device.barcode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const svg = document.getElementById('barcode-qr')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    canvas.width = 300; canvas.height = 300
    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 300, 300)
      ctx.drawImage(img, 0, 0, 300, 300)
      const a = document.createElement('a')
      a.download = `barcode_${device.code}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const locationStr = [device.state, device.district, device.pinpoint]
    .filter(Boolean).join(' / ') || device.location || 'Not specified'

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">{device._isSet ? 'Set Barcode' : 'Device Barcode'}</h3>
          <div className="flex items-center gap-1">
            <button onClick={handleManualRefresh} title="Refresh status"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* ⋯ More Options */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setShowMore(o => !o)}
                title="More options"
                className={`p-2 rounded-lg transition-colors ${showMore ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMore && (
                <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Barcode Options</p>
                  </div>
                  <button
                    onClick={() => { handleDownload(); setShowMore(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    Download QR
                  </button>
                  <button
                    onClick={() => { window.print(); setShowMore(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-green-500" />
                    Print QR
                  </button>
                </div>
              )}
            </div>

            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* QR Code */}
          <div className="flex justify-center p-5 bg-gray-50 rounded-xl">
            <QRCodeSVG id="barcode-qr" value={barcodeData} size={180} level="H" includeMargin />
          </div>

          {/* Device / Set Identity */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>
                <p className="text-gray-500 text-xs">{device._isSet ? 'Set Code' : 'Device Code'}</p>
                <p className="font-bold text-gray-900">{device.code}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Type</p>
                <p className="font-bold text-gray-900 capitalize">{device.type?.replace(/-/g, ' ')}</p>
              </div>
              {!device._isSet && device.brand && (
                <div>
                  <p className="text-gray-500 text-xs">Brand</p>
                  <p className="font-semibold text-gray-800">{device.brand}</p>
                </div>
              )}
              {!device._isSet && device.model && (
                <div>
                  <p className="text-gray-500 text-xs">Model</p>
                  <p className="font-semibold text-gray-800">{device.model}</p>
                </div>
              )}
              {device._isSet && device.components?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Components</p>
                  <p className="font-semibold text-gray-800">{device.components.length} device{device.components.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-gray-700 flex-1 truncate">{device.barcode}</code>
              <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* STATUS SECTION — always visible */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />STATUS
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={device.lifecycleStatus} />
              {device._isSet
                ? <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${device.healthStatus === 'ok' ? 'bg-emerald-100 text-emerald-700' : device.healthStatus === 'repair' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    ● {device.healthStatus === 'ok' ? 'Healthy' : device.healthStatus === 'repair' ? 'Needs Repair' : 'Damaged'}
                  </span>
                : <HealthBadge current={device.healthStatus} />
              }
            </div>
            {device.client && (
              <p className="text-sm text-gray-600">
                Client: <span className="font-semibold text-gray-900">{device.client.name}</span>
                {device.client.company && <span className="text-gray-400"> · {device.client.company}</span>}
              </p>
            )}
            {device.assignedAt && (
              <p className="text-xs text-gray-400">Assigned: {fmt(device.assignedAt)}</p>
            )}
            {device.deployedAt && (
              <p className="text-xs text-gray-400">Deployed: {fmt(device.deployedAt)}</p>
            )}
            {device.rejectionNote && (
              <div className="flex items-start gap-1.5 p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{device.rejectionNote}</p>
              </div>
            )}
          </div>

          {/* LOCATION SECTION — always visible */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />LOCATION
            </p>
            <p className="text-sm font-semibold text-gray-800">{locationStr}</p>
          </div>

          {/* ACTION BUTTON — device in set, standalone device, or set */}
          {device._isSet ? (
            <SetActionButton
              device={device}
              currentUserId={currentUserId}
              isManager={isManager}
              onAction={handleActionDone}
            />
          ) : device.setId ? (
            <DeviceInSetBanner
              device={device}
              currentUserId={currentUserId}
              isManager={isManager}
              onAction={handleActionDone}
            />
          ) : (
            <ActionButton
              device={device}
              currentUserId={currentUserId}
              isManager={isManager}
              onAction={handleActionDone}
            />
          )}

          {/* History */}
          {/* Unified lifecycle history — same view as Requests page */}
          <LifecycleTimeline
            deviceId={device._isSet ? null : device.id}
            setId={device._isSet ? device.id : null}
          />

        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-qr, #barcode-qr * { visibility: visible; }
          #barcode-qr { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
        }
      `}</style>
      <style>{buttonPulseStyles}</style>
    </div>
  )
}

export default BarcodeResultCard