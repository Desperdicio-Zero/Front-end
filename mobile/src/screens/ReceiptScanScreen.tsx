/**
 * src/screens/ReceiptScanScreen.tsx
 * ==================================
 * Tela de leitura de nota fiscal via foto.
 * Fluxo: escolher imagem → IA extrai produtos → revisar → importar.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Image as ImageIcon,
  Check,
  X,
  ArrowLeft,
  FileText,
  PackageCheck,
  Trash2,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

import type { RootStackParamList } from '../../App';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../contexts/ThemeContext';
import { scanReceipt, importReceiptItems } from '../services/api';
import type { ParsedReceiptItem } from '../services/api';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptScan'>;


type ReceiptItemWithToggle = ParsedReceiptItem & { selected: boolean };

type ScreenState = 'choose' | 'scanning' | 'review' | 'importing' | 'done';

const ReceiptScanScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [state, setState] = useState<ScreenState>('choose');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiptItemWithToggle[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  // -----------------------------------------------------------------------
  // Captura / Seleção de Imagem
  // -----------------------------------------------------------------------
  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Precisamos de acesso à câmera.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Precisamos de acesso à galeria.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          handleScan(asset.base64);
        }
      }
    } catch (err) {
      console.error('Erro ao capturar imagem:', err);
      Toast.show({ type: 'error', text1: 'Erro ao acessar câmera/galeria.' });
    }
  };

  // -----------------------------------------------------------------------
  // Envio para IA
  // -----------------------------------------------------------------------
  const handleScan = async (base64: string) => {
    setState('scanning');
    try {
      const response = await scanReceipt(base64);
      const withToggle: ReceiptItemWithToggle[] = response.items_parsed.map(item => ({
        ...item,
        selected: true,
      }));
      setItems(withToggle);
      setState('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      if (withToggle.length === 0) {
        Toast.show({ type: 'info', text1: 'Nenhum produto encontrado no cupom.' });
      }
    } catch (err: any) {
      console.error('Erro ao escanear cupom:', err);
      Toast.show({
        type: 'error',
        text1: 'Falha na leitura',
        text2: err.response?.data?.detail || 'Não foi possível processar o cupom.',
      });
      setState('choose');
    }
  };

  // -----------------------------------------------------------------------
  // Importação
  // -----------------------------------------------------------------------
  const handleImport = async () => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) {
      Toast.show({ type: 'error', text1: 'Selecione ao menos um item.' });
      return;
    }

    setState('importing');
    try {
      const itemsToImport: ParsedReceiptItem[] = selected.map(({ selected: _, ...rest }) => rest);
      const created = await importReceiptItems(itemsToImport);
      setImportedCount(created.length);
      setState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: 'success',
        text1: `${created.length} ${created.length === 1 ? 'item importado' : 'itens importados'}!`,
      });
    } catch (err: any) {
      console.error('Erro ao importar itens:', err);
      Toast.show({
        type: 'error',
        text1: 'Falha na importação',
        text2: err.response?.data?.detail || 'Tente novamente.',
      });
      setState('review');
    }
  };

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const selectedCount = items.filter(i => i.selected).length;

  // -----------------------------------------------------------------------
  // Renderização
  // -----------------------------------------------------------------------

  // Tela 1: Escolher fonte da imagem
  const renderChoose = () => (
    <View style={s.centerContainer}>
      <View style={[s.iconCircle, { backgroundColor: theme.greenBg }]}>
        <FileText size={56} color={theme.green} strokeWidth={1.5} />
      </View>
      <Text style={[s.mainTitle, { color: theme.text }]}>Importar Nota Fiscal</Text>
      <Text style={[s.mainSubtitle, { color: theme.textSecondary }]}>
        Fotografe ou selecione uma imagem do cupom fiscal do mercado.
        A IA vai extrair os produtos automaticamente.
      </Text>

      <View style={s.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            s.sourceBtn,
            { backgroundColor: theme.green },
            pressed && s.sourceBtnPressed,
          ]}
          onPress={() => pickImage('camera')}
        >
          <Camera size={24} color="#fff" strokeWidth={2} />
          <Text style={s.sourceBtnText}>Câmera</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            s.sourceBtn,
            { backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.green },
            pressed && s.sourceBtnPressed,
          ]}
          onPress={() => pickImage('gallery')}
        >
          <ImageIcon size={24} color={theme.green} strokeWidth={2} />
          <Text style={[s.sourceBtnText, { color: theme.green }]}>Galeria</Text>
        </Pressable>
      </View>
    </View>
  );

  // Tela 2: Loading durante análise pela IA
  const renderScanning = () => (
    <View style={s.centerContainer}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={s.previewImage} resizeMode="contain" />
      )}
      <ActivityIndicator size="large" color={theme.green} style={{ marginTop: 24 }} />
      <Text style={[s.scanningText, { color: theme.text }]}>Analisando cupom fiscal…</Text>
      <Text style={[s.scanningSubtext, { color: theme.textMuted }]}>
        A inteligência artificial está extraindo os produtos.
      </Text>
    </View>
  );

  // Tela 3: Revisão dos itens extraídos
  const renderReview = () => (
    <View style={{ flex: 1 }}>
      <View style={s.reviewHeader}>
        <Text style={[s.reviewTitle, { color: theme.text }]}>
          {items.length} {items.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </Text>
        <Text style={[s.reviewSubtitle, { color: theme.textSecondary }]}>
          Desmarque os itens que não deseja importar.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={s.listContent}
        renderItem={({ item, index }) => (
          <View style={[
            s.itemRow,
            { backgroundColor: theme.card, borderColor: item.selected ? theme.green : theme.border },
          ]}>
            <TouchableOpacity
              style={[
                s.checkbox,
                item.selected
                  ? { backgroundColor: theme.green, borderColor: theme.green }
                  : { backgroundColor: 'transparent', borderColor: theme.border },
              ]}
              onPress={() => toggleItem(index)}
            >
              {item.selected && <Check size={14} color="#fff" strokeWidth={3} />}
            </TouchableOpacity>

            <View style={s.itemInfo}>
              <Text style={[s.itemName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[s.itemMeta, { color: theme.textMuted }]}>
                {item.quantity} {item.unit} · {item.category_hint}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => removeItem(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={18} color={theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={s.bottomBar}>
        <PrimaryButton
          label={`Importar ${selectedCount} ${selectedCount === 1 ? 'item' : 'itens'}`}
          onPress={handleImport}
          disabled={selectedCount === 0}
        />
      </View>
    </View>
  );

  // Tela 4: Importando (loading)
  const renderImporting = () => (
    <View style={s.centerContainer}>
      <ActivityIndicator size="large" color={theme.green} />
      <Text style={[s.scanningText, { color: theme.text }]}>Importando itens…</Text>
    </View>
  );

  // Tela 5: Sucesso
  const renderDone = () => (
    <View style={s.centerContainer}>
      <View style={[s.iconCircle, { backgroundColor: theme.greenBg }]}>
        <PackageCheck size={56} color={theme.green} strokeWidth={1.5} />
      </View>
      <Text style={[s.mainTitle, { color: theme.text }]}>Importação Concluída!</Text>
      <Text style={[s.mainSubtitle, { color: theme.textSecondary }]}>
        {importedCount} {importedCount === 1 ? 'produto foi adicionado' : 'produtos foram adicionados'} ao seu inventário.
      </Text>
      <PrimaryButton
        label="Voltar ao Inventário"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 24, width: '100%' }}
      />
      <PrimaryButton
        label="Escanear Outro Cupom"
        onPress={() => {
          setState('choose');
          setImageUri(null);
          setItems([]);
        }}
        variant="outline"
        style={{ marginTop: 12, width: '100%' }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.green} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Nota Fiscal</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      {state === 'choose' && renderChoose()}
      {state === 'scanning' && renderScanning()}
      {state === 'review' && renderReview()}
      {state === 'importing' && renderImporting()}
      {state === 'done' && renderDone()}
    </SafeAreaView>
  );
};

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700' },

    // Choose state
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    iconCircle: {
      width: 112,
      height: 112,
      borderRadius: 56,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    mainTitle: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -0.3,
    },
    mainSubtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 16,
      width: '100%',
    },
    sourceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    sourceBtnPressed: {
      transform: [{ scale: 0.97 }],
      elevation: 1,
    },
    sourceBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },

    // Scanning
    previewImage: {
      width: 200,
      height: 280,
      borderRadius: 12,
      marginBottom: 16,
    },
    scanningText: {
      fontSize: 18,
      fontWeight: '700',
      marginTop: 16,
    },
    scanningSubtext: {
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },

    // Review
    reviewHeader: {
      padding: 20,
      paddingBottom: 8,
    },
    reviewTitle: {
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 4,
    },
    reviewSubtitle: {
      fontSize: 14,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
      gap: 10,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      gap: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    itemMeta: {
      fontSize: 13,
    },

    // Bottom bar
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      backgroundColor: theme.bg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
  });
}

export default ReceiptScanScreen;
