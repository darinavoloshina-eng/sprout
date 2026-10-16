// nudgeEngine.ts
// Decides which local notifications are worth sending, and what they say.
// Pure — notifications.ts does the actual scheduling.
//
// The rules, in order of how much they matter:
//  1. Only nudge for things that are genuinely a job for that day and easy
//     to miss without a reminder: planting, sowing a succession, feeding,
//     collecting seed, or a reminder the user set themselves. Routine
//     watering is NOT a daily nudge — it's the same every few days, people
//     learn it fast, and a buzz three times a week is exactly what gets
//     notifications turned off. It gets one weekly summary instead.
//  2. At most one notification per day. Several jobs on the same day are
//     bundled into one, by name.
//  3. Nothing due means no notification. There is no "nothing to do
//     today!" filler.
//  4. The plan only reaches HORIZON_DAYS ahead and is rebuilt every time
//     the app opens or the garden changes. Someone who stops opening the
//     app gets a few weeks of real reminders and then silence, rather than
//     being chased indefinitely.
//
// Today is deliberately skipped: the plan is rebuilt while the user is in
// the app, looking at today's tasks on Home, so a notification about them
// would only repeat what's on screen.

import { GardenProfile } from '../types';
import { DailyTask, getTasksForDate, getTreeWateringReminders, isSeedStartTask, isTaskComplete } from './taskEngine';
import { computeSchedule, wateringDaysOfWeek } from './scheduleEngine';
import { bedCrops } from '../cropMeta';

export const HORIZON_DAYS = 21;
export const MORNING_HOUR = 8;
// Sunday evening — when people tend to plan their week.
export const WEEKLY_SUMMARY_DAY = 0;
export const WEEKLY_SUMMARY_HOUR = 18;

// Task id prefixes (see taskEngine.ts) that are worth a notification on
// the day they're due. Notably absent: water- (the bed's routine watering)
// and treewater- (a soil check every 3–5 days) — both folded into the
// weekly summary — and harvested-, which is a record, not a task.
const NUDGE_PREFIXES = ['plant-', 'succession-', 'feed-', 'seeds-', 'reminder-', 'seedstart-', 'hardenoff-', 'transplant-'];

export interface PlannedNudge {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
}

function isNudgeWorthy(profile: GardenProfile, task: DailyTask): boolean {
  // Seed-starting dates are free to see in the app, but reminding someone
  // of them is Pro, like every other reminder (the rest are Pro-only by
  // construction in taskEngine).
  if (isSeedStartTask(task.id) && !profile.isPro) return false;
  return NUDGE_PREFIXES.some((p) => task.id.startsWith(p));
}

/** The jobs on `day` worth telling someone about ahead of time — shared by
 * the push plan below and the weekly email digest (subscribe-worker).
 * getTasksForDate doesn't completion-gate user-set reminders, so a job
 * checked off ahead of time is filtered out here too. */
export function nudgeWorthyTasks(profile: GardenProfile, day: Date, now: Date): DailyTask[] {
  return getTasksForDate(profile, day, now).filter((t) => isNudgeWorthy(profile, t) && !isTaskComplete(profile, t.id));
}

/** "Fertilize Tomatoes" → "fertilize tomatoes", for use mid-sentence. */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function joinNames(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function actionNudge(tasks: DailyTask[], fireAt: Date): PlannedNudge {
  const id = `nudge-${fireAt.toISOString().slice(0, 10)}`;
  if (tasks.length === 1) {
    return { id, fireAt, title: tasks[0].title, body: firstSentence(tasks[0].detail) };
  }
  return {
    id,
    fireAt,
    title: `${tasks.length} garden jobs today`,
    body: `${joinNames(tasks.map((t, i) => (i === 0 ? t.title : lowerFirst(t.title))))}.`,
  };
}

/** One line covering the coming week's watering, or null if there's
 * nothing to water (e.g. an empty garden). */
export function weeklyWateringLine(profile: GardenProfile, weekStart: Date): string | null {
  const parts: string[] = [];
  const result = computeSchedule({
    crops: bedCrops(profile.crops),
    sun: profile.sun,
    bedWidthFt: profile.bedWidthFt,
    bedLengthFt: profile.bedLengthFt,
    method: profile.method,
    lineSpacingIn: profile.lineSpacingIn,
    emitterSpacingIn: profile.emitterSpacingIn,
    emitterGph: profile.emitterGph,
    weather: profile.weather,
  });
  const days = wateringDaysOfWeek(result.sessionsPerWeek);
  if (days.length > 0) {
    parts.push(
      `Water ${joinNames(days.map((d) => DAY_NAMES[d]))}, about ${result.minutesPerSession} min each.`
    );
  }

  const treeCrops = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    for (const t of getTreeWateringReminders(profile, d)) treeCrops.add(t.title.replace(/^Water /, ''));
  }
  if (treeCrops.size > 0) {
    parts.push(`Check the soil on your ${joinNames([...treeCrops].map(lowerFirst))} every few days.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export interface WeeklyDigest {
  /** One entry per day that has a job, in order — empty in a quiet week. */
  days: { date: Date; jobs: string[] }[];
  watering: string | null;
}

/** The weekly email's content for the 7 days starting `weekStart`, or null
 * when there's genuinely nothing to say (no jobs and nothing to water), so
 * the digest skips that week rather than sending an empty email. */
export function weeklyDigest(profile: GardenProfile, weekStart: Date, now: Date): WeeklyDigest | null {
  const days: WeeklyDigest['days'] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i, MORNING_HOUR);
    const jobs = nudgeWorthyTasks(profile, date, now).map((t) => t.title);
    if (jobs.length > 0) days.push({ date, jobs });
  }
  const watering = weeklyWateringLine(profile, weekStart);
  if (days.length === 0 && !watering) return null;
  return { days, watering };
}

/** Every notification to schedule from `now` through HORIZON_DAYS out,
 * at most one per calendar day. */
export function planNudges(profile: GardenProfile, now: Date = new Date()): PlannedNudge[] {
  const nudges: PlannedNudge[] = [];
  for (let offset = 1; offset <= HORIZON_DAYS; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, MORNING_HOUR, 0, 0, 0);
    const tasks = nudgeWorthyTasks(profile, day, now);
    // Someone actually getting the weekly email already has the watering
    // plan in their inbox on Sunday — a push saying the same thing an hour
    // apart is the kind of double nudge this whole file exists to avoid.
    const watering =
      day.getDay() === WEEKLY_SUMMARY_DAY && !profile.emailDigestActive
        ? weeklyWateringLine(profile, nextDay(day))
        : null;

    if (tasks.length > 0) {
      const nudge = actionNudge(tasks, day);
      // Summary day with a real job too: fold the watering line into the
      // morning notification rather than buzzing twice in one day.
      if (watering) nudge.body = `${nudge.body} This week: ${lowerFirst(watering)}`;
      nudges.push(nudge);
    } else if (watering) {
      const fireAt = new Date(day);
      fireAt.setHours(WEEKLY_SUMMARY_HOUR, 0, 0, 0);
      nudges.push({
        id: `nudge-${fireAt.toISOString().slice(0, 10)}`,
        fireAt,
        title: 'Your garden this week',
        body: watering,
      });
    }
  }
  return nudges;
}

function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}
