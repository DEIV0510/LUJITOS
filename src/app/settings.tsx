import Constants from 'expo-constants';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { APP } from '@/constants/app';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
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
  const later = (title: string, phase: string) => Alert.alert(title, `Disponible en la ${phase}.`);

  return (
    <Screen header={<ScreenHeader title="Configuración" />}>
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
          <ListRow title="Bloqueo con Face ID" subtitle="Requiere compilación propia (no funciona en Expo Go)" icon="faceid" showDivider onPress={() => later('Face ID', 'Fase 3')} />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Región" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="País" value="Colombia" showDivider={false} />
          <InfoRow label="Moneda" value="Peso colombiano (COP)" />
          <InfoRow label="Formato" value="$ 1.250.000" />
          <InfoRow label="Zona horaria" value={APP.timeZone} />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Tus datos" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <ListRow title="Exportar mis datos" icon="square.and.arrow.up" onPress={() => later('Exportar datos', 'Fase 11')} />
          <ListRow title="Eliminar mis datos" icon="trash" destructive showDivider onPress={() => later('Eliminar datos', 'Fase 11')} />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Acerca de" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="Versión" value={`${APP.name} ${Constants.expoConfig?.version ?? ''}`} showDivider={false} />
          <InfoRow label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? '—'} />
          <InfoRow label="Datos" value="Demostración (ficticios)" />
        </FinancialCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
});
