/**
 * src/screens/StatsScreen.tsx
 * ============================
 * Tela de Relatório de Desperdício — Redesigned with Fintech Dark Dashboard theme.
 * Mostra estatísticas agregadas de itens consumidos vs. vencidos/descartados.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart2, Leaf, TrendingDown, TrendingUp, Award, ChevronLeft } from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

import { fetchHistoryTimeline, fetchStats, StatsResponse, type ItemHistoryOut } from '../services/api';
import { useTheme, AppTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

// ---------------------------------------------------------------------------
// Componente: MetricCard — Fintech style
// ---------------------------------------------------------------------------
interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  theme: AppTheme;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color, bgColor, icon, theme }) => (
  <View style={[cardStyles.card, { backgroundColor: theme.headerBg, borderColor: theme.border, borderLeftColor: color }]}>
    <View style={[cardStyles.iconWrap, { backgroundColor: bgColor }]}>{icon}</View>
    <Text style={[cardStyles.value, { color, textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8, fontFamily: theme.fonts?.heading }]}>
      {value}
    </Text>
    <Text style={[cardStyles.label, { color: theme.textSecondary, fontFamily: theme.fonts?.medium }]}>{label}</Text>
    {sub ? <Text style={[cardStyles.sub, { color: theme.textMuted, fontFamily: theme.fonts?.regular }]}>{sub}</Text> : null}
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sub: {
    fontSize: 10,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
const StatsScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [timeline, setTimeline] = useState<ItemHistoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatRemovedAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const reasonLabel = (reason: ItemHistoryOut['removal_reason']) => {
    if (reason === 'consumed') return t('stats.reasons.consumed');
    if (reason === 'expired') return t('stats.reasons.expired');
    if (reason === 'donated') return t('stats.reasons.donated');
    return t('stats.reasons.other');
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [statsData, timelineData] = await Promise.all([
        fetchStats(),
        fetchHistoryTimeline(12, 0).catch(() => []),
      ]);
      setStats(statsData);
      setTimeline(timelineData);
    } catch {
      setError(t('stats.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    load();
  };

  // -- Loading ---------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <LottieView
            autoPlay
            loop
            source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
            style={{ width: 120, height: 120, opacity: 0.5 }}
        />
        <Text style={[styles.loadingText, { color: theme.textSecondary, fontFamily: theme.fonts?.medium }]}>{t('stats.loading')}</Text>
      </SafeAreaView>
    );
  }

  const isEmpty = !stats || stats.total_removed === 0;
  const utilizationRate = stats ? (100 - stats.waste_rate_percent).toFixed(0) : '0';
  const isGoodRate = stats ? stats.waste_rate_percent <= 30 : true;
  const rateColor = isGoodRate ? theme.green : '#EF4444';

  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            navigation.goBack();
          }} 
          style={styles.backBtn} 
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={theme.green} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BarChart2 size={18} color={theme.green} strokeWidth={2.5} />
          <Text style={[styles.headerTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>{t('stats.title')}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Erro ──────────────────────────────────────────────────────────── */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isEmpty ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <View style={styles.emptyContainer}>
          <LottieView
            autoPlay
            loop
            source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
            style={{ width: 150, height: 150 }}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('stats.empty.title')}</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            {t('stats.empty.subtitle')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.green]}
              tintColor={theme.green}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Taxa de aproveitamento ──────────────────────────────────── */}
          <View style={[styles.rateSection, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
            {/* Circular rate indicator */}
            <View style={[styles.rateCircle, { borderColor: rateColor, shadowColor: rateColor }]}>
              <Text style={[styles.rateValue, { color: rateColor }]}>{utilizationRate}%</Text>
              <Text style={[styles.rateLabel, { color: theme.textMuted }]}>{t('stats.approveLabel').replace('\n', '\n')}</Text>
            </View>
            <View style={styles.rateInfo}>
              <Text style={[styles.rateTitle, { color: theme.text }]}>{t('stats.utilizationRate')}</Text>
              <Text style={[styles.rateDesc, { color: theme.textSecondary }]}>
                De {stats!.total_removed} itens removidos,{' '}
                <Text style={{ color: theme.green, fontWeight: '700' }}>
                  {stats!.total_consumed} consumidos
                </Text>{' '}
                e{' '}
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>
                  {stats!.total_expired} descartados
                </Text>.
              </Text>
              {stats!.waste_rate_percent <= 15 && (
                <View style={[styles.badge, { backgroundColor: theme.warnBg, borderColor: theme.warnBg }]}>
                  <Award size={12} color={theme.isDark ? '#F59E0B' : '#D97706'} strokeWidth={2} />
                  <Text style={[styles.badgeText, { color: theme.isDark ? '#F59E0B' : '#D97706', fontFamily: theme.fonts?.medium }]}>{t('stats.lowWaste')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Cards este mês ──────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontFamily: theme.fonts?.heading }]}>{t('stats.sections.thisMonth')}</Text>
          <View style={styles.cardsRow}>
            <MetricCard
              label={t('stats.metrics.consumed')}
              value={stats!.this_month_consumed}
              color={theme.green}
              bgColor={theme.isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7'}
              icon={<TrendingUp size={18} color={theme.green} strokeWidth={2.5} />}
              theme={theme}
            />
            <MetricCard
              label={t('stats.metrics.expired')}
              value={stats!.this_month_expired}
              color="#EF4444"
              bgColor={theme.isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2'}
              icon={<TrendingDown size={18} color="#EF4444" strokeWidth={2.5} />}
              theme={theme}
            />
          </View>

          {/* ── Cards totais ────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('stats.sections.historical')}</Text>
          <View style={styles.cardsRow}>
            <MetricCard
              label={t('stats.metrics.consumed')}
              value={stats!.total_consumed}
              sub={t('stats.metrics.total')}
              color={theme.green}
              bgColor={theme.isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7'}
              icon={<TrendingUp size={18} color={theme.green} strokeWidth={2.5} />}
              theme={theme}
            />
            <MetricCard
              label={t('stats.metrics.expired')}
              value={stats!.total_expired}
              sub={t('stats.metrics.total')}
              color="#EF4444"
              bgColor={theme.isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2'}
              icon={<TrendingDown size={18} color="#EF4444" strokeWidth={2.5} />}
              theme={theme}
            />
          </View>

          {/* ── Gráfico geral ───────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('stats.sections.overview')}</Text>
          <View style={[styles.chartCard, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
            <PieChart
              data={[
                {
                  name: t('stats.metrics.consumed'),
                  population: stats!.total_consumed,
                  color: theme.green,
                  legendFontColor: theme.textSecondary,
                  legendFontSize: 13,
                },
                {
                  name: t('stats.metrics.discarded'),
                  population: stats!.total_expired,
                  color: '#EF4444',
                  legendFontColor: theme.textSecondary,
                  legendFontSize: 13,
                },
              ]}
              width={screenWidth - 64}
              height={160}
              chartConfig={{ color: () => theme.text }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 0]}
              absolute
            />
          </View>

          {/* ── Top categorias desperdiçadas ────────────────────────────── */}
          {stats!.top_wasted_categories.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('stats.sections.topCategories')}</Text>
              <View style={[styles.chartCard, { paddingRight: 32, backgroundColor: theme.headerBg, borderColor: theme.border }]}>
                <BarChart
                  data={{
                    labels: stats!.top_wasted_categories.slice(0, 3).map(c => c.category_name.substring(0, 8)),
                    datasets: [{ data: stats!.top_wasted_categories.slice(0, 3).map(c => c.total_expired) }],
                  }}
                  width={screenWidth - 64}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=" un"
                  fromZero
                  chartConfig={{
                    backgroundGradientFrom: theme.headerBg,
                    backgroundGradientTo: theme.headerBg,
                    fillShadowGradientFrom: '#EF4444',
                    fillShadowGradientFromOpacity: 0.85,
                    fillShadowGradientTo: '#9B1C1C',
                    fillShadowGradientToOpacity: 0.6,
                    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    labelColor: () => theme.textSecondary,
                    strokeWidth: 2,
                    barPercentage: 0.6,
                    decimalPlaces: 0,
                  }}
                  style={{ marginVertical: 8, borderRadius: 16 }}
                  showValuesOnTopOfBars
                />
              </View>
            </>
          )}

          {/* ── Timeline (GET /history/) ───────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('stats.sections.recentRemovals')}</Text>
          <View style={[styles.chartCard, { backgroundColor: theme.headerBg, borderColor: theme.border, paddingVertical: 8 }]}>
            {timeline.length === 0 ? (
              <Text style={{ color: theme.textMuted, fontSize: 13, paddingHorizontal: 4, paddingVertical: 10 }}>
                {t('stats.noRecentRemovals')}
              </Text>
            ) : (
              timeline.map((h) => (
                <View key={h.id} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingHorizontal: 4,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderLight,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {h.item_name}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
                      {reasonLabel(h.removal_reason)} • {h.quantity} {h.unit}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 12, flexShrink: 0 }}>
                    {formatRemovedAt(h.removed_at)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const D = {
  bg: '#060A10',
  card: '#0F1923',
  border: 'rgba(255,255,255,0.07)',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  amberMuted: 'rgba(245,158,11,0.15)',
  textPrimary: '#F0FDF4',
  textSecondary: 'rgba(255,255,255,0.45)',
  textMuted: 'rgba(255,255,255,0.25)',
  sectionLabel: 'rgba(255,255,255,0.3)',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: D.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: D.bg,
    gap: 12,
  },
  loadingText: {
    color: D.textSecondary,
    fontSize: 14,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: D.bg,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: D.textPrimary,
    letterSpacing: -0.2,
  },
  // Error
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  // Scroll
  scroll: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: D.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 22,
  },
  // Rate section
  rateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: D.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: D.border,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  rateCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  rateValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  rateLabel: {
    fontSize: 8,
    color: D.textMuted,
    textAlign: 'center',
    lineHeight: 11,
  },
  rateInfo: {
    flex: 1,
    gap: 6,
  },
  rateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: D.textPrimary,
  },
  rateDesc: {
    fontSize: 13,
    color: D.textSecondary,
    lineHeight: 19,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: D.amberMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: D.amber,
  },
  // Cards row
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // Chart card
  chartCard: {
    backgroundColor: D.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: D.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: D.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default StatsScreen;
