import {
  categorize,
  computeLongestStreak,
  computeStreak,
  dateKey,
  effectiveBackdate,
  effectiveBucket,
  getFeedReminders,
  getSuccessionReminders,
  plantedAgoLabel,
  getTasksForDate,
  getTodayTasks,
  isTaskComplete,
  markPlanted,
  toggleTask,
} from '../taskEngine';
import { GardenProfile } from '../../types';
import { cropIcon, cropIconBg } from '../../cropMeta';

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
