/**
 * BulkApproveButton.jsx
 * ─────────────────────────────────────
 * Context-aware bulk approve button for Requests page
 * 
 * FEATURES:
 *  • Smart context-aware text based on active tab
 *  • Respects current filters (search, client filter)
 *  • Sequential approval with stagger animation
 *  • Haptic feedback on mobile
 *  • 2-second undo window
 *  • Real-time progress tracking
 *  • Error handling for failed approvals
 *  • Responsive design
 * 
 * USAGE:
 *  <BulkApproveButton 
 *    activeTab="deployments"
 *    pendingRequests={pendingRequests}
 *    hasFilters={!!globalSearch || !!globalFilterClient}
 *    onComplete={refreshAll}
 *  />
 */

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Undo2 } from 'lucide-react'
import { lifecycleRequestApi } from '../api/lifecycleRequestApi'

const BULK_APPROVE_STAGGER_MS = 500 // Delay between each approval
const UNDO_WINDOW_MS = 2000 // 2 second undo window

// Haptic feedback helper
const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(50) // 50ms vibration
  }
}

export default function BulkApproveButton({ 
  activeTab, 
  pendingRequests, 
  hasFilters, 
  onComplete 
}) {
  const [state, setState] = useState('idle') // idle | undo | approving | success | error
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 })
  const [undoCountdown, setUndoCountdown] = useState(2)
  const [phase, setPhase] = useState('enter')
  
  const undoTimerRef = useRef(null)
  const cancelledRef = useRef(false)
  const approvingRef = useRef(false)

  const count = pendingRequests.length

  // Generate context-aware button text
  const getButtonText = () => {
    if (hasFilters) return `Approve Filtered (${count})`
    
    switch (activeTab) {
      case 'all':
        return `Approve All (${count})`
      case 'deployments':
        return `Approve All Deployments (${count})`
      case 'returns':
        return `Approve All Returns (${count})`
      case 'health':
        return `Approve All Health Updates (${count})`
      default:
        return `Approve All (${count})`
    }
  }

  // Entrance animation
  useEffect(() => {
    setPhase('enter')
    const timer = setTimeout(() => setPhase('visible'), 200)
    return () => clearTimeout(timer)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current)
      }
    }
  }, [])

  const handleApproveAll = () => {
    setState('undo')
    setUndoCountdown(2)
    cancelledRef.current = false

    // Countdown timer for undo window
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 0.1) {
          clearInterval(undoTimerRef.current)
          if (!cancelledRef.current) {
            // Start bulk approval
            startBulkApproval()
          }
          return 0
        }
        return prev - 0.1
      })
    }, 100)
  }

  const handleUndo = () => {
    cancelledRef.current = true
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current)
    }
    setState('idle')
    setUndoCountdown(2)
  }

  const startBulkApproval = async () => {
    if (approvingRef.current) return // Prevent double execution
    
    approvingRef.current = true
    setState('approving')
    
    const total = pendingRequests.length
    let current = 0
    let failed = 0
    const errors = []

    // Approve each request sequentially
    for (const request of pendingRequests) {
      setProgress({ current, total, failed })
      
      try {
        await lifecycleRequestApi.approve(request.id)
        triggerHaptic() // Mobile vibration
        current++
        setProgress({ current, total, failed })
      } catch (err) {
        failed++
        errors.push({
          code: request.deviceCode || request.setCode,
          error: err.message || 'Approval failed'
        })
        setProgress({ current, total, failed })
      }
      
      // Wait for stagger delay before next approval
      if (current + failed < total) {
        await new Promise(resolve => setTimeout(resolve, BULK_APPROVE_STAGGER_MS))
      }
    }

    // Show result
    approvingRef.current = false
    
    if (failed === 0) {
      // All successful
      setState('success')
      setTimeout(() => {
        setState('idle')
        setProgress({ current: 0, total: 0, failed: 0 })
        if (onComplete) onComplete()
      }, 2000)
    } else if (failed === total) {
      // All failed
      setState('error')
      setTimeout(() => {
        setState('idle')
        setProgress({ current: 0, total: 0, failed: 0 })
        if (onComplete) onComplete()
      }, 3000)
    } else {
      // Some failed
      setState('error')
      setTimeout(() => {
        setState('idle')
        setProgress({ current: 0, total: 0, failed: 0 })
        if (onComplete) onComplete()
      }, 3000)
    }
  }

  const slideClass =
    phase === 'enter' ? '-translate-y-4 opacity-0' :
    phase === 'exit'  ? '-translate-y-4 opacity-0' :
    'translate-y-0 opacity-100'

  // Don't show if less than 2 pending requests
  if (count < 2) return null

  return (
    <div className={`transform transition-all duration-300 ease-out ${slideClass}`}>
      {state === 'idle' && (
        <button
          onClick={handleApproveAll}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500
            hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg shadow-md
            hover:shadow-lg transition-all duration-200 font-semibold text-sm
            active:scale-95 hover:scale-105 whitespace-nowrap
            max-md:px-3 max-md:py-1.5 max-sm:text-xs"
        >
          <CheckCircle size={16} className="max-sm:w-4 max-sm:h-4" />
          <span>{getButtonText()}</span>
        </button>
      )}

      {state === 'undo' && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500
            hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-md
            hover:shadow-lg transition-all duration-200 font-semibold text-sm
            active:scale-95 whitespace-nowrap
            max-md:px-3 max-md:py-1.5 max-sm:text-xs"
        >
          <Undo2 size={16} className="max-sm:w-4 max-sm:h-4" />
          <span>Undo ({Math.ceil(undoCountdown)}s)</span>
        </button>
      )}

      {state === 'approving' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500
          text-white rounded-lg shadow-md font-semibold text-sm whitespace-nowrap
          max-md:px-3 max-md:py-1.5 max-sm:text-xs">
          <svg className="animate-spin w-4 h-4 max-sm:w-3 max-sm:h-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span>Approving... ({progress.current}/{progress.total})</span>
          {progress.failed > 0 && (
            <span className="text-xs opacity-75">({progress.failed} failed)</span>
          )}
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500
          text-white rounded-lg shadow-md font-semibold text-sm whitespace-nowrap
          max-md:px-3 max-md:py-1.5 max-sm:text-xs">
          <CheckCircle size={16} className="max-sm:w-4 max-sm:h-4" />
          <span>All Approved!</span>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500
          text-white rounded-lg shadow-md font-semibold text-sm whitespace-nowrap
          max-md:px-3 max-md:py-1.5 max-sm:text-xs">
          <XCircle size={16} className="max-sm:w-4 max-sm:h-4" />
          <span>
            {progress.failed === progress.total 
              ? 'All Failed' 
              : `${progress.current} approved, ${progress.failed} failed`}
          </span>
        </div>
      )}
    </div>
  )
}