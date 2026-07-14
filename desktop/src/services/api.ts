/**
 * api.ts — Axios instance with JWT interceptors + retry logic.
 *
 * Retry: network errors and 5xx responses are retried up to 2 times
 * with short backoff (500ms, 1.5s). Vercel serverless recovers fast
 * — retries are just for transient network blips, not cold starts.
 * Timeout is set high (30s) to accommodate Vercel cold starts.
 */

import axios, { type AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [500, 1500]; // short backoff — Vercel recovers fast

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s — accommodates Vercel cold starts without triggering retries
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ──

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: token refresh + auto-retry ──

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (!original) return Promise.reject(error);

    // Token refresh on 401 (only for expired tokens, not invalid credentials)
    if (
      error.response?.status === 401 &&
      (error.response?.data as any)?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        // Only clear auth tokens, not all localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.hash = '#/login';
        return Promise.reject(error);
      }
    }

    // Auto-retry on network errors or 5xx server errors
    const retryCount = original._retryCount || 0;
    const isRetryable =
      !error.response || // network error (no response)
      (error.response.status >= 500 && error.response.status < 600); // 5xx

    if (isRetryable && retryCount < MAX_RETRIES && !original._noRetry) {
      original._retryCount = retryCount + 1;
      const delay = RETRY_DELAYS[retryCount] || 4000;

      console.log(
        `[API] Retry ${original._retryCount}/${MAX_RETRIES} for ${original.method?.toUpperCase()} ${original.url} in ${delay}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(original);
    }

    return Promise.reject(error);
  }
);

export default api;
