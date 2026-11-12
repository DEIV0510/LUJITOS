/**
 * Notificaciones LOCALES (las programa el propio iPhone; no hay servidor de
 * push ni tokens). Funcionan en Expo Go en iOS; las notificaciones push
 * remotas requerirían un development build (no se usan).
 *
 * El permiso se pide solo cuando el usuario activa los recordatorios.
 * Nunca se afirma que funcionan sin probarlas en el dispositivo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { parseISO, type ISODate } from '@/lib/dates';
import { logError } from '@/lib/logger';

const ENABLED_KEY = 'lujitos.reminders-enabled';
const NOTIFIED_KEY = 'lujitos.notified-alerts';
/** Máximo de recordatorios programados a la vez (iOS admite 64). */
const MAX_SCHEDULED = 40;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch (error) {
    logError('notifications.permissions', error);
    return 'undetermined';
  }
}

/** Pide permiso (solo muestra el diálogo de iOS la primera vez). */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch (error) {
    logError('notifications.request', error);
    return 'denied';
  }
}

export async function remindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'on';
  } catch {
    return false;
  }
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
    if (!enabled) await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    logError('notifications.toggle', error);
  }
}

/** 9:00 de Bogotá (UTC−5) de esa fecha. */
export function bogotaMorning(date: ISODate): Date {
  const { year, month, day } = parseISO(date);
  return new Date(Date.UTC(year, month - 1, day, 14, 0, 0));
}

export type LocalReminder = { id: string; title: string; body: string; at: Date };

/** Reemplaza todos los recordatorios programados por estos (los pasados se omiten). */
export async function replaceScheduled(reminders: LocalReminder[]): Promise<number> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    const upcoming = reminders.filter((reminder) => reminder.at.getTime() > now + 60_000).slice(0, MAX_SCHEDULED);
    for (const reminder of upcoming) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { lujitos: reminder.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
      });
    }
    return upcoming.length;
  } catch (error) {
    logError('notifications.schedule', error);
    return 0;
  }
}

/** Avisa ahora (por ejemplo, un presupuesto superado). Cada id se avisa una sola vez. */
export async function notifyOnce(id: string, title: string, body: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    if (seen.has(id)) return false;
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { lujitos: id } }, trigger: null });
    seen.add(id);
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify([...seen].slice(-200)));
    return true;
  } catch (error) {
    logError('notifications.now', error);
    return false;
  }
}

export async function scheduledCount(): Promise<number> {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
