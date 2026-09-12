import {
  assumedPlantedDateForBucket,
  categorize,
  computeLongestStreak,
  computeStreak,
  dateKey,
  effectiveBackdate,
  effectiveBucket,
  getFeedReminders,
  getSeedCollectionReminders,
  harvestWindowsFor,
  seedCollectionWindowsFor,
  getSuccessionReminders,
  getTreeWateringReminders,
  plantedAgoLabel,
  getTasksForDate,
  getTodayTasks,
  isTaskComplete,
  markPlanted,
  toggleTask,
} from '../taskEngine';
import { GardenProfile } from '../../types';
import { bedCrops, cropIcon, cropIconBg } from '../../cropMeta';

// Jan 1 2024 is a known Monday, so sun:'full' (sessions=[Mon,Wed,Fri]) makes
// Jan 1/3 watering days and Jan 2 a non-watering day, without depending on
// whatever day the test happens to run.
const MON = new Date(2024, 0, 1);
const TUE = new Date(2024, 0, 2);
const WED = new Date(2024, 0, 3);

function makeProfile(overrides: Partial<GardenProfile> = {}): GardenProfile {
  return {
    schemaVersion: 1,
    crops: ['tomatoes'],
    plantedWeeks: { tomatoes: 'w2' },
    sun: 'full',
    bedWidthFt: 4,
    bedLengthFt: 4,
    method: 'drip',
    lineSpacingIn: 12,
    emitterSpacingIn: 12,
    emitterGph: 0.5,
    location: null,
    weather: null,
    weatherFetchedAt: null,
    scheduledReminders: [],
    notificationsEnabled: true,
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('categorize', () => {
  it('detects harvest, feed, and prune keywords case-insensitively', () => {
    expect(categorize('Time to HARVEST the tomatoes')).toBe('harvest');
    expect(categorize('pick the cucumbers')).toBe('harvest');
    expect(categorize('Feed with fertilizer')).toBe('feed');
    expect(categorize('Prune the suckers')).toBe('prune');
  });

  it('falls back to tend when nothing matches', () => {
    expect(categorize('Water the garden')).toBe('tend');
  });
});

describe('getTasksForDate', () => {
  it('includes a watering task on a scheduled watering day', () => {
    const profile = makeProfile();
    const tasks = getTasksForDate(profile, MON);
    expect(tasks.some((t) => t.id === `water-${dateKey(MON)}`)).toBe(true);
    expect(tasks.find((t) => t.id.startsWith('water-'))?.category).toBe('tend');
  });

  it('omits the watering task on a non-watering day with no reminders', () => {
    const profile = makeProfile();
    expect(getTasksForDate(profile, TUE)).toEqual([]);
  });

  it('shows a harvest logged on that exact day, as a read-only record', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '4 tomatoes', dateISO: TUE.toISOString() }],
    });
    const tasks = getTasksForDate(profile, TUE);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 'harvested-h1', title: 'Picked Tomatoes', detail: '4 tomatoes', category: 'harvest' });
  });

  it('falls back to a weight-based detail when a harvest has no note', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: TUE.toISOString() }],
    });
    expect(getTasksForDate(profile, TUE)[0].detail).toBe('2 lbs picked');
  });

  it('does not show a harvest logged on a different day', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: MON.toISOString() }],
    });
    expect(getTasksForDate(profile, TUE).some((t) => t.id === 'harvested-h1')).toBe(false);
  });

  it('is not Pro-gated, unlike most other reminder types here', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: false,
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: TUE.toISOString() }],
    });
    expect(getTasksForDate(profile, TUE).some((t) => t.id === 'harvested-h1')).toBe(true);
  });

  it('does not appear on Home\'s today list, only on the calendar', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: TUE.toISOString() }],
    });
    expect(getTodayTasks(profile, TUE).some((t) => t.id === 'harvested-h1')).toBe(false);
  });

  it('never invents a bed watering task for a garden with only tree-category crops', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w4' } });
    for (const day of [MON, TUE, WED]) {
      expect(getTasksForDate(profile, day).some((t) => t.id.startsWith('water-'))).toBe(false);
    }
  });

  it('includes a scheduled reminder on its date, categorized from its own text', () => {
    const profile = makeProfile({
      crops: ['cucumbers'],
      scheduledReminders: [
        {
          id: 'r1',
          title: 'Harvest the cucumbers',
          cropLabel: 'cucumbers',
          dateISO: TUE.toISOString(),
          body: 'They are ready.',
        },
      ],
    });
    const tasks = getTasksForDate(profile, TUE);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: 'reminder-r1',
      title: 'Harvest the cucumbers',
      category: 'harvest',
      icon: cropIcon('cucumbers'),
      iconBg: cropIconBg('cucumbers'),
    });
  });

  it('falls back to a generic icon when a reminder crop is not in the garden', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      scheduledReminders: [
        {
          id: 'r2',
          title: 'Check on it',
          cropLabel: 'basil',
          dateISO: TUE.toISOString(),
          body: '',
        },
      ],
    });
    const tasks = getTasksForDate(profile, TUE);
    expect(tasks[0].icon).toBe('🌱');
    expect(tasks[0].iconBg).toBe(cropIconBg('other'));
  });

  it('excludes reminders scheduled for a different date', () => {
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'r3', title: 'Later', cropLabel: 'tomatoes', dateISO: WED.toISOString(), body: '' },
      ],
    });
    expect(getTasksForDate(profile, TUE)).toEqual([]);
  });

  describe('not-yet-planted crop guidance', () => {
    const FIXED_NOW = new Date(2024, 3, 1); // April 1 — well before tomatoes' May 8 target
    const frostDates = {
      lastFrostMonthDay: '05-01',
      firstFrostMonthDay: null,
      isNorthernHemisphere: true,
      fetchedAt: new Date().toISOString(),
    };
    const target = new Date(2024, 4, 8); // tomatoes: 1 week after last frost

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('surfaces a not-yet-planted crop on its calculated planting date, for Pro', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedWeeks: { tomatoes: 'w0' },
        frostDates,
        isPro: true,
      });
      const tasks = getTasksForDate(profile, target);
      expect(tasks.some((t) => t.title.includes('Tomatoes'))).toBe(true);
    });

    it('omits it on a date other than the calculated target', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedWeeks: { tomatoes: 'w0' },
        frostDates,
        isPro: true,
      });
      expect(getTasksForDate(profile, new Date(2024, 4, 9))).toEqual([]);
    });

    it('is Pro-gated: free users see nothing even on the target date', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedWeeks: { tomatoes: 'w0' },
        frostDates,
        isPro: false,
      });
      expect(getTasksForDate(profile, target).some((t) => t.id.startsWith('plant-'))).toBe(false);
    });

    it('excludes crops that are already planted', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedWeeks: { tomatoes: 'w2' },
        frostDates,
        isPro: true,
      });
      expect(getTasksForDate(profile, target).some((t) => t.id.startsWith('plant-'))).toBe(false);
    });
  });

  describe("today's calendar cell mirrors Home's task list", () => {
    const FIXED_NOW = new Date(2024, 8, 3); // Sep 3
    const frostDates = {
      lastFrostMonthDay: '04-15',
      firstFrostMonthDay: '11-15',
      isNorthernHemisphere: true,
      fetchedAt: new Date().toISOString(),
    };

    it("shows a not-yet-planted crop's 'plant now' alert on today, not just its original target day", () => {
      // Broccoli's fall target (12 weeks before Nov 15) is Aug 23 — already
      // past by Sep 3. Home shows this as due *today* regardless; Calendar's
      // today cell should match, not just show it back on Aug 23.
      const profile = makeProfile({
        crops: ['broccoli'],
        plantedWeeks: { broccoli: 'w0' },
        frostDates,
        isPro: true,
      });
      const todayTasks = getTasksForDate(profile, FIXED_NOW, FIXED_NOW);
      expect(todayTasks.some((t) => t.title.includes('Broccoli'))).toBe(true);
    });

    it("shows an already-planted crop's soon-severity stage alert on today", () => {
      // This is the gap the calendar previously had entirely: stage alerts
      // for crops already in the ground never appeared there at all, only
      // the watering task did.
      const profile = makeProfile({
        crops: ['celery'],
        plantedWeeks: { celery: 'w2' },
        frostDates,
        isPro: true,
      });
      const todayTasks = getTasksForDate(profile, FIXED_NOW, FIXED_NOW);
      expect(todayTasks.some((t) => t.title.toLowerCase().includes('celery stays thirsty'))).toBe(true);
    });

    it('does not show an ongoing stage alert on a non-today day being browsed', () => {
      const profile = makeProfile({
        crops: ['celery'],
        plantedWeeks: { celery: 'w2' },
        frostDates,
        isPro: true,
      });
      const otherDay = new Date(2024, 8, 10);
      const tasks = getTasksForDate(profile, otherDay, FIXED_NOW);
      expect(tasks.some((t) => t.title.toLowerCase().includes('celery stays thirsty'))).toBe(false);
    });

    it('drops a checked-off alert task from the calendar, unlike Home which keeps it visible', () => {
      const profile = makeProfile({
        crops: ['celery'],
        plantedWeeks: { celery: 'w2' },
        frostDates,
        isPro: true,
      });
      const before = getTasksForDate(profile, FIXED_NOW, FIXED_NOW);
      const task = before.find((t) => t.id.startsWith('alert-'));
      expect(task).toBeDefined();

      const checkedOffProfile = toggleTask(profile, task!.id);
      // Home keeps showing it (with a checkmark) once toggled complete.
      const homeTasks = getTodayTasks(checkedOffProfile, FIXED_NOW);
      expect(homeTasks.some((t) => t.id === task!.id)).toBe(true);
      // The calendar has no checkbox of its own, so it drops instead.
      const calendarTasks = getTasksForDate(checkedOffProfile, FIXED_NOW, FIXED_NOW);
      expect(calendarTasks.some((t) => t.id === task!.id)).toBe(false);
    });

    it('drops a checked-off watering task from the calendar too', () => {
      const profile = makeProfile({ isPro: true }); // sun:'full' waters Mon/Wed/Fri
      const monday = new Date(2024, 0, 1);
      const waterId = `water-${dateKey(monday)}`;
      expect(getTasksForDate(profile, monday, monday).some((t) => t.id === waterId)).toBe(true);

      const checkedOffProfile = toggleTask(profile, waterId);
      expect(getTasksForDate(checkedOffProfile, monday, monday).some((t) => t.id === waterId)).toBe(false);
    });
  });
});

