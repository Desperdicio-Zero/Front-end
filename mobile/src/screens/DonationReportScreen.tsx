import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart2, ChevronLeft, Gift, Heart, Layers3, Sparkles } from 'lucide-react-native';
import { BarChart } from 'react-native-chart-kit';
import * as Haptics from 'expo-haptics';

import { fetchHistoryTimeline, type ItemHistoryOut } from '../services/api';
import { useTheme, type AppTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'DonationReport'>;

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

const CARD_ACCENTS = {
  green: {
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.15)',
  },
  blue: {
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.14)',
  },
  purple: {
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.14)',
  },
};

const MOCK_DONATIONS: ItemHistoryOut[] = [
  {
    id: -1,
    item_name: 'Arroz Integral',
    category_name: 'Cereais e Grãos',
    quantity: 2,
    unit: 'kg',
    expiry_date: '2026-06-30',
    removal_reason: 'donated',
    removed_at: '2026-05-12T10:30:00.000Z',
    notes: null,
  },
  {
    id: -2,
    item_name: 'Feijão Carioca',
    category_name: 'Cereais e Grãos',
    quantity: 3,
    unit: 'kg',
    expiry_date: '2026-07-25',
    removal_reason: 'donated',
    removed_at: '2026-05-18T14:15:00.000Z',
    notes: null,
  },
  {
    id: -3,
    item_name: 'Macarrão',
    category_name: 'Massas e Farináceos',
    quantity: 4,
    unit: 'un',
    expiry_date: '2026-08-11',
    removal_reason: 'donated',
    removed_at: '2026-05-22T18:40:00.000Z',
    notes: null,
  },
  {
    id: -4,
    item_name: 'Leite UHT',
    category_name: 'Laticínios',
    quantity: 6,
    unit: 'un',
    expiry_date: '2026-06-19',
    removal_reason: 'donated',
    removed_at: '2026-04-14T08:20:00.000Z',
    notes: null,
  },
  {
    id: -5,
    item_name: 'Óleo de Soja',
    category_name: 'Condimentos e Temperos',
    quantity: 2,
    unit: 'un',
    expiry_date: '2026-09-02',
    removal_reason: 'donated',
    removed_at: '2026-04-25T11:00:00.000Z',
    notes: null,
  },
  {
    id: -6,
    item_name: 'Sardinha em Lata',
    category_name: 'Enlatados',
    quantity: 5,
    unit: 'un',
    expiry_date: '2026-10-05',
    removal_reason: 'donated',
    removed_at: '2026-03-29T16:45:00.000Z',
    notes: null,
  },
];

