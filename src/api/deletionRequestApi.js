/**
 * src/api/deletionRequestApi.js
 * ───────────────────────────────
 * Frontend API client for deferred device/set deletion requests.
 */

import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

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

export const deletionRequestApi = {
  // Get all deletion requests (manager only); optionally filter by status
  getAll: async (status) => {
    const qs = status ? `?status=${status}` : ''
    return (await api.get(`/api/deletion-requests${qs}`)).data
  },

  // Schedule a device deletion — DELETE /api/devices/:id  with { reason }
  scheduleDevice: async (deviceId, reason) =>
    (await api.delete(`/api/devices/${deviceId}`, { data: { reason } })).data,

  // Schedule a set deletion — DELETE /api/sets/:id  with { reason }
  scheduleSet: async (setId, reason) =>
    (await api.delete(`/api/sets/${setId}`, { data: { reason } })).data,

  // Cancel a pending deletion
  cancel: async (deletionRequestId) =>
    (await api.delete(`/api/deletion-requests/${deletionRequestId}`)).data,
}

export default deletionRequestApi