describe('getTodayTasks', () => {
  it('includes soon-severity crop-stage alerts for Pro', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' }, isPro: true });
    const tasks = getTodayTasks(profile, TUE);
    expect(tasks.some((t) => t.id === `alert-tomatoes-Water on a consistent schedule-${dateKey(TUE)}`)).toBe(
      true
    );
  });

  it('excludes low-severity crop-stage alerts even for Pro', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w0' }, isPro: true });
    const tasks = getTodayTasks(profile, TUE);
    expect(tasks.some((t) => t.id.startsWith('alert-'))).toBe(false);
  });

  it('excludes crop-stage alerts entirely on the free tier', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' } });
    const tasks = getTodayTasks(profile, TUE);
    expect(tasks.some((t) => t.id.startsWith('alert-'))).toBe(false);
  });

  it('includes the watering task alongside alerts when both are due for Pro', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' }, isPro: true });
    const tasks = getTodayTasks(profile, MON);
    expect(tasks.some((t) => t.id.startsWith('water-'))).toBe(true);
    expect(tasks.some((t) => t.id.startsWith('alert-'))).toBe(true);
  });

  it('carries an unfinished watering task forward to the next (non-watering) day', () => {
    const profile = makeProfile(); // MON never marked complete
    const tasks = getTodayTasks(profile, TUE);
    expect(tasks.some((t) => t.id === `water-${dateKey(MON)}`)).toBe(true);
  });

  it('drops the watering task once the most recent scheduled day is marked complete', () => {
    const withMonDone = toggleTask(makeProfile(), `water-${dateKey(MON)}`);
    const tasks = getTodayTasks(withMonDone, TUE);
    expect(tasks.some((t) => t.id.startsWith('water-'))).toBe(false);
  });

  it('shows the new day\'s own watering task once it comes due, not the old completed one', () => {
    const withMonDone = toggleTask(makeProfile(), `water-${dateKey(MON)}`);
    const tasks = getTodayTasks(withMonDone, WED); // WED is the next scheduled day
    expect(tasks.some((t) => t.id === `water-${dateKey(WED)}`)).toBe(true);
    expect(tasks.some((t) => t.id === `water-${dateKey(MON)}`)).toBe(false);
  });

  it('never invents a bed watering task for a garden with only tree-category crops', () => {
    // Regression: computeSchedule used to fall back to a made-up baseTarget
    // when bedCrops(profile.crops) came back empty (an all-tree garden has
    // nothing left in the bed), producing a phantom "Water the garden" task
    // for a bed that isn't growing anything.
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w4' } });
    for (const day of [MON, TUE, WED]) {
      const tasks = getTodayTasks(profile, day);
      expect(tasks.some((t) => t.id.startsWith('water-'))).toBe(false);
    }
  });
});

