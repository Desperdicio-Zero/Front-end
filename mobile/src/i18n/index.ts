/**
 * src/i18n/index.ts
 * ===================
 * Configuração do i18next para o app Desperdício Zero.
 * - Detecta o idioma do dispositivo via expo-localization
 * - Persiste a escolha do usuário via AsyncStorage
 * - Suporta pt-BR e en-US, com fallback para pt
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import pt from './locales/pt.json';
import en from './locales/en.json';

const LANGUAGE_KEY = '@desperdicio_zero_language';

const resources = {
  pt: { translation: pt },
  en: { translation: en },
};

// Detecta o idioma do sistema operacional
const getDeviceLanguage = (): string => {
  const locale = Localization.getLocales?.()?.[0]?.languageCode ?? 'pt';
  return locale.startsWith('en') ? 'en' : 'pt';
};

// Inicializa o i18n com o idioma salvo ou o idioma do sistema
const initI18n = async () => {
  let savedLanguage: string | null = null;

  try {
    savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    // AsyncStorage falhou — usa padrão do sistema
  }

  const language = savedLanguage ?? getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });
};

// Função utilitária para trocar o idioma e persistir
export const changeLanguage = async (lang: 'pt' | 'en') => {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Ignora erros de persistência
  }
};

// Retorna o idioma atual
export const getCurrentLanguage = (): string => i18n.language;

initI18n();

export default i18n;
