/**
 * src/components/ProductCard.tsx
 * ==============================
 * Card visual de um item do inventário com semáforo de urgência colorido.
 * Totalmente theme-aware: dark OLED + light premium.
 */

import React, { useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, ChefHat, Edit3, Package, Tag, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../contexts/ThemeContext'

import type { PantryItem, RemovalReason, UrgencyStatus } from '../services/api';

// ---------------------------------------------------------------------------
// Paleta de urgência por tema
// ---------------------------------------------------------------------------
type Palette = { bg: string; border: string; badge: string; text: string; label: string };

const URGENCY_DARK: Record<UrgencyStatus, Palette> = {
  Verde:    { bg: 'rgba(34,197,94,0.12)',   border: '#4ADE80', badge: '#16A34A', text: '#4ADE80',  label: 'urgency.Verde'    },
  Amarelo:  { bg: 'rgba(234,179,8,0.18)',   border: '#FDE047', badge: '#CA8A04', text: '#FDE047',  label: 'urgency.Amarelo'  },
  Vermelho: { bg: 'rgba(239,68,68,0.22)',   border: '#F87171', badge: '#DC2626', text: '#FECACA',  label: 'urgency.Vermelho' },
};

const URGENCY_LIGHT: Record<UrgencyStatus, Palette> = {
  Verde:    { bg: '#F0FDF4', border: '#22C55E', badge: '#16A34A', text: '#15803D', label: 'urgency.Verde'    },
  Amarelo:  { bg: '#FEFCE8', border: '#CA8A04', badge: '#B45309', text: '#854D0E', label: 'urgency.Amarelo'  },
  Vermelho: { bg: '#FFF1F2', border: '#EF4444', badge: '#DC2626', text: '#991B1B', label: 'urgency.Vermelho' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProductCardProps {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (id: number, item: PantryItem, reason: RemovalReason) => void;
  onRecipe: (item: PantryItem) => void;
  onPress?: (item: PantryItem) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatExpiryLabel(days: number): string {
  if (days < 0) return `Vencido há ${Math.abs(days)} dia(s)`;
  if (days === 0) return 'Vence hoje!';
  if (days === 1) return 'Vence amanhã';
  return `Vence em ${days} dias`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  // Some APIs may return full datetime (ISO) like '2026-05-09T00:00:00Z'
  const datePart = iso.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length < 3) return iso;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ProductCard: React.FC<ProductCardProps> = React.memo(({ item, onEdit, onDelete, onRecipe, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const palette = theme.isDark
    ? URGENCY_DARK[item.status_urgencia]
    : URGENCY_LIGHT[item.status_urgencia];

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      t('productCard.deleteDialog.title'),
      `"${item.name}" — ${t('productCard.deleteDialog.message', { name: item.name }).split('—')[1]?.trim() ?? ''}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('productCard.deleteDialog.expired'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            onDelete(item.id, item, 'expired');
          },
        },
        {
          text: t('productCard.deleteDialog.consumed'),
          style: 'default',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onDelete(item.id, item, 'consumed');
          },
        },
      ]
    );
  }, [item, onDelete, t]);

  const handleRecipe = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onRecipe(item);
  }, [item, onRecipe]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: palette.bg,
          borderLeftColor: palette.border,
          borderLeftWidth: item.status_urgencia === 'Vermelho' ? 5 : 4,
          borderColor: item.status_urgencia === 'Vermelho'
            ? (theme.isDark ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.30)')
            : item.status_urgencia === 'Amarelo'
              ? (theme.isDark ? 'rgba(234,179,8,0.35)' : 'rgba(202,138,4,0.25)')
              : theme.border,
          shadowColor: palette.border,
          shadowOpacity: item.status_urgencia === 'Vermelho' ? 0.35 : 0.20,
        },
      ]}
      onPress={() => onPress?.(item)}
      activeOpacity={onPress ? 0.85 : 1}
    >
      {/* Cabeçalho: nome + badge */}
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Package size={16} color={palette.text} strokeWidth={2} />
          <Text style={[styles.itemName, { color: palette.text, fontFamily: theme.fonts?.heading }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: palette.badge }]}>
          <Text style={[styles.badgeText, { fontFamily: theme.fonts?.heading }]}>{t(palette.label)}</Text>
        </View>
      </View>

      {/* Detalhes */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Tag size={12} color={theme.isDark ? 'rgba(255,255,255,0.75)' : theme.textSecondary} strokeWidth={2} />
          <Text style={[styles.detailText, { color: theme.isDark ? 'rgba(255,255,255,0.75)' : theme.textSecondary, fontFamily: theme.fonts?.regular }]}>{item.category.name}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.quantityText, { color: theme.isDark ? 'rgba(255,255,255,0.75)' : theme.textSecondary, fontFamily: theme.fonts?.medium }]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
      </View>

      {/* Validade */}
      <View style={styles.expiryRow}>
        <Calendar size={13} color={palette.text} strokeWidth={2} />
        <Text style={[styles.expiryText, { color: palette.text, fontFamily: theme.fonts?.medium }]}>
          {formatExpiryLabel(item.days_until_expiry)} • {formatDate(item.expiry_date)}
          {item.expiry_estimated ? ' (estimada)' : ''}
        </Text>
      </View>

      {/* Ações */}
      <View style={styles.actionsRow}>
        {/* Receita */}
        <TouchableOpacity
          style={[styles.actionBtn, {
            borderColor: theme.greenBorder,
            backgroundColor: theme.greenBg,
          }]}
          onPress={handleRecipe}
          accessibilityLabel={t('productCard.accessibility.recipe', { name: item.name })}
          accessibilityRole="button"
        >
          <ChefHat size={14} color={theme.green} strokeWidth={2} />
          <Text style={[styles.actionBtnText, { color: theme.green, fontFamily: theme.fonts?.medium }]}>{t('productCard.recipe')}</Text>
        </TouchableOpacity>

        {/* Editar */}
        <TouchableOpacity
          style={[styles.actionBtn, {
            borderColor: theme.isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
            backgroundColor: theme.isDark ? 'rgba(59,130,246,0.10)' : '#EFF6FF',
          }]}
          onPress={() => onEdit(item)}
          accessibilityLabel={t('productCard.accessibility.edit', { name: item.name })}
          accessibilityRole="button"
        >
          <Edit3 size={14} color="#3B82F6" strokeWidth={2} />
          <Text style={[styles.actionBtnText, { color: '#3B82F6', fontFamily: theme.fonts?.medium }]}>{t('productCard.edit')}</Text>
        </TouchableOpacity>

        {/* Remover */}
        <TouchableOpacity
          style={[styles.actionBtn, {
            borderColor: theme.isDark ? 'rgba(239,68,68,0.35)' : '#FCA5A5',
            backgroundColor: theme.isDark ? 'rgba(239,68,68,0.10)' : '#FFF1F2',
          }]}
          onPress={handleDelete}
          accessibilityLabel={t('productCard.accessibility.remove', { name: item.name })}
          accessibilityRole="button"
        >
          <Trash2 size={14} color="#EF4444" strokeWidth={2} />
          <Text style={[styles.actionBtnText, { color: '#EF4444', fontFamily: theme.fonts?.medium }]}>{t('productCard.remove')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

ProductCard.displayName = 'ProductCard';

// ---------------------------------------------------------------------------
// Styles (estruturais apenas — cores via theme tokens acima)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProductCard;
