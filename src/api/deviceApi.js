import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
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
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==========================================
// DEVICE API METHODS
// ==========================================

export const deviceApi = {
  // Get all devices
  getAll: async () => {
    const response = await api.get('/api/devices');
    return response.data;
  },

  // Get single device by ID
  getById: async (id) => {
    const response = await api.get(`/api/devices/${id}`);
    return response.data;
  },

  // Get device by code
  getByCode: async (code) => {
    const response = await api.get(`/api/devices/code/${code}`);
    return response.data;
  },

  // NEW: Get device by barcode
  getByBarcode: async (barcode) => {
    const response = await api.get(`/api/devices/barcode/${barcode}`);
    return response.data;
  },

  // Create new device
  create: async (deviceData) => {
    const response = await api.post('/api/devices', deviceData);
    return response.data;
  },

  // Update device
  update: async (id, deviceData) => {
    const response = await api.put(`/api/devices/${id}`, deviceData);
    return response.data;
  },

  // Delete device
  delete: async (id) => {
    const response = await api.delete(`/api/devices/${id}`);
    return response.data;
  },

  // Bulk assign devices to client
  bulkAssign: async (deviceIds, clientId) => {
    const response = await api.post('/api/devices/bulk/assign', {
      deviceIds,
      clientId,
    });
    return response.data;
  },

  // Bulk unassign devices
  bulkUnassign: async (deviceIds) => {
    const response = await api.post('/api/devices/bulk/unassign', {
      deviceIds,
    });
    return response.data;
  },

  // Bulk update lifecycle status
  bulkUpdateLifecycle: async (deviceIds, lifecycleData) => {
    const response = await api.post('/api/devices/bulk/update-lifecycle', {
      deviceIds,
      ...lifecycleData,
    });
    return response.data;
  },

  // Filter devices by type
  filterByType: async (type) => {
    const response = await api.get(`/api/devices/filter/type/${type}`);
    return response.data;
  },

  // Filter devices by lifecycle status
  filterByLifecycle: async (status) => {
    const response = await api.get(`/api/devices/filter/lifecycle/${status}`);
    return response.data;
  },

  // Filter devices by client
  filterByClient: async (clientId) => {
    const response = await api.get(`/api/devices/filter/client/${clientId}`);
    return response.data;
  },

  // Advanced search
  search: async (filters) => {
    const response = await api.post('/api/devices/search', filters);
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get('/api/devices/stats/summary');
    return response.data;
  },
};

// ==========================================
// AUTH API METHODS
// ==========================================

export const authApi = {
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    return response.data;
  },
};

export default api;