function getMonthBounds(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

const DonationReportScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [donations, setDonations] = useState<ItemHistoryOut[]>([]);
  const [usingMockData, setUsingMockData] = useState(false);

  const load = useCallback(async () => {
    try {
      const timeline = await fetchHistoryTimeline(300, 0);
      const donatedEntries = timeline.filter((entry) => entry.removal_reason === 'donated');
      if (donatedEntries.length > 0) {
        setUsingMockData(false);
        setDonations(donatedEntries);
      } else {
        setUsingMockData(true);
        setDonations(MOCK_DONATIONS);
      }
    } catch {
      setUsingMockData(true);
      setDonations(MOCK_DONATIONS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    load();
  };

  const now = new Date();
  const currentMonthBounds = getMonthBounds(now);
  const previousMonthBounds = getMonthBounds(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const currentMonthDonations = useMemo(
    () => donations.filter((entry) => {
      const removedAt = new Date(entry.removed_at);
      return removedAt >= currentMonthBounds.start && removedAt <= currentMonthBounds.end;
    }),
    [donations, currentMonthBounds.start, currentMonthBounds.end],
  );

  const previousMonthDonations = useMemo(
    () => donations.filter((entry) => {
      const removedAt = new Date(entry.removed_at);
      return removedAt >= previousMonthBounds.start && removedAt <= previousMonthBounds.end;
    }),
    [donations, previousMonthBounds.start, previousMonthBounds.end],
  );

  const totalItemsDonated = donations.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const donationsThisMonth = currentMonthDonations.length;
  const donationDelta = donationsThisMonth - previousMonthDonations.length;
  const categoriesDonatedCount = new Set(donations.map((entry) => entry.category_name)).size;

  const categoryTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of donations) {
      counts.set(entry.category_name, (counts.get(entry.category_name) ?? 0) + Number(entry.quantity || 0));
    }
    return [...counts.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((left, right) => right.total - left.total);
  }, [donations]);

  const chartRows = categoryTotals.slice(0, 4);
  const categoryGrandTotal = categoryTotals.reduce((sum, row) => sum + row.total, 0);
  const topCategory = categoryTotals[0];

  const { t } = useTranslation();

  const insights = useMemo(() => {
    type Insight = { key: string; title: string; text: string };
    const items: Insight[] = [];

    if (donationDelta > 0) {
      items.push({ key: 'increase', title: t('stats.donationReport.insights.increase.title'), text: t('stats.donationReport.insights.increase.text', { delta: Math.abs(donationDelta) }) });
    } else if (donationDelta === 0 && donationsThisMonth > 0) {
      items.push({ key: 'steady', title: t('stats.donationReport.insights.steady.title'), text: t('stats.donationReport.insights.steady.text') });
    } else {
      items.push({ key: 'opportunity', title: t('stats.donationReport.insights.opportunity.title'), text: t('stats.donationReport.insights.opportunity.text') });
    }

    if (topCategory && categoryGrandTotal > 0) {
      const share = Math.round((topCategory.total / categoryGrandTotal) * 100);
      items.push({ key: 'topCategory', title: t('stats.donationReport.insights.topCategory.title'), text: t('stats.donationReport.insights.topCategory.text', { category: topCategory.category, share }) });
    }

    if (categoriesDonatedCount >= 3) {
      items.push({ key: 'diversity', title: t('stats.donationReport.insights.diversity.title'), text: t('stats.donationReport.insights.diversity.text', { count: categoriesDonatedCount }) });
    } else {
      items.push({ key: 'concentration', title: t('stats.donationReport.insights.concentration.title'), text: t('stats.donationReport.insights.concentration.text', { count: categoriesDonatedCount }) });
    }

    return items.slice(0, 3);
  }, [categoryGrandTotal, categoriesDonatedCount, donationDelta, donationsThisMonth, topCategory, t]);

  const recentHistory = [...donations]
    .sort((left, right) => new Date(right.removed_at).getTime() - new Date(left.removed_at).getTime())
    .slice(0, 8);

  const screenWidth = Dimensions.get('window').width;

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.green} />
        <Text style={[styles.loadingText, { color: theme.textSecondary, fontFamily: theme.fonts?.medium }]}>Gerando relatório de doações...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
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
          <Heart size={18} color={theme.green} strokeWidth={2.5} />
          <Text style={[styles.headerTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>Relatório de Doações</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.green]}
            tintColor={theme.green}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
          <Text style={[styles.heroTitle, { color: theme.text, fontFamily: theme.fonts?.heading }]}>Acompanhe o impacto das suas doações.</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary, fontFamily: theme.fonts?.regular }]}>Cada item doado fortalece a solidariedade e reduz o desperdício.</Text>
          {usingMockData ? (
            <View style={[styles.mockBadge, { backgroundColor: theme.warnBg }]}>
              <Text style={[styles.mockBadgeText, { color: theme.textSecondary, fontFamily: theme.fonts?.medium }]}>Visualizando dados de exemplo</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontFamily: theme.fonts?.heading }]}>Resumo</Text>
        <View style={styles.cardsRow}>
          <MetricCard
            label="Doações do mês"
            value={donationsThisMonth}
            //sub="mês atual"
            color={CARD_ACCENTS.green.color}
            bgColor={theme.isDark ? CARD_ACCENTS.green.bg : '#DCFCE7'}
            icon={<Heart size={18} color={CARD_ACCENTS.green.color} strokeWidth={2.5} />}
            theme={theme}
          />
          <MetricCard
            label="Itens doados total"
            value={totalItemsDonated}
            //sub="quantidade total de alimentos"
            color={CARD_ACCENTS.green.color}
            bgColor={theme.isDark ? CARD_ACCENTS.green.bg : '#DCFCE7'}
            icon={<Gift size={18} color={CARD_ACCENTS.green.color} strokeWidth={2.5} />}
            theme={theme}
          />
        </View>

        <View style={styles.cardsRow}>
          <MetricCard
            label="Categorias doadas total"
            value={categoriesDonatedCount}
            //sub="categorias únicas no total"
            color={CARD_ACCENTS.purple.color}
            bgColor={theme.isDark ? CARD_ACCENTS.purple.bg : '#F3E8FF'}
            icon={<Layers3 size={18} color={CARD_ACCENTS.purple.color} strokeWidth={2.5} />}
            theme={theme}
          />
          <MetricCard
            label="Histórico total"
            value={donations.length}
            //sub="número total de registros"
            color={CARD_ACCENTS.purple.color}
            bgColor={theme.isDark ? CARD_ACCENTS.purple.bg : '#F3E8FF'}
            icon={<Sparkles size={18} color={CARD_ACCENTS.purple.color} strokeWidth={2.5} />}
            theme={theme}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Itens Doados por categorias</Text>
        <View style={[styles.chartCard, { backgroundColor: theme.headerBg, borderColor: theme.border }]}> 
          {chartRows.length > 0 ? (
            <BarChart
              data={{
                labels: chartRows.map((row) => row.category.substring(0, 10)),
                datasets: [{ data: chartRows.map((row) => row.total) }],
              }}
              width={screenWidth - 64}
              height={220}
              yAxisLabel=""
              yAxisSuffix=" un"
              fromZero
              chartConfig={{
                backgroundGradientFrom: theme.headerBg,
                backgroundGradientTo: theme.headerBg,
                fillShadowGradientFrom: theme.green,
                fillShadowGradientFromOpacity: 0.9,
                fillShadowGradientTo: theme.green,
                fillShadowGradientToOpacity: 0.6,
                color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                labelColor: () => theme.textSecondary,
                strokeWidth: 2,
                barPercentage: 0.6,
                decimalPlaces: 0,
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              showValuesOnTopOfBars
            />
          ) : (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Sem dados de doação para gerar gráfico.</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Categorias mais doadas</Text>
        <View style={[styles.chartCard, { backgroundColor: theme.headerBg, borderColor: theme.border }]}> 
          {categoryTotals.slice(0, 5).map((row) => {
            const percent = categoryGrandTotal > 0 ? Math.round((row.total / categoryGrandTotal) * 100) : 0;
            return (
              <View key={row.category} style={styles.rankItem}>
                <View style={styles.rankHeader}>
                  <Text style={[styles.rankLabel, { color: theme.text, fontFamily: theme.fonts?.medium }]} numberOfLines={1}>
                    {row.category}
                  </Text>
                  <Text style={[styles.rankValue, { color: theme.textSecondary, fontFamily: theme.fonts?.regular }]}>
                    {percent}%
                  </Text>
                </View>
                <View style={[styles.rankTrack, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                  <View style={[styles.rankFill, { width: `${percent}%`, backgroundColor: theme.green }]} />
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Impacto das Suas Doações</Text>
        <View style={styles.insightGrid}>
          {insights.map((insight) => (
            <View key={insight.key} style={[styles.insightCard, { backgroundColor: theme.headerBg, borderColor: theme.border }]}> 
              <Text style={[styles.insightTitle, { color: theme.text, fontFamily: theme.fonts?.medium }]}>{insight.title}</Text>
              <Text style={[styles.insightText, { color: theme.textSecondary, fontFamily: theme.fonts?.regular }]}>{insight.text}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Histórico de doações</Text>
        <View style={[styles.chartCard, { backgroundColor: theme.headerBg, borderColor: theme.border, paddingVertical: 8 }]}> 
          {recentHistory.map((entry) => (
            <View key={entry.id} style={[styles.historyRow, { borderBottomColor: theme.borderLight }]}> 
              <View style={{ flex: 1 }}>
                <View style={styles.historyHeaderRow}>
                  <Text style={[styles.historyItemName, { color: theme.text }]} numberOfLines={1}>{entry.item_name}</Text>
                  <View style={[styles.reasonBadge, { backgroundColor: theme.isDark ? 'rgba(168,85,247,0.16)' : '#F3E8FF' }]}> 
                    <Text style={[styles.reasonBadgeText, { color: CARD_ACCENTS.purple.color, fontFamily: theme.fonts?.medium }]}>✓ Doado</Text>
                  </View>
                </View>
                <Text style={[styles.historyMeta, { color: theme.textMuted }]} numberOfLines={1}>
                  {entry.category_name} • {entry.quantity} {entry.unit} • {formatDate(entry.removed_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
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
    letterSpacing: -0.2,
  },
  scroll: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  mockBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 4,
  },
  mockBadgeText: {
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 22,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  chartCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 8,
  },
  rankItem: {
    width: '100%',
    marginBottom: 12,
  },
  rankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  rankLabel: {
    flex: 1,
    fontSize: 13,
  },
  rankValue: {
    fontSize: 12,
  },
  rankTrack: {
    width: '100%',
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rankFill: {
    height: 9,
    borderRadius: 999,
  },
  insightGrid: {
    gap: 10,
  },
  insightCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  insightText: {
    fontSize: 12,
    lineHeight: 18,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  historyItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reasonBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyMeta: {
    fontSize: 12,
  },
});

export default DonationReportScreen;
