/**
 * Serie del saldo de una cuenta calculada en PostgreSQL (account_balance_history).
 * Se vuelve a pedir al cambiar de cuenta, de periodo o cuando cambian los datos
 * (version: por ejemplo, la cantidad de movimientos).
 */
import { useEffect, useState } from 'react';

import { rangeDates, sampleHistory, type ChartPoint, type HistoryRange } from '@/features/accounts/history';
import { nowInBogota } from '@/lib/dates';
import { fetchBalanceHistory } from '@/services/finance/financeService';

type State = { key: string; points: ChartPoint[]; error: string | null };

export function useBalanceHistory(accountId: string | undefined, range: HistoryRange, version: string | number, enabled: boolean) {
  const key = `${accountId ?? ''}|${range}|${version}`;
  const [state, setState] = useState<State>({ key: '', points: [], error: null });

  useEffect(() => {
    if (!enabled || !accountId) return;
    let active = true;
    const { from, to } = rangeDates(range, nowInBogota().date);
    fetchBalanceHistory(accountId, from, to).then(
      (points) => {
        if (active) setState({ key, points: sampleHistory(points, range), error: null });
      },
      (error: unknown) => {
        if (active) setState({ key, points: [], error: error instanceof Error ? error.message : 'No pudimos cargar el gráfico.' });
      },
    );
    return () => {
      active = false;
    };
  }, [accountId, range, key, enabled]);

  const loading = enabled && state.key !== key;
  return { points: loading ? [] : state.points, error: loading ? null : state.error, loading };
}
