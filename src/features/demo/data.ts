/**
 * ============================================================
 *  DATOS DE DEMOSTRACIÓN — FICTICIOS
 * ============================================================
 * Nada de este archivo es información financiera real. Existe solo para
 * diseñar y probar la interfaz en la Fase 2. En la Fase 3 se reemplaza por
 * consultas a Supabase con la misma forma de datos (ver src/types/finance.ts).
 */
import { cop } from '@/lib/money';
import type {
  Account,
  AppNotification,
  BudgetLine,
  CreditCard,
  Debt,
  RecurringPayment,
  SavingsGoal,
  Transaction,
} from '@/types/finance';

export const IS_DEMO = true;

/** Fecha de referencia de la demostración (los movimientos llegan hasta aquí). */
export const DEMO_TODAY = '2026-11-10';

export const DEMO_USER = {
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex@ejemplo.com',
  initials: 'AR',
};

export const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-bancolombia', name: 'Bancolombia Ahorros', institutionId: 'bancolombia', kind: 'savings', balance: cop(5_200_000), initialBalance: cop(3_150_000), currency: 'COP', createdAt: '2025-03-14', lastFour: '4821', method: 'manual' },
  { id: 'acc-nequi', name: 'Nequi', institutionId: 'nequi', kind: 'digital_wallet', balance: cop(1_250_000), initialBalance: cop(400_000), currency: 'COP', createdAt: '2025-03-14', method: 'manual' },
  { id: 'acc-davivienda', name: 'Davivienda Ahorros', institutionId: 'davivienda', kind: 'savings', balance: cop(450_000), initialBalance: cop(600_000), currency: 'COP', createdAt: '2025-05-02', lastFour: '9034', method: 'manual' },
  { id: 'acc-cash', name: 'Efectivo', institutionId: 'cash', kind: 'cash', balance: cop(500_000), initialBalance: cop(300_000), currency: 'COP', createdAt: '2025-03-14', method: 'manual' },
  { id: 'acc-daviplata', name: 'Daviplata', institutionId: 'daviplata', kind: 'digital_wallet', balance: cop(150_000), initialBalance: cop(100_000), currency: 'COP', createdAt: '2025-08-21', method: 'manual' },
  { id: 'acc-bbva', name: 'BBVA Corriente', institutionId: 'bbva', kind: 'checking', balance: cop(300_000), initialBalance: cop(300_000), currency: 'COP', createdAt: '2025-09-30', lastFour: '1157', method: 'manual' },
  { id: 'acc-bogota', name: 'Banco de Bogotá Ahorros', institutionId: 'bogota', kind: 'savings', balance: cop(200_000), initialBalance: cop(200_000), currency: 'COP', createdAt: '2026-01-12', lastFour: '6402', method: 'manual' },
  { id: 'acc-emergency', name: 'Fondo de emergencia', institutionId: 'custom', kind: 'other', balance: cop(400_000), initialBalance: cop(0), currency: 'COP', createdAt: '2026-02-01', method: 'manual' },
  { id: 'acc-cdt', name: 'CDT a 6 meses', institutionId: 'bancolombia', kind: 'investment', balance: cop(2_000_000), initialBalance: cop(2_000_000), currency: 'COP', createdAt: '2026-07-01', method: 'manual' },
  { id: 'acc-visa', name: 'Visa Bancolombia', institutionId: 'bancolombia', kind: 'credit_card', balance: cop(-1_180_000), initialBalance: cop(0), currency: 'COP', createdAt: '2025-06-10', lastFour: '5502', method: 'manual', creditLimit: cop(4_000_000) },
];

