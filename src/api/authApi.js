import api from './axiosConfig';

export const authApi = {
  login: (credentials) =>
    api.post('/operator/auth/login', credentials),

  register: (userData) =>
    api.post('/operator/auth/register', userData),

  getProfile: () =>
    api.get('/operator/auth/me'),

  refreshToken: (refreshToken) =>
    api.post('/operator/auth/refresh', { refreshToken }),

  logout: () =>
    api.post('/operator/auth/logout'),
};
