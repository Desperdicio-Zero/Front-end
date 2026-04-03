/**
 * App.tsx
 * =======
 * Raiz da aplicação. Configura Onboarding (primeira vez), NavigationContainer,
 * Stack Navigator, Toasts globais e registro de Push Notifications.
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';

import DashboardScreen from './src/screens/DashboardScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import StatsScreen from './src/screens/StatsScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ReceiptScanScreen from './src/screens/ReceiptScanScreen';
import DonationScreen from './src/screens/DonationScreen';
import OnboardingScreen, { hasSeenOnboarding } from './src/screens/OnboardingScreen';
import type { ScanResult } from './src/screens/ScannerScreen';
import type { PantryItem } from './src/services/api';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { registerForPushNotificationsAsync } from './src/services/notifications';

// ---------------------------------------------------------------------------
// Tipagem do Stack Navigator (garante type-safety nas navegações)
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Dashboard: undefined;
  AddItem: { itemToEdit?: PantryItem; scanResult?: ScanResult };
  Scanner: undefined;
  Stats: undefined;
  ItemDetail: { item: PantryItem };
  ReceiptScan: undefined;
  Donation: { item: PantryItem };
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// Inner navigator For Users 
// ---------------------------------------------------------------------------
function AppStack() {
  const { theme } = useTheme();
  const navTheme = theme.isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } };

  useEffect(() => {
    // Solicita o Token do dispositivo e avisa o servidor (FastAPI) em Background
    // Agora só registramos notificações se estiver na área logada
    registerForPushNotificationsAsync();
  }, []);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Dashboard"
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
        <Stack.Screen
          name="ReceiptScan"
          component={ReceiptScanScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="Donation"
          component={DonationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </>
  );
}

// ---------------------------------------------------------------------------
// Auth Navigator - For Login and Registration
// ---------------------------------------------------------------------------
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const { theme } = useTheme();
  return (
    <AuthStackNav.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: 'slide_from_right',
      }}
    >
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root Navigator - Switches between Login, Onboarding and App
// ---------------------------------------------------------------------------
function RootNavigator() {
  const { theme } = useTheme();
  const { userToken, isLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  const navTheme = theme.isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.headerBg, border: theme.border, text: theme.text, primary: theme.green, notification: theme.green } };

  // When user logs in, check if they've seen the onboarding already
  useEffect(() => {
    if (userToken) {
      hasSeenOnboarding().then((seen) => setShowOnboarding(!seen));
    } else {
      // Logged out — reset so we re-check on next login
      setShowOnboarding(null);
    }
  }, [userToken]);

  if (isLoading || (userToken && showOnboarding === null)) {
    return null; // aguarda verificação do AsyncStorage
  }

  // First login: show onboarding before entering the app
  if (userToken && showOnboarding) {
    return (
      <NavigationContainer theme={navTheme}>
        <OnboardingScreen onDone={() => setShowOnboarding(false)} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {userToken ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// ---------------------------------------------------------------------------
// App — entry point, sem lógica de onboarding (movida para RootNavigator)
// ---------------------------------------------------------------------------
export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <RootNavigator />
          <Toast
            config={{
              success: ({ text1, text2 }) => (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10, 15, 25, 0.95)',
                  paddingHorizontal: 16, paddingVertical: 12, borderRadius: 40,
                  borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.4)',
                  shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
                  marginTop: 10, maxWidth: '90%',
                }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <CheckCircle2 size={18} color="#4ADE80" strokeWidth={2.5} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    {text1 && <Text style={{ color: '#F0FDF4', fontSize: 14, fontWeight: '700' }}>{text1}</Text>}
                    {text2 && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{text2}</Text>}
                  </View>
                </View>
              ),
              error: ({ text1, text2 }) => (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10, 15, 25, 0.95)',
                  paddingHorizontal: 16, paddingVertical: 12, borderRadius: 40,
                  borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)',
                  shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
                  marginTop: 10, maxWidth: '90%',
                }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <AlertCircle size={18} color="#F87171" strokeWidth={2.5} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    {text1 && <Text style={{ color: '#FEF2F2', fontSize: 14, fontWeight: '700' }}>{text1}</Text>}
                    {text2 && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{text2}</Text>}
                  </View>
                </View>
              ),
            }}
            topOffset={55}
            visibilityTime={3500}
            autoHide={true}
          />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
