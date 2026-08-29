import {
  categorize,
  computeLongestStreak,
  computeStreak,
  dateKey,
  getTasksForDate,
  getTodayTasks,
  isTaskComplete,
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
});

describe('getTodayTasks', () => {
  it('includes soon-severity crop-stage alerts for Pro', () => {
    const profile = makeProfile({ plantedWeeks: { tomatoes: 'w4' }, isPro: true });
    const tasks = getTodayTasks(profile, TUE);
    expect(tasks.some((t) => t.id === `alert-tomatoes-Flowering & fruit set approaching-${dateKey(TUE)}`)).toBe(
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
