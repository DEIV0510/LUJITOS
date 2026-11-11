import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { ACCOUNT_KIND_LABEL, INSTITUTIONS } from '@/constants/institutions';
import { FormMessage } from '@/features/auth/components';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import type { Money } from '@/lib/money';
import { screenPadding, useAppTheme } from '@/theme';
import type { AccountKind, InstitutionId } from '@/types/finance';

const KINDS: AccountKind[] = ['savings', 'checking', 'bank', 'digital_wallet', 'cash', 'investment', 'credit_card', 'other'];

export default function NewAccountScreen() {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [institutionId, setInstitutionId] = useState<InstitutionId | null>(null);
  const [kind, setKind] = useState<AccountKind | null>(null);
  const [initial, setInitial] = useState<Money>(0);
  const [lastFour, setLastFour] = useState('');
  const [sheet, setSheet] = useState<'institution' | 'kind' | null>(null);
  const [errors, setErrors] = useState<{ name?: string; institution?: string; kind?: string; lastFour?: string }>({});
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mode, createAccount } = useFinanceData();
  const isDemo = mode === 'demo';

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1300);
    return () => clearTimeout(timer);
  }, [saved]);

  const institution = institutionId ? INSTITUTIONS[institutionId] : null;

  const save = async () => {
    setSubmitError(null);
    const found = {
      name: name.trim().length < 2 ? 'Escribe un nombre para la cuenta.' : undefined,
      institution: institutionId ? undefined : 'Elige la entidad.',
      kind: kind ? undefined : 'Elige el tipo de cuenta.',
      lastFour: lastFour && lastFour.length !== 4 ? 'Deben ser exactamente 4 dígitos.' : undefined,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      haptics.error();
      return;
    }
    if (!isDemo && institutionId && kind) {
      setSubmitting(true);
      try {
        await createAccount({
          name: name.trim(),
          institution: institutionId,
          kind,
          // Una tarjeta con saldo usado es una deuda: se guarda en negativo.
          initialBalance: kind === 'credit_card' ? -Math.abs(initial) : initial,
          lastFour: lastFour || undefined,
        });
      } catch (error) {
        haptics.error();
        setSubmitError(error instanceof Error ? error.message : 'No pudimos guardar la cuenta.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    haptics.success();
    setSaved(true);
  };

  if (saved) {
    return (
      <View style={[styles.root, styles.saved, { backgroundColor: colors.background }]}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.check, { backgroundColor: colors.positiveSoft }]}>
          <Icon name="checkmark" size={34} color={colors.positive} weight="bold" />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title" align="center">
            {isDemo ? 'Cuenta validada' : 'Cuenta creada'}
          </AppText>
          <AppText variant="callout" color="textSecondary" align="center" style={styles.savedText}>
            {isDemo ? 'Modo demostración: no se guardó nada.' : 'Ya aparece en tu panel y en Mis cuentas.'}
          </AppText>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title="Nueva cuenta" />
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <TextField
              label="Nombre"
              placeholder="Ej.: Ahorros nómina"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
              maxLength={40}
              error={errors.name}
            />
            <SelectField
              label="Entidad"
              placeholder="Elegir entidad"
              value={institution?.name}
              leading={institution ? <InstitutionBadge institution={institution} size={34} /> : undefined}
              onPress={() => setSheet('institution')}
              error={errors.institution}
              showDivider
            />
            <SelectField
              label="Tipo"
              placeholder="Elegir tipo de cuenta"
              value={kind ? ACCOUNT_KIND_LABEL[kind] : undefined}
              onPress={() => setSheet('kind')}
              error={errors.kind}
              showDivider
            />
            <TextField
              label="Últimos 4 dígitos (opcional)"
              placeholder="0000"
              value={lastFour}
              onChangeText={(text) => {
                setLastFour(text.replace(/\D/g, '').slice(0, 4));
                if (errors.lastFour) setErrors((current) => ({ ...current, lastFour: undefined }));
              }}
              keyboardType="number-pad"
              maxLength={4}
              error={errors.lastFour}
              showDivider
            />
            <InfoRow label="Moneda" value="COP · peso colombiano" />
          </FinancialCard>

          <MoneyInput label={kind === 'credit_card' ? 'Saldo usado hoy (deuda)' : 'Saldo actual'} value={initial} onChange={setInitial} />

          <AppText variant="footnote" color="textSecondary">
            Nunca te pediremos la contraseña de tu banco ni el número completo de tus tarjetas. El saldo actual se calculará a partir
            del saldo inicial y de los movimientos que registres.
          </AppText>

          <FormMessage message={submitError} />
          {isDemo ? <DemoNotice text="Modo demostración: la cuenta se valida pero no se guarda." /> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border }]}>
          <PrimaryButton label="Guardar cuenta" size="large" loading={submitting} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet visible={sheet === 'institution'} title="Entidad" onClose={() => setSheet(null)}>
        {Object.values(INSTITUTIONS).map((option, index) => (
          <ListRow
            key={option.id}
            title={option.name}
            showDivider={index > 0}
            right={<InstitutionBadge institution={option} size={30} />}
            onPress={() => {
              setInstitutionId(option.id);
              if (errors.institution) setErrors((current) => ({ ...current, institution: undefined }));
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'kind'} title="Tipo de cuenta" onClose={() => setSheet(null)}>
        {KINDS.map((option, index) => (
          <ListRow
            key={option}
            title={ACCOUNT_KIND_LABEL[option]}
            showDivider={index > 0}
            onPress={() => {
              setKind(option);
              if (errors.kind) setErrors((current) => ({ ...current, kind: undefined }));
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fields: { paddingVertical: 4 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  saved: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  check: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  savedText: { maxWidth: 300 },
});
