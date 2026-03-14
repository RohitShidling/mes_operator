import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { socketService } from '../api/socketService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount (auto-login)
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('operator_token');
      const savedUser = localStorage.getItem('operator_user');

      if (token) {
        try {
          // Verify token by fetching profile
          const response = await authApi.getProfile();
          const userData = response.data?.data || response.data || JSON.parse(savedUser || '{}');
          
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem('operator_user', JSON.stringify(userData));

          // Connect socket
          socketService.connect(token);
        } catch (err) {
          console.warn('Token verification failed, context will wait for axios interceptor to refresh ->', err.message);
          // Note: axiosConfig handles the actual token refresh logic via interceptors.
          // If the interceptor successfully refreshes the token, the request here is retried and succeeds.
          // If it fails, axiosConfig clears storage and redirects to login, so we just clear state here.
          clearAuth();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('operator_token');
    localStorage.removeItem('operator_refresh_token');
    localStorage.removeItem('operator_user');
    setUser(null);
    setIsAuthenticated(false);
    socketService.disconnect();
  };

  const login = useCallback(async (credentials) => {
    try {
      const response = await authApi.login(credentials);
      
      // Axios typically nests the actual JSON body in `response.data`
      const data = response.data?.data || response.data;
      
      if (!data) {
        throw new Error('Invalid response from server');
      }

      const { accessToken, refreshToken, token, ...userData } = data;
      const actualToken = accessToken || token;

      if (!actualToken) {
        throw new Error('No access token received');
      }

      localStorage.setItem('operator_token', actualToken);
      if (refreshToken) {
        localStorage.setItem('operator_refresh_token', refreshToken);
      }

      // Instead of another API call, we can just use the user data from the login response if available.
      // If it only returns tokens, then fallback to profile fetch
      let finalUser = userData;
      if (!userData.email && !userData.username && !userData.operator_id) {
        const profileRes = await authApi.getProfile();
        finalUser = profileRes.data?.data || profileRes.data;
      }

      localStorage.setItem('operator_user', JSON.stringify(finalUser));
      setUser(finalUser);
      setIsAuthenticated(true);

      // Connect socket
      socketService.connect(actualToken);

      toast.success('Welcome back! Logged in successfully.');
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      // Determine the error message
      let message = 'Login failed. Please check your credentials.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      }
      
      toast.error(message);
      return { success: false, message };
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      const response = await authApi.register(userData);
      
      const data = response.data?.data || response.data;
      const { accessToken, refreshToken, token, ...registeredUser } = data || {};
      const actualToken = accessToken || token;

      if (actualToken) {
        localStorage.setItem('operator_token', actualToken);
        if (refreshToken) localStorage.setItem('operator_refresh_token', refreshToken);

        let finalUser = registeredUser;
        if (!registeredUser.email && !registeredUser.username) {
           const profileRes = await authApi.getProfile();
           finalUser = profileRes.data?.data || profileRes.data;
        }

        localStorage.setItem('operator_user', JSON.stringify(finalUser));
        setUser(finalUser);
        setIsAuthenticated(true);

        socketService.connect(actualToken);
        toast.success('Account created! You are now logged in.');
        return { success: true, autoLoggedIn: true };
      }

      // If API doesn't auto-login after register
      toast.success('Registration successful! Please log in.');
      return { success: true, autoLoggedIn: false };
    } catch (err) {
      console.error('Registration error:', err);
      let message = 'Registration failed. Please try again.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      }

      toast.error(message);
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore logout API errors
    }
    clearAuth();
    toast.success('Logged out successfully.');
    // Force reload to clear all states and redirect properly
    window.location.href = '/login';
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
