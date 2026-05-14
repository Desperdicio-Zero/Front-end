/**
 * src/screens/EditProfileScreen.tsx
 * ====================================
 * Tela de edição de perfil do usuário.
 * Permite alterar e-mail e/ou senha com confirmação da senha atual.
 * Design: Dark OLED + Glassmorphism, identidade visual do app.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Mail, ShieldCheck, User } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../contexts/ThemeContext';
import FormInput from '../components/FormInput';
import PrimaryButton from '../components/PrimaryButton';
import { getProfile, updateProfile, type UserProfile } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatMemberSince(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function getInitial(email: string): string {
  return (email?.[0] ?? '?').toUpperCase();
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  // Dados carregados do servidor
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Campos do formulário
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estado de envio
  const [saving, setSaving] = useState(false);

  // Touch state para validação visual
  const [emailTouched, setEmailTouched] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Validações derivadas
  const emailValid = EMAIL_REGEX.test(email);
  const newPasswordValid = newPassword.length === 0 || newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword;

  // -- Carrega perfil ao montar -----------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setEmail(data.email);
      } catch {
        Toast.show({ type: 'error', text1: t('common.error'), text2: t('editProfile.toast.error') });
        navigation.goBack();
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

  // -- Submissão --------------------------------------------------------------
  const handleSave = useCallback(async () => {
    // Validações locais
    if (!currentPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'error', text1: t('editProfile.toast.fillCurrent') });
      return;
    }
    if (!emailValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'error', text1: t('editProfile.toast.invalidEmail') });
      return;
    }
    if (newPassword && !newPasswordValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'error', text1: t('editProfile.toast.weakPassword') });
      return;
    }
    if (newPassword && !passwordsMatch) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'error', text1: t('editProfile.toast.passwordMismatch') });
      return;
    }

    const hasEmailChange = email.trim() !== profile?.email;
    const hasPasswordChange = newPassword.length > 0;

    if (!hasEmailChange && !hasPasswordChange) {
      Toast.show({ type: 'error', text1: t('editProfile.toast.noChanges') });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        currentPassword,
        newEmail: hasEmailChange ? email.trim() : undefined,
        newPassword: hasPasswordChange ? newPassword : undefined,
      });
      setProfile(updated);
      setEmail(updated.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({ type: 'success', text1: t('editProfile.toast.success') });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err?.response?.data?.detail || t('editProfile.toast.error');
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setSaving(false);
    }
  }, [currentPassword, email, newPassword, confirmPassword, profile, emailValid, newPasswordValid, passwordsMatch, t]);

  // -- Loading skeleton -------------------------------------------------------
  if (loadingProfile) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.green} />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={22} color={theme.green} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>
          {t('editProfile.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatarRing, { borderColor: theme.green + '60' }]}>
              <View style={[styles.avatar, { backgroundColor: theme.green + '22' }]}>
                <Text style={[styles.avatarInitial, { color: theme.green, fontFamily: theme.fonts?.heading }]}>
                  {getInitial(profile?.email ?? '')}
                </Text>
              </View>
            </View>
            <Text style={[styles.avatarEmail, { color: theme.text, fontFamily: theme.fonts?.heading }]}>
              {profile?.email}
            </Text>
            {profile?.createdAt && (
              <Text style={[styles.memberSince, { color: theme.textMuted, fontFamily: theme.fonts?.regular }]}>
                {t('editProfile.memberSince', { date: formatMemberSince(profile.createdAt) })}
              </Text>
            )}
          </View>

          {/* Card: Dados da conta */}
          <View style={[styles.card, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder }]}>
            <View style={styles.sectionHeader}>
              <User size={16} color={theme.green} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontFamily: theme.fonts?.heading }]}>
                {t('editProfile.section.account')}
              </Text>
            </View>

            <FormInput
              label={t('editProfile.email')}
              value={email}
              onChangeText={(v) => { setEmail(v); setEmailTouched(true); }}
              placeholder={t('editProfile.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              valid={emailTouched ? emailValid : undefined}
              error={emailTouched && !emailValid ? t('editProfile.emailError') : undefined}
            />
          </View>

          {/* Card: Segurança */}
          <View style={[styles.card, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder }]}>
            <View style={styles.sectionHeader}>
              <Lock size={16} color={theme.green} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontFamily: theme.fonts?.heading }]}>
                {t('editProfile.section.security')}
              </Text>
            </View>

            <FormInput
              label={t('editProfile.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t('editProfile.currentPasswordPlaceholder')}
              isPassword
            />
            <Text style={[styles.hint, { color: theme.textMuted, fontFamily: theme.fonts?.regular }]}>
              {t('editProfile.currentPasswordHint')}
            </Text>

            <View style={styles.divider} />

            <FormInput
              label={t('editProfile.newPassword')}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setNewPasswordTouched(true); }}
              placeholder={t('editProfile.newPasswordPlaceholder')}
              isPassword
              error={newPasswordTouched && !newPasswordValid ? t('editProfile.newPasswordError') : undefined}
            />

            <FormInput
              label={t('editProfile.confirmPassword')}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setConfirmTouched(true); }}
              placeholder={t('editProfile.newPasswordPlaceholder')}
              isPassword
              valid={confirmTouched && newPassword.length > 0 ? passwordsMatch : undefined}
              error={confirmTouched && newPassword.length > 0 && !passwordsMatch ? t('editProfile.confirmPasswordError') : undefined}
            />
          </View>

          {/* Botão salvar */}
          <PrimaryButton
            label={t('editProfile.saveBtn')}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />

          {/* Footer de segurança */}
          <View style={styles.footer}>
            <ShieldCheck size={14} color={theme.textMuted} strokeWidth={2} />
            <Text style={[styles.footerText, { color: theme.textMuted, fontFamily: theme.fonts?.regular }]}>
              {t('editProfile.secure')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
function makeStyles(theme: ReturnType<typeof import('../contexts/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenBg,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
    },

    // Avatar
    avatarSection: {
      alignItems: 'center',
      marginBottom: 28,
    },
    avatarRing: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 36,
      fontWeight: '700',
    },
    avatarEmail: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    memberSince: {
      fontSize: 13,
    },

    // Cards
    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    hint: {
      fontSize: 12,
      marginTop: -8,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 12,
    },

    // Botão
    saveBtn: {
      marginTop: 4,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 20,
    },
    footerText: {
      fontSize: 12,
    },
  });
}

export default EditProfileScreen;
