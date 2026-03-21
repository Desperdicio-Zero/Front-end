/**
 * src/screens/DashboardScreen.tsx
 * ================================
 * Tela principal do Desperdício Zero.
 * Exibe os itens do inventário ordenados por urgência, com
 * contadores de resumo e acesso rápido à geração de receitas.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart2, ChefHat, Leaf, Moon, Plus, RefreshCw, Sun, Share2, LogOut, MoreVertical, HelpCircle, ChevronRight, AlertTriangle, Type, CalendarClock, Tag, Clock, CheckCircle2 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';

import ProductCard from '../components/ProductCard';
import SwipeableCard from '../components/SwipeableCard';
import MarkdownText from '../components/MarkdownText';
import { SkeletonItem } from '../components/SkeletonItem';
import { useInventory } from '../hooks/useInventory';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { PantryItem, RemovalReason, UrgencyStatus } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// ---------------------------------------------------------------------------
// Ordenação customizada
// ---------------------------------------------------------------------------
export type SortKey = 'urgency' | 'name' | 'expiry' | 'category';

const SORT_OPTIONS: { key: SortKey; label: string; icon: any }[] = [
  { key: 'urgency', label: 'Urgência', icon: AlertTriangle },
  { key: 'name', label: 'Nome', icon: Type },
  { key: 'expiry', label: 'Validade', icon: CalendarClock },
  { key: 'category', label: 'Categoria', icon: Tag },
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
      <Text style={[styles.summaryCount, { color }]} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
      <Text style={[styles.summaryLabel, { color }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
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
      duration: 380,
      delay: Math.min(index * 45, 300),
      useNativeDriver: true,
      easing: Easing.bezier(0.25, 1, 0.5, 1), // Curva Deceleration suave premium
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
  const { signOut } = useAuth();
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipeMode, setRecipeMode] = useState<'urgent' | 'all' | 'item'>('urgent');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | UrgencyStatus>('Todos');
  const [sortBy, setSortBy] = useState<SortKey>('urgency');
  const [isMenuVisible, setMenuVisible] = useState(false);

  // -- Efeito Loading Cíclico para IA ----------------------------------------
  const FUN_LOADING_PHRASES = [
    "Lavando as panelas...",
    "Consultando os mestres da culinária...",
    "Calculando o valor nutricional...",
    "Misturando os temperos perfeitos...",
    "Criando uma harmonia de sabores...",
    "Está quase pronto...",
    "O aroma digital está delicioso..."
  ];
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loadingRecipe) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % FUN_LOADING_PHRASES.length);
      }, 2500);
    } else {
      setLoadingPhraseIndex(0);
    }
    return () => clearInterval(interval);
  }, [loadingRecipe]);

  // -- Lista filtrada --------------------------------------------------------
  const filteredItems = useMemo(() =>
    items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = filterStatus === 'Todos' || item.status_urgencia === filterStatus;
      return matchSearch && matchFilter;
    }),
    [items, searchQuery, filterStatus]
  );

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

  // -- Handlers (memoizados para não re-criar a cada render) ----------------
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleEdit = useCallback((item: PantryItem) => {
    navigation.navigate('AddItem', { itemToEdit: item });
  }, [navigation]);

  const handleDelete = useCallback(async (id: number, item: PantryItem, reason: RemovalReason) => {
    try {
      await removeItem(id, item, reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Alert.alert('Erro', 'Não foi possível remover o item.');
    }
  }, [removeItem]);

  const handleRecipeFromItem = useCallback(async (item: PantryItem) => {
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
  }, [items, getRecipe]);

  const handleGenerateRecipe = useCallback(async (mode: 'urgent' | 'all') => {
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
  }, [items, getRecipe]);

  const handleShareRecipe = useCallback(async () => {
    try {
      await Share.share({
        message: `*Receita Inteligente - Desperdício Zero*\n\n${recipeText}`,
        title: 'Receita do Desperdício Zero'
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  }, [recipeText]);

  // -- Render ----------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.skeletonHeaderPlaceholder} />
        <View style={styles.scroll}>
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.green, fontFamily: theme.fonts.heading }]}>Desperdício Zero</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted, fontFamily: theme.fonts.medium }]}>
            {filteredItems.length} de {items.length} {items.length === 1 ? 'item' : 'itens'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={[styles.headerBtn, { backgroundColor: theme.greenBg }]}
            accessibilityLabel="Abrir menu de opções"
          >
            <MoreVertical size={20} color={theme.green} strokeWidth={2.5} />
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
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filterChipsRow}>
          {(['Todos', 'Vermelho', 'Amarelo', 'Verde'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.chipBorder, flexDirection: 'row', alignItems: 'center', gap: 6 },
                  filterStatus === status && styles.filterChipActive,
                  filterStatus === status && {
                    backgroundColor:
                      status === 'Vermelho' ? '#EF4444'
                        : status === 'Amarelo' ? '#EAB308'
                          : status === 'Verde' ? '#22C55E'
                            : theme.green,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilterStatus(status as typeof filterStatus);
                }}
              >
                {status === 'Vermelho' ? <AlertTriangle size={14} color={filterStatus === status ? '#FFF' : theme.textSecondary} /> : null}
                {status === 'Amarelo' ? <Clock size={14} color={filterStatus === status ? '#FFF' : theme.textSecondary} /> : null}
                {status === 'Verde' ? <CheckCircle2 size={14} color={filterStatus === status ? '#FFF' : theme.textSecondary} /> : null}
                <Text
                  style={[
                    styles.filterChipText,
                    { color: theme.textSecondary, fontFamily: theme.fonts?.medium },
                    filterStatus === status && styles.filterChipTextActive,
                    filterStatus === status && { color: '#FFF' },
                  ]}
                >
                  {status === 'Todos' ? 'Todos' :
                    status === 'Vermelho' ? 'Urgente' :
                      status === 'Amarelo' ? 'Atenção' : 'Em dia'}
                </Text>
              </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Ordenação */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sortChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.chipBorder, flexDirection: 'row', alignItems: 'center', gap: 6 },
                  isActive && { backgroundColor: theme.green, borderColor: theme.green },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSortBy(opt.key);
                }}
              >
                <Icon size={14} color={isActive ? '#FFF' : theme.textSecondary} strokeWidth={2.5} />
              <Text style={[
                styles.sortChipText,
                { color: theme.textSecondary },
                isActive && { color: '#FFF' },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          )})}
        </ScrollView>
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
                    { text: 'Venceu/Descartado', style: 'destructive', onPress: () => handleDelete(item.id, item, 'expired') },
                    { text: 'Consumido', onPress: () => handleDelete(item.id, item, 'consumed') },
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
            colors={['#22C55E']}
            tintColor="#22C55E"
            progressBackgroundColor="#0F1923"
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 4, width: '100%', marginTop: 10 }}>
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <LottieView
                autoPlay
                loop
                source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
                style={{ width: 140, height: 140 }}
              />
              <Text style={[styles.emptyTitle, { color: theme.text, marginTop: -10 }]}>
                {searchQuery || filterStatus !== 'Todos' ? 'Nenhum resultado' : 'Despensa vazia'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                {searchQuery || filterStatus !== 'Todos'
                  ? 'Tente outra busca ou remova o filtro.'
                  : 'Adicione seus primeiros itens tocando no botão +'}
              </Text>
            </View>
          )
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
        accessibilityLabel="Adicionar novo item ao inventário"
        accessibilityRole="button"
      >
        <Plus size={28} color="#000" strokeWidth={2.5} />
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
            {!loadingRecipe && recipeText.length > 0 && (
              <TouchableOpacity onPress={handleShareRecipe} style={styles.modalShareIcon}>
                <Share2 size={20} color={theme.green} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setRecipeModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          {loadingRecipe ? (
            <View style={[styles.centered, { backgroundColor: theme.modalBg }]}>
              <ActivityIndicator size={48} color={theme.green} />
              <Text style={[styles.loadingTextAnim, { color: theme.green }]}>
                {FUN_LOADING_PHRASES[loadingPhraseIndex]}
              </Text>
              <Text style={[styles.loadingText, { fontSize: 13, opacity: 0.6, marginTop: 4, color: theme.textSecondary }]}>
                Nossa IA Gastronômica analisa nutrição (NOVA Group) e validades. Isso leva alguns segundos.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <MarkdownText content={recipeText} />
              <TouchableOpacity style={[styles.shareBtnBig, { backgroundColor: theme.greenBg }]} onPress={handleShareRecipe}>
                <Share2 size={20} color={theme.green} strokeWidth={2.5} />
                <Text style={[styles.shareBtnTextBig, { color: theme.green }]}>Compartilhar Receita (WhatsApp)</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Bottom Sheet Modal de Menu */}
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            onPress={() => setMenuVisible(false)} 
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <View style={[styles.bottomSheetHandle, { backgroundColor: theme.border }]} />
            
            <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Opções</Text>
            
            <TouchableOpacity 
              style={styles.bottomSheetItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('Stats');
              }}
            >
              <View style={[styles.bottomSheetIconWrap, { backgroundColor: theme.greenBg }]}>
                <BarChart2 size={20} color={theme.green} />
              </View>
              <Text style={[styles.bottomSheetItemText, { color: theme.text }]}>Relatório de Desperdício</Text>
              <ChevronRight size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={[styles.bottomSheetDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity 
              style={styles.bottomSheetItem}
              onPress={() => {
                toggleTheme();
              }}
            >
              <View style={[styles.bottomSheetIconWrap, { backgroundColor: theme.inputBg }]}>
                {theme.isDark 
                  ? <Sun size={20} color={theme.text} /> 
                  : <Moon size={20} color={theme.text} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bottomSheetItemText, { color: theme.text }]}>Aparência</Text>
                <Text style={[styles.bottomSheetItemSub, { color: theme.textSecondary }]}>Modo {theme.isDark ? 'Escuro' : 'Claro'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.bottomSheetItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('Onboarding');
              }}
            >
              <View style={[styles.bottomSheetIconWrap, { backgroundColor: theme.inputBg }]}>
                <HelpCircle size={20} color={theme.text} />
              </View>
              <Text style={[styles.bottomSheetItemText, { color: theme.text }]}>Como usar o app</Text>
            </TouchableOpacity>

            <View style={[styles.bottomSheetDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity 
              style={styles.bottomSheetItem}
              onPress={() => {
                setMenuVisible(false);
                signOut();
              }}
            >
              <View style={[styles.bottomSheetIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <LogOut size={20} color="#EF4444" />
              </View>
              <Text style={[styles.bottomSheetItemText, { color: '#EF4444' }]}>Sair da Conta</Text>
            </TouchableOpacity>
            
            <View style={{ height: 30 }} />
          </View>
        </View>
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
    backgroundColor: '#060A10',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#060A10',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#060A10',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  skeletonHeaderPlaceholder: {
    height: 60,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  scroll: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(34,197,94,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#FCA5A5',
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
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#0F1923',
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    paddingVertical: 12,
    borderRadius: 12,
  },
  recipeBtnUrgent: {
    backgroundColor: '#DC2626',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  recipeBtnAll: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  recipeBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  recipeBtnTextAll: {
    color: '#22C55E',
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
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#F0FDF4',
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
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
    color: '#F0FDF4',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#080D14',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F0FDF4',
    flex: 1,
  },
  modalClose: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCloseBtn: {
    paddingLeft: 12,
  },
  modalShareIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 60,
  },
  recipeText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
  },
  loadingTextAnim: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  shareBtnBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  shareBtnTextBig: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    marginLeft: 4,
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  bottomSheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bottomSheetItemText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  bottomSheetItemSub: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomSheetDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 4,
  },
});

export default DashboardScreen;
