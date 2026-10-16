import { seedStartPlan } from '../plantingGuide';
import {
  getTasksForDate,
  getTodayTasks,
  nextSeedStep,
  toggleTask,
  effectiveBucket,
  currentSeedStep,
} from '../taskEngine';
import { planNudges } from '../nudgeEngine';
import { GardenProfile } from '../../types';

const frostDates = {
  lastFrostMonthDay: '05-01',
  firstFrostMonthDay: '10-15',
  isNorthernHemisphere: true,
  fetchedAt: '2026-01-01T00:00:00.000Z',
};

// Peppers start 8 weeks before a May 1 last frost and go out 2 weeks after
// it. Mar 6 → May 15 crosses the March daylight-saving change, which is
// what caught addWeeks landing a day early.
const JAN_15 = new Date(2026, 0, 15, 9);
const START = new Date(2026, 2, 6, 9); // Mar 6
const HARDEN = new Date(2026, 4, 8, 9); // May 8
const TRANSPLANT = new Date(2026, 4, 15, 9); // May 15

function makeProfile(overrides: Partial<GardenProfile> = {}): GardenProfile {
  return {
    schemaVersion: 1,
    crops: ['peppers'],
    plantedWeeks: { peppers: 'w0' },
    sun: 'full',
    bedWidthFt: 4,
    bedLengthFt: 4,
    method: 'drip',
    location: null,
    weather: null,
    weatherFetchedAt: null,
    scheduledReminders: [],
    notificationsEnabled: true,
    savedAt: JAN_15.toISOString(),
    frostDates,
    ...overrides,
  };
}

const titles = (tasks: { title: string }[]) => tasks.map((t) => t.title);

describe('seedStartPlan', () => {
  it('dates start indoors, harden off, and transplant from the last frost', () => {
    const plan = seedStartPlan('peppers', frostDates, JAN_15)!;
    expect(plan.startIndoors.toDateString()).toBe(START.toDateString());
    expect(plan.hardenOff.toDateString()).toBe(HARDEN.toDateString());
    expect(plan.transplant.toDateString()).toBe(TRANSPLANT.toDateString());
  });

  it('has no plan for a direct-sow crop, or without a frost estimate', () => {
    expect(seedStartPlan('carrots', frostDates, JAN_15)).toBeNull();
    expect(seedStartPlan('peppers', undefined, JAN_15)).toBeNull();
  });

  it('plans forward: in the fall, the next spring, not the one just gone', () => {
    const plan = seedStartPlan('peppers', frostDates, new Date(2026, 9, 16))!;
    expect(plan.startIndoors.toDateString()).toBe(new Date(2027, 2, 6).toDateString());
  });

  it('still counts a transplant a couple of weeks late as this season', () => {
    const plan = seedStartPlan('peppers', frostDates, new Date(2026, 4, 29))!;
    expect(plan.transplant.toDateString()).toBe(TRANSPLANT.toDateString());
  });

  it('covers crops that only just got indoor timing, like onions', () => {
    expect(seedStartPlan('onions', frostDates, JAN_15)).not.toBeNull();
  });
});

describe('seed-start tasks', () => {
  it('shows each step on its own date in Calendar, for free users too', () => {
    const profile = makeProfile();
    expect(titles(getTasksForDate(profile, START, JAN_15))).toContain('Sow Peppers indoors');
    expect(titles(getTasksForDate(profile, HARDEN, JAN_15))).toContain('Start hardening off Peppers');
    expect(titles(getTasksForDate(profile, TRANSPLANT, JAN_15))).toContain('Transplant Peppers into the garden');
  });

  it('replaces the single Pro "plant" task rather than doubling up', () => {
    const tasks = getTasksForDate(makeProfile({ isPro: true }), TRANSPLANT, JAN_15);
    expect(tasks.filter((t) => t.id.startsWith('plant-'))).toHaveLength(0);
    expect(tasks.filter((t) => t.id.startsWith('transplant-'))).toHaveLength(1);
  });

  it('keeps a step on Home after its date until the next step takes over', () => {
    const profile = makeProfile();
    expect(titles(getTodayTasks(profile, new Date(2026, 2, 20, 9)))).toContain('Sow Peppers indoors');
    expect(titles(getTodayTasks(profile, new Date(2026, 4, 10, 9)))).toContain('Start hardening off Peppers');
    expect(titles(getTodayTasks(profile, new Date(2026, 4, 10, 9)))).not.toContain('Sow Peppers indoors');
    expect(getTodayTasks(profile, JAN_15).filter((t) => t.id.startsWith('seedstart-'))).toHaveLength(0);
  });

  it('drops the indoor steps for a crop the user is buying as seedlings', () => {
    const profile = makeProfile({ isPro: true, skipIndoorStart: ['peppers'] });
    expect(getTasksForDate(profile, START, JAN_15).filter((t) => t.id.startsWith('seedstart-'))).toHaveLength(0);
    expect(currentSeedStep(profile, 'peppers', JAN_15)).toBeNull();
  });

  it('marks the crop planted when the transplant task is checked off', () => {
    const profile = makeProfile();
    const transplant = getTasksForDate(profile, TRANSPLANT, JAN_15).find((t) => t.id.startsWith('transplant-'))!;
    const updated = toggleTask(profile, transplant.id);
    expect(effectiveBucket(updated, 'peppers')).not.toBe('w0');
  });

  it("points Home's Next up at the soonest step still ahead", () => {
    const next = nextSeedStep(makeProfile(), JAN_15)!;
    expect(next.task.title).toBe('Sow Peppers indoors');
    expect(next.date.toDateString()).toBe(START.toDateString());
  });
});

describe('seed-start reminders', () => {
  const twoWeeksBeforeStart = new Date(2026, 1, 20, 9);

  it('are Pro only', () => {
    expect(planNudges(makeProfile(), twoWeeksBeforeStart).some((n) => n.title === 'Sow Peppers indoors')).toBe(false);
    expect(planNudges(makeProfile({ isPro: true }), twoWeeksBeforeStart).some((n) => n.title === 'Sow Peppers indoors')).toBe(true);
  });
});
