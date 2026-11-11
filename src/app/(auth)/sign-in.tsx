import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { InputField } from '@/components/ui/InputField';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { fieldErrors, signInSchema } from '@/features/auth/validation';
import { haptics } from '@/lib/haptics';
import { resendConfirmation, signIn } from '@/services/auth/authService';
import { useAppTheme } from '@/theme';

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    setMessage(null);
    setUnconfirmed(false);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.error();
      return;
    }
    setLoading(true);
    const result = await signIn({ ...parsed.data, remember });
    setLoading(false);
    if (!result.ok) {
      haptics.error();
      setMessage({ text: result.message, tone: 'error' });
      setUnconfirmed(result.message.includes('confirmas tu correo'));
      return;
    }
    haptics.success();
    // Las rutas protegidas llevan al panel (o al onboarding si falta).
  };

  const resend = async () => {
    const parsed = signInSchema.shape.email.safeParse(email);
    if (!parsed.success) return;
    const result = await resendConfirmation(parsed.data);
    setMessage(result.ok ? { text: 'Te enviamos un nuevo correo de confirmación.', tone: 'success' } : { text: result.message, tone: 'error' });
  };

  return (
    <AuthLayout
      title="Hola de nuevo"
      subtitle="Inicia sesión para ver tus finanzas."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      footer={
        <AppText variant="callout" color="textSecondary" align="center">
          ¿No tienes cuenta?{' '}
          <AppText variant="callout" color="primary" onPress={() => router.replace('/sign-up')} suppressHighlighting>
            Créala aquí
          </AppText>
        </AppText>
      }
    >
      <FormMessage message={message?.text ?? null} tone={message?.tone} />
      {unconfirmed ? <SecondaryButton label="Reenviar correo de confirmación" icon="envelope.fill" onPress={resend} /> : null}
      <InputField
        label="Correo electrónico"
        icon="envelope.fill"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={errors.email}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        maxLength={254}
      />
      <InputField
        ref={passwordRef}
        label="Contraseña"
        icon="lock.fill"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        secureToggle
        autoComplete="current-password"
        textContentType="password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={72}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: remember }}
          onPress={() => setRemember((value) => !value)}
          style={styles.remember}
        >
          <Switch
            value={remember}
            onValueChange={setRemember}
            trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
            thumbColor={colors.surface}
            accessibilityLabel="Recordar sesión"
          />
          <AppText variant="subhead">Recordar sesión</AppText>
        </Pressable>
        <AppText
          variant="subhead"
          color="primary"
          onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
          suppressHighlighting
          accessibilityRole="link"
        >
          ¿Olvidaste tu contraseña?
        </AppText>
      </View>
      <PrimaryButton label="Iniciar sesión" size="large" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
