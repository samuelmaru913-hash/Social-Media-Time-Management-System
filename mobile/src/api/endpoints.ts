import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type {
    User,
    TrackedApplication,
    DailyLimit,
    UsageSummaryItem,
    UsageRecord,
    StudySession,
    NotificationPreference,
    AuthTokens,
} from '../types';

// Auth
export const authApi = {
    register: (data: { fullName: string; email: string; password: string; timeZone?: string }) =>
        apiPost<{ user: User } & AuthTokens>('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        apiPost<{ user: User } & AuthTokens>('/auth/login', data),

    logout: (refreshToken: string) =>
        apiPost<null>('/auth/logout', { refreshToken }),

    forgotPassword: (email: string) =>
        apiPost<null>('/auth/forgot-password', { email }),
};
// Users
export const usersApi = {
    getMe: () => apiGet<User>('/users/me'),
    updateMe: (data: Partial<User> & { password?: string }) => apiPatch<User>('/users/me', data),
    deleteMe: () => apiDelete<null>('/users/me'),
    updatePreferences: (data: Record<string, unknown>) => apiPatch('/users/me/preferences', data),
};

// Applications
export const applicationsApi = {
    list: () => apiGet<TrackedApplication[]>('/applications'),
    create: (data: { applicationName: string; packageName: string; iconUrl?: string; deviceId?: string }) =>
        apiPost<TrackedApplication>('/applications', data),
    update: (id: string, data: Partial<TrackedApplication>) =>
        apiPatch<TrackedApplication>(`/applications/${id}`, data),
    delete: (id: string) => apiDelete<null>(`/applications/${id}`),
};

// Limits
export const limitsApi = {
    list: () => apiGet<DailyLimit[]>('/limits'),
    create: (data: {
        trackedApplicationId: string;
        limitMinutes: number;
        warningThreshold?: number;
    }) => apiPost<DailyLimit>('/limits', data),
    update: (id: string, data: Partial<DailyLimit>) => apiPatch<DailyLimit>(`/limits/${id}`, data),
    delete: (id: string) => apiDelete<null>(`/limits/${id}`),
};

// Usage
export const usageApi = {
    getToday: () =>
        apiGet<{ date: string; usage: UsageSummaryItem[] }>('/usage/today'),
    getHistory: (params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) =>
        apiGet<UsageRecord[]>('/usage/history', params as Record<string, unknown>),
    sync: (records: Array<{
        trackedApplicationId: string;
        localDate: string;
        timeZone: string;
        usageDurationSeconds: number;
        sourceDeviceId?: string;
        syncId: string;
    }>) => apiPost('/usage/sync', { records }),
    getSummary: () => apiGet<{
        todaySeconds: number;
        weeklyBreakdown: Array<{ date: string; usageSeconds: number }>;
    }>('/usage/summary'),
};

// Study sessions
export const studySessionsApi = {
    create: (data: { title?: string; plannedDurationMinutes: number; notes?: string }) =>
        apiPost<StudySession>('/study-sessions', data),
    list: (params?: { page?: number; limit?: number }) =>
        apiGet<StudySession[]>('/study-sessions', params as Record<string, unknown>),
    getById: (id: string) => apiGet<StudySession>(`/study-sessions/${id}`),
    update: (id: string, data: Partial<StudySession>) =>
        apiPatch<StudySession>(`/study-sessions/${id}`, data),
    complete: (id: string, actualDurationSeconds?: number) =>
        apiPost<StudySession>(`/study-sessions/${id}/complete`, { actualDurationSeconds }),
};

// Reports
export const reportsApi = {
    daily: (date?: string) =>
        apiGet<{
            date: string;
            totalUsageSeconds: number;
            totalStudySeconds: number;
            productivityScore: number;
            sessionsCompleted: number;
            appBreakdown: Array<{
                application: Pick<TrackedApplication, 'id' | 'applicationName' | 'packageName'>;
                usedSeconds: number;
                limitSeconds: number;
                remainingSeconds: number;
                usagePercentage: number;
            }>;
        }>('/reports/daily', date ? { date } : undefined),

    weekly: (endDate?: string) =>
        apiGet<{
            startDate: string;
            endDate: string;
            dailyUsage: Array<{ date: string; usageSeconds: number }>;
            totalUsageSeconds: number;
            totalStudySeconds: number;
        }>('/reports/weekly', endDate ? { endDate } : undefined),

    monthly: (year?: number, month?: number) =>
        apiGet<{
            year: number;
            month: number;
            totalUsageSeconds: number;
            dailyUsage: Array<{ date: string; usageSeconds: number }>;
            topApplications: Array<{ application?: TrackedApplication; totalSeconds: number }>;
        }>('/reports/monthly', { year, month }),
};

// Notifications
export const notificationsApi = {
    getPreferences: () => apiGet<NotificationPreference>('/notifications/preferences'),
    updatePreferences: (data: Partial<NotificationPreference>) =>
        apiPatch<NotificationPreference>('/notifications/preferences', data),
};

// Admin (ADMIN role only)
export const adminApi = {
    listUsers: () =>
        apiGet<Array<{
            id: string;
            fullName: string;
            email: string;
            isActive: boolean;
            createdAt: string;
            trackedAppCount: number;
        }>>('/admin/users'),

    getUserApplications: (userId: string) =>
        apiGet<{
            user: { id: string; fullName: string; email: string };
            applications: Array<{
                id: string;
                applicationName: string;
                packageName: string;
                isEnabled: boolean;
                monitoringStatus: string;
                iconUrl?: string;
                deviceId?: string;
                createdAt: string;
                limit: { id: string; limitMinutes: number; warningThreshold: number; isEnabled: boolean } | null;
                usedSeconds: number;
                limitSeconds: number | null;
                remainingSeconds: number | null;
            }>;
        }>(`/admin/users/${userId}/applications`),

    updateUserApp: (userId: string, appId: string, data: { isEnabled?: boolean; monitoringStatus?: string }) =>
        apiPatch(`/admin/users/${userId}/applications/${appId}`, data),

    setUserAppLimit: (userId: string, appId: string, data: { limitMinutes?: number; warningThreshold?: number; isEnabled?: boolean }) =>
        apiPatch(`/admin/users/${userId}/applications/${appId}/limit`, data),
};
