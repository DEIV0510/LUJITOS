/**
 * Paso 2 de la recuperación: el enlace del correo abre esta pantalla con un
 * código de un solo uso (PKCE). Se canjea por una sesión temporal de
 * recuperación y el usuario define su contraseña nueva. Mientras tanto, las
 * rutas protegidas quedan bloqueadas (estado «recuperación»).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { InputField } from '@/components/ui/InputField';
import { LoadingState } from '@/components/ui/States';
import { AuthLayout, FormMessage, PasswordStrengthMeter } from '@/features/auth/components';
import { fieldErrors, newPasswordSchema } from '@/features/auth/validation';
import { useAuth } from '@/hooks/auth';
import { haptics } from '@/lib/haptics';
import { completeAuthRedirect, updatePassword, type RedirectParams } from '@/services/auth/authService';

type Stage = 'verifying' | 'form' | 'done' | 'error';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<RedirectParams & Record<string, string>>();
  const { setRecovery, signOut, session } = useAuth();
  const [stage, setStage] = useState<Stage>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setRecovery(true);
    completeAuthRedirect(params).then((result) => {
      if (result.ok) {
        setStage('form');
      } else {
        setMessage(result.message);
        setStage('error');
      }
    });
    // Solo al abrir el enlace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = async () => {
    setRecovery(false);
    if (session) await signOut();
    router.replace('/forgot-password');
  };

  const submit = async () => {
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.error();
      return;
    }
    setLoading(true);
    const result = await updatePassword(parsed.data.password);
    setLoading(false);
    if (!result.ok) {
      setMessage(result.message);
      haptics.error();
      return;
    }
    haptics.success();
    setStage('done');
  };

  if (stage === 'verifying') {
    return (
      <AuthLayout title="Verificando enlace" subtitle="Un momento…">
        <LoadingState rows={2} label="Verificando el enlace de recuperación" />
      </AuthLayout>
    );
  }

  if (stage === 'error') {
    return (
      <AuthLayout title="El enlace no funcionó" subtitle="Pide uno nuevo desde la app.">
        <FormMessage message={message} />
        <PrimaryButton label="Pedir otro enlace" size="large" onPress={leave} />
      </AuthLayout>
    );
  }

  if (stage === 'done') {
    return (
      <AuthLayout title="Contraseña actualizada" subtitle="Ya puedes usar tu contraseña nueva.">
        <FormMessage message="Tu contraseña se cambió correctamente." tone="success" />
        <PrimaryButton
          label="Entrar a LUJITOS"
          size="large"
          onPress={() => {
            setRecovery(false);
            router.replace('/');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña que no uses en otras apps.">
      <FormMessage message={message} />
      <InputField
        label="Contraseña nueva"
        icon="lock.fill"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={72}
      />
      <PasswordStrengthMeter password={password} />
      <InputField
        label="Confirmar contraseña"
        icon="lock.fill"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setErrors((current) => ({ ...current, confirmPassword: undefined }));
        }}
        error={errors.confirmPassword}
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={72}
      />
      <PrimaryButton label="Guardar contraseña" size="large" loading={loading} onPress={submit} />
      <SecondaryButton label="Cancelar" onPress={leave} />
    </AuthLayout>
  );
}
