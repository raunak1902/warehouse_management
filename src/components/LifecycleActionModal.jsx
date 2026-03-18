/**
 * src/components/LifecycleActionModal.jsx
 * ─────────────────────────────────────────
 * Generic modal for requesting any lifecycle step change.
 * Includes mandatory proof upload (photo / video / PDF) for all steps except 'assigning'.
 *
 * Props:
 *   device      — Device or DeviceSet object (must have .id, .code, .lifecycleStatus, ._isSet)
 *   onClose     — callback
 *   onSuccess   — callback(updatedStep)
 *   forceStep   — optional: pre-select a specific step (e.g. 'report_issue')
 */

import { useState, useMemo, useRef, useCallback } from 'react'
import {
  X, Shield, AlertTriangle, Wrench, CheckCircle2, Send, Loader2,
  ChevronRight, Layers, Monitor, Info, ArrowRight, Truck, Package,
  Wrench as WrenchIcon, RotateCcw, Zap, AlertCircle, Upload,
  ImageIcon, FileText, Video, Trash2, Eye, Camera, Film, MapPin,
} from 'lucide-react'
import WarehouseLocationSelector from './WarehouseLocationSelector'
import {
  lifecycleRequestApi, STEP_META, VALID_NEXT_STEPS, HEALTH_OPTIONS,
  PROOF_CONFIG, HEALTH_REQUIRES_PROOF, MAX_PROOF_FILES, MAX_FILE_SIZE_MB,
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

// ── File type helpers ──────────────────────────────────────────────────────────
const isImage = (file) => file.type.startsWith('image/')
const isVideo = (file) => file.type.startsWith('video/')
const isPdf   = (file) => file.type === 'application/pdf'

const FileTypeIcon = ({ file, className = 'w-5 h-5' }) => {
  if (isImage(file)) return <ImageIcon className={`${className} text-blue-500`} />
  if (isVideo(file)) return <Film       className={`${className} text-purple-500`} />
  if (isPdf(file))   return <FileText   className={`${className} text-red-500`} />
  return <FileText className={`${className} text-gray-400`} />
}

const formatBytes = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Single file preview card ──────────────────────────────────────────────────
function FilePreviewCard({ file, preview, onRemove }) {
  return (
    <div className="relative group flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Thumbnail */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {isImage(file) && preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : isVideo(file) && preview ? (
          <video src={preview} className="w-full h-full object-cover" muted />
        ) : (
          <FileTypeIcon file={file} className="w-7 h-7" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{formatBytes(file.size)}</span>
          {isImage(file) && <span className="text-[10px] text-blue-500 font-medium">Image</span>}
          {isVideo(file) && <span className="text-[10px] text-purple-500 font-medium">Video</span>}
          {isPdf(file)   && <span className="text-[10px] text-red-500 font-medium">PDF</span>}
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-300
          hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Proof Upload Section ──────────────────────────────────────────────────────
function ProofUploadSection({ proofConfig, files, previews, onAdd, onRemove, isHealthTriggered }) {
  const inputRef     = useRef(null)
  const remaining    = MAX_PROOF_FILES - files.length
  const isFull       = remaining === 0

  const handleFiles = useCallback((incoming) => {
    const list    = Array.from(incoming)
    const allowed = list.slice(0, remaining)
    const oversized = allowed.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      alert(`Some files exceed the ${MAX_FILE_SIZE_MB} MB limit and were skipped.`)
    }
    const valid = allowed.filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024)
    if (valid.length > 0) onAdd(valid)
  }, [remaining, onAdd])

  const onInputChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  // Drag-and-drop
  const onDrop = useCallback((e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = (e) => e.preventDefault()

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            {isHealthTriggered ? '🩺' : '📎'} {proofConfig.label}
            <span className="text-red-500 text-base leading-none">*</span>
          </p>
          {isHealthTriggered && (
            <p className="text-[10px] text-red-500 font-medium mt-0.5">
              Required because of the health status selected
            </p>
          )}
        </div>
        <span className="text-[10px] text-gray-400 font-medium">
          {files.length}/{MAX_PROOF_FILES} files
        </span>
      </div>

      {/* Context hint */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <span className="text-base leading-none flex-shrink-0 mt-0.5">💡</span>
        <p className="text-xs text-blue-700 leading-relaxed">{proofConfig.hint}</p>
      </div>

      {/* Accepted types pill row */}
      <div className="flex flex-wrap gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
          <Camera className="w-2.5 h-2.5" /> Photos
        </span>
        {proofConfig.allowVideo && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
            <Film className="w-2.5 h-2.5" /> Videos
          </span>
        )}
        {proofConfig.allowPdf && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
            <FileText className="w-2.5 h-2.5" /> PDF
          </span>
        )}
        <span className="text-[10px] text-gray-400 self-center">· Max {MAX_FILE_SIZE_MB} MB each</span>
      </div>

      {/* Existing file previews */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <FilePreviewCard
              key={idx}
              file={file}
              preview={previews[idx]}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>
      )}

      {/* Drop zone / add button */}
      {!isFull && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed
            border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50
            transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
            <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-gray-600 group-hover:text-blue-700">
              {files.length === 0 ? 'Tap to upload or drag files here' : `Add more (${remaining} remaining)`}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {proofConfig.allowVideo && proofConfig.allowPdf
                ? 'Images · Videos · PDFs'
                : proofConfig.allowVideo
                ? 'Images · Videos'
                : 'Images only'}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={proofConfig.accept}
            capture={proofConfig.capture}
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {isFull && (
        <p className="text-center text-xs text-gray-400 py-1">
          Maximum {MAX_PROOF_FILES} files reached. Remove one to add another.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
const LifecycleActionModal = ({ device, onClose, onSuccess, forceStep = null }) => {
  const isSet       = !!device?._isSet
  const role        = normaliseRole(currentUserRole())
  const isManager   = ['manager', 'superadmin'].includes(role)
  const currentStep = device?.lifecycleStatus ?? 'available'

  const availableSteps = useMemo(() => {
    if (forceStep) return [forceStep]
    return VALID_NEXT_STEPS[currentStep] ?? []
  }, [currentStep, forceStep])

  const [selectedStep,   setSelectedStep]   = useState(availableSteps[0] ?? null)
  const [healthStatus,   setHealthStatus]   = useState('ok')
  const [healthNote,     setHealthNote]     = useState('')
  const [note,           setNote]           = useState('')
  const [proofFiles,     setProofFiles]     = useState([])
  const [proofPreviews,  setProofPreviews]  = useState([])
  const [submitting,     setSubmitting]     = useState(false)
  const [submitted,      setSubmitted]      = useState(false)
  const [autoApproved,   setAutoApproved]   = useState(false)
  const [error,          setError]          = useState(null)

  // ── Return-to-warehouse location ─────────────────────────────────────────
  // Pre-filled from the device/set's last known warehouse location
  const [returnWarehouseId,       setReturnWarehouseId]       = useState(device.warehouseId || null)
  const [returnWarehouseZone,     setReturnWarehouseZone]     = useState(device.warehouseZone || '')
  const [returnWarehouseSpecific, setReturnWarehouseSpecific] = useState(device.warehouseSpecificLocation || '')

  const selectedMeta    = selectedStep ? STEP_META[selectedStep] : null
  const needsHealthNote = healthStatus !== 'ok'

  // ── Proof logic ──────────────────────────────────────────────────────────────
  const stepProofConfig      = selectedStep ? PROOF_CONFIG[selectedStep] : null
  const healthTriggerProof   = HEALTH_REQUIRES_PROOF.includes(healthStatus)

  // Effective proof config: use step config, or fabricate one when health triggers it
  const effectiveProofConfig = useMemo(() => {
    if (stepProofConfig) return stepProofConfig
    if (healthTriggerProof) {
      return {
        required:   true,
        accept:     'image/*,video/*,application/pdf',
        capture:    'environment',
        allowVideo: true,
        allowPdf:   true,
        label:      'Health Condition Evidence',
        hint:       '🩺 Proof is required when marking a device as damaged, in need of repair, or lost. Attach a photo, video, or any supporting document.',
      }
    }
    return null
  }, [stepProofConfig, healthTriggerProof])

  const proofRequired = !!effectiveProofConfig?.required
  const proofMissing  = proofRequired && proofFiles.length === 0
  const isReturned    = selectedStep === 'returned'
  const returnWarehouseMissing = isReturned && !returnWarehouseId

  const canSubmit =
    !!selectedStep &&
    (!needsHealthNote || healthNote.trim().length > 0) &&
    !proofMissing &&
    !returnWarehouseMissing

  // ── File management ──────────────────────────────────────────────────────────
  const addFiles = useCallback((incoming) => {
    setProofFiles(prev => {
      const next = [...prev, ...incoming].slice(0, MAX_PROOF_FILES)
      // Generate previews for new ones
      const startIdx = prev.length
      next.slice(startIdx).forEach((file, i) => {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file)
          setProofPreviews(pp => {
            const updated = [...pp]
            updated[startIdx + i] = url
            return updated
          })
        }
      })
      return next
    })
  }, [])

  const removeFile = useCallback((idx) => {
    setProofFiles(prev => prev.filter((_, i) => i !== idx))
    setProofPreviews(prev => {
      const updated = prev.filter((_, i) => i !== idx)
      return updated
    })
  }, [])

  // Reset files when step changes (different proof requirements)
  const handleStepChange = (step) => {
    setSelectedStep(step)
    setProofFiles([])
    setProofPreviews([])
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      // For 'returned' step, encode warehouse location into the note JSON
      let submitNote = note.trim() || undefined
      if (selectedStep === 'returned') {
        const returnMeta = {
          warehouseId:               returnWarehouseId,
          warehouseZone:             returnWarehouseZone   || null,
          warehouseSpecificLocation: returnWarehouseSpecific || null,
        }
        // Merge with any existing note text
        submitNote = JSON.stringify({ ...returnMeta, _note: note.trim() || undefined })
      }

      const body = {
        toStep:       selectedStep,
        healthStatus,
        healthNote:   needsHealthNote ? healthNote.trim() : undefined,
        note:         submitNote,
        ...(isSet ? { setId: device.id } : { deviceId: device.id }),
      }
      const res = await lifecycleRequestApi.create(body, proofFiles)
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

          {proofFiles.length > 0 && (
            <div className="flex items-center justify-center gap-1 mb-3">
              <span className="text-xs text-gray-400">
                {proofFiles.length} proof file{proofFiles.length > 1 ? 's' : ''} attached
              </span>
              {proofFiles.map((f, i) => (
                <span key={i} className="text-xs">
                  {isImage(f) ? '📷' : isVideo(f) ? '🎥' : '📄'}
                </span>
              ))}
            </div>
          )}

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
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 rounded-t-3xl flex-shrink-0">
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
                          onClick={() => handleStepChange(step)}
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

              {/* Single step info */}
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
                      onClick={() => {
                        setHealthStatus(opt.value)
                        if (opt.value === 'ok') setHealthNote('')
                        // Reset proof files if proof config changes
                        setProofFiles([])
                        setProofPreviews([])
                      }}
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

                {/* Mandatory health note */}
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

              {/* ── PROOF UPLOAD ──────────────────────────────────────────── */}
              {effectiveProofConfig && (
                <div className="border-t border-gray-100 pt-5">
                  <ProofUploadSection
                    proofConfig={effectiveProofConfig}
                    files={proofFiles}
                    previews={proofPreviews}
                    onAdd={addFiles}
                    onRemove={removeFile}
                    isHealthTriggered={!stepProofConfig && healthTriggerProof}
                  />
                </div>
              )}

              {/* Proof missing warning (shown only after user tries) */}
              {proofRequired && proofFiles.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700">
                    Proof upload is <strong>mandatory</strong> for this step. Please attach at least one photo, video, or document.
                  </p>
                </div>
              )}

              {/* Warehouse location — mandatory when marking as 'Returned to Warehouse' */}
              {selectedStep === 'returned' && (
                <div className="border-2 border-teal-200 rounded-xl overflow-hidden bg-teal-50/30">
                  <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border-b border-teal-200">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-semibold text-teal-800">
                      Return Warehouse Location <span className="text-red-500">*</span>
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-teal-700 mb-3">
                      {device.warehouseId
                        ? 'Pre-filled with last known location — update if device is going somewhere different.'
                        : 'Device is returning from client — confirm where it will be stored.'}
                    </p>
                    <WarehouseLocationSelector
                      warehouseId={returnWarehouseId}
                      zone={returnWarehouseZone}
                      specificLocation={returnWarehouseSpecific}
                      onWarehouseChange={v => { setReturnWarehouseId(v); setReturnWarehouseZone('') }}
                      onZoneChange={setReturnWarehouseZone}
                      onSpecificLocationChange={setReturnWarehouseSpecific}
                      required={true}
                    />
                    {returnWarehouseMissing && (
                      <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Please select a warehouse to confirm return location.
                      </p>
                    )}
                  </div>
                </div>
              )}

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

        {/* Footer — hide when locked */}
        {availableSteps.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 p-4 space-y-2">
            {/* Proof file count badge */}
            {proofFiles.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  {proofFiles.length} proof file{proofFiles.length > 1 ? 's' : ''} ready to upload
                </p>
                <div className="flex gap-1 ml-auto">
                  {proofFiles.map((f, i) => (
                    <span key={i} className="text-sm">
                      {isImage(f) ? '📷' : isVideo(f) ? '🎥' : '📄'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
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
          </div>
        )}
      </div>
    </div>
  )
}

export default LifecycleActionModal