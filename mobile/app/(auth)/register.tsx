import { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../src/providers/authStore';
import { registerSchema, RegisterFormData } from '../../src/validation/schemas';
import { COLORS, FONTS, SPACING } from '../../src/constants';

export default function RegisterScreen() {
    const { register } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { agreed: false },
    });

    const onSubmit = async (data: RegisterFormData) => {
        setIsLoading(true);
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
            await register(data.fullName, data.email, data.password, tz);
            Alert.alert('✅ Account Created!', `Welcome, ${data.fullName}! Your account has been saved.`, [
                { text: 'Get Started', onPress: () => router.replace('/(tabs)') },
            ]);
        } catch (err: unknown) {
            const isNetwork =
                (err as { code?: string })?.code === 'ECONNABORTED' ||
                (err as { message?: string })?.message?.includes('Network') ||
                !(err as { response?: unknown })?.response;

            if (isNetwork) {
                Alert.alert(
                    '⚠️ Server Unreachable',
                    'Cannot connect to the server. Make sure the backend is running before creating an account.',
                    [{ text: 'OK' }]
                );
            } else {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                Alert.alert('Registration Failed', msg ?? 'Could not create account. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            {children}
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Text style={{ fontSize: 44 }}>📝</Text>
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Start your focus journey today</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>

                    {/* Full Name */}
                    <Field label="Full Name" error={errors.fullName?.message}>
                        <Controller
                            control={control} name="fullName"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, errors.fullName && styles.inputError]}
                                    placeholder="Jane Smith"
                                    placeholderTextColor={COLORS.textMuted}
                                    onChangeText={onChange} value={value}
                                    autoCapitalize="words"
                                />
                            )}
                        />
                    </Field>

                    {/* Email */}
                    <Field label="Email" error={errors.email?.message}>
                        <Controller
                            control={control} name="email"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, errors.email && styles.inputError]}
                                    placeholder="jane@university.edu"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={onChange} value={value}
                                />
                            )}
                        />
                    </Field>

                    {/* Password */}
                    <Field label="Password" error={errors.password?.message}>
                        <View style={styles.passwordRow}>
                            <Controller
                                control={control} name="password"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                                        placeholderTextColor={COLORS.textMuted}
                                        secureTextEntry={!showPassword}
                                        onChangeText={onChange} value={value}
                                    />
                                )}
                            />
                            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                                <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Field>

                    {/* Confirm Password */}
                    <Field label="Confirm Password" error={errors.confirmPassword?.message}>
                        <View style={styles.passwordRow}>
                            <Controller
                                control={control} name="confirmPassword"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
                                        placeholder="Re-enter password"
                                        placeholderTextColor={COLORS.textMuted}
                                        secureTextEntry={!showConfirm}
                                        onChangeText={onChange} value={value}
                                    />
                                )}
                            />
                            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                                <Text style={{ fontSize: 20 }}>{showConfirm ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Field>

                    {/* Terms Checkbox */}
                    <Controller
                        control={control} name="agreed"
                        render={({ field: { onChange, value } }) => (
                            <TouchableOpacity style={styles.agreeRow} onPress={() => onChange(!value)}>
                                <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                                    {value && <Text style={styles.checkMark}>✓</Text>}
                                </View>
                                <Text style={styles.agreeText}>I agree to the Terms of Service and Privacy Policy</Text>
                            </TouchableOpacity>
                        )}
                    />
                    {errors.agreed && <Text style={styles.errorText}>{errors.agreed.message}</Text>}

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                        onPress={() => handleSubmit(onSubmit)()}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.submitText}>Create Account</Text>
                        }
                    </TouchableOpacity>

                    {/* Info */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>💾 Your data is stored securely</Text>
                        <Text style={styles.infoText}>
                            Your account is saved in the database.{'\n'}
                            You can log in from any device with your email and password.
                        </Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                        <Text style={styles.linkText}>Log in</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.lg, gap: SPACING.xl, paddingTop: SPACING.xxl + 20, paddingBottom: SPACING.xxl },

    header: { alignItems: 'center', gap: SPACING.sm },
    iconCircle: {
        width: 96, height: 96, borderRadius: 28,
        backgroundColor: COLORS.primary + '22',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.xs,
        borderWidth: 1.5, borderColor: COLORS.primary + '44',
    },
    title: { fontSize: FONTS.sizes.xxxl, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1 },
    subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },

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

    agreeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    checkbox: {
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: COLORS.surfaceBorder, alignItems: 'center', justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
    checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
    agreeText: { flex: 1, color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },

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

    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: SPACING.xl },
    footerText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    linkText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
