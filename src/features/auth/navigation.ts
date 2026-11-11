import type { AuthStatus } from '@/hooks/auth/AuthProvider';

/** Pantalla a la que se envía al usuario cuando abre una zona que no le corresponde. */
export type HomeRoute = '/' | '/welcome' | '/onboarding' | '/reset-password';

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
  /**
   * Destino de toda zona cerrada. Debe ser una ruta concreta: si se deja al
   * router, elige el grupo «/(auth)», que no tiene pantalla índice, y muestra
   * «Unmatched Route» al abrir la app sin sesión.
   */
  home: HomeRoute;
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
  let home: HomeRoute = '/welcome';
  if (recovery) home = '/reset-password';
  else if (signedIn) home = onboarded ? '/' : '/onboarding';
  return {
    loading: status === 'loading',
    setup: status === 'unconfigured',
    app: signedIn && onboarded && !recovery,
    onboarding: signedIn && !onboarded && !recovery,
    auth: status === 'signedOut' && !recovery,
    home,
  };
}
