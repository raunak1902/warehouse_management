import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const setApi = {
  // Get all sets
  getAll: async () => {
    const res = await axios.get(`${API_BASE}/sets`, { headers: getAuthHeaders() })
    return res.data
  },

  // Get set by id
  getById: async (id) => {
    const res = await axios.get(`${API_BASE}/sets/${id}`, { headers: getAuthHeaders() })
    return res.data
  },

  // Get set by barcode (for scanning)
  getByBarcode: async (barcode) => {
    const res = await axios.get(`${API_BASE}/sets/barcode/${barcode}`, { headers: getAuthHeaders() })
    return res.data
  },

  // Create a new set
  // setData: { setType, setTypeName, name?, componentDeviceIds[], location? }
  create: async (setData) => {
    const res = await axios.post(`${API_BASE}/sets`, setData, { headers: getAuthHeaders() })
    return res.data
  },

  // Update set lifecycle / health / location
  // updates: { lifecycleStatus?, healthStatus?, location?, clientId?, componentHealthUpdates? }
  update: async (id, updates) => {
    const res = await axios.put(`${API_BASE}/sets/${id}`, updates, { headers: getAuthHeaders() })
    return res.data
  },

  // Disassemble set — returns components to warehouse
  // componentUpdates: [{ deviceId, healthStatus, action: 'return'|'lost' }]
  disassemble: async (id, componentUpdates = []) => {
    const res = await axios.post(`${API_BASE}/sets/${id}/disassemble`, { componentUpdates }, { headers: getAuthHeaders() })
    return res.data
  },

  // Delete set (returns all components to warehouse)
  delete: async (id) => {
    const res = await axios.delete(`${API_BASE}/sets/${id}`, { headers: getAuthHeaders() })
    return res.data
  },
}