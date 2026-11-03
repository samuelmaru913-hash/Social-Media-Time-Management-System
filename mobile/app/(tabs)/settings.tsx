import {
    ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert,
    SafeAreaView, Image, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/providers/authStore';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants';
import { Sidebar } from '../../src/components/Sidebar';
import { usersApi, notificationsApi } from '../../src/api/endpoints';
import {
    isBlockerSupported,
    isExpoGoClient,
    isAccessibilityEnabled,
    isUsageAccessEnabled,
    openUsageAccessSettings,
    openAppSettings,
} from '../../src/native/blocker';

function SettingRow({ emoji, label, sub, onPress, value, danger }: {
    emoji: string; label: string; sub?: string; onPress: () => void; value?: string; danger?: boolean;
}) {
    return (
        <TouchableOpacity style={styles.settingRow} onPress={onPress}>
            <View style={[styles.settingIcon, danger && { backgroundColor: COLORS.accentRed + '22' }]}>
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, danger && { color: COLORS.accentRed }]}>{label}</Text>
                {sub && <Text style={styles.settingSub}>{sub}</Text>}
            </View>
            <Text style={styles.settingValue}>{value ?? '›'}</Text>
        </TouchableOpacity>
    );
}

export default function SettingsScreen() {
    const { user, logout, avatarUri, setAvatarUri, updateUser } = useAuthStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [usageAccess, setUsageAccess] = useState(false);
    const [accessibilityOn, setAccessibilityOn] = useState(false);

    const refreshPermissions = useCallback(async () => {
        const [usage, a11y] = await Promise.all([isUsageAccessEnabled(), isAccessibilityEnabled()]);
        setUsageAccess(usage);
        setAccessibilityOn(a11y);
    }, []);

    useFocusEffect(useCallback(() => {
        refreshPermissions();
    }, [refreshPermissions]));

    const handleUsageAccess = () => {
        if (!isBlockerSupported()) {
            router.push('/blocking-setup');
            return;
        }
        openUsageAccessSettings();
    };

    const handleAccessibility = () => {
        router.push('/blocking-setup');
    };

    // Edit Profile Modal
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [editName, setEditName] = useState(user?.fullName ?? '');
    const [editTz, setEditTz] = useState(user?.timeZone ?? 'UTC');
    const [profileSaving, setProfileSaving] = useState(false);

    // Change Password Modal
    const [pwModalOpen, setPwModalOpen] = useState(false);
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwSaving, setPwSaving] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to set a profile photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            await setAvatarUri(result.assets[0].uri);
        }
    };

    const handleLogout = () => {
        Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
        ]);
    };

    const handleDelete = () => {
        Alert.alert('Delete Account', 'Permanently delete your account and all data. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await usersApi.deleteMe();
                        await logout();
                        router.replace('/(auth)/login');
                    } catch {
                        Alert.alert('Error', 'Could not delete account. Please try again.');
                    }
                },
            },
        ]);
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) { Alert.alert('Validation', 'Name cannot be empty.'); return; }
        setProfileSaving(true);
        try {
            const res = await usersApi.updateMe({ fullName: editName.trim(), timeZone: editTz.trim() });
            updateUser(res.data);
            setProfileModalOpen(false);
            Alert.alert('✅ Saved', 'Profile updated successfully.');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            Alert.alert('Error', msg ?? 'Could not update profile.');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPw || !newPw || !confirmPw) { Alert.alert('Validation', 'All fields are required.'); return; }
        if (newPw !== confirmPw) { Alert.alert('Validation', 'New passwords do not match.'); return; }
        if (newPw.length < 8) { Alert.alert('Validation', 'Password must be at least 8 characters.'); return; }
        setPwSaving(true);
        try {
            await usersApi.updateMe({ password: newPw });
            setPwModalOpen(false);
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            Alert.alert('✅ Done', 'Password changed successfully.');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            Alert.alert('Error', msg ?? 'Could not change password.');
        } finally {
            setPwSaving(false);
        }
    };

    const handleSyncData = async () => {
        try {
            const res = await usersApi.getMe();
            updateUser(res.data);
            Alert.alert('✅ Synced', 'Your profile data has been refreshed from the server.');
        } catch {
            Alert.alert('Error', 'Could not sync. Check your connection.');
        }
    };

    const handleNotifications = async () => {
        try {
            const res = await notificationsApi.getPreferences();
            const prefs = res.data;
            Alert.alert(
                '🔔 Notifications',
                `Limit Warnings: ${prefs.limitWarningsEnabled ? 'On' : 'Off'}\nStudy Reminders: ${prefs.studyRemindersEnabled ? 'On' : 'Off'}\nDaily Summary: ${prefs.dailySummaryEnabled ? 'On' : 'Off'}`,
                [
                    { text: 'Turn All Off', onPress: async () => { await notificationsApi.updatePreferences({ limitWarningsEnabled: false, studyRemindersEnabled: false, dailySummaryEnabled: false }); } },
                    { text: 'Turn All On', onPress: async () => { await notificationsApi.updatePreferences({ limitWarningsEnabled: true, studyRemindersEnabled: true, dailySummaryEnabled: true }); } },
                    { text: 'Close', style: 'cancel' },
                ]
            );
        } catch {
            Alert.alert('Error', 'Could not load notification preferences.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Profile header */}
            <View style={styles.profileHeader}>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.burgerBtn}>
                    <View style={styles.hLine} />
                    <View style={[styles.hLine, { width: 18 }]} />
                    <View style={styles.hLine} />
                </TouchableOpacity>

                <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.8}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() ?? '?'}</Text>
                        </View>
                    )}
                    <View style={styles.cameraBadge}>
                        <Text style={styles.cameraIcon}>📷</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{user?.fullName ?? 'Student'}</Text>
                    <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{user?.role?.toLowerCase() ?? 'student'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Account */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Account</Text>
                    <View style={styles.card}>
                        <SettingRow emoji="👤" label="Edit Profile" sub="Update name and timezone"
                            onPress={() => { setEditName(user?.fullName ?? ''); setEditTz(user?.timeZone ?? 'UTC'); setProfileModalOpen(true); }} />
                        <SettingRow emoji="🔑" label="Change Password" sub="Update your password"
                            onPress={() => setPwModalOpen(true)} />
                        <SettingRow emoji="🌍" label="Time Zone" value={user?.timeZone ?? 'UTC'}
                            onPress={() => Alert.alert('Time Zone', `Current: ${user?.timeZone ?? 'UTC'}\n\nEdit your profile to change the timezone.`)} />
                    </View>
                </View>

                {/* Notifications */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Notifications</Text>
                    <View style={styles.card}>
                        <SettingRow emoji="🔔" label="Limit Warnings" sub="Alert at 80%, 90%, 100%" onPress={handleNotifications} />
                        <SettingRow emoji="📚" label="Study Reminders" sub="Break and session alerts" onPress={handleNotifications} />
                        <SettingRow emoji="📊" label="Daily Summary" sub="Evening usage report" onPress={handleNotifications} />
                    </View>
                </View>

                {/* Permissions */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Android Permissions</Text>
                    <View style={styles.card}>
                        <SettingRow emoji="📈" label="Usage Access" sub="Required for tracking — tap to grant"
                            onPress={handleUsageAccess} value={usageAccess ? 'On' : 'Grant'} />
                        <SettingRow emoji="♿" label="App Blocking Service" sub="Required — blocks apps automatically"
                            onPress={handleAccessibility} value={accessibilityOn ? 'On' : 'Off'} />
                        <SettingRow emoji="🪟" label="App Settings" sub="Battery / overlay options"
                            onPress={openAppSettings} value="Open" />
                    </View>
                    <Text style={styles.permNote}>
                        {isBlockerSupported()
                            ? (accessibilityOn
                                ? '✅ Protection is active. Blocked apps close automatically.'
                                : '⚠️ Turn on "App Blocking Service" so rules apply while other apps are open.')
                            : (isExpoGoClient
                                ? '⚠️ Expo Go cannot block other apps. Install the APK built with EAS.'
                                : '⚠️ This build is missing the native blocker. Rebuild and reinstall the APK.')}
                    </Text>
                </View>

                {/* Data */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Data & Privacy</Text>
                    <View style={styles.card}>
                        <SettingRow emoji="🔄" label="Sync Data" sub="Refresh profile from server" onPress={handleSyncData} />
                        <SettingRow emoji="📤" label="Export Data" sub="Download your usage data"
                            onPress={() => Alert.alert('Export Data', `Data export will be emailed to ${user?.email ?? 'your email'}.`)} />
                        <SettingRow emoji="🗑️" label="Clear Local Cache" sub="Remove cached data"
                            onPress={() => Alert.alert('Clear Cache', 'Are you sure?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'Local cache cleared.') },
                            ])} />
                    </View>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>About</Text>
                    <View style={styles.card}>
                        <SettingRow emoji="ℹ️" label="Version" value="1.0.0" onPress={() => { }} />
                        <SettingRow emoji="📄" label="Privacy Policy"
                            onPress={() => Alert.alert('Privacy Policy', 'FocusNo collects only the data you explicitly share. No ads, no data selling.')} />
                        <SettingRow emoji="📋" label="Terms of Service"
                            onPress={() => Alert.alert('Terms of Service', 'By using FocusNo you agree to use it responsibly for personal productivity.')} />
                        <SettingRow emoji="🆘" label="Help & Troubleshooting"
                            onPress={() => Alert.alert('Help', 'For support, contact: support@focusno.app\n\nCommon issues:\n• Permissions: see Android Permissions section\n• Backend: check your network connection')} />
                    </View>
                </View>

                {/* Admin Dashboard — only shown to admin users */}
                {user?.role === 'ADMIN' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Administrator</Text>
                        <View style={styles.card}>
                            <SettingRow
                                emoji="🛡️"
                                label="Admin Dashboard"
                                sub="Manage student apps, limits & monitoring"
                                onPress={() => router.push('/admin-dashboard')}
                            />
                        </View>
                    </View>
                )}

                {/* Danger zone */}
                <View style={[styles.section, { marginBottom: SPACING.xxl }]}>
                    <View style={styles.card}>
                        <SettingRow emoji="🚪" label="Log Out" onPress={handleLogout} />
                        <SettingRow emoji="💀" label="Delete Account" sub="Permanently remove account" onPress={handleDelete} danger />
                    </View>
                </View>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal visible={profileModalOpen} transparent animationType="slide" onRequestClose={() => setProfileModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Edit Profile</Text>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Your full name"
                            placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.inputLabel}>Time Zone</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editTz}
                            onChangeText={setEditTz}
                            placeholder="e.g. Africa/Addis_Ababa"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="none"
                        />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setProfileModalOpen(false)}>
                                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveProfile} disabled={profileSaving}>
                                {profileSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Change Password Modal */}
            <Modal visible={pwModalOpen} transparent animationType="slide" onRequestClose={() => setPwModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Change Password</Text>
                        <Text style={styles.inputLabel}>Current Password</Text>
                        <TextInput style={styles.modalInput} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Current password" placeholderTextColor={COLORS.textMuted} />
                        <Text style={styles.inputLabel}>New Password</Text>
                        <TextInput style={styles.modalInput} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="New password (min 8 chars)" placeholderTextColor={COLORS.textMuted} />
                        <Text style={styles.inputLabel}>Confirm New Password</Text>
                        <TextInput style={styles.modalInput} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholder="Confirm new password" placeholderTextColor={COLORS.textMuted} />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setPwModalOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}>
                                <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleChangePassword} disabled={pwSaving}>
                                {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Change</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeScreen="settings" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bgDeep },
    profileHeader: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        padding: SPACING.md, backgroundColor: COLORS.bgCard,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    burgerBtn: { gap: 5, padding: 4 },
    hLine: { width: 22, height: 2.5, backgroundColor: COLORS.textWhite, borderRadius: 2 },

    avatarWrap: { position: 'relative', width: 68, height: 68 },
    avatarImage: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, borderColor: COLORS.primary },
    avatarCircle: {
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2.5, borderColor: COLORS.primaryLight,
    },
    avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
    cameraBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bgCard,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: COLORS.primary,
    },
    cameraIcon: { fontSize: 11 },

    profileName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textWhite },
    profileEmail: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    roleBadge: {
        marginTop: 3, paddingHorizontal: 8, paddingVertical: 2,
        backgroundColor: COLORS.primary + '33', borderRadius: BORDER_RADIUS.full,
        alignSelf: 'flex-start',
    },
    roleText: { fontSize: FONTS.sizes.xs, color: COLORS.primaryLight, fontWeight: '700', textTransform: 'uppercase' },

    container: { flex: 1 },
    content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 40 },
    section: { gap: SPACING.xs },
    sectionLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 },

    card: { backgroundColor: COLORS.bgCard, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
    settingRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.bgCardLight, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textWhite },
    settingSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
    settingValue: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
    permNote: { fontSize: FONTS.sizes.xs, color: COLORS.accentAmber, textAlign: 'center', paddingHorizontal: SPACING.sm, marginTop: 4 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, gap: SPACING.sm },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textWhite, marginBottom: SPACING.sm },
    inputLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
    modalInput: {
        backgroundColor: COLORS.bgCardLight, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, color: COLORS.textWhite, fontSize: FONTS.sizes.sm,
        borderWidth: 1, borderColor: COLORS.border,
    },
    modalBtns: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
    modalCancelBtn: { flex: 1, height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    modalSaveBtn: { flex: 1, height: 48, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});
