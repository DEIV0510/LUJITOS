import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Escala al presionar (0.97 por defecto). */
  scaleTo?: number;
};

/** Botón con respuesta táctil sutil: se encoge levemente al presionar. */
export function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 16, stiffness: 260 }));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
    />
  );
}
