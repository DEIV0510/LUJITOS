import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { useAppTheme } from '@/theme';
import type { Category, CategoryKind } from '@/types/finance';

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
];

/** Categorías: las predeterminadas se conservan; las propias se crean, editan y archivan. */
export default function CategoriesScreen() {
  const { spacing } = useAppTheme();
  const { categories, transactions, mode } = useFinanceData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const ofKind = categories.filter((category) => category.kind === kind);
  const own = ofKind.filter((category) => !category.isDefault && !category.archivedAt);
  const archived = ofKind.filter((category) => category.archivedAt);
  const system = ofKind.filter((category) => category.isDefault);
  const usage = (category: Category) => transactions.filter((t) => t.categoryId === category.id).length;

  const open = (category?: Category) =>
    router.push({ pathname: '/category/edit', params: category ? { id: category.id } : { kind } });

  return (
    <Screen header={<ScreenHeader title="Categorías" />}>
      <SegmentedControl options={KINDS} value={kind} onChange={setKind} accessibilityLabel="Tipo de categoría" />

      <View>
        <SectionHeader title="Tus categorías" subtitle={own.length === 0 ? 'Todavía no creas ninguna' : `${own.length}`} />
        {own.length > 0 ? (
          <FinancialCard padding={16} style={styles.list}>
            {own.map((category, index) => (
              <CategoryRow key={category.id} category={category} detail={`${usage(category)} movimientos`} onPress={() => open(category)} divider={index > 0} />
            ))}
          </FinancialCard>
        ) : null}
        {mode === 'demo' ? null : (
          <SecondaryButton label="Nueva categoría" icon="plus" style={{ marginTop: spacing.md }} onPress={() => open()} />
        )}
      </View>

      {archived.length > 0 ? (
        <View>
          <SectionHeader title="Archivadas" subtitle="No se ofrecen para movimientos nuevos" />
          <FinancialCard padding={16} style={styles.list}>
            {archived.map((category, index) => (
              <CategoryRow key={category.id} category={category} detail="Archivada" onPress={() => open(category)} divider={index > 0} />
            ))}
          </FinancialCard>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Predeterminadas" subtitle="Las usa todo el mundo: no se editan" />
        <FinancialCard padding={16} style={styles.list}>
          {system.map((category, index) => (
            <CategoryRow key={category.id} category={category} detail={`${usage(category)} movimientos`} locked divider={index > 0} />
          ))}
        </FinancialCard>
      </View>
    </Screen>
  );
}

function CategoryRow({
  category,
  detail,
  onPress,
  locked,
  divider,
}: {
  category: Category;
  detail: string;
  onPress?: () => void;
  locked?: boolean;
  divider?: boolean;
}) {
  const { colors, spacing } = useAppTheme();
  return (
    <FinancialCard
      padding={0}
      onPress={onPress}
      accessibilityLabel={category.name}
      style={[styles.row, { paddingVertical: spacing.md, borderTopWidth: divider ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }]}
    >
      <CategoryIcon category={category} size={36} />
      <View style={styles.flex}>
        <AppText variant="headline" numberOfLines={1}>
          {category.name}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {detail}
        </AppText>
      </View>
      <Icon name={locked ? 'lock.fill' : 'chevron.right'} size={13} color={colors.textTertiary} />
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  flex: { flex: 1, minWidth: 0 },
});
