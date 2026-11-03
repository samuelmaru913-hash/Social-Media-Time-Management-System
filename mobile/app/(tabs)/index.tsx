import { useEffect, useRef, useState, useCallback } from 'react';
import {
    ScrollView, View, Text, StyleSheet, TouchableOpacity,
    SafeAreaView, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/providers/authStore';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { formatDuration } from '../../src/utils/usageCalculations';
import { Sidebar } from '../../src/components/Sidebar';
import { reportsApi, studySessionsApi, applicationsApi } from '../../src/api/endpoints';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
    totalStudy: number;       // seconds
    studyGoal: number;        // seconds
    sessions: number;
    focusStreak: number;
    goalProgress: number;     // %
    appsBlocked: number;
    studySessions: number;
    remainingSecs: number;
}

// ── Fallback demo data ────────────────────────────────────────────────────────
const DEMO_DATA: DashboardData = {
    totalStudy: 2 * 3600 + 15 * 60,
    studyGoal: 3 * 3600,
    sessions: 5,
    focusStreak: 3,
    goalProgress: 60,
    appsBlocked: 3,
    studySessions: 2,
    remainingSecs: 45 * 60,
};

// ── Donut ring ────────────────────────────────────────────────────────────────
function DonutRing({ pct, size = 110, stroke = 12 }: { pct: number; size?: number; stroke?: number }) {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(anim, { toValue: pct / 100, duration: 900, useNativeDriver: false }).start();
    }, [pct]);
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: COLORS.bgCardLight }} />
            <View style={{
                position: 'absolute', width: size, height: size, borderRadius: size / 2,
                borderWidth: stroke,
                borderTopColor: pct >= 5 ? COLORS.primary : 'transparent',
                borderRightColor: pct >= 30 ? COLORS.primary : 'transparent',
                borderBottomColor: pct >= 55 ? COLORS.primary : 'transparent',
                borderLeftColor: pct >= 80 ? COLORS.primary : 'transparent',
                transform: [{ rotate: '-90deg' }],
            }} />
            <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textWhite }}>{pct}%</Text>
            </View>
        </View>
    );
}

function StatCard({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) {
    return (
        <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: color + '22' }]}>
                <Text style={{ fontSize: 15 }}>{emoji}</Text>
            </View>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted }}>{label}</Text>
            <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textWhite, fontWeight: '700' }}>{value}</Text>
        </View>
    );
}

