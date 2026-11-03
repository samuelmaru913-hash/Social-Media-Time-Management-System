/**
 * installedAppsScanner.ts
 *
 * Reads the REAL apps installed on the Android device via the app's own
 * FocusNoBlocker native module (PackageManager). There is no hardcoded or
 * fake list: if the device apps cannot be read, the scan returns an empty
 * list plus a `reason` so the UI can explain what is wrong.
 *
 * The native bridge only exists in an installed Android build (EAS APK or a
 * local dev build). Expo Go and web cannot enumerate the app drawer.
 *
 * Empty/failed scans are never cached, so a transient failure does not leave
 * the list stuck empty.
 */

import { Platform } from 'react-native';
import { getNativeInstalledApps, isBlockerSupported } from '../native/blocker';

export interface ScannedApp {
    applicationName: string;
    packageName: string;
    /** brand emoji when known, otherwise empty */
    emoji: string;
    category: 'Social' | 'Video' | 'Messaging' | 'Gaming' | 'Shopping' | 'Other';
    color: string;
    /** true = read from the device PackageManager */
    detected: boolean;
}

export type ScanReason = 'ok' | 'not_android' | 'native_unavailable' | 'empty';

export interface InstalledAppsScan {
    apps: ScannedApp[];
    isNative: boolean;
    reason: ScanReason;
}

// Known apps only provide a nicer name/colour while the real icon loads.
const KNOWN_APPS: Record<
    string,
    { name: string; emoji: string; category: ScannedApp['category']; color: string }
> = {
    'com.facebook.katana': { name: 'Facebook', emoji: '📘', category: 'Social', color: '#1877F2' },
    'com.zhiliaoapp.musically': { name: 'TikTok', emoji: '🎵', category: 'Video', color: '#EE1D52' },
    'com.instagram.android': { name: 'Instagram', emoji: '📷', category: 'Social', color: '#E1306C' },
    'com.google.android.youtube': { name: 'YouTube', emoji: '▶️', category: 'Video', color: '#FF0000' },
    'org.telegram.messenger': { name: 'Telegram', emoji: '✈️', category: 'Messaging', color: '#2AABEE' },
    'com.whatsapp': { name: 'WhatsApp', emoji: '💬', category: 'Messaging', color: '#25D366' },
    'com.snapchat.android': { name: 'Snapchat', emoji: '👻', category: 'Social', color: '#FFFC00' },
    'com.twitter.android': { name: 'X (Twitter)', emoji: '🐦', category: 'Social', color: '#1DA1F2' },
    'com.reddit.frontpage': { name: 'Reddit', emoji: '👽', category: 'Social', color: '#FF4500' },
    'com.google.android.apps.youtube.music': { name: 'YouTube Music', emoji: '🎧', category: 'Video', color: '#FF0000' },
};

const FALLBACK_COLORS = [
    '#4C6FFF', '#7C4DFF', '#009688', '#FF7043', '#26A69A',
    '#AB47BC', '#42A5F5', '#EF5350', '#66BB6A', '#FFA726',
];
function colorForPackage(pkg: string): string {
    let hash = 0;
    for (let i = 0; i < pkg.length; i++) hash = (hash * 31 + pkg.charCodeAt(i)) | 0;
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function toScannedApp(packageName: string, appName?: string, detected = true): ScannedApp {
    const known = KNOWN_APPS[packageName];
    return {
        applicationName: appName?.trim() || known?.name || packageName,
        packageName,
        emoji: known?.emoji ?? '',
        category: known?.category ?? 'Other',
        color: known?.color ?? colorForPackage(packageName),
        detected,
    };
}

// The launcher list rarely changes while the app is open, so a successful scan
// is reused. This makes opening the app picker again instant.
let cachedScan: InstalledAppsScan | null = null;
let inFlightScan: Promise<InstalledAppsScan> | null = null;

/**
 * Scan the device for genuinely installed apps.
 * Pass { forceRefresh: true } to bypass the cache.
 */
export async function scanInstalledApps(
    options: { forceRefresh?: boolean } = {}
): Promise<InstalledAppsScan> {
    if (Platform.OS !== 'android') {
        return { apps: [], isNative: false, reason: 'not_android' };
    }

    if (!options.forceRefresh) {
        if (cachedScan) return cachedScan;
        if (inFlightScan) return inFlightScan;
    }

    const run = (async (): Promise<InstalledAppsScan> => {
        if (!isBlockerSupported()) {
            return { apps: [], isNative: false, reason: 'native_unavailable' };
        }

        const installed = await getNativeInstalledApps();
        if (installed.length === 0) {
            return { apps: [], isNative: false, reason: 'empty' };
        }

        const unique = new Map<string, ScannedApp>();
        for (const a of installed) {
            unique.set(a.packageName, toScannedApp(a.packageName, a.appName));
        }

        const apps = [...unique.values()].sort((a, b) =>
            a.applicationName.localeCompare(b.applicationName, undefined, {
                sensitivity: 'base',
            })
        );
        return { apps, isNative: true, reason: 'ok' };
    })().then((result) => {
        // Only cache successful, non-empty device scans. Failures retry next time.
        if (result.isNative) cachedScan = result;
        inFlightScan = null;
        return result;
    });

    inFlightScan = run;
    return run;
}

/** Forget the cached launcher-app list (e.g. after an install/uninstall). */
export function invalidateInstalledAppsCache(): void {
    cachedScan = null;
    inFlightScan = null;
}
