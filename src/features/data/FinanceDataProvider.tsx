/**
 * Fuente única de datos financieros para las pantallas.
 *
 *   mode 'live' (por defecto): cuentas, categorías, movimientos, presupuestos,
 *                              metas, deudas y resumen REALES del usuario en
 *                              Supabase. Los totales vienen calculados por
 *                              PostgreSQL (financial_summary, budget_status…).
 *   mode 'demo':               datos ficticios de src/features/demo, siempre
 *                              marcados como demostración. Nada se guarda.
 *
 * Toda escritura pasa por las funciones RPC y, al terminar, se recargan los
 * datos: el panel, las cuentas, los presupuestos y las metas quedan al día.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CATEGORIES, getCategory as getDemoCategory, TRANSFER_CATEGORY } from '@/constants/categories';
import { ADJUSTMENT_CATEGORY } from '@/constants/transactions';
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from '@/features/demo/data';
import { useAuth } from '@/hooks/auth';
import { monthKey, nowInBogota } from '@/lib/dates';
import * as accountService from '@/services/accounts/accountService';
import * as categoryService from '@/services/categories/categoryService';
import { fetchFinancialSummary, type FinancialSummary } from '@/services/finance/financeService';
import * as budgetService from '@/services/planning/budgetService';
import * as debtService from '@/services/planning/debtService';
import * as goalService from '@/services/planning/goalService';
import { fetchPlanningSnapshot, fetchSpendingByCategory } from '@/services/planning/planningService';
import * as transactionService from '@/services/transactions/transactionService';
import type { AccountInput } from '@/services/accounts/accountService';
import type { CategoryInput } from '@/services/categories/categoryService';
import type { BudgetInput } from '@/services/planning/budgetService';
import type { DebtInput, DebtPaymentInput } from '@/services/planning/debtService';
import type { GoalInput, GoalMovementInput } from '@/services/planning/goalService';
import type { ReconcileInput, TransactionInput, WriteOptions } from '@/services/transactions/transactionService';
import type { Account, Category, Transaction } from '@/types/finance';
import type { Budget, BudgetAlert, CategorySpending, DebtRecord, Goal, GoalMovement, PlanningSnapshot } from '@/types/planning';

import { summaryFromAccounts } from './summaries';

export type DataMode = 'live' | 'demo';
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type FinanceData = {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  status: LoadStatus;
  error: string | null;
  /** Cuentas de dinero y tarjetas, también las archivadas. Las deudas van aparte. */
  accounts: Account[];
  /** Cuentas activas para elegir en formularios (sin deudas). */
  activeAccounts: Account[];
  /** Cuentas de tipo «loan» (una por deuda). */
  loanAccounts: Account[];
  /** Todas las categorías visibles, también las archivadas. */
  categories: Category[];
  /** Movimientos vigentes (sin anulados). */
  transactions: Transaction[];
  /** Movimientos anulados: se conservan para la trazabilidad. */
  voidedTransactions: Transaction[];
  /** Totales calculados en el servidor. null mientras carga. */
  summary: FinancialSummary | null;
  budgets: Budget[];
  budgetAlerts: BudgetAlert[];
  goals: Goal[];
  /** Aportes y retiros (también los revertidos). */
  goalMovements: GoalMovement[];
  debts: DebtRecord[];
  planning: PlanningSnapshot | null;
  /** Gasto por categoría en lo que va del mes (el mayor primero). */
  monthSpending: CategorySpending[];
  /** Cualquier cuenta, también las de deuda. */
  getAccount: (id: string | undefined) => Account | undefined;
  getCategory: (id: string | undefined) => Category;
  getTransaction: (id: string | undefined) => Transaction | undefined;
  getBudget: (id: string | undefined) => Budget | undefined;
  getGoal: (id: string | undefined) => Goal | undefined;
  getDebt: (id: string | undefined) => DebtRecord | undefined;
  /** La deuda dueña de una cuenta de tipo «loan». */
  getDebtByAccount: (accountId: string | undefined) => DebtRecord | undefined;
  reload: () => Promise<void>;
  createAccount: (input: AccountInput, requestId: string) => Promise<string>;
  updateAccount: (id: string, input: AccountInput) => Promise<void>;
  archiveAccount: (id: string, force?: boolean) => Promise<void>;
  restoreAccount: (id: string) => Promise<void>;
  createTransaction: (input: TransactionInput, requestId: string, options?: WriteOptions) => Promise<string>;
  updateTransaction: (id: string, input: TransactionInput, options?: WriteOptions) => Promise<void>;
  voidTransaction: (id: string, reason?: string) => Promise<void>;
  reconcileAccount: (input: ReconcileInput, requestId: string) => Promise<{ transactionId: string | null; difference: number }>;
  createCategory: (input: CategoryInput) => Promise<Category>;
  updateCategory: (id: string, input: Omit<CategoryInput, 'kind'>) => Promise<void>;
  setCategoryArchived: (id: string, archived: boolean) => Promise<void>;
  deleteCategory: (id: string, reassignTo?: string | null) => Promise<void>;
  createBudget: (input: BudgetInput, requestId: string) => Promise<string>;
  updateBudget: (id: string, input: BudgetInput) => Promise<void>;
  setBudgetArchived: (id: string, archived: boolean) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  markAlertsSeen: (ids: string[]) => Promise<void>;
  createGoal: (input: GoalInput, requestId: string) => Promise<string>;
  updateGoal: (id: string, input: GoalInput) => Promise<void>;
  setGoalArchived: (id: string, archived: boolean) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addGoalMovement: (input: GoalMovementInput, requestId: string, options?: WriteOptions) => Promise<string>;
  updateGoalMovement: (id: string, input: { amount: number; date: string; note?: string | null }, options?: WriteOptions) => Promise<void>;
  voidGoalMovement: (id: string, reason?: string) => Promise<void>;
  createDebt: (input: DebtInput, requestId: string) => Promise<string>;
  updateDebt: (id: string, input: DebtInput) => Promise<void>;
  setDebtArchived: (id: string, archived: boolean, force?: boolean) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  registerDebtPayment: (
    input: DebtPaymentInput,
    requestId: string,
    options?: WriteOptions,
  ) => Promise<{ transactionId: string; interestTransactionId: string | null }>;
};

