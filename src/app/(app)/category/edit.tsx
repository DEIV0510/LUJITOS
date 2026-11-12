import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { TextField } from '@/components/ui/FormField';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { IconGrid, ToneSwatches } from '@/components/ui/Pickers';
import { ListRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SuccessView } from '@/components/ui/SuccessView';
import { CATEGORY_ICONS, CATEGORY_TONES } from '@/constants/categoryIcons';
import { FormMessage } from '@/features/auth/components';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { screenPadding, useAppTheme, type Tone } from '@/theme';
import type { CategoryKind, IconName } from '@/types/finance';

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
];

/** Crear (/category/edit?kind=expense) o editar (/category/edit?id=…) una categoría propia. */
export default function CategoryEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { categories, transactions, voidedTransactions, createCategory, updateCategory, setCategoryArchived, deleteCategory } =
    useFinanceData();
  const category = params.id ? categories.find((item) => item.id === params.id && !item.isDefault) : undefined;
  const editing = Boolean(category);

  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? (params.kind === 'income' ? 'income' : 'expense'));
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState<IconName>(category?.icon ?? 'tag.fill');
  const [tone, setTone] = useState<Tone>(category?.tone ?? 'sage');
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  if (done) return <SuccessView title={done} message="Ya se ve en tus categorías." />;

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setNameError('Escribe un nombre de 2 a 40 caracteres.');
      haptics.error();
      return;
    }
    const duplicate = categories.some(
      (item) => item.kind === kind && item.id !== category?.id && item.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setNameError('Ya existe una categoría con ese nombre.');
      haptics.error();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (category) await updateCategory(category.id, { name: trimmed, icon, tone });
      else await createCategory({ name: trimmed, kind, icon, tone });
      haptics.success();
      setDone(editing ? 'Categoría actualizada' : 'Categoría creada');
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos guardar la categoría.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async () => {
    if (!category) return;
    try {
      await setCategoryArchived(category.id, !category.archivedAt);
      haptics.success();
      router.back();
    } catch (error) {
      Alert.alert('No se pudo cambiar', errorMessage(error));
    }
  };

  const remove = async (reassignTo?: string) => {
    if (!category) return;
    try {
      await deleteCategory(category.id, reassignTo);
      haptics.success();
      router.back();
    } catch (error) {
      if (isFinanceError(error, 'category_in_use')) {
        const count = error.detailAmount ?? 0;
        Alert.alert(
          'Tiene movimientos',
          `«${category.name}» tiene ${count} ${count === 1 ? 'movimiento' : 'movimientos'}. Para borrarla, elige a qué categoría pasan. También puedes archivarla: deja de ofrecerse y conserva el historial.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Archivar', onPress: () => void toggleArchive() },
            { text: 'Elegir categoría', onPress: () => setReassigning(true) },
          ],
        );
        return;
      }
      Alert.alert('No se pudo borrar', errorMessage(error));
    }
  };

  const confirmDelete = () => {
    if (!category) return;
    const used = [...transactions, ...voidedTransactions].some((t) => t.categoryId === category.id);
    if (used) {
      void remove();
      return;
    }
    Alert.alert('¿Borrar la categoría?', 'No tiene movimientos. Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const targets = categories.filter((item) => item.kind === kind && item.id !== category?.id && !item.archivedAt);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title={editing ? 'Editar categoría' : 'Nueva categoría'} />
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          <View style={[styles.preview, { gap: spacing.md }]}>
            <CategoryIcon category={{ id: 'preview', name, kind, icon, tone }} size={52} />
            <AppText variant="headline" style={styles.flex} numberOfLines={2}>
              {name.trim() || 'Nueva categoría'}
            </AppText>
          </View>

          {editing ? null : <SegmentedControl options={KINDS} value={kind} onChange={setKind} accessibilityLabel="Tipo de categoría" />}

          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <TextField
              label="Nombre"
              placeholder={kind === 'income' ? 'Ej.: Arriendos recibidos' : 'Ej.: Mascotas'}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setNameError(undefined);
              }}
              maxLength={40}
              error={nameError}
            />
          </FinancialCard>

          <View style={{ gap: spacing.md }}>
            <AppText variant="overline" color="textSecondary">
              Color
            </AppText>
            <ToneSwatches value={tone} options={CATEGORY_TONES} onChange={setTone} />
            <AppText variant="overline" color="textSecondary" style={{ marginTop: spacing.sm }}>
              Ícono
            </AppText>
            <IconGrid value={icon} options={CATEGORY_ICONS} tone={tone} onChange={(value) => value && setIcon(value)} />
          </View>

          {category ? (
            <FinancialCard padding={spacing.lg} style={styles.fields}>
              <ListRow
                title={category.archivedAt ? 'Reactivar categoría' : 'Archivar categoría'}
                subtitle={category.archivedAt ? 'Vuelve a ofrecerse en los movimientos' : 'Deja de ofrecerse; su historial se conserva'}
                icon="archivebox"
                onPress={() => void toggleArchive()}
              />
              <ListRow title="Borrar categoría" icon="trash" destructive onPress={confirmDelete} showDivider />
            </FinancialCard>
          ) : null}

          <FormMessage message={submitError} />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border }]}>
          <PrimaryButton label={editing ? 'Guardar cambios' : 'Crear categoría'} size="large" loading={submitting} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet visible={reassigning} title="¿A qué categoría pasan sus movimientos?" onClose={() => setReassigning(false)}>
        {targets.map((option, index) => (
          <ListRow
            key={option.id}
            title={option.name}
            showDivider={index > 0}
            right={<CategoryIcon category={option} size={30} />}
            onPress={() => {
              setReassigning(false);
              void remove(option.id);
            }}
          />
        ))}
      </OptionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  preview: { flexDirection: 'row', alignItems: 'center' },
  fields: { paddingVertical: 4 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
