import Constants, { AppOwnership } from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, NativeModules, Platform, TurboModuleRegistry } from 'react-native';

interface NativeBlockerModule {
    syncConfig: (configJson: string) => void;
    getUsageToday: () => Promise<string>;
    getInstalledApps: () => Promise<string>;
    getAppIcon: (packageName: string) => Promise<string>;
    getAppIcons: (packageNamesJson: string) => Promise<string>;
    openApkInstaller: (uri: string) => Promise<string>;
    isAccessibilityEnabled: () => Promise<boolean>;
    openAccessibilitySettings: () => void;
    isUsageAccessEnabled: () => Promise<boolean>;
    openUsageAccessSettings: () => void;
    openAppSettings: () => void;
}

function resolveNativeModule(): NativeBlockerModule | undefined {
    if (Platform.OS !== 'android') return undefined;

    const legacy = (
        NativeModules.FocusNoBlocker ?? NativeModules.FocusOnBlocker
    ) as NativeBlockerModule | undefined;
    if (legacy) return legacy;

    for (const name of ['FocusNoBlocker', 'FocusOnBlocker']) {
        try {
            const module = TurboModuleRegistry.get(name);
            if (module) return module as unknown as NativeBlockerModule;
        } catch {
            // Try the previous module name for builds made before the rename.
        }
    }
    return undefined;
}

// Resolve lazily on each call instead of once at import time. In a bridgeless /
// New Architecture build the native module registry may not be ready when this
// JS module is first evaluated, and caching `undefined` there would make every
// native call silently fall back forever.
let resolvedNative: NativeBlockerModule | null = null;

function getNative(): NativeBlockerModule | undefined {
    if (resolvedNative) return resolvedNative;
    resolvedNative = resolveNativeModule() ?? null;
    return resolvedNative ?? undefined;
}

/** True only in a native Android build that includes the FocusNo blocker. */
export function isBlockerSupported(): boolean {
    return !!getNative();
}

/** True when the JS is running inside the Expo Go client. */
export const isExpoGoClient = Constants.appOwnership === AppOwnership.Expo;

export const runtimeEnvironment = Constants.executionEnvironment;

const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.dikiaa.focusno';

async function launchAndroidSettings(
    action: IntentLauncher.ActivityAction,
    params?: IntentLauncher.IntentLauncherParams
): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
        await IntentLauncher.startActivityAsync(action, params);
    } catch {
        try {
            await Linking.openSettings();
        } catch {
            // Nothing else we can open.
        }
    }
}



export interface BlockerConfigPayload {
    /** package names that are fully blocked */
    blocked: string[];
    /** package name -> daily limit in minutes */
    limits: Record<string, number>;
    /** package name -> seconds used today (used to seed the native counter) */
    usage: Record<string, number>;
}

/**
 * Push the current rules to the Android accessibility service. Safe to call in
 * Expo Go / iOS - it simply does nothing there.
 */
export function syncBlockerConfig(payload: BlockerConfigPayload): void {
    const native = getNative();
    if (!native) return;
    try {
        native.syncConfig(JSON.stringify(payload));
    } catch {
        // Bridge not ready yet or service unavailable.
    }
}

export interface InstalledAppInfo {
    packageName: string;
    appName: string;
}

/**
 * Read every launchable app installed on the device. Returns an empty array in
 * Expo Go / iOS or if the native module is unavailable.
 */
export async function getNativeInstalledApps(): Promise<InstalledAppInfo[]> {
    const native = getNative();
    if (!native || typeof native.getInstalledApps !== 'function') return [];
    try {
        const raw = await native.getInstalledApps();
        const parsed = JSON.parse(raw) as { packageName?: string; appName?: string }[];
        return parsed
            .filter((a): a is { packageName: string; appName?: string } => !!a?.packageName)
            .map((a) => ({ packageName: a.packageName, appName: a.appName ?? a.packageName }));
    } catch {
        return [];
    }
}

/**
 * Returns the real launcher icon (base64 PNG data URI) for an installed app.
 * Returns null when unavailable (Expo Go / iOS / unknown package).
 */
export async function getNativeAppIcon(packageName: string): Promise<string | null> {
    const native = getNative();
    if (!native || typeof native.getAppIcon !== 'function') return null;
    try {
        const icon = await native.getAppIcon(packageName);
        return icon && icon.length > 0 ? icon : null;
    } catch {
        return null;
    }
}

/**
 * Loads many launcher icons in a single native call. Returns a map of
 * packageName -> data URI for the icons that could be read.
 */
export async function getNativeAppIcons(
    packageNames: string[]
): Promise<Record<string, string>> {
    const native = getNative();
    if (!native || typeof native.getAppIcons !== 'function' || packageNames.length === 0) {
        return {};
    }
    try {
        const raw = await native.getAppIcons(JSON.stringify(packageNames));
        return JSON.parse(raw) as Record<string, string>;
    } catch {
        return {};
    }
}

export async function openNativeApkInstaller(uri: string): Promise<'opened' | 'permission_required'> {
    const native = getNative();
    if (!native || typeof native.openApkInstaller !== 'function') {
        throw new Error('APK installation requires the installed Android app.');
    }
    let result: string;
    try {
        result = await native.openApkInstaller(uri);
    } catch (error) {
        throw new Error('Android could not open this APK for installation.', { cause: error });
    }
    if (result !== 'opened' && result !== 'permission_required') {
        throw new Error('Android returned an unexpected APK installer result.');
    }
    return result;
}

export async function getNativeUsageToday(): Promise<Record<string, number>> {
    const native = getNative();
    if (!native) return {};
    try {
        return JSON.parse(await native.getUsageToday()) as Record<string, number>;
    } catch {
        return {};
    }
}

export async function isAccessibilityEnabled(): Promise<boolean> {
    const native = getNative();
    if (!native) return false;
    try {
        return await native.isAccessibilityEnabled();
    } catch {
        return false;
    }
}

export function openAccessibilitySettings(): void {
    const native = getNative();
    if (native) {
        native.openAccessibilitySettings();
        return;
    }
    void launchAndroidSettings(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS);
}

export async function isUsageAccessEnabled(): Promise<boolean> {
    const native = getNative();
    if (!native) return false;
    try {
        return await native.isUsageAccessEnabled();
    } catch {
        return false;
    }
}

export function openUsageAccessSettings(): void {
    const native = getNative();
    if (native) {
        native.openUsageAccessSettings();
        return;
    }
    void launchAndroidSettings(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
}

export function openAppSettings(): void {
    const native = getNative();
    if (native) {
        native.openAppSettings();
        return;
    }
    if (Platform.OS === 'android') {
        void launchAndroidSettings(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
            data: `package:${ANDROID_PACKAGE}`,
        });
        return;
    }
    void Linking.openSettings();
}
