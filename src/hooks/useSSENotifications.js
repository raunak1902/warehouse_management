/**
 * src/hooks/useSSENotifications.js
 * ──────────────────────────────────
 * Opens a persistent SSE connection to /api/notifications/stream.
 * Receives instant push events when a ground-team request is created.
 *
 * Returns a queue of toast items that the NotificationToast component renders.
 * Max 3 toasts visible at once; older ones are auto-dismissed (8s countdown).
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const STREAM_URL   = '/api/notifications/stream'
const AUTO_DISMISS = 5 * 60 * 1000 // 5 minutes — stays until addressed
const MAX_VISIBLE  = 3      // max toasts stacked on screen
const RETRY_DELAY  = 5000   // ms before reconnecting after disconnect

export function useSSENotifications(enabled) {
  const [toasts, setToasts]   = useState([])
  const esRef                 = useRef(null)
  const retryTimer            = useRef(null)
  const nextId                = useRef(0)

  const addToast = useCallback((payload) => {
    const id = ++nextId.current
    setToasts(prev => {
      const updated = [{ ...payload, _toastId: id }, ...prev].slice(0, MAX_VISIBLE)
      return updated
    })
    // Auto-dismiss after AUTO_DISMISS ms
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t._toastId !== id))
    }, AUTO_DISMISS)
  }, [])

  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t._toastId !== toastId))
  }, [])

  // Connect / reconnect SSE
  const connect = useCallback(() => {
    if (!enabled) return
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const token = localStorage.getItem('token')
    if (!token) return

    // EventSource doesn't support custom headers — pass token as query param
    // The backend auth middleware must accept ?token= as a fallback.
    const es = new EventSource(`${STREAM_URL}?token=${encodeURIComponent(token)}`)
    esRef.current = es

    es.addEventListener('new_request', (e) => {
      try {
        const payload = JSON.parse(e.data)
        addToast(payload)
      } catch (_) {}
    })

    es.addEventListener('connected', () => {
      // Connection confirmed — nothing to do
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      // Retry after delay
      retryTimer.current = setTimeout(connect, RETRY_DELAY)
    }
  }, [enabled, addToast])

  useEffect(() => {
    if (!enabled) return
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
      clearTimeout(retryTimer.current)
    }
  }, [enabled, connect])

  return { toasts, dismissToast }
}