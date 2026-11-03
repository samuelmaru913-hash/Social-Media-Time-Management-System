import { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../src/providers/authStore';
import { loginSchema, LoginFormData } from '../../src/validation/schemas';
import { COLORS, FONTS, SPACING } from '../../src/constants';

export default function LoginScreen() {
    const { login } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            await login(data.email, data.password);
            router.replace('/(tabs)');
        } catch (err: unknown) {
            const isNetwork =
                (err as { code?: string })?.code === 'ECONNABORTED' ||
                (err as { message?: string })?.message?.includes('Network') ||
                !(err as { response?: unknown })?.response;

            if (isNetwork) {
                Alert.alert(
                    '⚠️ Server Unreachable',
                    'Cannot connect to the server. Please make sure the backend is running and your internet connection is active.',
                    [{ text: 'OK' }]
                );
            } else {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                Alert.alert('Login Failed', msg ?? 'Incorrect email or password. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Text style={{ fontSize: 44 }}>🎯</Text>
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Log in to continue your focus journey</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Email */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <Controller
                            control={control} name="email"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, errors.email && styles.inputError]}
                                    placeholder="student@university.edu"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />
                        {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
                    </View>

                    {/* Password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordRow}>
                            <Controller
                                control={control} name="password"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                                        placeholder="Your password"
                                        placeholderTextColor={COLORS.textMuted}
                                        secureTextEntry={!showPassword}
                                        onChangeText={onChange}
                                        value={value}
                                    />
                                )}
                            />
                            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                                <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>
                        {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
                    </View>

                    {/* Forgot Password */}
                    <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn}>
                        <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                        onPress={() => handleSubmit(onSubmit)()}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.submitText}>Log In</Text>
                        }
                    </TouchableOpacity>

                    {/* Info box */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>ℹ️  First time?</Text>
                        <Text style={styles.infoText}>
                            Make sure the backend server is running.{'\n'}
                            Create your account using the Sign Up button below.
                        </Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                        <Text style={styles.linkText}>Sign up</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.lg, minHeight: '100%', justifyContent: 'center', gap: SPACING.xl },

    header: { alignItems: 'center', gap: SPACING.sm },
    iconCircle: {
        width: 96, height: 96, borderRadius: 28,
        backgroundColor: COLORS.primary + '22',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.xs,
        borderWidth: 1.5, borderColor: COLORS.primary + '44',
    },
    title: { fontSize: FONTS.sizes.xxxl, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1 },
    subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, textAlign: 'center' },

    form: { gap: SPACING.md },
    field: { gap: SPACING.xs },
    label: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 12,
        padding: SPACING.md, color: COLORS.textPrimary, fontSize: FONTS.sizes.md,
        borderWidth: 1, borderColor: COLORS.surfaceBorder,
    },
    inputError: { borderColor: COLORS.danger },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 56 },
    eyeBtn: { position: 'absolute', right: SPACING.md, top: '50%', transform: [{ translateY: -12 }] },
    errorText: { fontSize: FONTS.sizes.xs, color: COLORS.danger },

    forgotBtn: { alignSelf: 'flex-end', padding: SPACING.xs },
    forgotText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: '600' },

    submitBtn: {
        backgroundColor: COLORS.primaryLight, borderRadius: 14, height: 56,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm,
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: '700' },

    infoBox: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 10, padding: SPACING.md,
        borderWidth: 1, borderColor: COLORS.surfaceBorder, borderStyle: 'dashed', gap: SPACING.xs,
    },
    infoTitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '700' },
    infoText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, lineHeight: 18 },

    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    footerText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    linkText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
