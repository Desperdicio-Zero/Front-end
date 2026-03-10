/**
 * src/contexts/ThemeContext.tsx
 * ==============================
 * Contexto de tema claro/escuro para toda a aplicação.
 * - Detecta automaticamente a preferência do sistema (useColorScheme).
 * - Permite override manual pelo usuário via toggleTheme().
 * - Expõe o hook useTheme() para qualquer componente acessar cores e isDark.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

// ---------------------------------------------------------------------------
// Paletas de cores
// ---------------------------------------------------------------------------
export interface AppTheme {
  isDark: boolean;
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
  // Modal
  modalBg: string;
  // Overlays
  overlay: string;
}

const LIGHT: AppTheme = {
  isDark: false,
  bg: '#F9FAFB',
  bgSecondary: '#F3F4F6',
  card: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  headerBg: '#FFFFFF',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E7EB',
  chipBg: '#F9FAFB',
  chipBorder: '#D1D5DB',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#86EFAC',
  urgentBg: '#FFF1F2',
  warnBg: '#FEFCE8',
  okBg: '#F0FDF4',
  modalBg: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.04)',
};

const DARK: AppTheme = {
  isDark: true,
  bg: '#0F172A',
  bgSecondary: '#1E293B',
  card: '#1E293B',
  border: '#334155',
  borderLight: '#243048',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  headerBg: '#1E293B',
  inputBg: '#334155',
  inputBorder: '#475569',
  chipBg: '#334155',
  chipBorder: '#475569',
  green: '#22C55E',
  greenBg: '#14532D',
  greenBorder: '#166534',
  urgentBg: '#450A0A',
  warnBg: '#431A01',
  okBg: '#14532D',
  modalBg: '#1E293B',
  overlay: 'rgba(255,255,255,0.04)',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface ThemeContextValue {
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: LIGHT,
  toggleTheme: () => { },
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [forced, setForced] = useState<'light' | 'dark' | null>(null);

  const effective = forced ?? 'light'; // padrão: sempre claro, independente do sistema
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
