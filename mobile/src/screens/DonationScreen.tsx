/**
 * src/screens/DonationScreen.tsx
 * ===============================
 * Tela de Doação Reversa.
 * Fluxo: verifica elegibilidade → captura GPS → busca ONGs → mostra lista → ações.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import {
  ArrowLeft,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Navigation,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

import type { RootStackParamList } from '../../App';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../contexts/ThemeContext';
import {
  checkDonationEligibility,
  suggestDonationPlaces,
  recordHistory,
  deleteItem,
} from '../services/api';
import type { DonationPlace, PantryItem } from '../services/api';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Donation'>;

type ScreenState = 'checking' | 'ineligible' | 'locating' | 'searching' | 'results' | 'confirming' | 'done';

const DonationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { item } = route.params;
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [state, setState] = useState<ScreenState>('checking');
  const [ineligibleReason, setIneligibleReason] = useState('');
  const [places, setPlaces] = useState<DonationPlace[]>([]);
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // -----------------------------------------------------------------------
  // Step 1: Verificar elegibilidade
  // -----------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const result = await checkDonationEligibility(item.id);
        if (!result.eligible) {
          setIneligibleReason(result.reason || 'Este item não pode ser doado.');
          setState('ineligible');
          return;
        }
        setState('locating');
        await getLocationAndSearch();
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Erro', text2: 'Falha ao verificar elegibilidade.' });
        navigation.goBack();
      }
    })();
  }, []);

  // -----------------------------------------------------------------------
  // Step 2: Obter localização e buscar ONGs
  // -----------------------------------------------------------------------
  const getLocationAndSearch = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da localização para encontrar ONGs próximas.');
        navigation.goBack();
        return;
      }

      setState('locating');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Geocode reverso para obter a cidade
      let city = '';
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (geo) {
          city = [geo.city, geo.region].filter(Boolean).join(', ');
        }
      } catch {
        // Ignora erro de geocode
      }

      setState('searching');
      const response = await suggestDonationPlaces(
        item.id,
        location.coords.latitude,
        location.coords.longitude,
        city,
      );

      setPlaces(response.places);
      setWhatsappMsg(response.whatsapp_message);
      setState('results');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    } catch (err: any) {
      console.error('Erro ao buscar ONGs:', err);
      Toast.show({
        type: 'error',
        text1: 'Falha na busca',
        text2: err.response?.data?.detail || 'Não foi possível encontrar ONGs próximas.',
      });
      navigation.goBack();
    }
  };

  // -----------------------------------------------------------------------
  // Ações nos cards
  // -----------------------------------------------------------------------
  const openWhatsApp = (place: DonationPlace) => {
    // Usa whatsapp dedicado, ou fallback para telefone limpo
    const number = place.whatsapp || (place.phone ? place.phone.replace(/\D/g, '') : null);
    if (!number) {
      Toast.show({ type: 'info', text1: 'Nenhum contato disponível para esta instituição.' });
      return;
    }
    // Garante formato brasileiro com 55
    const formatted = number.startsWith('55') ? number : `55${number}`;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(whatsappMsg)}`;
    Linking.openURL(url);
  };

  const callPhone = (place: DonationPlace) => {
    if (!place.phone) {
      Toast.show({ type: 'info', text1: 'Telefone não disponível.' });
      return;
    }
    const cleaned = place.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  const openMap = (place: DonationPlace) => {
    const encoded = encodeURIComponent(place.address);
    const url = Platform.OS === 'ios'
      ? `maps:?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    Linking.openURL(url);
  };

  // -----------------------------------------------------------------------
  // Marcar como doado
  // -----------------------------------------------------------------------
  const handleMarkDonated = async () => {
    setState('confirming');
    try {
      await recordHistory({
        item_name: item.name,
        category_name: item.category.name,
        quantity: item.quantity,
        unit: item.unit,
        expiry_date: item.expiry_date,
        removal_reason: 'donated',
        notes: 'Doação via app',
      });
      await deleteItem(item.id);
      setState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('Erro ao registrar doação:', err);
      Toast.show({ type: 'error', text1: 'Erro ao registrar doação.' });
      setState('results');
    }
  };

  // -----------------------------------------------------------------------
  // Render states
  // -----------------------------------------------------------------------

  const renderLoading = (message: string) => (
    <View style={s.center}>
      <ActivityIndicator size="large" color={theme.green} />
      <Text style={[s.loadingText, { color: theme.text }]}>{message}</Text>
    </View>
  );

  const renderIneligible = () => (
    <View style={s.center}>
      <View style={[s.iconCircle, { backgroundColor: '#FFF1F2' }]}>
        <AlertTriangle size={48} color="#EF4444" strokeWidth={1.5} />
      </View>
      <Text style={[s.mainTitle, { color: theme.text }]}>Doação Não Permitida</Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>{ineligibleReason}</Text>
      <PrimaryButton
        label="Voltar"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 24, width: '100%' }}
      />
    </View>
  );

  const renderResults = () => (
    <View style={{ flex: 1 }}>
      <View style={s.resultsHeader}>
        <Text style={[s.resultsTitle, { color: theme.text }]}>
          {places.length} {places.length === 1 ? 'instituição encontrada' : 'instituições encontradas'}
        </Text>
        <Text style={[s.resultsSubtitle, { color: theme.textSecondary }]}>
          Doando: {item.name} ({item.quantity} {item.unit})
        </Text>
      </View>

      <FlatList
        data={places}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={s.listContent}
        renderItem={({ item: place }) => (
          <View style={[s.placeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={s.placeHeader}>
              <Heart size={18} color={theme.green} strokeWidth={2} />
              <Text style={[s.placeName, { color: theme.text }]} numberOfLines={1}>{place.name}</Text>
              <View style={[s.distBadge, { backgroundColor: theme.greenBg }]}>
                <Text style={[s.distText, { color: theme.green }]}>{place.distance_km.toFixed(1)} km</Text>
              </View>
            </View>

            <View style={s.placeInfo}>
              <View style={s.infoRow}>
                <MapPin size={14} color={theme.textMuted} strokeWidth={2} />
                <Text style={[s.infoText, { color: theme.textSecondary }]} numberOfLines={2}>{place.address}</Text>
              </View>
              <View style={s.infoRow}>
                <Clock size={14} color={theme.textMuted} strokeWidth={2} />
                <Text style={[s.infoText, { color: theme.textSecondary }]}>{place.hours}</Text>
              </View>
              {place.description ? (
                <Text style={[s.placeDesc, { color: theme.textMuted }]}>{place.description}</Text>
              ) : null}
            </View>

            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}
                onPress={() => openWhatsApp(place)}
              >
                <MessageCircle size={16} color="#16A34A" strokeWidth={2} />
                <Text style={[s.actionText, { color: '#16A34A' }]}>WhatsApp</Text>
              </TouchableOpacity>
              {place.phone && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}
                  onPress={() => callPhone(place)}
                >
                  <Phone size={16} color="#3B82F6" strokeWidth={2} />
                  <Text style={[s.actionText, { color: '#3B82F6' }]}>Ligar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}
                onPress={() => openMap(place)}
              >
                <Navigation size={16} color="#EA580C" strokeWidth={2} />
                <Text style={[s.actionText, { color: '#EA580C' }]}>Mapa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={s.footer}>
            {/* Confirmação legal */}
            <TouchableOpacity
              style={[s.confirmCheck, { borderColor: confirmed ? theme.green : theme.border }]}
              onPress={() => setConfirmed(c => !c)}
            >
              <View style={[
                s.checkbox,
                confirmed
                  ? { backgroundColor: theme.green, borderColor: theme.green }
                  : { borderColor: theme.border },
              ]}>
                {confirmed && <ShieldCheck size={14} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[s.confirmText, { color: theme.textSecondary }]}>
                Confirmo que o alimento está dentro do prazo de validade, lacrado e em condições adequadas de consumo.
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              label="✅  Doação Realizada"
              onPress={handleMarkDonated}
              disabled={!confirmed}
              style={{ marginTop: 16 }}
            />
            <Text style={[s.legalNote, { color: theme.textMuted }]}>
              Lei 14.016/2020 — O doador é isento de responsabilidade civil e penal.
            </Text>
          </View>
        }
      />
    </View>
  );

  const renderDone = () => (
    <View style={s.center}>
      <View style={[s.iconCircle, { backgroundColor: theme.greenBg }]}>
        <Heart size={56} color={theme.green} strokeWidth={1.5} />
      </View>
      <Text style={[s.mainTitle, { color: theme.text }]}>Obrigado! 🎉</Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        Sua doação de {item.name} foi registrada. Você ajudou a reduzir o desperdício de alimentos!
      </Text>
      <PrimaryButton
        label="Voltar ao Inventário"
        onPress={() => navigation.popToTop()}
        style={{ marginTop: 24, width: '100%' }}
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
        <Text style={[s.headerTitle, { color: theme.text }]}>Doação Reversa</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'checking' && renderLoading('Verificando elegibilidade…')}
      {state === 'ineligible' && renderIneligible()}
      {state === 'locating' && renderLoading('Obtendo sua localização…')}
      {state === 'searching' && renderLoading('Buscando ONGs próximas…')}
      {state === 'results' && renderResults()}
      {state === 'confirming' && renderLoading('Registrando doação…')}
      {state === 'done' && renderDone()}
    </SafeAreaView>
  );
};

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    iconCircle: {
      width: 112, height: 112, borderRadius: 56,
      justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    },
    mainTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    loadingText: { fontSize: 16, fontWeight: '600', marginTop: 16 },

    // Results
    resultsHeader: { padding: 20, paddingBottom: 8 },
    resultsTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    resultsSubtitle: { fontSize: 14 },
    listContent: { padding: 16, gap: 14, paddingBottom: 32 },

    // Place card
    placeCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
    placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    placeName: { flex: 1, fontSize: 16, fontWeight: '700' },
    distBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    distText: { fontSize: 12, fontWeight: '700' },
    placeInfo: { gap: 6 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    infoText: { flex: 1, fontSize: 13 },
    placeDesc: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },

    // Actions
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    },
    actionText: { fontSize: 13, fontWeight: '600' },

    // Footer
    footer: { padding: 4, paddingBottom: 32 },
    confirmCheck: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 12, borderWidth: 1.5,
    },
    checkbox: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 2,
      justifyContent: 'center', alignItems: 'center',
    },
    confirmText: { flex: 1, fontSize: 13, lineHeight: 18 },
    legalNote: { fontSize: 11, textAlign: 'center', marginTop: 12 },
  });
}

export default DonationScreen;
