import type { AuthStatus } from '@/hooks/auth/AuthProvider';

export type NavigationGuards = {
  /** Mostrar la apertura (aún no se sabe si hay sesión). */
  loading: boolean;
  /** Zona privada (app): sesión válida + onboarding completo. */
  app: boolean;
  onboarding: boolean;
  /** Bienvenida, registro e inicio de sesión. */
  auth: boolean;
  /** Pantalla de configuración pendiente de Supabase. */
  setup: boolean;
};

/**
 * Decide qué zonas de la app son accesibles. Función pura para poder probarla:
 * nunca hay dos zonas abiertas a la vez y, sin sesión, la zona privada siempre
 * está cerrada.
 */
export function navigationGuards(input: {
  status: AuthStatus;
  onboarded: boolean;
  recovery: boolean;
}): NavigationGuards {
  const { status, onboarded, recovery } = input;
  const signedIn = status === 'signedIn';
  return {
    loading: status === 'loading',
    setup: status === 'unconfigured',
    app: signedIn && onboarded && !recovery,
    onboarding: signedIn && !onboarded && !recovery,
    auth: status === 'signedOut' && !recovery,
  };
}
