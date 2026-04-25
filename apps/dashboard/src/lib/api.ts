import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { applySessionSnapshot, clearDashboardAuthStorage, hasRecentManualLogout } from './authSession';
import { getApiBaseUrl } from './network';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const baseURL = getApiBaseUrl();

const authHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 60000,
  headers: authHeaders,
});

let refreshPromise: Promise<string | null> | null = null;

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then((response) => {
        const accessToken = typeof response.data?.accessToken === 'string' ? response.data.accessToken : '';
        if (!accessToken) {
          throw new Error('Missing access token from refresh response');
        }

        applySessionSnapshot({
          accessToken,
          user: {
            role: localStorage.getItem('userRole') || 'UNKNOWN',
            mustChangePassword: localStorage.getItem('mustChangePassword') === '1',
          },
        });

        return accessToken;
      })
      .catch((error) => {
        clearDashboardAuthStorage();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 60000,
  headers: authHeaders,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthRoute = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/clerk-sync');
    const isRefreshRoute = requestUrl.includes('/auth/refresh');
    const isLogoutRoute = requestUrl.includes('/auth/logout');

    if (status !== 401 || !originalRequest || originalRequest._retry || isAuthRoute || isRefreshRoute) {
      if (status === 401 && (isRefreshRoute || isAuthRoute)) {
        clearDashboardAuthStorage();
      }
      return Promise.reject(error);
    }

    if (hasRecentManualLogout() || isLogoutRoute) {
      clearDashboardAuthStorage();
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      const nextAccessToken = await refreshAccessToken();
      if (!nextAccessToken) {
        throw new Error('Access token refresh failed');
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearDashboardAuthStorage();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);
