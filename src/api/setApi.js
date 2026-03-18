import axios from 'axios'

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`

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
  disassemble: async (id, componentUpdates = [], reason = '', componentLocations = []) =>
    (await axios.post(`${API_BASE}/sets/${id}/disassemble`, { componentUpdates, reason, componentLocations }, { headers: getAuthHeaders() })).data,
  updateLocation: async (id, { warehouseId, warehouseZone, warehouseSpecificLocation, notes }) =>
    (await axios.patch(`${API_BASE}/sets/${id}/location`, { warehouseId, warehouseZone, warehouseSpecificLocation, notes }, { headers: getAuthHeaders() })).data,
}

export default setApi