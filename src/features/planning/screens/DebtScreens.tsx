/** Deudas con datos reales: lista (préstamos + tarjetas de la Fase 4) y detalle. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { InstitutionBadge } from '@/components/finance/Badges';
import { ProgressBar } from '@/components/finance/Progress';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { cardDebt, institutionOf, nextDayOfMonth } from '@/features/accounts/display';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatShortDate, nowInBogota } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';
import type { DebtPaymentKind } from '@/types/planning';

import { DebtCard, debtStateColor } from '../cards';
import { DEBT_STATE_LABEL, FREQUENCY_LABEL, LOAN_KIND_LABEL, relativeDays } from '../labels';
import { payoffMonths } from '../projections';
import { Note, StateText } from '../ui';

const ORDER = { overdue: 0, active: 1, paid: 2, archived: 3 } as const;

function openDebtForm(id?: string) {
  router.push({ pathname: '/debt/edit', params: id ? { id } : undefined });
}

function openPayment(debtId: string, kind: DebtPaymentKind) {
  router.push({ pathname: '/debt/payment', params: { debt: debtId, kind } });
}

export function LiveDebtsScreen() {
  const { spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const today = nowInBogota().date;
  const { status, error, reload, debts, accounts, summary, planning } = useFinanceData();
  const visible = debts.filter((d) => d.isActive).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const archived = debts.filter((d) => !d.isActive);
  const cards = accounts.filter((a) => a.kind === 'credit_card' && a.isActive !== false);

  return (
    <Screen header={<ScreenHeader title="Deudas" right={<IconButton icon="plus" accessibilityLabel="Nueva deuda" onPress={() => openDebtForm()} />} />}>
      {status === 'loading' || status === 'idle' ? (
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando deudas" />
        </FinancialCard>
      ) : status === 'error' ? (
        <FinancialCard>
          <EmptyState icon="wifi" title="No pudimos cargar tus datos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
        </FinancialCard>
      ) : (
        <>
          <FinancialCard padding={spacing.xl}>
            <AppText variant="overline" color="textSecondary">
              Total que debes
            </AppText>
            <AmountText amount={summary?.totalDebt ?? 0} variant="amountXL" fit style={{ marginTop: spacing.xs }} />
            <View style={[styles.split, { marginTop: spacing.lg }]}>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  Préstamos y deudas
                </AppText>
                <AppText variant="bodyStrong">{formatMoney(summary?.loanDebt ?? 0, { hidden })}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  Tarjetas
                </AppText>
                <AppText variant="bodyStrong">{formatMoney(summary?.cardDebt ?? 0, { hidden })}</AppText>
              </View>
            </View>
            {planning && planning.obligationsMonthly > 0 ? (
              <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.md }}>
                Cuotas fijas al mes: {formatMoney(planning.obligationsMonthly, { hidden })}
              </AppText>
            ) : null}
          </FinancialCard>

          <View>
            <SectionHeader title="Préstamos y deudas" />
            {visible.length === 0 ? (
              <FinancialCard>
                <EmptyState
                  icon="banknote"
                  title="Sin préstamos registrados"
                  message="Registra un crédito, un préstamo o lo que le debes a alguien para seguir su saldo y sus cuotas."
                  actionLabel="Registrar deuda"
                  onAction={() => openDebtForm()}
                />
              </FinancialCard>
            ) : (
              <View style={{ gap: spacing.md }}>
                {visible.map((debt) => (
                  <DebtCard key={debt.id} debt={debt} />
                ))}
              </View>
            )}
          </View>

          <View>
            <SectionHeader title="Tarjetas de crédito" actionLabel="Ver tarjetas" onAction={() => router.push('/cards')} />
            <FinancialCard padding={spacing.lg} style={styles.list}>
              {cards.length === 0 ? (
                <AppText variant="footnote" color="textSecondary" style={{ paddingVertical: spacing.md }}>
                  No tienes tarjetas. Se registran como cuentas en Mis cuentas.
                </AppText>
              ) : (
                cards.map((card, index) => (
                  <ListRow
                    key={card.id}
                    title={card.name}
                    subtitle={`Debes ${formatMoney(cardDebt(card), { hidden })}${
                      card.paymentDueDay && cardDebt(card) > 0 ? ` · paga el ${formatShortDate(nextDayOfMonth(card.paymentDueDay, today))}` : ''
                    }`}
                    right={<InstitutionBadge institution={institutionOf(card)} size={30} />}
                    showDivider={index > 0}
                    onPress={() => router.push({ pathname: '/account/[id]', params: { id: card.id } })}
                  />
                ))
              )}
            </FinancialCard>
          </View>

          <Note>Pagar una deuda es mover dinero de tu cuenta a la deuda: no es un gasto y tu patrimonio no cambia. Los intereses sí son gasto.</Note>
          <SecondaryButton label="Registrar deuda" icon="plus" onPress={() => openDebtForm()} />

          {archived.length > 0 ? (
            <View>
              <SectionHeader title="Archivadas" />
              <FinancialCard padding={spacing.lg} style={styles.list}>
                {archived.map((debt, index) => (
                  <ListRow
                    key={debt.id}
                    title={debt.name}
                    subtitle={debt.outstanding > 0 ? `Pendiente ${formatMoney(debt.outstanding, { hidden })}` : 'Pagada'}
                    icon="archivebox"
                    showDivider={index > 0}
                    onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
                  />
                ))}
              </FinancialCard>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

export function DebtDetailScreen({ id }: { id: string | undefined }) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { getDebt, getAccount, transactions, voidedTransactions, setDebtArchived, deleteDebt } = useFinanceData();
  const debt = getDebt(id);
  const [busy, setBusy] = useState(false);

  if (!debt) {
    return (
      <Screen header={<ScreenHeader title="Deuda" />}>
        <EmptyState icon="magnifyingglass" title="Deuda no encontrada" message="Puede que la hayas eliminado." />
      </Screen>
    );
  }
  const history = [...transactions, ...voidedTransactions]
    .filter((t) => t.accountId === debt.accountId || t.toAccountId === debt.accountId)
    .sort((a, b) => (a.date === b.date ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : b.date.localeCompare(a.date)));
  const paymentAccount = debt.paymentAccountId ? getAccount(debt.paymentAccountId) : undefined;
  const months = payoffMonths(debt.outstanding, debt.installment, debt.frequency);
  const active = debt.isActive;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('No se pudo completar', errorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await setDebtArchived(debt.id, true);
    } catch (error) {
      if (isFinanceError(error, 'account_has_balance')) {
        Alert.alert(
          'La deuda tiene saldo',
          `Aún debes ${formatMoney(debt.outstanding)}. Si la archivas, deja de contar en tus totales y en tu patrimonio.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Archivar igual', style: 'destructive', onPress: () => void run(() => setDebtArchived(debt.id, true, true), 'No pudimos archivarla.') },
          ],
        );
      } else {
        Alert.alert('No se pudo completar', errorMessage(error, 'No pudimos archivarla.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('¿Eliminar la deuda?', 'Solo se puede eliminar una deuda sin movimientos. Con pagos, archívala.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await deleteDebt(debt.id);
            router.back();
          }, 'No pudimos eliminarla.'),
      },
    ]);

  return (
    <Screen header={<ScreenHeader title={debt.name} right={<IconButton icon="pencil" accessibilityLabel="Editar deuda" onPress={() => openDebtForm(debt.id)} />} />}>
      <FinancialCard padding={spacing.xl}>
        <View style={styles.rowBetween}>
          <AppText variant="overline" color="textSecondary" style={styles.flex}>
            {debt.creditor ? `${LOAN_KIND_LABEL[debt.kind]} · ${debt.creditor}` : LOAN_KIND_LABEL[debt.kind]}
          </AppText>
          <StateText label={DEBT_STATE_LABEL[debt.state]} color={debtStateColor(debt)} />
        </View>
        <AmountText amount={debt.outstanding} variant="amountXL" fit style={{ marginTop: spacing.sm }} />
        <AppText variant="callout" color="textSecondary">
          {debt.outstanding > 0 ? 'pendiente por pagar' : 'no debes nada'}
        </AppText>
        {debt.creditBalance > 0 ? (
          <AppText variant="footnote" color="positive" style={{ marginTop: spacing.xs }}>
            Saldo a favor: {formatMoney(debt.creditBalance, { hidden })}
          </AppText>
        ) : null}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <ProgressBar ratio={debt.percentPaid / 100} color={debt.state === 'paid' ? colors.positive : colors.primary} height={10} />
          <View style={styles.rowBetween}>
            <AppText variant="footnote" color="textSecondary">
              Pagado: {formatMoney(debt.paidBefore + debt.totalPaid, { hidden })}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {formatPercent(debt.percentPaid, { digits: 0 })}
            </AppText>
          </View>
        </View>
      </FinancialCard>

      {debt.nextPaymentDate || debt.dueDate ? (
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {debt.nextPaymentDate ? (
            <InfoRow
              label={debt.state === 'overdue' && debt.nextPaymentDate < nowInBogota().date ? 'Cuota vencida' : 'Próxima cuota'}
              value={`${formatShortDate(debt.nextPaymentDate)} · ${relativeDays(debt.daysToNextPayment)}`}
              valueColor={debt.daysToNextPayment !== null && debt.daysToNextPayment < 0 ? 'negative' : 'text'}
              showDivider={false}
            />
          ) : null}
          {debt.installment && debt.frequency !== 'none' ? (
            <InfoRow label={`Cuota ${FREQUENCY_LABEL[debt.frequency].toLowerCase()}`} value={formatMoney(debt.installment, { hidden })} />
          ) : null}
          {debt.dueDate ? (
            <InfoRow
              label="Fecha límite"
              value={`${formatShortDate(debt.dueDate)}${debt.daysToDue !== null ? ` · ${relativeDays(debt.daysToDue)}` : ''}`}
              valueColor={debt.daysToDue !== null && debt.daysToDue < 0 && debt.outstanding > 0 ? 'negative' : 'text'}
              showDivider={Boolean(debt.nextPaymentDate || debt.installment)}
            />
          ) : null}
        </FinancialCard>
      ) : null}

      {active && debt.outstanding > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton
            label={debt.frequency === 'none' ? 'Registrar pago' : 'Pagar cuota'}
            icon="checkmark"
            onPress={() => openPayment(debt.id, debt.frequency === 'none' ? 'extra' : 'installment')}
          />
          <View style={[styles.row, { gap: spacing.md }]}>
            {debt.frequency !== 'none' ? (
              <SecondaryButton label="Abono extra" icon="plus" style={styles.flex} onPress={() => openPayment(debt.id, 'extra')} />
            ) : null}
            <SecondaryButton label="Interés" icon="percent" style={styles.flex} onPress={() => openPayment(debt.id, 'interest')} />
          </View>
        </View>
      ) : null}

      <FinancialCard padding={spacing.lg} style={styles.list}>
        <InfoRow label="Valor prestado" value={formatMoney(debt.originalAmount, { hidden })} showDivider={false} />
        {debt.paidBefore > 0 ? <InfoRow label="Pagado antes de registrarla" value={formatMoney(debt.paidBefore, { hidden })} /> : null}
        <InfoRow label="Pagado en LUJITOS" value={formatMoney(debt.totalPaid, { hidden })} />
        {debt.installmentsPaid > 0 ? <InfoRow label="Cuotas registradas" value={String(debt.installmentsPaid)} /> : null}
        <InfoRow label="Intereses registrados" value={formatMoney(debt.interestRegistered, { hidden })} />
        {debt.disbursed > 0 ? <InfoRow label="Desembolsos adicionales" value={formatMoney(debt.disbursed, { hidden })} /> : null}
        <InfoRow
          label="Tasa de interés"
          value={
            debt.interestRate === null
              ? 'Sin interés'
              : `${String(debt.interestRate).replace('.', ',')} % ${debt.interestPeriod === 'annual' ? 'anual' : 'mensual'}`
          }
        />
        <InfoRow label="Cuenta de pago" value={paymentAccount?.name ?? 'Se elige al pagar'} />
        <InfoRow label="Inicio" value={formatShortDate(debt.startDate)} />
      </FinancialCard>
      {months !== null && months > 0 ? (
        <Note>
          Con la cuota actual terminarías en unos {months} {months === 1 ? 'mes' : 'meses'}. Es aproximado: no cuenta los intereses futuros.
        </Note>
      ) : null}
      {debt.description ? (
        <AppText variant="footnote" color="textSecondary">
          {debt.description}
        </AppText>
      ) : null}

      <View>
        <SectionHeader title="Historial" subtitle={history.length ? 'Toca un movimiento para editarlo o anularlo' : undefined} />
        {history.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="tray" title="Sin pagos todavía" message="Cada cuota, abono o interés queda aquí." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={16} style={styles.list}>
            {history.map((transaction, index) => (
              <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
            ))}
          </FinancialCard>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        {active ? (
          <SecondaryButton
            label="Corregir saldo"
            icon="slider.horizontal.3"
            onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'adjustment', accountId: debt.accountId } })}
          />
        ) : null}
        {active ? (
          <SecondaryButton label="Archivar deuda" icon="archivebox" disabled={busy} onPress={() => void archive()} />
        ) : (
          <PrimaryButton
            label="Reactivar deuda"
            icon="arrow.uturn.backward"
            loading={busy}
            onPress={() => void run(() => setDebtArchived(debt.id, false), 'No pudimos reactivarla.')}
          />
        )}
        {history.length === 0 ? <SecondaryButton label="Eliminar deuda" icon="trash" disabled={busy} onPress={confirmDelete} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingVertical: 4 },
  split: { flexDirection: 'row', gap: 16 },
});
