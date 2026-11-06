import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchUser();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUser]);

  const login = async (credentials, portal = 'student') => {
    let response;
    try {
      response = await api.post(portal === 'librarian' ? '/auth/librarian/login' : '/auth/login', credentials);
    } catch (err) {
      // 401/403 carry a message (e.g. account waiting for approval).
      if (err.response?.data?.message) return { success: false, message: err.response.data.message };
      throw err;
    }
    if (response.data.success) {
      const { user, token } = response.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true, user };
    }
    return { success: false, message: response.data.message };
  };

  const register = async (data) => {
    let response;
    try {
      response = await api.post('/auth/register', data);
    } catch (err) {
      if (err.response?.status === 422) {
        return { success: false, message: err.response.data.message, errors: err.response.data.errors };
      }
      throw err;
    }
    // New student accounts wait for librarian approval: no token yet.
    if (response.data.success && response.data.pending) {
      return { success: true, pending: true, message: response.data.message };
    }
    if (response.data.success) {
      const { user, token } = response.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    }
    return { success: false, message: response.data.message, errors: response.data.errors };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const updateProfile = async (data) => {
    const response = await api.put('/auth/profile', data);
    if (response.data.success) {
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return { success: true };
    }
    return { success: false, message: response.data.message, errors: response.data.errors };
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    isStudent: user?.role === 'student',
    isLibrarian: ['librarian', 'admin'].includes(user?.role),
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
