/**
 * Piezas comunes de presupuestos, metas y deudas: hoja modal con formulario,
 * selector de fecha, selector de cuenta y textos de estado.
 */
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { InstitutionBadge } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText, type TextColor } from '@/components/ui/AppText';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { FilterChip } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { FormMessage } from '@/features/auth/components';
import { institutionOf } from '@/features/accounts/display';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { addDays, formatMonthYear, formatWeekdayDate, parseISO, type ISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { screenPadding, useAppTheme } from '@/theme';
import type { Account } from '@/types/finance';

/** Hoja modal con encabezado, contenido desplazable y botón fijo abajo. */
export function FormShell({
  title,
  children,
  submitLabel,
  submitting,
  onSubmit,
  error,
}: {
  title: string;
  children: ReactNode;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: () => void;
  error?: string | null;
}) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title={title} />
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          {children}
          <FormMessage message={error ?? null} />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border }]}>
          <PrimaryButton label={submitLabel} size="large" loading={submitting} onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** «Hoy», «Ayer», «Mañana» o la fecha completa. */
export function dateLabel(date: ISODate | null, today: ISODate, empty = 'Sin fecha'): string {
  if (!date) return empty;
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  if (date === addDays(today, 1)) return 'Mañana';
  return formatWeekdayDate(date);
}

/** Calendario en hoja inferior. maxDate limita (pagos y aportes no pueden ser futuros). */
export function DateSheet({
  visible,
  title,
  value,
  today,
  maxDate,
  onSelect,
  onClose,
  onClear,
  clearLabel = 'Sin fecha',
}: {
  visible: boolean;
  title: string;
  value: ISODate | null;
  today: ISODate;
  maxDate?: ISODate;
  onSelect: (date: ISODate) => void;
  onClose: () => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const { spacing } = useAppTheme();
  const [month, setMonth] = useState(() => parseISO(value ?? today));
  return (
    <OptionSheet visible={visible} title={title} onClose={onClose}>
      <View style={[styles.quick, { marginBottom: spacing.lg }]}>
        <FilterChip label="Hoy" selected={value === today} onPress={() => onSelect(today)} />
        {maxDate === today ? (
          <FilterChip label="Ayer" selected={value === addDays(today, -1)} onPress={() => onSelect(addDays(today, -1))} />
        ) : null}
        {onClear ? <FilterChip label={clearLabel} selected={value === null} onPress={onClear} /> : null}
      </View>
      <View style={styles.nav}>
        <IconButton
          icon="chevron.left"
          variant="plain"
          accessibilityLabel="Mes anterior"
          onPress={() => setMonth((c) => (c.month === 1 ? { ...c, year: c.year - 1, month: 12 } : { ...c, month: c.month - 1 }))}
        />
        <AppText variant="headline" align="center" style={styles.root}>
          {formatMonthYear(month.year, month.month)}
        </AppText>
        <IconButton
          icon="chevron.right"
          variant="plain"
          accessibilityLabel="Mes siguiente"
          onPress={() => setMonth((c) => (c.month === 12 ? { ...c, year: c.year + 1, month: 1 } : { ...c, month: c.month + 1 }))}
        />
      </View>
      <CalendarGrid year={month.year} month={month.month} selected={value ?? ''} today={today} maxDate={maxDate} onSelect={onSelect} />
    </OptionSheet>
  );
}

/** Lista de cuentas para elegir (con saldo). */
export function AccountSheet({
  visible,
  title,
  accounts,
  value,
  onSelect,
  onClose,
  noneLabel,
  noneSubtitle,
}: {
  visible: boolean;
  title: string;
  accounts: Account[];
  value: string | null;
  onSelect: (accountId: string | null) => void;
  onClose: () => void;
  /** Si llega, se ofrece la opción de no elegir cuenta. */
  noneLabel?: string;
  noneSubtitle?: string;
}) {
  const { colors } = useAppTheme();
  const { hidden } = usePrivacy();
  return (
    <OptionSheet visible={visible} title={title} onClose={onClose}>
      {noneLabel ? (
        <ListRow
          title={noneLabel}
          subtitle={noneSubtitle}
          icon="minus.circle"
          right={value === null ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
          onPress={() => onSelect(null)}
        />
      ) : null}
      {accounts.map((account, index) => (
        <ListRow
          key={account.id}
          title={account.name}
          subtitle={formatMoney(account.balance, { hidden })}
          showDivider={index > 0 || Boolean(noneLabel)}
          right={
            <View style={styles.accountRight}>
              {value === account.id ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : null}
              <InstitutionBadge institution={institutionOf(account)} size={30} />
            </View>
          }
          onPress={() => onSelect(account.id)}
        />
      ))}
      {accounts.length === 0 ? (
        <AppText variant="footnote" color="textSecondary">
          Aún no tienes cuentas activas. Créalas en Mis cuentas.
        </AppText>
      ) : null}
    </OptionSheet>
  );
}

/** Texto de estado con un punto de color (sin fondos tipo «píldora»). */
export function StateText({ label, color }: { label: string; color: TextColor }) {
  const { colors } = useAppTheme();
  const dot =
    color === 'negative' ? colors.negative : color === 'warning' ? colors.warning : color === 'positive' ? colors.positive : colors.textTertiary;
  return (
    <View style={styles.state}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}

/** Nota explicativa en gris (supuestos, advertencias suaves). */
export function Note({ children, icon = 'info.circle' }: { children: ReactNode; icon?: 'info.circle' | 'exclamationmark.triangle' }) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <View style={[styles.note, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
      <AppText variant="footnote" color="textSecondary" style={styles.root}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nav: { flexDirection: 'row', alignItems: 'center' },
  accountRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  note: { flexDirection: 'row', alignItems: 'flex-start' },
});
