import axios from 'axios';

// VITE_API_URL is the Laravel API origin in production (e.g. https://libralearn-api.up.railway.app).
// Unset locally: requests go to /api and the Vite dev proxy / Laravel serves them.
const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const baseURL = apiOrigin ? (apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`) : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;