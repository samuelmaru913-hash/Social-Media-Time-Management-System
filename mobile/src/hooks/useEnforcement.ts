/**
 * useEnforcement.ts
 *
 * Global enforcement hook. Mount ONCE inside (tabs)/_layout.tsx.
 *
 * What it does:
 *  1. On mount  — restores persisted enforcement state from AsyncStorage
 *  2. On mount + every 60 s — polls the backend API and re-syncs blocked/limited/usage
 *  3. On AppState 'active' — immediate re-sync when user comes back to the app
 *
 * `checkApp(packageName, appName)` — call this from any screen to immediately
 *  test whether a specific app is currently restricted. If it is, the blocking
 *  screen is shown and the function returns true.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { applicationsApi, limitsApi, usageApi } from '../api/endpoints';
import { useEnforcementStore } from '../providers/enforcementStore';
import { formatDuration } from '../utils/usageCalculations';
import { syncBlockerConfig } from '../native/blocker';
import type { TrackedApplication, DailyLimit } from '../types';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export function useEnforcement() {
    const { restore, syncFromApi, isAppRestricted } = useEnforcementStore();
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus | null>((AppState.currentState as AppStateStatus) ?? 'active');

    // ── Push current rules to the native blocker ──────────────────────────────
    // The Android accessibility service reads these rules even when the JS app
    // is closed, which is what makes blocking "automatic" on the phone.
    const pushConfigToNative = useCallback(() => {
        const s = useEnforcementStore.getState();
        const limits: Record<string, number> = {};
        for (const [pkg, entry] of s.limitedApps) limits[pkg] = entry.limitMinutes;
        const usage: Record<string, number> = {};
        for (const [pkg, secs] of s.usageToday) usage[pkg] = secs;
        syncBlockerConfig({ blocked: [...s.blockedApps], limits, usage });
    }, []);

    // ── Sync from API ──────────────────────────────────────────────────────────
    const syncNow = useCallback(async () => {
        try {
            const [appsRes, limitsRes, todayRes] = await Promise.allSettled([
                applicationsApi.list(),
                limitsApi.list(),
                usageApi.getToday(),
            ]);

            const apps: TrackedApplication[] = appsRes.status === 'fulfilled' ? appsRes.value.data : [];
            const limits: DailyLimit[] = limitsRes.status === 'fulfilled' ? limitsRes.value.data : [];
            const today = todayRes.status === 'fulfilled' ? todayRes.value.data : { usage: [] };

            // Build appId → packageName map
            const pkgById: Record<string, string> = {};
            for (const app of apps) pkgById[app.id] = app.packageName;

            // Build appId → seconds-used-today map
            const usageMap: Record<string, number> = {};
            if (today?.usage) {
                for (const u of today.usage as Array<{ trackedApplicationId: string; usageDurationSeconds: number }>) {
                    usageMap[u.trackedApplicationId] =
                        (usageMap[u.trackedApplicationId] ?? 0) + u.usageDurationSeconds;
                }
            }

            await syncFromApi({
                apps: apps.map((a) => ({
                    id: a.id,
                    packageName: a.packageName,
                    applicationName: a.applicationName,
                    isEnabled: a.isEnabled,
                })),
                limits: limits.map((l) => ({
                    trackedApplicationId: l.trackedApplicationId,
                    limitMinutes: l.limitMinutes,
                    isEnabled: l.isEnabled,
                })),
                usageMap,
                pkgById,
            });
            pushConfigToNative();
        } catch {
            // Network unavailable — keep using cached state
        }
    }, [syncFromApi, pushConfigToNative]);

    // ── Boot ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        (async () => {
            await restore();           // load cache first (instant)
            pushConfigToNative();      // make cached rules active immediately
            if (mounted) syncNow();    // then refresh from API
        })();

        // Poll every 60 s
        pollTimer.current = setInterval(() => { if (mounted) syncNow(); }, POLL_INTERVAL_MS);

        // Listen for app coming to foreground
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (appStateRef.current?.match(/inactive|background/) && next === 'active') {
                if (mounted) syncNow();
            }
            appStateRef.current = next;
        });

        return () => {
            mounted = false;
            if (pollTimer.current) clearInterval(pollTimer.current);
            sub.remove();
        };
    }, [restore, syncNow, pushConfigToNative]);

    // Keep the native rules in sync when the user toggles blocks/limits in the UI.
    useEffect(() => {
        return useEnforcementStore.subscribe(() => pushConfigToNative());
    }, [pushConfigToNative]);

    // ── Public API ─────────────────────────────────────────────────────────────
    /**
     * Check if a given app is restricted RIGHT NOW.
     * If it is, navigate to the block screen and return true.
     * If not, return false (caller can proceed as normal).
     */
    const checkApp = useCallback(
        (packageName: string, appName: string): boolean => {
            const result = isAppRestricted(packageName);

            if (!result.restricted) return false;

            if (result.reason === 'blocked') {
                router.push({
                    pathname: '/limit-reached',
                    params: { appName, packageName, mode: 'blocked' },
                });
                return true;
            }

            if (result.reason === 'limit_exceeded') {
                const usedLabel = formatDuration(result.usedSec ?? 0);
                const limitLabel = `${result.limitMin}m`;
                router.push({
                    pathname: '/limit-reached',
                    params: { appName, packageName, usedLabel, limitLabel, mode: 'limit' },
                });
                return true;
            }

            return false;
        },
        [isAppRestricted]
    );

    return { checkApp, syncNow };
}
