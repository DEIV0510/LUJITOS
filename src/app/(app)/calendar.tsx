import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getCategory } from '@/constants/categories';
import { DEMO_CARDS, DEMO_DEBTS, DEMO_RECURRING, DEMO_TODAY } from '@/features/demo/data';
import { formatDayHeading, formatMonthYear, parseISO, toISO, type ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import { useAppTheme } from '@/theme';
import { LiveGate } from '@/features/data/ComingSoon';
import type { Category } from '@/types/finance';

type CalendarEvent = {
  id: string;
  date: ISODate;
  title: string;
  amount: Money;
  kind: 'income' | 'expense' | 'card';
  category: Category;
};

function buildEvents(year: number, month: number): CalendarEvent[] {
  const recurring = DEMO_RECURRING.filter((item) => item.id !== 'rec-loan').map((item) => ({
    id: item.id,
    date: toISO(year, month, item.dayOfMonth),
    title: item.name,
    amount: item.amount,
    kind: item.type,
    category: getCategory(item.categoryId),
  }));
  const debts = DEMO_DEBTS.filter((debt) => debt.kind !== 'credit_card').map((debt) => ({
    id: debt.id,
    date: toISO(year, month, parseISO(debt.nextDue).day),
    title: `Cuota ${debt.name.toLowerCase()}`,
    amount: debt.monthlyPayment,
    kind: 'expense' as const,
    category: getCategory('other-out'),
  }));
  const cards = DEMO_CARDS.map((card) => ({
    id: card.id,
    date: toISO(year, month, parseISO(card.dueDate).day),
    title: `Pago ${card.name}`,
    amount: card.minimumPayment,
    kind: 'card' as const,
    category: { ...getCategory('other-out'), icon: 'creditcard.fill' as const, tone: 'gold' as const },
  }));
  return [...recurring, ...debts, ...cards].sort((a, b) => a.date.localeCompare(b.date));
}

function CalendarScreen() {
  const { colors, spacing } = useAppTheme();
  const { year, month } = parseISO(DEMO_TODAY);
  const [selected, setSelected] = useState<ISODate>(DEMO_TODAY);
  const events = buildEvents(year, month);

  const colorFor = (kind: CalendarEvent['kind']) =>
    kind === 'income' ? colors.positiveGraphic : kind === 'card' ? colors.accent : colors.negativeGraphic;

  const marks: Record<ISODate, string[]> = {};
  for (const event of events) {
    marks[event.date] = [...(marks[event.date] ?? []), colorFor(event.kind)];
  }
  const dayEvents = events.filter((event) => event.date === selected);
  const upcoming = events.filter((event) => event.date > DEMO_TODAY);

  return (
    <Screen header={<ScreenHeader title="Calendario financiero" />}>
      <FinancialCard padding={spacing.lg}>
        <AppText variant="headline" align="center" style={{ marginBottom: spacing.md }}>
          {formatMonthYear(year, month)}
        </AppText>
        <CalendarGrid year={year} month={month} selected={selected} today={DEMO_TODAY} marks={marks} onSelect={setSelected} />
        <View style={[styles.legend, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
          {[
            { label: 'Ingreso', color: colors.positiveGraphic },
            { label: 'Pago', color: colors.negativeGraphic },
            { label: 'Tarjeta', color: colors.accent },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <AppText variant="caption" color="textSecondary">
                {item.label}
              </AppText>
            </View>
          ))}
        </View>
      </FinancialCard>

      <View>
        <SectionHeader title={formatDayHeading(selected, DEMO_TODAY)} subtitle={dayEvents.length ? undefined : 'Sin vencimientos este día'} />
        {dayEvents.length ? <EventList events={dayEvents} today={DEMO_TODAY} /> : null}
      </View>

      <View>
        <SectionHeader title="Próximos vencimientos" subtitle="Lo que falta de noviembre" />
        <EventList events={upcoming} today={DEMO_TODAY} />
      </View>

      <DemoNotice text="Recordatorios con notificaciones del iPhone en la Fase 7." />
    </Screen>
  );
}

function EventList({ events, today }: { events: CalendarEvent[]; today: ISODate }) {
  const { colors, spacing } = useAppTheme();
  return (
    <FinancialCard padding={spacing.lg} style={styles.list}>
      {events.map((event, index) => {
        const past = event.date <= today;
        return (
          <View key={`${event.id}-${event.date}`} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <CategoryIcon category={event.category} size={38} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {event.title}
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {formatDayHeading(event.date, today)}
                {past ? (event.kind === 'income' ? ' · recibido' : ' · pagado') : ''}
              </AppText>
            </View>
            <AmountText
              amount={event.kind === 'income' ? event.amount : -event.amount}
              sign="always"
              variant="amount"
              color={event.kind === 'income' ? 'positive' : 'text'}
            />
          </View>
        );
      })}
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  flex: { flex: 1, minWidth: 0 },
});

export default function CalendarRoute() {
  return (
    <LiveGate
      title="Calendario financiero"
      phase="Fase 7"
      description="Vencimientos, pagos recurrentes e ingresos del mes, con recordatorios en tu iPhone."
      icon="calendar"
      layout="stack"
      demo={<CalendarScreen />}
    />
  );
}
