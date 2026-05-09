/**
 * src/screens/AddItemScreen.tsx
 * ==============================
 * Tela de cadastro e edição de itens da despensa.
 * Funciona em modo "criar" (sem params) e "editar" (com itemToEdit).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronDown, FileText, ScanLine } from 'lucide-react-native';

import { useInventory } from '../hooks/useInventory';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';
import { fetchCategories, searchCatalog, guessCategory } from '../services/api';
import PrimaryButton from '../components/PrimaryButton';
import FormInput from '../components/FormInput';
import type { Category, PantryItemCreate, PantryItemUpdate, CatalogProductOut } from '../services/api';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import LottieView from 'lottie-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Hortifruti', avg_days: 5 },
  { id: 2, name: 'Laticínios', avg_days: 7 },
  { id: 3, name: 'Carnes e Aves', avg_days: 3 },
  { id: 4, name: 'Peixes e Frutos do Mar', avg_days: 2 },
  { id: 5, name: 'Cereais e Grãos', avg_days: 30 },
  { id: 6, name: 'Massas e Farináceos', avg_days: 60 },
  { id: 7, name: 'Enlatados', avg_days: 365 },
  { id: 8, name: 'Bebidas', avg_days: 30 },
  { id: 9, name: 'Condimentos e Temperos', avg_days: 180 },
  { id: 10, name: 'Congelados', avg_days: 90 },
  { id: 11, name: 'Pães e Confeitaria', avg_days: 5 },
  { id: 12, name: 'Ovos', avg_days: 14 },
  { id: 13, name: 'Outros', avg_days: 7 },
];


// ---------------------------------------------------------------------------
// Helper para formatar data no padrão do backend (ISO 8601)
// ---------------------------------------------------------------------------
function parseDateInput(input: string): string | null {
  // Aceita "DD/MM/AAAA" e converte para "AAAA-MM-DD"
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function toDisplayDate(iso?: string | null): string {
  if (!iso) return '';
  const datePart = iso.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length < 3) return iso;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------
const AddItemScreen: React.FC<Props> = ({ route, navigation }) => {
  const { itemToEdit } = route.params ?? {};
  const isEditing = !!itemToEdit;
  const { addItem, editItem, saving } = useInventory();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  // -- Categorias dinâmicas (carregadas da API) ------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Sempre oferece as 13 categorias padrão para o usuário escolher.
  // Se a API trouxer outras (ou tiver nomes/avg_days diferentes), ela sobrescreve.
  const availableCategories = (() => {
    const byId = new Map<number, Category>();
    for (const cat of DEFAULT_CATEGORIES) byId.set(cat.id, cat);
    for (const cat of categories) byId.set(cat.id, cat);
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  })();

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => { })
      .finally(() => setLoadingCategories(false));
  }, []);

  // -- Estado do formulário --------------------------------------------------
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [expiryInput, setExpiryInput] = useState('');        // DD/MM/AAAA
  const [useAutoExpiry, setUseAutoExpiry] = useState(true);  // ETL automático
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('unidade');
  const [notes, setNotes] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // -- Estado do Autocomplete (Catálogo) -------------------------------------
  const [searchResults, setSearchResults] = useState<CatalogProductOut[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Efeito Debounce para Search DB Fast API
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (name.trim().length >= 2 && showSuggestions) {
        setIsSearching(true);
        try {
          const results = await searchCatalog(name);
          setSearchResults(results);
        } catch (error) {
          console.warn("Erro ao buscar catálogo: ", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 400); // 400ms de digit delay pra poupar ping no banco

    return () => clearTimeout(delayDebounceFn);
  }, [name, showSuggestions]);

  const handleSelectSuggestion = (product: CatalogProductOut) => {
    setName(product.name);
    if (product.quantity_normalized) {
      setQuantity(String(product.quantity_normalized));
    }
    // Set categoria importada do CSV Banco através do Parser inteligente de Regex do OpenFoodFacts
    if (product.category?.name) {
      const guessedId = guessCategory([product.category.name]);
      setCategoryId(guessedId);
    } else {
      setCategoryId(13); // "Outros" como standard fallback
    }
    setShowSuggestions(false); // Esconde a popup
  };

  // Pré-preenche o formulário em modo edição
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setCategoryId(itemToEdit.category_id);
      setUseAutoExpiry(itemToEdit.expiry_estimated);
      if (!itemToEdit.expiry_estimated) {
        setExpiryInput(toDisplayDate(itemToEdit.expiry_date));
      }
      setQuantity(String(itemToEdit.quantity));
      setUnit(itemToEdit.unit);
      setNotes(itemToEdit.notes ?? '');
    }
  }, [itemToEdit]);

  // Preenche campos quando retorna do scanner
  useEffect(() => {
    const result = route.params?.scanResult;
    if (!result) return;
    if (result.name) setName(result.name);
    if (result.categoryId) setCategoryId(result.categoryId);

    // Quando o scanner não consegue inferir bem e cai em "Outros",
    // abre o seletor para o usuário escolher uma das 13 opções.
    if (!isEditing && (result.categoryId === 13 || !result.categoryId)) {
      setShowCategoryPicker(true);
    }
  }, [route.params?.scanResult]);

  // -- Abrir scanner --------------------------------------------------------
  const handleOpenScanner = () => {
    navigation.navigate('Scanner');
  };

  // -- Validação e submissão -------------------------------------------------
  const handleSubmit = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Toast.show({ type: 'error', text1: 'Campo obrigatório', text2: 'Informe o nome do produto.' });
      return;
    }
    const parsedDate = parseDateInput(expiryInput);
    if (!useAutoExpiry && !parsedDate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Toast.show({ type: 'error', text1: 'Data inválida', text2: 'Use o formato DD/MM/AAAA.' });
      return;
    }
    const parsedQty = parseFloat(quantity.replace(',', '.'));
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Toast.show({ type: 'error', text1: 'Quantidade inválida', text2: 'Informe um número maior que zero.' });
      return;
    }

    const expiryDate = useAutoExpiry ? undefined : parsedDate;

    try {
      if (isEditing && itemToEdit) {
        const payload: PantryItemUpdate = {
          name: name.trim(),
          category_id: categoryId,
          expiry_date: expiryDate ?? null,
          quantity: parsedQty,
          unit: unit.trim() || 'unidade',
          notes: notes.trim() || null,
        };
        await editItem(itemToEdit.id, payload);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Toast.show({ type: 'success', text1: 'Item atualizado!', text2: `${name.trim()} foi salvo com sucesso.` });
      } else {
        const payload: PantryItemCreate = {
          name: name.trim(),
          category_id: categoryId,
          expiry_date: expiryDate ?? null,
          quantity: parsedQty,
          unit: unit.trim() || 'unidade',
          notes: notes.trim() || null,
        };
        await addItem(payload);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Toast.show({ type: 'success', text1: 'Item adicionado!', text2: `${name.trim()} está na sua despensa.` });
      }
      navigation.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: 'Verifique a conexão com o servidor.' });
    }
  };

  const selectedCategory = availableCategories.find((c) => c.id === categoryId);

  // -- Render ----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Título */}
          <Text style={[styles.screenTitle, { fontFamily: theme.fonts?.heading }]}>
            {isEditing ? 'Editar Item' : 'Novo Item'}
          </Text>

          {/* Botão de importar nota fiscal */}
          {!isEditing && (
            <TouchableOpacity
              style={[styles.receiptBtn, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder }]}
              onPress={() => navigation.navigate('ReceiptScan')}
              activeOpacity={0.7}
            >
              <FileText size={20} color={theme.green} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.receiptBtnTitle, { color: theme.green }]}>Importar Nota Fiscal</Text>
                <Text style={[styles.receiptBtnSubtitle, { color: theme.textSecondary }]}>
                  Fotografe o cupom e importe todos os produtos
                </Text>
              </View>
              <ChevronDown size={18} color={theme.green} strokeWidth={2} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>
          )}

          {/* Campo: Nome + Typeahead */}
          <View style={[styles.fieldGroup, { zIndex: 50 }]}>
            <Text style={styles.label}>Nome do produto *</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Ex: Leite Integral"
                placeholderTextColor={theme.textMuted}
                maxLength={150}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={handleOpenScanner}
                accessibilityLabel="Escanear código de barras"
              >
                <ScanLine size={22} color="#16A34A" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Caixa Flutuante do Autocomplete */}
            {name.length >= 2 && showSuggestions && (
              <View
                style={styles.autocompleteContainer}
              >
                {isSearching ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <LottieView
                      autoPlay
                      loop
                      source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
                      style={{ width: 40, height: 40 }}
                    />
                  </View>
                ) : searchResults.length > 0 ? (
                  searchResults.map(result => (
                    <TouchableOpacity
                      key={result.ean}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(result)}
                    >
                      <Text style={[styles.suggestionText, { color: theme.text }]} numberOfLines={1}>
                        {result.name}
                      </Text>
                      {result.brand?.name && (
                        <Text style={[styles.suggestionBrand, { color: theme.textMuted }]}>
                          {result.brand.name}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.suggestionItem}>
                    <Text style={[styles.suggestionText, { color: theme.textMuted, fontStyle: 'italic' }]}>
                      Nenhum produto encontrado no catálogo.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Campo: Categoria */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Categoria *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={styles.selectorText}>{selectedCategory?.name ?? 'Selecionar'}</Text>
              <ChevronDown size={16} color={theme.textMuted} />
            </TouchableOpacity>

            {showCategoryPicker && (
              <View
                style={styles.pickerList}
              >
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {loadingCategories ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <LottieView
                        autoPlay
                        loop
                        source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
                        style={{ width: 40, height: 40 }}
                      />
                    </View>
                  ) : null}
                  {availableCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.pickerItem,
                        cat.id === categoryId && styles.pickerItemSelected,
                      ]}
                      onPress={() => {
                        setCategoryId(cat.id);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          cat.id === categoryId && styles.pickerItemTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {cat.id === categoryId && (
                        <Check size={14} color="#22C55E" strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Campo: Validade (automática ou manual) */}
          <View style={styles.fieldGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Estimar validade automaticamente</Text>
              <Switch
                value={useAutoExpiry}
                onValueChange={setUseAutoExpiry}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(34,197,94,0.5)' }}
                thumbColor={useAutoExpiry ? '#22C55E' : 'rgba(255,255,255,0.3)'}
                ios_backgroundColor="rgba(255,255,255,0.1)"
              />
            </View>
            {useAutoExpiry ? (
              <Text style={styles.autoExpiryHint}>
                O sistema estimará a validade com base na categoria selecionada.
              </Text>
            ) : (
              <FormInput
                label=""
                value={expiryInput}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 8);
                  let masked = digits;
                  if (digits.length > 4) {
                    masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                  } else if (digits.length > 2) {
                    masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                  }
                  setExpiryInput(masked);
                }}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            )}
          </View>

          {/* Quantidade e Unidade (linha dupla) */}
          <View style={[styles.rowFields, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Quantidade *"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1.3 }}>
              <FormInput
                label="Unidade"
                value={unit}
                onChangeText={setUnit}
                placeholder="unidade, kg, litro…"
                maxLength={30}
              />
            </View>
          </View>

          {/* Campo: Observações */}
          <FormInput
            label="Observações (opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: aberto, congelado, marca preferida…"
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
            style={styles.textArea}
          />

          <PrimaryButton
            label={isEditing ? 'Salvar Alterações' : 'Adicionar ao Inventário'}
            onPress={handleSubmit}
            loading={saving}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles (factory dinâmica para suportar dark mode)
// ---------------------------------------------------------------------------
function makeStyles(_theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: _theme.bg,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: _theme.text,
      marginBottom: 24,
      letterSpacing: -0.5,
    },
    fieldGroup: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: _theme.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: _theme.headerBg,
      borderWidth: 1,
      borderColor: _theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: _theme.text,
    },
    textArea: {
      height: 84,
      paddingTop: 12,
    },
    selector: {
      backgroundColor: _theme.headerBg,
      borderWidth: 1,
      borderColor: _theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectorText: {
      fontSize: 15,
      color: _theme.text,
    },
    pickerList: {
      backgroundColor: _theme.card,
      borderWidth: 1,
      borderColor: _theme.border,
      borderRadius: 12,
      marginTop: 4,
      maxHeight: 220,
      overflow: 'hidden',
    },
    pickerItem: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: _theme.borderLight,
    },
    pickerItemSelected: {
      backgroundColor: _theme.isDark ? 'rgba(34,197,94,0.12)' : '#DCFCE7',
    },
    pickerItemText: {
      fontSize: 14,
      color: _theme.textMuted,
    },
    pickerItemTextSelected: {
      color: _theme.green,
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    autoExpiryHint: {
      fontSize: 12,
      color: _theme.textMuted,
      fontStyle: 'italic',
    },
    rowFields: {
      flexDirection: 'row',
      gap: 12,
    },
    nameRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    autocompleteContainer: {
      position: 'absolute',
      top: 75,
      left: 0,
      right: 56,
      maxHeight: 200,
      backgroundColor: _theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: _theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 999,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: _theme.borderLight,
    },
    suggestionText: {
      fontSize: 14,
      fontWeight: '500',
      color: _theme.text,
    },
    suggestionBrand: {
      fontSize: 12,
      marginTop: 2,
      color: _theme.textMuted,
    },
    scanBtn: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: 'rgba(34,197,94,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitBtn: {
      backgroundColor: '#22C55E',
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
      elevation: 8,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      color: '#000',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    receiptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      marginBottom: 24,
    },
    receiptBtnTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
    },
    receiptBtnSubtitle: {
      fontSize: 12,
    },
  });
}

export default AddItemScreen;
