import api from './axiosConfig';

export const workOrderApi = {
  getAll: () =>
    api.get('/work-orders'),

  getById: (workOrderId) =>
    api.get(`/work-orders/${workOrderId}`),

  getMachines: (workOrderId) =>
    api.get(`/work-orders/${workOrderId}/machines`),

  assignMachine: (workOrderId, machineId) =>
    api.post(`/work-orders/${workOrderId}/machines`, { machine_id: machineId }),

  unassignMachine: (workOrderId, machineId) =>
    api.delete(`/work-orders/${workOrderId}/machines/${machineId}`),

  getRejections: (workOrderId) =>
    api.get(`/work-orders/${workOrderId}/rejections`),

  // Operator can update work order status (PENDING, IN_PROGRESS, NOT_STARTED)
  updateStatus: (workOrderId, status) =>
    api.put(`/work-orders/${workOrderId}`, { status }),
};