describe('isTaskComplete / toggleTask', () => {
  it('marks a task complete and then incomplete again', () => {
    const taskId = `water-${dateKey(MON)}`;
    const profile = makeProfile();
    const afterFirstToggle = toggleTask(profile, taskId);
    expect(isTaskComplete(afterFirstToggle, taskId)).not.toBeNull();

    const afterSecondToggle = toggleTask(afterFirstToggle, taskId);
    expect(isTaskComplete(afterSecondToggle, taskId)).toBeNull();
  });

  it('reports incomplete for a task with no recorded completion', () => {
    expect(isTaskComplete(makeProfile(), 'never-touched')).toBeNull();
  });
});

describe('computeStreak', () => {
  it('is zero with no completions', () => {
    expect(computeStreak(makeProfile(), MON)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const profile = makeProfile({
      taskCompletions: {
        a: MON.toISOString(),
        b: TUE.toISOString(),
      },
    });
    expect(computeStreak(profile, TUE)).toBe(2);
  });

  it('still counts yesterday even if today is not done yet', () => {
    const yesterday = TUE;
    const dayBefore = MON;
    const today = WED;
    const profile = makeProfile({
      taskCompletions: {
        a: dayBefore.toISOString(),
        b: yesterday.toISOString(),
      },
    });
    expect(computeStreak(profile, today)).toBe(2);
  });

  it('resets to zero when there is a gap before today', () => {
    const profile = makeProfile({
      taskCompletions: { a: MON.toISOString() },
    });
    // WED is two days after MON — TUE (yesterday relative to WED) is missing.
    expect(computeStreak(profile, WED)).toBe(0);
  });
});

describe('computeLongestStreak', () => {
  it('is zero with no completions', () => {
    expect(computeLongestStreak(makeProfile())).toBe(0);
  });

  it('finds the longest run even when a later, shorter run exists', () => {
    const day1 = new Date(2024, 0, 1);
    const day2 = new Date(2024, 0, 2);
    const day3 = new Date(2024, 0, 3);
    const isolatedDay = new Date(2024, 0, 10);
    const profile = makeProfile({
      taskCompletions: {
        a: day1.toISOString(),
        b: day2.toISOString(),
        c: day3.toISOString(),
        d: isolatedDay.toISOString(),
      },
    });
    expect(computeLongestStreak(profile)).toBe(3);
  });
});

describe('effectiveBucket', () => {
  it('falls back to the manually picked bucket when no planted date is tracked', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' } });
    expect(effectiveBucket(profile, 'tomatoes')).toBe('w4');
  });

  it('defaults to w2 when neither a bucket nor a date is set', () => {
    const profile = makeProfile({ plantedWeeks: {} });
    expect(effectiveBucket(profile, 'tomatoes')).toBe('w2');
  });

  it('derives the bucket from a tracked planted date once enough weeks have passed, overriding a stale manual bucket', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      plantedWeeks: { tomatoes: 'w2' },
      plantedDates: { tomatoes: plantedDate.toISOString() },
    });
    expect(effectiveBucket(profile, 'tomatoes', new Date(2024, 0, 1))).toBe('w2'); // day 0
    expect(effectiveBucket(profile, 'tomatoes', new Date(2024, 0, 29))).toBe('w4'); // 4 weeks
    expect(effectiveBucket(profile, 'tomatoes', new Date(2024, 1, 26))).toBe('w8'); // 8 weeks
  });

  it('collapses a long-duration tree backdate (e.g. "2+ yrs ago") down to w8 for care content', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'y2' } });
    expect(effectiveBucket(profile, 'lemon')).toBe('w8');
  });
});

describe('effectiveBackdate', () => {
  it('preserves a long-duration tree backdate instead of collapsing it, unlike effectiveBucket', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'y2' } });
    expect(effectiveBackdate(profile, 'lemon')).toBe('y2');
    expect(effectiveBucket(profile, 'lemon')).toBe('w8');
  });

  it('falls back to w2 when nothing is set, same as effectiveBucket', () => {
    const profile = makeProfile({ plantedWeeks: {} });
    expect(effectiveBackdate(profile, 'tomatoes')).toBe('w2');
  });

  it('matches effectiveBucket for a crop with a real tracked planted date', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({ plantedDates: { tomatoes: plantedDate.toISOString() } });
    const today = new Date(2024, 1, 26); // 8 weeks later
    expect(effectiveBackdate(profile, 'tomatoes', today)).toBe(effectiveBucket(profile, 'tomatoes', today));
  });

  it('still preserves a long-duration pick once it also has a synthesized plantedDates entry', () => {
    // Regression: assumedPlantedDateForBucket populates plantedDates for
    // every manual pick now, not just "Mark as planted today." Before this
    // fix, that made a "2+ yrs" pill silently stop showing as selected the
    // instant it was tapped — plantedDates existing was enough to send this
    // through effectiveBucket, which collapsed it straight to 'w8'.
    const pickedOn = new Date(2024, 0, 1);
    const assumedDate = assumedPlantedDateForBucket('y2', pickedOn)!;
    const profile = makeProfile({
      crops: ['lemon'],
      plantedWeeks: { lemon: 'y2' },
      plantedDates: { lemon: assumedDate },
    });
    expect(effectiveBackdate(profile, 'lemon', pickedOn)).toBe('y2');
  });
});

describe('markPlanted', () => {
  it('sets both the bucket and a real planted date', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w0' } });
    const today = new Date(2024, 5, 1);
    const updated = markPlanted(profile, 'tomatoes', today);
    expect(updated.plantedWeeks.tomatoes).toBe('w2');
    expect(updated.plantedDates?.tomatoes).toBe(today.toISOString());
  });
});

describe('assumedPlantedDateForBucket', () => {
  it('is null for "not planted" — there is no date to guess at', () => {
    expect(assumedPlantedDateForBucket('w0')).toBeNull();
  });

  it('returns a real date roughly at the bucket\'s midpoint, counted back from the pick date', () => {
    const pickedOn = new Date(2024, 0, 1);
    const assumed = new Date(assumedPlantedDateForBucket('w4', pickedOn)!);
    const daysAgo = Math.round((pickedOn.getTime() - assumed.getTime()) / 86400000);
    expect(daysAgo).toBe(42); // w4's ~6-week midpoint
  });

  it('picks a date well in the past for a long-established bucket like "2+ yrs"', () => {
    const pickedOn = new Date(2024, 0, 1);
    const assumed = new Date(assumedPlantedDateForBucket('y2', pickedOn)!);
    const daysAgo = Math.round((pickedOn.getTime() - assumed.getTime()) / 86400000);
    expect(daysAgo).toBeGreaterThan(365 * 2);
  });
});

