/**
 * src/screens/ScannerScreen.tsx
 * Redesigned with enhanced dark scanner UI + green corner accents
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
import { X, RefreshCw, ScanLine } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import type { RootStackParamList } from '../../App';
import { getCatalogItemByEan, guessCategory } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export interface ScanResult {
  name: string;
  categoryId: number;
  barcode: string;
}

const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Aponte a câmera para o código de barras');

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setScanned(true);
    setLoading(true);
    setStatusMsg('Buscando produto no banco central…');

    let productName = '';
    let categoryId = 13;

    try {
      const localProduct = await getCatalogItemByEan(data);
      if (localProduct && localProduct.name) {
        productName = localProduct.name;
        if (localProduct.category?.id) categoryId = localProduct.category.id;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.popTo('AddItem', { scanResult: { name: productName, categoryId, barcode: data } });
        return;
      }
    } catch (err) {
      console.log('Não achou no MySQL, partindo para Internet Mundial...');
    }

    try {
      setStatusMsg('Tentando online na base mundial...');
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();

      if (json.status === 1 && json.product) {
        productName = json.product.product_name_pt ?? json.product.product_name ?? '';
        categoryId = guessCategory(json.product.categories_tags ?? []);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.popTo('AddItem', { scanResult: { name: productName, categoryId, barcode: data } });
      } else {
        setStatusMsg('Produto não encontrado em nenhum Catálogo!');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setTimeout(() => { setScanned(false); setLoading(false); setStatusMsg('Aponte a câmera para o código de barras'); }, 3000);
      }
    } catch {
      setStatusMsg('Erro de conexão ao buscar produto.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setTimeout(() => { setScanned(false); setLoading(false); setStatusMsg('Aponte a câmera para o código de barras'); }, 3000);
    }
  };

  const handleRescan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setScanned(false);
    setLoading(false);
    setStatusMsg('Aponte a câmera para o código de barras');
  };

  if (!permission) return <View style={[styles.container, { backgroundColor: theme.bg }]} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permissionContainer, { backgroundColor: theme.bg }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.permissionIconWrap}>
            <ScanLine size={40} color="#22C55E" strokeWidth={1.5} />
          </View>
          <Text style={[styles.permissionTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>Câmera necessária</Text>
          <Text style={[styles.permissionText, { color: theme.textSecondary, fontFamily: theme.fonts?.regular }]}>
            É necessário autorizar o acesso à câmera para escanear produtos.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={[styles.permissionBtnText, { fontFamily: theme.fonts?.medium }]}>Autorizar Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.popTo('AddItem', {})}>
            <Text style={[styles.cancelBtnText, { fontFamily: theme.fonts?.medium }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Camera fullscreen */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
      />

      {/* Dark overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayDark} />

        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          {/* Scan box with glowing green corners */}
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Scan line hint */}
            {!loading && !scanned && (
              <View style={styles.scanLine} />
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>

        <View style={[styles.overlayDark, styles.overlayBottom]}>
          {loading ? (
            <>
              <ActivityIndicator color="#22C55E" size="large" />
              <Text style={[styles.loadingText, { fontFamily: theme.fonts?.medium }]}>Buscando produto…</Text>
            </>
          ) : (
            <Text style={[styles.statusText, { fontFamily: theme.fonts?.medium }]}>{statusMsg}</Text>
          )}
          {scanned && !loading && (
            <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan}>
              <RefreshCw size={16} color="#22C55E" strokeWidth={2} />
              <Text style={[styles.rescanBtnText, { fontFamily: theme.fonts?.medium }]}>Escanear novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <X size={22} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

const SCAN_BOX_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  permissionContainer: {
    flex: 1, backgroundColor: '#060A10', justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  permissionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', padding: 28, alignItems: 'center', gap: 14, width: '100%',
  },
  permissionIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.3)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#F0FDF4', letterSpacing: -0.3 },
  permissionText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    backgroundColor: '#22C55E', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  permissionBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayMiddle: { flexDirection: 'row', height: SCAN_BOX_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayBottom: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  scanBox: { width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE, borderRadius: 4 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#22C55E', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: {
    position: 'absolute', top: '50%', left: 8, right: 8, height: 2,
    backgroundColor: 'rgba(34,197,94,0.6)',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
  },
  statusText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 24 },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  rescanBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
  },
  rescanBtnText: { color: '#22C55E', fontWeight: '600', fontSize: 14 },
  closeBtn: {
    position: 'absolute', top: 54, right: 20, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
});

export default ScannerScreen;
