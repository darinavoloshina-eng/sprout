// taskEngine.ts
// Shared "what needs doing" logic for Home (today's checkable tasks) and
// Calendar (any date's read-only task list), plus completion + streak
// tracking. There is no separate tasks[] store — a task's identity is a
// stable, date-scoped id derived from what generates it (watering pattern
// or a crop-stage alert), and "completing" it just records a timestamp
// against that id. This keeps tasks always in sync with the live schedule
// instead of drifting out of date the way a stored, editable list would.

import { CropKey, ScheduleResult, TimeOfDay, computeSchedule, wateringDaysOfWeek } from './scheduleEngine';
import { getAlerts, PlantedBucket } from './alertsEngine';
import { plantingGuidanceFor } from './plantingGuide';
import { GardenProfile } from '../types';
import { colors } from '../theme';
import { cropIcon, cropIconBg } from '../cropMeta';

export type TaskCategory = 'tend' | 'harvest' | 'feed' | 'prune';

export const CATEGORY_COLOR: Record<TaskCategory, string> = {
  tend: colors.mossGreen,
  harvest: colors.mustard,
  feed: colors.clay,
  prune: colors.pineDeep,
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  tend: 'Tend',
  harvest: 'Harvest',
  feed: 'Feed',
  prune: 'Prune',
};

export function categorize(text: string): TaskCategory {
  const t = text.toLowerCase();
  if (/harvest|pick|ripen/.test(t)) return 'harvest';
  if (/feed|fertiliz/.test(t)) return 'feed';
  if (/prune|pinch|sucker/.test(t)) return 'prune';
  return 'tend';
}

export interface DailyTask {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  detail: string;
  category: TaskCategory;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeOfDayLabel(t: TimeOfDay): string {
  return t === 'morning and evening' ? 'Morning and evening' : 'Morning';
}

/** The most recent scheduled watering day at or before `today` (today
 * itself if today is one). Looks back at most a week, which is always
 * enough since watering happens at least twice a week — there's never a
 * gap longer than that between scheduled days. */
function mostRecentWateringDay(sessionsPerWeek: number, today: Date): Date {
  const days = wateringDaysOfWeek(sessionsPerWeek);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let back = 0; back < 7; back++) {
    if (days.includes(cursor.getDay())) return cursor;
    cursor.setDate(cursor.getDate() - 1);
  }
  return today; // unreachable given the "at least twice a week" guarantee above
}

function scheduleFor(profile: GardenProfile): ScheduleResult {
  return computeSchedule({
    crops: profile.crops,
    sun: profile.sun,
    bedWidthFt: profile.bedWidthFt,
    bedLengthFt: profile.bedLengthFt,
    method: profile.method,
    lineSpacingIn: profile.lineSpacingIn,
    emitterSpacingIn: profile.emitterSpacingIn,
    emitterGph: profile.emitterGph,
    weather: profile.weather,
  });
}

/** Any date's task list — watering pattern, reminders explicitly scheduled
 * for that date, and (for Pro) crop guidance. Read-only; used by the
 * Calendar. Today's cell mirrors Home's task list exactly (the same
 * severity='soon' alerts — "Plant Broccoli now" for a not-yet-planted crop
 * whose window is open, or "Water frequently, celery stays thirsty" for an
 * already-planted one), since that's the live, currently-true state Home
 * itself shows — it isn't tied to a single fixed calendar day, and it
 * keeps showing there, unchanged, for as many days as it takes until the
 * user checks it off or the crop's stage moves on. Other days only show a
 * not-yet-planted crop's own single calculated target date, if it falls on
 * that day — useful for browsing ahead to when a window opens, but there's
 * no fixed date to hang an already-planted crop's ongoing care alert on. */
