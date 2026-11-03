import { create } from 'zustand';
import { User, AuthTokens } from '../types';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';
import { authApi } from '../api/endpoints';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthStore {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    avatarUri: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (fullName: string, email: string, password: string, timeZone?: string) => Promise<void>;
    logout: () => Promise<void>;
    restoreSession: () => Promise<void>;
    updateUser: (user: Partial<User>) => void;
    setAvatarUri: (uri: string) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    avatarUri: null,

    login: async (email: string, password: string) => {
        const result = await authApi.login({ email, password });
        const { user, accessToken, refreshToken } = result.data;
        await Promise.all([
            storage.setSecure(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
            storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
            storage.set(STORAGE_KEYS.USER, user),
        ]);
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    },

    register: async (fullName: string, email: string, password: string, timeZone = 'UTC') => {
        const result = await authApi.register({ fullName, email, password, timeZone });
        const { user, accessToken, refreshToken } = result.data;
        await Promise.all([
            storage.setSecure(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
            storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
            storage.set(STORAGE_KEYS.USER, user),
        ]);
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    },

    logout: async () => {
        const { refreshToken } = get();
        try {
            if (refreshToken) await authApi.logout(refreshToken);
        } catch {
            // Ignore network errors on logout
        }
        await Promise.all([
            storage.deleteSecure(STORAGE_KEYS.ACCESS_TOKEN),
            storage.deleteSecure(STORAGE_KEYS.REFRESH_TOKEN),
            storage.remove(STORAGE_KEYS.USER),
            AsyncStorage.removeItem('focusguard_avatar_uri'),
        ]);
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, avatarUri: null });
    },

    restoreSession: async () => {
        try {
            set({ isLoading: true });
            const [accessToken, refreshToken, user, avatarUri] = await Promise.all([
                storage.getSecure(STORAGE_KEYS.ACCESS_TOKEN),
                storage.getSecure(STORAGE_KEYS.REFRESH_TOKEN),
                storage.get<User>(STORAGE_KEYS.USER),
                AsyncStorage.getItem('focusguard_avatar_uri'),
            ]);
            if (accessToken && refreshToken && user) {
                set({ user, accessToken, refreshToken, isAuthenticated: true, avatarUri });
            }
        } catch {
            // Failed to restore — user must log in again
        } finally {
            set({ isLoading: false });
        }
    },

    setAvatarUri: async (uri: string) => {
        await AsyncStorage.setItem('focusguard_avatar_uri', uri);
        set({ avatarUri: uri });
    },

    updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        set({ user: updatedUser });
        storage.set(STORAGE_KEYS.USER, updatedUser).catch(() => { });
    },
}));
