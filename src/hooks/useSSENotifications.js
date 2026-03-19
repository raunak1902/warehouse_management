/**
 * src/hooks/useSSENotifications.js
 * ──────────────────────────────────
 * Polls /api/inventory-requests/pending-count every 15s to detect new
 * inventory requests. When the count rises, shows a toast notification.
 *
 * Previously used SSE (Server-Sent Events) which broke on Render/Vercel
 * because those platforms kill long-lived HTTP connections and the in-memory
 * sseClients Map is wiped on every redeploy. Polling is simpler and works
 * identically on every hosting platform.
 *
 * Returns the same { toasts, dismissToast } shape so NotificationToast
 * and Layout.jsx need zero changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL } from '../config/api'

const POLL_INTERVAL = 15_000        // check every 15 seconds
const AUTO_DISMISS  = 5 * 60 * 1000 // toast stays for 5 minutes
const MAX_VISIBLE   = 3

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

export function useSSENotifications(enabled) {
  const [toasts, setToasts]  = useState([])
  const prevCountRef         = useRef(null)  // null = not yet initialised
  const nextId               = useRef(0)
  const timerRef             = useRef(null)

  const addToast = useCallback((delta) => {
    const id = ++nextId.current
    const payload = {
      _toastId:        id,
      type:            'inventory_request',
      label:           delta === 1
        ? '1 new inventory request'
        : `${delta} new inventory requests`,
      requestedByName: '',
      createdAt:       new Date().toISOString(),
    }
    setToasts(prev => [payload, ...prev].slice(0, MAX_VISIBLE))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t._toastId !== id))
    }, AUTO_DISMISS)
  }, [])

  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t._toastId !== toastId))
  }, [])

  const poll = useCallback(async () => {
    if (!enabled) return
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await fetch(
        `${API_URL}/api/inventory-requests/pending-count`,
        { headers: authHeaders() }
      )
      if (!res.ok) return
      const { count } = await res.json()

      // First poll — just record baseline, no toast
      if (prevCountRef.current === null) {
        prevCountRef.current = count
        return
      }

      const delta = count - prevCountRef.current
      if (delta > 0) addToast(delta)
      prevCountRef.current = count
    } catch (_) {
      // Network hiccup — ignore, will retry next tick
    }
  }, [enabled, addToast])

  useEffect(() => {
    if (!enabled) return
    poll()  // immediate first check on mount
    timerRef.current = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [enabled, poll])

  return { toasts, dismissToast }
}