/** Octubre y noviembre de 2026 (hasta el día 10). */
export const DEMO_TRANSACTIONS: Transaction[] = [
  // Noviembre
  { id: 'tx-118', type: 'expense', amount: cop(28_500), accountId: 'acc-nequi', categoryId: 'food', description: 'Almuerzo', counterparty: 'Restaurante La Sazón', date: '2026-11-10' },
  { id: 'tx-117', type: 'expense', amount: cop(18_700), accountId: 'acc-nequi', categoryId: 'transport', description: 'Viaje en taxi', counterparty: 'App de transporte', date: '2026-11-10' },
  { id: 'tx-116', type: 'expense', amount: cop(186_400), accountId: 'acc-bancolombia', categoryId: 'food', description: 'Mercado de la semana', counterparty: 'Supermercado', date: '2026-11-09', tags: ['hogar'] },
  { id: 'tx-115', type: 'expense', amount: cop(12_000), accountId: 'acc-cash', categoryId: 'food', description: 'Café', counterparty: 'Cafetería', date: '2026-11-09' },
  { id: 'tx-114', type: 'income', amount: cop(300_000), accountId: 'acc-nequi', categoryId: 'services', description: 'Diseño de logotipo', counterparty: 'Cliente particular', date: '2026-11-08', notes: 'Pago del 50 % restante.' },
  { id: 'tx-113', type: 'expense', amount: cop(36_000), accountId: 'acc-nequi', categoryId: 'entertainment', description: 'Cine', counterparty: 'Sala de cine', date: '2026-11-08' },
  { id: 'tx-112', type: 'transfer', amount: cop(450_000), accountId: 'acc-bancolombia', toAccountId: 'acc-visa', description: 'Pago tarjeta Visa', date: '2026-11-07' },
  { id: 'tx-111', type: 'expense', amount: cop(42_300), accountId: 'acc-cash', categoryId: 'health', description: 'Medicamentos', counterparty: 'Droguería', date: '2026-11-07' },
  { id: 'tx-110', type: 'transfer', amount: cop(300_000), accountId: 'acc-bancolombia', toAccountId: 'acc-nequi', description: 'Recarga a Nequi', date: '2026-11-06' },
  { id: 'tx-109', type: 'expense', amount: cop(95_900), accountId: 'acc-bancolombia', categoryId: 'utilities', description: 'Internet hogar', counterparty: 'Operador de internet', date: '2026-11-06' },
  { id: 'tx-108', type: 'expense', amount: cop(78_500), accountId: 'acc-bancolombia', categoryId: 'utilities', description: 'Energía', counterparty: 'Empresa de energía', date: '2026-11-06' },
  { id: 'tx-107', type: 'expense', amount: cop(48_000), accountId: 'acc-daviplata', categoryId: 'education', description: 'Libro de finanzas personales', counterparty: 'Librería', date: '2026-11-05' },
  { id: 'tx-106', type: 'expense', amount: cop(120_000), accountId: 'acc-davivienda', categoryId: 'transport', description: 'Gasolina', counterparty: 'Estación de servicio', date: '2026-11-04' },
  { id: 'tx-105', type: 'expense', amount: cop(150_000), accountId: 'acc-bancolombia', categoryId: 'family', description: 'Regalo de cumpleaños', date: '2026-11-04' },
  { id: 'tx-104', type: 'income', amount: cop(2_200_000), accountId: 'acc-bancolombia', categoryId: 'salary', description: 'Nómina', counterparty: 'Empleador', date: '2026-11-03' },
  { id: 'tx-103', type: 'expense', amount: cop(16_900), accountId: 'acc-visa', categoryId: 'subscriptions', description: 'Música en streaming', date: '2026-11-03' },
  { id: 'tx-102', type: 'expense', amount: cop(26_900), accountId: 'acc-visa', categoryId: 'subscriptions', description: 'Series y películas', date: '2026-11-02' },
  { id: 'tx-101', type: 'expense', amount: cop(89_900), accountId: 'acc-visa', categoryId: 'gym', description: 'Mensualidad gimnasio', date: '2026-11-01' },
  // Octubre
  { id: 'tx-016', type: 'expense', amount: cop(115_000), accountId: 'acc-nequi', categoryId: 'entertainment', description: 'Concierto', date: '2026-10-25' },
  { id: 'tx-015', type: 'expense', amount: cop(168_300), accountId: 'acc-visa', categoryId: 'shopping', description: 'Ropa', counterparty: 'Tienda de ropa', date: '2026-10-22' },
  { id: 'tx-014', type: 'income', amount: cop(150_000), accountId: 'acc-nequi', categoryId: 'sales', description: 'Venta de bicicleta usada', date: '2026-10-20' },
  { id: 'tx-013', type: 'expense', amount: cop(135_000), accountId: 'acc-bancolombia', categoryId: 'food', description: 'Cena familiar', counterparty: 'Restaurante', date: '2026-10-18' },
  { id: 'tx-012', type: 'expense', amount: cop(900_000), accountId: 'acc-bancolombia', categoryId: 'housing', description: 'Arriendo', date: '2026-10-14' },
  { id: 'tx-011', type: 'expense', amount: cop(210_000), accountId: 'acc-bancolombia', categoryId: 'food', description: 'Mercado del mes', counterparty: 'Supermercado', date: '2026-10-09' },
  { id: 'tx-010', type: 'expense', amount: cop(95_900), accountId: 'acc-bancolombia', categoryId: 'utilities', description: 'Internet hogar', date: '2026-10-06' },
  { id: 'tx-009', type: 'expense', amount: cop(82_100), accountId: 'acc-bancolombia', categoryId: 'utilities', description: 'Energía', date: '2026-10-06' },
  { id: 'tx-008', type: 'expense', amount: cop(180_000), accountId: 'acc-davivienda', categoryId: 'transport', description: 'Mantenimiento del carro', date: '2026-10-04' },
  { id: 'tx-007', type: 'income', amount: cop(2_200_000), accountId: 'acc-bancolombia', categoryId: 'salary', description: 'Nómina', counterparty: 'Empleador', date: '2026-10-03' },
  { id: 'tx-006', type: 'expense', amount: cop(16_900), accountId: 'acc-visa', categoryId: 'subscriptions', description: 'Música en streaming', date: '2026-10-03' },
  { id: 'tx-005', type: 'expense', amount: cop(26_900), accountId: 'acc-visa', categoryId: 'subscriptions', description: 'Series y películas', date: '2026-10-02' },
  { id: 'tx-004', type: 'expense', amount: cop(89_900), accountId: 'acc-visa', categoryId: 'gym', description: 'Mensualidad gimnasio', date: '2026-10-01' },
];

