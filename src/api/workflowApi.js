import api from './axiosConfig';

export const workflowApi = {
  getWorkflow: (workOrderId) =>
    api.get(`/workflows/${workOrderId}`),

  addStepsBulk: (workOrderId, steps) =>
    api.post(`/workflows/${workOrderId}/steps/bulk`, { steps }),

  addStep: (workOrderId, stepData) =>
    api.post(`/workflows/${workOrderId}/steps`, stepData),

  updateStepStatus: (stepId, status) =>
    api.patch(`/workflows/steps/${stepId}/status`, { status }),

  updateStep: (stepId, stepData) =>
    api.put(`/workflows/steps/${stepId}`, stepData),

  deleteStep: (stepId) =>
    api.delete(`/workflows/steps/${stepId}`),
};
