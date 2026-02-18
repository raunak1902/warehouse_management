import axios from 'axios'

const API_BASE = '/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const setApi = {
  getAll: async () => (await axios.get(`${API_BASE}/sets`, { headers: getAuthHeaders() })).data,
  getById: async (id) => (await axios.get(`${API_BASE}/sets/${id}`, { headers: getAuthHeaders() })).data,
  getByBarcode: async (barcode) => (await axios.get(`${API_BASE}/sets/barcode/${barcode}`, { headers: getAuthHeaders() })).data,
  create: async (setData) => (await axios.post(`${API_BASE}/sets`, setData, { headers: getAuthHeaders() })).data,
  update: async (id, updates) => (await axios.put(`${API_BASE}/sets/${id}`, updates, { headers: getAuthHeaders() })).data,
  disassemble: async (id, componentUpdates = []) => (await axios.post(`${API_BASE}/sets/${id}/disassemble`, { componentUpdates }, { headers: getAuthHeaders() })).data,
  delete: async (id) => (await axios.delete(`${API_BASE}/sets/${id}`, { headers: getAuthHeaders() })).data,
}