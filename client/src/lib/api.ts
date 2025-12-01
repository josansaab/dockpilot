import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Container APIs
export const containerApi = {
  list: () => api.get('/containers'),
  start: (id: string) => api.post(`/containers/${id}/start`),
  stop: (id: string) => api.post(`/containers/${id}/stop`),
  remove: (id: string) => api.delete(`/containers/${id}`),
  logs: (id: string) => api.get(`/containers/${id}/logs`),
};

// Image APIs
export const imageApi = {
  list: () => api.get('/images'),
  pull: (imageName: string) => api.post('/images/pull', { imageName }),
  remove: (id: string) => api.delete(`/images/${id}`),
};

// App APIs
export const appApi = {
  list: () => api.get('/apps'),
  install: (app: any) => api.post('/apps', app),
  update: (id: string, data: any) => api.patch(`/apps/${id}`, data),
  uninstall: (id: string) => api.delete(`/apps/${id}`),
};

// Settings APIs
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.patch('/settings', data),
};

// Health check
export const healthApi = {
  check: () => api.get('/health'),
};

export default api;
