import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axios from 'axios';
import { BASE_URL } from './api';

// Configura como os alertas devem aparecer se o usuário estiver com o App aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  // Emulações limitadas no Expo Go não geram Device Tokens verdadeiros do Google/Apple.
  // Precisamos avisar a aplicação usando isDevice
  if (Device.isDevice || !Device.isDevice) { // Forçamos continuar para pegar o ExponentToken temporário pra Debug
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Se ainda não permitiu, abre o popup do Celular
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Usuário bloqueou as notificações
    if (finalStatus !== 'granted') {
      console.log('[NOTIF] Permissão negada pelo usuário.');
      return;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        // Fallback pra criar chave temporária de projeto unlinked
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      console.log("[NOTIF] Token do Aparelho Obtido:", token);
    } catch (e) {
      console.error("[NOTIF] Erro ao extrair Push Token:", e);
    }
  } else {
    // Aparelho Físico não detectado - Para avisos Push a bateria/sistema físico é priorizado pelo Google Cloud Messaging
    console.log('[NOTIF] Must use physical device for Push Notifications');
  }

  // 2. Android Requirements (Canais de Notificações a partir do Android 8.0)
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Vencimentos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
    });
  }

  // 3. Cadastra o Token no nosso Backend Python
  if (token) {
    try {
      await axios.post(`${BASE_URL}/devices/register`, { expo_push_token: token });
      console.log(`[NOTIF] Aparelho guardado/atualizado na base MySQL`);
    } catch (e) {
      console.error("[NOTIF] Falha ao informar Token ao Backend MySQL", e);
    }
  }

  return token;
}
