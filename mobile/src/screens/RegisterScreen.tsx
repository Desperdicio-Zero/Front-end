/**
 * src/screens/RegisterScreen.tsx
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

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { register as apiRegister } from '../services/api';
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
    return { level: 3, label: 'Forte', color: '#16A34A' };
};

const RegisterScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const { signIn } = useAuth();

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
            await apiRegister(email.trim(), password);
            Toast.show({ type: 'success', text1: 'Conta criada com sucesso!' });
            navigation.navigate('Login');
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Falha no cadastro',
                text2: error.response?.data?.detail || 'Erro ao criar conta'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    <View style={styles.logoContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.greenBg }]}>
                            <Leaf size={48} color={theme.green} strokeWidth={2.5} />
                        </View>
                        <Text style={[styles.title, { color: theme.green }]}>Criar Conta</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Junte-se ao Desperdício Zero</Text>
                    </View>

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
                        <View style={[styles.strengthContainer, { marginTop: -12, marginBottom: 20 }]}>
                            <View style={styles.strengthBars}>
                                {[1, 2, 3].map(i => (
                                    <View
                                        key={i}
                                        style={[styles.strengthBar, { backgroundColor: i <= strength.level ? strength.color : theme.border }]}
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

                    <View style={styles.signupContainer}>
                        <Text style={[styles.signupText, { color: theme.textSecondary }]}>Já tem uma conta? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.signupLink, { color: theme.green }]}>Entrar</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
    logoContainer: { alignItems: 'center', marginBottom: 40 },
    iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, textAlign: 'center' },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 40 },
    btnSpacing: { marginBottom: 28, marginTop: 8 },
    signupContainer: { flexDirection: 'row', justifyContent: 'center' },
    signupText: { fontSize: 14 },
    signupLink: { fontSize: 14, fontWeight: '700' },
});

export default RegisterScreen;
