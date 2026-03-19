import axios from 'axios'

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const clientApi = {
  getAll: async ({ archived = false } = {}) =>
    (await axios.get(`${API_BASE}/clients`, {
      headers: getAuthHeaders(),
      params: archived ? { archived: 'true' } : {},
    })).data,

  getById: async (id) =>
    (await axios.get(`${API_BASE}/clients/${id}`, { headers: getAuthHeaders() })).data,

  create: async (data) =>
    (await axios.post(`${API_BASE}/clients`, data, { headers: getAuthHeaders() })).data,

  update: async (id, data) =>
    (await axios.put(`${API_BASE}/clients/${id}`, data, { headers: getAuthHeaders() })).data,

  // Returns 409 with { error, message, assignedItems, counts } if client has active assignments
  delete: async (id) =>
    (await axios.delete(`${API_BASE}/clients/${id}`, { headers: getAuthHeaders() })).data,

  restore: async (id) =>
    (await axios.patch(`${API_BASE}/clients/${id}/restore`, {}, { headers: getAuthHeaders() })).data,

  getHistory: async (id) =>
    (await axios.get(`${API_BASE}/clients/${id}/history`, { headers: getAuthHeaders() })).data,
}

export default clientApi