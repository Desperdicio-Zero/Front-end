import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from './api';

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

      try {
        if (!projectId) {
          // Expo Go / dev: token sem projectId
          token = (await Notifications.getExpoPushTokenAsync()).data;
        } else {
          // EAS (quando o projeto está corretamente linkado)
          token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        }
      } catch (innerError) {
        // Em dev é comum o projectId não existir/estar incorreto e o Expo retornar 400 EXPERIENCE_NOT_FOUND.
        // Faz fallback sem projectId para não atrapalhar o fluxo do app.
        try {
          console.warn('[NOTIF] Falha ao obter token com projectId; tentando fallback sem projectId.');
          token = (await Notifications.getExpoPushTokenAsync()).data;
        } catch {
          console.warn('[NOTIF] Push token indisponível neste ambiente (Expo Go/dev).');
          return;
        }
      }
      console.log("[NOTIF] Token do Aparelho Obtido:", token);
    } catch (e) {
      console.warn('[NOTIF] Não foi possível obter Push Token (seguindo sem push).');
      return;
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

  // 3. Cadastra o Token no nosso Backend
  if (token) {
    try {
      await apiClient.post('/devices/register', { pushToken: token });
      console.log(`[NOTIF] Aparelho guardado/atualizado na base MySQL`);
    } catch (e) {
      console.error("[NOTIF] Falha ao informar Token ao Backend MySQL", e);
    }
  }

  return token;
}
