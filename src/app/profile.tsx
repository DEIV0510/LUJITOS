import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DEMO_USER } from '@/features/demo/data';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';
import type { Tone } from '@/theme';

type Module = {
  title: string;
  subtitle: string;
  icon: IconName;
  tone: Tone;
  href: '/budgets' | '/savings' | '/debts' | '/cards' | '/calendar' | '/recurring' | '/notifications' | '/settings';
};

const PLANNING: Module[] = [
  { title: 'Presupuestos', subtitle: 'Límites por categoría y alertas', icon: 'chart.pie.fill', tone: 'forest', href: '/budgets' },
  { title: 'Metas de ahorro', subtitle: 'Objetivos y cuánto separar', icon: 'target', tone: 'teal', href: '/savings' },
  { title: 'Deudas', subtitle: 'Préstamos y estrategias de pago', icon: 'banknote.fill', tone: 'clay', href: '/debts' },
  { title: 'Tarjetas de crédito', subtitle: 'Cupo, cortes y pagos', icon: 'creditcard.fill', tone: 'gold', href: '/cards' },
  { title: 'Calendario financiero', subtitle: 'Vencimientos del mes', icon: 'calendar', tone: 'slate', href: '/calendar' },
  { title: 'Pagos recurrentes', subtitle: 'Suscripciones y servicios', icon: 'repeat', tone: 'plum', href: '/recurring' },
];

const ACCOUNT: Module[] = [
  { title: 'Notificaciones', subtitle: 'Alertas y recordatorios', icon: 'bell.fill', tone: 'amber', href: '/notifications' },
  { title: 'Configuración', subtitle: 'Apariencia, privacidad y datos', icon: 'gearshape.fill', tone: 'stone', href: '/settings' },
];

export default function ProfileScreen() {
  const { colors, spacing } = useAppTheme();
  return (
    <Screen header={<ScreenHeader title="Perfil" />}>
      <View style={[styles.hero, { gap: spacing.xs }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <AppText variant="title" color="onPrimary">
            {DEMO_USER.initials}
          </AppText>
        </View>
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {DEMO_USER.firstName} {DEMO_USER.lastName}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center">
          {DEMO_USER.email}
        </AppText>
      </View>
      <DemoNotice text="Perfil de demostración. El inicio de sesión real llega en la Fase 3." />

      <View>
        <SectionHeader title="Planificación" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {PLANNING.map((item, index) => (
            <ListRow key={item.href} {...item} showDivider={index > 0} onPress={() => router.push(item.href)} />
          ))}
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Cuenta" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {ACCOUNT.map((item, index) => (
            <ListRow key={item.href} {...item} showDivider={index > 0} onPress={() => router.push(item.href)} />
          ))}
        </FinancialCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
});
