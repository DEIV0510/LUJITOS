/**
 * Navegación con el router real de Expo Router: abre la app en distintas
 * direcciones y estados de sesión y comprueba a qué pantalla llega.
 * La estructura de rutas replica src/app (grupos (app), (tabs) y (auth), y las
 * pantallas sueltas); el navegador raíz es el componente real AppNavigator.
 * Un router por prueba: el estado global del router no se comparte bien entre
 * varios renderRouter dentro de la misma prueba.
 */
import { Stack } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';

import { AppNavigator } from '@/features/auth/AppNavigator';
import { navigationGuards } from '@/features/auth/navigation';
import type { AuthStatus } from '@/hooks/auth/AuthProvider';

type State = { status: AuthStatus; onboarded: boolean; recovery: boolean };

/** Estado de sesión que la prueba puede cambiar, como lo hace AuthProvider en la app. */
function createSession(initial: State) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: State) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
type Session = ReturnType<typeof createSession>;

const page = (label: string) =>
  function Page() {
    return <Text>{label}</Text>;
  };

function appRoutes(session: Session) {
  function RootLayout() {
    const state = useSyncExternalStore(session.subscribe, session.get);
    const guards = navigationGuards(state);
    // Como src/app/_layout.tsx: mientras se comprueba la sesión no hay navegador.
    if (guards.loading) return null;
    return <AppNavigator guards={guards} background="#000000" />;
  }
  return {
    _layout: RootLayout,
    '(app)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
    // Expo Router 58: las pestañas solo muestran las pantallas declaradas (como en la app real).
    '(app)/(tabs)/_layout': () => (
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" />
      </Tabs>
    ),
    '(app)/(tabs)/index': page('Inicio'),
    '(app)/(tabs)/accounts': page('Cuentas'),
    '(app)/settings': page('Configuración'),
    '(app)/transaction/new': page('Nuevo movimiento'),
    '(auth)/_layout': {
      default: () => <Stack screenOptions={{ headerShown: false }} />,
      unstable_settings: { anchor: 'welcome' },
    },
    '(auth)/welcome': page('Bienvenida'),
    '(auth)/sign-in': page('Iniciar sesión'),
    '(auth)/sign-up': page('Crear cuenta'),
    onboarding: page('Onboarding'),
    'reset-password': page('Nueva contraseña'),
    'auth/callback': page('Confirmando'),
    legal: page('Términos'),
  };
}

const signedOut: State = { status: 'signedOut', onboarded: false, recovery: false };
const newUser: State = { status: 'signedIn', onboarded: false, recovery: false };
const member: State = { status: 'signedIn', onboarded: true, recovery: false };
const recovering: State = { status: 'signedIn', onboarded: true, recovery: true };

type Case = [label: string, state: State, url: string, text: string, pathname: string];

const cases: Case[] = [
  // El fallo visto en el iPhone: sin sesión, «/» mostraba «Unmatched Route».
  ['sin sesión', signedOut, '/', 'Bienvenida', '/welcome'],
  ['sin sesión', signedOut, '/settings', 'Bienvenida', '/welcome'],
  ['sin sesión', signedOut, '/accounts', 'Bienvenida', '/welcome'],
  ['sin sesión', signedOut, '/transaction/new', 'Bienvenida', '/welcome'],
  ['sin sesión', signedOut, '/onboarding', 'Bienvenida', '/welcome'],
  ['sin sesión', signedOut, '/sign-up', 'Crear cuenta', '/sign-up'],
  ['sin sesión', signedOut, '/legal', 'Términos', '/legal'],
  ['usuario nuevo', newUser, '/', 'Onboarding', '/onboarding'],
  ['usuario nuevo', newUser, '/welcome', 'Onboarding', '/onboarding'],
  ['usuario nuevo', newUser, '/settings', 'Onboarding', '/onboarding'],
  ['con sesión', member, '/', 'Inicio', '/'],
  ['con sesión', member, '/welcome', 'Inicio', '/'],
  ['con sesión', member, '/sign-in', 'Inicio', '/'],
  ['con sesión', member, '/onboarding', 'Inicio', '/'],
  ['con sesión', member, '/settings', 'Configuración', '/settings'],
  ['con sesión', member, '/accounts', 'Cuentas', '/accounts'],
  ['recuperando contraseña', recovering, '/', 'Nueva contraseña', '/reset-password'],
  ['recuperando contraseña', recovering, '/settings', 'Nueva contraseña', '/reset-password'],
  ['recuperando contraseña', recovering, '/welcome', 'Nueva contraseña', '/reset-password'],
  ['sin sesión', signedOut, '/auth/callback', 'Confirmando', '/auth/callback'],
  ['usuario nuevo', newUser, '/auth/callback', 'Confirmando', '/auth/callback'],
  ['con sesión', member, '/auth/callback', 'Confirmando', '/auth/callback'],
];

