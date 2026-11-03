export type UserRole = 'STUDENT' | 'ADMIN';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    timeZone: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TrackedApplication {
    id: string;
    userId: string;
    applicationName: string;
    packageName: string;
    isEnabled: boolean;
    iconUrl?: string;
    deviceId?: string;
    monitoringStatus: 'ACTIVE' | 'PAUSED' | 'REMOVED';
    createdAt: string;
    updatedAt: string;
    dailyLimits?: DailyLimit[];
}

export interface DailyLimit {
    id: string;
    userId: string;
    trackedApplicationId: string;
    limitMinutes: number;
    warningThreshold: number;
    scheduleConfiguration?: object | null;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    trackedApplication?: TrackedApplication;
}

export interface UsageRecord {
    id: string;
    userId: string;
    trackedApplicationId: string;
    localDate: string;
    timeZone: string;
    usageDurationSeconds: number;
    sourceDeviceId?: string;
    syncId?: string;
    createdAt: string;
    updatedAt: string;
    trackedApplication?: TrackedApplication;
}

export interface UsageSummaryItem {
    application: Pick<TrackedApplication, 'id' | 'applicationName' | 'packageName'>;
    limitMinutes: number;
    usedSeconds: number;
    remainingSeconds: number;
    usagePercentage: number;
    isLimitReached: boolean;
    isWarningTriggered: boolean;
}

export interface StudySession {
    id: string;
    userId: string;
    title: string;
    plannedDurationMinutes: number;
    actualDurationSeconds: number;
    startedAt?: string;
    completedAt?: string;
    status: SessionStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationPreference {
    id: string;
    userId: string;
    limitWarningsEnabled: boolean;
    studyRemindersEnabled: boolean;
    dailySummaryEnabled: boolean;
    resetReminderEnabled: boolean;
    warningThresholds: number[];
    createdAt: string;
    updatedAt: string;
}

export interface UserPreferences {
    id: string;
    userId: string;
    dailyGoalMinutes: number;
    studyGoalMinutes: number;
    syncEnabled: boolean;
    theme: string;
    language: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    errors?: Record<string, string[]>;
}

// Usage provider interface — shared by Demo and Native providers
export interface UsageProvider {
    isAvailable: boolean;
    isDemoMode: boolean;
    hasPermission(): Promise<boolean>;
    requestPermission(): Promise<void>;
    getUsageForDate(packageName: string, date: string): Promise<number>; // returns seconds
    getUsageForDateRange(packageName: string, startDate: string, endDate: string): Promise<Record<string, number>>;
    getAllUsageForDate(date: string): Promise<Record<string, number>>;
}

export interface DemoApp {
    applicationName: string;
    packageName: string;
    iconColor: string;
    category: string;
}
