import api from './axiosConfig';

export const authApi = {
  requestLoginOtp: (payload) =>
    api.post('/operator/auth/login/request-otp', payload),

  login: (credentials) =>
    api.post('/operator/auth/login', credentials),

  requestRegisterOtp: (payload) =>
    api.post('/operator/auth/register/request-otp', payload),

  register: (userData) =>
    api.post('/operator/auth/register', userData),

  getProfile: () =>
    api.get('/operator/auth/me'),

  refreshToken: (refreshToken) =>
    api.post('/operator/auth/refresh', { refreshToken }),

  logout: () =>
    api.post('/operator/auth/logout'),
};
