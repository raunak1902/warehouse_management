/**
 * src/api/lifecycleRequestApi.js
 * ───────────────────────────────
 * All API calls for the unified lifecycle request system.
 */
const API_URL = import.meta.env.VITE_API_URL || ''

const BASE = `${API_URL}/api/lifecycle-requests`
const NOTIF_BASE = `${API_URL}/api/notifications`


const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const authJsonHeaders = () => ({
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
  getAll: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
    )
    return fetch(`${BASE}?${params}`, { headers: authJsonHeaders() }).then(handle)
  },

  getSummary: () =>
    fetch(`${BASE}/summary`, { headers: authJsonHeaders() }).then(handle),

  getDeviceHistory: (deviceId) =>
    fetch(`${BASE}/device/${deviceId}/history`, { headers: authJsonHeaders() }).then(handle),

  getSetHistory: (setId) =>
    fetch(`${BASE}/set/${setId}/history`, { headers: authJsonHeaders() }).then(handle),

  /**
   * Submit a new lifecycle request WITH optional proof files.
   * Sends as multipart/form-data so files are attached.
   * @param {object} body   — { toStep, healthStatus, healthNote?, note?, deviceId|setId }
   * @param {File[]} files  — array of File objects (images / PDFs / videos), max 3
   */
  create: (body, files = []) => {
    const fd = new FormData()
    Object.entries(body).forEach(([key, val]) => {
      if (val !== undefined && val !== null) fd.append(key, val)
    })
    files.forEach((file) => fd.append('proofFiles', file))
    return fetch(BASE, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    }).then(handle)
  },

  approve: (id) =>
    fetch(`${BASE}/${id}/approve`, {
      method: 'PATCH',
      headers: authJsonHeaders(),
    }).then(handle),

  reject: (id, rejectionNote) =>
    fetch(`${BASE}/${id}/reject`, {
      method: 'PATCH',
      headers: authJsonHeaders(),
      body: JSON.stringify({ rejectionNote }),
    }).then(handle),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationApi = {
  getAll: () =>
    fetch(NOTIF_BASE, { headers: authJsonHeaders() }).then(handle),

  getUnreadCount: () =>
    fetch(`${NOTIF_BASE}/unread-count`, { headers: authJsonHeaders() }).then(handle),

  markRead: (id) =>
    fetch(`${NOTIF_BASE}/${id}/read`, {
      method: 'PATCH',
      headers: authJsonHeaders(),
    }).then(handle),

  markAllRead: () =>
    fetch(`${NOTIF_BASE}/read-all`, {
      method: 'PATCH',
      headers: authJsonHeaders(),
    }).then(handle),
}

// ── Lifecycle step metadata ────────────────────────────────────────────────────

