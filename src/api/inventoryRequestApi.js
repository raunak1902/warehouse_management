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

export const inventoryRequestApi = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString()
    return (await api.get(`/api/inventory-requests${params ? '?' + params : ''}`)).data
  },

  getById: async (id) => (await api.get(`/api/inventory-requests/${id}`)).data,

  getPendingCount: async () => (await api.get('/api/inventory-requests/pending-count')).data,

  requestAddDevice: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'add_device', ...data })).data,

  requestBulkAdd: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'bulk_add', ...data })).data,

  requestMakeSet: async (data) =>
    (await api.post('/api/inventory-requests', { requestType: 'make_set', ...data })).data,

  requestBreakSet: async (targetSetId, note, componentLocations = []) =>
    (await api.post('/api/inventory-requests', {
      requestType: 'break_set',
      targetSetId,
      note,
      ...(componentLocations.length > 0 && { proposedChanges: { componentLocations } }),
    })).data,

  approve: async (id) => (await api.post(`/api/inventory-requests/${id}/approve`)).data,

  reject: async (id, rejectionNote) =>
    (await api.post(`/api/inventory-requests/${id}/reject`, { rejectionNote })).data,

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