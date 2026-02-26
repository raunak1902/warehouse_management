/**
 * src/api/lifecycleRequestApi.js
 * ───────────────────────────────
 * All API calls for the unified lifecycle request system.
 */

const BASE = '/api/lifecycle-requests'
const NOTIF_BASE = '/api/notifications'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const handle = async (res) => {
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`)
  return data
}

// ── Lifecycle Requests ────────────────────────────────────────────────────────

export const lifecycleRequestApi = {
  /** Get all requests (Manager sees all; GroundTeam sees own) */
  getAll: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
    )
    return fetch(`${BASE}?${params}`, { headers: authHeaders() }).then(handle)
  },

  /** Pending counts broken down by user and step */
  getSummary: () =>
    fetch(`${BASE}/summary`, { headers: authHeaders() }).then(handle),

  /** Approved lifecycle history for a single device */
  getDeviceHistory: (deviceId) =>
    fetch(`${BASE}/device/${deviceId}/history`, { headers: authHeaders() }).then(handle),

  /** Approved lifecycle history for a set */
  getSetHistory: (setId) =>
    fetch(`${BASE}/set/${setId}/history`, { headers: authHeaders() }).then(handle),

  /** Submit a new lifecycle request */
  create: (body) =>
    fetch(BASE, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(handle),

  /** Approve a pending request */
  approve: (id) =>
    fetch(`${BASE}/${id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).then(handle),

  /** Reject a pending request */
  reject: (id, rejectionNote) =>
    fetch(`${BASE}/${id}/reject`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ rejectionNote }),
    }).then(handle),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationApi = {
  /** Get all notifications for current user */
  getAll: () =>
    fetch(NOTIF_BASE, { headers: authHeaders() }).then(handle),

  /** Get unread count only (lightweight, for polling) */
  getUnreadCount: () =>
    fetch(`${NOTIF_BASE}/unread-count`, { headers: authHeaders() }).then(handle),

  /** Mark one notification as read */
  markRead: (id) =>
    fetch(`${NOTIF_BASE}/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).then(handle),

  /** Mark all as read */
  markAllRead: () =>
    fetch(`${NOTIF_BASE}/read-all`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).then(handle),
}

// ── Lifecycle step metadata (mirrors backend STEP_META) ───────────────────────

export const STEP_META = {
  assigning:         { label: 'Assigning to Client',   emoji: '🔗', color: 'blue',   bgClass: 'bg-blue-100',   textClass: 'text-blue-800',   borderClass: 'border-blue-200'   },
  ready_to_deploy:   { label: 'Ready to Deploy',       emoji: '✅', color: 'teal',   bgClass: 'bg-teal-100',   textClass: 'text-teal-800',   borderClass: 'border-teal-200'   },
  in_transit:        { label: 'In Transit',            emoji: '🚚', color: 'amber',  bgClass: 'bg-amber-100',  textClass: 'text-amber-800',  borderClass: 'border-amber-200'  },
  received:          { label: 'Received at Site',      emoji: '📦', color: 'purple', bgClass: 'bg-purple-100', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
  installed:         { label: 'Installed',             emoji: '🔧', color: 'indigo', bgClass: 'bg-indigo-100', textClass: 'text-indigo-800', borderClass: 'border-indigo-200' },
  active:            { label: 'Active / Live',         emoji: '🟢', color: 'green',  bgClass: 'bg-green-100',  textClass: 'text-green-800',  borderClass: 'border-green-200'  },
  under_maintenance: { label: 'Under Maintenance',     emoji: '🛠', color: 'orange', bgClass: 'bg-orange-100', textClass: 'text-orange-800', borderClass: 'border-orange-200' },
  return_initiated:  { label: 'Return Initiated',      emoji: '↩️', color: 'rose',   bgClass: 'bg-rose-100',   textClass: 'text-rose-800',   borderClass: 'border-rose-200'   },
  return_transit:    { label: 'Return In Transit',      emoji: '🚛', color: 'pink',   bgClass: 'bg-pink-100',   textClass: 'text-pink-800',   borderClass: 'border-pink-200'   },
  returned:          { label: 'Returned to Warehouse',  emoji: '🏭', color: 'slate',  bgClass: 'bg-slate-100',  textClass: 'text-slate-800',  borderClass: 'border-slate-200'  },
  lost:              { label: 'Lost',                  emoji: '❌', color: 'red',    bgClass: 'bg-red-100',    textClass: 'text-red-800',    borderClass: 'border-red-200'    },
  health_update:     { label: 'Health Status Update',  emoji: '🩺', color: 'cyan',   bgClass: 'bg-cyan-100',   textClass: 'text-cyan-800',   borderClass: 'border-cyan-200'   },
}

/** What steps are valid from the current step? */
export const VALID_NEXT_STEPS = {
  available:         ['assigning'],
  assigning:         ['ready_to_deploy'],
  ready_to_deploy:   ['in_transit'],
  in_transit:        ['received'],
  received:          ['installed'],
  installed:         ['active'],
  active:            ['under_maintenance', 'return_initiated', 'lost'],
  under_maintenance: ['active', 'return_initiated', 'lost'],
  return_initiated:  ['return_transit'],
  return_transit:    ['returned'],
  returned:          ['assigning'],
  lost:              [],
}

export const HEALTH_OPTIONS = [
  { value: 'ok',      label: '✓ Good Condition',  sub: 'Working perfectly' },
  { value: 'repair',  label: '🔧 Needs Repair',   sub: 'Requires maintenance' },
  { value: 'damaged', label: '⚠ Damaged',         sub: 'Physical or functional damage' },
  { value: 'lost',    label: '❌ Lost',            sub: 'Cannot be located' },
]