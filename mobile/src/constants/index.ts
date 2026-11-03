import { DemoApp } from '../types';

// ─── Exact color palette from the UI design image ──────────────────────────
export const COLORS = {
    // Blues from image
    bgDeep: '#0D1B3E',   // very dark navy background
    bgCard: '#152344',   // card background
    bgCardLight: '#1E2F5A',   // lighter card / input bg
    bgCardLighter: '#243668',   // hover / active card
    primary: '#2563EB',   // bright blue — buttons, toggles
    primaryLight: '#3B82F6',   // lighter blue
    primaryDark: '#1D4ED8',   // darker blue
    accentCyan: '#38BDF8',   // cyan highlight
    accentGreen: '#22C55E',   // completed / success
    accentRed: '#EF4444',   // blocked / danger
    accentOrange: '#F97316',   // warning
    accentAmber: '#F59E0B',   // streak

    // Text
    textWhite: '#FFFFFF',
    textLight: '#E2E8F0',
    textMuted: '#94A3B8',
    textFaint: '#64748B',

    // UI
    border: '#1E3A6B',
    overlay: 'rgba(13,27,62,0.85)',
    cardShadow: '#0D1B3E',

    // Charts
    chartBlue: '#2563EB',
    chartGreen: '#22C55E',

    // Legacy aliases used in existing code
    background: '#0D1B3E',
    surface: '#152344',
    surfaceLight: '#1E2F5A',
    surfaceBorder: '#1E3A6B',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    accent: '#22C55E',
    accentLight: '#4ADE80',
    accentDark: '#16A34A',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#22C55E',
    info: '#3B82F6',
    social: '#EF4444',
    video: '#8B5CF6',
    messaging: '#22D3EE',
    productivity: '#22C55E',
    other: '#94A3B8',
    chart: ['#2563EB', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'],
};

export const FONTS = {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    sizes: {
        xs: 11,
        sm: 13,
        md: 15,
        lg: 17,
        xl: 20,
        xxl: 24,
        xxxl: 30,
        display: 38,
    },
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const BORDER_RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

// ─── Demo apps matching image ───────────────────────────────────────────────
export const DEMO_APPS: DemoApp[] = [
    { applicationName: 'TikTok', packageName: 'com.zhiliaoapp.musically', iconColor: '#010101', category: 'video' },
    { applicationName: 'Instagram', packageName: 'com.instagram.android', iconColor: '#E1306C', category: 'social' },
    { applicationName: 'YouTube', packageName: 'com.google.android.youtube', iconColor: '#FF0000', category: 'video' },
    { applicationName: 'Facebook', packageName: 'com.facebook.katana', iconColor: '#1877F2', category: 'social' },
    { applicationName: 'Telegram', packageName: 'org.telegram.messenger', iconColor: '#2AABEE', category: 'messaging' },
    { applicationName: 'Twitter / X', packageName: 'com.twitter.android', iconColor: '#1DA1F2', category: 'social' },
    { applicationName: 'Snapchat', packageName: 'com.snapchat.android', iconColor: '#FFFC00', category: 'social' },
    { applicationName: 'Reddit', packageName: 'com.reddit.frontpage', iconColor: '#FF4500', category: 'social' },
    { applicationName: 'WhatsApp', packageName: 'com.whatsapp', iconColor: '#25D366', category: 'messaging' },
];

export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'focusguard_access_token',
    REFRESH_TOKEN: 'focusguard_refresh_token',
    USER: 'focusguard_user',
    ONBOARDING_COMPLETE: 'focusguard_onboarding_complete',
    DEVICE_ID: 'focusguard_device_id',
    PENDING_SYNC: 'focusguard_pending_sync',
    LOCAL_LIMITS: 'focusguard_local_limits',
    LOCAL_USAGE: 'focusguard_local_usage',
};

export const USAGE_LIMIT_PRESETS = [15, 30, 60, 120, 180]; // minutes — matches image
export const WARNING_PRESETS = [80, 90, 100];            // percentage — matches image
export const STUDY_DURATION_PRESETS = [25, 45, 60, 90];        // minutes

export const MAX_DAILY_LIMIT_MINUTES = 1440;
export const MIN_DAILY_LIMIT_MINUTES = 1;
