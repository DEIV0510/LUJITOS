import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BalanceCard } from '@/components/finance/BalanceCard';
import { MetricCard } from '@/components/finance/MetricCard';
import { Screen } from '@/components/layout/Screen';
import { DemoModeBanner } from '@/features/data/DemoModeBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getBalanceOverview, getMonthSummary } from '@/features/demo/selectors';
import {
  HomeAccounts,
  HomeAdvisorTip,
  HomeAnalysis,
  HomeBudget,
  HomeHeader,
  HomeRecent,
} from '@/features/home/HomeSections';
import { useAppTheme } from '@/theme';

const enter = (order: number) => FadeInDown.delay(80 + order * 70).duration(420);

export function DemoHome() {
  const { spacing } = useAppTheme();
  const overview = getBalanceOverview();
  const month = getMonthSummary();

  return (
    <Screen inTabs withFab>
      <Animated.View entering={enter(0)}>
        <HomeHeader />
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ gap: spacing.md }}>
        <BalanceCard {...overview} />
        <DemoModeBanner />
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <SectionHeader title="Resumen del mes" subtitle="Noviembre 2026, al día 10" />
        <View style={[styles.row, { gap: spacing.md }]}>
          <MetricCard
            kind="income"
            amount={month.income}
            previous={month.previousIncome}
            comparisonLabel={month.comparisonLabel}
            onPress={() => router.navigate('/transactions')}
          />
          <MetricCard
            kind="expense"
            amount={month.expense}
            previous={month.previousExpense}
            comparisonLabel={month.comparisonLabel}
            onPress={() => router.navigate('/transactions')}
          />
        </View>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <HomeAccounts />
      </Animated.View>

      <Animated.View entering={enter(4)}>
        <HomeAnalysis />
      </Animated.View>

      <HomeBudget />
      <HomeRecent />
      <HomeAdvisorTip />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
