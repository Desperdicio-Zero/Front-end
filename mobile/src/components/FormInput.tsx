/**
 * src/components/FormInput.tsx
 * Input padronizado — theme-aware (Dark OLED + Light Premium).
 * Fix iOS keyboard flicker e Floating Label Pro Max.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    Animated,
} from 'react-native';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface FormInputProps extends TextInputProps {
    label: string;
    error?: string;
    valid?: boolean;
    isPassword?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
    label,
    error,
    valid,
    isPassword = false,
    style,
    ...rest
}) => {
    const { theme } = useTheme();
    const [passwordVisible, setPasswordVisible] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    // ── KEY FIX: Animated.Value para foco e Floating Label
    const borderAnim = useRef(new Animated.Value(0)).current;
    
    // Convertemos null/undefined em boolean confiavel
    const hasValue = rest.value !== undefined && rest.value !== null && rest.value.length > 0;
    const floatAnim = useRef(new Animated.Value(hasValue ? 1 : 0)).current;
    const showError = !!error;

    useEffect(() => {
        Animated.timing(floatAnim, {
            toValue: (isFocused || hasValue) ? 1 : 0,
            duration: 180,
            useNativeDriver: false,
        }).start();
    }, [isFocused, hasValue, floatAnim]);

    const handleFocus = useCallback((e: any) => {
        setIsFocused(true);
        Haptics.selectionAsync().catch(() => {});
        Animated.timing(borderAnim, {
            toValue: 1, duration: 180, useNativeDriver: false,
        }).start();
        if (rest.onFocus) rest.onFocus(e);
    }, [borderAnim, rest]);

    const handleBlur = useCallback((e: any) => {
        setIsFocused(false);
        Animated.timing(borderAnim, {
            toValue: 0, duration: 180, useNativeDriver: false,
        }).start();
        if (rest.onBlur) rest.onBlur(e);
    }, [borderAnim, rest]);

    // Cores dinâmicas por tema + estado
    const idleBorder = showError
        ? '#EF4444'
        : valid
            ? theme.green
            : theme.inputBorder;
    const focusBorder = showError ? '#EF4444' : theme.green;

    const borderColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [idleBorder, focusBorder],
    });
    const shadowOpacity = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, theme.isDark ? 0.35 : 0.18],
    });

    return (
        <View style={styles.group}>
            <Animated.View
                style={[
                    styles.wrapper,
                    {
                        backgroundColor: theme.inputBg,
                        borderColor,
                        shadowColor: showError ? '#EF4444' : theme.green,
                        shadowOpacity,
                        shadowOffset: { width: 0, height: 0 },
                        shadowRadius: theme.isDark ? 8 : 5,
                    },
                ]}
            >
                {/* Floating Label */}
                <Animated.Text
                    style={{
                        position: 'absolute',
                        left: 16,
                        top: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 6] }),
                        fontSize: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] }),
                        color: floatAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [theme.textMuted, isFocused ? theme.green : theme.textSecondary]
                        }),
                        fontWeight: '600',
                        fontFamily: theme.fonts?.medium,
                    }}
                >
                    {label}
                </Animated.Text>

                <TextInput
                    style={[
                        styles.input, 
                        { color: theme.text, fontFamily: theme.fonts?.regular }, 
                        style
                    ]}
                    // Quando não focado e sem valor, o placeholder nativo fica invisível (pois o Label ocupa o lugar)
                    placeholderTextColor="transparent"
                    secureTextEntry={isPassword && !passwordVisible}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    autoCorrect={false}
                    autoComplete="off"
                    accessibilityLabel={label}
                    accessibilityHint={error || `Caixa de texto para ${label}`}
                    {...rest}
                />

                {/* Ícone de validação */}
                {!isPassword && valid !== undefined && (
                    valid
                        ? <CheckCircle2 size={18} color={theme.green} strokeWidth={2} style={styles.icon} />
                        : showError
                            ? <AlertCircle size={18} color="#EF4444" strokeWidth={2} style={styles.icon} />
                            : null
                )}

                {/* Toggle senha */}
                {isPassword && (
                    <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setPasswordVisible(v => !v);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={passwordVisible ? "Ocultar senha" : "Exibir senha"}
                    >
                        {passwordVisible
                            ? <EyeOff size={20} color={theme.textMuted} strokeWidth={2} />
                            : <Eye size={20} color={theme.textMuted} strokeWidth={2} />}
                    </TouchableOpacity>
                )}
            </Animated.View>

            {showError && (
                <Text style={styles.errorText}>{error}</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    group: {
        marginBottom: 18,
    },
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 14,
        elevation: 2,
        position: 'relative',
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 24, // Espaço maior pro label em cima
        paddingBottom: 8,
        fontSize: 16,
    },
    icon: {
        marginRight: 14,
    },
    eyeBtn: {
        paddingHorizontal: 14,
        paddingTop: 24,
        paddingBottom: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 5,
        marginLeft: 4,
    },
});

export default FormInput;
