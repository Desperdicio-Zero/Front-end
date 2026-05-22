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
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  Calendar,
  ChefHat,
  Clock,
  Edit3,
  Heart,
  Package,
  Tag,
  Trash2,
  X,
  Layers,
} from 'lucide-react-native';
import MarkdownText from '../components/MarkdownText';
import { SkeletonItem } from '../components/SkeletonItem';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../contexts/ThemeContext';
import { useInventory } from '../hooks/useInventory';
import {
  fetchItemById,
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
  Verde: { bg: 'rgba(34,197,94,0.1)', border: '#22C55E', badge: '#16A34A', text: '#15803D', label: 'Em dia' },
  Amarelo: { bg: 'rgba(234,179,8,0.1)', border: '#CA8A04', badge: '#B45309', text: '#854D0E', label: 'Atenção' },
  Vermelho: { bg: 'rgba(239,68,68,0.1)', border: '#EF4444', badge: '#DC2626', text: '#991B1B', label: 'Urgente' },
};
const URGENCY_DARK: Record<UrgencyStatus, Palette> = {
  Verde:    { bg: 'rgba(34,197,94,0.15)',  border: '#4ADE80', badge: '#16A34A', text: '#4ADE80',  label: 'Em dia'  },
  Amarelo:  { bg: 'rgba(234,179,8,0.15)',  border: '#FACC15', badge: '#B45309', text: '#FDE047',  label: 'Atenção' },
  Vermelho: { bg: 'rgba(239,68,68,0.18)',  border: '#F87171', badge: '#B91C1C', text: '#FCA5A5',  label: 'Urgente' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  const match = String(iso ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return String(iso ?? '');
}

function daysUntilFromIso(iso: string): number {
  const match = String(iso ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(year, month - 1, day);
  const diff = target.getTime() - today.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function formatDatetime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' • '
    + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const REASON_LABEL: Record<RemovalReason, string> = {
  consumed: 'Consumido',
  expired: 'Venceu/Descartado',
  donated: 'Doado',
  other: 'Outro motivo',
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
  const { item: initialItem } = route.params;
  const { theme } = useTheme();
  const { removeItem, getRecipe } = useInventory();

  const [item, setItem] = useState<PantryItem>(initialItem);

  const safeUrgency: UrgencyStatus = (item?.status_urgencia && (item.status_urgencia in URGENCY_LIGHT))
    ? item.status_urgencia
    : 'Verde';
  const palette = theme.isDark ? URGENCY_DARK[safeUrgency] : URGENCY_LIGHT[safeUrgency];

  const refreshItem = useCallback(async () => {
    try {
      const data = await fetchItemById(initialItem.id);
      setItem((prev) => ({
        ...prev,
        ...data,
        // Se o backend não enviar relacionamentos/campos calculados, preserva do item inicial.
        category: data.category ?? prev.category,
        status_urgencia: data.status_urgencia ?? prev.status_urgencia,
        days_until_expiry: typeof data.days_until_expiry === 'number' ? data.days_until_expiry : prev.days_until_expiry,
      }));
    } catch {
      // Detalhe não essencial — mantém o item inicial.
    }
  }, [initialItem.id]);

  // Busca o item mais atual (integra GET /inventory/:id)
  useEffect(() => {
    refreshItem();
  }, [refreshItem]);

  // Rebusca ao voltar para a tela (ex.: após editar no AddItem)
  useFocusEffect(
    useCallback(() => {
      refreshItem();
    }, [refreshItem])
  );

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
          text: '🤝 Doar',
          onPress: () => navigation.navigate('Donation', { item }),
        },
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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

  const handleDonate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate('Donation', { item });
  };

  // -- Helpers de exibição de validade ----------------------------------------
  const expiryLabel = () => {
    const d = Number.isFinite(item.days_until_expiry)
      ? item.days_until_expiry
      : daysUntilFromIso(item.expiry_date);
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
            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Produto</Text>
            <Text style={[s.infoValue, { color: palette.text }]}>{item.name}</Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Categoria */}
          <View style={s.infoRow}>
            <Tag size={16} color={theme.textSecondary} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Categoria</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>{item.category.name}</Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Quantidade */}
          <View style={s.infoRow}>
            <Layers size={16} color={theme.textSecondary} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Quantidade</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>
              {item.quantity} {item.unit}
            </Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Validade */}
          <View style={s.infoRow}>
            <Calendar size={16} color={palette.text} strokeWidth={2} />
            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Validade</Text>
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
                <Text style={[s.notesLabel, { color: theme.textSecondary }]}>Observações</Text>
                <Text style={[s.notesText, { color: theme.text }]}>{item.notes}</Text>
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
            <Text style={[s.actionBtnText, { color: theme.green, fontFamily: theme.fonts?.medium }]}>Receita</Text>
          </TouchableOpacity>

          {(item.status_urgencia === 'Amarelo' || item.status_urgencia === 'Vermelho') && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#F5F3FF', borderColor: '#C4B5FD' }]}
              onPress={handleDonate}
            >
              <Heart size={18} color="#7C3AED" strokeWidth={2} />
              <Text style={[s.actionBtnText, { color: '#7C3AED', fontFamily: theme.fonts?.medium }]}>Doar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
            onPress={handleEdit}
          >
            <Edit3 size={18} color="#3B82F6" strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: '#3B82F6', fontFamily: theme.fonts?.medium }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' }]}
            onPress={handleDelete}
          >
            <Trash2 size={18} color="#EF4444" strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: '#EF4444', fontFamily: theme.fonts?.medium }]}>Remover</Text>
          </TouchableOpacity>
        </View>

        {/* Histórico deste produto */}
        <View style={[s.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Clock size={16} color={theme.green} strokeWidth={2} />
            <Text style={[s.sectionTitle, { color: theme.text }]}>Histórico deste produto</Text>
          </View>

          {loadingHistory ? (
            <View style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </View>
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
        onRequestClose={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setRecipeVisible(false);
        }}
      >
        <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[s.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
              <ChefHat size={20} color={theme.text} style={{ marginRight: 8 }} strokeWidth={2.5} />
              <Text style={[s.modalTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>Sugestão de Receita</Text>
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setRecipeVisible(false);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={theme.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalContent}>
              {recipeLoading ? (
                <View style={s.recipeLoading}>
                  <LottieView
                    autoPlay
                    loop
                    source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
                    style={{ width: 140, height: 140 }}
                  />
                  <Text style={[s.recipeLoadingText, { color: theme.textMuted, fontFamily: theme.fonts?.medium }]}>
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
  root: { flex: 1, backgroundColor: '#060A10' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#060A10',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#F0FDF4',
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
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#0F1923',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
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
    fontWeight: '600',
    width: 76,
    color: 'rgba(255,255,255,0.65)',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F0FDF4',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  notesBox: { paddingVertical: 10 },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: 'rgba(255,255,255,0.65)',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.80)',
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
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    backgroundColor: '#0F1923',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0FDF4',
  },
  emptyHistory: {
    padding: 16,
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    color: 'rgba(255,255,255,0.65)',
  },
  historyNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
    color: 'rgba(255,255,255,0.55)',
  },
  historyDate: {
    fontSize: 11,
    textAlign: 'right',
    flexShrink: 0,
    color: 'rgba(255,255,255,0.55)',
  },
  // ---- Modal styles ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0F1923',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0FDF4',
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
    color: 'rgba(255,255,255,0.45)',
  },
});

export default ItemDetailScreen;
