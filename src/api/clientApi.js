import axios from 'axios'

const API_BASE = '/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const clientApi = {
  getAll: async () =>
    (await axios.get(`${API_BASE}/clients`, { headers: getAuthHeaders() })).data,

  getById: async (id) =>
    (await axios.get(`${API_BASE}/clients/${id}`, { headers: getAuthHeaders() })).data,

  create: async (data) =>
    (await axios.post(`${API_BASE}/clients`, data, { headers: getAuthHeaders() })).data,

  update: async (id, data) =>
    (await axios.put(`${API_BASE}/clients/${id}`, data, { headers: getAuthHeaders() })).data,

  delete: async (id) =>
    (await axios.delete(`${API_BASE}/clients/${id}`, { headers: getAuthHeaders() })).data,

  getHistory: async (id) =>
    (await axios.get(`${API_BASE}/clients/${id}/history`, { headers: getAuthHeaders() })).data,
}

export default clientApi
