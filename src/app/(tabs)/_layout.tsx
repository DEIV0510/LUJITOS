import { useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { QuickAddButton } from '@/components/navigation/QuickAddButton';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const segments = useSegments();
  const current: string | undefined = segments[segments.length - 1];
  // En el asesor el campo de texto ocupa la parte baja: ahí no va el botón flotante.
  const showQuickAdd = current !== 'assistant';

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <BottomNavigation {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="accounts" options={{ title: 'Cuentas' }} />
        <Tabs.Screen name="transactions" options={{ title: 'Movimientos' }} />
        <Tabs.Screen name="statistics" options={{ title: 'Estadísticas' }} />
        <Tabs.Screen name="assistant" options={{ title: 'Asesor IA' }} />
      </Tabs>
      {showQuickAdd ? <QuickAddButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