describe('plantedAgoLabel', () => {
  it('is null for a crop with no tracked planted date (bucket-only)', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' } });
    expect(plantedAgoLabel(profile, 'tomatoes', new Date(2024, 5, 1))).toBeNull();
  });

  it('says "today" the same day it was marked planted', () => {
    const today = new Date(2024, 5, 1);
    const profile = makeProfile({ plantedDates: { tomatoes: today.toISOString() } });
    expect(plantedAgoLabel(profile, 'tomatoes', today)).toBe('today');
  });

  it('counts in exact days for the first couple weeks, not a coarse bucket', () => {
    const planted = new Date(2024, 5, 1);
    const profile = makeProfile({ plantedDates: { tomatoes: planted.toISOString() } });
    expect(plantedAgoLabel(profile, 'tomatoes', new Date(2024, 5, 2))).toBe('1 day ago');
    expect(plantedAgoLabel(profile, 'tomatoes', new Date(2024, 5, 10))).toBe('9 days ago');
  });

  it('keeps advancing week by week within what used to be a single static "1-4 wks ago" bucket', () => {
    const planted = new Date(2024, 5, 1);
    const profile = makeProfile({ plantedDates: { tomatoes: planted.toISOString() } });
    // Day 14 and day 21 both fall in the coarse w2 bucket, but should read
    // as genuinely different, advancing text.
    const twoWeeksLabel = plantedAgoLabel(profile, 'tomatoes', new Date(2024, 5, 15));
    const threeWeeksLabel = plantedAgoLabel(profile, 'tomatoes', new Date(2024, 5, 22));
    expect(twoWeeksLabel).toBe('2 weeks ago');
    expect(threeWeeksLabel).toBe('3 weeks ago');
    expect(twoWeeksLabel).not.toBe(threeWeeksLabel);
  });

  it('switches to months for longer-established plantings', () => {
    const planted = new Date(2024, 0, 1);
    const profile = makeProfile({ plantedDates: { tomatoes: planted.toISOString() } });
    expect(plantedAgoLabel(profile, 'tomatoes', new Date(2024, 3, 1))).toBe('3 months ago');
  });

  it('switches to years for a long-established perennial like a citrus tree', () => {
    const planted = new Date(2022, 5, 1);
    const profile = makeProfile({ plantedDates: { lemon: planted.toISOString() } });
    expect(plantedAgoLabel(profile, 'lemon', new Date(2024, 5, 15))).toBe('2 years ago');
  });

  it('is null for a long-duration pick even once it has a synthesized plantedDates entry', () => {
    // Regression, same root cause as effectiveBackdate's: a "2+ yrs" pick's
    // synthesized date would otherwise produce a falsely precise "3 years
    // ago" the instant it's tapped, when all the user actually said was
    // "2+ yrs." Should read as unset here, same as before
    // assumedPlantedDateForBucket existed, so callers fall back to the
    // "2+ yrs" bucket label instead.
    const pickedOn = new Date(2024, 0, 1);
    const assumedDate = assumedPlantedDateForBucket('y2', pickedOn)!;
    const profile = makeProfile({
      crops: ['lemon'],
      plantedWeeks: { lemon: 'y2' },
      plantedDates: { lemon: assumedDate },
    });
    expect(plantedAgoLabel(profile, 'lemon', pickedOn)).toBeNull();
  });
});

