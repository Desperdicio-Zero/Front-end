/**
 * src/screens/ScannerScreen.tsx
 * ==============================
 * Tela de scanner de código de barras (EAN-13, EAN-8, UPC-A).
 * Consulta a Open Food Facts API para obter nome e categoria do produto.
 * Retorna o resultado para a tela anterior via callback nos params.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { X, RefreshCw } from 'lucide-react-native';

import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

// ---------------------------------------------------------------------------
// Resultado retornado ao AddItemScreen
// ---------------------------------------------------------------------------
export interface ScanResult {
  name: string;
  categoryId: number;
  barcode: string;
}

// ---------------------------------------------------------------------------
// Mapeamento simplificado: tags da Open Food Facts → category_id local
// ---------------------------------------------------------------------------
const KEYWORD_TO_CATEGORY: [string, number][] = [
  ['milk', 2], ['dairy', 2], ['cheese', 2], ['yogurt', 2], ['queijo', 2], ['leite', 2],
  ['meat', 3], ['chicken', 3], ['beef', 3], ['pork', 3], ['carne', 3], ['frango', 3],
  ['fish', 4], ['seafood', 4], ['peixe', 4], ['shrimp', 4],
  ['cereal', 5], ['grain', 5], ['rice', 5], ['bean', 5], ['arroz', 5], ['feijao', 5],
  ['pasta', 6], ['flour', 6], ['bread', 11], ['cake', 11], ['pao', 11], ['macarrao', 6],
  ['canned', 7], ['conserva', 7],
  ['beverage', 8], ['drink', 8], ['juice', 8], ['soda', 8], ['agua', 8], ['suco', 8],
  ['spice', 9], ['condiment', 9], ['sauce', 9], ['tempero', 9], ['molho', 9],
  ['frozen', 10], ['congelado', 10],
  ['egg', 12], ['ovo', 12],
];

function guessCategory(tags: string[]): number {
  const normalized = tags.map((t) =>
    t.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  for (const [keyword, id] of KEYWORD_TO_CATEGORY) {
    if (normalized.some((t) => t.includes(keyword))) return id;
  }
  return 13; // Outros
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [statusMsg, setStatusMsg] = useState('Aponte a câmera para o código de barras');
  const { theme } = useTheme();

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setStatusMsg('Buscando produto…');

    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();

      let productName = '';
      let categoryId  = 13;

      if (json.status === 1 && json.product) {
        productName = json.product.product_name_pt
          ?? json.product.product_name
          ?? '';
        categoryId = guessCategory(json.product.categories_tags ?? []);
      }

      navigation.popTo('AddItem', { scanResult: { name: productName, categoryId, barcode: data } });
    } catch {
      setStatusMsg('Erro ao buscar produto. Tente novamente.');
      setScanned(false);
      setLoading(false);
    }
  };

  const handleRescan = () => {
    setScanned(false);
    setLoading(false);
    setStatusMsg('Aponte a câmera para o código de barras');
  };

  // -- Permissão não carregada ainda
  if (!permission) {
    return <View style={styles.container} />;
  }

  // -- Permissão negada
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permissionContainer, { backgroundColor: theme.bg }]}>
        <Text style={[styles.permissionText, { color: theme.text }]}>
          É necessário autorizar o acesso à câmera para escanear produtos.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Autorizar Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.popTo('AddItem', {})}>
          <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancelar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Câmera em tela cheia */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
        }}
      />

      {/* Overlay com janela de scan */}
      <View style={styles.overlay}>
        {/* Faixa superior */}
        <View style={styles.overlayDark} />

        {/* Faixa do meio: laterais escuras + caixa transparente */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Faixa inferior com status */}
        <View style={[styles.overlayDark, styles.overlayBottom]}>
          {loading ? (
            <ActivityIndicator color="#FFF" size="large" />
          ) : (
            <Text style={styles.statusText}>{statusMsg}</Text>
          )}
          {scanned && !loading && (
            <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan}>
              <RefreshCw size={16} color="#FFF" strokeWidth={2} />
              <Text style={styles.rescanBtnText}>Escanear novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Botão fechar */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <X size={24} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const SCAN_BOX_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 32,
    gap: 16,
  },
  permissionText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayBottom: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    borderRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#16A34A',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rescanBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rescanBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScannerScreen;
