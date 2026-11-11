import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedSplash } from '@/components/brand/AnimatedSplash';
import { PrivacyProvider } from '@/features/privacy/PrivacyProvider';
import { fontAssets, ThemeProvider, useAppTheme } from '@/theme';

// El splash nativo se mantiene hasta que carguen las fuentes; luego sigue la apertura animada.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PrivacyProvider>
        <AppShell />
      </PrivacyProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const { scheme, colors } = useAppTheme();
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [scheme, colors]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <NavigationThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account/new" options={{ presentation: 'modal' }} />
        </Stack>
      </NavigationThemeProvider>
      <StatusBar style={!introDone || scheme === 'dark' ? 'light' : 'dark'} animated />
      {!introDone ? <AnimatedSplash onFinish={finishIntro} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
