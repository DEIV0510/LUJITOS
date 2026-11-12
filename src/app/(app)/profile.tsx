import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DemoModeBanner } from '@/features/data/DemoModeBanner';
import { initialsOf } from '@/features/home/HomeSections';
import { useAuth } from '@/hooks/auth';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';
import type { Tone } from '@/theme';

type Module = {
  title: string;
  subtitle: string;
  icon: IconName;
  tone: Tone;
  href: '/budgets' | '/savings' | '/debts' | '/planning' | '/cards' | '/calendar' | '/recurring' | '/notifications' | '/settings';
};

const PLANNING: Module[] = [
  { title: 'Presupuestos', subtitle: 'Límites por categoría y alertas', icon: 'chart.pie.fill', tone: 'forest', href: '/budgets' },
  { title: 'Metas de ahorro', subtitle: 'Objetivos y cuánto separar', icon: 'target', tone: 'teal', href: '/savings' },
  { title: 'Deudas', subtitle: 'Préstamos, cuotas y pagos', icon: 'banknote.fill', tone: 'clay', href: '/debts' },
  { title: 'Planificación', subtitle: 'Capacidad de ahorro y proyecciones', icon: 'chart.line.uptrend.xyaxis', tone: 'sage', href: '/planning' },
  { title: 'Tarjetas de crédito', subtitle: 'Cupo, cortes y pagos', icon: 'creditcard.fill', tone: 'gold', href: '/cards' },
  { title: 'Calendario financiero', subtitle: 'Vencimientos del mes', icon: 'calendar', tone: 'slate', href: '/calendar' },
  { title: 'Pagos recurrentes', subtitle: 'Suscripciones y servicios', icon: 'repeat', tone: 'plum', href: '/recurring' },
];

const ACCOUNT: Module[] = [
  { title: 'Avisos', subtitle: 'Alertas y recordatorios', icon: 'bell.fill', tone: 'amber', href: '/notifications' },
  { title: 'Configuración', subtitle: 'Apariencia, privacidad y datos', icon: 'gearshape.fill', tone: 'stone', href: '/settings' },
];

export default function ProfileScreen() {
  const { colors, spacing } = useAppTheme();
  const { profile, session } = useAuth();
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  return (
    <Screen header={<ScreenHeader title="Perfil" />}>
      <View style={[styles.hero, { gap: spacing.xs }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <AppText variant="title" color="onPrimary">
            {initialsOf(profile?.first_name, profile?.last_name)}
          </AppText>
        </View>
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {fullName || 'Tu perfil'}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center">
          {profile?.email ?? session?.user.email ?? ''}
        </AppText>
      </View>
      <DemoModeBanner />

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
