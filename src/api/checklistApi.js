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

  // Get checklist overview for all machines in a work order
  // Returns machines with calculated checklist_status based on item completion
  getChecklistOverview: (workOrderId) =>
    api.get(`/work-orders/${workOrderId}/checklist-overview`),
};

