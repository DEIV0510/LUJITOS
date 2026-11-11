import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Privacy = { hidden: boolean; toggle: () => void };

const STORAGE_KEY = 'lujitos.hide-amounts';
const PrivacyContext = createContext<Privacy>({ hidden: false, toggle: () => undefined });

/** Oculta o muestra todos los montos de la app (ojo de la tarjeta de patrimonio). */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setHidden(stored === '1'))
      .catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setHidden((previous) => {
      const next = !previous;
      AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): Privacy {
  return useContext(PrivacyContext);
}