const STORAGE_KEY = 'lujitos.data-mode';
const FinanceContext = createContext<FinanceData | null>(null);

const demoTransactions = [...DEMO_TRANSACTIONS].sort((a, b) =>
  a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
);

const fallbackCategory = CATEGORIES[CATEGORIES.length - 1]!;

type Snapshot = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  summary: FinancialSummary;
  budgets: Budget[];
  budgetAlerts: BudgetAlert[];
  goals: Goal[];
  goalMovements: GoalMovement[];
  debts: DebtRecord[];
  planning: PlanningSnapshot;
  monthSpending: CategorySpending[];
};

const EMPTY_PLANNING_DATA = {
  budgets: [] as Budget[],
  budgetAlerts: [] as BudgetAlert[],
  goals: [] as Goal[],
  goalMovements: [] as GoalMovement[],
  debts: [] as DebtRecord[],
  planning: null,
  monthSpending: [] as CategorySpending[],
};

/** Lee todo lo del usuario con sesión (el RLS filtra en el servidor). */
async function fetchSnapshot(): Promise<Snapshot> {
  const today = nowInBogota().date;
  const accountsRequest = accountService.fetchAccounts();
  const [accounts, categories, transactions, summary, budgets, budgetAlerts, goals, goalMovements, debts, planning, monthSpending] =
    await Promise.all([
      accountsRequest,
      categoryService.fetchCategories(),
      transactionService.fetchTransactions(),
      fetchFinancialSummary(),
      budgetService.fetchBudgets(),
      budgetService.fetchBudgetAlerts(),
      goalService.fetchGoals(),
      goalService.fetchGoalMovements(),
      accountsRequest.then((list) => debtService.fetchDebts(list)),
      fetchPlanningSnapshot(),
      fetchSpendingByCategory(`${monthKey(today)}-01`, today),
    ]);
  return { accounts, categories, transactions, summary, budgets, budgetAlerts, goals, goalMovements, debts, planning, monthSpending };
}