export function getTasksForDate(profile: GardenProfile, date: Date, today: Date = new Date()): DailyTask[] {
  const tasks: DailyTask[] = [];
  const result = scheduleFor(profile);
  if (wateringDaysOfWeek(result.sessionsPerWeek).includes(date.getDay())) {
    tasks.push({
      id: `water-${dateKey(date)}`,
      icon: '💧',
      iconBg: colors.selectedBg,
      title: 'Water the garden',
      detail: `${result.minutesPerSession} min · ${timeOfDayLabel(result.timeOfDay)}`,
      category: 'tend',
    });
  }
  for (const r of profile.scheduledReminders) {
    if (sameDay(new Date(r.dateISO), date)) {
      const crop = profile.crops.find((c) => c.toLowerCase() === r.cropLabel.toLowerCase());
      tasks.push({
        id: `reminder-${r.id}`,
        icon: crop ? cropIcon(crop) : '🌱',
        iconBg: cropIconBg((crop ?? 'other') as CropKey),
        title: r.title,
        detail: r.body,
        category: categorize(r.title || r.body),
      });
    }
  }
  if (profile.isPro && sameDay(date, today)) {
    const alerts = getAlerts(
      profile.crops,
      profile.plantedWeeks as Partial<Record<CropKey, PlantedBucket>>,
      profile.weather,
      profile.frostDates
    );
    for (const a of alerts) {
      if (a.severity !== 'soon') continue;
      tasks.push({
        id: `alert-${a.crop}-${a.headline}-${dateKey(today)}`,
        icon: cropIcon(a.crop),
        iconBg: cropIconBg(a.crop),
        title: a.headline,
        detail: a.detail,
        category: categorize(a.headline + ' ' + a.detail),
      });
    }
  } else if (profile.isPro) {
    for (const crop of profile.crops) {
      if (crop === 'other') continue;
      const bucket = (profile.plantedWeeks[crop] ?? 'w2') as PlantedBucket;
      if (bucket !== 'w0') continue;
      const guidance = plantingGuidanceFor(crop, profile.frostDates, today);
      if (!guidance.date || !sameDay(guidance.date, date)) continue;
      tasks.push({
        id: `plant-${crop}-${dateKey(date)}`,
        icon: cropIcon(crop),
        iconBg: cropIconBg(crop),
        title: guidance.headline,
        detail: guidance.detail,
        category: 'tend',
      });
    }
  }
  return tasks;
}

/** Today's checkable tasks — watering plus, for Pro, any crop-stage alert
 * urgent enough to act on today (the "Stage & harvest alerts" Pro benefit —
 * see PaywallScreen.tsx). Nothing here is ever from the future: watering
 * only ever reflects the most recent scheduled day at or before today, and
 * alerts only fire once their own condition (e.g. a planting date) is
 * actually due. If that most recent scheduled watering never got checked
 * off, it stays exactly as-is under its original date/id rather than
 * disappearing — it keeps showing, one day at a time, until it's done or a
 * later scheduled day replaces it as "most recent."
 *
 * Alerts work differently: their id is scoped to today's date, so they
 * naturally rotate as a crop's stage (and its headline) moves forward, and
 * reset fresh each day rather than staying "done" forever — that's
 * deliberate, since most of them are ongoing care reminders (e.g. "keep
 * soil evenly moist") rather than a one-time box to check. */
export function getTodayTasks(profile: GardenProfile, today: Date = new Date()): DailyTask[] {
  const tasks: DailyTask[] = [];
  const result = scheduleFor(profile);
  const waterDate = mostRecentWateringDay(result.sessionsPerWeek, today);
  const waterId = `water-${dateKey(waterDate)}`;
  if (!isTaskComplete(profile, waterId)) {
    tasks.push({
      id: waterId,
      icon: '💧',
      iconBg: colors.selectedBg,
      title: 'Water the garden',
      detail: `${result.minutesPerSession} min · ${timeOfDayLabel(result.timeOfDay)}`,
      category: 'tend',
    });
  }
  if (profile.isPro) {
    const alerts = getAlerts(
      profile.crops,
      profile.plantedWeeks as Partial<Record<CropKey, PlantedBucket>>,
      profile.weather,
      profile.frostDates
    );
    for (const a of alerts) {
      if (a.severity !== 'soon') continue;
      tasks.push({
        id: `alert-${a.crop}-${a.headline}-${dateKey(today)}`,
        icon: cropIcon(a.crop),
        iconBg: cropIconBg(a.crop),
        title: a.headline,
        detail: a.detail,
        category: categorize(a.headline + ' ' + a.detail),
      });
    }
  }
  return tasks;
}

export function isTaskComplete(profile: GardenProfile, taskId: string): string | null {
  return profile.taskCompletions?.[taskId] ?? null;
}

export function toggleTask(profile: GardenProfile, taskId: string): GardenProfile {
  const completions = { ...(profile.taskCompletions ?? {}) };
  if (completions[taskId]) {
    delete completions[taskId];
  } else {
    completions[taskId] = new Date().toISOString();
  }
  return { ...profile, taskCompletions: completions };
}

function completedDateSet(profile: GardenProfile): Set<string> {
  const completions = profile.taskCompletions ?? {};
  return new Set(Object.values(completions).map((iso) => iso.slice(0, 10)));
}

/** Consecutive days (walking back from today) with at least one completed
 * task. Today doesn't have to be done yet for the streak to still count —
 * it just resumes counting from yesterday until today closes out. */
export function computeStreak(profile: GardenProfile, today: Date = new Date()): number {
  const dates = completedDateSet(profile);
  const cursor = new Date(today);
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive completed days ever, for the "your longest
 * run is N days" line — a real number derived from completion history. */
export function computeLongestStreak(profile: GardenProfile): number {
  const dates = Array.from(completedDateSet(profile)).sort();
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const cur = new Date(dates[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
