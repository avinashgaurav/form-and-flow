import type { PlannedReminder } from '@ff/engines';

/** Web build: the browser preview does not schedule notifications. The native file does. */
export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export async function scheduleReminders(_reminders: PlannedReminder[]): Promise<number> {
  return 0;
}

export const remindersSupported = false;
