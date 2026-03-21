/**
 * src/contexts/ThemeContext.tsx
 * ==============================
 * Contexto de tema claro/escuro padronizado com o sistema de design tokens
 * utilizado em todas as telas — Dark OLED + Light Premium.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

// ---------------------------------------------------------------------------
// Interface de tokens
// ---------------------------------------------------------------------------
export interface AppTheme {
  isDark: boolean;
  fonts: {
    regular: string;
    medium: string;
    bold: string;
    heading: string;
  };
  // Backgrounds
  bg: string;
  bgSecondary: string;
  card: string;
  // Borders
  border: string;
  borderLight: string;
  // Textos
  text: string;
  textSecondary: string;
  textMuted: string;
  // Header
  headerBg: string;
  // Input / Search
  inputBg: string;
  inputBorder: string;
  // Chips de filtro
  chipBg: string;
  chipBorder: string;
  // Acentos verdes
  green: string;
  greenBg: string;
  greenBorder: string;
  // Cards de urgência (backgrounds sutis)
  urgentBg: string;
  warnBg: string;
  okBg: string;
  // Glassmorphism (adaptado para claro/escuro)
  glassBg: string;
  glassBorder: string;
  // Modal
  modalBg: string;
  // Overlays
  overlay: string;
}

// ---------------------------------------------------------------------------
// DARK — OLED Black + Glassmorphism (tokens usados nas screens redesenhadas)
// ---------------------------------------------------------------------------
const DARK: AppTheme = {
  isDark: true,
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    bold: 'Inter_700Bold',
    heading: 'Outfit_700Bold',
  },
  // Backgrounds
  bg: '#060A10',
  bgSecondary: '#080D14',
  card: '#0F1923',
  // Borders
  border: 'rgba(255,255,255,0.10)',
  borderLight: 'rgba(255,255,255,0.06)',
  // Textos
  text: '#F0FDF4',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.25)',
  // Header
  headerBg: '#060A10',
  // Input
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  // Chips
  chipBg: 'rgba(255,255,255,0.05)',
  chipBorder: 'rgba(255,255,255,0.12)',
  // Verde  (#22C55E — Tailwind green-500: vivo, legível no OLED)
  green: '#22C55E',
  greenBg: 'rgba(34,197,94,0.10)',
  greenBorder: 'rgba(34,197,94,0.35)',
  // Urgência (semi-transparente para manter vidro)
  urgentBg: 'rgba(239,68,68,0.10)',
  warnBg: 'rgba(234,179,8,0.10)',
  okBg: 'rgba(34,197,94,0.10)',
  // Glassmorphism
  glassBg: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',
  // Modal
  modalBg: '#080D14',
  overlay: 'rgba(0,0,0,0.75)',
};

// ---------------------------------------------------------------------------
// LIGHT — Premium Clean (alto contraste, leve e moderno)
// ---------------------------------------------------------------------------
const LIGHT: AppTheme = {
  isDark: false,
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    bold: 'Inter_700Bold',
    heading: 'Outfit_700Bold',
  },
  // Backgrounds
  bg: '#F8FAFC',
  bgSecondary: '#F1F5F9',
  card: '#FFFFFF',
  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  // Textos (WCAG AA mínimo)
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  // Header
  headerBg: '#FFFFFF',
  // Input
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  // Chips
  chipBg: '#F1F5F9',
  chipBorder: '#CBD5E1',
  // Verde (#16A34A — Tailwind green-700: legível no branco)
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#86EFAC',
  // Urgência
  urgentBg: '#FFF1F2',
  warnBg: '#FEFCE8',
  okBg: '#F0FDF4',
  // Glassmorphism
  glassBg: 'rgba(255,255,255,0.85)',
  glassBorder: 'rgba(0,0,0,0.08)',
  // Modal
  modalBg: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.50)',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface ThemeContextValue {
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DARK,
  toggleTheme: () => { },
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [forced, setForced] = useState<'light' | 'dark' | null>(null);

  // Padrão: DARK (conforme redesign do app)
  const effective = forced ?? 'dark';
  const theme = effective === 'dark' ? DARK : LIGHT;

  const toggleTheme = useCallback(() => {
    setForced((prev) => {
      if (prev === null) return effective === 'dark' ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [effective]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
