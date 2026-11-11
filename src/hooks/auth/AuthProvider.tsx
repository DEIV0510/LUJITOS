/**
 * Estado global de autenticación.
 *
 * Estados:
 *   'loading'     comprobando la sesión guardada (se muestra la apertura, nunca el panel)
 *   'signedOut'   sin sesión → bienvenida, registro, inicio de sesión
 *   'signedIn'    sesión válida y perfil cargado → app (u onboarding si falta)
 *   'unconfigured' faltan las variables de Supabase (.env.local)
 * Además, `recovery` marca que el usuario entró por un enlace de recuperación:
 * mientras esté activo solo puede ver la pantalla de nueva contraseña.
 *
 * Nada de la sesión se imprime en consola.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isSupabaseConfigured, startSessionLifecycle, supabase } from '@/lib/supabase';
import { signOut as signOutRequest } from '@/services/auth/authService';
import { fetchProfile, type Profile } from '@/services/database/profile';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured';

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
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const loadedFor = useRef<string | null>(null);

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

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    startSessionLifecycle();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setSessionChecked(true);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(nextSession);
      if (event === 'SIGNED_OUT') {
        loadedFor.current = null;
        setProfile(null);
        setRecovery(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

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
    const result = await signOutRequest();
    // Aunque el servidor no responda, la sesión local se elimina.
    loadedFor.current = null;
    setSession(null);
    setProfile(null);
    setRecovery(false);
    return result.ok ? { ok: true } : { ok: true, message: result.message };
  }, []);

  // Con sesión pero sin perfil todavía se sigue «cargando»: así nunca se ve el
  // panel ni el onboarding antes de saber quién es el usuario.
  const profileReady = profile !== null && profile.id === userId;
  const status: AuthStatus = !isSupabaseConfigured
    ? 'unconfigured'
    : !sessionChecked
      ? 'loading'
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
    }),
    [status, session, profile, profileError, recovery, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return value;
}
