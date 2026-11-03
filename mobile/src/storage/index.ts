import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isSecureStoreAvailable = Platform.OS !== 'web';

export const storage = {
    // SecureStore for sensitive data (tokens)
    async setSecure(key: string, value: string): Promise<void> {
        try {
            if (isSecureStoreAvailable) {
                await SecureStore.setItemAsync(key, value);
            } else {
                await AsyncStorage.setItem(key, value);
            }
        } catch {
            // Fallback to AsyncStorage
            await AsyncStorage.setItem(key, value);
        }
    },

    async getSecure(key: string): Promise<string | null> {
        try {
            if (isSecureStoreAvailable) {
                return await SecureStore.getItemAsync(key);
            }
            return await AsyncStorage.getItem(key);
        } catch {
            return await AsyncStorage.getItem(key);
        }
    },

    async deleteSecure(key: string): Promise<void> {
        try {
            if (isSecureStoreAvailable) {
                await SecureStore.deleteItemAsync(key);
            } else {
                await AsyncStorage.removeItem(key);
            }
        } catch {
            await AsyncStorage.removeItem(key);
        }
    },

    // AsyncStorage for general data
    async set(key: string, value: unknown): Promise<void> {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    },

    async get<T>(key: string): Promise<T | null> {
        const value = await AsyncStorage.getItem(key);
        if (value === null) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return value as unknown as T;
        }
    },

    async remove(key: string): Promise<void> {
        await AsyncStorage.removeItem(key);
    },

    async clearAll(): Promise<void> {
        await AsyncStorage.clear();
    },

    async getKeys(): Promise<readonly string[]> {
        return await AsyncStorage.getAllKeys();
    },
};
