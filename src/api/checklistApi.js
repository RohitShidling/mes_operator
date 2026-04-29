import api from './axiosConfig';

export const checklistApi = {
  getAllChecklists: () =>
    api.get('/checklist'),

  getChecklistSummary: () =>
    api.get('/checklist/summary'),

  getGenericChecklist: () =>
    api.get('/checklist/generic'),

  getMachineChecklist: (machineId) =>
    api.get(`/checklist/${machineId}`),

  saveMachineProgress: (machineId, data) =>
    api.put(`/checklist/${machineId}/progress`, data),
};

