/**
 * src/screens/LoginScreen.tsx
 * ============================
 * Tela de login do Desperdício Zero.
 * Por enquanto, o botão ENTRAR navega diretamente para o Dashboard
 * sem validação de back-end (ainda não implementado).
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Leaf, Lock, Mail } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // Back-end ainda não implementado — acesso direto ao Dashboard
    navigation.replace('Dashboard');
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={s.inner}>

          {/* Logo / Marca */}
          <View style={s.brandRow}>
            <View style={[s.iconWrap, { backgroundColor: theme.greenBg }]}>
              <Leaf size={40} color={theme.green} strokeWidth={1.8} />
            </View>
            <Text style={[s.appName, { color: theme.green }]}>Desperdício Zero</Text>
            <Text style={[s.tagline, { color: theme.textMuted }]}>
              Reduza o desperdício, valorize cada alimento.
            </Text>
          </View>

          {/* Card de formulário */}
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

            {/* E-mail */}
            <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>E-mail</Text>
            <View style={[s.inputRow, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Mail size={16} color={theme.textMuted} strokeWidth={2} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="seu@email.com"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Senha */}
            <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 14 }]}>Senha</Text>
            <View style={[s.inputRow, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Lock size={16} color={theme.textMuted} strokeWidth={2} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Esqueci a senha */}
            <TouchableOpacity style={s.forgotBtn} onPress={() => {}}>
              <Text style={[s.forgotText, { color: theme.green }]}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Botão ENTRAR */}
            <TouchableOpacity
              style={[s.loginBtn, { backgroundColor: theme.green }]}
              onPress={handleLogin}
              activeOpacity={0.85}
            >
              <Text style={s.loginBtnText}>ENTRAR</Text>
            </TouchableOpacity>
          </View>

          {/* Cadastro */}
          <View style={s.signupRow}>
            <Text style={[s.signupText, { color: theme.textMuted }]}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={[s.signupLink, { color: theme.green }]}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  brandRow: {
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loginBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 13,
  },
  signupLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default LoginScreen;
