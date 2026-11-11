/**
 * Onboarding (solo la primera vez): bienvenida, nombre, país y moneda,
 * cómo se registran las cuentas y entrada al panel. No pide datos bancarios.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { InputField } from '@/components/ui/InputField';
import { InfoRow } from '@/components/ui/Rows';
import { FormMessage } from '@/features/auth/components';
import { fieldErrors, profileNamesSchema } from '@/features/auth/validation';
import { useAuth } from '@/hooks/auth';
import { haptics } from '@/lib/haptics';
import { completeOnboarding } from '@/services/database/profile';
import { palette, screenPadding, useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

const STEPS = 5;

export default function OnboardingScreen() {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, session } = useAuth();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = () => {
    if (step === 1) {
      const parsed = profileNamesSchema.safeParse({ firstName, lastName });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        haptics.error();
        return;
      }
    }
    haptics.selection();
    setStep((current) => Math.min(current + 1, STEPS - 1));
  };

  const finish = async () => {
    if (!session) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await completeOnboarding(session.user.id, {
        firstName,
        lastName,
        country: 'CO',
        currency: 'COP',
        timezone: 'America/Bogota',
      });
      haptics.success();
      // Al marcarse el onboarding como completado, las rutas protegidas abren el panel.
      setProfile(updated);
    } catch (error) {
      haptics.error();
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: screenPadding,
            gap: spacing.xxl,
          }}
        >
          <View style={styles.progress} accessibilityLabel={`Paso ${step + 1} de ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, index) => (
              <View
                key={index}
                style={[styles.dot, { backgroundColor: index <= step ? colors.primary : colors.surfaceMuted, flex: index === step ? 2 : 1 }]}
              />
            ))}
          </View>

          <Animated.View key={step} entering={FadeInRight.duration(320)} style={[styles.body, { gap: spacing.lg }]}>
            {step === 0 ? (
              <>
                <View style={[styles.mark, { backgroundColor: palette.forest }]}>
                  <LogoMark size={44} />
                </View>
                <AppText variant="largeTitle">Bienvenido a LUJITOS{profile?.first_name ? `, ${profile.first_name}` : ''}</AppText>
                <AppText variant="body" color="textSecondary">
                  Vamos a dejar todo listo en cuatro pasos cortos. Después podrás registrar tus cuentas y tus movimientos.
                </AppText>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <AppText variant="largeTitle">¿Cómo te llamas?</AppText>
                <AppText variant="body" color="textSecondary">
                  Así te saludaremos en la app. Puedes cambiarlo después.
                </AppText>
                <InputField
                  label="Nombre"
                  icon="person.fill"
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    setErrors((current) => ({ ...current, firstName: undefined }));
                  }}
                  error={errors.firstName}
                  autoCapitalize="words"
                  textContentType="givenName"
                  maxLength={60}
                />
                <InputField
                  label="Apellido"
                  icon="person.fill"
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    setErrors((current) => ({ ...current, lastName: undefined }));
                  }}
                  error={errors.lastName}
                  autoCapitalize="words"
                  textContentType="familyName"
                  maxLength={60}
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <AppText variant="largeTitle">País y moneda</AppText>
                <AppText variant="body" color="textSecondary">
                  LUJITOS está pensado para Colombia: montos en pesos, sin decimales, y fechas en hora de Bogotá.
                </AppText>
                <FinancialCard padding={spacing.lg} style={styles.list}>
                  <InfoRow label="País" value="Colombia" showDivider={false} />
                  <InfoRow label="Moneda" value="Peso colombiano (COP)" />
                  <InfoRow label="Formato" value="$ 1.250.000" />
                  <InfoRow label="Zona horaria" value="America/Bogota" />
                </FinancialCard>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <AppText variant="largeTitle">Tus cuentas, a tu ritmo</AppText>
                <Point icon="hand.tap.fill" title="Registro manual" text="Agrega tus cuentas con su saldo actual: bancos, billeteras, efectivo, tarjetas o inversiones." />
                <Point icon="link" title="Conexiones más adelante" text="Cuando estén disponibles, podrás conectar entidades compatibles. Será opcional." />
                <Point icon="lock.fill" title="Nada de claves bancarias" text="Nunca te pediremos la contraseña de tu banco ni el número completo de tus tarjetas." />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <View style={[styles.check, { backgroundColor: colors.positiveSoft }]}>
                  <Icon name="checkmark" size={30} color={colors.positive} weight="bold" />
                </View>
                <AppText variant="largeTitle">Todo listo, {firstName.trim() || 'bienvenido'}</AppText>
                <AppText variant="body" color="textSecondary">
                  Empieza agregando tu primera cuenta desde el panel. Tus datos son privados: solo tú puedes verlos.
                </AppText>
                <FormMessage message={message} />
              </>
            ) : null}
          </Animated.View>

          <View style={{ gap: spacing.md }}>
            {step < STEPS - 1 ? (
              <PrimaryButton label={step === 0 ? 'Empezar' : 'Continuar'} size="large" onPress={next} />
            ) : (
              <PrimaryButton label="Entrar a LUJITOS" size="large" loading={saving} onPress={finish} />
            )}
            {step > 0 && step < STEPS ? (
              <SecondaryButton label="Atrás" onPress={() => setStep((current) => Math.max(current - 1, 0))} disabled={saving} />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.point}>
      <View style={[styles.pointIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="callout" color="textSecondary">
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6 },
  dot: { height: 5, borderRadius: 3 },
  body: { flex: 1 },
  mark: { width: 76, height: 76, borderRadius: 22, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  check: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pointIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
