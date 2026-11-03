import {
    ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { formatDuration } from '../../src/utils/usageCalculations';
import { Sidebar } from '../../src/components/Sidebar';
import { reportsApi, usageApi } from '../../src/api/endpoints';
import { useAuthStore } from '../../src/providers/authStore';

type Tab = 'Daily' | 'Weekly' | 'Monthly';

const APP_EMOJIS: Record<string, string> = {
    'com.zhiliaoapp.musically': '🎵',
    'com.instagram.android': '📷',
    'com.google.android.youtube': '▶️',
    'com.facebook.katana': '👤',
    'com.twitter.android': '🐦',
    'com.snapchat.android': '👻',
};

const COLORS_PALETTE = [COLORS.primary, COLORS.accentGreen, COLORS.accentOrange, COLORS.accentRed, COLORS.accentAmber, COLORS.accentCyan];

// Demo weekly bars
const DEMO_WEEKLY = [
    { day: 'Mon', study: 60, dist: 30 },
    { day: 'Tue', study: 90, dist: 45 },
    { day: 'Wed', study: 45, dist: 60 },
    { day: 'Thu', study: 120, dist: 40 },
    { day: 'Fri', study: 75, dist: 55 },
    { day: 'Sat', study: 50, dist: 20 },
    { day: 'Sun', study: 80, dist: 35 },
];

interface DailyData {
    totalUsageSeconds: number;
    totalStudySeconds: number;
    productivityScore: number;
    sessionsCompleted: number;
    appBreakdown: Array<{
        application: { id: string; applicationName: string; packageName: string };
        usedSeconds: number;
        limitSeconds: number;
        usagePercentage: number;
    }>;
}

interface WeeklyData {
    dailyUsage: Array<{ date: string; usageSeconds: number }>;
    totalUsageSeconds: number;
    totalStudySeconds: number;
}

interface MonthlyData {
    totalUsageSeconds: number;
    dailyUsage: Array<{ date: string; usageSeconds: number }>;
    topApplications: Array<{ application?: { applicationName: string; packageName: string }; totalSeconds: number }>;
}

function DonutRing({ studyPct }: { studyPct: number }) {
    return (
        <View style={styles.donut}>
            <View style={styles.donutTrack} />
            <View style={[styles.donutArc, {
                borderTopColor: COLORS.primary,
                borderRightColor: studyPct > 25 ? COLORS.primary : 'transparent',
                borderBottomColor: studyPct > 50 ? COLORS.primary : 'transparent',
                borderLeftColor: studyPct > 75 ? COLORS.primary : 'transparent',
            }]} />
            <View style={[styles.donutArcSmall, { borderTopColor: COLORS.accentRed }]} />
        </View>
    );
}

export default function ReportsScreen() {
    const [tab, setTab] = useState<Tab>('Daily');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
    const [weeklyBars, setWeeklyBars] = useState(DEMO_WEEKLY);

    const loadData = useCallback(async () => {
        try {
            const now = new Date();
            const [dailyRes, weeklyRes, monthlyRes] = await Promise.allSettled([
                reportsApi.daily(),
                reportsApi.weekly(),
                reportsApi.monthly(now.getFullYear(), now.getMonth() + 1),
            ]);

            if (dailyRes.status === 'fulfilled') setDailyData(dailyRes.value.data as DailyData);
            if (weeklyRes.status === 'fulfilled') {
                const wd = weeklyRes.value.data as WeeklyData;
                setWeeklyData(wd);
                if (wd?.dailyUsage?.length) {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    setWeeklyBars(wd.dailyUsage.map((d) => ({
                        day: days[new Date(d.date).getDay()],
                        study: Math.round(d.usageSeconds / 60),
                        dist: Math.round(d.usageSeconds * 0.2 / 60),
                    })));
                }
            }
            if (monthlyRes.status === 'fulfilled') setMonthlyData(monthlyRes.value.data as MonthlyData);
        } catch { /* silent — api not reachable yet */ } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

    const maxBar = Math.max(...weeklyBars.map((b) => b.study + b.dist), 1);

    const studySecs = dailyData?.totalStudySeconds ?? 0;
    const distractionSecs = dailyData?.totalUsageSeconds ?? 0;
    const totalSecs = studySecs + distractionSecs;
    const studyPct = totalSecs > 0 ? Math.round((studySecs / totalSecs) * 100) : 0;
    const studyGoalSecs = 3 * 3600;
    const goalPct = studyGoalSecs > 0 ? Math.min(100, Math.round((studySecs / studyGoalSecs) * 100)) : 0;

    const appBreakdown = dailyData?.appBreakdown ?? [];
    const totalAppSecs = appBreakdown.reduce((s, a) => s + a.usedSeconds, 0);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.burgerBtn}>
                    <View style={styles.hLine} />
                    <View style={[styles.hLine, { width: 18 }]} />
                    <View style={styles.hLine} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Analytics</Text>
                <View style={styles.headerAvatar}><Text style={{ fontSize: 18 }}>👤</Text></View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                {/* Tab row */}
                <View style={styles.tabs}>
                    {(['Daily', 'Weekly', 'Monthly'] as Tab[]).map((t) => (
                        <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.periodTitle}>
                    {tab === 'Daily' ? 'Today' : tab === 'Weekly' ? 'This Week' : 'This Month'}
                </Text>

                {loading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={{ color: COLORS.textMuted, marginTop: SPACING.sm }}>Loading reports...</Text>
                    </View>
                ) : (
                    <>
                        {/* Usage Summary */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Usage Summary</Text>
                            <View style={styles.summaryRow}>
                                <View style={styles.donutWrap}>
                                    <DonutRing studyPct={studyPct} />
                                    <Text style={styles.donutCenter}>{formatDuration(totalSecs)}</Text>
                                    <Text style={styles.donutSub}>{studyPct}% study</Text>
                                </View>
                                <View style={styles.legendCol}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                                        <View>
                                            <Text style={styles.legendLabel}>Study Time</Text>
                                            <Text style={styles.legendVal}>{formatDuration(studySecs)} ({studyPct}%)</Text>
                                        </View>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: COLORS.accentRed }]} />
                                        <View>
                                            <Text style={styles.legendLabel}>Distraction Time</Text>
                                            <Text style={styles.legendVal}>{formatDuration(distractionSecs)} ({Math.max(0, 100 - studyPct)}%)</Text>
                                        </View>
                                    </View>
                                    <View style={styles.goalRow}>
                                        <Text style={styles.legendLabel}>Study Goal</Text>
                                        <Text style={styles.goalVal}>{formatDuration(studyGoalSecs)}</Text>
                                    </View>
                                    <View style={styles.goalBar}>
                                        <View style={[styles.goalBarFill, { width: `${goalPct}%` }]} />
                                    </View>
                                    <Text style={styles.goalPct}>{goalPct}% of daily goal</Text>
                                </View>
                            </View>
                        </View>

                        {/* Bar Chart */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Usage Overview</Text>
                            <View style={styles.chart}>
                                {weeklyBars.map((b) => {
                                    const studyH = Math.round((b.study / maxBar) * 80);
                                    const distH = Math.round((b.dist / maxBar) * 80);
                                    return (
                                        <View key={b.day} style={styles.barCol}>
                                            <View style={styles.barGroup}>
                                                <View style={[styles.bar, { height: Math.max(studyH, 4), backgroundColor: COLORS.primary }]} />
                                                <View style={[styles.bar, { height: Math.max(distH, 4), backgroundColor: COLORS.accentGreen }]} />
                                            </View>
                                            <Text style={styles.barDay}>{b.day}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={styles.chartLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                                    <Text style={styles.legendLabel}>Study Time</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: COLORS.accentGreen }]} />
                                    <Text style={styles.legendLabel}>Social Media</Text>
                                </View>
                            </View>
                        </View>

                        {/* Top Apps */}
                        <View style={[styles.card, { marginBottom: 28 }]}>
                            <Text style={styles.cardTitle}>
                                {tab === 'Monthly' && monthlyData?.topApplications
                                    ? 'Top Apps This Month'
                                    : 'Top Apps Today'}
                            </Text>

                            {appBreakdown.length === 0 && (!monthlyData?.topApplications?.length) ? (
                                <View style={{ alignItems: 'center', paddingVertical: SPACING.lg }}>
                                    <Text style={{ fontSize: 32 }}>📊</Text>
                                    <Text style={{ color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' }}>
                                        No usage data yet.{'\n'}Start tracking apps to see reports here.
                                    </Text>
                                </View>
                            ) : (
                                (tab === 'Monthly' && monthlyData?.topApplications
                                    ? monthlyData.topApplications
                                    : appBreakdown.map((a, i) => ({
                                        application: a.application,
                                        totalSeconds: a.usedSeconds,
                                        pct: totalAppSecs > 0 ? Math.round((a.usedSeconds / totalAppSecs) * 100) : 0,
                                        color: COLORS_PALETTE[i % COLORS_PALETTE.length],
                                    }))
                                ).map((a, i) => {
                                    const app = a.application;
                                    const secs = a.totalSeconds;
                                    const pct = totalAppSecs > 0 ? Math.round((secs / totalAppSecs) * 100) : 0;
                                    const color = COLORS_PALETTE[i % COLORS_PALETTE.length];
                                    return (
                                        <View key={app?.applicationName ?? i} style={styles.appRow}>
                                            <View style={styles.appEmoji}>
                                                <Text style={{ fontSize: 20 }}>{APP_EMOJIS[app?.packageName ?? ''] ?? '📱'}</Text>
                                            </View>
                                            <View style={styles.appInfo}>
                                                <Text style={styles.appName}>{app?.applicationName ?? 'Unknown'}</Text>
                                                <View style={styles.appBarTrack}>
                                                    <View style={[styles.appBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                                                </View>
                                            </View>
                                            <Text style={styles.appTime}>{formatDuration(secs)}</Text>
                                            <Text style={[styles.appPct, { color }]}>{pct}%</Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* Summary stats row */}
                        <View style={[styles.card, { marginBottom: 28 }]}>
                            <Text style={styles.cardTitle}>Summary</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.primary }}>{dailyData?.sessionsCompleted ?? 0}</Text>
                                    <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted }}>Sessions</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.accentGreen }}>{dailyData?.productivityScore ?? 0}%</Text>
                                    <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted }}>Productivity</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.accentAmber }}>{appBreakdown.length}</Text>
                                    <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted }}>Apps Tracked</Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>

            <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeScreen="reports" />
        </SafeAreaView>
    );
}

const DONUT_SIZE = 110;
const DONUT_STROKE = 12;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, paddingTop: SPACING.lg },
    burgerBtn: { gap: 5, padding: 4 },
    hLine: { width: 22, height: 2.5, backgroundColor: COLORS.textWhite, borderRadius: 2 },
    headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textWhite },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center' },
    content: { padding: SPACING.md, gap: SPACING.md },

    tabs: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.full, padding: 4, borderWidth: 1, borderColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: BORDER_RADIUS.full },
    tabActive: { backgroundColor: COLORS.primary },
    tabText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: '600' },
    tabTextActive: { color: '#fff', fontWeight: '800' },

    periodTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },

    card: {
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md,
    },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },

    summaryRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
    donutWrap: { alignItems: 'center', gap: 2 },
    donut: { width: DONUT_SIZE, height: DONUT_SIZE, alignItems: 'center', justifyContent: 'center' },
    donutTrack: {
        position: 'absolute', width: DONUT_SIZE, height: DONUT_SIZE,
        borderRadius: DONUT_SIZE / 2, borderWidth: DONUT_STROKE, borderColor: COLORS.bgCardLight,
    },
    donutArc: {
        position: 'absolute', width: DONUT_SIZE, height: DONUT_SIZE,
        borderRadius: DONUT_SIZE / 2, borderWidth: DONUT_STROKE,
        borderTopColor: COLORS.primary, borderRightColor: COLORS.primary,
        borderBottomColor: COLORS.primary, borderLeftColor: COLORS.primary,
        transform: [{ rotate: '-90deg' }],
    },
    donutArcSmall: {
        position: 'absolute', width: DONUT_SIZE - 4, height: DONUT_SIZE - 4,
        borderRadius: (DONUT_SIZE - 4) / 2, borderWidth: DONUT_STROKE - 4,
        borderTopColor: COLORS.accentRed, borderRightColor: 'transparent',
        borderBottomColor: 'transparent', borderLeftColor: 'transparent',
        transform: [{ rotate: '60deg' }],
    },
    donutCenter: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },
    donutSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    legendCol: { flex: 1, gap: SPACING.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    legendVal: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textWhite },
    goalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    goalVal: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
    goalBar: { height: 5, backgroundColor: COLORS.bgCardLight, borderRadius: 3, overflow: 'hidden' },
    goalBarFill: { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
    goalPct: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 88 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 },
    bar: { width: 7, borderRadius: 3, minHeight: 4 },
    barDay: { fontSize: 9, color: COLORS.textFaint },
    chartLegend: { flexDirection: 'row', gap: SPACING.lg },

    appRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    appEmoji: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center' },
    appInfo: { flex: 1, gap: 4 },
    appName: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textWhite },
    appBarTrack: { height: 4, backgroundColor: COLORS.bgDeep, borderRadius: 2, overflow: 'hidden' },
    appBarFill: { height: 4, borderRadius: 2 },
    appTime: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, minWidth: 40, textAlign: 'right' },
    appPct: { fontSize: FONTS.sizes.xs, fontWeight: '700', minWidth: 32, textAlign: 'right' },
});
