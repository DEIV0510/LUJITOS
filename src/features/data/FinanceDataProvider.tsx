/**
 * Fuente única de datos financieros para las pantallas.
 *
 *   mode 'live' (por defecto): cuentas, categorías y movimientos REALES del
 *                              usuario en Supabase.
 *   mode 'demo':               datos ficticios de src/features/demo, siempre
 *                              marcados como demostración.
 *
 * Los datos ficticios nunca se mezclan con los reales ni se muestran como
 * saldos del usuario registrado.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CATEGORIES, getCategory as getDemoCategory, TRANSFER_CATEGORY } from '@/constants/categories';
import { ADJUSTMENT_CATEGORY } from '@/constants/transactions';
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from '@/features/demo/data';
import { useAuth } from '@/hooks/auth';
import {
  archiveAccount as archiveAccountRequest,
  createAccount as createAccountRequest,
  createTransaction as createTransactionRequest,
  deleteTransaction as deleteTransactionRequest,
  fetchAccounts,
  fetchCategories,
  fetchTransactions,
  type NewAccountInput,
  type NewTransactionInput,
} from '@/services/database/finance';
import type { Account, Category, Transaction } from '@/types/finance';

export type DataMode = 'live' | 'demo';
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type FinanceData = {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  status: LoadStatus;
  error: string | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  getAccount: (id: string | undefined) => Account | undefined;
  getCategory: (id: string | undefined) => Category;
  reload: () => Promise<void>;
  createAccount: (input: NewAccountInput) => Promise<void>;
  archiveAccount: (id: string) => Promise<void>;
  createTransaction: (input: NewTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
};

const STORAGE_KEY = 'lujitos.data-mode';
const FinanceContext = createContext<FinanceData | null>(null);

const demoTransactions = [...DEMO_TRANSACTIONS].sort((a, b) =>
  a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
);

const fallbackCategory = CATEGORIES[CATEGORIES.length - 1]!;

type Snapshot = { accounts: Account[]; categories: Category[]; transactions: Transaction[] };

/** Lee todo lo del usuario con sesión (el RLS filtra en el servidor). */
async function fetchSnapshot(): Promise<Snapshot> {
  const [accounts, categories, transactions] = await Promise.all([fetchAccounts(), fetchCategories(), fetchTransactions()]);
  return { accounts, categories, transactions };
}

function demoOnly(): Promise<void> {
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
    setTransactions(snapshot.transactions);
    setError(null);
    setStatus('ready');
  }, []);

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus datos.');
    setStatus('error');
  }, []);

  /** Recarga manual (reintentar, después de guardar). */
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
      return {
        mode,
        setMode,
        status: 'ready',
        error: null,
        accounts: DEMO_ACCOUNTS,
        categories: CATEGORIES,
        transactions: demoTransactions,
        getAccount: (id) => DEMO_ACCOUNTS.find((account) => account.id === id),
        getCategory: (id) =>
          id === 'adjustment' ? ADJUSTMENT_CATEGORY : getDemoCategory(id),
        reload: async () => undefined,
        createAccount: demoOnly,
        archiveAccount: demoOnly,
        createTransaction: demoOnly,
        deleteTransaction: demoOnly,
      };
    }
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const withReload =
      <T,>(action: (input: T) => Promise<void>) =>
      async (input: T) => {
        await action(input);
        await reload();
      };
    return {
      mode,
      setMode,
      status,
      error,
      accounts,
      categories,
      transactions,
      getAccount: (id) => (id ? accountsById.get(id) : undefined),
      getCategory: (id) => {
        if (id === TRANSFER_CATEGORY.id) return TRANSFER_CATEGORY;
        if (id === ADJUSTMENT_CATEGORY.id) return ADJUSTMENT_CATEGORY;
        return (id && categoriesById.get(id)) || categories.find((c) => c.slug === 'other-out') || fallbackCategory;
      },
      reload,
      createAccount: withReload(createAccountRequest),
      archiveAccount: withReload(archiveAccountRequest),
      createTransaction: withReload(createTransactionRequest),
      deleteTransaction: withReload(deleteTransactionRequest),
    };
  }, [mode, setMode, status, error, accounts, categories, transactions, reload]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceData(): FinanceData {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinanceData debe usarse dentro de <FinanceDataProvider>.');
  return value;
}
