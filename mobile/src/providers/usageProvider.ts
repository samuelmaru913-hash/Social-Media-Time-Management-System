import { UsageProvider } from '../types';
import { DEMO_APPS } from '../constants';

/**
 * Demo usage provider for Expo Go.
 * Generates deterministic, clearly labeled sample data.
 * IMPORTANT: This data is NOT real Android usage. It is demo data only.
 */
class ExpoDemoUsageProvider implements UsageProvider {
    readonly isAvailable = true;
    readonly isDemoMode = true;

    async hasPermission(): Promise<boolean> {
        return true; // Demo mode always has "permission"
    }

    async requestPermission(): Promise<void> {
        // No-op in demo mode
    }

    async getUsageForDate(packageName: string, date: string): Promise<number> {
        // Generate deterministic demo usage based on package name + date hash
        const seed = this.hashCode(packageName + date);
        const maxSeconds = 4 * 60 * 60; // 4 hours max
        const demoSeconds = Math.abs(seed % maxSeconds);
        return demoSeconds;
    }

    async getUsageForDateRange(
        packageName: string,
        startDate: string,
        endDate: string
    ): Promise<Record<string, number>> {
        const result: Record<string, number> = {};
        const start = new Date(startDate);
        const end = new Date(endDate);
        const current = new Date(start);

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            result[dateStr] = await this.getUsageForDate(packageName, dateStr);
            current.setDate(current.getDate() + 1);
        }
        return result;
    }

    async getAllUsageForDate(date: string): Promise<Record<string, number>> {
        const result: Record<string, number> = {};
        for (const app of DEMO_APPS) {
            result[app.packageName] = await this.getUsageForDate(app.packageName, date);
        }
        return result;
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

export const demoUsageProvider = new ExpoDemoUsageProvider();

/**
 * Try to load the native usage provider.
 * Falls back to demo provider if native module is unavailable (Expo Go).
 */
let _usageProvider: UsageProvider | null = null;

export async function getUsageProvider(): Promise<UsageProvider> {
    if (_usageProvider) return _usageProvider;

    try {
        // Attempt to import native module — will fail in Expo Go
        const NativeModule = await import('../providers/nativeUsageProvider').catch(() => null);
        if (NativeModule?.nativeUsageProvider) {
            _usageProvider = NativeModule.nativeUsageProvider;
        } else {
            _usageProvider = demoUsageProvider;
        }
    } catch {
        _usageProvider = demoUsageProvider;
    }

    return _usageProvider;
}