describe('apertura de la app según la sesión (router real)', () => {
  const named = cases.map(([label, state, url, text, pathname]) => ({
    name: `${label}: abrir «${url}» lleva a ${pathname}`,
    state,
    url,
    text,
    pathname,
  }));

  it.each(named)('$name', async ({ state, url, text, pathname }) => {
    const router = await renderRouter(appRoutes(createSession(state)), { initialUrl: url });
    expect(await screen.findByText(text)).toBeTruthy();
    expect(router.getPathname()).toBe(pathname);
    expect(screen.queryByText('Unmatched Route')).toBeNull();
  });
});

describe('cambios de sesión con la app abierta (router real)', () => {
  // Así arranca la app en el iPhone: primero comprueba la sesión (sin navegador)
  // y luego monta las rutas con la dirección del enlace de Expo Go («/»).
  const loading: State = { status: 'loading', onboarded: false, recovery: false };
  it.each([
    ['sin sesión', signedOut, 'Bienvenida', '/welcome'],
    ['usuario nuevo', newUser, 'Onboarding', '/onboarding'],
    ['con sesión', member, 'Inicio', '/'],
  ] as const)('arranque real: comprobando sesión → %s', async (_label, state, text, pathname) => {
    const session = createSession(loading);
    const router = await renderRouter(appRoutes(session), { initialUrl: '/' });
    expect(screen.queryByText('Unmatched Route')).toBeNull();
    await act(async () => session.set(state));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(router.getPathname()).toBe(pathname);
    expect(screen.queryByText('Unmatched Route')).toBeNull();
  });

  it('registro → onboarding → inicio → cerrar sesión', async () => {
    const session = createSession(signedOut);
    const router = await renderRouter(appRoutes(session), { initialUrl: '/' });
    expect(await screen.findByText('Bienvenida')).toBeTruthy();

    // Confirmó el correo: tiene sesión pero no ha hecho el onboarding.
    await act(async () => session.set(newUser));
    expect(await screen.findByText('Onboarding')).toBeTruthy();
    expect(router.getPathname()).toBe('/onboarding');

    await act(async () => session.set(member));
    expect(await screen.findByText('Inicio')).toBeTruthy();
    expect(router.getPathname()).toBe('/');

    await act(async () => session.set(signedOut));
    expect(await screen.findByText('Bienvenida')).toBeTruthy();
    expect(router.getPathname()).toBe('/welcome');
  });

  it('abrir el enlace de recuperación con la app en uso lleva a «Nueva contraseña»', async () => {
    const session = createSession(member);
    const router = await renderRouter(appRoutes(session), { initialUrl: '/settings' });
    expect(await screen.findByText('Configuración')).toBeTruthy();

    await act(async () => session.set(recovering));
    expect(await screen.findByText('Nueva contraseña')).toBeTruthy();
    expect(router.getPathname()).toBe('/reset-password');
  });
});
