/**
 * src/components/FormInput.tsx
 * Input padronizado com: borda de foco, ícone de validação, toggle de senha.
 * Usado em todas as telas do app.
 */

import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from 'react-native';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';

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
    const [focused, setFocused] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);

    const showError = !!error;

    return (
        <View style={styles.group}>
            <Text style={[styles.label, focused && { color: theme.green }]}>
                {label}
            </Text>

            <View
                style={[
                    styles.wrapper,
                    { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                    focused && { borderColor: theme.green, shadowColor: theme.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
                    showError && { borderColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.15 },
                    valid && !showError && { borderColor: '#16A34A' },
                ]}
            >
                <TextInput
                    style={[styles.input, { color: theme.text }, style]}
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={isPassword && !passwordVisible}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...rest}
                />

                {/* Ícone de validação */}
                {!isPassword && valid !== undefined && (
                    valid
                        ? <CheckCircle2 size={18} color="#16A34A" strokeWidth={2} style={styles.icon} />
                        : showError
                            ? <AlertCircle size={18} color="#EF4444" strokeWidth={2} style={styles.icon} />
                            : null
                )}

                {/* Toggle de senha */}
                {isPassword && (
                    <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setPasswordVisible(v => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {passwordVisible
                            ? <EyeOff size={20} color={theme.textMuted} strokeWidth={2} />
                            : <Eye size={20} color={theme.textMuted} strokeWidth={2} />}
                    </TouchableOpacity>
                )}
            </View>

            {showError && (
                <Text style={styles.errorText}>{error}</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    group: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    icon: {
        marginRight: 12,
    },
    eyeBtn: {
        padding: 14,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 2,
    },
});

export default FormInput;
