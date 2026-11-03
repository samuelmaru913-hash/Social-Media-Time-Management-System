import { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    SafeAreaView, ActivityIndicator, AppState,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../src/constants';
import {
    isBlockerSupported,
    isExpoGoClient,
    runtimeEnvironment,
    isAccessibilityEnabled,
    openAccessibilitySettings,
    isUsageAccessEnabled,
    openUsageAccessSettings,
    openAppSettings,
} from '../src/native/blocker';

const BUILD_COMMANDS =
    'npx eas-cli@latest login\nnpx eas-cli@latest build -p android --profile apk';

function Step({
    number, title, done, children,
}: {
    number: number; title: string; done?: boolean; children: React.ReactNode;
}) {
    return (
        <View style={styles.step}>
            <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
                <Text style={styles.stepNumber}>{done ? '✓' : number}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{title}</Text>
                <View style={styles.stepBody}>{children}</View>
            </View>
        </View>
    );
}

function StatusPill({ on }: { on: boolean }) {
    return (
        <View style={[styles.pill, on ? styles.pillOn : styles.pillOff]}>
            <Text style={[styles.pillText, on ? styles.pillTextOn : styles.pillTextOff]}>
                {on ? 'On' : 'Off'}
            </Text>
        </View>
    );
}

export default function BlockingSetupScreen() {
    const [accessibilityOn, setAccessibilityOn] = useState(false);
    const [usageOn, setUsageOn] = useState(false);
    const [checking, setChecking] = useState(true);
    const [lastChecked, setLastChecked] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const refresh = useCallback(async () => {
        setChecking(true);
        const [accessibility, usage] = await Promise.all([
            isAccessibilityEnabled(),
            isUsageAccessEnabled(),
        ]);
        setAccessibilityOn(accessibility);
        setUsageOn(usage);
        setChecking(false);
        setLastChecked(new Date().toLocaleTimeString());
    }, []);

    const copyCommands = async () => {
        await Clipboard.setStringAsync(BUILD_COMMANDS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') refresh();
        });
        return () => subscription.remove();
    }, [refresh]);

    const installedBuild = isBlockerSupported() && !isExpoGoClient;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Set Up App Blocking</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
                    {checking
                        ? <ActivityIndicator color={COLORS.primary} size="small" />
                        : <Text style={styles.refreshText}>Refresh</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.intro}>
                    Follow these steps once. After that, FocusNo blocks restricted apps automatically,
                    even when FocusNo is closed.
                </Text>
                {lastChecked && (
                    <Text style={styles.checkedText}>Permissions checked at {lastChecked}</Text>
                )}

                <Step number={1} title="Install the FocusNo APK" done={installedBuild}>
                    {installedBuild ? (
                        <Text style={styles.bodyText}>
                            The native blocker is present in this build.
                        </Text>
                    ) : isExpoGoClient ? (
                        <>
                            <Text style={styles.warnText}>
                                You are running in Expo Go. Expo Go cannot control other apps, so app
                                blocking can never work here.
                            </Text>
                            <Text style={styles.bodyText}>
                                Build an installable APK from the project folder:
                            </Text>
                            <View style={styles.codeBox}>
                                <Text style={styles.code}>npx eas-cli@latest login</Text>
                                <Text style={styles.code}>npx eas-cli@latest build -p android --profile apk</Text>
                            </View>
                            <TouchableOpacity style={styles.copyBtn} onPress={copyCommands}>
                                <Text style={styles.copyText}>{copied ? 'Copied ✓' : 'Copy commands'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.bodyText}>
                                Open the download link EAS gives you on your phone and install the APK.
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.warnText}>
                                This build does not contain the native blocker (runtime: {runtimeEnvironment}).
                            </Text>
                            <Text style={styles.bodyText}>
                                Rebuild the APK with the latest project code, uninstall the old app, then
                                install the new APK.
                            </Text>
                        </>
                    )}
                </Step>

                <Step number={2} title="Remove old builds">
                    <Text style={styles.bodyText}>
                        If any older FocusNo / mobile version is installed, uninstall it before installing
                        the new APK so you do not open the wrong one.
                    </Text>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={openAppSettings}>
                        <Text style={styles.secondaryBtnText}>Open App Info (Uninstall)</Text>
                    </TouchableOpacity>
                </Step>

                <Step number={3} title="Open the installed FocusNo app" done={installedBuild}>
                    <Text style={styles.bodyText}>
                        {installedBuild
                            ? 'You are already in the installed app. Continue to the next step.'
                            : 'Install the APK, then open FocusNo from your phone app drawer — not Expo Go and not the QR code.'}
                    </Text>
                </Step>

                <Step number={4} title="Enable the App Blocking Service" done={accessibilityOn}>
                    <View style={styles.row}>
                        <Text style={[styles.bodyText, { flex: 1 }]}>
                            Accessibility is the required permission. Find “FocusNo App Blocker” and turn it on.
                        </Text>
                        <StatusPill on={accessibilityOn} />
                    </View>
                    <TouchableOpacity style={styles.actionBtn} onPress={openAccessibilitySettings}>
                        <Text style={styles.actionBtnText}>Open Accessibility Settings</Text>
                    </TouchableOpacity>
                    {!isBlockerSupported() && (
                        <Text style={styles.hintText}>
                            Settings will open now. The FocusNo blocker only appears in the list after
                            you install the APK.
                        </Text>
                    )}
                    <Text style={styles.hintText}>
                        Android 13+: if the switch is blocked, open App Info → ⋮ → Allow restricted settings.
                    </Text>
                </Step>

                <Step number={5} title="Allow Usage Access (recommended)" done={usageOn}>
                    <View style={styles.row}>
                        <Text style={[styles.bodyText, { flex: 1 }]}>
                            Lets FocusNo read screen-time data for accurate reports.
                        </Text>
                        <StatusPill on={usageOn} />
                    </View>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={openUsageAccessSettings}>
                        <Text style={styles.secondaryBtnText}>Open Usage Access Settings</Text>
                    </TouchableOpacity>
                </Step>

                <View style={styles.noteBox}>
                    <Text style={styles.noteText}>
                        Rules sync automatically while you are logged in. Add or block apps from the
                        Applications screen, then open that app to test the block screen.
                    </Text>
                </View>

                <TouchableOpacity style={styles.linkBtn} onPress={openAppSettings}>
                    <Text style={styles.linkText}>Open FocusNo App Info</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDeep },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backText: { color: COLORS.textWhite, fontSize: 30, lineHeight: 32 },
    headerTitle: { flex: 1, color: COLORS.textWhite, fontSize: FONTS.sizes.lg, fontWeight: '800' },
    refreshBtn: { minWidth: 60, alignItems: 'flex-end', paddingVertical: 8 },
    refreshText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '700' },
    content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
    intro: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, lineHeight: 21, marginBottom: SPACING.xs },
    checkedText: { color: COLORS.accentGreen, fontSize: FONTS.sizes.xs, marginTop: -SPACING.xs },
    step: {
        flexDirection: 'row', gap: SPACING.md,
        backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
    },
    stepBadge: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: COLORS.bgCardLight, borderWidth: 1, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    stepBadgeDone: { backgroundColor: COLORS.accentGreen + '22', borderColor: COLORS.accentGreen + '66' },
    stepNumber: { color: COLORS.textWhite, fontWeight: '800', fontSize: FONTS.sizes.sm },
    stepTitle: { color: COLORS.textWhite, fontSize: FONTS.sizes.md, fontWeight: '800', marginBottom: 4 },
    stepBody: { gap: SPACING.xs },
    bodyText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, lineHeight: 20 },
    warnText: { color: COLORS.accentOrange, fontSize: FONTS.sizes.sm, lineHeight: 20, fontWeight: '600' },
    hintText: { color: COLORS.textFaint, fontSize: FONTS.sizes.xs, lineHeight: 17, marginTop: 4 },
    codeBox: {
        backgroundColor: COLORS.bgDeep, borderRadius: BORDER_RADIUS.md,
        borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, gap: 4,
    },
    code: { color: COLORS.accentGreen, fontSize: 11, fontFamily: 'monospace' },
    copyBtn: {
        alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 6,
        borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '66',
        backgroundColor: COLORS.primary + '18',
    },
    copyText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontWeight: '800' },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    pillOn: { backgroundColor: COLORS.accentGreen + '22', borderColor: COLORS.accentGreen + '66' },
    pillOff: { backgroundColor: COLORS.accentRed + '18', borderColor: COLORS.accentRed + '55' },
    pillText: { fontSize: FONTS.sizes.xs, fontWeight: '800' },
    pillTextOn: { color: COLORS.accentGreen },
    pillTextOff: { color: COLORS.accentRed },
    actionBtn: {
        height: 46, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xs,
    },
    actionBtnDisabled: { opacity: 0.4 },
    actionBtnText: { color: '#fff', fontSize: FONTS.sizes.sm, fontWeight: '800' },
    secondaryBtn: {
        height: 44, borderRadius: BORDER_RADIUS.md,
        borderWidth: 1, borderColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xs,
    },
    secondaryBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '700' },
    noteBox: {
        backgroundColor: COLORS.primary + '12', borderWidth: 1,
        borderColor: COLORS.primary + '44', borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
    },
    noteText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, lineHeight: 19 },
    linkBtn: { alignItems: 'center', paddingVertical: SPACING.md },
    linkText: { color: COLORS.textFaint, fontSize: FONTS.sizes.xs, fontWeight: '600' },
});
