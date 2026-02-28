/**
 * src/components/ProductCard.tsx
 * ==============================
 * Card visual de um item do inventário com semáforo de urgência colorido.
 * Recebe callbacks de edição e remoção para manter a lógica nas screens.
 */

import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, ChefHat, Edit3, Package, Tag, Trash2 } from 'lucide-react-native';

import { useTheme } from '../contexts/ThemeContext';
import type { PantryItem, RemovalReason, UrgencyStatus } from '../services/api';

// ---------------------------------------------------------------------------
// Paleta de cores por status de urgência
// ---------------------------------------------------------------------------
type Palette = { bg: string; border: string; badge: string; text: string; label: string };

const URGENCY_LIGHT: Record<UrgencyStatus, Palette> = {
  Verde:    { bg: '#F0FDF4', border: '#22C55E', badge: '#22C55E', text: '#15803D', label: 'Em dia' },
  Amarelo:  { bg: '#FEFCE8', border: '#EAB308', badge: '#EAB308', text: '#A16207', label: 'Atenção' },
  Vermelho: { bg: '#FFF1F2', border: '#EF4444', badge: '#EF4444', text: '#B91C1C', label: 'Urgente' },
};

const URGENCY_DARK: Record<UrgencyStatus, Palette> = {
  Verde:    { bg: '#14532D', border: '#22C55E', badge: '#16A34A', text: '#86EFAC', label: 'Em dia' },
  Amarelo:  { bg: '#431A01', border: '#EAB308', badge: '#CA8A04', text: '#FDE047', label: 'Atenção' },
  Vermelho: { bg: '#450A0A', border: '#EF4444', badge: '#DC2626', text: '#FCA5A5', label: 'Urgente' },
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

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ProductCard: React.FC<ProductCardProps> = ({ item, onEdit, onDelete, onRecipe, onPress }) => {
  const { theme } = useTheme();
  const palette = theme.isDark
    ? URGENCY_DARK[item.status_urgencia]
    : URGENCY_LIGHT[item.status_urgencia];

  const handleDelete = () => {
    Alert.alert(
      'Como esse item foi removido?',
      `"${item.name}" — selecione o motivo para o nosso relatório:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '🗑 Venceu/Descartado',
          style: 'destructive',
          onPress: () => onDelete(item.id, item, 'expired'),
        },
        {
          text: '✅ Consumido',
          style: 'default',
          onPress: () => onDelete(item.id, item, 'consumed'),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: palette.bg, borderLeftColor: palette.border },
      ]}
      onPress={() => onPress?.(item)}
      activeOpacity={onPress ? 0.85 : 1}
    >
      {/* Cabeçalho: nome + badge de urgência */}
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Package size={16} color={palette.text} strokeWidth={2} />
          <Text style={[styles.itemName, { color: palette.text }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: palette.badge }]}>
          <Text style={styles.badgeText}>{palette.label}</Text>
        </View>
      </View>

      {/* Detalhes: categoria, quantidade, validade */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Tag size={12} color={theme.textSecondary} strokeWidth={2} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.category.name}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
      </View>

      {/* Validade */}
      <View style={styles.expiryRow}>
        <Calendar size={13} color={palette.text} strokeWidth={2} />
        <Text style={[styles.expiryText, { color: palette.text }]}>
          {formatExpiryLabel(item.days_until_expiry)} • {formatDate(item.expiry_date)}
          {item.expiry_estimated ? ' (estimada)' : ''}
        </Text>
      </View>

      {/* Ações */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.recipeBtn]}
          onPress={() => onRecipe(item)}
          accessibilityLabel={`Receita com ${item.name}`}
        >
          <ChefHat size={14} color="#16A34A" strokeWidth={2} />
          <Text style={styles.recipeBtnText}>Receita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => onEdit(item)}
          accessibilityLabel={`Editar ${item.name}`}
        >
          <Edit3 size={14} color="#3B82F6" strokeWidth={2} />
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={handleDelete}
          accessibilityLabel={`Remover ${item.name}`}
        >
          <Trash2 size={14} color="#EF4444" strokeWidth={2} />
          <Text style={styles.deleteBtnText}>Remover</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 5,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
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
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 12,
    color: '#6B7280',
  },
  quantityText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
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
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  recipeBtn: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  recipeBtnText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
  },
  editBtn: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  editBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF1F2',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProductCard;
