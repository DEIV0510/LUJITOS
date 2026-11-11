import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { resolveTone, useAppTheme } from '@/theme';
import type { Category, Institution } from '@/types/finance';

type CategoryIconProps = { category: Category; size?: number };

/** Ícono de categoría sobre un fondo suave de su tono. */
export function CategoryIcon({ category, size = 42 }: CategoryIconProps) {
  const { scheme } = useAppTheme();
  const tone = resolveTone(category.tone, scheme);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: tone.soft }]}
    >
      <Icon name={category.icon} size={size * 0.44} color={tone.ink} />
    </View>
  );
}

type InstitutionBadgeProps = { institution: Institution; size?: number };

/**
 * Identificador visual de cada entidad: iniciales o ícono sobre un tono de la paleta.
 * No reproduce logotipos ni colores oficiales.
 */
export function InstitutionBadge({ institution, size = 42 }: InstitutionBadgeProps) {
  const { scheme } = useAppTheme();
  const tone = resolveTone(institution.tone, scheme);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone.soft }]}
    >
      {institution.icon ? (
        <Icon name={institution.icon} size={size * 0.46} color={tone.ink} />
      ) : (
        <AppText
          variant="label"
          maxFontSizeMultiplier={1.1}
          style={{ color: tone.ink, fontFamily: 'Inter_700Bold', fontSize: size * 0.32, lineHeight: size * 0.4, letterSpacing: 0.3 }}
        >
          {institution.initials}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
});
