import axios from 'axios';
import { getApiBaseUrl } from './network';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken'); // For prototype purposes. In real prod, might be managed via Zustand or refresh cycle.
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
