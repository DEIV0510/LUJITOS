import { Stack } from 'expo-router';

import { FinanceDataProvider } from '@/features/data/FinanceDataProvider';
import { useAuth } from '@/hooks/auth';
import { useAppTheme } from '@/theme';

/** Zona privada: solo se monta con sesión y onboarding completo (ver src/app/_layout.tsx). */
export default function PrivateLayout() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  return (
    // key: al cambiar de usuario, los datos del anterior se descartan por completo.
    <FinanceDataProvider key={session?.user.id ?? 'sin-sesion'}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="transaction/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="category/edit" options={{ presentation: 'modal' }} />
      </Stack>
    </FinanceDataProvider>
  );
}
