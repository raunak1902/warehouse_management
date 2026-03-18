import axios from 'axios'

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const assignmentRequestApi = {
  create: async (data) =>
    (await axios.post(`${API_BASE}/assignment-requests`, data, { headers: getAuthHeaders() })).data,

  getAll: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.clientId) params.set('clientId', filters.clientId)
    return (await axios.get(`${API_BASE}/assignment-requests?${params}`, { headers: getAuthHeaders() })).data
  },

  getForDevice: async (deviceId) =>
    (await axios.get(`${API_BASE}/assignment-requests/device/${deviceId}`, { headers: getAuthHeaders() })).data,

  getForSet: async (setId) =>
    (await axios.get(`${API_BASE}/assignment-requests/set/${setId}`, { headers: getAuthHeaders() })).data,

  approve: async (id) =>
    (await axios.patch(`${API_BASE}/assignment-requests/${id}/approve`, {}, { headers: getAuthHeaders() })).data,

  reject: async (id) =>
    (await axios.patch(`${API_BASE}/assignment-requests/${id}/reject`, {}, { headers: getAuthHeaders() })).data,
}

export default assignmentRequestApi