import api from './axiosConfig';

export const notificationApi = {
  // Get all notifications
  getAll: () =>
    api.get('/notifications'),

  // Get unread notifications
  getUnread: () =>
    api.get('/notifications/unread'),

  // Create notification
  create: (data) =>
    api.post('/notifications', data),

  // Mark notification as read
  markAsRead: (notificationId) =>
    api.patch(`/notifications/${notificationId}/read`),

  // Mark all notifications as read
  markAllAsRead: () =>
    api.patch('/notifications/read-all'),

  // Delete notification
  delete: (notificationId) =>
    api.delete(`/notifications/${notificationId}`),

  // Subscribe to machine notifications
  subscribeToMachine: (machineId) =>
    api.post('/notifications/subscribe', { machine_id: machineId }),
};
