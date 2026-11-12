/** Metas de ahorro con datos reales: lista y detalle. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar, ProgressRing } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatLongDate, formatShortDate } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { resolveTone, useAppTheme } from '@/theme';
import type { Goal, GoalMovement } from '@/types/planning';

import { GoalCard, goalStateColor, goalTone } from '../cards';
import { GOAL_KIND_LABEL, GOAL_STATE_LABEL } from '../labels';
import { Note, StateText } from '../ui';

const ORDER: Record<Goal['state'], number> = { overdue: 0, active: 1, completed: 2, archived: 3 };

function openGoalForm(id?: string) {
  router.push({ pathname: '/goal/edit', params: id ? { id } : undefined });
}

function openMovement(params: Record<string, string>) {
  router.push({ pathname: '/goal/movement', params });
}

export function LiveSavingsScreen() {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { status, error, reload, goals } = useFinanceData();
  const visible = goals
    .filter((g) => !g.archivedAt)
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'));
  const archived = goals.filter((g) => g.archivedAt);
  const saved = visible.reduce((total, g) => total + g.saved, 0);
  const target = visible.reduce((total, g) => total + g.target, 0);
  const monthly = visible.reduce((total, g) => total + (g.monthlyNeeded ?? 0), 0);

  return (
    <Screen
      header={<ScreenHeader title="Metas de ahorro" right={<IconButton icon="plus" accessibilityLabel="Nueva meta" onPress={() => openGoalForm()} />} />}
    >
      {status === 'loading' || status === 'idle' ? (
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando metas" />
        </FinancialCard>
      ) : status === 'error' ? (
        <FinancialCard>
          <EmptyState icon="wifi" title="No pudimos cargar tus datos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
        </FinancialCard>
      ) : goals.length === 0 ? (
        <FinancialCard>
          <EmptyState
            icon="target"
            title="Aún no tienes metas"
            message="Crea una meta con su valor y fecha: LUJITOS te dice cuánto separar al mes, a la semana y al día."
            actionLabel="Crear meta"
            onAction={() => openGoalForm()}
          />
        </FinancialCard>
      ) : (
        <>
          {visible.length > 0 ? (
            <FinancialCard tone="brand" padding={spacing.xl}>
              <AppText variant="overline" color="onBrandSecondary">
                Separado para tus metas
              </AppText>
              <AmountText amount={saved} variant="amountXL" color="onBrand" fit style={{ marginTop: spacing.xs }} />
              <AppText variant="callout" color="onBrandSecondary">
                de {formatMoney(target, { hidden })} · {formatPercent(target > 0 ? (saved / target) * 100 : 0, { digits: 0 })}
              </AppText>
              <View style={{ marginTop: spacing.lg }}>
                <ProgressBar ratio={target > 0 ? saved / target : 0} color={colors.accent} />
              </View>
              {monthly > 0 ? (
                <View style={[styles.row, { marginTop: spacing.lg }]}>
                  <AppText variant="footnote" color="onBrandSecondary" style={styles.flex}>
                    Para cumplirlas a tiempo, separa cada mes
                  </AppText>
                  <AmountText amount={monthly} variant="amount" color="onBrand" />
                </View>
              ) : null}
            </FinancialCard>
          ) : null}

          <View style={{ gap: spacing.md }}>
            {visible.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </View>

          <Note>Lo separado en metas es parte de tu dinero: no se suma otra vez a tu patrimonio.</Note>
          <SecondaryButton label="Nueva meta" icon="plus" onPress={() => openGoalForm()} />

          {archived.length > 0 ? (
            <View>
              <SectionHeader title="Archivadas" />
              <FinancialCard padding={spacing.lg} style={styles.list}>
                {archived.map((goal, index) => (
                  <ListRow
                    key={goal.id}
                    title={goal.name}
                    subtitle={`${formatMoney(goal.saved, { hidden })} de ${formatMoney(goal.target, { hidden })}`}
                    icon="archivebox"
                    showDivider={index > 0}
                    onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
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

function MovementRow({ movement, showDivider, onPress }: { movement: GoalMovement; showDivider: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { hidden } = usePrivacy();
  const voided = Boolean(movement.voidedAt);
  const contribution = movement.kind === 'contribution';
  return (
    <ListRow
      title={`${contribution ? 'Aporte' : 'Retiro'}${movement.transactionId ? ' con transferencia' : ''}`}
      subtitle={`${formatShortDate(movement.date)}${movement.note ? ` · ${movement.note}` : ''}${voided ? ' · revertido' : ''}`}
      icon={contribution ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill'}
      tone={voided ? 'stone' : contribution ? 'sage' : 'clay'}
      showDivider={showDivider}
      onPress={voided ? undefined : onPress}
      right={
        <AppText
          variant="subhead"
          color={voided ? 'textTertiary' : contribution ? 'positive' : 'text'}
          style={voided ? { textDecorationLine: 'line-through', color: colors.textTertiary } : undefined}
        >
          {`${contribution ? '+' : '−'}${formatMoney(movement.amount, { hidden })}`}
        </AppText>
      }
    />
  );
}

export function GoalDetailScreen({ id }: { id: string | undefined }) {
  const { colors, spacing, scheme } = useAppTheme();
  const { hidden } = usePrivacy();
  const { getGoal, goalMovements, getAccount, voidGoalMovement, setGoalArchived, deleteGoal } = useFinanceData();
  const goal = getGoal(id);
  const [busy, setBusy] = useState(false);

  if (!goal) {
    return (
      <Screen header={<ScreenHeader title="Meta" />}>
        <EmptyState icon="magnifyingglass" title="Meta no encontrada" message="Puede que la hayas eliminado." />
      </Screen>
    );
  }
  const tone = resolveTone(goalTone(goal), scheme);
  const movements = goalMovements.filter((m) => m.goalId === goal.id);
  const account = goal.accountId ? getAccount(goal.accountId) : undefined;
  const overAllocated =
    goal.accountBalance !== null && goal.accountAllocated !== null && goal.accountAllocated > goal.accountBalance;
  const archived = Boolean(goal.archivedAt);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(
        'No se pudo completar',
        isFinanceError(error, 'has_history') ? 'La meta tiene aportes registrados: archívala para conservar el historial.' : errorMessage(error, fallback),
      );
    } finally {
      setBusy(false);
    }
  };

  const movementActions = (movement: GoalMovement) =>
    Alert.alert(movement.kind === 'contribution' ? 'Aporte' : 'Retiro', `${formatMoney(movement.amount)} · ${formatLongDate(movement.date)}`, [
      { text: 'Editar', onPress: () => openMovement({ goal: goal.id, id: movement.id }) },
      {
        text: 'Revertir',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            '¿Revertir este movimiento?',
            movement.transactionId
              ? 'Deja de contar en la meta y se anula su transferencia: el dinero vuelve a la cuenta de origen. El registro se conserva.'
              : 'Deja de contar en la meta. El registro se conserva.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Revertir', style: 'destructive', onPress: () => void run(() => voidGoalMovement(movement.id), 'No pudimos revertirlo.') },
            ],
          ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  const confirmDelete = () =>
    Alert.alert('¿Eliminar la meta?', 'Solo se puede eliminar una meta sin aportes. No toca tus cuentas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await deleteGoal(goal.id);
            router.back();
          }, 'No pudimos eliminarla.'),
      },
    ]);

  return (
    <Screen
      header={<ScreenHeader title={goal.name} right={<IconButton icon="pencil" accessibilityLabel="Editar meta" onPress={() => openGoalForm(goal.id)} />} />}
    >
      <FinancialCard padding={spacing.xl}>
        <View style={[styles.row, { gap: spacing.lg }]}>
          <View style={styles.ring}>
            <ProgressRing ratio={goal.percent / 100} color={goal.state === 'completed' ? colors.positive : tone.base} size={96} stroke={9} />
            <View style={styles.ringLabel}>
              <AppText variant="headline">{formatPercent(goal.percent, { digits: goal.percent < 10 && goal.percent > 0 ? 1 : 0 })}</AppText>
            </View>
          </View>
          <View style={styles.flex}>
            <AppText variant="overline" color="textSecondary">
              {GOAL_KIND_LABEL[goal.kind]}
            </AppText>
            <AmountText amount={goal.saved} variant="amountL" fit />
            <AppText variant="footnote" color="textSecondary">
              de {formatMoney(goal.target, { hidden })}
            </AppText>
            <View style={{ marginTop: spacing.sm }}>
              <StateText label={GOAL_STATE_LABEL[goal.state]} color={goalStateColor(goal)} />
            </View>
          </View>
        </View>
        <View style={[styles.split, { marginTop: spacing.lg, borderTopColor: colors.border, paddingTop: spacing.md }]}>
          <View style={styles.flex}>
            <AppText variant="caption" color="textSecondary">
              {goal.exceededBy > 0 ? 'Superada por' : 'Falta'}
            </AppText>
            <AppText variant="bodyStrong" color={goal.exceededBy > 0 ? 'positive' : 'text'}>
              {formatMoney(goal.exceededBy > 0 ? goal.exceededBy : goal.remaining, { hidden })}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" color="textSecondary">
              Fecha objetivo
            </AppText>
            <AppText variant="bodyStrong">{goal.targetDate ? formatShortDate(goal.targetDate) : 'Sin fecha'}</AppText>
          </View>
        </View>
      </FinancialCard>

      {goal.state === 'active' && goal.monthlyNeeded !== null ? (
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <AppText variant="subhead" style={{ paddingTop: spacing.sm }}>
            Para llegar a tiempo, separa
          </AppText>
          <InfoRow label="Al mes" value={formatMoney(goal.monthlyNeeded, { hidden })} showDivider={false} />
          {goal.weeklyNeeded !== null ? <InfoRow label="A la semana" value={formatMoney(goal.weeklyNeeded, { hidden })} /> : null}
          {goal.dailyNeeded !== null ? <InfoRow label="Al día" value={formatMoney(goal.dailyNeeded, { hidden })} /> : null}
          <AppText variant="caption" color="textTertiary" style={{ paddingVertical: spacing.sm }}>
            {goal.daysLeft === 0 ? 'La fecha objetivo es hoy.' : `Quedan ${goal.daysLeft} días.`} Se recalcula con cada aporte.
          </AppText>
        </FinancialCard>
      ) : goal.state === 'overdue' ? (
        <FinancialCard tone="muted" padding={spacing.lg}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Icon name="calendar.badge.exclamationmark" size={18} color={colors.warning} />
            <AppText variant="subhead" style={styles.flex}>
              La fecha objetivo pasó
            </AppText>
          </View>
          <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.xs }}>
            Faltaron {formatMoney(goal.remaining, { hidden })}. Pon una fecha nueva y LUJITOS recalcula cuánto separar.
          </AppText>
          <AppText variant="subhead" color="primary" style={{ marginTop: spacing.md }} onPress={() => openGoalForm(goal.id)}>
            Cambiar la fecha
          </AppText>
        </FinancialCard>
      ) : goal.state === 'active' && !goal.targetDate ? (
        <Note>Ponle una fecha objetivo para saber cuánto separar al mes, a la semana y al día.</Note>
      ) : null}

      {archived ? null : (
        <View style={[styles.row, { gap: spacing.md }]}>
          <PrimaryButton label="Aportar" icon="plus" style={styles.flex} onPress={() => openMovement({ goal: goal.id, kind: 'contribution' })} />
          <SecondaryButton
            label="Retirar"
            icon="minus"
            style={styles.flex}
            disabled={goal.saved <= 0}
            onPress={() => openMovement({ goal: goal.id, kind: 'withdrawal' })}
          />
        </View>
      )}

      <FinancialCard padding={spacing.lg} style={styles.list}>
        <InfoRow label="Cuenta" value={account ? account.name : 'Sin cuenta asignada'} showDivider={false} />
        {account && goal.accountBalance !== null ? <InfoRow label="Saldo de la cuenta" value={formatMoney(goal.accountBalance, { hidden })} /> : null}
        {account && goal.accountAllocated !== null && goal.accountAllocated !== goal.saved ? (
          <InfoRow label="Separado en metas de esa cuenta" value={formatMoney(goal.accountAllocated, { hidden })} />
        ) : null}
        <InfoRow label="Ahorro inicial" value={formatMoney(goal.initialSaved, { hidden })} />
        <InfoRow label="Aportes" value={formatMoney(goal.contributed, { hidden })} />
        <InfoRow label="Retiros" value={formatMoney(goal.withdrawn, { hidden })} />
        <InfoRow label="Inicio" value={formatShortDate(goal.startDate)} />
      </FinancialCard>
      {goal.unassigned ? (
        <Note>Sin cuenta asignada: la meta lleva la cuenta de lo separado, pero no está atada a una cuenta. Asígnala al editar.</Note>
      ) : overAllocated ? (
        <Note icon="exclamationmark.triangle">
          Lo separado en metas de {account?.name ?? 'esta cuenta'} ({formatMoney(goal.accountAllocated ?? 0, { hidden })}) es más que su saldo (
          {formatMoney(goal.accountBalance ?? 0, { hidden })}).
        </Note>
      ) : null}
      {goal.description ? (
        <AppText variant="footnote" color="textSecondary">
          {goal.description}
        </AppText>
      ) : null}

      <View>
        <SectionHeader title="Historial" subtitle={movements.length ? 'Toca un movimiento para editarlo o revertirlo' : undefined} />
        {movements.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="tray" title="Sin aportes todavía" message="Cada aporte o retiro queda aquí con su fecha." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.lg} style={styles.list}>
            {movements.map((movement, index) => (
              <MovementRow key={movement.id} movement={movement} showDivider={index > 0} onPress={() => movementActions(movement)} />
            ))}
          </FinancialCard>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        {archived ? (
          <PrimaryButton
            label="Reactivar meta"
            icon="arrow.uturn.backward"
            loading={busy}
            onPress={() => void run(() => setGoalArchived(goal.id, false), 'No pudimos reactivarla.')}
          />
        ) : (
          <SecondaryButton label="Archivar meta" icon="archivebox" disabled={busy} onPress={() => void run(() => setGoalArchived(goal.id, true), 'No pudimos archivarla.')} />
        )}
        {movements.length === 0 ? <SecondaryButton label="Eliminar meta" icon="trash" disabled={busy} onPress={confirmDelete} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingVertical: 4 },
  ring: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute' },
  split: { flexDirection: 'row', gap: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
