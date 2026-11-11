import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader, TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

import { useFinanceData } from './FinanceDataProvider';

type Props = {
  title: string;
  phase: string;
  description: string;
  icon: IconName;
  /** 'tab' para pestañas (título grande) · 'stack' para pantallas secundarias. */
  layout?: 'tab' | 'stack';
};

/**
 * En modo real, los módulos que aún no tienen su fase muestran esto en lugar de
 * datos ficticios. Permite ver la demostración, claramente marcada.
 */
export function ComingSoon({ title, phase, description, icon, layout = 'stack' }: Props) {
  const { colors, spacing } = useAppTheme();
  const { setMode } = useFinanceData();
  const content = (
    <FinancialCard padding={spacing.xl}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <AppText variant="caption" color="accentText" style={{ marginTop: spacing.lg }}>
        Llega en la {phase}
      </AppText>
      <AppText variant="title" style={{ marginTop: spacing.xs }}>
        {title} con tus datos
      </AppText>
      <AppText variant="callout" color="textSecondary" style={{ marginTop: spacing.sm }}>
        {description}
      </AppText>
      <SecondaryButton label="Ver la demostración" icon="sparkles" style={{ marginTop: spacing.xl }} onPress={() => setMode('demo')} />
    </FinancialCard>
  );

  if (layout === 'tab') {
    return (
      <Screen inTabs withFab>
        <TabHeader title={title} />
        {content}
      </Screen>
    );
  }
  return <Screen header={<ScreenHeader title={title} />}>{content}</Screen>;
}

/** Muestra `demo` en modo demostración y el aviso «próximamente» en modo real. */
export function LiveGate({ demo, ...props }: Props & { demo: ReactNode }) {
  const { mode } = useFinanceData();
  return mode === 'demo' ? <>{demo}</> : <ComingSoon {...props} />;
}

const styles = StyleSheet.create({
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
