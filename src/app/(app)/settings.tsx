import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { APP } from '@/constants/app';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { useAuth } from '@/hooks/auth';
import { haptics } from '@/lib/haptics';
import { useAppTheme, type ThemeMode } from '@/theme';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

const MODE_HINT: Record<ThemeMode, string> = {
  system: 'Sigue la apariencia del iPhone.',
  light: 'Fondo marfil y tarjetas blancas.',
  dark: 'Fondos oscuros y acentos en verde salvia.',
};

export default function SettingsScreen() {
  const { colors, spacing, mode, setMode } = useAppTheme();
  const { hidden, toggle } = usePrivacy();
  const { profile, session, signOut } = useAuth();
  const { mode: dataMode, setMode: setDataMode } = useFinanceData();
  const [signingOut, setSigningOut] = useState(false);
  const later = (title: string, phase: string) => Alert.alert(title, `Disponible en la ${phase}.`);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  const confirmSignOut = () => {
    Alert.alert('¿Cerrar sesión?', 'Tendrás que escribir tu correo y contraseña para volver a entrar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          haptics.medium();
          // Limpia la sesión del llavero y el estado; las rutas protegidas llevan a la bienvenida.
          await signOut();
        },
      },
    ]);
  };

  return (
    <Screen header={<ScreenHeader title="Configuración" />}>
      <View>
        <SectionHeader title="Tu cuenta" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="Nombre" value={fullName || '—'} showDivider={false} />
          <InfoRow label="Correo" value={profile?.email ?? session?.user.email ?? '—'} />
          <InfoRow label="Sesión" value="Guardada en el llavero de este iPhone" />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Apariencia" />
        <FinancialCard padding={spacing.lg}>
          <SegmentedControl options={MODES} value={mode} onChange={setMode} accessibilityLabel="Apariencia" />
          <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
            {MODE_HINT[mode]}
          </AppText>
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Privacidad" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <ListRow
            title="Ocultar valores"
            subtitle="Muestra •••• en lugar de los montos"
            icon="eye.slash.fill"
            right={
              <Switch
                value={hidden}
                onValueChange={toggle}
                trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
                thumbColor={colors.surface}
                accessibilityLabel="Ocultar valores"
              />
            }
          />
          <ListRow
            title="Bloqueo con Face ID"
            subtitle="Requiere compilación propia (no funciona en Expo Go)"
            icon="faceid"
            showDivider
            onPress={() => later('Face ID', 'Fase 11')}
          />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Datos de demostración" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <ListRow
            title="Ver datos de ejemplo"
            subtitle="Muestra cómo se verá LUJITOS con meses de información. Son ficticios y no se mezclan con los tuyos."
            icon="sparkles"
            tone="gold"
            right={
              <Switch
                value={dataMode === 'demo'}
                onValueChange={(value) => setDataMode(value ? 'demo' : 'live')}
                trackColor={{ true: colors.accent, false: colors.surfaceMuted }}
                thumbColor={colors.surface}
                accessibilityLabel="Ver datos de ejemplo"
              />
            }
          />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Región" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="País" value={profile?.country === 'CO' ? 'Colombia' : (profile?.country ?? 'Colombia')} showDivider={false} />
          <InfoRow label="Moneda" value="Peso colombiano (COP)" />
          <InfoRow label="Formato" value="$ 1.250.000" />
          <InfoRow label="Zona horaria" value={profile?.timezone ?? APP.timeZone} />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Tus datos" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <ListRow title="Términos de uso" icon="doc.text.fill" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
          <ListRow
            title="Política de privacidad"
            icon="lock.fill"
            showDivider
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
          />
          <ListRow title="Exportar mis datos" icon="square.and.arrow.up" showDivider onPress={() => later('Exportar datos', 'Fase 11')} />
          <ListRow title="Eliminar mis datos" icon="trash" destructive showDivider onPress={() => later('Eliminar datos', 'Fase 11')} />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Acerca de" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="Versión" value={`${APP.name} ${Constants.expoConfig?.version ?? ''}`} showDivider={false} />
          <InfoRow label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? '—'} />
          <InfoRow label="Datos" value={dataMode === 'demo' ? 'Demostración (ficticios)' : 'Tus datos (Supabase)'} />
        </FinancialCard>
      </View>

      <SecondaryButton label={signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'} icon="arrow.uturn.backward" size="large" disabled={signingOut} onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
});
