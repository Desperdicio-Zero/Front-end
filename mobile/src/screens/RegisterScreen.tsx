/**
 * src/screens/RegisterScreen.tsx
 * Redesigned with Glassmorphism + Dark OLED theme
 */

import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Leaf } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { healthCheck, register as apiRegister } from '../services/api';
import PrimaryButton from '../components/PrimaryButton';
import FormInput from '../components/FormInput';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Fraca', color: '#EF4444' };
    if (score === 2) return { level: 2, label: 'Média', color: '#F59E0B' };
    return { level: 3, label: 'Forte', color: '#22C55E' };
};

const RegisterScreen = ({ navigation }: any) => {
    const { signIn } = useAuth();
    const { theme } = useTheme();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const emailTouched = email.length > 0;
    const emailValid = EMAIL_REGEX.test(email.trim());
    const passwordTouched = password.length > 0;
    const passwordStrong = password.length >= 8;
    const strength = getPasswordStrength(password);
    const confirmTouched = confirmPassword.length > 0;
    const passwordsMatch = password === confirmPassword && confirmTouched;

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            Toast.show({ type: 'error', text1: 'Preencha todos os campos.' });
            return;
        }
        if (!emailValid) {
            Toast.show({ type: 'error', text1: 'E-mail inválido.' });
            return;
        }
        if (!passwordStrong) {
            Toast.show({ type: 'error', text1: 'A senha precisa ter ao menos 8 caracteres.' });
            return;
        }
        if (password !== confirmPassword) {
            Toast.show({ type: 'error', text1: 'As senhas não coincidem.' });
            return;
        }
        setLoading(true);
        try {
            await healthCheck();
            await apiRegister(email.trim(), password);
            Toast.show({ type: 'success', text1: 'Conta criada com sucesso!' });
            navigation.navigate('Login');
        } catch (error: any) {
            const url = String(error?.config?.url ?? '');
            if (url.includes('/health') || !error?.response) {
                Toast.show({
                    type: 'error',
                    text1: 'Servidor indisponível',
                    text2: 'Verifique o backend e a BASE_URL.',
                });
                return;
            }
            Toast.show({
                type: 'error',
                text1: 'Falha no cadastro',
                text2: error.response?.data?.detail || 'Erro ao criar conta',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
            {/* Ambient glow */}
            <View style={styles.glow1} />
            <View style={styles.glow2} />

            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >

                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <View style={styles.iconRing}>
                                <View style={styles.iconCircle}>
                                    <Leaf size={34} color="#22C55E" strokeWidth={2.5} />
                                </View>
                            </View>
                            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fonts.heading }]}>Criar Conta</Text>
                            <Text style={[styles.subtitle, { color: theme.textSecondary, fontFamily: theme.fonts.regular }]}>Junte-se ao Desperdício Zero</Text>
                        </View>

                        {/* Glass card */}
                        <View style={[styles.glassCard, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder }]}>
                            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fonts.heading }]}>Preencha seus dados</Text>

                            <FormInput
                                label="E-mail"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="seu@email.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                valid={emailTouched ? emailValid : undefined}
                                error={emailTouched && !emailValid ? 'Digite um e-mail válido.' : undefined}
                            />

                            <FormInput
                                label="Senha"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                isPassword
                                error={passwordTouched && !passwordStrong ? 'Mínimo de 8 caracteres.' : undefined}
                            />

                            {/* Barra de força */}
                            {passwordTouched && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBars}>
                                        {[1, 2, 3].map(i => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.strengthBar,
                                                    { backgroundColor: i <= strength.level ? strength.color : 'rgba(255,255,255,0.1)' },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                                </View>
                            )}

                            <FormInput
                                label="Confirmar Senha"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="••••••••"
                                isPassword
                                valid={confirmTouched ? passwordsMatch : undefined}
                                error={confirmTouched && !passwordsMatch ? 'As senhas não coincidem.' : undefined}
                            />

                            <PrimaryButton
                                label="Cadastrar"
                                onPress={handleRegister}
                                loading={loading}
                                style={styles.btnSpacing}
                            />

                            <View style={styles.divider}>
                                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                <Text style={[styles.dividerText, { color: theme.textMuted }]}>ou</Text>
                                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                            </View>

                            <View style={styles.loginContainer}>
                                <Text style={[styles.loginText, { color: theme.textSecondary }]}>Já tem uma conta? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                    <Text style={[styles.loginLink, { color: theme.green }]}>Entrar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22, gap: 6 }}>
                            <Leaf size={14} color={theme.textMuted} />
                            <Text style={[styles.footerText, { color: theme.textMuted, marginTop: 0, fontFamily: theme.fonts.regular }]}>Seus dados são protegidos</Text>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080D14' },
    safe: { flex: 1 },
    glow1: {
        position: 'absolute', width: 320, height: 320, borderRadius: 160,
        backgroundColor: '#15803D', opacity: 0.3, top: -60, right: -80,
    },
    glow2: {
        position: 'absolute', width: 260, height: 260, borderRadius: 130,
        backgroundColor: '#0E7490', opacity: 0.2, bottom: 40, left: -60,
    },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
    logoContainer: { alignItems: 'center', marginBottom: 32 },
    iconRing: {
        width: 88, height: 88, borderRadius: 44, borderWidth: 2,
        borderColor: 'rgba(34,197,94,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
        shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
    },
    iconCircle: {
        width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(34,197,94,0.15)',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    },
    title: {
        fontSize: 26, fontWeight: '800', color: '#F0FDF4', marginBottom: 6, letterSpacing: -0.5,
        textShadowColor: 'rgba(34,197,94,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
    },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
    glassCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)', padding: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
    },
    cardTitle: { fontSize: 17, fontWeight: '700', color: '#F0FDF4', marginBottom: 18, letterSpacing: -0.3 },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -10, marginBottom: 18 },
    strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 40 },
    btnSpacing: { marginBottom: 18, marginTop: 6 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
    dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
    loginContainer: { flexDirection: 'row', justifyContent: 'center' },
    loginText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    loginLink: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
    footerText: { textAlign: 'center', marginTop: 22, fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});

export default RegisterScreen;
