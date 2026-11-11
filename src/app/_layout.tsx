import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedSplash } from '@/components/brand/AnimatedSplash';
import { AppNavigator } from '@/features/auth/AppNavigator';
import { navigationGuards } from '@/features/auth/navigation';
import { ProfileErrorScreen, SetupRequiredScreen } from '@/features/auth/StatusScreens';
import { PrivacyProvider } from '@/features/privacy/PrivacyProvider';
import { AuthProvider, useAuth } from '@/hooks/auth';
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
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </PrivacyProvider>
    </ThemeProvider>
  );
}

/**
 * Navegación según el estado de autenticación:
 *   cargando     → apertura (nunca se ve el panel antes de comprobar la sesión)
 *   sin sesión   → (auth): bienvenida, registro, inicio de sesión
 *   con sesión   → onboarding la primera vez; luego (app)
 *   recuperación → solo reset-password
 * Las rutas privadas viven en el grupo (app): una pantalla nueva ahí queda
 * protegida automáticamente.
 */
function AppShell() {
  const { scheme, colors } = useAppTheme();
  const { status, profile, profileError, recovery } = useAuth();
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

  const guards = navigationGuards({ status, onboarded: Boolean(profile?.onboarding_completed_at), recovery });
  const ready = !guards.loading;
  const signedIn = status === 'signedIn';

  let content: React.ReactNode = null;
  if (guards.setup) {
    content = <SetupRequiredScreen />;
  } else if (signedIn && !profile && profileError) {
    content = <ProfileErrorScreen message={profileError} />;
  } else if (ready) {
    content = (
      <NavigationThemeProvider value={navigationTheme}>
        <AppNavigator guards={guards} background={colors.background} />
      </NavigationThemeProvider>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {content}
      <StatusBar style={!introDone || scheme === 'dark' ? 'light' : 'dark'} animated />
      {!introDone ? <AnimatedSplash ready={ready} onFinish={finishIntro} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
