import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { daysInMonth, toISO, weekdayIndex, type ISODate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

const WEEK_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

type Props = {
  year: number;
  month: number;
  selected?: ISODate | null;
  today?: ISODate;
  /** Puntos de color bajo cada día (vencimientos, ingresos…). */
  marks?: Record<ISODate, string[]>;
  onSelect?: (date: ISODate) => void;
  /** Días posteriores a esta fecha no se pueden elegir. */
  maxDate?: ISODate;
};

/** Mes en cuadrícula, semana de lunes a domingo. */
export function CalendarGrid({ year, month, selected, today, marks = {}, onSelect, maxDate }: Props) {
  const { colors } = useAppTheme();
  const total = daysInMonth(year, month);
  const firstWeekday = (weekdayIndex(toISO(year, month, 1)) + 6) % 7; // lunes = 0
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.week}>
        {WEEK_HEADER.map((day, index) => (
          <AppText
            key={`${day}-${index}`}
            variant="caption"
            color="textTertiary"
            align="center"
            style={styles.cell}
            accessibilityLabel={WEEK_NAMES[index]}
          >
            {day}
          </AppText>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`empty-${index}`} style={styles.cell} />;
          const iso = toISO(year, month, day);
          const isSelected = iso === selected;
          const isToday = iso === today;
          const disabled = Boolean(maxDate && iso > maxDate);
          const dots = marks[iso] ?? [];
          return (
            <Pressable
              key={iso}
              disabled={!onSelect || disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${day}${isToday ? ', hoy' : ''}${dots.length ? `, ${dots.length} eventos` : ''}`}
              onPress={() => {
                haptics.selection();
                onSelect?.(iso);
              }}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                ]}
              >
                <AppText
                  variant="callout"
                  maxFontSizeMultiplier={1.2}
                  style={{
                    color: isSelected ? colors.onPrimary : disabled ? colors.textTertiary : colors.text,
                    fontFamily: isSelected || isToday ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  }}
                >
                  {day}
                </AppText>
              </View>
              <View style={styles.dots}>
                {dots.slice(0, 3).map((color, dotIndex) => (
                  <View key={dotIndex} style={[styles.dot, { backgroundColor: color }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