describe('getSuccessionReminders', () => {
  const FIXED_NOW = new Date(2024, 5, 1);
  const frostDates = {
    lastFrostMonthDay: '05-01',
    firstFrostMonthDay: '11-15',
    isNorthernHemisphere: true,
    fetchedAt: new Date().toISOString(),
  };

  it('is empty for a crop with no succession data', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      plantedDates: { tomatoes: new Date(2024, 0, 1).toISOString() },
      isPro: true,
    });
    expect(getSuccessionReminders(profile, FIXED_NOW)).toEqual([]);
  });

  it('is empty without a tracked planted date, even for a succession crop', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      plantedWeeks: { arugula: 'w8' },
      isPro: true,
    });
    expect(getSuccessionReminders(profile, FIXED_NOW)).toEqual([]);
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: new Date(2024, 0, 1).toISOString() },
      frostDates,
      isPro: false,
    });
    expect(getSuccessionReminders(profile, FIXED_NOW)).toEqual([]);
  });

  it('is empty without a frost estimate, since there is no real season end to bound it by', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      isPro: true,
    });
    const twoWeeksLater = new Date(2024, 0, 15);
    expect(getSuccessionReminders(profile, twoWeeksLater)).toEqual([]);
  });

  it('skips the first cycle — the original planting itself, not a reminder to repeat it', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'], // every 2 weeks
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const oneWeekLater = new Date(2024, 0, 8);
    expect(getSuccessionReminders(profile, oneWeekLater)).toEqual([]);
  });

  it('surfaces a reminder once a full cycle has passed, and rolls to a fresh one after that', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const twoWeeksLater = new Date(2024, 0, 15);
    const cycle1 = getSuccessionReminders(profile, twoWeeksLater);
    expect(cycle1).toHaveLength(1);
    expect(cycle1[0].title).toBe('Sow more Arugula');
    expect(cycle1[0].id).toBe('succession-arugula-1');

    const fourWeeksLater = new Date(2024, 0, 29);
    expect(getSuccessionReminders(profile, fourWeeksLater)[0].id).toBe('succession-arugula-2');
  });

  it('keeps rolling to fresh cycles every couple weeks throughout the season, not just once', () => {
    // Arugula, planted Jan 1 with a Nov 15 first frost and a 4-week
    // cutoff (season end Oct 18) — over ten months there should be many
    // rounds, each with its own rolling cycle number, not just one.
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const cycleIds = new Set<string>();
    for (let day = 1; day <= 291; day += 7) {
      const checkDate = new Date(plantedDate.getTime() + day * 86400000);
      for (const t of getSuccessionReminders(profile, checkDate)) {
        cycleIds.add(t.id);
      }
    }
    // Every-2-weeks from Jan 1 through the Oct 18 season end is well over
    // ten distinct rounds, not the single occurrence the old code capped at.
    expect(cycleIds.size).toBeGreaterThan(10);
  });

  it('stops once the crop is past its real, frost-bounded season end', () => {
    // Season end is Oct 18 (Nov 15 frost minus arugula's 4-week cutoff).
    // Well past that, in December, no more rounds should be suggested even
    // though the every-2-weeks arithmetic alone would keep producing them.
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const midDecember = new Date(2024, 11, 15);
    expect(getSuccessionReminders(profile, midDecember)).toEqual([]);
  });

  it('shows up in both getTodayTasks and today\'s calendar cell', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const dueDate = new Date(2024, 0, 15);
    expect(getTodayTasks(profile, dueDate).some((t) => t.id === 'succession-arugula-1')).toBe(true);
    expect(getTasksForDate(profile, dueDate, dueDate).some((t) => t.id === 'succession-arugula-1')).toBe(true);
  });

  it('drops from the calendar (but stays visible on Home) once checked off', () => {
    const plantedDate = new Date(2024, 0, 1);
    const profile = makeProfile({
      crops: ['arugula'],
      plantedDates: { arugula: plantedDate.toISOString() },
      frostDates,
      isPro: true,
    });
    const dueDate = new Date(2024, 0, 15);
    const checkedOff = toggleTask(profile, 'succession-arugula-1');
    expect(getTodayTasks(checkedOff, dueDate).some((t) => t.id === 'succession-arugula-1')).toBe(true);
    expect(getTasksForDate(checkedOff, dueDate, dueDate).some((t) => t.id === 'succession-arugula-1')).toBe(false);
  });

  describe('future succession dates on the calendar (browsing ahead, not just today)', () => {
    it('marks the exact future date the next round comes due, when marked planted today', () => {
      // The reported case: broccoli and arugula both marked planted
      // "today" (Sep 9) — arugula being every 2 weeks, its next sowing
      // should land on the calendar on Sep 23, not stay invisible until
      // that day actually arrives.
      const plantedToday = new Date(2024, 8, 9); // Sep 9
      const profile = makeProfile({
        crops: ['arugula'],
        plantedDates: { arugula: plantedToday.toISOString() },
        frostDates,
        isPro: true,
      });
      const twoWeeksOut = new Date(2024, 8, 23); // Sep 23
      const tasks = getTasksForDate(profile, twoWeeksOut, plantedToday);
      expect(tasks.some((t) => t.id === 'succession-arugula-1' && t.title === 'Sow more Arugula')).toBe(true);
    });

    it('marks every future round through the season, not just the first one', () => {
      // Same Sep 9 planting, Nov 15 frost, arugula's 4-week cutoff — season
      // end lands Oct 18, so rounds due Sep 23 and Oct 7 both fit, but the
      // next one (Oct 21) falls after the season end and should not appear.
      const plantedToday = new Date(2024, 8, 9);
      const profile = makeProfile({
        crops: ['arugula'],
        plantedDates: { arugula: plantedToday.toISOString() },
        frostDates,
        isPro: true,
      });
      const round1 = getTasksForDate(profile, new Date(2024, 8, 23), plantedToday);
      const round2 = getTasksForDate(profile, new Date(2024, 9, 7), plantedToday);
      const pastSeasonEnd = getTasksForDate(profile, new Date(2024, 9, 21), plantedToday);
      expect(round1.some((t) => t.id === 'succession-arugula-1')).toBe(true);
      expect(round2.some((t) => t.id === 'succession-arugula-2')).toBe(true);
      expect(pastSeasonEnd.some((t) => t.id.startsWith('succession-'))).toBe(false);
    });

    it('covers newly-added succession crops like corn and basil', () => {
      const plantedToday = new Date(2024, 3, 15); // Apr 15
      const profile = makeProfile({
        crops: ['corn', 'basil'],
        plantedDates: {
          corn: plantedToday.toISOString(),
          basil: plantedToday.toISOString(),
        },
        frostDates,
        isPro: true,
      });
      // Corn: every 2 weeks -> first round Apr 29.
      const cornRound = getTasksForDate(profile, new Date(2024, 3, 29), plantedToday);
      expect(cornRound.some((t) => t.id === 'succession-corn-1' && t.title === 'Sow more Corn')).toBe(true);
      // Basil: every 4 weeks -> first round May 13.
      const basilRound = getTasksForDate(profile, new Date(2024, 4, 13), plantedToday);
      expect(basilRound.some((t) => t.id === 'succession-basil-1' && t.title === 'Sow more Basil')).toBe(true);
    });

    it('does not mark any other day in between', () => {
      const plantedToday = new Date(2024, 8, 9);
      const profile = makeProfile({
        crops: ['arugula'],
        plantedDates: { arugula: plantedToday.toISOString() },
        frostDates,
        isPro: true,
      });
      const oneWeekOut = new Date(2024, 8, 16);
      const tasks = getTasksForDate(profile, oneWeekOut, plantedToday);
      expect(tasks.some((t) => t.id.startsWith('succession-'))).toBe(false);
    });

    it('is absent for a crop with no succession data (e.g. broccoli), even once planted', () => {
      const plantedToday = new Date(2024, 8, 9);
      const profile = makeProfile({
        crops: ['broccoli'],
        plantedDates: { broccoli: plantedToday.toISOString() },
        frostDates,
        isPro: true,
      });
      // Scan a full month out — broccoli should never get a succession marker.
      for (let d = 1; d <= 30; d++) {
        const day = new Date(2024, 8, d);
        const tasks = getTasksForDate(profile, day, plantedToday);
        expect(tasks.some((t) => t.id.startsWith('succession-'))).toBe(false);
      }
    });

    it('the future-dated task id matches what today\'s cell would show once that day arrives', () => {
      const plantedToday = new Date(2024, 8, 9);
      const profile = makeProfile({
        crops: ['arugula'],
        plantedDates: { arugula: plantedToday.toISOString() },
        frostDates,
        isPro: true,
      });
      const dueDate = new Date(2024, 8, 23);
      const browsingAhead = getTasksForDate(profile, dueDate, plantedToday).find((t) =>
        t.id.startsWith('succession-')
      );
      const onceItsToday = getTasksForDate(profile, dueDate, dueDate).find((t) => t.id.startsWith('succession-'));
      expect(browsingAhead?.id).toBe(onceItsToday?.id);
    });
  });

  it('lets a crop backdated only via a bucket pill still get a succession reminder', () => {
    // Same bug as getFeedReminders' bucket-only case: without a synthesized
    // plantedDates entry, a bucket-only pick could never get a succession
    // reminder either.
    const pickedOn = new Date(2024, 2, 1); // March 1
    const assumedDate = assumedPlantedDateForBucket('w2', pickedOn)!;
    const profile = makeProfile({
      crops: ['arugula'],
      plantedWeeks: { arugula: 'w2' },
      plantedDates: { arugula: assumedDate },
      frostDates,
      isPro: true,
    });
    const dueDate = new Date(new Date(assumedDate).getTime() + 20 * 86400000); // ~2 cycles later
    expect(getSuccessionReminders(profile, dueDate).some((t) => t.id.startsWith('succession-arugula-'))).toBe(true);
  });
});

