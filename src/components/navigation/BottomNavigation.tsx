import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';
import type { IconName } from '@/types/finance';

/** Alto del contenido de la barra (sin el área segura inferior). */
export const TAB_BAR_HEIGHT = 58;

type TabConfig = { label: string; icon: IconName; activeIcon: IconName };

const TABS: Record<string, TabConfig> = {
  index: { label: 'Inicio', icon: 'house', activeIcon: 'house.fill' },
  accounts: { label: 'Cuentas', icon: 'creditcard', activeIcon: 'creditcard.fill' },
  transactions: {
    label: 'Movimientos',
    icon: 'list.bullet.rectangle.portrait',
    activeIcon: 'list.bullet.rectangle.portrait.fill',
  },
  statistics: { label: 'Estadísticas', icon: 'chart.bar', activeIcon: 'chart.bar.fill' },
  assistant: { label: 'Asesor IA', icon: 'sparkles', activeIcon: 'sparkles' },
};

/** Barra inferior fija de LUJITOS con indicador de la sección activa. */
export function BottomNavigation({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingLeft: insets.left + 6,
          paddingRight: insets.right + 6,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const config = TABS[route.name];
        if (!config) return null;
        const focused = index === state.index;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.selection();
            navigateToTab(route.key);
          }
        };
        return (
          <TabItem
            key={route.key}
            config={config}
            focused={focused}
            onPress={onPress}
            position={`${index + 1} de ${state.routes.length}`}
          />
        );
      })}
    </View>
  );
}

type ItemProps = { config: TabConfig; focused: boolean; onPress: () => void; position: string };

function TabItem({ config, focused, onPress, position }: ItemProps) {
  const { colors } = useAppTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.set(focused ? withSpring(1, { damping: 18, stiffness: 240 }) : withTiming(0, { duration: 160 }));
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.6 + progress.value * 0.4 }],
  }));

  const tint = focused ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${config.label}, pestaña ${position}`}
      onPress={onPress}
      style={styles.item}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: colors.primarySoft }, pillStyle]} />
        <Icon name={focused ? config.activeIcon : config.icon} size={21} color={tint} weight={focused ? 'semibold' : 'regular'} />
      </View>
      <AppText
        variant="tab"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.15}
        style={{ color: tint, fontFamily: focused ? 'Inter_600SemiBold' : 'Inter_500Medium' }}
      >
        {config.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: TAB_BAR_HEIGHT - 6, minWidth: 0 },
  iconWrap: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15 },
});
