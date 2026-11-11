/**
 * Estado global de autenticación.
 *
 * Estados:
 *   'loading'     comprobando la sesión guardada (se muestra la apertura, nunca el panel)
 *   'signedOut'   sin sesión → bienvenida, registro, inicio de sesión
 *   'signedIn'    sesión válida y perfil cargado → app (u onboarding si falta)
 *   'offline'     hay sesión guardada pero no se pudo renovar por falta de red:
 *                 se conserva y se ofrece reintentar (no se manda a la bienvenida)
 *   'unconfigured' faltan las variables de Supabase (.env.local)
 * Además, `recovery` marca que el usuario entró por un enlace de recuperación:
 * mientras esté activo solo puede ver la pantalla de nueva contraseña.
 * `notice` explica por qué se volvió a la bienvenida («Tu sesión terminó…»)
 * cuando la sesión venció o se revocó sin que el usuario cerrara sesión.
 *
 * Nada de la sesión se imprime en consola.
 */
import type { AuthError, Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { logError } from '@/lib/logger';
import { isSupabaseConfigured, startSessionLifecycle, supabase } from '@/lib/supabase';
import { isNetworkAuthError, SESSION_EXPIRED_MESSAGE } from '@/services/auth/authErrors';
import { signOut as signOutRequest } from '@/services/auth/authService';
import { fetchProfile, type Profile } from '@/services/database/profile';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'offline' | 'unconfigured';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  /** Error al cargar el perfil (por ejemplo, sin conexión). La sesión se conserva. */
  profileError: string | null;
  recovery: boolean;
  setRecovery: (value: boolean) => void;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<{ ok: boolean; message?: string }>;
  /** Aviso para la bienvenida/inicio de sesión (sesión vencida). */
  notice: string | null;
  clearNotice: () => void;
  /** Vuelve a comprobar la sesión guardada (pantalla «Sin conexión»). */
  retrySession: () => Promise<void>;
};

type SessionResult = { data: { session: Session | null }; error: AuthError | null };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const hadSession = useRef(false);
  const signingOut = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const next = await fetchProfile(userId);
      loadedFor.current = userId;
      setProfile(next);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'No pudimos cargar tu perfil.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /** Aplica el resultado de recuperar la sesión guardada al abrir la app (o al reintentar). */
  const applyStoredSession = useCallback(({ data, error }: SessionResult) => {
    if (error) logError('auth.restoreSession', error);
    if (!data.session && error && isNetworkAuthError(error)) {
      // La sesión sigue guardada en el llavero: no se borra ni se manda a la bienvenida.
      setOffline(true);
    } else {
      setOffline(false);
      // Había sesión pero el servidor ya no la acepta (venció o se revocó).
      if (!data.session && error) setNotice(SESSION_EXPIRED_MESSAGE);
      hadSession.current = Boolean(data.session);
      setSession(data.session);
    }
    setSessionChecked(true);
  }, []);

  const failStoredSession = useCallback((error: unknown) => {
    logError('auth.restoreSession', error);
    setSession(null);
    setSessionChecked(true);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    startSessionLifecycle();
    let active = true;

    supabase.auth.getSession().then(
      (result) => {
        if (active) applyStoredSession(result);
      },
      (error: unknown) => {
        if (active) failStoredSession(error);
      },
    );

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN') setNotice(null);
      if (nextSession) setOffline(false);
      setSession(nextSession);
      if (event === 'SIGNED_OUT') {
        // Cerrada por Supabase (token revocado o vencido), no por el usuario.
        if (hadSession.current && !signingOut.current) setNotice(SESSION_EXPIRED_MESSAGE);
        loadedFor.current = null;
        setProfile(null);
        setRecovery(false);
      }
      hadSession.current = Boolean(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applyStoredSession, failStoredSession]);

  const retrySession = useCallback(async () => {
    try {
      applyStoredSession(await supabase.auth.getSession());
    } catch (error) {
      failStoredSession(error);
    }
  }, [applyStoredSession, failStoredSession]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    if (loadedFor.current === userId) return;
    // Fuera del callback de onAuthStateChange: Supabase recomienda no llamar
    // a la API dentro de él para evitar bloqueos.
    const timer = setTimeout(() => {
      void loadProfile(userId);
    }, 0);
    return () => clearTimeout(timer);
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      const result = await signOutRequest();
      // Aunque el servidor no responda, la sesión local se elimina.
      loadedFor.current = null;
      hadSession.current = false;
      setSession(null);
      setProfile(null);
      setRecovery(false);
      setOffline(false);
      setNotice(null);
      return result.ok ? { ok: true } : { ok: true, message: result.message };
    } finally {
      signingOut.current = false;
    }
  }, []);

  // Con sesión pero sin perfil todavía se sigue «cargando»: así nunca se ve el
  // panel ni el onboarding antes de saber quién es el usuario.
  const profileReady = profile !== null && profile.id === userId;
  const status: AuthStatus = !isSupabaseConfigured
    ? 'unconfigured'
    : !sessionChecked
      ? 'loading'
      : offline && !session
        ? 'offline'
        : !session
          ? 'signedOut'
          : profileReady || (profileError !== null && !profileLoading)
            ? 'signedIn'
            : 'loading';

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      profile,
      profileError,
      recovery,
      setRecovery,
      refreshProfile,
      setProfile,
      signOut,
      notice,
      clearNotice,
      retrySession,
    }),
    [status, session, profile, profileError, recovery, refreshProfile, signOut, notice, clearNotice, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return value;
}
