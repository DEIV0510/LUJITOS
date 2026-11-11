/** Pantallas de estado fuera del flujo normal: configuración pendiente y perfil sin cargar. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { useAuth } from '@/hooks/auth';
import { useAppTheme } from '@/theme';

import { AuthLayout } from './components';

/** Se muestra si faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. */
export function SetupRequiredScreen() {
  const { spacing } = useAppTheme();
  const steps = [
    'Crea el proyecto en supabase.com (ver docs/SUPABASE.md).',
    'Copia .env.example como .env.local en la carpeta del proyecto.',
    'Pega la URL del proyecto y la clave publicable (Project Settings → API).',
    'Reinicia Expo: npm run start:tunnel',
  ];
  return (
    <AuthLayout title="Falta conectar Supabase" subtitle="LUJITOS necesita su base de datos para crear cuentas y guardar tus datos.">
      <FinancialCard padding={spacing.xl}>
        <View style={{ gap: spacing.md }}>
          {steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <AppText variant="headline" color="primary" style={styles.number}>
                {index + 1}
              </AppText>
              <AppText variant="callout" color="textSecondary" style={styles.flex}>
                {step}
              </AppText>
            </View>
          ))}
        </View>
      </FinancialCard>
      <AppText variant="footnote" color="textTertiary">
        Solo se usan datos públicos. La clave secreta (service_role) nunca va en la app.
      </AppText>
    </AuthLayout>
  );
}

/** Hay sesión pero no se pudo leer el perfil (por ejemplo, sin internet). */
export function ProfileErrorScreen({ message }: { message: string }) {
  const { refreshProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  return (
    <AuthLayout title="No pudimos cargar tu perfil" subtitle={message}>
      <PrimaryButton
        label="Reintentar"
        size="large"
        loading={retrying}
        onPress={async () => {
          setRetrying(true);
          await refreshProfile();
          setRetrying(false);
        }}
      />
      <SecondaryButton label="Cerrar sesión" onPress={() => void signOut()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  number: { width: 20 },
  flex: { flex: 1 },
});
