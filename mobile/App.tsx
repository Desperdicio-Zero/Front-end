/**
 * App.tsx
 * =======
 * Raiz da aplicação. Configura o NavigationContainer e o Stack Navigator
 * com as duas telas principais: Dashboard e AddItem.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import StatsScreen from './src/screens/StatsScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import type { ScanResult } from './src/screens/ScannerScreen';
import type { PantryItem } from './src/services/api';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Tipagem do Stack Navigator (garante type-safety nas navegações)
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AddItem: { itemToEdit?: PantryItem; scanResult?: ScanResult };
  Scanner: undefined;
  Stats: undefined;
  ItemDetail: { item: PantryItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// Inner navigator — has access to ThemeContext
// ---------------------------------------------------------------------------
function AppNavigator() {
  const { theme } = useTheme();
  const navTheme = theme.isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.green,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddItem"
          component={AddItemScreen}
          options={({ route }) => ({
            title: route.params?.itemToEdit ? 'Editar Item' : 'Novo Item',
            headerBackTitle: 'Voltar',
          })}
        />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ItemDetail"
          component={ItemDetailScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
