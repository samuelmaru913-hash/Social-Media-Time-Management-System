/**
 * admin-dashboard.tsx
 *
 * Administrator-only screen accessible via Settings when the logged-in user
 * has role === 'ADMIN'.
 *
 * Features:
 *  - Lists all student users with tracked-app counts
 *  - Tapping a user shows their registered apps with usage/limit info
 *  - Admin can: view usage, set/update daily time limits, enable/disable monitoring
 */

import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../src/constants';
import { adminApi } from '../src/api/endpoints';
import { formatDuration } from '../src/utils/usageCalculations';
import { useAuthStore } from '../src/providers/authStore';

type UserRow = {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    createdAt: string;
    trackedAppCount: number;
};

type AppRow = {
    id: string;
    applicationName: string;
    packageName: string;
    isEnabled: boolean;
    monitoringStatus: string;
    limit: { id: string; limitMinutes: number; warningThreshold: number; isEnabled: boolean } | null;
    usedSeconds: number;
    limitSeconds: number | null;
    remainingSeconds: number | null;
};

const PKG_EMOJI: Record<string, string> = {
    'com.facebook.katana': '📘',
    'com.zhiliaoapp.musically': '🎵',
    'com.instagram.android': '📷',
    'com.google.android.youtube': '▶️',
    'org.telegram.messenger': '✈️',
    'com.whatsapp': '💬',
    'com.snapchat.android': '👻',
    'com.twitter.android': '🐦',
};
function getEmoji(pkg: string) { return PKG_EMOJI[pkg] ?? '📱'; }

const LIMIT_PRESETS = [15, 30, 60, 120, 180];

