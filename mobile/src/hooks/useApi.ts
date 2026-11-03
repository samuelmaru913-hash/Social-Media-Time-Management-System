import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi, limitsApi, usageApi, studySessionsApi, reportsApi } from '../api/endpoints';

// Applications
export function useApplications() {
    return useQuery({
        queryKey: ['applications'],
        queryFn: () => applicationsApi.list().then((r) => r.data),
    });
}

export function useCreateApplication() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: applicationsApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
    });
}

export function useUpdateApplication() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof applicationsApi.update>[1] }) =>
            applicationsApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
    });
}

export function useDeleteApplication() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: applicationsApi.delete,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['applications'] });
            qc.invalidateQueries({ queryKey: ['limits'] });
        },
    });
}

// Limits
export function useLimits() {
    return useQuery({
        queryKey: ['limits'],
        queryFn: () => limitsApi.list().then((r) => r.data),
    });
}

export function useCreateLimit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: limitsApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['limits'] }),
    });
}

export function useUpdateLimit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof limitsApi.update>[1] }) =>
            limitsApi.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['limits'] });
            qc.invalidateQueries({ queryKey: ['usage', 'today'] });
        },
    });
}

export function useDeleteLimit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: limitsApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['limits'] }),
    });
}

// Usage
export function useTodayUsage() {
    return useQuery({
        queryKey: ['usage', 'today'],
        queryFn: () => usageApi.getToday().then((r) => r.data),
        refetchInterval: 60 * 1000, // refetch every 60 seconds
    });
}

export function useUsageHistory(params?: Parameters<typeof usageApi.getHistory>[0]) {
    return useQuery({
        queryKey: ['usage', 'history', params],
        queryFn: () => usageApi.getHistory(params).then((r) => r.data),
    });
}

export function useUsageSummary() {
    return useQuery({
        queryKey: ['usage', 'summary'],
        queryFn: () => usageApi.getSummary().then((r) => r.data),
    });
}

export function useSyncUsage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: usageApi.sync,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['usage'] });
            qc.invalidateQueries({ queryKey: ['reports'] });
        },
    });
}

// Study Sessions
export function useStudySessions(params?: { page?: number; limit?: number }) {
    return useQuery({
        queryKey: ['study-sessions', params],
        queryFn: () => studySessionsApi.list(params).then((r) => r.data),
    });
}

export function useCreateStudySession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: studySessionsApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions'] }),
    });
}

export function useCompleteStudySession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, seconds }: { id: string; seconds?: number }) =>
            studySessionsApi.complete(id, seconds),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions'] }),
    });
}

export function useUpdateStudySession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof studySessionsApi.update>[1] }) =>
            studySessionsApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions'] }),
    });
}

// Reports
export function useDailyReport(date?: string) {
    return useQuery({
        queryKey: ['reports', 'daily', date],
        queryFn: () => reportsApi.daily(date).then((r) => r.data),
    });
}

export function useWeeklyReport(endDate?: string) {
    return useQuery({
        queryKey: ['reports', 'weekly', endDate],
        queryFn: () => reportsApi.weekly(endDate).then((r) => r.data),
    });
}

export function useMonthlyReport(year?: number, month?: number) {
    return useQuery({
        queryKey: ['reports', 'monthly', year, month],
        queryFn: () => reportsApi.monthly(year, month).then((r) => r.data),
    });
}
