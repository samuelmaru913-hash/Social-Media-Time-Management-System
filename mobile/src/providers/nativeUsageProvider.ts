import { UsageProvider } from '../types';

/**
 * Native Android usage provider stub.
 * This file is the interface point for the native Kotlin module.
 * It will only work in a native development build (not Expo Go).
 *
 * In a full native build, replace the try/catch body with:
 *   import { ExpoUsageStats } from '../../../modules/expo-usage-stats';
 * and delegate all calls to the native module.
 */
class NativeAndroidUsageProvider implements UsageProvider {
    readonly isAvailable = false;
    readonly isDemoMode = false;

    async hasPermission(): Promise<boolean> {
        // Native module would call ExpoUsageStats.hasUsageStatsPermission()
        return false;
    }

    async requestPermission(): Promise<void> {
        // Native module would call ExpoUsageStats.requestUsageStatsPermission()
        throw new Error('Native module not available in Expo Go. Use a development build.');
    }

    async getUsageForDate(_packageName: string, _date: string): Promise<number> {
        throw new Error('Native UsageStatsManager not available in Expo Go.');
    }

    async getUsageForDateRange(
        _packageName: string,
        _startDate: string,
        _endDate: string
    ): Promise<Record<string, number>> {
        throw new Error('Native UsageStatsManager not available in Expo Go.');
    }

    async getAllUsageForDate(_date: string): Promise<Record<string, number>> {
        throw new Error('Native UsageStatsManager not available in Expo Go.');
    }
}

export const nativeUsageProvider = new NativeAndroidUsageProvider();
