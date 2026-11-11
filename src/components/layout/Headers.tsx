import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { screenPadding, useAppTheme } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  right?: ReactNode;
  /** 'back' para pantallas apiladas · 'close' para hojas modales. */
  leading?: 'back' | 'close';
  onLeadingPress?: () => void;
  /** Las hojas modales no necesitan el área segura superior. */
  modal?: boolean;
};

/** Barra superior de pantallas secundarias, con volver y título centrado. */
export function ScreenHeader({ title, right, leading = 'back', onLeadingPress, modal }: ScreenHeaderProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const goBack = onLeadingPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: modal ? 10 : insets.top + 4,
          paddingLeft: insets.left + screenPadding - 6,
          paddingRight: insets.right + screenPadding - 6,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.side}>
        <IconButton
          icon={leading === 'close' ? 'xmark' : 'chevron.left'}
          variant="plain"
          accessibilityLabel={leading === 'close' ? 'Cerrar' : 'Volver'}
          onPress={goBack}
        />
      </View>
      <AppText variant="headline" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

type TabHeaderProps = { title: string; subtitle?: string; right?: ReactNode };

/** Título grande de las pantallas principales (pestañas). */
export function TabHeader({ title, subtitle, right }: TabHeaderProps) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabTexts}>
        <AppText variant="largeTitle" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="callout" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  side: { width: 52, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  tabHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 8 },
  tabTexts: { flex: 1, gap: 2 },
});
