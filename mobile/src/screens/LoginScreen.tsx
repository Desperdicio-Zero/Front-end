/**
 * src/screens/LoginScreen.tsx
 * Redesigned with Glassmorphism + Dark OLED theme
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    Animated,
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

    // Ambient animation
    const glowAnim1 = useRef(new Animated.Value(0)).current;
    const glowAnim2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim1, { toValue: 1, duration: 4000, useNativeDriver: true }),
                Animated.timing(glowAnim1, { toValue: 0, duration: 4000, useNativeDriver: true }),
            ])
        ).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim2, { toValue: 1, duration: 5000, useNativeDriver: true }),
                Animated.timing(glowAnim2, { toValue: 0, duration: 5000, useNativeDriver: true }),
            ])
        ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                text2: error.response?.data?.detail || 'E-mail ou senha incorretos',
            });
        } finally {
            setLoading(false);
        }
    };

    const glow1Opacity = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
    const glow2Opacity = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] });

    return (
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
            {/* ── Background ambient glows ─────────────────────────────── */}
            <Animated.View style={[styles.glow1, { opacity: glow1Opacity }]} />
            <Animated.View style={[styles.glow2, { opacity: glow2Opacity }]} />

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
                        {/* ── Logo ──────────────────────────────────────────── */}
                        <View style={styles.logoContainer}>
                            <View style={styles.iconRing}>
                                <View style={styles.iconCircle}>
                                    <Leaf size={36} color="#22C55E" strokeWidth={2.5} />
                                </View>
                            </View>
                            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fonts.heading }]}>Desperdício Zero</Text>
                            <Text style={[styles.subtitle, { color: theme.textSecondary, fontFamily: theme.fonts.regular }]}>Gerencie sua despensa de forma inteligente</Text>
                        </View>

                        {/* ── Glassmorphism card ────────────────────────────── */}
                        <View style={[styles.glassCard, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder }]}>
                            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fonts.heading }]}>Entrar na sua conta</Text>

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
                                <Text style={styles.forgotText}>Esqueceu a senha?</Text>
                            </TouchableOpacity>

                            <PrimaryButton
                                label="Entrar"
                                onPress={handleLogin}
                                loading={loading}
                                style={styles.btnSpacing}
                            />

                            <View style={styles.divider}>
                                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                <Text style={[styles.dividerText, { color: theme.textMuted }]}>ou</Text>
                                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                            </View>

                            <View style={styles.signupContainer}>
                                <Text style={[styles.signupText, { color: theme.textSecondary }]}>Ainda não tem conta? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                    <Text style={[styles.signupLink, { color: theme.green }]}>Cadastre-se</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── Footer branding ───────────────────────────────── */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6 }}>
                            <Leaf size={14} color={theme.textMuted} />
                            <Text style={[styles.footerText, { color: theme.textMuted, marginTop: 0, fontFamily: theme.fonts.regular }]}>Seguro e criptografado</Text>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#080D14',
    },
    safe: {
        flex: 1,
    },
    // Ambient glow orbs
    glow1: {
        position: 'absolute',
        width: 340,
        height: 340,
        borderRadius: 170,
        backgroundColor: '#16A34A',
        top: -80,
        left: -80,
        // React Native doesn't support CSS blur, but a large low-opacity circle simulates ambient glow
    },
    glow2: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: '#0891B2',
        bottom: 20,
        right: -80,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 20,
    },
    // Logo area
    logoContainer: {
        alignItems: 'center',
        marginBottom: 36,
    },
    iconRing: {
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 2,
        borderColor: 'rgba(34, 197, 94, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        // Outer glow ring
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 18,
        elevation: 10,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#F0FDF4',
        marginBottom: 6,
        letterSpacing: -0.5,
        textShadowColor: 'rgba(34, 197, 94, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center',
        lineHeight: 20,
    },
    // Glass card
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 24,
        // Subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F0FDF4',
        marginBottom: 20,
        letterSpacing: -0.3,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 20,
        marginTop: -4,
    },
    forgotText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#22C55E',
    },
    btnSpacing: {
        marginBottom: 20,
    },
    // Divider
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
    },
    // Signup row
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    signupText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
    },
    signupLink: {
        fontSize: 14,
        fontWeight: '700',
        color: '#22C55E',
    },
    footerText: {
        textAlign: 'center',
        marginTop: 24,
        fontSize: 12,
        color: 'rgba(255,255,255,0.2)',
    },
});

export default LoginScreen;
