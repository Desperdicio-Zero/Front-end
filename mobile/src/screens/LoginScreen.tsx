/**
 * src/screens/LoginScreen.tsx
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
import { login as apiLogin } from '../services/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../App';
import PrimaryButton from '../components/PrimaryButton';
import FormInput from '../components/FormInput';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const { theme } = useTheme();
    const { signIn } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const emailTouched = email.length > 0;
    const emailValid = EMAIL_REGEX.test(email.trim());

    const handleLogin = async () => {
        if (!email || !password) {
            Toast.show({ type: 'error', text1: 'Preencha todos os campos.' });
            return;
        }
        if (!emailValid) {
            Toast.show({ type: 'error', text1: 'E-mail inválido.' });
            return;
        }
        setLoading(true);
        try {
            const { access_token } = await apiLogin(email.trim(), password);
            await signIn(access_token);
            Toast.show({ type: 'success', text1: 'Login realizado!' });
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Falha no login',
                text2: error.response?.data?.detail || 'E-mail ou senha incorretos'
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
                        <Text style={[styles.title, { color: theme.green }]}>Desperdício Zero</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gerencie sua despensa de forma inteligente</Text>
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
                    />

                    <TouchableOpacity style={styles.forgotBtn}>
                        <Text style={[styles.forgotText, { color: theme.green }]}>Esqueceu a senha?</Text>
                    </TouchableOpacity>

                    <PrimaryButton
                        label="Entrar"
                        onPress={handleLogin}
                        loading={loading}
                        style={styles.btnSpacing}
                    />

                    <View style={styles.signupContainer}>
                        <Text style={[styles.signupText, { color: theme.textSecondary }]}>Ainda não tem conta? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={[styles.signupLink, { color: theme.green }]}>Cadastre-se</Text>
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
    logoContainer: { alignItems: 'center', marginBottom: 48 },
    iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, textAlign: 'center' },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -4 },
    forgotText: { fontSize: 14, fontWeight: '600' },
    btnSpacing: { marginBottom: 28 },
    signupContainer: { flexDirection: 'row', justifyContent: 'center' },
    signupText: { fontSize: 14 },
    signupLink: { fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;
