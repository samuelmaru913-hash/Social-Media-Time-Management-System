import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../../src/api/endpoints';
import { COLORS, FONTS, SPACING } from '../../src/constants';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSend = async () => {
        if (!email) return;
        setIsLoading(true);
        try {
            await authApi.forgotPassword(email);
            setSent(true);
        } catch {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            {sent ? (
                <View style={styles.successContainer}>
                    <Text style={styles.successEmoji}>📧</Text>
                    <Text style={styles.title}>Check your email</Text>
                    <Text style={styles.subtitle}>If an account exists for {email}, a reset link has been sent.</Text>
                    <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
                        <Text style={styles.btnText}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.content}>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="your@email.com"
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>
                    <TouchableOpacity style={[styles.btn, isLoading && { opacity: 0.7 }]} onPress={handleSend} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg, paddingTop: SPACING.xxl + 20 },
    backBtn: { marginBottom: SPACING.xl },
    backText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.md, fontWeight: '600' },
    content: { gap: SPACING.lg },
    successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    successEmoji: { fontSize: 64 },
    title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.textPrimary },
    subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, lineHeight: 22 },
    field: { gap: SPACING.xs },
    label: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: SPACING.md,
        color: COLORS.textPrimary, fontSize: FONTS.sizes.md, borderWidth: 1, borderColor: COLORS.surfaceBorder,
    },
    btn: {
        backgroundColor: COLORS.primaryLight, borderRadius: 14, height: 56,
        alignItems: 'center', justifyContent: 'center',
    },
    btnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: '700' },
});