describe('getFeedReminders', () => {
  const frostDates = {
    lastFrostMonthDay: '05-01',
    firstFrostMonthDay: '11-15',
    isNorthernHemisphere: true,
    fetchedAt: new Date().toISOString(),
  };

  it('is empty for a crop with no feeding data (e.g. carrots — extra nitrogen just grows leaves, not roots)', () => {
    const profile = makeProfile({
      crops: ['carrots'],
      plantedDates: { carrots: new Date(2024, 3, 1).toISOString() },
      frostDates,
      isPro: true,
    });
    for (let month = 3; month <= 9; month++) {
      expect(getFeedReminders(profile, new Date(2024, month, 15))).toEqual([]);
    }
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({
      crops: ['lemon'],
      plantedDates: { lemon: new Date(2023, 5, 1).toISOString() },
      frostDates,
      isPro: false,
    });
    expect(getFeedReminders(profile, new Date(2024, 4, 8))).toEqual([]);
  });

  it('tags a feeding reminder with the "feed" category, distinct from succession sowing', () => {
    const profile = makeProfile({
      crops: ['lemon'],
      plantedDates: { lemon: new Date(2023, 5, 1).toISOString() },
      frostDates,
      isPro: true,
    });
    const tasks = getFeedReminders(profile, new Date(2024, 4, 8));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].category).toBe('feed');
    expect(tasks[0].title).toBe('Fertilize Lemon tree');
  });

  it('includes a placeholder Amazon "buy now" link, scoped to the specific crop', () => {
    const profile = makeProfile({
      crops: ['lemon'],
      plantedDates: { lemon: new Date(2023, 5, 1).toISOString() },
      frostDates,
      isPro: true,
    });
    const tasks = getFeedReminders(profile, new Date(2024, 4, 8));
    expect(tasks[0].buyUrl).toContain('amazon.com');
    expect(tasks[0].buyUrl).toContain(encodeURIComponent('Lemon tree fertilizer'));
  });

  describe('perennial trees (citrus etc.) — recurs every year, not just the planting year', () => {
    // Lemon planted well before this test's window, established long ago.
    // Every 4 weeks, starting 1 week after last frost (05-01 -> 05-08),
    // stopping 6 weeks before first frost (11-15 -> 10-04).
    const plantedDate = new Date(2023, 5, 1);

    it('is due on the first feeding date of the season', () => {
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      const firstFeed = new Date(2024, 4, 8); // May 8
      const tasks = getFeedReminders(profile, firstFeed);
      expect(tasks.some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
    });

    it('rolls to the next cycle 4 weeks later', () => {
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      const secondFeed = new Date(2024, 5, 5); // Jun 5 (4 weeks after May 8)
      const tasks = getFeedReminders(profile, secondFeed);
      expect(tasks.some((t) => t.id === 'feed-lemon-2024-2')).toBe(true);
    });

    it('stops once past that year\'s cutoff before first frost', () => {
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      const lateOctober = new Date(2024, 9, 20); // past the Oct 4 cutoff
      expect(getFeedReminders(profile, lateOctober)).toEqual([]);
    });

    it('comes back again the following spring — a real perennial, not a one-season reminder', () => {
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      const nextSpringFeed = new Date(2025, 4, 8); // May 8, 2025
      const tasks = getFeedReminders(profile, nextSpringFeed);
      expect(tasks.some((t) => t.id === 'feed-lemon-2025-1')).toBe(true);
    });

    it('does not start before the tree is actually planted, in the establishment year', () => {
      // Planted mid-June 2024, after that year's May 8 window start —
      // the establishment year's first feed should wait for the planting
      // itself, not fire on the generic May 8 date before the tree exists.
      const plantedMidJune = new Date(2024, 5, 15);
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedMidJune.toISOString() },
        frostDates,
        isPro: true,
      });
      expect(getFeedReminders(profile, new Date(2024, 4, 8))).toEqual([]);
      expect(getFeedReminders(profile, plantedMidJune).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
    });
  });

  describe('annual vegetables (tomatoes etc.) — one season, tied to that planting', () => {
    // Tomatoes: every 4 weeks starting 5 weeks after planting, stopping 8
    // weeks before first frost.
    const plantedDate = new Date(2024, 4, 1); // May 1

    it('is not due before the first feeding date', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedDates: { tomatoes: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      expect(getFeedReminders(profile, new Date(2024, 4, 15))).toEqual([]);
    });

    it('is due once flowering-stage feeding starts, 5 weeks after planting', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedDates: { tomatoes: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      const firstFeed = new Date(2024, 5, 5); // Jun 5 = May 1 + 5 weeks
      expect(getFeedReminders(profile, firstFeed).some((t) => t.id === 'feed-tomatoes-1')).toBe(true);
    });

    it('stops once the season ends, unlike a perennial it does not return next year from this same call', () => {
      const profile = makeProfile({
        crops: ['tomatoes'],
        plantedDates: { tomatoes: plantedDate.toISOString() },
        frostDates,
        isPro: true,
      });
      expect(getFeedReminders(profile, new Date(2024, 9, 15))).toEqual([]);
    });
  });

  describe('bucket-only crops (no exact plantedDates) — the bug this fixes', () => {
    // Before assumedPlantedDateForBucket existed, a crop backdated only via
    // a manual bucket pill (the common case — most users never tap "Mark
    // as planted today") had no plantedDates entry at all, so it could
    // never get a feed reminder, silently, even on Pro. The screens now
    // synthesize an approximate plantedDates entry from the bucket instead
    // of leaving it empty; these tests confirm that actually unblocks the
    // reminder once it's in place.
    it('lets a lemon tree backdated only via a bucket pill still get a feed reminder', () => {
      const pickedOn = new Date(2024, 0, 1);
      const assumedDate = assumedPlantedDateForBucket('y1', pickedOn);
      expect(assumedDate).not.toBeNull();
      const profile = makeProfile({
        crops: ['lemon'],
        plantedWeeks: { lemon: 'y1' },
        plantedDates: { lemon: assumedDate! },
        frostDates,
        isPro: true,
      });
      const firstFeed = new Date(2024, 4, 8); // this season's first feed date
      expect(getFeedReminders(profile, firstFeed).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
    });
  });

  describe('integration with Home and Calendar', () => {
    const frostDatesLocal = frostDates;

    it('shows up on Home today', () => {
      const plantedDate = new Date(2023, 5, 1);
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates: frostDatesLocal,
        isPro: true,
      });
      const dueDate = new Date(2024, 4, 8);
      expect(getTodayTasks(profile, dueDate).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
    });

    it('shows up on the calendar both for today and when browsing ahead', () => {
      const plantedDate = new Date(2023, 5, 1);
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates: frostDatesLocal,
        isPro: true,
      });
      const dueDate = new Date(2024, 4, 8);
      const earlierToday = new Date(2024, 3, 1);
      expect(getTasksForDate(profile, dueDate, dueDate).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
      expect(getTasksForDate(profile, dueDate, earlierToday).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
    });

    it('drops from the calendar (but stays visible on Home) once checked off', () => {
      const plantedDate = new Date(2023, 5, 1);
      const profile = makeProfile({
        crops: ['lemon'],
        plantedDates: { lemon: plantedDate.toISOString() },
        frostDates: frostDatesLocal,
        isPro: true,
      });
      const dueDate = new Date(2024, 4, 8);
      const checkedOff = toggleTask(profile, 'feed-lemon-2024-1');
      expect(getTodayTasks(checkedOff, dueDate).some((t) => t.id === 'feed-lemon-2024-1')).toBe(true);
      expect(getTasksForDate(checkedOff, dueDate, dueDate).some((t) => t.id === 'feed-lemon-2024-1')).toBe(false);
    });
  });
});

