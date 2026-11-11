import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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

const FADE_OUT = 420;

/**
 * Apertura: la «L» aparece, la moneda dorada se asienta en su esquina y la
 * pantalla se disuelve hacia la app. Con «Reducir movimiento» solo hay un fundido corto.
 *
 * También es la pantalla de carga: no se disuelve hasta que `ready` sea true
 * (sesión comprobada), así nunca se ve el panel antes de saber si hay sesión.
 */
export function AnimatedSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [minimumShown, setMinimumShown] = useState(false);

  const mark = useSharedValue(reduceMotion ? 1 : 0);
  const coin = useSharedValue(reduceMotion ? 1 : 0);
  const words = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);
  const screen = useSharedValue(1);

  // Entrada: se cuenta desde que la apertura se pintó, no desde que se montó.
  useEffect(() => {
    if (!started) return;
    const minimum = reduceMotion ? 300 : 1480;
    if (!reduceMotion) {
      mark.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
      coin.set(withDelay(320, withSpring(1, { damping: 11, stiffness: 140, mass: 0.9 })));
      words.set(withDelay(520, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
    }
    const timer = setTimeout(() => setMinimumShown(true), minimum);
    return () => clearTimeout(timer);
  }, [started, reduceMotion, mark, coin, words]);

  // Si la sesión tarda (red lenta), la moneda late suavemente mientras espera.
  useEffect(() => {
    if (!minimumShown || ready || reduceMotion) return;
    pulse.set(withRepeat(withSequence(withTiming(0.55, { duration: 650 }), withTiming(1, { duration: 650 })), -1));
  }, [minimumShown, ready, reduceMotion, pulse]);

  // Salida: solo cuando pasó el mínimo y la sesión ya se comprobó.
  useEffect(() => {
    if (!minimumShown || !ready) return;
    pulse.set(withTiming(1, { duration: 150 }));
    screen.set(withTiming(0, { duration: FADE_OUT, easing: Easing.inOut(Easing.quad) }));
    const timer = setTimeout(onFinish, FADE_OUT + 40);
    return () => clearTimeout(timer);
  }, [minimumShown, ready, screen, pulse, onFinish]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.88 + mark.value * 0.12 }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(coin.value * 1.6, 1) * pulse.value,
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
