import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { useAppTheme } from '@/theme';

type Section = { title: string; body: string };

const TERMS: Section[] = [
  { title: 'Qué es LUJITOS', body: 'Una aplicación personal para registrar y entender tus finanzas: cuentas, ingresos, gastos, presupuestos y metas. No es un banco ni mueve dinero.' },
  { title: 'Tu cuenta', body: 'Eres responsable de mantener segura tu contraseña. Puedes cerrar sesión en cualquier momento desde Configuración.' },
  { title: 'Información que registras', body: 'Los saldos y movimientos los escribes tú. LUJITOS hace cálculos con esos datos, pero no garantiza que coincidan con los de tu banco.' },
  { title: 'Recomendaciones', body: 'Los análisis y consejos son orientativos y no constituyen asesoría financiera profesional.' },
  { title: 'Cambios', body: 'Estos términos pueden actualizarse a medida que la app crece. Te avisaremos dentro de la app.' },
];

const PRIVACY: Section[] = [
  { title: 'Qué datos guardamos', body: 'Nombre, apellido, correo, país, moneda y los datos financieros que registras (cuentas, movimientos y categorías).' },
  { title: 'Qué no guardamos', body: 'Nunca pedimos ni guardamos contraseñas de bancos ni números completos de tarjetas (solo los últimos 4 dígitos si los escribes).' },
  { title: 'Dónde se guardan', body: 'En una base de datos PostgreSQL de Supabase con seguridad por filas: cada usuario solo puede ver sus propios datos. Tu sesión se guarda cifrada en el llavero de tu iPhone.' },
  { title: 'Inteligencia artificial', body: 'El asesor con IA llegará más adelante y solo usará tus datos si das tu permiso explícito, enviando la información mínima necesaria.' },
  { title: 'Tus derechos', body: 'Puedes pedir la exportación o la eliminación de tus datos. Estas opciones estarán en Configuración.' },
];

/** Términos de uso y política de privacidad (accesibles sin iniciar sesión). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const { spacing } = useAppTheme();
  const isPrivacy = doc === 'privacy';
  const sections = isPrivacy ? PRIVACY : TERMS;
  return (
    <Screen header={<ScreenHeader title={isPrivacy ? 'Política de privacidad' : 'Términos de uso'} />}>
      <AppText variant="footnote" color="textTertiary">
        Versión del 11 de noviembre de 2026.
      </AppText>
      <FinancialCard padding={spacing.xl}>
        <View style={{ gap: spacing.lg }}>
          {sections.map((section) => (
            <View key={section.title} style={{ gap: spacing.xs }}>
              <AppText variant="headline">{section.title}</AppText>
              <AppText variant="callout" color="textSecondary">
                {section.body}
              </AppText>
            </View>
          ))}
        </View>
      </FinancialCard>
    </Screen>
  );
}
