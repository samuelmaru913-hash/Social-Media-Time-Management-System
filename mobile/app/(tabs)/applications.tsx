/**
 * applications.tsx — Monitored Apps Screen
 *
 * Preserves the original design:
 *  - Dark navy background (#0D1B3E)
 *  - "Monitored Apps" card with "X active" counter
 *  - "No apps tracked yet." empty state
 *  - Blue "+ Add App to Monitor" button
 *
 * New functionality:
 *  - "+ Add App to Monitor" opens a bottom-sheet app picker
 *  - Lists every launchable app in the phone's app drawer with its
 *    real launcher icon (read via the native PackageManager) and
 *    supports search; the list + icons are cached for instant re-open
 *  - Checkbox selection, multi-select, Add / Cancel
 *  - Saves to backend, prevents duplicates
 *  - Replaces empty-state with registered app cards
 *  - Each card: icon, name, daily limit, usage, remaining, status, remove
 */

import {
    ScrollView, View, Text, StyleSheet, TouchableOpacity,
    SafeAreaView, Alert, Modal, ActivityIndicator, AppState, Platform,
    RefreshControl, FlatList, TextInput,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { formatDuration } from '../../src/utils/usageCalculations';
import { Sidebar } from '../../src/components/Sidebar';
import { AppIcon, prefetchAppIcons } from '../../src/components/AppIcon';
import { applicationsApi, limitsApi, usageApi } from '../../src/api/endpoints';
import { useEnforcementContext } from './_layout';
import { useEnforcementStore } from '../../src/providers/enforcementStore';
import {
    scanInstalledApps,
    ScannedApp,
    ScanReason,
} from '../../src/utils/installedAppsScanner';
import {
    isAccessibilityEnabled,
    isBlockerSupported,
    getNativeUsageToday,
    openNativeApkInstaller,
} from '../../src/native/blocker';
import type { TrackedApplication, DailyLimit } from '../../src/types';
import * as Device from 'expo-device';
import * as DocumentPicker from 'expo-document-picker';

// ── The 8 officially supported social media apps ──────────────────────────────
const SUPPORTED_APPS: Array<{
    applicationName: string;
    packageName: string;
    emoji: string;
    color: string;
    brandColor: string;
}> = [
        { applicationName: 'Facebook', packageName: 'com.facebook.katana', emoji: '📘', color: '#1877F2', brandColor: '#1877F2' },
        { applicationName: 'TikTok', packageName: 'com.zhiliaoapp.musically', emoji: '🎵', color: '#010101', brandColor: '#EE1D52' },
        { applicationName: 'Instagram', packageName: 'com.instagram.android', emoji: '📷', color: '#E1306C', brandColor: '#E1306C' },
        { applicationName: 'YouTube', packageName: 'com.google.android.youtube', emoji: '▶️', color: '#FF0000', brandColor: '#FF0000' },
        { applicationName: 'Telegram', packageName: 'org.telegram.messenger', emoji: '✈️', color: '#2AABEE', brandColor: '#2AABEE' },
        { applicationName: 'WhatsApp', packageName: 'com.whatsapp', emoji: '💬', color: '#25D366', brandColor: '#25D366' },
        { applicationName: 'Snapchat', packageName: 'com.snapchat.android', emoji: '👻', color: '#FFFC00', brandColor: '#FFFC00' },
        { applicationName: 'X (Twitter)', packageName: 'com.twitter.android', emoji: '🐦', color: '#1DA1F2', brandColor: '#1DA1F2' },
    ];

function getSupportedMeta(pkg: string) {
    return SUPPORTED_APPS.find((a) => a.packageName === pkg);
}

// ── App-card data type ────────────────────────────────────────────────────────
interface AppWithLimit {
    app: TrackedApplication;
    limit?: DailyLimit;
    usedSec: number;
    isBlocked: boolean;
}

const LIMIT_PRESETS = [15, 30, 60, 120, 180];

// ─────────────────────────────────────────────────────────────────────────────
export default function ApplicationsScreen() {
    const [items, setItems] = useState<AppWithLimit[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const enforcementSetBlocked = useEnforcementStore((s) => s.setBlocked);
    const enforcementSetLimit = useEnforcementStore((s) => s.setLimit);
    const enforcementRemoveApp = useEnforcementStore((s) => s.removeApp);
    const { syncNow } = useEnforcementContext();

    // Add-App modal
    const [modalVisible, setModalVisible] = useState(false);
    const [scanLoading, setScanLoading] = useState(false);
    const [availableApps, setAvailableApps] = useState<ScannedApp[]>([]);
    const [appSearch, setAppSearch] = useState('');
    const [isNativeScan, setIsNativeScan] = useState(false);
    const [scanReason, setScanReason] = useState<ScanReason | null>(null);
    const [selectedPkgs, setSelectedPkgs] = useState<Set<string>>(new Set());
    const [limitMin, setLimitMin] = useState(60);
    const [addLoading, setAddLoading] = useState(false);
    const [apkInstallPending, setApkInstallPending] = useState(false);

    // Edit-limit modal
    const [editItem, setEditItem] = useState<AppWithLimit | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editLimitMin, setEditLimitMin] = useState(60);
    const [editSaving, setEditSaving] = useState(false);

    // Saving / deleting state
    const [savingId, setSavingId] = useState<string | null>(null);

    // Native blocking service status
    const [protection, setProtection] = useState<{ supported: boolean; enabled: boolean } | null>(null);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            (async () => {
                const enabled = await isAccessibilityEnabled();
                if (active) setProtection({ supported: isBlockerSupported(), enabled });
            })();
            return () => { active = false; };
        }, [])
    );

    // ── Load data ──────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        try {
            const [appsRes, limitsRes, todayRes] = await Promise.allSettled([
                applicationsApi.list(),
                limitsApi.list(),
                usageApi.getToday(),
            ]);

            const apps: TrackedApplication[] =
                appsRes.status === 'fulfilled' ? appsRes.value.data : [];
            const limits: DailyLimit[] =
                limitsRes.status === 'fulfilled' ? limitsRes.value.data : [];
            const today =
                todayRes.status === 'fulfilled' ? todayRes.value.data : { usage: [] };
            const nativeUsage = await getNativeUsageToday();

            const usageMap: Record<string, number> = {};
            if (today?.usage) {
                for (const u of today.usage as Array<{
                    trackedApplicationId: string; usageDurationSeconds: number
                }>) {
                    usageMap[u.trackedApplicationId] =
                        (usageMap[u.trackedApplicationId] ?? 0) + u.usageDurationSeconds;
                }
            }

            setItems(
                apps.map((app) => ({
                    app,
                    limit: limits.find((l) => l.trackedApplicationId === app.id),
                    usedSec: Math.max(usageMap[app.id] ?? 0, nativeUsage[app.packageName] ?? 0),
                    isBlocked: !app.isEnabled,
                }))
            );
        } catch {
            Alert.alert('Error', 'Could not load applications. Check your connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    // ── Read the phone's app drawer, minus already-tracked apps ────────────────
    const loadAvailableApps = useCallback(async (forceRefresh = false) => {
        setScanLoading(true);
        try {
            const { apps, isNative, reason } = await scanInstalledApps({ forceRefresh });
            setIsNativeScan(isNative);
            setScanReason(reason);

            // Already-tracked package names (to avoid showing already-added apps)
            const trackedPkgs = new Set(items.map((i) => i.app.packageName));
            const available = apps.filter((a) => !trackedPkgs.has(a.packageName));

            setAvailableApps(available);

            // Load the first screenful of real launcher icons in one native call.
            void prefetchAppIcons(available.slice(0, 60).map((a) => a.packageName));
        } finally {
            setScanLoading(false);
        }
    }, [items]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && apkInstallPending && modalVisible) {
                setApkInstallPending(false);
                void loadAvailableApps(true);
            }
        });
        return () => subscription.remove();
    }, [apkInstallPending, loadAvailableApps, modalVisible]);

    const chooseApkFile = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Android only', 'Choosing and installing APK files is available on Android.');
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/vnd.android.package-archive',
                copyToCacheDirectory: false,
            });
            if (result.canceled) return;

            const apk = result.assets[0];
            if (!apk || !apk.name.toLowerCase().endsWith('.apk')) {
                Alert.alert('Invalid file', 'Choose an Android APK file (.apk).');
                return;
            }

            setApkInstallPending(true);
            const installResult = await openNativeApkInstaller(apk.uri);
            if (installResult === 'permission_required') {
                Alert.alert(
                    'Allow APK installation',
                    'Enable “Allow from this source” in Android settings, return here, and choose the APK again.'
                );
            }
        } catch (error) {
            setApkInstallPending(false);
            Alert.alert(
                'Could not open APK',
                error instanceof Error ? error.message : 'Android could not open this APK file.'
            );
        }
    };

    const openModal = useCallback(async () => {
        setModalVisible(true);
        setSelectedPkgs(new Set());
        setLimitMin(60);
        setAppSearch('');
        await loadAvailableApps();
    }, [loadAvailableApps]);

    const closeModal = () => {
        setModalVisible(false);
        setSelectedPkgs(new Set());
    };

    const toggleSelect = (pkg: string) => {
        setSelectedPkgs((prev) => {
            const next = new Set(prev);
            if (next.has(pkg)) next.delete(pkg);
            else next.add(pkg);
            return next;
        });
    };

    // ── Add selected apps to backend ───────────────────────────────────────────
    const handleAddSelected = async () => {
        if (selectedPkgs.size === 0) {
            Alert.alert('No Apps Selected', 'Please select at least one app.');
            return;
        }
        setAddLoading(true);

        const deviceId = Device.modelName ?? undefined;
        const trackedPkgs = new Set(items.map((i) => i.app.packageName));
        const toAdd = availableApps.filter(
            (a) => selectedPkgs.has(a.packageName) && !trackedPkgs.has(a.packageName)
        );

        let added = 0;
        let failed = 0;

        for (const a of toAdd) {
            try {
                const res = await applicationsApi.create({
                    applicationName: a.applicationName,
                    packageName: a.packageName,
                    deviceId,
                });
                const newApp = res.data;

                // Create default 60-min limit
                const lRes = await limitsApi.create({
                    trackedApplicationId: newApp.id,
                    limitMinutes: limitMin,
                    warningThreshold: 80,
                });
                enforcementSetLimit(a.packageName, {
                    limitMinutes: limitMin,
                    appId: newApp.id,
                    appName: a.applicationName,
                });
                setItems((prev) => [
                    ...prev,
                    { app: newApp, limit: lRes.data, usedSec: 0, isBlocked: false },
                ]);
                added++;
            } catch {
                failed++;
            }
        }

        setAddLoading(false);
        syncNow();
        closeModal();

        Alert.alert(
            added > 0 ? '✅ Apps Added' : '❌ Failed',
            added > 0
                ? `${added} app${added !== 1 ? 's' : ''} are now being monitored.${failed ? ` (${failed} failed)` : ''}`
                : `Could not add the selected apps. Please try again.`
        );
    };

    // ── Toggle block ───────────────────────────────────────────────────────────
    const toggleBlock = async (item: AppWithLimit) => {
        setSavingId(item.app.id);
        const nowBlocked = !item.isBlocked;
        enforcementSetBlocked(item.app.packageName, nowBlocked);
        try {
            await applicationsApi.update(item.app.id, { isEnabled: !nowBlocked });
            setItems((prev) =>
                prev.map((i) =>
                    i.app.id === item.app.id
                        ? { ...i, app: { ...i.app, isEnabled: !nowBlocked }, isBlocked: nowBlocked }
                        : i
                )
            );
        } catch {
            enforcementSetBlocked(item.app.packageName, !nowBlocked); // rollback
            Alert.alert('Error', 'Could not update block status.');
        } finally {
            setSavingId(null);
        }
    };

    // ── Delete app ────────────────────────────────────────────────────────────
    const deleteApp = (item: AppWithLimit) => {
        Alert.alert(
            'Remove App',
            `Remove ${item.app.applicationName} from monitoring?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        try {
                            await applicationsApi.delete(item.app.id);
                            enforcementRemoveApp(item.app.packageName);
                            setItems((prev) => prev.filter((i) => i.app.id !== item.app.id));
                        } catch {
                            Alert.alert('Error', 'Could not remove app.');
                        }
                    },
                },
            ]
        );
    };

    // ── Edit limit ────────────────────────────────────────────────────────────
    const openEditLimit = (item: AppWithLimit) => {
        setEditItem(item);
        setEditLimitMin(item.limit?.limitMinutes ?? 60);
        setEditModalVisible(true);
    };

    const saveEditLimit = async () => {
        if (!editItem) return;
        setEditSaving(true);
        try {
            if (editItem.limit) {
                await limitsApi.update(editItem.limit.id, { limitMinutes: editLimitMin });
            } else {
                await limitsApi.create({
                    trackedApplicationId: editItem.app.id,
                    limitMinutes: editLimitMin,
                    warningThreshold: 80,
                });
            }
            enforcementSetLimit(editItem.app.packageName, {
                limitMinutes: editLimitMin,
                appId: editItem.app.id,
                appName: editItem.app.applicationName,
            });
            setItems((prev) =>
                prev.map((i) =>
                    i.app.id === editItem.app.id
                        ? {
                            ...i,
                            limit: {
                                ...(i.limit ?? {
                                    id: '',
                                    userId: '',
                                    trackedApplicationId: i.app.id,
                                    warningThreshold: 80,
                                    isEnabled: true,
                                    createdAt: '',
                                    updatedAt: '',
                                    scheduleConfiguration: null,
                                }),
                                limitMinutes: editLimitMin,
                            },
                        }
                        : i
                )
            );
            setEditModalVisible(false);
        } catch {
            Alert.alert('Error', 'Could not save limit.');
        } finally {
            setEditSaving(false);
        }
    };

    const activeCount = items.filter((i) => !i.isBlocked).length;
    const visibleApps = useMemo(() => {
        const q = appSearch.trim().toLowerCase();
        if (!q) return availableApps;
        return availableApps.filter(
            (a) =>
                a.applicationName.toLowerCase().includes(q) ||
                a.packageName.toLowerCase().includes(q)
        );
    }, [appSearch, availableApps]);

    // Warm icons for whatever list is currently on screen so scrolling stays smooth.
    useEffect(() => {
        if (!modalVisible || visibleApps.length === 0) return;
        void prefetchAppIcons(visibleApps.slice(0, 60).map((a) => a.packageName));
    }, [modalVisible, visibleApps]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.burgerBtn}>
                    <View style={styles.hLine} />
                    <View style={[styles.hLine, { width: 18 }]} />
                    <View style={styles.hLine} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Applications</Text>
                <View style={styles.headerAvatar}>
                    <Text style={{ fontSize: 18 }}>👤</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {/* ── Native protection banner ── */}
                {protection && (!protection.supported || !protection.enabled) && (
                    <TouchableOpacity style={styles.protectionBanner} onPress={() => router.push('/blocking-setup')}>
                        <Text style={styles.protectionIcon}>🛡️</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.protectionTitle}>
                                {protection.supported ? 'Protection is off' : 'Blocking is not set up'}
                            </Text>
                            <Text style={styles.protectionSub}>
                                {protection.supported
                                    ? 'Tap to enable automatic app blocking'
                                    : 'Tap for install and permission steps'}
                            </Text>
                        </View>
                        <Text style={styles.protectionCta}>
                            {protection.supported ? 'Enable' : 'Set up'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* ── Monitored Apps card ── */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Monitored Apps</Text>
                        <Text style={styles.cardActive}>{activeCount} active</Text>
                    </View>

                    {loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.loadingText}>Loading apps…</Text>
                        </View>
                    ) : items.length === 0 ? (
                        /* ── Empty state (original design) ── */
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>📱</Text>
                            <Text style={styles.emptyTitle}>No apps tracked yet.</Text>
                            <Text style={styles.emptySubtext}>
                                Tap &apos;+ Add App&apos; below to start monitoring your app usage.
                            </Text>
                        </View>
                    ) : (
                        /* ── App cards ── */
                        items.map((item) => {
                            const meta = getSupportedMeta(item.app.packageName);
                            const appColor = meta?.brandColor ?? COLORS.primary;
                            const limitSecs = (item.limit?.limitMinutes ?? 60) * 60;
                            const pct = Math.min(100, (item.usedSec / limitSecs) * 100);
                            const barColor =
                                pct >= 100
                                    ? COLORS.accentRed
                                    : pct >= 80
                                        ? COLORS.accentOrange
                                        : COLORS.primary;
                            const remainingSec = Math.max(0, limitSecs - item.usedSec);

                            return (
                                <View key={item.app.id} style={styles.appCard}>
                                    {/* App icon */}
                                    <View style={[styles.appIconWrap, { borderColor: appColor + '55' }]}>
                                        <AppIcon
                                            packageName={item.app.packageName}
                                            label={item.app.applicationName}
                                            size={38}
                                            color={appColor}
                                        />
                                        {item.isBlocked && (
                                            <View style={styles.blockedBadge}>
                                                <Text style={{ fontSize: 10 }}>🚫</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.appInfo}>
                                        {/* Name + status badge */}
                                        <View style={styles.appTopRow}>
                                            <Text style={styles.appName}>{item.app.applicationName}</Text>
                                            {item.isBlocked ? (
                                                <View style={styles.badgeRed}>
                                                    <Text style={styles.badgeText}>Blocked</Text>
                                                </View>
                                            ) : pct >= 100 ? (
                                                <View style={styles.badgeOrange}>
                                                    <Text style={styles.badgeText}>Limit Reached</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.badgeGreen}>
                                                    <Text style={styles.badgeText}>
                                                        {item.app.monitoringStatus === 'PAUSED' ? 'Paused' : 'Monitoring'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Package name */}
                                        <Text style={styles.pkgName}>{item.app.packageName}</Text>

                                        {/* Usage row */}
                                        {!item.isBlocked && (
                                            <>
                                                <View style={styles.usageRow}>
                                                    <Text style={styles.usageLabel}>Daily limit</Text>
                                                    <Text style={styles.usageVal}>
                                                        {item.limit?.limitMinutes ?? 60}m
                                                    </Text>
                                                    <Text style={styles.usageDivider}>·</Text>
                                                    <Text style={styles.usageLabel}>Used</Text>
                                                    <Text
                                                        style={[
                                                            styles.usageVal,
                                                            { color: pct >= 100 ? COLORS.accentRed : COLORS.accentGreen },
                                                        ]}
                                                    >
                                                        {formatDuration(item.usedSec)}
                                                    </Text>
                                                    <Text style={styles.usageDivider}>·</Text>
                                                    <Text style={styles.usageLabel}>Remaining</Text>
                                                    <Text style={[styles.usageVal, { color: COLORS.accentCyan }]}>
                                                        {formatDuration(remainingSec)}
                                                    </Text>
                                                </View>

                                                {/* Progress bar */}
                                                <View style={styles.barTrack}>
                                                    <View
                                                        style={[
                                                            styles.barFill,
                                                            {
                                                                width: `${pct}%` as `${number}%`,
                                                                backgroundColor: barColor,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                            </>
                                        )}

                                        {/* Actions row */}
                                        <View style={styles.actionRow}>
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                onPress={() => openEditLimit(item)}
                                            >
                                                <Text style={styles.actionBtnText}>⏱ Limit</Text>
                                            </TouchableOpacity>
                                            {savingId === item.app.id ? (
                                                <ActivityIndicator size="small" color={COLORS.primary} style={{ flex: 1 }} />
                                            ) : (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.actionBtn,
                                                        item.isBlocked && { borderColor: COLORS.accentRed + '66' },
                                                    ]}
                                                    onPress={() => toggleBlock(item)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.actionBtnText,
                                                            item.isBlocked && { color: COLORS.accentRed },
                                                        ]}
                                                    >
                                                        {item.isBlocked ? '🔓 Unblock' : '🚫 Block'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { borderColor: COLORS.accentRed + '66' }]}
                                                onPress={() => deleteApp(item)}
                                            >
                                                <Text style={[styles.actionBtnText, { color: COLORS.accentRed }]}>
                                                    🗑 Remove
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* ── + Add App to Monitor button ── */}
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={openModal}
                    activeOpacity={0.85}
                >
                    <Text style={styles.addBtnText}>+ Add App to Monitor</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* ════════════════════════════════════════════════════════════════════
                SELECT SOCIAL MEDIA APPLICATIONS — Bottom Sheet
            ════════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>

                        {/* Handle bar */}
                        <View style={styles.handleBar} />

                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Select Applications</Text>
                                <Text style={styles.modalSubtitle}>
                                    {scanLoading
                                        ? 'Scanning device for installed apps…'
                                        : isNativeScan
                                            ? 'Showing apps installed on this device'
                                            : 'Real device apps only — no sample list'
                                    }
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => loadAvailableApps(true)}
                                style={styles.closeBtn}
                                disabled={scanLoading}
                                accessibilityLabel="Rescan installed apps"
                            >
                                <Text style={[styles.closeBtnText, scanLoading && { opacity: 0.4 }]}>↻</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                                <Text style={styles.closeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Scan status badge */}
                        {!scanLoading && (
                            <View style={[styles.scanBadge, isNativeScan ? styles.scanBadgeNative : styles.scanBadgeDemo]}>
                                <Text style={[styles.scanBadgeText, isNativeScan ? { color: COLORS.accentGreen } : { color: COLORS.accentOrange }]}>
                                    {isNativeScan
                                        ? '✅ Real device scan — showing apps installed on this phone'
                                        : scanReason === 'native_unavailable'
                                            ? '⚠️ Real app scan needs the installed Android APK. Expo Go / web cannot read your app drawer.'
                                            : scanReason === 'empty'
                                                ? '⚠️ No launchable apps were found on this device. Tap ↻ to rescan.'
                                                : scanReason === 'not_android'
                                                    ? '⚠️ Reading the app drawer is Android-only. Open the app on your phone.'
                                                    : '⚠️ Could not read installed apps.'
                                    }
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.apkPickerButton, scanLoading && { opacity: 0.6 }]}
                            onPress={chooseApkFile}
                            disabled={scanLoading}
                            accessibilityLabel="Choose an APK file to install"
                        >
                            <Text style={styles.apkPickerButtonText}>Choose APK from folder</Text>
                        </TouchableOpacity>
                        <Text style={styles.apkPickerHint}>
                            Android will ask you to confirm installation. Then select the app here and tap Add to monitor it.
                        </Text>

                        {/* Loading spinner */}
                        {scanLoading ? (
                            <View style={styles.scanningBox}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                                <Text style={styles.scanningText}>Reading installed apps from your device…</Text>
                            </View>
                        ) : availableApps.length === 0 ? (
                            <View style={styles.scanningBox}>
                                <Text style={{ fontSize: 40 }}>{isNativeScan ? '🎉' : '📵'}</Text>
                                <Text style={styles.scanningText}>
                                    {isNativeScan
                                        ? 'All installed apps are already being monitored!'
                                        : 'Could not read the apps installed on this phone. Install the FocusNo Android APK (not Expo Go) so the real device apps and icons can be loaded.'}
                                </Text>
                                {!isNativeScan && (
                                    <TouchableOpacity
                                        style={[styles.addSelectedBtn, { marginTop: 8, paddingHorizontal: 24 }]}
                                        onPress={() => { closeModal(); router.push('/blocking-setup'); }}
                                    >
                                        <Text style={styles.addSelectedBtnText}>Open setup steps</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <>
                                {/* Selection count bar */}
                                {selectedPkgs.size > 0 && (
                                    <View style={styles.selectionBar}>
                                        <Text style={styles.selectionText}>
                                            {selectedPkgs.size} app{selectedPkgs.size !== 1 ? 's' : ''} selected
                                        </Text>
                                        <TouchableOpacity onPress={() => setSelectedPkgs(new Set())}>
                                            <Text style={styles.selectionClear}>Clear all</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Search */}
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search apps…"
                                    placeholderTextColor={COLORS.textFaint}
                                    value={appSearch}
                                    onChangeText={setAppSearch}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />

                                {/* App list */}
                                <FlatList
                                    data={visibleApps}
                                    keyExtractor={(a) => a.packageName}
                                    style={styles.appList}
                                    showsVerticalScrollIndicator={false}
                                    initialNumToRender={12}
                                    maxToRenderPerBatch={12}
                                    windowSize={7}
                                    removeClippedSubviews
                                    keyboardShouldPersistTaps="handled"
                                    ItemSeparatorComponent={() => (
                                        <View style={{ height: 1, backgroundColor: COLORS.border }} />
                                    )}
                                    renderItem={({ item: a }) => {
                                        const selected = selectedPkgs.has(a.packageName);
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.appRow,
                                                    selected && styles.appRowSelected,
                                                ]}
                                                onPress={() => toggleSelect(a.packageName)}
                                                activeOpacity={0.7}
                                            >
                                                {/* App icon */}
                                                <View
                                                    style={[
                                                        styles.listAppIcon,
                                                        { borderColor: a.color + '55' },
                                                    ]}
                                                >
                                                    <AppIcon
                                                        packageName={a.packageName}
                                                        label={a.applicationName}
                                                        size={38}
                                                        color={a.color}
                                                    />
                                                </View>

                                                {/* App info */}
                                                <View style={styles.listAppInfo}>
                                                    <Text style={styles.listAppName}>
                                                        {a.applicationName}
                                                    </Text>
                                                    <Text style={styles.listAppPkg}>
                                                        {a.packageName}
                                                    </Text>
                                                </View>

                                                {/* Checkbox */}
                                                <View
                                                    style={[
                                                        styles.checkbox,
                                                        selected && styles.checkboxSelected,
                                                    ]}
                                                >
                                                    {selected && (
                                                        <Text style={styles.checkmark}>✓</Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />

                                {/* Daily limit preset */}
                                <View style={styles.presetSection}>
                                    <Text style={styles.presetLabel}>Initial Daily Limit</Text>
                                    <View style={styles.presetRow}>
                                        {LIMIT_PRESETS.map((p) => (
                                            <TouchableOpacity
                                                key={p}
                                                style={[styles.presetBtn, limitMin === p && styles.presetBtnActive]}
                                                onPress={() => setLimitMin(p)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.presetBtnText,
                                                        limitMin === p && styles.presetBtnTextActive,
                                                    ]}
                                                >
                                                    {p >= 60 ? `${p / 60}h` : `${p}m`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Action buttons */}
                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={closeModal}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.addSelectedBtn,
                                            selectedPkgs.size === 0 && styles.addSelectedBtnDisabled,
                                            addLoading && { opacity: 0.7 },
                                        ]}
                                        onPress={handleAddSelected}
                                        disabled={selectedPkgs.size === 0 || addLoading}
                                    >
                                        {addLoading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.addSelectedBtnText}>
                                                Add Selected App{selectedPkgs.size !== 1 ? 's' : ''}
                                                {selectedPkgs.size > 0 ? ` (${selectedPkgs.size})` : ''}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════════════════════════════════════════
                EDIT DAILY LIMIT — Modal
            ════════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={editModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, { borderRadius: BORDER_RADIUS.lg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>⏱ Edit Daily Limit</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                                <Text style={styles.closeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {editItem && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <AppIcon
                                    packageName={editItem.app.packageName}
                                    label={editItem.app.applicationName}
                                    size={22}
                                    color={getSupportedMeta(editItem.app.packageName)?.brandColor ?? COLORS.primary}
                                />
                                <Text style={styles.editAppName}>
                                    {editItem.app.applicationName}
                                </Text>
                            </View>
                        )}
                        <View style={styles.presetRow}>
                            {LIMIT_PRESETS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.presetBtn, editLimitMin === p && styles.presetBtnActive]}
                                    onPress={() => setEditLimitMin(p)}
                                >
                                    <Text
                                        style={[
                                            styles.presetBtnText,
                                            editLimitMin === p && styles.presetBtnTextActive,
                                        ]}
                                    >
                                        {p >= 60 ? `${p / 60}h` : `${p}m`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.limitNote}>
                            App will be blocked after {editLimitMin >= 60 ? `${editLimitMin / 60}h` : `${editLimitMin}m`} of daily use.
                        </Text>
                        <TouchableOpacity
                            style={[styles.addSelectedBtn, editSaving && { opacity: 0.7 }]}
                            onPress={saveEditLimit}
                            disabled={editSaving}
                        >
                            {editSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.addSelectedBtnText}>✅ Save Limit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeScreen="applications" />
        </SafeAreaView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md, paddingTop: SPACING.lg,
    },
    burgerBtn: { gap: 5, padding: 4 },
    hLine: { width: 22, height: 2.5, backgroundColor: COLORS.textWhite, borderRadius: 2 },
    headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textWhite },
    headerAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
    },

    // Scroll content
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 48 },

    // Monitored Apps card
    card: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1, borderColor: COLORS.border,
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: SPACING.md,
    },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },
    cardActive: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: '600' },

    // Empty state
    centerBox: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
    loadingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
    emptyBox: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
    emptyIcon: { fontSize: 44 },
    emptyTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite },
    emptySubtext: {
        fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
        textAlign: 'center', lineHeight: 18,
    },

    // App card
    appCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    appIconWrap: {
        width: 52, height: 52, borderRadius: 14,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, position: 'relative',
    },
    blockedBadge: {
        position: 'absolute', bottom: -4, right: -4,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: COLORS.bgDeep,
        alignItems: 'center', justifyContent: 'center',
    },
    appInfo: { flex: 1, gap: 6 },
    appTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
    appName: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textWhite, flex: 1 },
    pkgName: { fontSize: 10, color: COLORS.textFaint, marginTop: -2 },

    // Status badges
    badgeGreen: {
        backgroundColor: COLORS.accentGreen + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.accentGreen + '55',
    },
    badgeRed: {
        backgroundColor: COLORS.accentRed + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.accentRed + '55',
    },
    badgeOrange: {
        backgroundColor: COLORS.accentOrange + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.accentOrange + '55',
    },
    badgeText: { fontSize: 10, color: COLORS.textLight, fontWeight: '700' },

    // Usage row & bar
    usageRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    usageLabel: { fontSize: 10, color: COLORS.textMuted },
    usageVal: { fontSize: 10, fontWeight: '700', color: COLORS.textLight },
    usageDivider: { fontSize: 10, color: COLORS.textFaint },
    barTrack: { height: 5, backgroundColor: COLORS.bgDeep, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
    barFill: { height: 5, borderRadius: 3 },

    // Action buttons on cards
    actionRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: 4 },
    actionBtn: {
        flex: 1, paddingVertical: 6, borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center',
    },
    actionBtnText: { fontSize: 10, color: COLORS.textLight, fontWeight: '600' },

    // + Add App button
    addBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.lg,
        height: 56, alignItems: 'center', justifyContent: 'center',
        marginTop: SPACING.sm,
    },
    addBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },

    // ── Modal / Bottom Sheet ──────────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.78)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: SPACING.lg,
        gap: SPACING.md,
        maxHeight: '92%',
    },
    handleBar: {
        width: 44, height: 4, borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center', marginBottom: SPACING.xs,
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: SPACING.sm,
    },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },
    modalSubtitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    closeBtn: { padding: 4 },
    closeBtnText: { fontSize: 20, color: COLORS.textMuted },

    // Scan badge
    scanBadge: {
        borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm,
        borderWidth: 1,
    },
    scanBadgeNative: {
        backgroundColor: COLORS.accentGreen + '15',
        borderColor: COLORS.accentGreen + '44',
    },
    scanBadgeDemo: {
        backgroundColor: COLORS.accentOrange + '15',
        borderColor: COLORS.accentOrange + '44',
    },
    scanBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: '600', lineHeight: 16 },
    apkPickerButton: {
        alignSelf: 'stretch',
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.primary,
        alignItems: 'center',
    },
    apkPickerButtonText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '700' },
    apkPickerHint: {
        marginHorizontal: SPACING.md,
        marginTop: 6,
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.xs,
        textAlign: 'center',
    },

    // Scanning loading
    scanningBox: {
        alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md,
    },
    scanningText: {
        color: COLORS.textMuted, fontSize: FONTS.sizes.sm, textAlign: 'center',
    },

    // Selection bar
    selectionBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.primary + '22',
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    },
    selectionText: { fontSize: FONTS.sizes.sm, color: COLORS.textWhite, fontWeight: '700' },
    selectionClear: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    // App list in modal
    appList: { maxHeight: 320 },
    searchInput: {
        backgroundColor: COLORS.bgCardLight,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        color: COLORS.textWhite,
        fontSize: FONTS.sizes.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    appRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: SPACING.md, paddingVertical: SPACING.sm + 2,
    },
    appRowSelected: {
        backgroundColor: COLORS.primary + '15',
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.xs,
    },
    listAppIcon: {
        width: 50, height: 50, borderRadius: 14,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
    },
    listAppInfo: { flex: 1 },
    listAppName: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textWhite },
    listAppPkg: { fontSize: 10, color: COLORS.textFaint, marginTop: 2 },

    // Checkbox
    checkbox: {
        width: 26, height: 26, borderRadius: 13,
        borderWidth: 2, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: COLORS.primary, borderColor: COLORS.primary,
    },
    checkmark: { fontSize: 14, color: '#fff', fontWeight: '800' },

    // Preset limit buttons
    presetSection: { gap: SPACING.xs },
    presetLabel: {
        fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
        fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    },
    presetRow: { flexDirection: 'row', gap: SPACING.xs },
    presetBtn: {
        flex: 1, paddingVertical: 10,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center',
    },
    presetBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    presetBtnText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: '600' },
    presetBtnTextActive: { color: '#fff', fontWeight: '800' },

    // Modal action row
    modalActions: { flexDirection: 'row', gap: SPACING.sm, paddingTop: SPACING.xs },
    cancelBtn: {
        flex: 1, height: 52, borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtnText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md, fontWeight: '700' },
    addSelectedBtn: {
        flex: 2, height: 52, borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    addSelectedBtnDisabled: { backgroundColor: COLORS.bgCardLight },
    addSelectedBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },

    // Edit limit modal helpers
    limitNote: {
        fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
        textAlign: 'center', lineHeight: 18,
    },
    editAppName: {
        fontSize: FONTS.sizes.md, fontWeight: '700',
        color: COLORS.textWhite, textAlign: 'center',
        marginBottom: SPACING.xs,
    },

    // Native protection banner
    protectionBanner: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: COLORS.accentOrange + '18',
        borderWidth: 1, borderColor: COLORS.accentOrange + '55',
        borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    },
    protectionIcon: { fontSize: 22 },
    protectionTitle: { color: COLORS.textWhite, fontSize: FONTS.sizes.sm, fontWeight: '800' },
    protectionSub: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    protectionCta: { color: COLORS.accentOrange, fontSize: FONTS.sizes.sm, fontWeight: '800' },
});
