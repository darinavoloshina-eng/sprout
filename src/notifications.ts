// notifications.ts
// Schedules the local notifications nudgeEngine.ts plans. The "Daily task
// reminder" toggle (Settings, and onboarding's save step) used to schedule
// one fixed 8am notification every single day with generic copy ("check
// GardenWise for what's due") — a local notification's content is fixed at
// schedule time, and there's no background task infra to recompute it each
// morning. Instead, the whole next few weeks are planned up front, each
// notification naming that day's actual jobs, and the plan is rebuilt
// whenever the app opens or the garden changes. See nudgeEngine.ts for what
// does and doesn't earn a notification.

import * as Notifications from 'expo-notifications';
import { PlannedNudge } from './engines/nudgeEngine';

// The id the old always-daily reminder was scheduled under. Still cancelled
// on every sync so it doesn't keep firing for people upgrading from a build
// that scheduled it.
const LEGACY_DAILY_REMINDER_ID = 'daily-task-reminder';
const NUDGE_ID_PREFIX = 'nudge-';

/** Replaces every scheduled nudge with `plan` (or with nothing, if
 * disabled). Cancelling first means this is safe to call on every relevant
 * profile change without stacking duplicates, and a task checked off early
 * in the app stops its notification from firing. */
export async function syncNudges(enabled: boolean, plan: PlannedNudge[]): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(LEGACY_DAILY_REMINDER_ID).catch(() => {});
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(NUDGE_ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
  if (!enabled || plan.length === 0) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  for (const nudge of plan) {
    if (nudge.fireAt.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: nudge.id,
      content: { title: nudge.title, body: nudge.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nudge.fireAt },
    }).catch(() => {});
  }
}
