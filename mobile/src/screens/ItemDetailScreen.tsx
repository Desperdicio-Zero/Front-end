/**
 * src/screens/ItemDetailScreen.tsx
 * ==================================
 * Tela de detalhes de um item da despensa.
 * Mostra todas as informações do produto + histórico de remoções anteriores
 * com esse mesmo nome.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Calendar,
  ChefHat,
  Clock,
  Edit3,
  Package,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import MarkdownText from '../components/MarkdownText';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../contexts/ThemeContext';
import { useInventory } from '../hooks/useInventory';
import {
  fetchHistoryByItem,
  type ItemHistoryOut,
  type PantryItem,
  type RemovalReason,
  type UrgencyStatus,
} from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

// ---------------------------------------------------------------------------
// Paletas de urgência (mesmas do ProductCard)
// ---------------------------------------------------------------------------
type Palette = { bg: string; border: string; badge: string; text: string; label: string };

const URGENCY_LIGHT: Record<UrgencyStatus, Palette> = {
  Verde: { bg: '#F0FDF4', border: '#22C55E', badge: '#22C55E', text: '#15803D', label: 'Em dia' },
  Amarelo: { bg: '#FEFCE8', border: '#EAB308', badge: '#EAB308', text: '#A16207', label: 'Atenção' },
  Vermelho: { bg: '#FFF1F2', border: '#EF4444', badge: '#EF4444', text: '#B91C1C', label: 'Urgente' },
};
const URGENCY_DARK: Record<UrgencyStatus, Palette> = {
  Verde: { bg: '#14532D', border: '#22C55E', badge: '#16A34A', text: '#86EFAC', label: 'Em dia' },
  Amarelo: { bg: '#431A01', border: '#EAB308', badge: '#CA8A04', text: '#FDE047', label: 'Atenção' },
  Vermelho: { bg: '#450A0A', border: '#EF4444', badge: '#DC2626', text: '#FCA5A5', label: 'Urgente' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatDatetime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' • '
    + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const REASON_LABEL: Record<RemovalReason, string> = {
  consumed: '✅ Consumido',
  expired: '🗑 Venceu/Descartado',
  donated: '🤝 Doado',
  other: '📦 Outro',
};

const REASON_COLOR: Record<RemovalReason, string> = {
  consumed: '#16A34A',
  expired: '#DC2626',
  donated: '#7C3AED',
  other: '#6B7280',
};

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------
const ItemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { item } = route.params;
  const { theme } = useTheme();
  const { removeItem, getRecipe } = useInventory();
  const palette = theme.isDark ? URGENCY_DARK[item.status_urgencia] : URGENCY_LIGHT[item.status_urgencia];

  const [history, setHistory] = useState<ItemHistoryOut[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [recipeVisible, setRecipeVisible] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [recipeLoading, setRecipeLoading] = useState(false);

  // -- Carrega histórico deste produto ----------------------------------------
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await fetchHistoryByItem(item.name);
      setHistory(data);
    } catch {
      // Histórico não essencial — ignora falha
    } finally {
      setLoadingHistory(false);
    }
  }, [item.name]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // -- Ações ------------------------------------------------------------------
  const handleEdit = () => {
    navigation.navigate('AddItem', { itemToEdit: item });
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    Alert.alert(
      'Como esse item foi removido?',
      `"${item.name}" — selecione o motivo:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '🗑 Venceu/Descartado',
          style: 'destructive',
          onPress: async () => {
            await removeItem(item.id, item, 'expired');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            navigation.goBack();
          },
        },
        {
          text: '✅ Consumido',
          onPress: async () => {
            await removeItem(item.id, item, 'consumed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleRecipe = async () => {
    setRecipeText('');
    setRecipeLoading(true);
    setRecipeVisible(true);
    try {
      const text = await getRecipe([item.name]);
      setRecipeText(text);
    } catch {
      setRecipeText('Erro ao gerar receita. Tente novamente.');
    } finally {
      setRecipeLoading(false);
    }
  };

  // -- Helpers de exibição de validade ----------------------------------------
  const expiryLabel = () => {
    const d = item.days_until_expiry;
    if (d < 0) return `Vencido há ${Math.abs(d)} dia(s)`;
    if (d === 0) return 'Vence hoje!';
    if (d === 1) return 'Vence amanhã';
    return `Vence em ${d} dias`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={theme.green} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[s.statusBadge, { backgroundColor: palette.badge }]}>
          <Text style={s.statusBadgeText}>{palette.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Card principal do item */}
        <View style={[s.mainCard, { backgroundColor: palette.bg, borderLeftColor: palette.border }]}>

          {/* Nome */}
          <View style={s.infoRow}>
            <Package size={16} color={palette.text} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Produto</Text>
            <Text style={[s.infoValue, { color: palette.text }]}>{item.name}</Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Categoria */}
          <View style={s.infoRow}>
            <Tag size={16} color={theme.textSecondary} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Categoria</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>{item.category.name}</Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Quantidade */}
          <View style={s.infoRow}>
            <Text style={[s.infoIcon, { color: theme.textSecondary }]}>📦</Text>
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Quantidade</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>
              {item.quantity} {item.unit}
            </Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Validade */}
          <View style={s.infoRow}>
            <Calendar size={16} color={palette.text} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Validade</Text>
            <View style={s.expiryCol}>
              <Text style={[s.infoValue, { color: palette.text }]}>
                {formatDate(item.expiry_date)}
                {item.expiry_estimated ? '  (estimada)' : ''}
              </Text>
              <Text style={[s.expirySubtitle, { color: palette.text }]}>{expiryLabel()}</Text>
            </View>
          </View>

          {/* Observações */}
          {item.notes ? (
            <>
              <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
              <View style={s.notesBox}>
                <Text style={[s.notesLabel, { color: theme.textMuted }]}>Observações</Text>
                <Text style={[s.notesText, { color: theme.textSecondary }]}>{item.notes}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Botões de ação */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder }]}
            onPress={handleRecipe}
          >
            <ChefHat size={18} color={theme.green} strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: theme.green }]}>Receita</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
            onPress={handleEdit}
          >
            <Edit3 size={18} color="#3B82F6" strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: '#3B82F6' }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' }]}
            onPress={handleDelete}
          >
            <Trash2 size={18} color="#EF4444" strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Remover</Text>
          </TouchableOpacity>
        </View>

        {/* Histórico deste produto */}
        <View style={[s.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Clock size={16} color={theme.green} strokeWidth={2} />
            <Text style={[s.sectionTitle, { color: theme.text }]}>Histórico deste produto</Text>
          </View>

          {loadingHistory ? (
            <ActivityIndicator color={theme.green} style={{ padding: 20 }} />
          ) : history.length === 0 ? (
            <Text style={[s.emptyHistory, { color: theme.textMuted }]}>
              Nenhuma remoção registrada ainda.
            </Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={[s.historyItem, { borderBottomColor: theme.borderLight }]}>
                <View style={s.historyLeft}>
                  <Text style={[s.historyReason, { color: REASON_COLOR[h.removal_reason] }]}>
                    {REASON_LABEL[h.removal_reason]}
                  </Text>
                  <Text style={[s.historyDetails, { color: theme.textMuted }]}>
                    {h.quantity} {h.unit} • validade {formatDate(h.expiry_date)}
                  </Text>
                  {h.notes ? (
                    <Text style={[s.historyNotes, { color: theme.textMuted }]}>"{h.notes}"</Text>
                  ) : null}
                </View>
                <Text style={[s.historyDate, { color: theme.textMuted }]}>
                  {formatDatetime(h.removed_at)}
                </Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* Modal receita */}
      <Modal
        visible={recipeVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRecipeVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[s.modalTitle, { color: theme.text }]}>🍽 Sugestão de Receita</Text>
              <TouchableOpacity onPress={() => setRecipeVisible(false)}>
                <X size={20} color={theme.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalContent}>
              {recipeLoading ? (
                <View style={s.recipeLoading}>
                  <ActivityIndicator color={theme.green} size="large" />
                  <Text style={[s.recipeLoadingText, { color: theme.textMuted }]}>
                    Gerando receita com IA…
                  </Text>
                </View>
              ) : (
                <MarkdownText content={recipeText} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  mainCard: {
    borderLeftWidth: 5,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  infoIcon: { fontSize: 15 },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    width: 76,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  expiryCol: { flex: 1 },
  expirySubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  divider: {
    height: 1,
    marginHorizontal: -2,
  },
  notesBox: { paddingVertical: 10 },
  notesLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyHistory: {
    padding: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  historyLeft: { flex: 1 },
  historyReason: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyDetails: {
    fontSize: 12,
  },
  historyNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    textAlign: 'right',
    flexShrink: 0,
  },
  // ---- Modal styles ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
  recipeLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 14,
  },
  recipeLoadingText: {
    fontSize: 14,
  },
});

export default ItemDetailScreen;