function demoOnly(): Promise<never> {
  return Promise.reject(new Error('En modo demostración no se guarda nada.'));
}

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [mode, setModeState] = useState<DataMode>('live');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'demo') setModeState('demo');
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: DataMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const apply = useCallback((next: Snapshot) => {
    setSnapshot(next);
    setError(null);
    setStatus('ready');
  }, []);

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus datos.');
    setStatus('error');
  }, []);

  /** Recarga (reintentar, después de guardar). Sin parpadeo si ya había datos. */
  const reload = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    await fetchSnapshot().then(apply, fail);
  }, [apply, fail]);

  // Carga inicial. El proveedor se monta con key = id de usuario (ver
  // (app)/_layout.tsx): un usuario nuevo siempre empieza con el estado vacío.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchSnapshot()
      .then((next) => {
        if (active) apply(next);
      })
      .catch((cause: unknown) => {
        if (active) fail(cause);
      });
    return () => {
      active = false;
    };
  }, [userId, apply, fail]);

  const value = useMemo<FinanceData>(() => {
    if (mode === 'demo') {
      const demoById = new Map(demoTransactions.map((transaction) => [transaction.id, transaction]));
      return {
        mode,
        setMode,
        status: 'ready',
        error: null,
        accounts: DEMO_ACCOUNTS,
        activeAccounts: DEMO_ACCOUNTS,
        loanAccounts: [],
        categories: CATEGORIES,
        transactions: demoTransactions,
        voidedTransactions: [],
        summary: summaryFromAccounts(DEMO_ACCOUNTS, demoTransactions, monthKey(nowInBogota().date)),
        ...EMPTY_PLANNING_DATA,
        getAccount: (id) => DEMO_ACCOUNTS.find((account) => account.id === id),
        getCategory: (id) => (id === 'adjustment' ? ADJUSTMENT_CATEGORY : getDemoCategory(id)),
        getTransaction: (id) => (id ? demoById.get(id) : undefined),
        getBudget: () => undefined,
        getGoal: () => undefined,
        getDebt: () => undefined,
        getDebtByAccount: () => undefined,
        reload: async () => undefined,
        createAccount: demoOnly,
        updateAccount: demoOnly,
        archiveAccount: demoOnly,
        restoreAccount: demoOnly,
        createTransaction: demoOnly,
        updateTransaction: demoOnly,
        voidTransaction: demoOnly,
        reconcileAccount: demoOnly,
        createCategory: demoOnly,
        updateCategory: demoOnly,
        setCategoryArchived: demoOnly,
        deleteCategory: demoOnly,
        createBudget: demoOnly,
        updateBudget: demoOnly,
        setBudgetArchived: demoOnly,
        deleteBudget: demoOnly,
        markAlertsSeen: async () => undefined,
        createGoal: demoOnly,
        updateGoal: demoOnly,
        setGoalArchived: demoOnly,
        deleteGoal: demoOnly,
        addGoalMovement: demoOnly,
        updateGoalMovement: demoOnly,
        voidGoalMovement: demoOnly,
        createDebt: demoOnly,
        updateDebt: demoOnly,
        setDebtArchived: demoOnly,
        deleteDebt: demoOnly,
        registerDebtPayment: demoOnly,
      };
    }

    const allAccounts = snapshot?.accounts ?? [];
    const categories = snapshot?.categories ?? [];
    const allTransactions = snapshot?.transactions ?? [];
    const budgets = snapshot?.budgets ?? [];
    const goals = snapshot?.goals ?? [];
    const debts = snapshot?.debts ?? [];
    const accounts = allAccounts.filter((account) => account.kind !== 'loan');
    const accountsById = new Map(allAccounts.map((account) => [account.id, account]));
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const transactionsById = new Map(allTransactions.map((transaction) => [transaction.id, transaction]));
    const byId = <T extends { id: string }>(list: T[]) => {
      const map = new Map(list.map((item) => [item.id, item]));
      return (id: string | undefined) => (id ? map.get(id) : undefined);
    };
    const debtByAccount = new Map(debts.map((debt) => [debt.accountId, debt]));

    /** Después de cada operación exitosa se recargan saldos, resumen y listas. */
    const thenReload =
      <A extends unknown[], R>(action: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        const result = await action(...args);
        await reload();
        return result;
      };

    return {
      mode,
      setMode,
      status,
      error,
      accounts,
      activeAccounts: accounts.filter((account) => account.isActive !== false),
      loanAccounts: allAccounts.filter((account) => account.kind === 'loan'),
      categories,
      transactions: allTransactions.filter((transaction) => !transaction.voidedAt),
      voidedTransactions: allTransactions.filter((transaction) => Boolean(transaction.voidedAt)),
      summary: snapshot?.summary ?? null,
      budgets,
      budgetAlerts: snapshot?.budgetAlerts ?? [],
      goals,
      goalMovements: snapshot?.goalMovements ?? [],
      debts,
      planning: snapshot?.planning ?? null,
      monthSpending: snapshot?.monthSpending ?? [],
      getAccount: (id) => (id ? accountsById.get(id) : undefined),
      getCategory: (id) => {
        if (id === TRANSFER_CATEGORY.id) return TRANSFER_CATEGORY;
        if (id === ADJUSTMENT_CATEGORY.id) return ADJUSTMENT_CATEGORY;
        return (id && categoriesById.get(id)) || categories.find((c) => c.slug === 'other-out') || fallbackCategory;
      },
      getTransaction: (id) => (id ? transactionsById.get(id) : undefined),
      getBudget: byId(budgets),
      getGoal: byId(goals),
      getDebt: byId(debts),
      getDebtByAccount: (accountId) => (accountId ? debtByAccount.get(accountId) : undefined),
      reload,
      createAccount: thenReload(accountService.createAccount),
      updateAccount: thenReload(accountService.updateAccount),
      archiveAccount: thenReload(accountService.archiveAccount),
      restoreAccount: thenReload(accountService.restoreAccount),
      createTransaction: thenReload(transactionService.createTransaction),
      updateTransaction: thenReload(transactionService.updateTransaction),
      voidTransaction: thenReload(transactionService.voidTransaction),
      reconcileAccount: thenReload(transactionService.reconcileAccount),
      createCategory: thenReload((input: CategoryInput) => {
        if (!userId) return Promise.reject(new Error('Inicia sesión.'));
        return categoryService.createCategory(userId, input);
      }),
      updateCategory: thenReload(categoryService.updateCategory),
      setCategoryArchived: thenReload(categoryService.setCategoryArchived),
      deleteCategory: thenReload(categoryService.deleteCategory),
      createBudget: thenReload(budgetService.createBudget),
      updateBudget: thenReload(budgetService.updateBudget),
      setBudgetArchived: thenReload(budgetService.setBudgetArchived),
      deleteBudget: thenReload(budgetService.deleteBudget),
      markAlertsSeen: thenReload(budgetService.markAlertsSeen),
      createGoal: thenReload(goalService.createGoal),
      updateGoal: thenReload(goalService.updateGoal),
      setGoalArchived: thenReload(goalService.setGoalArchived),
      deleteGoal: thenReload(goalService.deleteGoal),
      addGoalMovement: thenReload(goalService.addGoalMovement),
      updateGoalMovement: thenReload(goalService.updateGoalMovement),
      voidGoalMovement: thenReload(goalService.voidGoalMovement),
      createDebt: thenReload(debtService.createDebt),
      updateDebt: thenReload(debtService.updateDebt),
      setDebtArchived: thenReload(debtService.setDebtArchived),
      deleteDebt: thenReload(debtService.deleteDebt),
      registerDebtPayment: thenReload(debtService.registerDebtPayment),
    };
  }, [mode, setMode, status, error, snapshot, reload, userId]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceData(): FinanceData {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinanceData debe usarse dentro de <FinanceDataProvider>.');
  return value;
}
