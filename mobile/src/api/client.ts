import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/api';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: string) => void; reject: (reason: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
}

export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — attach access token
apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const token = await storage.getSecure(STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!error.response) {
            error.message =
                error.code === 'ECONNABORTED'
                    ? 'The Focus No API request timed out. Check your connection and try again.'
                    : 'Cannot reach the Focus No API. Check your internet connection and try again.';
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await storage.getSecure(STORAGE_KEYS.REFRESH_TOKEN);
                if (!refreshToken) throw new Error('No refresh token');

                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
                const { accessToken, refreshToken: newRefreshToken } = response.data.data;

                await Promise.all([
                    storage.setSecure(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
                    storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken),
                ]);

                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Clear session on refresh failure
                await Promise.all([
                    storage.deleteSecure(STORAGE_KEYS.ACCESS_TOKEN),
                    storage.deleteSecure(STORAGE_KEYS.REFRESH_TOKEN),
                    storage.remove(STORAGE_KEYS.USER),
                ]);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export async function apiGet<T>(path: string, params?: Record<string, unknown>) {
    const response = await apiClient.get<{ success: boolean; data: T; message: string; meta?: unknown }>(path, { params });
    return response.data;
}

export async function apiPost<T>(path: string, body?: unknown) {
    const response = await apiClient.post<{ success: boolean; data: T; message: string }>(path, body);
    return response.data;
}

export async function apiPatch<T>(path: string, body?: unknown) {
    const response = await apiClient.patch<{ success: boolean; data: T; message: string }>(path, body);
    return response.data;
}

export async function apiDelete<T>(path: string) {
    const response = await apiClient.delete<{ success: boolean; data: T; message: string }>(path);
    return response.data;
}
