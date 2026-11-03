import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../src/constants';
import { AppIcon } from '../src/components/AppIcon';

export default function LimitReachedScreen() {
    const {
        appName = 'App',
        packageName,
        usedLabel = '—',
        limitLabel = '—',
        mode = 'limit',       // 'limit' | 'blocked'
    } = useLocalSearchParams<{
        appName?: string;
        packageName?: string;
        usedLabel?: string;
        limitLabel?: string;
        mode?: string;
    }>();

    const isBlocked = mode === 'blocked';

    // Pulse animation for the icon
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        ).start();
    }, [pulse]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>

                {/* Animated icon ring */}
                <Animated.View style={[
                    styles.iconWrap,
                    { transform: [{ scale: pulse }] },
                    isBlocked ? styles.iconWrapBlocked : styles.iconWrapLimit,
                ]}>
                    <Text style={styles.bigIcon}>{isBlocked ? '🚫' : '⏰'}</Text>
                </Animated.View>

                <Text style={styles.title}>
                    {isBlocked ? 'App Blocked' : 'Limit Reached'}
                </Text>
                <Text style={styles.subtitle}>
                    {isBlocked
                        ? `${appName} has been blocked\nby your FocusNo restrictions.`
                        : `You've used up your daily time\nallowance for ${appName}.`
                    }
                </Text>

                {/* App info card */}
                <View style={[styles.appCard, isBlocked && styles.appCardBlocked]}>
                    <View style={styles.appIconBox}>
                        <AppIcon
                            packageName={packageName ?? ''}
                            label={appName}
                            size={32}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.appName}>{appName}</Text>
                        <Text style={styles.appLimit}>
                            {isBlocked ? '🚫 Access fully restricted' : `Daily limit: ${limitLabel}`}
                        </Text>
                    </View>
                    <View style={[styles.statusDot, isBlocked ? styles.statusDotBlocked : styles.statusDotLimit]} />
                </View>

                {/* Stats row — only shown for limit mode */}
                {!isBlocked && (
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Used Today</Text>
                            <Text style={[styles.statValue, { color: COLORS.accentRed }]}>{usedLabel}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Your Limit</Text>
                            <Text style={styles.statValue}>{limitLabel}</Text>
                        </View>
                    </View>
                )}

                {/* Info box */}
                <View style={[styles.infoBox, isBlocked ? styles.infoBoxBlocked : styles.infoBoxLimit]}>
                    <Text style={[styles.infoText, isBlocked ? styles.infoTextBlocked : styles.infoTextLimit]}>
                        {isBlocked
                            ? '🔒 This app is blocked by an administrator restriction.\nGo to the Apps section to manage your block list.'
                            : '🎯 Great job staying aware of your screen time!\nYour limit will reset at midnight tonight.'
                        }
                    </Text>
                </View>

                {/* Buttons */}
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
                    <Text style={{ fontSize: 18 }}>🏠</Text>
                    <Text style={styles.primaryBtnText}>Back to Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.replace('/(tabs)/applications')}
                >
                    <Text style={{ fontSize: 14, color: COLORS.primary }}>⚙️</Text>
                    <Text style={styles.secondaryBtnText}>
                        {isBlocked ? 'Manage Block List' : 'Edit My Limits'}
                    </Text>
                </TouchableOpacity>

                {!isBlocked && (
                    <TouchableOpacity style={styles.studyBtn} onPress={() => router.replace('/(tabs)/study')}>
                        <Text style={{ fontSize: 14, color: COLORS.accentGreen }}>▶</Text>
                        <Text style={styles.studyBtnText}>Start Study Session Instead</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.resetNote}>
                    {isBlocked
                        ? 'Contact your account administrator to unblock this app.'
                        : 'Daily limits reset at midnight in your time zone.'
                    }
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    container: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        padding: SPACING.lg, gap: SPACING.md,
    },

    iconWrap: {
        width: 120, height: 120, borderRadius: 60,
        alignItems: 'center', justifyContent: 'center',
    },
    iconWrapBlocked: { backgroundColor: COLORS.accentRed + '22', borderWidth: 2, borderColor: COLORS.accentRed + '44' },
    iconWrapLimit: { backgroundColor: COLORS.accentOrange + '22', borderWidth: 2, borderColor: COLORS.accentOrange + '44' },
    bigIcon: { fontSize: 62 },

    title: { fontSize: FONTS.sizes.xxxl, fontWeight: '900', color: COLORS.textWhite },
    subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

    appCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, width: '100%',
    },
    appCardBlocked: { borderColor: COLORS.accentRed + '55' },
    appIconBox: {
        width: 54, height: 54, borderRadius: 15,
        backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center',
    },
    appName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },
    appLimit: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusDotBlocked: { backgroundColor: COLORS.accentRed },
    statusDotLimit: { backgroundColor: COLORS.accentOrange },

    statsRow: {
        flexDirection: 'row', width: '100%',
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    },
    statBox: { flex: 1, alignItems: 'center', padding: SPACING.md, gap: 4 },
    statDivider: { width: 1, backgroundColor: COLORS.border },
    statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.textWhite },

    infoBox: { borderRadius: BORDER_RADIUS.md, padding: SPACING.md, width: '100%', borderWidth: 1 },
    infoBoxBlocked: { backgroundColor: COLORS.accentRed + '15', borderColor: COLORS.accentRed + '44' },
    infoBoxLimit: { backgroundColor: COLORS.accentGreen + '15', borderColor: COLORS.accentGreen + '44' },
    infoText: { fontSize: FONTS.sizes.xs, textAlign: 'center', lineHeight: 20 },
    infoTextBlocked: { color: COLORS.accentRed + 'DD' },
    infoTextLimit: { color: COLORS.accentGreen },

    primaryBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        width: '100%', height: 54, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    },
    primaryBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },

    secondaryBtn: {
        width: '100%', height: 48, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.primary,
    },
    secondaryBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '700' },

    studyBtn: {
        width: '100%', height: 44, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    },
    studyBtnText: { color: COLORS.accentGreen, fontSize: FONTS.sizes.sm, fontWeight: '700' },

    resetNote: { fontSize: FONTS.sizes.xs, color: COLORS.textFaint, textAlign: 'center' },
});
