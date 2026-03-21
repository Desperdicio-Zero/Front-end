/**
 * src/components/PrimaryButton.tsx
 * Botão primário padronizado com feedback de pressão e estado de loading.
 * Dark mode: texto #000 no sólido (contraste no verde vibrante).
 * Light mode: texto #fff no sólido (contraste no verde escuro).
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'solid' | 'outline' | 'ghost';
    style?: object;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
    label,
    onPress,
    loading = false,
    disabled = false,
    variant = 'solid',
    style,
}) => {
    const { theme } = useTheme();
    const isDisabled = disabled || loading;

    // No dark mode, verde é #22C55E (claro) → texto preto para contraste.
    // No light mode, verde é #16A34A (escuro) → texto branco para contraste.
    const solidTextColor = theme.isDark ? '#000000' : '#FFFFFF';
    // Glow localizado no escuro, sombra sutil no claro
    const solidShadow = theme.isDark
        ? { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 8 }
        : { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 };

    return (
        <Pressable
            onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPress();
            }}
            disabled={isDisabled}
            style={({ pressed }) => [
                styles.base,
                variant === 'solid' && {
                    backgroundColor: theme.green,
                    shadowColor: theme.green,
                    ...solidShadow,
                },
                variant === 'outline' && {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: theme.green,
                    shadowOpacity: 0,
                    elevation: 0,
                },
                variant === 'ghost' && {
                    backgroundColor: 'transparent',
                    shadowOpacity: 0,
                    elevation: 0,
                },
                isDisabled && styles.disabled,
                pressed && !isDisabled && styles.pressed,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'solid' ? solidTextColor : theme.green} />
            ) : (
                <Text style={[
                    styles.label,
                    { fontFamily: theme.fonts?.medium },
                    variant === 'solid' && { color: solidTextColor },
                    variant === 'outline' && { color: theme.green },
                    variant === 'ghost' && { color: theme.green },
                ]}>
                    {label}
                </Text>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    pressed: {
        transform: [{ scale: 0.97 }],
        shadowOpacity: 0.15,
        elevation: 2,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default PrimaryButton;
