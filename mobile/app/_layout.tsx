import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/providers/authStore';
import { View } from 'react-native';
import { COLORS } from '../src/constants';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 2, staleTime: 30_000, gcTime: 5 * 60_000 },
    },
});

function RootLayoutInner() {
    const { restoreSession } = useAuthStore();

    useEffect(() => { restoreSession(); }, []);

    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bgDeep } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(auth)/register" />
            <Stack.Screen name="(auth)/forgot-password" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="limits/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="limit-reached" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="blocking-setup" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <RootLayoutInner />
        </QueryClientProvider>
    );
}
