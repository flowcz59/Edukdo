import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track ongoing refresh to avoid concurrent refresh attempts
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processRefreshQueue(error: unknown, token: string | null) {
  refreshQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  refreshQueue = [];
}

// Inject Authorization header from current store state
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle 401: attempt token refresh once, then retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error);
    }

    const { refreshToken, refreshTokens, logout } = useAuthStore.getState();

    if (!refreshToken) {
      await logout();
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retried = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken?: string }>(
        `${BASE_URL}/api/auth/refresh`,
        { refreshToken },
      );
      await refreshTokens(data.accessToken, data.refreshToken);
      processRefreshQueue(null, data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processRefreshQueue(refreshError, null);
      await logout();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

function redirectToLogin() {
  // Use dynamic import to avoid circular dependency with expo-router at module init
  const { router } = require('expo-router') as typeof import('expo-router');
  router.replace('/(auth)/login');
}

export default apiClient;
