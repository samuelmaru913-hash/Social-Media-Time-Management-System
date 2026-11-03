import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { router } from 'expo-router';
import { storage } from '../src/storage';
import { COLORS, FONTS, SPACING, STORAGE_KEYS } from '../src/constants';

const { width } = Dimensions.get('window');

const PAGES = [
    {
        emoji: '📱',
        title: 'Control Social Media',
        subtitle: 'Set daily time limits for TikTok, Instagram, YouTube, and other distracting apps.',
        accent: COLORS.primaryLight,
    },
    {
        emoji: '⏱️',
        title: 'Track Your Usage',
        subtitle: 'See exactly how much time you spend on each app — then take back control.',
        accent: COLORS.accent,
    },
    {
        emoji: '📚',
        title: 'Study Mode',
        subtitle: 'Block distractions and focus with Pomodoro-style study sessions and break reminders.',
        accent: COLORS.warning,
    },
    {
        emoji: '🔒',
        title: 'Permissioned & Transparent',
        subtitle: 'FocusGuard uses only optional permissions you explicitly grant. You are always in control.',
        accent: '#8B5CF6',
    },
    {
        emoji: '📊',
        title: 'Progress & Insights',
        subtitle: 'Daily, weekly, and monthly reports help you understand and improve your focus habits.',
        accent: COLORS.accentLight,
    },
];

export default function Onboarding() {
    const [page, setPage] = useState(0);

    const handleNext = async () => {
        if (page < PAGES.length - 1) {
            setPage(page + 1);
        } else {
            await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETE, true);
            router.replace('/(auth)/register');
        }
    };

    const handleSkip = async () => {
        await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETE, true);
        router.replace('/(auth)/login');
    };

    const current = PAGES[page];

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={[styles.iconCircle, { shadowColor: current.accent }]}>
                    <Text style={styles.emoji}>{current.emoji}</Text>
                </View>
                <Text style={styles.title}>{current.title}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
            </View>

            {/* Dots */}
            <View style={styles.dots}>
                {PAGES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            { backgroundColor: i === page ? current.accent : COLORS.surfaceBorder, width: i === page ? 24 : 8 },
                        ]}
                    />
                ))}
            </View>

            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: current.accent }]} onPress={handleNext}>
                <Text style={styles.nextText}>{page === PAGES.length - 1 ? 'Get Started' : 'Next'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
                <Text style={styles.loginText}>Already have an account? <Text style={{ color: current.accent }}>Log in</Text></Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.xxl,
    },
    skipBtn: { position: 'absolute', top: 56, right: SPACING.lg, padding: SPACING.sm },
    skipText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md },
    content: { alignItems: 'center', gap: SPACING.lg, flex: 1, justifyContent: 'center' },
    iconCircle: {
        width: 130,
        height: 130,
        borderRadius: 40,
        backgroundColor: COLORS.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    emoji: { fontSize: 64 },
    title: {
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: width * 0.8,
    },
    dots: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xl },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    nextText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: '700' },
    loginLink: { padding: SPACING.sm },
    loginText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
});