describe('bedCrops (trees excluded from the bed watering schedule)', () => {
  it('drops tree crops but keeps everything else', () => {
    expect(bedCrops(['tomatoes', 'lemon', 'carrots', 'avocado'])).toEqual(['tomatoes', 'carrots']);
  });

  it('leaves a garden of only trees empty', () => {
    expect(bedCrops(['lemon', 'lime'])).toEqual([]);
  });

  it('adding a tree to the garden does not change the "Water the garden" task', () => {
    const withoutTree = makeProfile({ crops: ['radishes'], plantedWeeks: { radishes: 'w2' }, isPro: true });
    const withTree = makeProfile({
      crops: ['radishes', 'avocado'],
      plantedWeeks: { radishes: 'w2', avocado: 'w8' },
      isPro: true,
    });
    const waterTaskWithout = getTodayTasks(withoutTree, MON).find((t) => t.id.startsWith('water-'));
    const waterTaskWith = getTodayTasks(withTree, MON).find((t) => t.id.startsWith('water-'));
    expect(waterTaskWith?.detail).toBe(waterTaskWithout?.detail);
  });
});

describe('getTreeWateringReminders', () => {
  it('is empty for a crop with no tree-watering data (e.g. tomatoes)', () => {
    const profile = makeProfile({ crops: ['tomatoes'], plantedWeeks: { tomatoes: 'w8' }, isPro: true });
    expect(getTreeWateringReminders(profile, new Date(2024, 0, 3))).toEqual([]);
  });

  it('is empty for a tree that has not been planted yet', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w0' }, isPro: true });
    expect(getTreeWateringReminders(profile, new Date(2024, 0, 3))).toEqual([]);
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w8' }, isPro: false });
    expect(getTreeWateringReminders(profile, new Date(2024, 0, 3))).toEqual([]);
  });

  it('is due on its cadence day and not on other days, backdated via a pill alone (no exact date needed)', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'y2' }, isPro: true });
    const jan3 = new Date(2024, 0, 3);
    const jan4 = new Date(2024, 0, 4);
    const dueDay = getTreeWateringReminders(profile, jan3);
    const offDay = getTreeWateringReminders(profile, jan4);
    expect(
      dueDay.some((t) => t.id === `treewater-lemon-${dateKey(jan3)}` && t.title === 'Water Lemon tree')
    ).toBe(true);
    expect(offDay).toEqual([]);
  });

  it('tags the reminder with the "tend" category', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w8' }, isPro: true });
    const tasks = getTreeWateringReminders(profile, new Date(2024, 0, 3));
    expect(tasks[0].category).toBe('tend');
  });

  it('spreads multiple trees on the same cadence across different days instead of clustering them', () => {
    const profile = makeProfile({
      crops: ['lemon', 'lime'],
      plantedWeeks: { lemon: 'w8', lime: 'w8' },
      isPro: true,
    });
    // lemon is due Jan 3, lime is due Jan 1 and Jan 4 — not the same day.
    const jan3 = getTreeWateringReminders(profile, new Date(2024, 0, 3));
    expect(jan3.some((t) => t.id.startsWith('treewater-lemon-'))).toBe(true);
    expect(jan3.some((t) => t.id.startsWith('treewater-lime-'))).toBe(false);
  });

  it('shows up on Home and on the calendar, and drops from the calendar (but not Home) once checked off', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w8' }, isPro: true });
    const dueDate = new Date(2024, 0, 3);
    const id = `treewater-lemon-${dateKey(dueDate)}`;
    expect(getTodayTasks(profile, dueDate).some((t) => t.id === id)).toBe(true);
    expect(getTasksForDate(profile, dueDate, dueDate).some((t) => t.id === id)).toBe(true);

    const checkedOff = toggleTask(profile, id);
    expect(getTodayTasks(checkedOff, dueDate).some((t) => t.id === id)).toBe(true);
    expect(getTasksForDate(checkedOff, dueDate, dueDate).some((t) => t.id === id)).toBe(false);
  });

  it('shows on the calendar when browsing a future date, not just today', () => {
    const profile = makeProfile({ crops: ['lemon'], plantedWeeks: { lemon: 'w8' }, isPro: true });
    const today = new Date(2024, 0, 1);
    const futureDueDay = new Date(2024, 0, 6); // also a lemon due day
    const tasks = getTasksForDate(profile, futureDueDay, today);
    expect(tasks.some((t) => t.id === `treewater-lemon-${dateKey(futureDueDay)}`)).toBe(true);
  });
});

