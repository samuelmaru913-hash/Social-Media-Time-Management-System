/**
 * Business logic utilities for usage calculations.
 * These functions are pure and testable independently of UI or platform.
 */

/** Remaining seconds = max(0, limit - used) */
export function calculateRemaining(limitSeconds: number, usedSeconds: number): number {
    return Math.max(0, limitSeconds - usedSeconds);
}

/** Usage percentage clamped to 0–100 */
export function calculateUsagePercentage(limitSeconds: number, usedSeconds: number): number {
    if (limitSeconds <= 0) return 0;
    return Math.min(100, (usedSeconds / limitSeconds) * 100);
}

/** True when used >= limit */
export function isLimitReached(limitSeconds: number, usedSeconds: number): boolean {
    return usedSeconds >= limitSeconds;
}

/** True when usage% >= warning threshold */
export function isWarningTriggered(
    limitSeconds: number,
    usedSeconds: number,
    warningThreshold: number
): boolean {
    return calculateUsagePercentage(limitSeconds, usedSeconds) >= warningThreshold;
}

/** Format seconds into human-readable string: "1h 23m", "45m", "30s" */
export function formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0 && seconds > 0) return `${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

/** Format minutes: "3h 0m", "45m" */
export function formatMinutes(totalMinutes: number): string {
    return formatDuration(totalMinutes * 60);
}

/** Get today's date as YYYY-MM-DD in a given time zone (approximation via offset) */
export function getTodayLocalDate(timeZone?: string): string {
    try {
        if (timeZone) {
            return new Date().toLocaleDateString('en-CA', { timeZone });
        }
    } catch {
        // Invalid timezone
    }
    return new Date().toISOString().split('T')[0];
}

/** Get start/end of current week as YYYY-MM-DD strings */
export function getCurrentWeekRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const day = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
    };
}

/** Generate a UUID v4 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Get app category color */
export function getCategoryColor(category: string, colors: Record<string, string>): string {
    const map: Record<string, string> = {
        social: colors.social ?? '#EF4444',
        video: colors.video ?? '#8B5CF6',
        messaging: colors.messaging ?? '#22D3EE',
        productivity: colors.productivity ?? '#10B981',
    };
    return map[category] ?? colors.other ?? '#9CA3AF';
}

/** Compute progress bar color based on percentage */
export function getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#EF4444';  // danger
    if (percentage >= 90) return '#F59E0B';   // warning
    if (percentage >= 75) return '#F97316';   // orange
    return '#10B981';                          // success
}
