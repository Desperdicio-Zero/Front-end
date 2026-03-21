/**
 * src/screens/OnboardingScreen.tsx
 * ==================================
 * Redesigned with Dark OLED + Glassmorphism theme.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaf, ScanLine, ChefHat } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@desperdicio_zero_onboarding_v2';

export const markOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done');
};

export const hasSeenOnboarding = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'done';
};

const slides = [
    {
        id: '1',
        icon: <Leaf size={72} color="#22C55E" strokeWidth={1.5} />,
        title: 'Chega de Desperdício!',
        subtitle: 'Cadastre os alimentos da sua despensa e acompanhe as validades em tempo real com um semáforo inteligente.',
        accent: '#22C55E',
        glowColor: 'rgba(34,197,94,0.25)',
        iconBg: 'rgba(34,197,94,0.12)',
        iconBorder: 'rgba(34,197,94,0.3)',
    },
    {
        id: '2',
        icon: <ScanLine size={72} color="#38BDF8" strokeWidth={1.5} />,
        title: 'Escaneie o Código de Barras',
        subtitle: 'Aponte a câmera para qualquer produto e o app preenche automaticamente nome, categoria e quantidade.',
        accent: '#38BDF8',
        glowColor: 'rgba(56,189,248,0.25)',
        iconBg: 'rgba(56,189,248,0.12)',
        iconBorder: 'rgba(56,189,248,0.3)',
    },
    {
        id: '3',
        icon: <ChefHat size={72} color="#F59E0B" strokeWidth={1.5} />,
        title: 'Receitas com IA',
        subtitle: 'Quando algo estiver prestes a vencer, a IA Google Gemini sugere receitas criativas para você usar e não jogar fora.',
        accent: '#F59E0B',
        glowColor: 'rgba(245,158,11,0.25)',
        iconBg: 'rgba(245,158,11,0.12)',
        iconBorder: 'rgba(245,158,11,0.3)',
    },
];

type Props = {
    onDone?: () => void;
} & Partial<NativeStackScreenProps<RootStackParamList, 'Onboarding'>>;

const OnboardingScreen: React.FC<Props> = ({ onDone, navigation }) => {
    const { theme } = useTheme();
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (activeIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
        } else {
            await markOnboardingDone();
            if (onDone) {
                onDone();
            } else if (navigation) {
                navigation.goBack();
            }
        }
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await markOnboardingDone();
        if (onDone) {
            onDone();
        } else if (navigation) {
            navigation.goBack();
        }
    };

    const currentSlide = slides[activeIndex];

    // -- Fade + slide-up animation when active slide changes --
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(18);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex]);

    return (
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
            {/* Dynamic ambient glow that shifts per slide */}
            <Animated.View style={[styles.ambientGlow, { backgroundColor: currentSlide.glowColor }]} />

            <SafeAreaView style={styles.safe}>
                {/* Skip */}
                <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                    <Text style={[styles.skipText, { color: currentSlide.accent, fontFamily: theme.fonts?.medium }]}>Pular</Text>
                </TouchableOpacity>

                {/* Slides */}
                <Animated.FlatList
                    ref={flatListRef}
                    data={slides}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                        { useNativeDriver: false }
                    )}
                    onMomentumScrollEnd={(e) => {
                        const index = Math.round(e.nativeEvent.contentOffset.x / width);
                        setActiveIndex(index);
                    }}
                    renderItem={({ item }) => (
                        <View style={styles.slide}>
                            {/* Glass icon container */}
                            <Animated.View
                                style={[
                                    styles.iconContainer,
                                    {
                                        backgroundColor: theme.isDark ? item.iconBg : 'rgba(255,255,255,0.8)',
                                        borderColor: item.iconBorder,
                                        shadowColor: item.accent,
                                        opacity: fadeAnim,
                                        transform: [{ translateY: slideAnim }],
                                    }
                                ]}
                            >
                                {item.icon}
                            </Animated.View>

                            {/* Glass content card */}
                            <Animated.View
                                style={[
                                    styles.slideCard,
                                    { backgroundColor: theme.headerBg, borderColor: theme.border, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                                ]}
                            >
                                <Text style={[styles.slideTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>{item.title}</Text>
                                <Text style={[styles.slideSubtitle, { color: theme.textSecondary, fontFamily: theme.fonts?.regular }]}>{item.subtitle}</Text>
                            </Animated.View>
                        </View>
                    )}
                />

                {/* Dots */}
                <View style={styles.dotsRow}>
                    {slides.map((_, i) => {
                        const opacity = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [0.25, 1, 0.25],
                            extrapolate: 'clamp',
                        });
                        const scaleX = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [1, 2.4, 1],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View
                                key={i}
                                style={[styles.dot, {
                                    backgroundColor: currentSlide.accent,
                                    opacity,
                                    transform: [{ scaleX }],
                                }]}
                            />
                        );
                    })}
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                    style={[styles.nextBtn, {
                        borderColor: currentSlide.accent,
                        shadowColor: currentSlide.accent,
                    }]}
                    onPress={handleNext}
                    activeOpacity={0.85}
                >
                    <View style={[styles.nextBtnInner, { backgroundColor: currentSlide.accent }]}>
                        <Text style={[styles.nextBtnText, { fontFamily: theme.fonts?.medium }]}>
                            {activeIndex === slides.length - 1 ? 'Começar Agora →' : 'Próximo →'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View style={{ height: 24 }} />
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080D14' },
    safe: { flex: 1, alignItems: 'center' },
    ambientGlow: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        top: -100,
        alignSelf: 'center',
        opacity: 0.4,
    },
    skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 14 },
    skipText: { fontSize: 15, fontWeight: '600' },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 20,
        gap: 24,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
    },
    slideCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 24,
        width: '100%',
        gap: 12,
    },
    slideTitle: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    slideSubtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
        lineHeight: 23,
    },
    dotsRow: { flexDirection: 'row', gap: 6, marginVertical: 28 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    nextBtn: {
        borderRadius: 99,
        borderWidth: 1.5,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 8,
    },
    nextBtnInner: {
        paddingHorizontal: 52,
        paddingVertical: 16,
        borderRadius: 99,
    },
    nextBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});

export default OnboardingScreen;
