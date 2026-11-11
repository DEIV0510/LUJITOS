import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { palette } from '@/theme';

import { LOGO_PATH } from './LogoMark';

const MARK = 96;
// Posición de la moneda dentro del símbolo (viewBox 24..96).
const COIN_R = (10.5 / 72) * MARK;
const COIN_X = ((65.5 - 24) / 72) * MARK;
const COIN_Y = ((66.5 - 24) / 72) * MARK;

/**
 * Apertura: la «L» aparece, la moneda dorada se asienta en su esquina y la
 * pantalla se disuelve hacia la app. Con «Reducir movimiento» solo hay un fundido corto.
 */
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const reduceMotion = useReducedMotion();
  const [started, setStarted] = useState(false);

  const mark = useSharedValue(reduceMotion ? 1 : 0);
  const coin = useSharedValue(reduceMotion ? 1 : 0);
  const words = useSharedValue(reduceMotion ? 1 : 0);
  const screen = useSharedValue(1);

  useEffect(() => {
    if (!started) return;
    const total = reduceMotion ? 700 : 1900;
    if (!reduceMotion) {
      mark.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
      coin.set(withDelay(320, withSpring(1, { damping: 11, stiffness: 140, mass: 0.9 })));
      words.set(withDelay(520, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
    }
    screen.set(withDelay(total - 420, withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) })));
    // El fin se agenda desde que la apertura se pintó, no desde que se montó.
    const timer = setTimeout(onFinish, total + 40);
    return () => clearTimeout(timer);
  }, [started, reduceMotion, mark, coin, words, screen, onFinish]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.88 + mark.value * 0.12 }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(coin.value * 1.6, 1),
    transform: [{ translateY: (1 - coin.value) * -34 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 10 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => setStarted(true)}
      style={[StyleSheet.absoluteFill, styles.root, screenStyle]}
      accessibilityLabel="LUJITOS. Tu dinero, bajo control."
    >
      <Animated.View style={[styles.mark, markStyle]}>
        <Svg width={MARK} height={MARK} viewBox="24 24 72 72">
          <Path d={LOGO_PATH} fill={palette.ivory} />
        </Svg>
        <Animated.View
          style={[
            styles.coin,
            {
              width: COIN_R * 2,
              height: COIN_R * 2,
              borderRadius: COIN_R,
              left: COIN_X - COIN_R,
              top: COIN_Y - COIN_R,
            },
            coinStyle,
          ]}
        />
      </Animated.View>
      <Animated.View style={[styles.words, wordStyle]}>
        <AppText style={styles.wordmark} maxFontSizeMultiplier={1.2}>
          LUJITOS
        </AppText>
        <View style={styles.rule} />
        <AppText style={styles.tagline} maxFontSizeMultiplier={1.2}>
          TU DINERO, BAJO CONTROL
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.forest, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  mark: { width: MARK, height: MARK },
  coin: { position: 'absolute', backgroundColor: palette.gold },
  words: { alignItems: 'center', marginTop: 28 },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 9,
    color: palette.ivory,
    paddingLeft: 9,
  },
  rule: { width: 28, height: 1, backgroundColor: palette.gold, marginVertical: 14, opacity: 0.8 },
  tagline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.6,
    color: palette.sage,
    paddingLeft: 2.6,
  },
});
