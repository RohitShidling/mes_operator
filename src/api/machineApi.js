import api from './axiosConfig';

export const machineApi = {
  getAll: () =>
    api.get('/machines'),

  getDetails: (machineId) =>
    api.get(`/machines/${machineId}/details`),

  getDashboard: (machineId) =>
    api.get(`/machines/${machineId}/dashboard`),

  getVisualization: (machineId, params = {}) =>
    api.get(`/machines/${machineId}/visualization`, { params }),

  getHistory: (machineId) =>
    api.get(`/machines/${machineId}/history`),

  createMachine: (formData) =>
    api.post('/machines', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  ingestData: (pathId) =>
    api.post(`/ingest/${pathId}`),

  stopMachine: (machineId) =>
    api.post(`/machines/${machineId}/stop`),
};
