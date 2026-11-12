/**
 * Proyecciones a 3, 6 y 12 meses. Cálculos puros a partir de los promedios que
 * entrega PostgreSQL (planning_snapshot) y del resumen (financial_summary).
 *
 * Supuestos (se muestran en la pantalla):
 *   - Cada mes se repite el ahorro promedio (ingresos − gastos promedio).
 *   - Las cuotas de deudas van completas a capital (no se proyectan intereses).
 *   - No hay rendimientos, gastos extraordinarios ni cambios de ingreso.
 * Sin historial no se proyecta nada (no se inventan datos).
 */
import type { Money } from '@/lib/money';
import type { PaymentFrequency, PlanningSnapshot } from '@/types/planning';

export const PROJECTION_MONTHS = [3, 6, 12] as const;

export const PROJECTION_ASSUMPTIONS = [
  'Cada mes ahorras lo mismo que tu promedio (ingresos menos gastos).',
  'Las cuotas de tus deudas van completas a capital; no se proyectan intereses.',
  'No incluye rendimientos, gastos extraordinarios ni cambios de ingreso.',
];

/** Valor mensual equivalente de una cuota según su frecuencia (como en planning_snapshot). */
export function monthlyEquivalent(amount: Money, frequency: PaymentFrequency): Money {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return 0;
  }
}

export type Projection = {
  months: number;
  /** Patrimonio estimado al final del plazo. */
  netWorth: Money;
  /** Ahorro acumulado en el plazo (negativo si se gasta más de lo que entra). */
  saved: Money;
  /** Deuda de préstamos estimada (sin intereses). */
  loanDebt: Money;
};

export function buildProjections(
  planning: Pick<PlanningSnapshot, 'savingsAvg' | 'obligationsMonthly' | 'basis'>,
  current: { netWorth: Money; loanDebt: Money },
  horizons: readonly number[] = PROJECTION_MONTHS,
): Projection[] | null {
  if (planning.basis === 'none' || planning.savingsAvg === null) return null;
  const savings = planning.savingsAvg;
  return horizons.map((months) => ({
    months,
    netWorth: Math.round(current.netWorth + savings * months),
    saved: Math.round(savings * months),
    loanDebt: Math.max(Math.round(current.loanDebt - planning.obligationsMonthly * months), 0),
  }));
}

/** Meses para terminar de pagar con la cuota actual (sin intereses). null sin cuota. */
export function payoffMonths(outstanding: Money, installment: Money | null, frequency: PaymentFrequency): number | null {
  if (!installment || frequency === 'none' || outstanding <= 0) return outstanding <= 0 ? 0 : null;
  const monthly = monthlyEquivalent(installment, frequency);
  return monthly > 0 ? Math.ceil(outstanding / monthly) : null;
}

/** % de ahorro sobre ingresos; null si no hay ingresos (no se divide por cero). */
export function savingsRate(income: Money, expense: Money): number | null {
  if (income <= 0) return null;
  return Math.round(((income - expense) * 10000) / income) / 100;
}
