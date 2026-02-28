/**
 * src/services/notifications.ts
 * ==============================
 * Serviço de notificações push locais.
 *
 * Estratégias implementadas:
 * 1. scheduleExpiryNotifications — resumo imediato (1x por sessão) se houver itens vermelhos.
 * 2. schedulePerItemNotifications — agenda uma notificação 2 dias antes + no dia do vencimento
 *    de cada item. Cancela agendamentos antigos antes de recriar.
 */

import * as Notifications from 'expo-notifications';
import type { PantryItem } from './api';

// Exibe notificação mesmo se o app estiver em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Controle de sessão: dispara o resumo no máximo uma vez por abertura do app
let notifiedThisSession = false;

/** Solicita permissão ao usuário (Android 13+ e iOS exigem). */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// 1. Notificação de resumo imediata (uma vez por sessão)
// ---------------------------------------------------------------------------
/**
 * Agenda uma notificação resumida se houver itens em zona vermelha.
 * Chame após cada refresh do inventário.
 */
export async function scheduleExpiryNotifications(items: PantryItem[]): Promise<void> {
  if (notifiedThisSession) return;

  const urgent = items.filter((i) => i.status_urgencia === 'Vermelho');
  if (urgent.length === 0) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  notifiedThisSession = true;

  const expired = urgent.filter((i) => i.days_until_expiry < 0);
  const today   = urgent.filter((i) => i.days_until_expiry === 0);
  const soon    = urgent.filter((i) => i.days_until_expiry > 0);

  let title: string;
  let body: string;

  if (expired.length > 0) {
    title = `⚠️ ${expired.length} item(ns) vencido(s)!`;
    body  = expired.map((i) => i.name).join(', ');
  } else if (today.length > 0) {
    title = '🔴 Atenção: itens vencem hoje!';
    body  = today.map((i) => i.name).join(', ');
  } else {
    title = `🟡 ${soon.length} item(ns) próximo(s) do vencimento`;
    body  = soon.map((i) => `${i.name} (${i.days_until_expiry}d)`).join(', ');
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      repeats: false,
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Agendamento por data de validade de cada item (notificações reais)
// ---------------------------------------------------------------------------
/**
 * Cancela todas as notificações agendadas anteriormente e agenda novas:
 * - 2 dias antes do vencimento: "⏰ Atenção: {nome} vence em 2 dias!"
 * - No dia do vencimento: "🔴 {nome} vence hoje! Use agora."
 *
 * Deve ser chamado a cada refresh do inventário.
 * Limita-se a 60 notificações para respeitar o limite do SO.
 */
export async function schedulePerItemNotifications(items: PantryItem[]): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Cancela todas as notificações agendadas anteriormente
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  let scheduled = 0;
  const MAX_NOTIFICATIONS = 60;

  for (const item of items) {
    if (scheduled >= MAX_NOTIFICATIONS) break;

    const [year, month, day] = item.expiry_date.split('-').map(Number);

    // Notificação 2 dias antes (às 9h)
    const twoDaysBefore = new Date(year, month - 1, day - 2, 9, 0, 0);
    if (twoDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${item.name} vence em 2 dias!`,
          body: `Use agora para evitar desperdício. Que tal gerar uma receita?`,
          data: { itemId: item.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: twoDaysBefore,
        },
      });
      scheduled++;
    }

    if (scheduled >= MAX_NOTIFICATIONS) break;

    // Notificação no dia do vencimento (às 9h)
    const expiryDay = new Date(year, month - 1, day, 9, 0, 0);
    if (expiryDay > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔴 ${item.name} vence hoje!`,
          body: `Abra o app e gere uma receita antes que seja tarde.`,
          data: { itemId: item.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: expiryDay,
        },
      });
      scheduled++;
    }
  }
}

/** Reseta o flag de sessão (útil para testes). */
export function resetNotificationSession(): void {
  notifiedThisSession = false;
}