/** Ingresos y gastos totales por mes (diciembre 2025 a noviembre 2026; noviembre va al día 10). */
export const DEMO_MONTHLY: { month: string; income: number; expense: number }[] = [
  { month: '2025-12', income: cop(2_900_000), expense: cop(2_450_000) },
  { month: '2026-01', income: cop(2_200_000), expense: cop(1_980_000) },
  { month: '2026-02', income: cop(2_200_000), expense: cop(1_940_000) },
  { month: '2026-03', income: cop(2_350_000), expense: cop(2_010_000) },
  { month: '2026-04', income: cop(2_200_000), expense: cop(1_960_000) },
  { month: '2026-05', income: cop(2_400_000), expense: cop(2_050_000) },
  { month: '2026-06', income: cop(2_750_000), expense: cop(2_300_000) },
  { month: '2026-07', income: cop(2_200_000), expense: cop(1_990_000) },
  { month: '2026-08', income: cop(2_300_000), expense: cop(1_970_000) },
  { month: '2026-09', income: cop(2_250_000), expense: cop(1_930_000) },
  { month: '2026-10', income: cop(2_350_000), expense: cop(2_020_000) },
  { month: '2026-11', income: cop(2_500_000), expense: cop(950_000) },
];

/** Reparto típico de gastos para los meses sin movimientos detallados. */
export const DEMO_EXPENSE_WEIGHTS: Record<string, number> = {
  housing: 0.44,
  food: 0.17,
  transport: 0.1,
  utilities: 0.09,
  entertainment: 0.05,
  gym: 0.045,
  shopping: 0.04,
  subscriptions: 0.022,
  health: 0.02,
  family: 0.013,
  education: 0.01,
};

export const DEMO_BUDGET: BudgetLine[] = [
  { categoryId: 'housing', limit: cop(900_000) },
  { categoryId: 'food', limit: cop(450_000) },
  { categoryId: 'transport', limit: cop(300_000) },
  { categoryId: 'utilities', limit: cop(220_000) },
  { categoryId: 'entertainment', limit: cop(120_000) },
  { categoryId: 'family', limit: cop(100_000) },
  { categoryId: 'gym', limit: cop(90_000) },
  { categoryId: 'health', limit: cop(60_000) },
  { categoryId: 'education', limit: cop(60_000) },
  { categoryId: 'subscriptions', limit: cop(50_000) },
];

/** Umbrales de alerta del presupuesto (en porcentaje usado). */
export const BUDGET_ALERTS = [70, 85, 100] as const;

export const DEMO_GOALS: SavingsGoal[] = [
  { id: 'goal-emergency', name: 'Fondo de emergencia', description: 'Tres meses de gastos fijos.', target: cop(6_000_000), saved: cop(400_000), deadline: '2027-12-31', priority: 'alta', accountId: 'acc-emergency', icon: 'shield.lefthalf.filled', tone: 'forest' },
  { id: 'goal-trip', name: 'Viaje a Cartagena', description: 'Tiquetes y hotel para cuatro noches.', target: cop(3_000_000), saved: cop(1_200_000), deadline: '2027-06-30', priority: 'media', accountId: 'acc-nequi', icon: 'airplane', tone: 'teal' },
  { id: 'goal-laptop', name: 'Portátil nuevo', description: 'Para trabajo y estudio.', target: cop(4_500_000), saved: cop(1_800_000), deadline: '2027-03-31', priority: 'baja', icon: 'laptopcomputer', tone: 'blue' },
];