describe('getSeedCollectionReminders', () => {
  it('is empty for a harvest not marked as the final one of the season', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: new Date(2024, 6, 1).toISOString() }],
    });
    const dueDate = new Date(2024, 6, 22); // 3 weeks later
    expect(getSeedCollectionReminders(profile, dueDate)).toEqual([]);
  });

  it('is due 3 weeks after a harvest marked as final', () => {
    const harvestDate = new Date(2024, 6, 1);
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    const dueDate = new Date(2024, 6, 22); // 3 weeks later
    const tasks = getSeedCollectionReminders(profile, dueDate);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 'seeds-h1', title: 'Collect seeds from Tomatoes', category: 'seed' });
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 21))).toEqual([]);
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 23))).toEqual([]);
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: false,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: new Date(2024, 6, 1).toISOString(), isFinalHarvest: true },
      ],
    });
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 22))).toEqual([]);
  });

  it('is excluded for a crop that is not realistically home-seed-saved (e.g. carrots, a root crop)', () => {
    const profile = makeProfile({
      crops: ['carrots'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'carrots', weightLbs: 1, note: '', dateISO: new Date(2024, 6, 1).toISOString(), isFinalHarvest: true },
      ],
    });
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 22))).toEqual([]);
  });

  it('is excluded for a tree crop (e.g. lemon), which is grafted rather than seed-grown at home', () => {
    const profile = makeProfile({
      crops: ['lemon'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'lemon', weightLbs: 1, note: '', dateISO: new Date(2024, 6, 1).toISOString(), isFinalHarvest: true },
      ],
    });
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 22))).toEqual([]);
  });

  it('shows up on Home and the calendar, and can be checked off', () => {
    const harvestDate = new Date(2024, 6, 1);
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    const dueDate = new Date(2024, 6, 22);
    expect(getTodayTasks(profile, dueDate).some((t) => t.id === 'seeds-h1')).toBe(true);
    expect(getTasksForDate(profile, dueDate, dueDate).some((t) => t.id === 'seeds-h1')).toBe(true);

    const checkedOff = toggleTask(profile, 'seeds-h1');
    expect(getTasksForDate(checkedOff, dueDate, dueDate).some((t) => t.id === 'seeds-h1')).toBe(false);
  });

  it('gives a second final harvest of the same crop its own separate reminder', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: new Date(2023, 6, 1).toISOString(), isFinalHarvest: true },
        { id: 'h2', crop: 'tomatoes', weightLbs: 3, note: '', dateISO: new Date(2024, 6, 1).toISOString(), isFinalHarvest: true },
      ],
    });
    expect(getSeedCollectionReminders(profile, new Date(2023, 6, 22)).map((t) => t.id)).toEqual(['seeds-h1']);
    expect(getSeedCollectionReminders(profile, new Date(2024, 6, 22)).map((t) => t.id)).toEqual(['seeds-h2']);
  });
});

describe('harvestWindowsFor', () => {
  // Arugula: sow 15% / grow 30% / harvest 55% of a 5-week (35-day) season —
  // harvest phase starts 35 * 0.45 = 15.75 days after planting and runs to
  // day 35.
  const planted = new Date(2024, 0, 1);

  it('is empty for a crop with no tracked planted date', () => {
    const profile = makeProfile({ crops: ['arugula'], isPro: true });
    expect(harvestWindowsFor(profile, new Date(2024, 0, 20))).toEqual([]);
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      isPro: false,
      plantedDates: { arugula: planted.toISOString() },
    });
    expect(harvestWindowsFor(profile, new Date(2024, 0, 20))).toEqual([]);
  });

  it('is empty before the harvest phase begins', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      isPro: true,
      plantedDates: { arugula: planted.toISOString() },
    });
    expect(harvestWindowsFor(profile, new Date(2024, 0, 6))).toEqual([]); // day 5
  });

  it('covers the crop once the harvest phase begins', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      isPro: true,
      plantedDates: { arugula: planted.toISOString() },
    });
    const windows = harvestWindowsFor(profile, new Date(2024, 0, 21)); // day 20
    expect(windows).toHaveLength(1);
    expect(windows[0].crop).toBe('arugula');
  });

  it('is empty again once the season is over', () => {
    const profile = makeProfile({
      crops: ['arugula'],
      isPro: true,
      plantedDates: { arugula: planted.toISOString() },
    });
    expect(harvestWindowsFor(profile, new Date(2024, 1, 20))).toEqual([]); // well past day 35
  });

  it('is empty for a crop with no SEASON_SHAPE entry', () => {
    const profile = makeProfile({
      crops: ['other'],
      isPro: true,
    });
    expect(harvestWindowsFor(profile, new Date(2024, 0, 20))).toEqual([]);
  });
});

describe('seedCollectionWindowsFor', () => {
  // Window is 2-4 weeks (14-28 days) after a final harvest, centered on the
  // same day getSeedCollectionReminders' single checkable task fires.
  const harvestDate = new Date(2024, 0, 1);

  it('is empty for a harvest not marked final', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [{ id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString() }],
    });
    expect(seedCollectionWindowsFor(profile, new Date(2024, 0, 21))).toEqual([]);
  });

  it('is Pro-gated', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: false,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    expect(seedCollectionWindowsFor(profile, new Date(2024, 0, 21))).toEqual([]);
  });

  it('is empty before the window opens (under 2 weeks after the final harvest)', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    expect(seedCollectionWindowsFor(profile, new Date(2024, 0, 10))).toEqual([]); // day 9
  });

  it('covers the crop across the 2-4 week window, including the midpoint the checkable task fires on', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    const midpoint = new Date(2024, 0, 22); // 3 weeks after harvestDate
    const windows = seedCollectionWindowsFor(profile, midpoint);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ crop: 'tomatoes', harvestId: 'h1' });
    expect(getSeedCollectionReminders(profile, midpoint).some((t) => t.id === 'seeds-h1')).toBe(true);
  });

  it('is empty again once the window closes (over 4 weeks after the final harvest)', () => {
    const profile = makeProfile({
      crops: ['tomatoes'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'tomatoes', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    expect(seedCollectionWindowsFor(profile, new Date(2024, 1, 5))).toEqual([]); // day 35
  });

  it('excludes a crop that is not realistically home-seed-saved (e.g. a tree)', () => {
    const profile = makeProfile({
      crops: ['lemon'],
      isPro: true,
      harvests: [
        { id: 'h1', crop: 'lemon', weightLbs: 2, note: '', dateISO: harvestDate.toISOString(), isFinalHarvest: true },
      ],
    });
    expect(seedCollectionWindowsFor(profile, new Date(2024, 0, 22))).toEqual([]);
  });
});
