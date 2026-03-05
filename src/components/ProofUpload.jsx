/**
 * src/components/ProofUpload.jsx
 * ────────────────────────────────
 * Shared proof upload UI — used in:
 *   - BarcodeResultCard  (inline HealthConfirm card, barcode scan flow)
 *   - NextStepPanel      (inline request panel, Requests page)
 *
 * Exports:
 *   CameraModal       — full-screen live camera with snap/retake/use
 *   ProofFileCard     — single attached-file row with thumbnail + remove
 *   ProofUploadPanel  — full upload section: hint + file list + Camera/Attach buttons
 *   useProofFiles     — hook managing files + previews state + helpers
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera, Paperclip, Trash2, ImageIcon, Film, FileText,
  X, Check, RotateCcw, FlipHorizontal, ZapOff,
} from 'lucide-react'
import { MAX_PROOF_FILES, MAX_FILE_SIZE_MB } from '../api/lifecycleRequestApi'

// ── Type helpers ──────────────────────────────────────────────────────────────
export const isImage = (f) => f?.type?.startsWith('image/')
export const isVideo = (f) => f?.type?.startsWith('video/')
export const isPdf   = (f) => f?.type === 'application/pdf'
export const fmtBytes = (b) =>
  b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`

// ── Hook: manages proof file list + object-URL previews ───────────────────────
export function useProofFiles() {
  const [files,    setFiles]    = useState([])
  const [previews, setPreviews] = useState([])

  const add = useCallback((incoming) => {
    setFiles(prev => {
      const slots  = MAX_PROOF_FILES - prev.length
      const next   = [...prev, ...incoming].slice(0, MAX_PROOF_FILES)
      const newOnes = next.slice(prev.length)
      newOnes.forEach((file, i) => {
        if (isImage(file) || isVideo(file)) {
          const url = URL.createObjectURL(file)
          setPreviews(pp => { const u = [...pp]; u[prev.length + i] = url; return u })
        }
      })
      return next
    })
  }, [])

  const remove = useCallback((idx) => {
    setFiles(p => p.filter((_, i) => i !== idx))
    setPreviews(p => p.filter((_, i) => i !== idx))
  }, [])

  const reset = useCallback(() => {
    setFiles([])
    setPreviews([])
  }, [])

  return { files, previews, add, remove, reset }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA MODAL
// Full-screen live camera with grid overlay, flip, snap → preview → retake/use.
// ─────────────────────────────────────────────────────────────────────────────
export const CameraModal = ({ onCapture, onClose }) => {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [preview,    setPreview]    = useState(null)
  const [camError,   setCamError]   = useState(null)
  const [starting,   setStarting]   = useState(true)

  const startCamera = useCallback(async (facing) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStarting(true)
    setCamError(null)
    setPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      setCamError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : 'Could not start camera. Try using the file picker instead.'
      )
    } finally {
      setStarting(false)
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }

  const snap = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0)
    setPreview(canvas.toDataURL('image/jpeg', 0.9))
    if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = false })
  }

  const retake = () => {
    setPreview(null)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = true })
  }

  const usePhoto = () => {
    if (!preview) return
    const arr  = preview.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8 = new Uint8Array(n)
    while (n--) u8[n] = bstr.charCodeAt(n)
    onCapture(new File([u8], `camera_${Date.now()}.jpg`, { type: mime }))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-3">
        <span className="text-white font-semibold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" /> Take Photo
        </span>
        <button onClick={onClose} className="text-white/70 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="w-full max-w-lg aspect-video bg-black rounded-2xl overflow-hidden relative">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <ZapOff className="w-10 h-10 text-red-400" />
            <p className="text-white/80 text-sm">{camError}</p>
            <button onClick={onClose}
              className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm hover:bg-white/30">
              Use File Picker Instead
            </button>
          </div>
        ) : preview ? (
          <img src={preview} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <>
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* Rule-of-thirds grid */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)',
              backgroundSize: '33.33% 33.33%',
            }} />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 flex items-center justify-between gap-3">
        {preview ? (
          <>
            <button onClick={retake}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30">
              <RotateCcw className="w-4 h-4" /> Retake
            </button>
            <button onClick={usePhoto}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600">
              <Check className="w-4 h-4" /> Use This Photo
            </button>
          </>
        ) : (
          <>
            <button onClick={flipCamera} disabled={starting}
              className="p-3 bg-white/20 text-white rounded-xl hover:bg-white/30 disabled:opacity-40"
              title="Flip camera">
              <FlipHorizontal className="w-5 h-5" />
            </button>
            {/* Shutter button */}
            <button onClick={snap} disabled={starting || !!camError}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40
                disabled:opacity-40 flex items-center justify-center transition-all active:scale-95">
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
            <div className="w-11" />
          </>
        )}
      </div>

      <p className="text-white/40 text-xs mt-3">
        {facingMode === 'environment' ? '🔙 Rear camera' : '🤳 Front camera'}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROOF FILE CARD — single attached-file row
