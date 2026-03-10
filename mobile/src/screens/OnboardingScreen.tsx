/**
 * src/screens/OnboardingScreen.tsx
 * ==================================
 * Carrossel de boas-vindas exibido apenas na primeira vez que o app é aberto.
 * Usa AsyncStorage para persistir que o usuário já completou o tutorial.
 */

import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaf, ScanLine, ChefHat } from 'lucide-react-native';

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
        icon: <Leaf size={80} color="#16A34A" strokeWidth={1.5} />,
        title: 'Chega de Desperdício!',
        subtitle:
            'Cadastre os alimentos da sua despensa e acompanhe as validades em tempo real com um semáforo inteligente.',
        bg: '#F0FDF4',
        accent: '#16A34A',
    },
    {
        id: '2',
        icon: <ScanLine size={80} color="#2563EB" strokeWidth={1.5} />,
        title: 'Escaneie o Código de Barras',
        subtitle:
            'Aponte a câmera para qualquer produto e o aplicativo preenche automaticamente nome, categoria e quantidade.',
        bg: '#EFF6FF',
        accent: '#2563EB',
    },
    {
        id: '3',
        icon: <ChefHat size={80} color="#D97706" strokeWidth={1.5} />,
        title: 'Receitas com Inteligência Artificial',
        subtitle:
            'Quando algo estiver prestes a vencer, a IA Google Gemini sugere receitas criativas para você usar e não jogar fora.',
        bg: '#FFFBEB',
        accent: '#D97706',
    },
];

interface Props {
    onDone: () => void;
}

const OnboardingScreen: React.FC<Props> = ({ onDone }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = async () => {
        if (activeIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
        } else {
            await markOnboardingDone();
            onDone();
        }
    };

    const handleSkip = async () => {
        await markOnboardingDone();
        onDone();
    };

    const currentAccent = slides[activeIndex].accent;

    return (
        <SafeAreaView style={styles.container}>
            {/* Skip */}
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Text style={[styles.skipText, { color: currentAccent }]}>Pular</Text>
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
                    <View style={[styles.slide, { backgroundColor: item.bg }]}>
                        <View style={styles.iconContainer}>{item.icon}</View>
                        <Text style={[styles.title, { color: item.accent }]}>{item.title}</Text>
                        <Text style={styles.subtitle}>{item.subtitle}</Text>
                    </View>
                )}
            />

            {/* Dots */}
            <View style={styles.dotsRow}>
                {slides.map((_, i) => {
                    const opacity = scrollX.interpolate({
                        inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });
                    const scale = scrollX.interpolate({
                        inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                        outputRange: [0.8, 1.3, 0.8],
                        extrapolate: 'clamp',
                    });
                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: currentAccent, opacity, transform: [{ scale }] },
                            ]}
                        />
                    );
                })}
            </View>

            {/* Button */}
            <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: currentAccent }]}
                onPress={handleNext}
                activeOpacity={0.85}
            >
                <Text style={styles.nextBtnText}>
                    {activeIndex === slides.length - 1 ? 'Começar Agora 🚀' : 'Próximo →'}
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    skipBtn: {
        alignSelf: 'flex-end',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    skipText: {
        fontSize: 15,
        fontWeight: '600',
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingBottom: 40,
        flex: 1,
    },
    iconContainer: {
        marginBottom: 32,
        padding: 28,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 24,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 8,
        marginVertical: 24,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    nextBtn: {
        marginBottom: 32,
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 99,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    nextBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});

export default OnboardingScreen;
