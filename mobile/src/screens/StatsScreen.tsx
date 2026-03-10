/**
 * src/screens/StatsScreen.tsx
 * ============================
 * Tela de Relatório de Desperdício.
 * Mostra estatísticas agregadas de itens consumidos vs. vencidos/descartados.
 * Usa gráficos simples construídos com Views puras (sem dependências externas).
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
import { BarChart2, Leaf, TrendingDown, TrendingUp, Award } from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import LottieView from 'lottie-react-native';

import { fetchStats, StatsResponse } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

// ---------------------------------------------------------------------------
// Componente: Card de métrica
// ---------------------------------------------------------------------------
interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label, value, sub, color, bgColor, icon,
}) => (
  <View style={[cardStyles.card, { backgroundColor: bgColor, borderColor: color }]}>
    <View style={cardStyles.iconRow}>{icon}</View>
    <Text style={[cardStyles.value, { color }]}>{value}</Text>
    <Text style={cardStyles.label}>{label}</Text>
    {sub ? <Text style={cardStyles.sub}>{sub}</Text> : null}
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  iconRow: { marginBottom: 2 },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  sub: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
const StatsScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchStats();
      setStats(data);
    } catch {
      setError('Não foi possível carregar as estatísticas. Verifique a conexão.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  // -- Loading ---------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.green} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando estatísticas…</Text>
      </SafeAreaView>
    );
  }

  // -- Sem histórico ---------------------------------------------------------
  const isEmpty = !stats || stats.total_removed === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: theme.green }]}>‹ Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BarChart2 size={20} color={theme.green} strokeWidth={2.5} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Relatório de Desperdício</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Erro */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isEmpty ? (
        /* -- Empty state ----------------------------------------------------- */
        <View style={styles.emptyContainer}>
          <LottieView
            autoPlay
            loop
            source={{ uri: 'https://lottie.host/8c5d2b7d-e6a3-4b92-8086-4cfac552cba1/t0M9jWeGj9.json' }}
            style={{ width: 150, height: 150 }}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem histórico ainda</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Quando você remover itens da despensa, as estatísticas de consumo e
            desperdício aparecerão aqui.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#16A34A']}
              tintColor="#16A34A"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Taxa de aproveitamento ──────────────────────────────────── */}
          <View style={[styles.rateSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[
              styles.rateCircle,
              { borderColor: stats!.waste_rate_percent > 30 ? '#EF4444' : '#16A34A' },
            ]}>
              <Text style={[
                styles.rateValue,
                { color: stats!.waste_rate_percent > 30 ? '#EF4444' : '#16A34A' },
              ]}>
                {(100 - stats!.waste_rate_percent).toFixed(0)}%
              </Text>
              <Text style={styles.rateLabel}>aproveita{'\n'}mento</Text>
            </View>
            <View style={styles.rateInfo}>
              <Text style={styles.rateTitle}>Taxa de aproveitamento</Text>
              <Text style={styles.rateDesc}>
                De {stats!.total_removed} itens removidos,{' '}
                <Text style={{ color: '#16A34A', fontWeight: '700' }}>
                  {stats!.total_consumed} foram consumidos
                </Text>{' '}
                e{' '}
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>
                  {stats!.total_expired} foram descartados
                </Text>.
              </Text>
              {stats!.waste_rate_percent <= 15 && (
                <View style={styles.badge}>
                  <Award size={13} color="#15803D" strokeWidth={2} />
                  <Text style={styles.badgeText}>Parabéns! Desperdício baixo 🎉</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Cards este mês ────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Este mês</Text>
          <View style={styles.cardsRow}>
            <MetricCard
              label="Consumidos"
              value={stats!.this_month_consumed}
              color="#15803D"
              bgColor="#F0FDF4"
              icon={<TrendingUp size={18} color="#15803D" strokeWidth={2.5} />}
            />
            <MetricCard
              label="Vencidos"
              value={stats!.this_month_expired}
              color="#B91C1C"
              bgColor="#FFF1F2"
              icon={<TrendingDown size={18} color="#B91C1C" strokeWidth={2.5} />}
            />
          </View>

          {/* ── Cards totais ──────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Total histórico</Text>
          <View style={styles.cardsRow}>
            <MetricCard
              label="Consumidos"
              value={stats!.total_consumed}
              sub="total"
              color="#15803D"
              bgColor="#F0FDF4"
              icon={<TrendingUp size={18} color="#15803D" strokeWidth={2.5} />}
            />
            <MetricCard
              label="Vencidos"
              value={stats!.total_expired}
              sub="total"
              color="#B91C1C"
              bgColor="#FFF1F2"
              icon={<TrendingDown size={18} color="#B91C1C" strokeWidth={2.5} />}
            />
          </View>

          {/* ── Gráfico geral consumido vs. vencido ──────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Visão geral de Desperdício</Text>
          <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center', paddingVertical: 8 }]}>
            <PieChart
              data={[
                {
                  name: 'Consumidos',
                  population: stats!.total_consumed,
                  color: '#16A34A',
                  legendFontColor: theme.text,
                  legendFontSize: 13,
                },
                {
                  name: 'Descartados',
                  population: stats!.total_expired,
                  color: '#EF4444',
                  legendFontColor: theme.text,
                  legendFontSize: 13,
                },
              ]}
              width={Dimensions.get('window').width - 64}
              height={160}
              chartConfig={{
                color: (opacity = 1) => theme.text,
              }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          </View>

          {/* ── Top categorias desperdiçadas ─────────────────────────────── */}
          {stats!.top_wasted_categories.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Categorias mais desperdiçadas</Text>
              <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border, paddingRight: 32 }]}>
                <BarChart
                  data={{
                    labels: stats!.top_wasted_categories.slice(0, 3).map(c => c.category_name.substring(0, 8)),
                    datasets: [{
                      data: stats!.top_wasted_categories.slice(0, 3).map(c => c.total_expired)
                    }]
                  }}
                  width={Dimensions.get('window').width - 64}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=" un"
                  fromZero={true}
                  chartConfig={{
                    backgroundGradientFrom: theme.card,
                    backgroundGradientTo: theme.card,
                    fillShadowGradientFrom: '#EF4444',
                    fillShadowGradientFromOpacity: 0.8,
                    fillShadowGradientTo: '#EF4444',
                    fillShadowGradientToOpacity: 0.8,
                    color: (opacity = 1) => theme.isDark ? `rgba(239, 68, 68, ${opacity})` : `rgba(220, 38, 38, ${opacity})`,
                    labelColor: (opacity = 1) => theme.textSecondary,
                    strokeWidth: 2,
                    barPercentage: 0.6,
                    decimalPlaces: 0,
                  }}
                  style={{
                    marginVertical: 8,
                    borderRadius: 16
                  }}
                  showValuesOnTopOfBars={true}
                />
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 60 },
  backBtnText: {
    color: '#16A34A',
    fontSize: 15,
    fontWeight: '600',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
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
  scroll: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 20,
  },
  // Taxa de aproveitamento
  rateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  rateCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rateValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  rateLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 12,
  },
  rateInfo: {
    flex: 1,
    gap: 6,
  },
  rateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  rateDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  // Cards row
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // Chart card
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default StatsScreen;