// ─────────────────────────────────────────────────────────────────────────────
export const ProofFileCard = ({ file, preview, onRemove }) => (
  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
    <div className="w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
      {isImage(file) && preview
        ? <img src={preview} alt="" className="w-full h-full object-cover" />
        : isVideo(file) ? <Film    className="w-5 h-5 text-purple-500" />
        : isPdf(file)   ? <FileText className="w-5 h-5 text-red-500" />
        :                  <ImageIcon className="w-5 h-5 text-gray-400" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
      <p className="text-[10px] text-gray-400">{fmtBytes(file.size)}</p>
    </div>
    <button onClick={onRemove}
      className="p-1 hover:bg-red-50 hover:text-red-500 text-gray-300 rounded-md transition-colors flex-shrink-0">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PROOF UPLOAD PANEL
//
// Props:
//   proofConfig  — from PROOF_CONFIG[step] or a fabricated health-trigger config
//   files        — File[]
//   previews     — string[] (object URLs)
//   onAdd        — (File[]) => void
//   onRemove     — (index) => void
//   compact      — bool: if true uses responsive layout (2-col mobile / row desktop)
// ─────────────────────────────────────────────────────────────────────────────
export const ProofUploadPanel = ({ proofConfig, files, previews, onAdd, onRemove, compact = false }) => {
  const fileInputRef = useRef(null)
  const [showCamera, setShowCamera] = useState(false)
  const remaining = MAX_PROOF_FILES - files.length
  const isFull    = remaining === 0

  const handleFilePick = (e) => {
    const incoming  = Array.from(e.target.files || [])
    const allowed   = incoming.slice(0, remaining)
    const oversized = allowed.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    if (oversized.length) alert(`${oversized.length} file(s) exceed ${MAX_FILE_SIZE_MB} MB and were skipped.`)
    const valid = allowed.filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024)
    if (valid.length) onAdd(valid)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const incoming = Array.from(e.dataTransfer.files || [])
    const valid    = incoming.slice(0, remaining).filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024)
    if (valid.length) onAdd(valid)
  }

  return (
    <div className="space-y-2">
      {showCamera && (
        <CameraModal
          onCapture={(file) => { if (files.length < MAX_PROOF_FILES) onAdd([file]) }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Contextual hint */}
      <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm leading-none mt-0.5 flex-shrink-0">💡</span>
        <p className="text-xs text-blue-700 leading-relaxed">{proofConfig.hint}</p>
      </div>

      {/* Attached file list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <ProofFileCard key={i} file={f} preview={previews[i]} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}

      {/* Add buttons — responsive: 2-col on mobile, single row on md+ */}
      {!isFull && (
        <div className={compact
          ? 'grid grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-center gap-2'
          : 'grid grid-cols-2 gap-2'
        }>
          {/* Camera */}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2
              py-3 px-3 border-2 border-dashed border-indigo-300 rounded-xl
              bg-indigo-50/60 hover:border-indigo-500 hover:bg-indigo-50
              transition-all text-indigo-700 group"
          >
            <Camera className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <div className="text-center md:text-left">
              <p className="text-xs font-semibold leading-tight">Open Camera</p>
              <p className="text-[10px] text-indigo-500 hidden md:block">Live preview</p>
            </div>
          </button>

          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2
              py-3 px-3 border-2 border-dashed border-gray-300 rounded-xl
              bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50
              transition-all text-gray-600 group"
          >
            <Paperclip className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <div className="text-center md:text-left">
              <p className="text-xs font-semibold leading-tight">Attach File</p>
              <p className="text-[10px] text-gray-400 hidden md:block">
                {proofConfig.allowPdf ? 'Photo · Video · PDF' : proofConfig.allowVideo ? 'Photo · Video' : 'Photo only'}
              </p>
            </div>
          </button>

          {/* Desktop: accepted types hint on same row */}
          {compact && (
            <p className="hidden md:block text-[10px] text-gray-400 leading-relaxed col-span-1 self-center">
              {proofConfig.allowPdf ? '📷 Photo · 🎥 Video · 📄 PDF' : proofConfig.allowVideo ? '📷 Photo · 🎥 Video' : '📷 Photo only'}
              <br />Max {MAX_FILE_SIZE_MB} MB each
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={proofConfig.accept}
            className="hidden"
            onChange={handleFilePick}
          />
        </div>
      )}

      {/* Footer: count + size limit */}
      <div className="flex items-center justify-between">
        {!compact && <span className="text-[10px] text-gray-400">Max {MAX_FILE_SIZE_MB} MB each</span>}
        {compact    && <span className="text-[10px] text-gray-400 md:hidden">Max {MAX_FILE_SIZE_MB} MB each</span>}
        <span className={`text-[10px] font-semibold ml-auto ${files.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {files.length}/{MAX_PROOF_FILES} attached{files.length > 0 ? ' ✓' : ''}
        </span>
      </div>

      {isFull && (
        <p className="text-center text-xs text-gray-400">
          Max {MAX_PROOF_FILES} files — remove one to add another.
        </p>
      )}
    </div>
  )
}