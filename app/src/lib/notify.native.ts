import type { PlannedReminder } from '@ff/engines';
import * as Notifications from 'expo-notifications';

/**
 * Local reminders on the phone (ADR-07). Scheduled from the engine's plan each time the plan
 * changes; never used for anything safety-critical. Text never contains health values.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const remindersSupported = true;

export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleReminders(reminders: PlannedReminder[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  let n = 0;
  for (const r of reminders) {
    const when = new Date(`${r.day}T${r.time}:00`);
    if (when.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { category: r.category } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    n++;
  }
  return n;
}
