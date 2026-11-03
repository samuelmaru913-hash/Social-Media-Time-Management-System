import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { Sidebar } from '../../src/components/Sidebar';
import { studySessionsApi } from '../../src/api/endpoints';
import type { StudySession } from '../../src/types';

type Screen = 'select' | 'examIntro' | 'timer';
type Mode = 'normal' | 'exam';

const PRESETS = [25, 45, 60, 90];

export default function StudyScreen() {
    const [screen, setScreen] = useState<Screen>('select');
    const [mode, setMode] = useState<Mode>('normal');
    const [duration, setDuration] = useState(45);
    const [seconds, setSeconds] = useState(45 * 60);
    const [running, setRunning] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [currentSession, setCurrentSession] = useState<StudySession | null>(null);
    const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [sessionSaving, setSessionSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const timerStart = useRef<number>(0);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const loadSessions = useCallback(async () => {
        try {
            const res = await studySessionsApi.list({ limit: 5 });
            if (Array.isArray(res.data)) setRecentSessions(res.data);
        } catch { /* silent */ } finally {
            setLoadingSessions(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadSessions(); }, [loadSessions]);
    const onRefresh = useCallback(() => { setRefreshing(true); loadSessions(); }, [loadSessions]);

    // ── Timer controls ────────────────────────────────────────────────────────
    const startTimer = async () => {
        // Create session in DB first
        setSessionSaving(true);
        try {
            const res = await studySessionsApi.create({
                title: mode === 'exam' ? 'Exam Mode Session' : 'Study Session',
                plannedDurationMinutes: duration,
            });
            setCurrentSession(res.data);
        } catch {
            Alert.alert('Warning', 'Could not save session to server. Timer will still run locally.');
        } finally {
            setSessionSaving(false);
        }

        timerStart.current = Date.now();
        setRunning(true);
        intervalRef.current = setInterval(() => {
            setSeconds((s) => {
                if (s <= 1) {
                    clearInterval(intervalRef.current!);
                    setRunning(false);
                    handleComplete();
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    };

    const pauseTimer = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRunning(false);
    };

    const resetTimer = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRunning(false);
        setSeconds(duration * 60);
        setCurrentSession(null);
    };

    const handleComplete = async () => {
        const elapsed = Math.round((Date.now() - timerStart.current) / 1000);
        Alert.alert('🎉 Session Complete!', `Great work! You focused for ${duration} minutes.`);
        if (currentSession) {
            try {
                await studySessionsApi.complete(currentSession.id, elapsed);
            } catch { /* silent */ }
        }
        setCurrentSession(null);
        loadSessions();
    };

    const endEarly = () => {
        Alert.alert('End Session', 'Are you sure you want to end this session early?', [
            { text: 'Keep Going', style: 'cancel' },
            {
                text: 'End Session', style: 'destructive', onPress: async () => {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setRunning(false);
                    const elapsed = Math.round((Date.now() - timerStart.current) / 1000);
                    if (currentSession) {
                        try {
                            await studySessionsApi.complete(currentSession.id, elapsed);
                        } catch { /* silent */ }
                    }
                    setCurrentSession(null);
                    setSeconds(duration * 60);
                    setScreen('select');
                    loadSessions();
                },
            },
        ]);
    };

    const selectDuration = (d: number) => {
        if (!running) { setDuration(d); setSeconds(d * 60); }
    };

    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const elapsed = duration * 60 - seconds;
    const pct = Math.min(100, Math.round((elapsed / (duration * 60)) * 100));
    const completedToday = recentSessions.filter((s) => s.status === 'COMPLETED').length;

    // ── SELECT MODE ───────────────────────────────────────────────────────────
    if (screen === 'select') {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.navRow}>
                    <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.burgerBtn}>
                        <View style={styles.hLine} />
                        <View style={[styles.hLine, { width: 18 }]} />
                        <View style={styles.hLine} />
                    </TouchableOpacity>
                    <Text style={styles.navTitle}>Study</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={{ padding: SPACING.md, gap: SPACING.lg, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                >
                    <View style={styles.selectHeader}>
                        <View style={styles.selectIconCircle}>
                            <Text style={{ fontSize: 48 }}>⚡</Text>
                        </View>
                        <Text style={styles.selectTitle}>Select Mode</Text>
                        <Text style={styles.selectSub}>Choose your focus mode</Text>
                    </View>

                    <View style={styles.modeCardsWrap}>
                        <TouchableOpacity style={styles.modeCard} onPress={() => { setMode('normal'); setScreen('timer'); }}>
                            <View style={[styles.modeCardIcon, { backgroundColor: COLORS.primary }]}>
                                <Text style={{ fontSize: 26 }}>⚡</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modeCardTitle}>Normal Mode</Text>
                                <Text style={styles.modeCardSub}>Use your regular study routine{'\n'}with app limits and tracking.</Text>
                            </View>
                            <Text style={styles.modeArrow}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.modeCard, { borderColor: COLORS.primary }]} onPress={() => { setMode('exam'); setScreen('examIntro'); }}>
                            <View style={[styles.modeCardIcon, { backgroundColor: COLORS.bgCardLight ?? COLORS.bgCard }]}>
                                <Text style={{ fontSize: 26 }}>🎓</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modeCardTitle}>Exam Mode</Text>
                                <Text style={styles.modeCardSub}>Strict focus mode with enhanced{'\n'}blocking and fewer distractions.</Text>
                            </View>
                            <Text style={styles.modeArrow}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Today's Sessions */}
                    <View style={styles.card}>
                        <View style={styles.sessionsTitleRow}>
                            <Text style={styles.cardTitle}>Today's Sessions</Text>
                            <Text style={styles.sessionsCount}>{completedToday} completed</Text>
                        </View>

                        {loadingSessions ? (
                            <ActivityIndicator color={COLORS.primary} style={{ paddingVertical: SPACING.md }} />
                        ) : recentSessions.length === 0 ? (
                            <Text style={{ color: COLORS.textMuted, fontSize: FONTS.sizes.sm, paddingVertical: SPACING.sm }}>
                                No sessions yet today. Pick a mode above to begin!
                            </Text>
                        ) : (
                            recentSessions.map((s) => (
                                <View key={s.id} style={styles.recentRow}>
                                    <View style={[styles.recentDot, { backgroundColor: s.status === 'COMPLETED' ? COLORS.accentGreen : COLORS.textMuted }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.recentLabel}>{s.title ?? 'Study Session'}</Text>
                                        <Text style={styles.recentSub}>
                                            {s.status === 'COMPLETED'
                                                ? `Completed · ${s.actualDurationSeconds ? Math.round(s.actualDurationSeconds / 60) + 'm' : s.plannedDurationMinutes + 'm'}`
                                                : `${s.plannedDurationMinutes}m planned`}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: FONTS.sizes.xs, color: s.status === 'COMPLETED' ? COLORS.accentGreen : COLORS.accentAmber }}>
                                        {s.status === 'COMPLETED' ? '✓' : '○'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeScreen="study" />
            </SafeAreaView>
        );
    }

    // ── EXAM INTRO ────────────────────────────────────────────────────────────
    if (screen === 'examIntro') {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.navRow}>
                    <TouchableOpacity onPress={() => setScreen('select')} style={styles.backBtn}>
                        <Text style={styles.backArrow}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.navTitle}>Exam Mode</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.examContent}>
                    <View style={styles.examIconWrap}><Text style={{ fontSize: 56 }}>🎓</Text></View>
                    <Text style={styles.examTitle}>Exam Mode</Text>
                    <Text style={styles.examSub}>Stay focused. Achieve more.</Text>

                    <View style={styles.sessionRow}>
                        <Text style={{ fontSize: 18 }}>⏱️</Text>
                        <View style={{ flex: 1, paddingLeft: SPACING.sm }}>
                            <Text style={styles.sessionLabel}>Focus Duration</Text>
                            <Text style={styles.sessionSub}>Select duration below</Text>
                        </View>
                        <Text style={styles.sessionVal}>{duration} minutes</Text>
                    </View>

                    <View style={styles.presetsRow}>
                        {PRESETS.map((d) => (
                            <TouchableOpacity key={d} style={[styles.preset, duration === d && styles.presetActive]} onPress={() => selectDuration(d)}>
                                <Text style={[styles.presetText, duration === d && styles.presetTextActive]}>{d}m</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.startBtn, sessionSaving && { opacity: 0.7 }]}
                        onPress={() => { resetTimer(); setScreen('timer'); }}
                        disabled={sessionSaving}
                    >
                        {sessionSaving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Text style={{ fontSize: 16, color: '#fff' }}>▶</Text>
                                <Text style={styles.startBtnText}>Start Focus Session</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.featuresCard}>
                        <Text style={styles.featuresTitle}>What Exam Mode does</Text>
                        {['Saves session to your profile', 'Tracks actual focus time', 'Shows in your reports'].map((f) => (
                            <View key={f} style={styles.featureRow}>
                                <Text style={{ color: COLORS.accentGreen, fontSize: 16 }}>✓</Text>
                                <Text style={styles.featureText}>{f}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── TIMER SCREEN ──────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.navRow}>
                <TouchableOpacity onPress={running ? endEarly : () => { resetTimer(); setScreen('select'); }} style={styles.backBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.navTitle}>{mode === 'exam' ? '🎓 Exam Mode' : '⚡ Study Mode'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.timerContent}>
                <View style={styles.timerWrap}>
                    <View style={styles.timerCircle}>
                        <Text style={styles.timerTime}>{mm}:{ss}</Text>
                        <Text style={styles.timerLabel}>{running ? 'Focusing...' : 'Ready'}</Text>
                        {running && (
                            <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.primary, marginTop: 4, fontWeight: '700' }}>
                                {pct}% done
                            </Text>
                        )}
                    </View>
                </View>

                {running && (
                    <View style={[styles.pBarTrack, { marginHorizontal: SPACING.lg }]}>
                        <View style={[styles.pBarFill, { width: `${pct}%` }]} />
                    </View>
                )}

                <View style={styles.ctrlRow}>
                    {!running ? (
                        <TouchableOpacity style={[styles.ctrlPrimary, sessionSaving && { opacity: 0.6 }]} onPress={startTimer} disabled={sessionSaving}>
                            {sessionSaving
                                ? <ActivityIndicator color="#fff" />
                                : <><Text style={{ fontSize: 14, color: '#fff' }}>▶</Text><Text style={styles.ctrlPrimaryText}>Start</Text></>
                            }
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.ctrlPrimary} onPress={pauseTimer}>
                            <Text style={{ fontSize: 14, color: '#fff' }}>⏸</Text>
                            <Text style={styles.ctrlPrimaryText}>Pause</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.ctrlSecondary} onPress={running ? endEarly : resetTimer}>
                        <Text style={{ fontSize: 14, color: COLORS.textMuted }}>{running ? '⏹' : '↺'}</Text>
                        <Text style={styles.ctrlSecondaryText}>{running ? 'End' : 'Reset'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.card, { marginBottom: 28 }]}>
                    <Text style={styles.cardTitle}>Session Duration</Text>
                    <View style={styles.presetsRow}>
                        {PRESETS.map((d) => (
                            <TouchableOpacity
                                key={d}
                                style={[styles.preset, duration === d && styles.presetActive]}
                                onPress={() => selectDuration(d)}
                                disabled={running}
                            >
                                <Text style={[styles.presetText, duration === d && styles.presetTextActive]}>{d}m</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, paddingTop: SPACING.lg },
    burgerBtn: { gap: 5, padding: 4, width: 40 },
    hLine: { width: 22, height: 2.5, backgroundColor: COLORS.textWhite, borderRadius: 2 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 28, color: COLORS.primary, fontWeight: '700' },
    navTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },

    selectHeader: { alignItems: 'center', paddingTop: SPACING.md, gap: SPACING.sm },
    selectIconCircle: { width: 100, height: 100, borderRadius: 28, backgroundColor: COLORS.primary + '22', alignItems: 'center', justifyContent: 'center' },
    selectTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: COLORS.textWhite },
    selectSub: { fontSize: FONTS.sizes.md, color: COLORS.textMuted },

    modeCardsWrap: { gap: SPACING.md },
    modeCard: { backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
    modeCardIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modeCardTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite },
    modeCardSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
    modeArrow: { fontSize: 22, color: COLORS.textMuted },

    card: { backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite },
    sessionsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionsCount: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
    recentDot: { width: 10, height: 10, borderRadius: 5 },
    recentLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textWhite, fontWeight: '600' },
    recentSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    examContent: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: 40 },
    examIconWrap: { alignItems: 'center', paddingTop: SPACING.lg },
    examTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: COLORS.textWhite, textAlign: 'center' },
    examSub: { fontSize: FONTS.sizes.md, color: COLORS.textMuted, textAlign: 'center' },
    sessionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    sessionLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite },
    sessionSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    sessionVal: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '700', marginRight: 4 },
    startBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
    startBtnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: '800' },
    featuresCard: { backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
    featuresTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textWhite },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    featureText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },

    timerContent: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 40 },
    timerWrap: { alignItems: 'center', paddingVertical: SPACING.xl },
    timerCircle: {
        width: 200, height: 200, borderRadius: 100, borderWidth: 6, borderColor: COLORS.primary,
        backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
    },
    timerTime: { fontSize: 52, fontWeight: '900', color: COLORS.textWhite, letterSpacing: -2 },
    timerLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 4 },
    pBarTrack: { height: 6, backgroundColor: COLORS.bgCardLight, borderRadius: 3, overflow: 'hidden' },
    pBarFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },

    ctrlRow: { flexDirection: 'row', gap: SPACING.md },
    ctrlPrimary: { flex: 1, height: 52, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
    ctrlPrimaryText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
    ctrlSecondary: { flex: 1, height: 52, borderRadius: BORDER_RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
    ctrlSecondaryText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md, fontWeight: '700' },

    presetsRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    preset: { flex: 1, minWidth: 52, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCardLight, alignItems: 'center' },
    presetActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    presetText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: '600' },
    presetTextActive: { color: '#fff', fontWeight: '800' },
});
