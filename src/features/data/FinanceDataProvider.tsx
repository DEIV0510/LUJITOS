/**
 * Fuente única de datos financieros para las pantallas.
 *
 *   mode 'live' (por defecto): cuentas, categorías, movimientos y resumen REALES
 *                              del usuario en Supabase. Los totales vienen
 *                              calculados por PostgreSQL (financial_summary).
 *   mode 'demo':               datos ficticios de src/features/demo, siempre
 *                              marcados como demostración. Nada se guarda.
 *
 * Toda escritura pasa por las funciones RPC del motor financiero y, al terminar,
 * se recargan los datos: el panel, las cuentas y los movimientos quedan al día.
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
import * as transactionService from '@/services/transactions/transactionService';
import type { AccountInput } from '@/services/accounts/accountService';
import type { CategoryInput } from '@/services/categories/categoryService';
import type { ReconcileInput, TransactionInput, WriteOptions } from '@/services/transactions/transactionService';
import type { Account, Category, Transaction } from '@/types/finance';

import { summaryFromAccounts } from './summaries';

export type DataMode = 'live' | 'demo';
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type FinanceData = {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  status: LoadStatus;
  error: string | null;
  /** Todas las cuentas, también las archivadas (isActive = false). */
  accounts: Account[];
  activeAccounts: Account[];
  /** Todas las categorías visibles, también las archivadas. */
  categories: Category[];
  /** Movimientos vigentes (sin anulados). */
  transactions: Transaction[];
  /** Movimientos anulados: se conservan para la trazabilidad. */
  voidedTransactions: Transaction[];
  /** Totales calculados en el servidor. null mientras carga. */
  summary: FinancialSummary | null;
  getAccount: (id: string | undefined) => Account | undefined;
  getCategory: (id: string | undefined) => Category;
  getTransaction: (id: string | undefined) => Transaction | undefined;
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
};

const STORAGE_KEY = 'lujitos.data-mode';
const FinanceContext = createContext<FinanceData | null>(null);

const demoTransactions = [...DEMO_TRANSACTIONS].sort((a, b) =>
  a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
);

const fallbackCategory = CATEGORIES[CATEGORIES.length - 1]!;

type Snapshot = { accounts: Account[]; categories: Category[]; transactions: Transaction[]; summary: FinancialSummary };

/** Lee todo lo del usuario con sesión (el RLS filtra en el servidor). */
async function fetchSnapshot(): Promise<Snapshot> {
  const [accounts, categories, transactions, summary] = await Promise.all([
    accountService.fetchAccounts(),
    categoryService.fetchCategories(),
    transactionService.fetchTransactions(),
    fetchFinancialSummary(),
  ]);
  return { accounts, categories, transactions, summary };
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);

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

  const apply = useCallback((snapshot: Snapshot) => {
    setAccounts(snapshot.accounts);
    setCategories(snapshot.categories);
    setAllTransactions(snapshot.transactions);
    setSummary(snapshot.summary);
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
      .then((snapshot) => {
        if (active) apply(snapshot);
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
        categories: CATEGORIES,
        transactions: demoTransactions,
        voidedTransactions: [],
        summary: summaryFromAccounts(DEMO_ACCOUNTS, demoTransactions, monthKey(nowInBogota().date)),
        getAccount: (id) => DEMO_ACCOUNTS.find((account) => account.id === id),
        getCategory: (id) => (id === 'adjustment' ? ADJUSTMENT_CATEGORY : getDemoCategory(id)),
        getTransaction: (id) => (id ? demoById.get(id) : undefined),
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
      };
    }

    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const transactionsById = new Map(allTransactions.map((transaction) => [transaction.id, transaction]));
    const transactions = allTransactions.filter((transaction) => !transaction.voidedAt);
    const voidedTransactions = allTransactions.filter((transaction) => Boolean(transaction.voidedAt));

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
      categories,
      transactions,
      voidedTransactions,
      summary,
      getAccount: (id) => (id ? accountsById.get(id) : undefined),
      getCategory: (id) => {
        if (id === TRANSFER_CATEGORY.id) return TRANSFER_CATEGORY;
        if (id === ADJUSTMENT_CATEGORY.id) return ADJUSTMENT_CATEGORY;
        return (id && categoriesById.get(id)) || categories.find((c) => c.slug === 'other-out') || fallbackCategory;
      },
      getTransaction: (id) => (id ? transactionsById.get(id) : undefined),
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
    };
  }, [mode, setMode, status, error, accounts, categories, allTransactions, summary, reload, userId]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceData(): FinanceData {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinanceData debe usarse dentro de <FinanceDataProvider>.');
  return value;
}
