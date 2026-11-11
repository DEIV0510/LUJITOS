import { Stack } from 'expo-router';

import type { NavigationGuards } from './navigation';

/**
 * Navegador raíz. Cada zona cerrada redirige a `guards.home` (la pantalla que
 * corresponde al estado de la sesión), también cuando la app se abre con una
 * dirección de esa zona: «/» sin sesión lleva a la bienvenida.
 * Separado de src/app/_layout.tsx para probarlo con el router real
 * (tests/unit/navigation-router.test.tsx).
 */
export function AppNavigator({ guards, background }: { guards: NavigationGuards; background: string }) {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Protected guard={guards.app} redirectTo={guards.home}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.onboarding} redirectTo={guards.home}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={guards.auth} redirectTo={guards.home}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      {/* Destinos de los enlaces de correo: accesibles en cualquier estado. */}
      <Stack.Screen name="reset-password" options={{ gestureEnabled: false }} />
      <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
      <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
