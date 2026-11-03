import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/providers/authStore';
import { COLORS } from '../src/constants';

export default function HomeRoute() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgDeep }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
