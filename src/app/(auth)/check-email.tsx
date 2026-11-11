import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { resendConfirmation } from '@/services/auth/authService';
import { useAppTheme } from '@/theme';

const COOLDOWN = 60;

/** Confirmación de registro: explica que falta abrir el enlace del correo. */
export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { colors, spacing } = useAppTheme();
  const [seconds, setSeconds] = useState(COOLDOWN);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const resend = async () => {
    if (!email) return;
    const result = await resendConfirmation(email);
    setMessage(result.ok ? { text: 'Te enviamos un correo nuevo.', tone: 'success' } : { text: result.message, tone: 'error' });
    setSeconds(COOLDOWN);
  };

  return (
    <AuthLayout title="Revisa tu correo" subtitle="Tu cuenta quedó creada. Solo falta confirmar tu correo.">
      <FinancialCard padding={spacing.xl}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={[styles.icon, { backgroundColor: colors.positiveSoft }]}>
            <Icon name="envelope.fill" size={20} color={colors.positive} />
          </View>
          <View style={styles.flex}>
            <AppText variant="headline">Enviamos un enlace a</AppText>
            <AppText variant="callout" color="textSecondary" selectable>
              {email ?? 'tu correo'}
            </AppText>
          </View>
        </View>
        <AppText variant="callout" color="textSecondary" style={{ marginTop: spacing.lg }}>
          Ábrelo desde este iPhone: LUJITOS se abrirá con tu sesión iniciada. Si lo abres en otro dispositivo, tu correo
          igual queda confirmado y puedes iniciar sesión con tu contraseña. Revisa también la carpeta de spam.
        </AppText>
      </FinancialCard>
      <FormMessage message={message?.text ?? null} tone={message?.tone} />
      <PrimaryButton label="Ir a iniciar sesión" size="large" onPress={() => router.replace('/sign-in')} />
      <SecondaryButton
        label={seconds > 0 ? `Reenviar correo en ${seconds} s` : 'Reenviar correo'}
        disabled={seconds > 0 || !email}
        onPress={resend}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