export const STEP_META = {
  assigning:         { label: 'Assigning to Client',   emoji: '🔗', color: 'blue',   bgClass: 'bg-blue-100',   textClass: 'text-blue-800',   borderClass: 'border-blue-200'   },
  ready_to_deploy:   { label: 'Ready to Deploy',       emoji: '✅', color: 'teal',   bgClass: 'bg-teal-100',   textClass: 'text-teal-800',   borderClass: 'border-teal-200'   },
  in_transit:        { label: 'In Transit',            emoji: '🚚', color: 'amber',  bgClass: 'bg-amber-100',  textClass: 'text-amber-800',  borderClass: 'border-amber-200'  },
  received:          { label: 'Received at Site',      emoji: '📦', color: 'purple', bgClass: 'bg-purple-100', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
  installed:         { label: 'Installed',             emoji: '🔧', color: 'indigo', bgClass: 'bg-indigo-100', textClass: 'text-indigo-800', borderClass: 'border-indigo-200' },
  active:            { label: 'Active / Live',         emoji: '🟢', color: 'green',  bgClass: 'bg-green-100',  textClass: 'text-green-800',  borderClass: 'border-green-200'  },
  under_maintenance: { label: 'Under Maintenance',     emoji: '🛠', color: 'orange', bgClass: 'bg-orange-100', textClass: 'text-orange-800', borderClass: 'border-orange-200' },
  return_initiated:  { label: 'Return Initiated',      emoji: '↩️', color: 'rose',   bgClass: 'bg-rose-100',   textClass: 'text-rose-800',   borderClass: 'border-rose-200'   },
  return_transit:    { label: 'Return In Transit',     emoji: '🚛', color: 'pink',   bgClass: 'bg-pink-100',   textClass: 'text-pink-800',   borderClass: 'border-pink-200'   },
  returned:          { label: 'Returned to Warehouse', emoji: '🏭', color: 'slate',  bgClass: 'bg-slate-100',  textClass: 'text-slate-800',  borderClass: 'border-slate-200'  },
  lost:              { label: 'Lost',                  emoji: '❌', color: 'red',    bgClass: 'bg-red-100',    textClass: 'text-red-800',    borderClass: 'border-red-200'    },
  health_update:     { label: 'Health Status Update',  emoji: '🩺', color: 'cyan',   bgClass: 'bg-cyan-100',   textClass: 'text-cyan-800',   borderClass: 'border-cyan-200'   },
}

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

// ── Canonical health option values used across the entire app ─────────────────
// IMPORTANT: Always use these exact values. Never use 'damaged' — use 'damage'.
// 'lost' is a terminal state — once set, no further health updates are allowed.
export const HEALTH_OPTIONS = [
  { value: 'ok',     label: 'Good Condition', sub: 'Working perfectly',              dot: 'bg-emerald-500', cls: 'border-emerald-300 bg-emerald-50  text-emerald-800' },
  { value: 'repair', label: 'Needs Repair',   sub: 'Requires maintenance',           dot: 'bg-amber-400',   cls: 'border-amber-300  bg-amber-50    text-amber-800'   },
  { value: 'damage', label: 'Damaged',        sub: 'Physical or functional damage',  dot: 'bg-red-500',     cls: 'border-red-300    bg-red-50      text-red-800'     },
  { value: 'lost',   label: 'Lost',           sub: 'Cannot be located — terminal',   dot: 'bg-gray-500',    cls: 'border-gray-300   bg-gray-100    text-gray-700'    },
]

// Returns true if proof + note are required for the given health transition.
// Rule: proof is needed for repair/damage/lost, AND when returning to 'ok'
// from a previously damaged/repair state (clearance proof).
export const healthNeedsProof = (toHealth, fromHealth) => {
  if (['repair', 'damage', 'lost'].includes(toHealth)) return true
  if (toHealth === 'ok' && ['repair', 'damage'].includes(fromHealth)) return true
  return false
}

// ── Proof upload config per step ──────────────────────────────────────────────

export const PROOF_CONFIG = {
  assigning: null,

  ready_to_deploy: {
    required:   true,
    accept:     'image/*,video/*',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   false,
    label:      'Deployment Readiness Proof',
    hint:       '📸 Attach a photo or short video of the device packaged and ready to dispatch.',
  },

  in_transit: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    undefined,
    allowVideo: true,
    allowPdf:   true,
    label:      'Transit Confirmation',
    hint:       '🚚 Attach a courier receipt, dispatch slip, photo, or short video confirming the shipment.',
  },

  received: {
    required:   true,
    accept:     'image/*,video/*',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   false,
    label:      'Site Receipt Proof',
    hint:       '📦 Attach a photo or video of the device received at the site.',
  },

  installed: {
    required:   true,
    accept:     'image/*,video/*',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   false,
    label:      'Installation Proof',
    hint:       '🔧 Attach a photo or video of the device physically mounted and installed.',
  },

  active: {
    required:   true,
    accept:     'image/*,video/*',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   false,
    label:      'Live Confirmation',
    hint:       '🟢 Attach a photo or screen recording showing the device is live and displaying content.',
  },

  under_maintenance: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   true,
    label:      'Maintenance / Damage Evidence',
    hint:       '🛠 Attach photos, a video of the issue, or a repair invoice (PDF).',
  },

  return_initiated: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   true,
    label:      'Return Initiation Proof',
    hint:       '↩️ Attach a photo or video of the device before pickup, or a return authorisation document.',
  },

  return_transit: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    undefined,
    allowVideo: true,
    allowPdf:   true,
    label:      'Return Transit Confirmation',
    hint:       '🚛 Attach a courier receipt, return slip, photo, or short video confirming the device is en route back.',
  },

  returned: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    'environment',
    allowVideo: true,
    allowPdf:   true,
    label:      'Warehouse Receipt Proof',
    hint:       '🏭 Attach a photo, video, or document confirming the device is received at the warehouse.',
  },

  lost: {
    required:   true,
    accept:     'image/*,video/*,application/pdf',
    capture:    undefined,
    allowVideo: true,
    allowPdf:   true,
    label:      'Loss Evidence',
    hint:       '❌ Attach any evidence — last known photo, video, or a written incident report (PDF).',
  },
}

/** @deprecated Use healthNeedsProof(toHealth, fromHealth) instead for full transition-aware logic */
export const HEALTH_REQUIRES_PROOF = ['repair', 'damage', 'lost']

export const MAX_PROOF_FILES  = 3
export const MAX_FILE_SIZE_MB = 50