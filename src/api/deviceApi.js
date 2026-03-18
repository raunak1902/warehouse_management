import axios from 'axios';

// Empty base URL - all calls use relative paths, proxied by Vite
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userRole');
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return Promise.reject(error);
  }
);

// ==========================================
// DEVICE API METHODS
// ==========================================

export const deviceApi = {
  getAll: async () => (await api.get('/api/devices')).data,
  getById: async (id) => (await api.get(`/api/devices/${id}`)).data,
  getByCode: async (code) => (await api.get(`/api/devices/code/${code}`)).data,
  getByBarcode: async (barcode) => (await api.get(`/api/devices/barcode/${barcode}`)).data,
  getNextCode: async (type) => (await api.get(`/api/devices/next-code/${type}`)).data,
  bulkCreate: async (bulkData) => (await api.post('/api/devices/bulk-add', bulkData)).data,
  create: async (deviceData) => (await api.post('/api/devices', deviceData)).data,
  update: async (id, deviceData) => (await api.put(`/api/devices/${id}`, deviceData)).data,
  delete: async (id) => (await api.delete(`/api/devices/${id}`)).data,
  bulkAssign: async (deviceIds, clientId) => (await api.post('/api/devices/bulk/assign', { deviceIds, clientId })).data,
  bulkUpdateLifecycle: async (deviceIds, lifecycleData) => (await api.post('/api/devices/bulk/update-lifecycle', { deviceIds, ...lifecycleData })).data,
  filterByType: async (type) => (await api.get(`/api/devices/filter/type/${type}`)).data,
  filterByLifecycle: async (status) => (await api.get(`/api/devices/filter/lifecycle/${status}`)).data,
  filterByClient: async (clientId) => (await api.get(`/api/devices/filter/client/${clientId}`)).data,
  search: async (filters) => (await api.post('/api/devices/search', filters)).data,
  getStats: async () => (await api.get('/api/devices/stats/summary')).data,
};

// ==========================================
// AUTH API METHODS
// ==========================================

export const authApi = {
  login: async (email, password) => (await api.post('/login', { email, password })).data,
};

export default api;