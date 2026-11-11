import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { TextInput } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { InputField } from '@/components/ui/InputField';
import { AuthLayout, Checkbox, FormMessage, PasswordStrengthMeter } from '@/features/auth/components';
import { fieldErrors, signUpSchema } from '@/features/auth/validation';
import { haptics } from '@/lib/haptics';
import { signUp } from '@/services/auth/authService';

type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms';

export default function SignUpScreen() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastNameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const set = (field: Exclude<Field, 'acceptTerms'>) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    setMessage(null);
    const parsed = signUpSchema.safeParse({ ...form, acceptTerms });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.error();
      return;
    }
    setLoading(true);
    const result = await signUp(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setMessage(result.message);
      haptics.error();
      return;
    }
    haptics.success();
    // Si el proyecto exige confirmar el correo, no hay sesión todavía.
    if (result.data.needsConfirmation) {
      router.replace({ pathname: '/check-email', params: { email: parsed.data.email } });
    }
    // Si no lo exige, la sesión ya existe y las rutas protegidas llevan al onboarding.
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Es gratis y solo toma un minuto. No necesitas datos bancarios."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      footer={
        <AppText variant="callout" color="textSecondary" align="center">
          ¿Ya tienes cuenta?{' '}
          <AppText variant="callout" color="primary" onPress={() => router.replace('/sign-in')} suppressHighlighting>
            Inicia sesión
          </AppText>
        </AppText>
      }
    >
      <FormMessage message={message} />
      <InputField
        label="Nombre"
        icon="person.fill"
        value={form.firstName}
        onChangeText={set('firstName')}
        error={errors.firstName}
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
        maxLength={60}
      />
      <InputField
        ref={lastNameRef}
        label="Apellido"
        icon="person.fill"
        value={form.lastName}
        onChangeText={set('lastName')}
        error={errors.lastName}
        autoComplete="family-name"
        textContentType="familyName"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        maxLength={60}
      />
      <InputField
        ref={emailRef}
        label="Correo electrónico"
        icon="envelope.fill"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
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
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules="minlength: 8; required: lower; required: upper; required: digit;"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        maxLength={72}
      />
      <PasswordStrengthMeter password={form.password} />
      <InputField
        ref={confirmRef}
        label="Confirmar contraseña"
        icon="lock.fill"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
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
      <Checkbox
        checked={acceptTerms}
        onChange={(value) => {
          setAcceptTerms(value);
          if (errors.acceptTerms) setErrors((current) => ({ ...current, acceptTerms: undefined }));
        }}
        error={errors.acceptTerms}
      >
        <AppText variant="footnote" color="textSecondary">
          Acepto los{' '}
          <AppText variant="footnote" color="primary" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}>
            términos de uso
          </AppText>{' '}
          y la{' '}
          <AppText variant="footnote" color="primary" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}>
            política de privacidad
          </AppText>
          .
        </AppText>
      </Checkbox>
      <PrimaryButton label="Crear cuenta" size="large" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}
