// notifications.ts
// The "Daily task reminder" toggle (Settings, and onboarding's save step)
// used to just be a stored flag — permission was requested on Home's
// mount, but nothing ever actually scheduled a notification, so turning
// it on did nothing. This is the real scheduling half of that toggle.
//
// A local notification's content is fixed at schedule time, not
// recomputed each morning against that day's real task list — there's no
// background task infra here to do that — so the copy stays deliberately
// generic ("check Sprout for what's due") rather than promising a specific
// count it can't actually deliver.

import * as Notifications from 'expo-notifications';

const DAILY_REMINDER_ID = 'daily-task-reminder';

/** Keeps the daily local reminder in sync with the user's preference —
 * cancels any existing one and, if enabled, reschedules fresh. Cancelling
 * first (rather than only scheduling when going from off to on) means this
 * is safe to call on every relevant profile change without stacking
 * duplicate notifications, and actually turns notifications off when the
 * toggle is switched off rather than leaving a stale one queued. */
export async function syncDailyReminder(enabled: boolean): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  if (!enabled) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Your garden today',
      body: "Check Sprout for what's due today — watering, planting, or a stage alert.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  }).catch(() => {});
}
