import * as Haptics from 'expo-haptics';

/** Vibraciones sutiles. Si el iPhone está en ahorro de energía, iOS las omite sin error. */
export const haptics = {
  selection() {
    Haptics.selectionAsync().catch(() => undefined);
  },
  light() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  medium() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  error() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
};
