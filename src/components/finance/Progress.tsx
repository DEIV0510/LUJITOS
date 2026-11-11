import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { getGoalPlan } from '@/features/demo/selectors';
import { formatLongDate } from '@/lib/dates';
import { formatPercent, type Money } from '@/lib/money';
import { resolveTone, useAppTheme, type ThemeColors } from '@/theme';
import type { Category, SavingsGoal } from '@/types/finance';

import { AmountText } from './AmountText';
import { CategoryIcon } from './Badges';

/** Color de la barra según los umbrales de alerta del presupuesto (70 %, 85 %, 100 %). */
export function budgetColor(ratio: number, colors: ThemeColors): string {
  if (ratio >= 1) return colors.negativeGraphic;
  if (ratio >= 0.85) return colors.warningGraphic;
  if (ratio >= 0.7) return colors.accent;
  return colors.primary;
}

type BarProps = { ratio: number; color: string; height?: number };

/** Barra de progreso animada. */
export function ProgressBar({ ratio, color, height = 8 }: BarProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    progress.set(reduceMotion
      ? clamped
      : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [clamped, progress, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted }]}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

type BudgetProps = {
  spent: Money;
  limit: Money;
  category?: Category;
  title?: string;
  showDivider?: boolean;
};

/** Progreso de un presupuesto (total o por categoría). */
export function BudgetProgress({ spent, limit, category, title, showDivider }: BudgetProps) {
  const { colors, spacing } = useAppTheme();
  const ratio = limit > 0 ? spent / limit : 0;
  const remaining = limit - spent;
  const over = remaining < 0;
  const alert = ratio >= 1 ? 'Superado' : ratio >= 0.85 ? 'Alerta 85 %' : ratio >= 0.7 ? 'Alerta 70 %' : null;

  return (
    <View
      style={[
        { gap: spacing.sm, paddingVertical: spacing.md },
        showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.budgetHead}>
        {category ? <CategoryIcon category={category} size={34} /> : null}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title ?? category?.name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            <AmountText amount={spent} variant="footnote" color="textSecondary" /> de{' '}
            <AmountText amount={limit} variant="footnote" color="textSecondary" />
          </AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="subhead" color={over ? 'negative' : ratio >= 0.85 ? 'warning' : 'text'}>
            {formatPercent(ratio * 100, { digits: 0 })}
          </AppText>
          {alert ? (
            <View style={styles.alert}>
              <Icon
                name="exclamationmark.triangle.fill"
                size={10}
                color={over ? colors.negative : colors.warning}
              />
              <AppText variant="caption" color={over ? 'negative' : 'warning'}>
                {alert}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <ProgressBar ratio={ratio} color={budgetColor(ratio, colors)} />
      <AppText variant="footnote" color={over ? 'negative' : 'textSecondary'}>
        {over ? 'Excedido en ' : 'Disponible: '}
        <AmountText amount={Math.abs(remaining)} variant="footnote" color={over ? 'negative' : 'textSecondary'} />
      </AppText>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingProps = { ratio: number; color: string; size?: number; stroke?: number };

/** Anillo de progreso para metas de ahorro. */
export function ProgressRing({ ratio, color, size = 64, stroke = 7 }: RingProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    progress.set(reduceMotion
      ? clamped
      : withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <AppText variant="label" maxFontSizeMultiplier={1.1}>
          {Math.round(clamped * 100)} %
        </AppText>
      </View>
    </View>
  );
}

type SavingsProps = { goal: SavingsGoal; compact?: boolean };

/** Meta de ahorro: anillo de avance, faltante y cuánto separar por semana y por mes. */
export function SavingsProgress({ goal, compact }: SavingsProps) {
  const { colors, spacing, scheme } = useAppTheme();
  const plan = getGoalPlan(goal);
  const tone = resolveTone(goal.tone, scheme);

  return (
    <FinancialCard padding={spacing.lg}>
      <View style={styles.goalRow}>
        <ProgressRing ratio={plan.ratio} color={tone.base} size={compact ? 56 : 66} />
        <View style={styles.flex}>
          <View style={styles.goalTitle}>
            <Icon name={goal.icon} size={15} color={tone.ink} />
            <AppText variant="headline" numberOfLines={1} style={styles.flex}>
              {goal.name}
            </AppText>
          </View>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            <AmountText amount={goal.saved} variant="footnote" color="text" /> de{' '}
            <AmountText amount={goal.target} variant="footnote" color="textSecondary" />
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Fecha límite: {formatLongDate(goal.deadline)}
          </AppText>
        </View>
      </View>
      {!compact ? (
        <View style={[styles.planRow, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
          <View style={styles.planItem}>
            <AppText variant="caption" color="textSecondary">
              Por semana
            </AppText>
            <AmountText amount={plan.perWeek} variant="amountS" />
          </View>
          <View style={styles.planItem}>
            <AppText variant="caption" color="textSecondary">
              Por mes
            </AppText>
            <AmountText amount={plan.perMonth} variant="amountS" />
          </View>
          <View style={styles.planItem}>
            <AppText variant="caption" color="textSecondary">
              Prioridad
            </AppText>
            <AppText variant="subhead">{goal.priority.charAt(0).toUpperCase() + goal.priority.slice(1)}</AppText>
          </View>
        </View>
      ) : null}
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  budgetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  center: { alignItems: 'center', justifyContent: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  planItem: { flex: 1, gap: 2 },
});
