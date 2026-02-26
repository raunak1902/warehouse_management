/**
 * src/hooks/useNotifications.js
 * ──────────────────────────────
 * Polls /api/notifications/unread-count every 30s.
 * Fetches full notifications on demand (when bell is opened).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { notificationApi } from '../api/lifecycleRequestApi'

const POLL_INTERVAL = 30_000 // 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(false)
  const prevCountRef = useRef(0)
  const [hasNew, setHasNew] = useState(false)

  // Poll unread count
  const pollCount = useCallback(async () => {
    try {
      const data = await notificationApi.getUnreadCount()
      const count = data.count ?? 0
      if (count > prevCountRef.current && prevCountRef.current !== 0) {
        setHasNew(true)
        setTimeout(() => setHasNew(false), 2000)
      }
      prevCountRef.current = count
      setUnreadCount(count)
    } catch (_) {}
  }, [])

  // Fetch full list (called when bell is opened)
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationApi.getAll()
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  const markRead = useCallback(async (id) => {
    await notificationApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  // Start polling
  useEffect(() => {
    pollCount()
    const id = setInterval(pollCount, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [pollCount])

  return { notifications, unreadCount, loading, hasNew, fetchAll, markRead, markAllRead }
}