export const DEMO_DEBTS: Debt[] = [
  { id: 'debt-visa', name: 'Tarjeta Visa', kind: 'credit_card', lender: 'Bancolombia', balance: cop(1_180_000), original: cop(1_180_000), annualRate: 28.5, monthlyPayment: cop(120_000), nextDue: '2026-11-18' },
  { id: 'debt-loan', name: 'Crédito de libre inversión', kind: 'loan', lender: 'Banco de Bogotá', balance: cop(3_600_000), original: cop(6_000_000), annualRate: 19.8, monthlyPayment: cop(285_000), nextDue: '2026-11-22', installmentsLeft: 14 },
  { id: 'debt-family', name: 'Préstamo familiar', kind: 'personal', lender: 'Familiar', balance: cop(300_000), original: cop(500_000), annualRate: 0, monthlyPayment: cop(100_000), nextDue: '2026-11-30', installmentsLeft: 3 },
];

export const DEMO_CARDS: CreditCard[] = [
  {
    id: 'card-visa',
    accountId: 'acc-visa',
    name: 'Visa Bancolombia',
    network: 'Visa',
    lastFour: '5502',
    limit: cop(4_000_000),
    used: cop(1_180_000),
    cutoffDay: 30,
    dueDate: '2026-11-18',
    minimumPayment: cop(120_000),
    installments: [
      { description: 'Celular', current: 5, total: 12, amount: cop(95_000) },
      { description: 'Ropa', current: 1, total: 3, amount: cop(56_100) },
    ],
  },
];

export const DEMO_RECURRING: RecurringPayment[] = [
  { id: 'rec-salary', name: 'Nómina', type: 'income', amount: cop(2_200_000), categoryId: 'salary', accountId: 'acc-bancolombia', frequency: 'Mensual', dayOfMonth: 3, nextDate: '2026-12-03' },
  { id: 'rec-rent', name: 'Arriendo', type: 'expense', amount: cop(900_000), categoryId: 'housing', accountId: 'acc-bancolombia', frequency: 'Mensual', dayOfMonth: 15, nextDate: '2026-11-15' },
  { id: 'rec-loan', name: 'Cuota del crédito', type: 'expense', amount: cop(285_000), categoryId: 'other-out', accountId: 'acc-bancolombia', frequency: 'Mensual', dayOfMonth: 22, nextDate: '2026-11-22' },
  { id: 'rec-gym', name: 'Gimnasio', type: 'expense', amount: cop(89_900), categoryId: 'gym', accountId: 'acc-visa', frequency: 'Mensual', dayOfMonth: 1, nextDate: '2026-12-01' },
  { id: 'rec-video', name: 'Series y películas', type: 'expense', amount: cop(26_900), categoryId: 'subscriptions', accountId: 'acc-visa', frequency: 'Mensual', dayOfMonth: 2, nextDate: '2026-12-02' },
  { id: 'rec-music', name: 'Música en streaming', type: 'expense', amount: cop(16_900), categoryId: 'subscriptions', accountId: 'acc-visa', frequency: 'Mensual', dayOfMonth: 3, nextDate: '2026-12-03' },
  { id: 'rec-internet', name: 'Internet hogar', type: 'expense', amount: cop(95_900), categoryId: 'utilities', accountId: 'acc-bancolombia', frequency: 'Mensual', dayOfMonth: 6, nextDate: '2026-12-06' },
  { id: 'rec-energy', name: 'Energía', type: 'expense', amount: cop(80_000), categoryId: 'utilities', accountId: 'acc-bancolombia', frequency: 'Mensual', dayOfMonth: 6, nextDate: '2026-12-06', variable: true },
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 'n-1', kind: 'budget', title: 'Suscripciones al 88 %', body: 'Llevas $ 43.800 de $ 50.000 y faltan 20 días del mes.', date: '2026-11-10', read: false, href: '/budgets' },
  { id: 'n-2', kind: 'due', title: 'El arriendo vence el 15 de noviembre', body: '$ 900.000 desde Bancolombia Ahorros.', date: '2026-11-10', read: false, href: '/calendar' },
  { id: 'n-3', kind: 'due', title: 'Pago de la tarjeta Visa', body: 'Vence el 18 de noviembre. Pago mínimo: $ 120.000.', date: '2026-11-09', read: false, href: '/cards' },
  { id: 'n-4', kind: 'budget', title: 'Familia superó su presupuesto', body: '$ 150.000 de $ 100.000 este mes.', date: '2026-11-04', read: true, href: '/budgets' },
  { id: 'n-5', kind: 'goal', title: 'Viaje a Cartagena va en 40 %', body: 'Te faltan $ 1.800.000 para la meta.', date: '2026-11-01', read: true, href: '/savings' },
];

/** Ejemplos fijos para la interfaz del asesor. No los genera ninguna IA. */
export const DEMO_ADVISOR_TIP = {
  title: 'Tus suscripciones van en 88 %',
  body: 'Faltan 20 días del mes y ya usaste $ 43.800 de $ 50.000. Revisar los dos servicios de streaming podría liberar ese dinero para tu meta de viaje.',
};
