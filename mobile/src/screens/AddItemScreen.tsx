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
import { Check, ChevronDown, ScanLine } from 'lucide-react-native';

import { useInventory } from '../hooks/useInventory';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';
import { fetchCategories, searchCatalog, guessCategory } from '../services/api';
import PrimaryButton from '../components/PrimaryButton';
import type { Category, PantryItemCreate, PantryItemUpdate, CatalogProductOut } from '../services/api';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;


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

function toDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
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
    if (!useAutoExpiry && !parseDateInput(expiryInput)) {
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

    const expiryDate = useAutoExpiry ? undefined : parseDateInput(expiryInput)!;

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
        Toast.show({ type: 'success', text1: 'Item atualizado! ✅', text2: `${name.trim()} foi salvo com sucesso.` });
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
        Toast.show({ type: 'success', text1: 'Item adicionado! 🎉', text2: `${name.trim()} está na sua despensa.` });
      }
      navigation.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: 'Verifique a conexão com o servidor.' });
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // -- Render ----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Título */}
          <Text style={styles.screenTitle}>
            {isEditing ? 'Editar Item' : 'Novo Item'}
          </Text>

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
                  <ActivityIndicator style={{ padding: 12 }} color="#16A34A" />
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
                {loadingCategories ? (
                  <ActivityIndicator style={{ padding: 16 }} color="#16A34A" />
                ) : null}
                {categories.map((cat) => (
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
                      <Check size={14} color="#16A34A" strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                ))}
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
                trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                thumbColor={useAutoExpiry ? '#16A34A' : '#9CA3AF'}
              />
            </View>
            {useAutoExpiry ? (
              <Text style={styles.autoExpiryHint}>
                O sistema estimará a validade com base na categoria selecionada.
              </Text>
            ) : (
              <TextInput
                style={styles.input}
                value={expiryInput}
                onChangeText={(t) => {
                  // Aplica máscara DD/MM/AAAA automaticamente
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
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                maxLength={10}
              />
            )}
          </View>

          {/* Quantidade e Unidade (linha dupla) */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Quantidade *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1.3 }]}>
              <Text style={styles.label}>Unidade</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="unidade, kg, litro…"
                placeholderTextColor={theme.textMuted}
                maxLength={30}
              />
            </View>
          </View>

          {/* Campo: Observações */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Observações (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: aberto, congelado, marca preferida…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

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
function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 24,
    },
    fieldGroup: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    textArea: {
      height: 80,
      paddingTop: 12,
    },
    selector: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectorText: {
      fontSize: 15,
      color: theme.text,
    },
    pickerList: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      marginTop: 4,
      maxHeight: 220,
      overflow: 'hidden',
    },
    pickerItem: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    pickerItemSelected: {
      backgroundColor: theme.greenBg,
    },
    pickerItemText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    pickerItemTextSelected: {
      color: theme.green,
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
      color: theme.textMuted,
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
      right: 56, // espaço do botão da câmera
      maxHeight: 200,
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 5,
      zIndex: 999,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    suggestionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    suggestionBrand: {
      fontSize: 12,
      marginTop: 2,
    },
    scanBtn: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: theme.greenBg,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitBtn: {
      backgroundColor: '#16A34A',
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}

export default AddItemScreen;