function ActionRow({ emoji, label, sub, onPress, danger, toggle }: {
    emoji: string; label: string; sub: string; onPress: () => void; danger?: boolean; toggle?: boolean;
}) {
    return (
        <TouchableOpacity style={styles.actionRow} onPress={onPress}>
            <View style={[styles.actionIcon, danger && { backgroundColor: '#EF444422' }]}>
                <Text style={{ fontSize: 17 }}>{emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, danger && { color: COLORS.accentRed }]}>{label}</Text>
                <Text style={styles.actionSub}>{sub}</Text>
            </View>
            <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>{toggle ? '⬜' : '›'}</Text>
        </TouchableOpacity>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
    const { user } = useAuthStore();
    const firstName = user?.fullName?.split(' ')[0] ?? 'Student';
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<DashboardData>(DEMO_DATA);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [recentSessions, setRecentSessions] = useState<Array<{ id: string; label: string; duration: string; done: boolean }>>([]);

    const loadData = useCallback(async () => {
        try {
            const [dailyReport, sessionsRes, appsRes] = await Promise.allSettled([
                reportsApi.daily(),
                studySessionsApi.list({ limit: 5 }),
                applicationsApi.list(),
            ]);

            const daily = dailyReport.status === 'fulfilled' ? dailyReport.value.data : null;
            const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : [];
            const apps = appsRes.status === 'fulfilled' ? appsRes.value.data : [];

            if (daily) {
                const studySecs = daily.totalStudySeconds ?? 0;
                const studyGoalSecs = 3 * 3600; // 3 hours default
                const pct = studyGoalSecs > 0 ? Math.round((studySecs / studyGoalSecs) * 100) : 0;
                const blockedApps = apps.filter((a: { isEnabled: boolean }) => a.isEnabled).length;
                const completedToday = Array.isArray(sessions)
                    ? sessions.filter((s: { status: string }) => s.status === 'COMPLETED').length
                    : 0;

                setData({
                    totalStudy: studySecs,
                    studyGoal: studyGoalSecs,
                    sessions: Math.min(daily.sessionsCompleted ?? 0, 99),
                    focusStreak: 1,
                    goalProgress: Math.min(pct, 100),
                    appsBlocked: blockedApps,
                    studySessions: completedToday,
                    remainingSecs: Math.max(0, studyGoalSecs - studySecs),
                });
            }

            if (Array.isArray(sessions) && sessions.length > 0) {
                setRecentSessions(
                    sessions.slice(0, 3).map((s: { id: string; title: string; actualDurationSeconds: number; plannedDurationMinutes: number; status: string }) => ({
                        id: s.id,
                        label: s.title ?? 'Study Session',
                        duration: s.actualDurationSeconds > 0
                            ? formatDuration(s.actualDurationSeconds)
                            : `${s.plannedDurationMinutes}m`,
                        done: s.status === 'COMPLETED',
                    }))
                );
            } else {
                setRecentSessions([]);
            }
        } catch {
            // Network error — keep demo data
            setData(DEMO_DATA);
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

    const pct = Math.min(100, Math.round((data.totalStudy / data.studyGoal) * 100));

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                {/* ── WELCOME HEADER ───────────────────────────────────── */}
                <View style={styles.welcomeCard}>
                    <TouchableOpacity style={styles.hamburger} onPress={() => setSidebarOpen(true)}>
                        <View style={styles.hLine} />
                        <View style={[styles.hLine, { width: 18 }]} />
                        <View style={styles.hLine} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.welcomeTopLabel}>WELCOME</Text>
                        <Text style={styles.welcomeName}>{firstName.toUpperCase()}</Text>
                        <Text style={styles.welcomeSub}>Focus • Learn • Achieve</Text>
                    </View>
                    <View style={styles.welcomeAvatar}>
                        <Text style={{ fontSize: 32 }}>🎓</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading dashboard...</Text>
                    </View>
                ) : (
                    <>
                        {/* ── ANALYTICS ──────────────────────────────────── */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Analytics</Text>
                            <View style={styles.statsGrid}>
                                <StatCard emoji="⏱️" label="Total Study Time" value={formatDuration(data.totalStudy)} color={COLORS.primary} />
                                <StatCard emoji="📅" label="Total Sessions" value={String(data.sessions)} color={COLORS.primary} />
                                <StatCard emoji="🔥" label="Focus Streak" value={`${data.focusStreak} days`} color={COLORS.accentAmber} />
                                <StatCard emoji="🎯" label="Goal Progress" value={`${data.goalProgress}%`} color={COLORS.accentGreen} />
                            </View>
                        </View>

                        {/* ── QUICK ACTION ───────────────────────────────── */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Quick Action</Text>
                            <ActionRow
                                emoji="🚫" label="App Blocked" sub="Manage blocked apps" danger
                                onPress={() => router.push('/(tabs)/applications')}
                            />
                            <ActionRow
                                emoji="🛡️" label="Safe Blocked" sub="View protected list"
                                onPress={() => router.push('/(tabs)/applications')}
                            />
                            <ActionRow
                                emoji="🔧" label="Settings" sub="Configure app settings" toggle
                                onPress={() => router.push('/(tabs)/settings')}
                            />
                        </View>

                        {/* ── TODAY'S PROGRESS ────────────────────────────── */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Today's Progress</Text>
                            <View style={styles.progressRow}>
                                <DonutRing pct={pct} size={120} stroke={14} />
                                <View style={{ flex: 1, gap: 8 }}>
                                    <MetaRow label="Study Time" value={formatDuration(data.totalStudy)} />
                                    <MetaRow label="Study Goal" value={formatDuration(data.studyGoal)} />
                                    <View style={styles.pBarTrack}>
                                        <View style={[styles.pBarFill, { width: `${pct}%` }]} />
                                    </View>
                                    <Text style={styles.pBarPct}>{pct}% completed</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── QUICK STATS ─────────────────────────────────── */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Quick Stats</Text>
                            <View style={styles.statsGrid}>
                                <StatCard emoji="🚫" label="Apps Blocked" value={String(data.appsBlocked)} color={COLORS.accentRed} />
                                <StatCard emoji="📚" label="Study Sessions" value={String(data.studySessions)} color={COLORS.primary} />
                                <StatCard emoji="🔥" label="Focus Streak" value={`${data.focusStreak} days`} color={COLORS.accentAmber} />
                                <StatCard emoji="⏳" label="Remaining Time" value={formatDuration(data.remainingSecs)} color={COLORS.accentGreen} />
                            </View>
                        </View>

                        {/* ── RECENT SESSIONS ─────────────────────────────── */}
                        <View style={[styles.card, { marginBottom: 28 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.cardTitle}>Recent Sessions</Text>
                                <TouchableOpacity onPress={() => router.push('/(tabs)/study')}>
                                    <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' }}>+ New</Text>
                                </TouchableOpacity>
                            </View>
                            {recentSessions.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyText}>No sessions yet. Start your first study session!</Text>
                                    <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/(tabs)/study')}>
                                        <Text style={styles.startBtnText}>▶ Start Studying</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                recentSessions.map((t) => (
                                    <View key={t.id} style={styles.taskRow}>
                                        <View style={[styles.taskCheck, t.done && styles.taskCheckDone]}>
                                            {t.done && <Text style={styles.taskCheckMark}>✓</Text>}
                                        </View>
                                        <Text style={[styles.taskLabel, t.done && styles.taskDone]}>{t.label}</Text>
                                        <Text style={styles.taskDur}>{t.duration}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeScreen="index" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    scroll: { flex: 1 },
    content: { padding: SPACING.md, gap: SPACING.md },

    welcomeCard: {
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg, flexDirection: 'row',
        justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
    },
    hamburger: { gap: 5, padding: 4 },
    hLine: { width: 22, height: 2.5, backgroundColor: COLORS.textWhite, borderRadius: 2 },
    welcomeTopLabel: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: COLORS.textWhite, letterSpacing: 3 },
    welcomeName: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.textLight },
    welcomeSub: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 4 },
    welcomeAvatar: {
        width: 58, height: 58, borderRadius: 29,
        backgroundColor: COLORS.primary + '33',
        alignItems: 'center', justifyContent: 'center',
    },

    card: {
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
    },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite, marginBottom: 2 },

    loadingBox: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md },
    loadingText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    statCard: {
        flex: 1, minWidth: '44%',
        backgroundColor: COLORS.bgCardLight, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm, gap: 4,
    },
    statIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
    statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    pBarTrack: { height: 6, backgroundColor: COLORS.bgDeep, borderRadius: 3, overflow: 'hidden' },
    pBarFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
    pBarPct: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    actionIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textWhite },
    actionSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    taskRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    taskCheckDone: { backgroundColor: COLORS.accentGreen, borderColor: COLORS.accentGreen },
    taskCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
    taskLabel: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textLight },
    taskDone: { color: COLORS.textFaint, textDecorationLine: 'line-through' },
    taskDur: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    emptyBox: { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.md },
    emptyText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
    startBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
    startBtnText: { color: '#fff', fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
