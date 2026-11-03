import { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
    Dimensions, Image, SafeAreaView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../providers/authStore';
import { COLORS, FONTS, SPACING } from '../constants';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDEBAR_W = SCREEN_W * 0.75;

interface NavItem {
    emoji: string;
    label: string;
    route: string;
    activeOn: string;
}

const NAV_ITEMS: NavItem[] = [
    { emoji: '🏠', label: 'Home', route: '/(tabs)', activeOn: 'index' },
    { emoji: '📱', label: 'Applications', route: '/(tabs)/applications', activeOn: 'applications' },
    { emoji: '⚡', label: 'Study Mode', route: '/(tabs)/study', activeOn: 'study' },
    { emoji: '📊', label: 'Reports', route: '/(tabs)/reports', activeOn: 'reports' },
    { emoji: '👤', label: 'Settings', route: '/(tabs)/settings', activeOn: 'settings' },
];

interface SidebarProps {
    visible: boolean;
    onClose: () => void;
    activeScreen?: string;
}

export function Sidebar({ visible, onClose, activeScreen }: SidebarProps) {
    const { user, logout, avatarUri } = useAuthStore();
    const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    // Track whether the sidebar has ever been opened so we can render it
    // without accessing the private ._value property of Animated.Value
    const hasOpenedRef = useRef(false);
    if (visible) hasOpenedRef.current = true;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
                Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: -SIDEBAR_W, useNativeDriver: true, tension: 80, friction: 14 }),
                Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    const handleNav = (route: string) => {
        onClose();
        // Use replace so sidebar tabs don't stack in the history
        setTimeout(() => router.replace(route as any), 220);
    };

    const handleLogout = () => {
        onClose();
        setTimeout(() => {
            logout();
            router.replace('/(auth)/login');
        }, 220);
    };

    // Don't mount until first open to avoid rendering overhead
    if (!hasOpenedRef.current) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Dark overlay */}
            <Animated.View
                style={[styles.overlay, { opacity: overlayAnim }]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            {/* Drawer panel */}
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
                <SafeAreaView style={{ flex: 1 }}>

                    {/* Logo / Brand */}
                    <View style={styles.brandRow}>
                        <View style={styles.logoWrap}>
                            <Image
                                source={require('../../assets/images/app-logo.png')}
                                style={styles.logoImg}
                                resizeMode="contain"
                            />
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* User info */}
                    <View style={styles.userBox}>
                        <View style={styles.avatarWrap}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarPhoto} />
                            ) : (
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {user?.fullName?.charAt(0).toUpperCase() ?? '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.userName} numberOfLines={1}>
                                {user?.fullName ?? 'Student'}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                                {user?.email ?? ''}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Nav Items */}
                    <View style={styles.navList}>
                        {NAV_ITEMS.map((item) => {
                            const isActive = activeScreen === item.activeOn;
                            return (
                                <TouchableOpacity
                                    key={item.route}
                                    style={[styles.navItem, isActive && styles.navItemActive]}
                                    onPress={() => handleNav(item.route)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.navEmoji}>{item.emoji}</Text>
                                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                                        {item.label}
                                    </Text>
                                    {isActive && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.divider} />

                    {/* Footer actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <Text style={styles.logoutEmoji}>🚪</Text>
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                        <Text style={styles.version}>FocusNo v1.0 • Focus Today, Build Tomorrow</Text>
                    </View>
                </SafeAreaView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: SIDEBAR_W,
        backgroundColor: '#0E1B3F',
        borderRightWidth: 1,
        borderRightColor: '#1E3A6B',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingTop: Platform.OS === 'android' ? 48 : 16,
        paddingBottom: SPACING.sm,
    },
    logoWrap: {
        width: 52,
        height: 52,
        borderRadius: 13,
        backgroundColor: '#fff',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.2)',
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
    },
    logoImg: { width: 46, height: 46 },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#1E2F5A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },

    userBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    avatarWrap: { width: 46, height: 46 },
    avatarPhoto: {
        width: 46, height: 46, borderRadius: 23,
        borderWidth: 2, borderColor: COLORS.primary,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: FONTS.sizes.xl, fontWeight: '800' },
    userName: { color: COLORS.textWhite, fontSize: FONTS.sizes.md, fontWeight: '700' },
    userEmail: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },

    divider: { height: 1, backgroundColor: '#1E3A6B', marginVertical: SPACING.sm, marginHorizontal: SPACING.md },

    navList: { gap: 4, paddingHorizontal: SPACING.sm },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingVertical: 13,
        paddingHorizontal: SPACING.sm,
        borderRadius: 12,
        position: 'relative',
    },
    navItemActive: { backgroundColor: COLORS.primary + '22' },
    navEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
    navLabel: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, fontWeight: '600' },
    navLabelActive: { color: COLORS.primaryLight, fontWeight: '800' },
    activeIndicator: {
        position: 'absolute',
        right: 0,
        top: '20%',
        bottom: '20%',
        width: 3,
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },

    footer: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.lg,
        gap: SPACING.md,
        marginTop: 'auto',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingVertical: 12,
        paddingHorizontal: SPACING.sm,
        backgroundColor: '#EF444415',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EF444430',
    },
    logoutEmoji: { fontSize: 18 },
    logoutText: { color: COLORS.accentRed, fontSize: FONTS.sizes.md, fontWeight: '700' },
    version: { color: COLORS.textFaint, fontSize: 10, textAlign: 'center' },
});
