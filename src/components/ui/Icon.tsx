import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/types/finance';

type Props = {
  name: IconName;
  size?: number;
  color: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
};

/** Íconos SF Symbols de iOS: nativos, nítidos y coherentes con el sistema. */
export function Icon({ name, size = 20, color, weight = 'medium', style }: Props) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}
