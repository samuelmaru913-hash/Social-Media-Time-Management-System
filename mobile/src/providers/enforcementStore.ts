/**
 * enforcementStore.ts
 *
 * Zustand store + AsyncStorage cache for the enforcement engine.
 *
 * - `blockedApps`   : Set of packageNames that are FULLY BLOCKED (isEnabled=false)
 * - `limitedApps`   : Map of packageName → limitMinutes for time-limited apps
 * - `usageToday`    : Map of packageName → seconds used today (refreshed from API)
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncBlockerConfig } from '../native/blocker';

const STORAGE_KEY = 'focusno_enforcement_state';

interface LimitEntry {
    limitMinutes: number;
    appId: string;
    appName: string;
}

interface EnforcementState {
    blockedApps: Set<string>;
    limitedApps: Map<string, LimitEntry>;
    usageToday: Map<string, number>;
    lastSyncAt: number;

    syncFromApi: (params: {
        apps: Array<{ id: string; packageName: string; applicationName: string; isEnabled: boolean }>;
        limits: Array<{ trackedApplicationId: string; limitMinutes: number; isEnabled: boolean }>;
        usageMap: Record<string, number>;
        pkgById: Record<string, string>;
    }) => Promise<void>;

    setBlocked: (packageName: string, blocked: boolean) => void;
    setLimit: (packageName: string, entry: LimitEntry | null) => void;
    removeApp: (packageName: string) => void;

    isAppRestricted: (packageName: string) => { restricted: boolean; reason: 'blocked' | 'limit_exceeded' | 'none'; limitMin?: number; usedSec?: number };

    restore: () => Promise<void>;
}

// Serialisable snapshot stored in AsyncStorage
interface StoredSnapshot {
    blockedApps: string[];
    limitedApps: [string, LimitEntry][];
    usageToday: [string, number][];
    lastSyncAt: number;
}

function getCurrentState() {
    return useEnforcementStore.getState();
}

function pushToNative(state: {
    blockedApps?: Set<string>;
    limitedApps?: Map<string, LimitEntry>;
    usageToday?: Map<string, number>;
}) {
    try {
        const current = getCurrentState();
        const blocked = state.blockedApps ?? current.blockedApps;
        const limited = state.limitedApps ?? current.limitedApps;
        const usage = state.usageToday ?? current.usageToday;
        const limits: Record<string, number> = {};
        for (const [pkg, entry] of limited) limits[pkg] = entry.limitMinutes;
        const usageMap: Record<string, number> = {};
        for (const [pkg, secs] of usage) usageMap[pkg] = secs;
        syncBlockerConfig({ blocked: [...blocked], limits, usage: usageMap });
    } catch {
        // ignore
    }
}

export const useEnforcementStore = create<EnforcementState>((set, get) => ({
    blockedApps: new Set(),
    limitedApps: new Map(),
    usageToday: new Map(),
    lastSyncAt: 0,

    syncFromApi: async ({ apps, limits, usageMap, pkgById }) => {
        const blocked = new Set<string>();
        const limited = new Map<string, LimitEntry>();
        const usage = new Map<string, number>();

        for (const app of apps) {
            if (!app.isEnabled) blocked.add(app.packageName);
        }

        for (const l of limits) {
            if (!l.isEnabled) continue;
            const pkg = pkgById[l.trackedApplicationId];
            if (!pkg) continue;
            const app = apps.find((a) => a.id === l.trackedApplicationId);
            limited.set(pkg, {
                limitMinutes: l.limitMinutes,
                appId: l.trackedApplicationId,
                appName: app?.applicationName ?? pkg,
            });
        }

        for (const [appId, secs] of Object.entries(usageMap)) {
            const pkg = pkgById[appId];
            if (pkg) usage.set(pkg, secs as number);
        }

        const now = Date.now();
        set({ blockedApps: blocked, limitedApps: limited, usageToday: usage, lastSyncAt: now });
        pushToNative({ blockedApps: blocked, limitedApps: limited, usageToday: usage });

        const snap: StoredSnapshot = {
            blockedApps: [...blocked],
            limitedApps: [...limited.entries()],
            usageToday: [...usage.entries()],
            lastSyncAt: now,
        };
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
        } catch {
            // ignore
        }
    },

    setBlocked: (packageName, blocked) => {
        const s = get();
        const next = new Set(s.blockedApps);
        if (blocked) next.add(packageName);
        else next.delete(packageName);
        set({ blockedApps: next });
        pushToNative({ blockedApps: next });
        persistSnapshot({ ...get(), blockedApps: next });
    },

    setLimit: (packageName, entry) => {
        const s = get();
        const next = new Map(s.limitedApps);
        if (entry) next.set(packageName, entry);
        else next.delete(packageName);
        set({ limitedApps: next });
        pushToNative({ limitedApps: next });
        persistSnapshot({ ...get(), limitedApps: next });
    },

    removeApp: (packageName) => {
        const s = get();
        const nextBlocked = new Set(s.blockedApps);
        const nextLimited = new Map(s.limitedApps);
        const nextUsage = new Map(s.usageToday);
        nextBlocked.delete(packageName);
        nextLimited.delete(packageName);
        nextUsage.delete(packageName);
        set({ blockedApps: nextBlocked, limitedApps: nextLimited, usageToday: nextUsage });
        pushToNative({ blockedApps: nextBlocked, limitedApps: nextLimited, usageToday: nextUsage });
        persistSnapshot({ ...get(), blockedApps: nextBlocked, limitedApps: nextLimited, usageToday: nextUsage });
    },

    isAppRestricted: (packageName) => {
        const { blockedApps, limitedApps, usageToday } = get();

        if (blockedApps.has(packageName)) {
            return { restricted: true, reason: 'blocked' };
        }

        const limitEntry = limitedApps.get(packageName);
        if (limitEntry) {
            const usedSec = usageToday.get(packageName) ?? 0;
            const limitSec = limitEntry.limitMinutes * 60;
            if (usedSec >= limitSec) {
                return { restricted: true, reason: 'limit_exceeded', limitMin: limitEntry.limitMinutes, usedSec };
            }
        }

        return { restricted: false, reason: 'none' };
    },

    restore: async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const snap = JSON.parse(raw) as StoredSnapshot;

            const storedDate = new Date(snap.lastSyncAt);
            const now = new Date();
            const isSameDay =
                storedDate.getFullYear() === now.getFullYear() &&
                storedDate.getMonth() === now.getMonth() &&
                storedDate.getDate() === now.getDate();

            const blockedApps = new Set(snap.blockedApps);
            const limitedApps = new Map(snap.limitedApps);
            const usageToday = isSameDay ? new Map(snap.usageToday) : new Map();

            set({
                blockedApps,
                limitedApps,
                usageToday,
                lastSyncAt: snap.lastSyncAt,
            });
            pushToNative({ blockedApps, limitedApps, usageToday });
        } catch {
            // corrupt storage — ignore
        }
    },
}));

async function persistSnapshot(state: Partial<EnforcementState>) {
    try {
        const snap: StoredSnapshot = {
            blockedApps: [...(state.blockedApps ?? new Set())],
            limitedApps: [...(state.limitedApps ?? new Map()).entries()],
            usageToday: [...(state.usageToday ?? new Map()).entries()],
            lastSyncAt: state.lastSyncAt ?? Date.now(),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch {
        // best-effort
    }
}
