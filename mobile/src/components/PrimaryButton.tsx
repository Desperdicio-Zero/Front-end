/**
 * src/components/PrimaryButton.tsx
 * Botão primário padronizado com feedback de pressão (scale) e estado de loading.
 * Usado em todas as telas do app.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

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

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            style={({ pressed }) => [
                styles.base,
                variant === 'solid' && {
                    backgroundColor: theme.green,
                    shadowColor: theme.green,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 6,
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
                <ActivityIndicator color={variant === 'solid' ? '#fff' : theme.green} />
            ) : (
                <Text style={[
                    styles.label,
                    variant === 'solid' && { color: '#fff' },
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
        shadowOpacity: 0.12,
        elevation: 2,
    },
    disabled: {
        opacity: 0.55,
    },
});

export default PrimaryButton;
