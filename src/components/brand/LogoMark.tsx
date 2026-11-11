import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { palette } from '@/theme';

/** Trazado del símbolo: una «L» que sostiene una moneda («tu dinero, bajo control»). */
export const LOGO_PATH =
  'M39.5 24H45.5A3.5 3.5 0 0 1 49 27.5V83H82.5A3.5 3.5 0 0 1 86 86.5V92.5A3.5 3.5 0 0 1 82.5 96H39.5A3.5 3.5 0 0 1 36 92.5V27.5A3.5 3.5 0 0 1 39.5 24Z';

type MarkProps = { size?: number; color?: string; coinColor?: string };

/** Símbolo de LUJITOS (el mismo dibujo del ícono de la app). */
export function LogoMark({ size = 32, color = palette.ivory, coinColor = palette.gold }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="24 24 72 72" accessibilityElementsHidden>
      <Path d={LOGO_PATH} fill={color} />
      <Circle cx={65.5} cy={66.5} r={10.5} fill={coinColor} />
    </Svg>
  );
}

type LockupProps = { color: string; coinColor?: string; size?: 'small' | 'large' };

/** Símbolo + palabra LUJITOS. */
export function LogoLockup({ color, coinColor = palette.gold, size = 'small' }: LockupProps) {
  const large = size === 'large';
  return (
    <View style={styles.row} accessible accessibilityLabel="LUJITOS">
      <LogoMark size={large ? 40 : 22} color={color} coinColor={coinColor} />
      <AppText
        style={[
          styles.word,
          { color, fontSize: large ? 26 : 15, lineHeight: large ? 32 : 20, letterSpacing: large ? 6 : 3 },
        ]}
      >
        LUJITOS
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: 'Inter_700Bold' },
});
