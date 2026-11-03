import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    Alert, ScrollView, SafeAreaView, ActivityIndicator, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { AppIcon } from '../../src/components/AppIcon';
import { applicationsApi, limitsApi } from '../../src/api/endpoints';
import type { TrackedApplication, DailyLimit } from '../../src/types';

const LIMIT_PRESETS = [15, 30, 60, 120, 180];
const WARN_PRESETS = [80, 90, 100];

export default function LimitConfigScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();

    const [app, setApp] = useState<TrackedApplication | null>(null);
    const [existingLimit, setExistingLimit] = useState<DailyLimit | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [blockSaving, setBlockSaving] = useState(false);

    const [limitPreset, setLimitPreset] = useState<number>(60);
    const [customMinutes, setCustomMinutes] = useState('60');
    const [warnPct, setWarnPct] = useState<number>(80);
    const [isBlocked, setIsBlocked] = useState(false);

    const loadApp = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [appsRes, limitsRes] = await Promise.allSettled([
                applicationsApi.list(),
                limitsApi.list(),
            ]);

            const apps: TrackedApplication[] = appsRes.status === 'fulfilled' ? appsRes.value.data : [];
            const limits: DailyLimit[] = limitsRes.status === 'fulfilled' ? limitsRes.value.data : [];

            const found = apps.find((a) => a.id === id);
            const foundLimit = limits.find((l) => l.trackedApplicationId === id);

            if (found) {
                setApp(found);
                setIsBlocked(!found.isEnabled);
            }
            if (foundLimit) {
                setExistingLimit(foundLimit);
                setLimitPreset(foundLimit.limitMinutes);
                setCustomMinutes(String(foundLimit.limitMinutes));
                setWarnPct(foundLimit.warningThreshold ?? 80);
            }
        } catch {
            Alert.alert('Error', 'Could not load app details.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadApp(); }, [loadApp]);

    // Toggle block
    const toggleBlock = async () => {
        if (!app) return;
        setBlockSaving(true);
        const nowBlocked = !isBlocked;
        try {
            await applicationsApi.update(app.id, { isEnabled: !nowBlocked });
            setIsBlocked(nowBlocked);
        } catch {
            Alert.alert('Error', 'Could not update block status.');
        } finally {
            setBlockSaving(false);
        }
    };

    const handleSave = async () => {
        if (!app) return;
        const minutes = parseInt(customMinutes);
        if (isNaN(minutes) || minutes < 1) {
            Alert.alert('Validation', 'Please enter a valid limit (at least 1 minute).');
            return;
        }
        setSaving(true);
        try {
            if (existingLimit) {
                await limitsApi.update(existingLimit.id, {
                    limitMinutes: minutes,
                    warningThreshold: warnPct,
                });
            } else {
                const res = await limitsApi.create({
                    trackedApplicationId: app.id,
                    limitMinutes: minutes,
                    warningThreshold: warnPct,
                });
                setExistingLimit(res.data);
            }
            Alert.alert('✅ Saved!', `Daily limit set to ${minutes} minutes with ${warnPct}% warning.`);
            router.back();
        } catch {
            Alert.alert('Error', 'Could not save limit. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={[styles.content, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={{ color: COLORS.textMuted, marginTop: SPACING.sm }}>Loading…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Limit Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* App info */}
                <View style={[styles.appCard, isBlocked && styles.appCardBlocked]}>
                    <View style={styles.appIconWrap}>
                        <AppIcon
                            packageName={app?.packageName ?? ''}
                            label={app?.applicationName ?? '?'}
                            size={30}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.appName}>{app?.applicationName ?? 'App'}</Text>
                        <Text style={styles.appPkg}>{app?.packageName ?? ''}</Text>
                    </View>
                    {isBlocked && (
                        <View style={styles.blockedBadge}>
                            <Text style={styles.blockedBadgeText}>🚫 Blocked</Text>
                        </View>
                    )}
                </View>

                {/* Block toggle card */}
                <View style={styles.card}>
                    <View style={styles.blockRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>🚫 Fully Block App</Text>
                            <Text style={styles.blockDesc}>
                                When blocked, no access is allowed regardless of time limits.
                            </Text>
                        </View>
                        {blockSaving ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                            <Switch
                                value={isBlocked}
                                onValueChange={toggleBlock}
                                trackColor={{ false: COLORS.border, true: COLORS.accentRed }}
                                thumbColor="#fff"
                            />
                        )}
                    </View>

                    {isBlocked && (
                        <View style={styles.blockAlert}>
                            <Text style={styles.blockAlertText}>
                                ⚠️ This app is currently fully blocked. Time limit settings below are saved but inactive while blocked.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Set Daily Limit */}
                <View style={[styles.card, isBlocked && styles.cardDimmed]}>
                    <Text style={styles.cardTitle}>⏱ Set Daily Limit</Text>
                    <Text style={styles.cardSub}>App access will be blocked once this limit is reached.</Text>

                    {/* Preset row */}
                    <View style={styles.presetsRow}>
                        {LIMIT_PRESETS.map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.preset, limitPreset === p && styles.presetActive]}
                                onPress={() => { setLimitPreset(p); setCustomMinutes(String(p)); }}
                                disabled={isBlocked}
                            >
                                <Text style={[styles.presetText, limitPreset === p && styles.presetTextActive]}>
                                    {p >= 60 ? `${p / 60}h` : `${p}m`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.fieldLabel}>Custom (minutes)</Text>
                    <TextInput
                        style={styles.customInput}
                        placeholder="e.g. 45"
                        placeholderTextColor={COLORS.textFaint}
                        keyboardType="numeric"
                        value={customMinutes}
                        editable={!isBlocked}
                        onChangeText={(v) => {
                            setCustomMinutes(v);
                            const n = parseInt(v);
                            if (!isNaN(n) && n > 0) setLimitPreset(n);
                        }}
                    />
                </View>

                {/* Warning Threshold */}
                <View style={[styles.card, isBlocked && styles.cardDimmed]}>
                    <Text style={styles.cardTitle}>🔔 Warning Threshold</Text>
                    <View style={styles.presetsRow}>
                        {WARN_PRESETS.map((w) => (
                            <TouchableOpacity
                                key={w}
                                style={[styles.preset, styles.warnPreset, warnPct === w && styles.presetActive]}
                                onPress={() => setWarnPct(w)}
                                disabled={isBlocked}
                            >
                                <Text style={[styles.presetText, warnPct === w && styles.presetTextActive]}>{w}%</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.warnNote}>
                        You'll be notified when usage reaches {warnPct}% of your {customMinutes || limitPreset} minute limit.
                    </Text>
                </View>

                {/* How enforcement works */}
                <View style={styles.enforcementCard}>
                    <Text style={styles.enforcementTitle}>🛡 How Enforcement Works</Text>
                    <View style={styles.enforcementStep}>
                        <Text style={styles.enforcementDot}>1</Text>
                        <Text style={styles.enforcementText}>App opens → FocusNo checks your usage & limits</Text>
                    </View>
                    <View style={styles.enforcementStep}>
                        <Text style={styles.enforcementDot}>2</Text>
                        <Text style={styles.enforcementText}>If blocked or limit exceeded → Blocked screen appears</Text>
                    </View>
                    <View style={styles.enforcementStep}>
                        <Text style={styles.enforcementDot}>3</Text>
                        <Text style={styles.enforcementText}>At midnight → limits reset for a new day</Text>
                    </View>
                </View>

                {/* Save button */}
                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveBtnText}>
                            {isBlocked ? '💾 Save Settings (blocked)' : '✅ Save Limit'}
                        </Text>
                    }
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: SPACING.md, paddingTop: SPACING.lg,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 28, color: COLORS.primary, fontWeight: '700' },
    headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite },

    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 50 },

    appCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    },
    appCardBlocked: { borderColor: COLORS.accentRed + '55' },
    appIconWrap: {
        width: 52, height: 52, borderRadius: 14,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center',
    },
    appName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },
    appPkg: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    blockedBadge: {
        backgroundColor: COLORS.accentRed + '22', borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: COLORS.accentRed + '66',
    },
    blockedBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.accentRed, fontWeight: '800' },

    card: {
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
    },
    cardDimmed: { opacity: 0.6 },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },
    cardSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 17 },

    blockRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    blockDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2, lineHeight: 17 },
    blockAlert: {
        backgroundColor: COLORS.accentRed + '15', borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.accentRed + '44',
    },
    blockAlertText: { fontSize: FONTS.sizes.xs, color: COLORS.accentRed + 'CC', lineHeight: 17 },

    presetsRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
    preset: {
        flex: 1, minWidth: 44, paddingVertical: 10,
        borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center',
    },
    warnPreset: { minWidth: 60 },
    presetActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    presetText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: '600' },
    presetTextActive: { color: '#fff', fontWeight: '800' },

    fieldLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: '600' },
    customInput: {
        backgroundColor: COLORS.bgCardLight, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, color: COLORS.textWhite, fontSize: FONTS.sizes.lg,
        borderWidth: 1, borderColor: COLORS.border, fontWeight: '700',
    },
    warnNote: { fontSize: FONTS.sizes.xs, color: COLORS.textFaint, lineHeight: 17 },

    enforcementCard: {
        backgroundColor: COLORS.primary + '15', borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.primary + '33', gap: SPACING.sm,
    },
    enforcementTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.textLight, marginBottom: 2 },
    enforcementStep: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    enforcementDot: {
        width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary,
        textAlign: 'center', lineHeight: 22, fontSize: FONTS.sizes.xs,
        color: '#fff', fontWeight: '800',
    },
    enforcementText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 18 },

    saveBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        height: 56, alignItems: 'center', justifyContent: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: '800' },
});
