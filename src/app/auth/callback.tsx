/**
 * Destino del enlace de confirmación de correo. Canjea el código PKCE por una
 * sesión; luego las rutas protegidas llevan al onboarding.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { PrimaryButton } from '@/components/ui/Buttons';
import { LoadingState } from '@/components/ui/States';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { completeAuthRedirect, type RedirectParams } from '@/services/auth/authService';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<RedirectParams & Record<string, string>>();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeAuthRedirect(params).then((result) => {
      if (result.ok) router.replace('/');
      else setError(result.message);
    });
    // Solo al abrir el enlace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) {
    return (
      <AuthLayout title="Confirmando tu correo" subtitle="Un momento…">
        <LoadingState rows={2} label="Confirmando tu correo" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Casi listo" subtitle="No pudimos abrir tu sesión desde el enlace.">
      <FormMessage message={error} />
      <PrimaryButton label="Iniciar sesión" size="large" onPress={() => router.replace('/sign-in')} />
    </AuthLayout>
  );
}
