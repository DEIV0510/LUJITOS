/**
 * Respuestas de EJEMPLO del asesor. No hay ninguna IA detrás: son textos armados
 * con los datos de demostración para diseñar la conversación. En la Fase 9 este
 * archivo se reemplaza por la conexión con Claude (con consentimiento del usuario).
 */
import { DEMO_RECURRING, DEMO_TODAY } from '@/features/demo/data';
import {
  getBalanceOverview,
  getBudgetOverview,
  getMonthSummary,
  getStats,
} from '@/features/demo/selectors';
import { formatMoney, formatPercent, percentChange } from '@/lib/money';

export const SUGGESTED_QUESTIONS = [
  '¿Cuánto dinero tengo?',
  '¿Cuánto gasté este mes?',
  '¿En qué categoría gasto más?',
  '¿Cuánto puedo ahorrar?',
  '¿Cómo puedo mejorar mis finanzas?',
] as const;

export type AdvisorMessage = { id: string; role: 'user' | 'assistant'; text: string; example?: boolean };

function pendingThisMonth() {
  const monthKey = DEMO_TODAY.slice(0, 7);
  return DEMO_RECURRING.filter(
    (item) => item.type === 'expense' && item.nextDate.startsWith(monthKey) && item.nextDate > DEMO_TODAY,
  );
}

export function demoReply(question: string): string {
  const overview = getBalanceOverview();
  const month = getMonthSummary();

  switch (question) {
    case '¿Cuánto dinero tengo?':
      return `Tienes ${formatMoney(overview.available)} disponibles entre tus cuentas, billeteras y efectivo. Tu patrimonio neto es ${formatMoney(
        overview.netWorth,
      )}: suma tus inversiones (${formatMoney(overview.investments)}) y resta tus deudas (${formatMoney(overview.debts)}).`;
    case '¿Cuánto gasté este mes?': {
      const change = percentChange(month.expense, month.previousExpense);
      return `Del 1 al 10 de noviembre gastaste ${formatMoney(month.expense)}${
        change !== null
          ? `, un ${formatPercent(Math.abs(change))} ${change >= 0 ? 'más' : 'menos'} que en el mismo tramo de octubre`
          : ''
      }. Las transferencias entre tus cuentas y el pago de la tarjeta no cuentan como gasto.`;
    }
    case '¿En qué categoría gasto más?': {
      const [first, second] = getStats('month').categories;
      if (!first) return 'Todavía no hay gastos suficientes para comparar categorías.';
      return `En las últimas cuatro semanas, tu mayor gasto es ${first.category.name.toLowerCase()} con ${formatMoney(first.amount)}${
        second ? `, seguido de ${second.category.name.toLowerCase()} con ${formatMoney(second.amount)}` : ''
      }.`;
    }
    case '¿Cuánto puedo ahorrar?': {
      const pending = pendingThisMonth();
      const pendingTotal = pending.reduce((acc, item) => acc + item.amount, 0);
      const projected = month.savings - pendingTotal;
      return `Este mes llevas ${formatMoney(month.savings)} de diferencia entre ingresos y gastos, pero aún tienes ${formatMoney(
        pendingTotal,
      )} en pagos fijos pendientes (${pending
        .map((item) => item.name.toLowerCase())
        .join(' y ')}). Si el resto del mes se mantiene, podrías ahorrar cerca de ${formatMoney(Math.max(projected, 0))}.`;
    }
    case '¿Cómo puedo mejorar mis finanzas?': {
      const budget = getBudgetOverview();
      const over = budget.lines.filter((line) => line.ratio >= 0.85).map((line) => line.category.name.toLowerCase());
      return `Tres ideas con tus datos de ejemplo: 1) paga primero la tarjeta Visa, que tiene la tasa más alta (28,5 % E.A.); 2) revisa ${over.join(
        ', ',
      )}, que ya pasan del 85 % de su presupuesto; 3) programa un aporte fijo al fondo de emergencia el día que recibes la nómina.`;
    }
    default:
      return 'Todavía no puedo responder preguntas libres. El asesor se conectará a la IA en la Fase 9, con tu permiso y usando solo los datos necesarios.';
  }
}

export const INITIAL_CONVERSATION: AdvisorMessage[] = [
  {
    id: 'm-1',
    role: 'assistant',
    text: 'Hola. Soy el asesor de LUJITOS. Por ahora esta es una vista previa: las respuestas son ejemplos fijos calculados con los datos de demostración.',
    example: true,
  },
  { id: 'm-2', role: 'user', text: '¿Cuánto dinero tengo?' },
  { id: 'm-3', role: 'assistant', text: demoReply('¿Cuánto dinero tengo?'), example: true },
];

/** Con datos reales el asesor todavía no está conectado: no se inventan respuestas. */
export const LIVE_CONVERSATION: AdvisorMessage[] = [
  {
    id: 'm-live-1',
    role: 'assistant',
    text: 'Hola. Soy el asesor de LUJITOS. Todavía no estoy conectado: en la Fase 9 podré responder con tus datos reales, solo si me das permiso y usando la información mínima necesaria.',
  },
];

export const LIVE_REPLY =
  'Todavía no puedo responder: el asesor se conecta en la Fase 9. No voy a inventar cifras sobre tu dinero. Mientras tanto, tus saldos y movimientos están en Inicio, Cuentas y Movimientos.';

export const RECOMMENDATIONS = [
  {
    id: 'r-1',
    icon: 'play.rectangle.fill',
    tone: 'plum',
    title: 'Revisa tus suscripciones',
    body: 'Van en 88 % del presupuesto.',
    question: '¿Cómo puedo mejorar mis finanzas?',
  },
  {
    id: 'r-2',
    icon: 'shield.lefthalf.filled',
    tone: 'forest',
    title: 'Fondo de emergencia',
    body: 'Lleva 7 % de la meta.',
    question: '¿Cuánto puedo ahorrar?',
  },
  {
    id: 'r-3',
    icon: 'creditcard.fill',
    tone: 'gold',
    title: 'Tarjeta con tasa alta',
    body: 'Págala antes del 18 nov.',
    question: '¿Cómo puedo mejorar mis finanzas?',
  },
] as const;
