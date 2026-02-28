/**
 * src/screens/DashboardScreen.tsx
 * ================================
 * Tela principal do Desperdício Zero.
 * Exibe os itens do inventário ordenados por urgência, com
 * contadores de resumo e acesso rápido à geração de receitas.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart2, ChefHat, Leaf, Moon, Plus, RefreshCw, Sun } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import ProductCard from '../components/ProductCard';
import SwipeableCard from '../components/SwipeableCard';
import MarkdownText from '../components/MarkdownText';
import { useInventory } from '../hooks/useInventory';
import { useTheme } from '../contexts/ThemeContext';
import type { PantryItem, RemovalReason, UrgencyStatus } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// ---------------------------------------------------------------------------
// Ordenação customizada
// ---------------------------------------------------------------------------
export type SortKey = 'urgency' | 'name' | 'expiry' | 'category';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'urgency',  label: '🚨 Urgência' },
  { key: 'name',     label: '🔤 Nome' },
  { key: 'expiry',   label: '📅 Validade' },
  { key: 'category', label: '🏷️ Categoria' },
];

const URGENCY_ORDER: Record<string, number> = { Vermelho: 0, Amarelo: 1, Verde: 2 };

// ---------------------------------------------------------------------------
// Card de resumo por status — com contador animado
// ---------------------------------------------------------------------------
interface SummaryCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, count, color, bgColor }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (count === 0) { setDisplay(0); return; }
    let current = 0;
    const step = Math.max(1, Math.ceil(count / 16));
    const timer = setInterval(() => {
      current = Math.min(current + step, count);
      setDisplay(current);
      if (current >= count) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <View style={[styles.summaryCard, { backgroundColor: bgColor, borderColor: color }]}>
      <Text style={[styles.summaryCount, { color }]}>{display}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Wrapper de animação de entrada para cada card da lista
// ---------------------------------------------------------------------------
interface AnimatedCardProps {
  children: React.ReactNode;
  index: number;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, index }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index * 55, 400),
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{
          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
        }],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { items, loading, saving, error, refresh, removeItem, getRecipe } = useInventory();
  const { theme, toggleTheme } = useTheme();
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipeMode, setRecipeMode] = useState<'urgent' | 'all' | 'item'>('urgent');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | UrgencyStatus>('Todos');
  const [sortBy, setSortBy] = useState<SortKey>('urgency');

  // -- Lista filtrada --------------------------------------------------------
  const filteredItems = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'Todos' || item.status_urgencia === filterStatus;
    return matchSearch && matchFilter;
  });

  // -- Ordenação customizada -------------------------------------------------
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      case 'expiry':
        return list.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
      case 'category':
        return list.sort((a, b) => a.category.name.localeCompare(b.category.name, 'pt-BR'));
      default:
        return list.sort(
          (a, b) =>
            URGENCY_ORDER[a.status_urgencia] - URGENCY_ORDER[b.status_urgencia] ||
            a.days_until_expiry - b.days_until_expiry,
        );
    }
  }, [filteredItems, sortBy]);

  // -- Contadores por status -------------------------------------------------
  const redCount = items.filter((i) => i.status_urgencia === 'Vermelho').length;
  const yellowCount = items.filter((i) => i.status_urgencia === 'Amarelo').length;
  const greenCount = items.filter((i) => i.status_urgencia === 'Verde').length;

  // -- Handlers --------------------------------------------------------------
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleEdit = (item: PantryItem) => {
    navigation.navigate('AddItem', { itemToEdit: item });
  };

  const handleDelete = async (id: number, item: PantryItem, reason: RemovalReason) => {
    try {
      await removeItem(id, item, reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Erro', 'Não foi possível remover o item.');
    }
  };

  const handleRecipeFromItem = async (item: PantryItem) => {
    // Monta lista: o produto clicado + outros itens de suporte (verde/amarelo)
    const supporting = items
      .filter((i) => i.id !== item.id && i.status_urgencia !== 'Vermelho')
      .slice(0, 4)
      .map((i) => i.name);
    const products = [item.name, ...supporting];

    setRecipeMode('item');
    setLoadingRecipe(true);
    setRecipeModalVisible(true);
    try {
      const text = await getRecipe(products);
      setRecipeText(text);
    } catch {
      setRecipeText('Erro ao gerar receita. Tente novamente.');
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleGenerateRecipe = async (mode: 'urgent' | 'all') => {
    const products = mode === 'urgent'
      ? items.filter((i) => i.status_urgencia === 'Vermelho').map((i) => i.name)
      : items.map((i) => i.name);

    setRecipeMode(mode);
    setLoadingRecipe(true);
    setRecipeModalVisible(true);
    try {
      const text = await getRecipe(products);
      setRecipeText(text);
    } catch {
      setRecipeText('Erro ao gerar receita. Tente novamente.');
    } finally {
      setLoadingRecipe(false);
    }
  };

  // -- Render ----------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.green} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando inventário…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.green }]}>Desperdício Zero</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {filteredItems.length} de {items.length} {items.length === 1 ? 'item' : 'itens'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.headerBtn, { backgroundColor: theme.greenBg }]}
            accessibilityLabel="Alternar tema"
          >
            {theme.isDark
              ? <Sun size={20} color={theme.green} strokeWidth={2} />
              : <Moon size={20} color={theme.green} strokeWidth={2} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            style={[styles.headerBtn, { backgroundColor: theme.greenBg }]}
            accessibilityLabel="Ver relatório de desperdício"
          >
            <BarChart2 size={20} color={theme.green} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={[styles.headerBtn, { backgroundColor: theme.greenBg }]}>
            <RefreshCw size={20} color={theme.green} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Erro */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Resumo por urgência */}
      <View style={styles.summaryRow}>
        <SummaryCard label="Urgente" count={redCount} color="#B91C1C" bgColor={theme.urgentBg} />
        <SummaryCard label="Atenção" count={yellowCount} color="#A16207" bgColor={theme.warnBg} />
        <SummaryCard label="Em dia" count={greenCount} color="#15803D" bgColor={theme.okBg} />
      </View>

      {/* Busca e filtros */}
      <View style={styles.searchFilterRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          placeholder="Buscar item…"
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <View style={styles.filterChipsRow}>
        {(['Todos', 'Vermelho', 'Amarelo', 'Verde'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
              filterStatus === status && styles.filterChipActive,
              filterStatus === status && {
                backgroundColor:
                  status === 'Vermelho' ? '#EF4444'
                  : status === 'Amarelo' ? '#EAB308'
                  : status === 'Verde' ? '#22C55E'
                  : theme.green,
              },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: theme.textSecondary },
                filterStatus === status && styles.filterChipTextActive,
              ]}
            >
              {status === 'Todos' ? 'Todos' :
               status === 'Vermelho' ? 'Urgente' :
               status === 'Amarelo' ? 'Atenção' : 'Em dia'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ordenação */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.sortChip,
              { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
              sortBy === opt.key && { backgroundColor: theme.green, borderColor: theme.green },
            ]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text style={[
              styles.sortChipText,
              { color: theme.textSecondary },
              sortBy === opt.key && { color: '#FFF' },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Botões de receita */}
      <View style={styles.recipeBtnsRow}>
        {redCount > 0 && (
          <TouchableOpacity
            style={[styles.recipeBtn, styles.recipeBtnUrgent]}
            onPress={() => handleGenerateRecipe('urgent')}
          >
            <ChefHat size={16} color="#FFF" strokeWidth={2} />
            <Text style={styles.recipeBtnText}>
              {redCount} {redCount === 1 ? 'urgente' : 'urgentes'}
            </Text>
          </TouchableOpacity>
        )}
        {items.length > 0 && (
          <TouchableOpacity
            style={[styles.recipeBtn, styles.recipeBtnAll]}
            onPress={() => handleGenerateRecipe('all')}
          >
            <ChefHat size={16} color="#16A34A" strokeWidth={2} />
            <Text style={[styles.recipeBtnText, styles.recipeBtnTextAll]}>
              Todo o estoque
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de itens */}
      <FlatList
        data={sortedItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <AnimatedCard index={index}>
            <SwipeableCard
              onEdit={() => handleEdit(item)}
              onDelete={() => {
                Alert.alert(
                  'Como esse item foi removido?',
                  `"${item.name}" — selecione o motivo:`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: '🗑 Venceu/Descartado', style: 'destructive', onPress: () => handleDelete(item.id, item, 'expired') },
                    { text: '✅ Consumido', onPress: () => handleDelete(item.id, item, 'consumed') },
                  ]
                );
              }}
            >
              <ProductCard
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRecipe={handleRecipeFromItem}
                onPress={() => navigation.navigate('ItemDetail', { item })}
              />
            </SwipeableCard>
          </AnimatedCard>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#16A34A']}
            tintColor="#16A34A"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Leaf size={56} color="#D1FAE5" strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {searchQuery || filterStatus !== 'Todos' ? 'Nenhum resultado' : 'Despensa vazia'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {searchQuery || filterStatus !== 'Todos'
                ? 'Tente outra busca ou remova o filtro.'
                : 'Adicione seus primeiros itens tocando no botão +'}
            </Text>
          </View>
        }
        contentContainerStyle={
          filteredItems.length === 0 ? styles.listEmpty : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB — Adicionar item */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddItem', {})}
        accessibilityLabel="Adicionar novo item"
      >
        <Plus size={28} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Modal de Receita */}
      <Modal
        visible={recipeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecipeModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.modalBg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ChefHat size={22} color={theme.green} strokeWidth={2} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {recipeMode === 'urgent' ? 'Receita Anti-Desperdício'
               : recipeMode === 'all' ? 'Receita do Estoque'
               : 'Receita com este produto'}
            </Text>
            <TouchableOpacity onPress={() => setRecipeModalVisible(false)}>
              <Text style={styles.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          {loadingRecipe ? (
            <View style={[styles.centered, { backgroundColor: theme.modalBg }]}>
              <ActivityIndicator size="large" color={theme.green} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Gerando receita com IA…</Text>
              <Text style={[styles.loadingText, { fontSize: 13, opacity: 0.6, marginTop: -4, color: theme.textSecondary }]}>
                Isso pode levar até 30 segundos
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <MarkdownText content={recipeText} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  recipeBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  recipeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  recipeBtnUrgent: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  recipeBtnAll: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  recipeBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  recipeBtnTextAll: {
    color: '#16A34A',
  },
  listContent: {
    paddingBottom: 100,
    paddingTop: 4,
  },
  listEmpty: {
    flexGrow: 1,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: 'nowrap',
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  filterChipActive: {
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  modalClose: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  recipeText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
});

export default DashboardScreen;