export default function AdminDashboardScreen() {
    const user = useAuthStore((s) => s.user);

    const [users, setUsers] = useState<UserRow[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [userApps, setUserApps] = useState<AppRow[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);

    // Limit edit modal
    const [editApp, setEditApp] = useState<AppRow | null>(null);
    const [editUserId, setEditUserId] = useState('');
    const [limitModalVisible, setLimitModalVisible] = useState(false);
    const [limitMin, setLimitMin] = useState(60);
    const [savingLimit, setSavingLimit] = useState(false);

    // Redirect non-admins
    if (!user || user.role !== 'ADMIN') {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.noAccessBox}>
                    <Text style={{ fontSize: 40 }}>🔒</Text>
                    <Text style={styles.noAccessText}>Admin access required</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>← Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── Load users ─────────────────────────────────────────────────────────────
    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await adminApi.listUsers();
            setUsers(res.data ?? []);
        } catch {
            Alert.alert('Error', 'Could not load users.');
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    // Initialize on first render
    useEffect(() => { loadUsers(); }, [loadUsers]);

    // ── Load a user's apps ─────────────────────────────────────────────────────
    const openUserApps = async (u: UserRow) => {
        setSelectedUser(u);
        setLoadingApps(true);
        try {
            const res = await adminApi.getUserApplications(u.id);
            setUserApps(res.data?.applications ?? []);
        } catch {
            Alert.alert('Error', 'Could not load user apps.');
        } finally {
            setLoadingApps(false);
        }
    };

    // ── Toggle monitoring ──────────────────────────────────────────────────────
    const toggleMonitoring = async (userId: string, app: AppRow) => {
        const newEnabled = !app.isEnabled;
        try {
            await adminApi.updateUserApp(userId, app.id, { isEnabled: newEnabled });
            setUserApps((prev) =>
                prev.map((a) => a.id === app.id ? { ...a, isEnabled: newEnabled } : a)
            );
        } catch {
            Alert.alert('Error', 'Could not update monitoring status.');
        }
    };

    // ── Edit time limit ────────────────────────────────────────────────────────
    const openLimitEdit = (userId: string, app: AppRow) => {
        setEditUserId(userId);
        setEditApp(app);
        setLimitMin(app.limit?.limitMinutes ?? 60);
        setLimitModalVisible(true);
    };

    const saveLimit = async () => {
        if (!editApp) return;
        setSavingLimit(true);
        try {
            await adminApi.setUserAppLimit(editUserId, editApp.id, {
                limitMinutes: limitMin,
                warningThreshold: editApp.limit?.warningThreshold ?? 80,
                isEnabled: true,
            });
            setUserApps((prev) =>
                prev.map((a) =>
                    a.id === editApp.id
                        ? {
                            ...a,
                            limit: {
                                id: a.limit?.id ?? '',
                                limitMinutes: limitMin,
                                warningThreshold: a.limit?.warningThreshold ?? 80,
                                isEnabled: true,
                            },
                            limitSeconds: limitMin * 60,
                            remainingSeconds: Math.max(0, limitMin * 60 - a.usedSeconds),
                        }
                        : a
                )
            );
            setLimitModalVisible(false);
        } catch {
            Alert.alert('Error', 'Could not save time limit.');
        } finally {
            setSavingLimit(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                {selectedUser ? (
                    <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.backIconBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => router.back()} style={styles.backIconBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {selectedUser ? selectedUser.fullName : 'Admin Dashboard'}
                    </Text>
                    <Text style={styles.headerSub}>
                        {selectedUser ? selectedUser.email : 'Manage user app monitoring'}
                    </Text>
                </View>
            </View>

            {/* ── Users list ── */}
            {!selectedUser && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Student Users</Text>
                        <TouchableOpacity onPress={loadUsers} style={styles.refreshBtn}>
                            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingUsers ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    ) : users.length === 0 ? (
                        <View style={styles.centerBox}>
                            <Text style={{ fontSize: 36 }}>👥</Text>
                            <Text style={styles.emptyText}>No student users found.</Text>
                        </View>
                    ) : (
                        users.map((u) => (
                            <TouchableOpacity
                                key={u.id}
                                style={styles.userCard}
                                onPress={() => openUserApps(u)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.userAvatar}>
                                    <Text style={{ fontSize: 20 }}>👤</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.userName}>{u.fullName}</Text>
                                    <Text style={styles.userEmail}>{u.email}</Text>
                                </View>
                                <View style={styles.appCountBadge}>
                                    <Text style={styles.appCountText}>
                                        {u.trackedAppCount} app{u.trackedAppCount !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}

            {/* ── Selected user's apps ── */}
            {selectedUser && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {loadingApps ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.emptyText}>Loading apps…</Text>
                        </View>
                    ) : userApps.length === 0 ? (
                        <View style={styles.centerBox}>
                            <Text style={{ fontSize: 36 }}>📱</Text>
                            <Text style={styles.emptyText}>No apps registered by this user.</Text>
                        </View>
                    ) : (
                        userApps.map((app) => {
                            const limitSec = app.limitSeconds ?? 60 * 60;
                            const pct = Math.min(100, (app.usedSeconds / limitSec) * 100);
                            const barColor =
                                pct >= 100 ? COLORS.accentRed : pct >= 80 ? COLORS.accentOrange : COLORS.primary;
                            const emoji = getEmoji(app.packageName);

                            return (
                                <View key={app.id} style={styles.appCard}>
                                    {/* Icon + name */}
                                    <View style={styles.appCardHeader}>
                                        <View style={styles.appIcon}>
                                            <Text style={{ fontSize: 22 }}>{emoji}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.appName}>{app.applicationName}</Text>
                                            <Text style={styles.appPkg}>{app.packageName}</Text>
                                        </View>
                                        {/* Status badge */}
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                !app.isEnabled && { backgroundColor: COLORS.accentRed + '22', borderColor: COLORS.accentRed + '55' },
                                            ]}
                                        >
                                            <Text style={styles.statusBadgeText}>
                                                {!app.isEnabled ? '🚫 Disabled' : app.monitoringStatus === 'PAUSED' ? '⏸ Paused' : '✅ Active'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Usage info */}
                                    <View style={styles.usageRow}>
                                        <View style={styles.usageStat}>
                                            <Text style={styles.usageStatLabel}>Daily Limit</Text>
                                            <Text style={styles.usageStatVal}>
                                                {app.limit ? `${app.limit.limitMinutes}m` : '—'}
                                            </Text>
                                        </View>
                                        <View style={styles.usageStat}>
                                            <Text style={styles.usageStatLabel}>Used Today</Text>
                                            <Text style={[styles.usageStatVal, { color: pct >= 100 ? COLORS.accentRed : COLORS.accentGreen }]}>
                                                {formatDuration(app.usedSeconds)}
                                            </Text>
                                        </View>
                                        <View style={styles.usageStat}>
                                            <Text style={styles.usageStatLabel}>Remaining</Text>
                                            <Text style={[styles.usageStatVal, { color: COLORS.accentCyan }]}>
                                                {app.remainingSeconds !== null ? formatDuration(app.remainingSeconds) : '∞'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Progress bar */}
                                    {app.limit && (
                                        <View style={styles.barTrack}>
                                            <View
                                                style={[
                                                    styles.barFill,
                                                    { width: `${pct}%` as `${number}%`, backgroundColor: barColor },
                                                ]}
                                            />
                                        </View>
                                    )}

                                    {/* Admin action buttons */}
                                    <View style={styles.adminActions}>
                                        <TouchableOpacity
                                            style={styles.adminBtn}
                                            onPress={() => openLimitEdit(selectedUser.id, app)}
                                        >
                                            <Text style={styles.adminBtnText}>⏱ Set Limit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.adminBtn,
                                                !app.isEnabled && { borderColor: COLORS.accentGreen + '55' },
                                            ]}
                                            onPress={() => toggleMonitoring(selectedUser.id, app)}
                                        >
                                            <Text
                                                style={[
                                                    styles.adminBtnText,
                                                    !app.isEnabled && { color: COLORS.accentGreen },
                                                ]}
                                            >
                                                {app.isEnabled ? '🚫 Disable' : '✅ Enable'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* ── Edit Limit Modal ── */}
            <Modal
                visible={limitModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLimitModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>⏱ Set Daily Limit</Text>
                            <TouchableOpacity onPress={() => setLimitModalVisible(false)}>
                                <Text style={{ fontSize: 20, color: COLORS.textMuted }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {editApp && (
                            <Text style={styles.editAppLabel}>
                                {getEmoji(editApp.packageName)}  {editApp.applicationName}
                            </Text>
                        )}
                        <View style={styles.presetRow}>
                            {LIMIT_PRESETS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.presetBtn, limitMin === p && styles.presetBtnActive]}
                                    onPress={() => setLimitMin(p)}
                                >
                                    <Text style={[styles.presetText, limitMin === p && styles.presetTextActive]}>
                                        {p >= 60 ? `${p / 60}h` : `${p}m`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.limitNote}>
                            Limit: {limitMin >= 60 ? `${limitMin / 60}h` : `${limitMin}m`} per day
                        </Text>
                        <TouchableOpacity
                            style={[styles.saveBtn, savingLimit && { opacity: 0.7 }]}
                            onPress={saveLimit}
                            disabled={savingLimit}
                        >
                            {savingLimit ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>✅ Apply Limit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        padding: SPACING.md, paddingTop: SPACING.lg,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backIconBtn: { padding: 4 },
    backIcon: { fontSize: 28, color: COLORS.primary, fontWeight: '700' },
    headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },
    headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 48 },

    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: SPACING.xs,
    },
    sectionTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    refreshBtn: {
        backgroundColor: COLORS.bgCardLight, borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderWidth: 1, borderColor: COLORS.border,
    },
    refreshBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },

    centerBox: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
    emptyText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, textAlign: 'center' },

    // User card
    userCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    },
    userAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
    },
    userName: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textWhite },
    userEmail: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    appCountBadge: {
        backgroundColor: COLORS.primary + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 1, borderColor: COLORS.primary + '55',
    },
    appCountText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
    chevron: { fontSize: 20, color: COLORS.textFaint },

    // App card
    appCard: {
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
        gap: SPACING.sm,
    },
    appCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    appIcon: {
        width: 46, height: 46, borderRadius: 13,
        backgroundColor: COLORS.bgCardLight,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border,
    },
    appName: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textWhite },
    appPkg: { fontSize: 10, color: COLORS.textFaint },
    statusBadge: {
        backgroundColor: COLORS.accentGreen + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 1, borderColor: COLORS.accentGreen + '55',
    },
    statusBadgeText: { fontSize: 10, color: COLORS.textLight, fontWeight: '700' },

    // Usage
    usageRow: { flexDirection: 'row', gap: SPACING.sm },
    usageStat: {
        flex: 1, backgroundColor: COLORS.bgCardLight,
        borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, alignItems: 'center', gap: 2,
    },
    usageStatLabel: { fontSize: 10, color: COLORS.textMuted },
    usageStatVal: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textWhite },

    // Bar
    barTrack: { height: 5, backgroundColor: COLORS.bgDeep, borderRadius: 3, overflow: 'hidden' },
    barFill: { height: 5, borderRadius: 3 },

    // Admin action buttons
    adminActions: { flexDirection: 'row', gap: SPACING.xs },
    adminBtn: {
        flex: 1, paddingVertical: 8, borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center',
    },
    adminBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.textLight, fontWeight: '700' },

    // No access
    noAccessBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    noAccessText: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },
    backBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.xl, paddingVertical: 12,
    },
    backBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: SPACING.lg },
    modalBox: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
        gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },
    editAppLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite, textAlign: 'center' },
    presetRow: { flexDirection: 'row', gap: SPACING.xs },
    presetBtn: {
        flex: 1, paddingVertical: 10, borderRadius: BORDER_RADIUS.full,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center',
    },
    presetBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    presetText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: '600' },
    presetTextActive: { color: '#fff', fontWeight: '800' },
    limitNote: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center' },
    saveBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        height: 50, alignItems: 'center', justifyContent: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },
});
