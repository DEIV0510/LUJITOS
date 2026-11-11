import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { InputField } from '@/components/ui/InputField';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { fieldErrors, resetRequestSchema } from '@/features/auth/validation';
import { haptics } from '@/lib/haptics';
import { requestPasswordReset } from '@/services/auth/authService';

/** Paso 1 de la recuperación: pedir el enlace por correo. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setMessage(null);
    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      haptics.error();
      return;
    }
    setLoading(true);
    const result = await requestPasswordReset(parsed.data.email);
    setLoading(false);
    if (!result.ok) {
      setMessage({ text: result.message, tone: 'error' });
      haptics.error();
      return;
    }
    haptics.success();
    setSent(true);
    setMessage({
      text: 'Si existe una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Ábrelo desde este iPhone.',
      tone: 'success',
    });
  };

  return (
    <AuthLayout
      title="Recupera tu acceso"
      subtitle="Te enviaremos un enlace seguro a tu correo."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
    >
      <FormMessage message={message?.text ?? null} tone={message?.tone} />
      <InputField
        label="Correo electrónico"
        icon="envelope.fill"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(undefined);
        }}
        error={error}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={submit}
        maxLength={254}
      />
      <PrimaryButton label={sent ? 'Enviar de nuevo' : 'Enviar enlace'} size="large" loading={loading} onPress={submit} />
      {sent ? <SecondaryButton label="Volver a iniciar sesión" onPress={() => router.replace('/sign-in')} /> : null}
    </AuthLayout>
  );
}
