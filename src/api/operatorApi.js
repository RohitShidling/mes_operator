import api from './axiosConfig';

export const operatorApi = {
  // Machine Checklist
  getChecklist: () =>
    api.get('/operator/checklist'),

  updateMachineStatus: (machineId, status) =>
    api.post('/operator/checklist/update', { machine_id: machineId, status }),

  // Rejections
  reportRejection: (formData) =>
    api.post('/operator/rejections', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  reportRejectionByMachine: (machineId, formData) =>
    api.post(`/operator/rejections/${machineId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getAllRejections: () =>
    api.get('/operator/rejections'),

  getRejectionsByMachine: (machineId) =>
    api.get(`/operator/rejections/machine/${machineId}`),

  getPendingReworkByMachine: (machineId) =>
    api.get(`/operator/rejections/machine/${machineId}/rework/pending`),

  getReworkReasons: () =>
    api.get('/operator/rejections/rework-reasons'),

  markReworkDone: (rejectionId, data) =>
    api.patch(`/operator/rejections/${rejectionId}/rework`, data),

  // Skills
  updateSkills: (data) =>
    api.post('/operator/skills', data),

  getMySkills: () =>
    api.get('/operator/skills/me'),

  getAllSkills: () =>
    api.get('/operator/skills'),

  // Machine Assignments
  assignToMachine: (data) =>
    api.post('/operator/assign', data),

  getMyMachines: () =>
    api.get('/operator/my-machines'),

  getMachineOperators: (machineId) =>
    api.get(`/operator/machine-operators/${machineId}`),

  getAllAssignments: () =>
    api.get('/operator/assignments'),

  removeMyMachine: (machineId) =>
    api.delete(`/operator/machines/${machineId}`),

  unassignFromMachine: (machineId) =>
    api.delete(`/operator/assign/${machineId}`),

  // Breakdowns
  reportBreakdown: (data) =>
    api.post('/operator/breakdowns', data),

  reportBreakdownByMachine: (machineId, data) =>
    api.post(`/operator/breakdowns/${machineId}`, data),

  getBreakdownReasons: () =>
    api.get('/operator/breakdowns/reasons'),

  updateBreakdownStatus: (breakdownId, status) =>
    api.patch(`/operator/breakdowns/${breakdownId}/status`, { status }),

  getActiveBreakdowns: () =>
    api.get('/operator/breakdowns/active'),

  getBreakdownsByMachine: (machineId) =>
    api.get(`/operator/breakdowns/machine/${machineId}`),

  getAllBreakdowns: () =>
    api.get('/operator/breakdowns'),
};
