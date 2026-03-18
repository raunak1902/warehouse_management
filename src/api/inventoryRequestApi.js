/**
 * src/api/inventoryRequestApi.js
 * ───────────────────────────────
 * Frontend API client for inventory creation requests.
 * Ground team uses this to raise requests.
 * Manager uses this to approve/reject.
 */

import axios from 'axios'

const api = axios.create({ baseURL: '' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    return Promise.reject(err)
  }
)

export const inventoryRequestApi = {
  // Get all requests (ground team = own, manager = all)
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString()
    return (await api.get(`/api/inventory-requests${params ? '?' + params : ''}`)).data
  },

  // Get single request
  getById: async (id) => (await api.get(`/api/inventory-requests/${id}`)).data,

  // Pending count for manager badge
  getPendingCount: async () => (await api.get('/api/inventory-requests/pending-count')).data,

  // Ground team raises a request to add a single device
  requestAddDevice: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'add_device', ...data })).data,

  // Ground team raises a bulk add request
  requestBulkAdd: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'bulk_add', ...data })).data,

  // Ground team raises a make-set request
  requestMakeSet: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'make_set', ...data })).data,

  // Ground team raises a break-set request (includes component location overrides)
  requestBreakSet: async (targetSetId, note, componentLocations = []) =>
    (await api.post('/api/inventory-requests', {
      requestType: 'break_set',
      targetSetId,
      note,
      // Store component location overrides in proposedChanges so they survive to approval
      ...(componentLocations.length > 0 && { proposedChanges: { componentLocations } }),
    })).data,

  // Manager approves
  approve: async (id) => (await api.post(`/api/inventory-requests/${id}/approve`)).data,

  // Manager rejects with reason
  reject: async (id, rejectionNote) =>
    (await api.post(`/api/inventory-requests/${id}/reject`, { rejectionNote })).data,

  // Ground team raises a request to edit device hardware attributes
  requestEditDevice: async ({ targetDeviceId, targetDeviceCode, proposedChanges, note }) =>
    (await api.post('/api/inventory-requests', {
      requestType: 'edit_device',
      targetDeviceId,
      targetDeviceCode,
      proposedChanges,
      note,
    })).data,
}

export default inventoryRequestApi