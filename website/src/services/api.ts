import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { getSeededApiData } from './seedData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function parseRequestPath(config: InternalAxiosRequestConfig) {
  const base = config.baseURL || API_BASE_URL;
  return new URL(config.url || '', base);
}

function createSeedResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data: { success: true, data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function isEmptyResponse(pathname: string, payload: any) {
  if (!payload?.success) return false;

  const body = payload.data || {};

  if (pathname.endsWith('/classes')) return Array.isArray(body.classes) && body.classes.length === 0;
  if (pathname.endsWith('/students')) return Array.isArray(body.students) && body.students.length === 0;
  if (pathname.endsWith('/analytics/dashboard')) {
    return body.totalStudents === 0 && body.totalSessions === 0 && (!body.recentSessions || body.recentSessions.length === 0);
  }
  if (pathname.endsWith('/notifications/stats')) {
    const stats = body.stats || {};
    return Object.values(stats).every((value) => Number(value) === 0);
  }
  if (pathname.endsWith('/notifications')) return Array.isArray(body.notifications) && body.notifications.length === 0;
  if (pathname.endsWith('/analytics/attendance')) return Array.isArray(body.timeline) && body.timeline.length === 0;
  if (pathname.endsWith('/attendance/sessions')) return Array.isArray(body.sessions) && body.sessions.length === 0;
  if (pathname.endsWith('/attendance/absent-on-date')) return Array.isArray(body.absentStudentIds) && body.absentStudentIds.length === 0;
  if (pathname.endsWith('/exams')) return Array.isArray(body.exams) && body.exams.length === 0;
  if (/\/exams\/[^/]+\/marks$/.test(pathname)) return Array.isArray(body.marks) && body.marks.length === 0;
  if (pathname.endsWith('/analytics/performance')) return Array.isArray(body.marks) && body.marks.length === 0;

  return false;
}

api.interceptors.response.use(
  (res) => {
    if (res.config.method?.toLowerCase() === 'get') {
      const parsed = parseRequestPath(res.config);
      if (isEmptyResponse(parsed.pathname, res.data)) {
        const seeded = getSeededApiData(parsed.pathname, parsed.searchParams);
        if (seeded) return createSeedResponse(res.config, seeded);
      }
    }

    return res;
  },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    if (original?.method?.toLowerCase() === 'get') {
      const parsed = parseRequestPath(original);
      const seeded = getSeededApiData(parsed.pathname, parsed.searchParams);
      if (seeded) {
        return createSeedResponse(original, seeded);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
