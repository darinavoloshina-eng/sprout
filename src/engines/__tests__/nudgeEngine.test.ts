import { planNudges, weeklyDigest, HORIZON_DAYS, MORNING_HOUR, WEEKLY_SUMMARY_HOUR } from '../nudgeEngine';
import { GardenProfile } from '../../types';

// Jan 1 2024 is a Monday; sun:'full' waters Mon/Wed/Fri.
const MON = new Date(2024, 0, 1, 9, 0);

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
    savedAt: MON.toISOString(),
    ...overrides,
  };
}

describe('planNudges', () => {
  it('never sends a per-day watering nudge, only a Sunday-evening weekly summary', () => {
    const nudges = planNudges(makeProfile(), MON);
    expect(nudges.length).toBeGreaterThan(0);
    for (const n of nudges) {
      expect(n.fireAt.getDay()).toBe(0);
      expect(n.fireAt.getHours()).toBe(WEEKLY_SUMMARY_HOUR);
      expect(n.title).toBe('Your garden this week');
      expect(n.body).toMatch(/^Water Mon, Wed & Fri, about \d+ min each\.$/);
    }
  });

  it('sends at most one notification per day, and nothing past the horizon or for today', () => {
    // Mid-season Pro tomatoes, so real feed reminders land in the window.
    const june = new Date(2024, 5, 3, 9, 0); // a Monday
    const profile = makeProfile({
      isPro: true,
      plantedDates: { tomatoes: new Date(2024, 4, 1).toISOString() },
      frostDates: { lastFrostMonthDay: '05-01', firstFrostMonthDay: '11-15', isNorthernHemisphere: true, fetchedAt: june.toISOString() },
    });
    const nudges = planNudges(profile, june);
    expect(nudges.some((n) => n.title === 'Fertilize Tomatoes')).toBe(true);
    const days = nudges.map((n) => n.fireAt.toDateString());
    expect(new Set(days).size).toBe(days.length);
    const horizonEnd = new Date(2024, 5, 3 + HORIZON_DAYS, 23, 59);
    for (const n of nudges) {
      expect(n.fireAt.toDateString()).not.toBe(june.toDateString());
      expect(n.fireAt.getTime()).toBeLessThanOrEqual(horizonEnd.getTime());
    }
  });

  it('names the specific job on the day a user-set reminder is due', () => {
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'tomatoes|Stake', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: new Date(2024, 0, 3, 12).toISOString(), body: 'Before they flop over.' },
      ],
    });
    const wed = planNudges(profile, MON).find((n) => n.fireAt.getDate() === 3);
    expect(wed).toMatchObject({ title: 'Stake your tomatoes', body: 'Before they flop over.' });
    expect(wed!.fireAt.getHours()).toBe(MORNING_HOUR);
  });

  it('bundles several jobs on one day into a single notification', () => {
    const due = new Date(2024, 0, 3, 12).toISOString();
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'a', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: due, body: '' },
        { id: 'b', title: 'Thin the carrots', cropLabel: 'Carrots', dateISO: due, body: '' },
      ],
    });
    const wed = planNudges(profile, MON).filter((n) => n.fireAt.getDate() === 3);
    expect(wed).toHaveLength(1);
    expect(wed[0].title).toBe('2 garden jobs today');
    expect(wed[0].body).toBe('Stake your tomatoes & thin the carrots.');
  });

  it('folds the watering summary into the morning nudge when Sunday also has a job', () => {
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'a', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: new Date(2024, 0, 7, 12).toISOString(), body: 'Before they flop.' },
      ],
    });
    const sunday = planNudges(profile, MON).filter((n) => n.fireAt.getDate() === 7);
    expect(sunday).toHaveLength(1);
    expect(sunday[0].fireAt.getHours()).toBe(MORNING_HOUR);
    expect(sunday[0].body).toMatch(/^Before they flop\. This week: water Mon/);
  });

  it('drops a job the user already checked off', () => {
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'a', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: new Date(2024, 0, 3, 12).toISOString(), body: '' },
      ],
      taskCompletions: { 'reminder-a': MON.toISOString() },
    });
    expect(planNudges(profile, MON).filter((n) => n.fireAt.getDate() === 3)).toHaveLength(0);
  });
});

describe('planNudges with the weekly email on', () => {
  it('keeps the Sunday push watering summary while the email is signed up for but not arriving yet', () => {
    const nudges = planNudges(makeProfile({ emailRemindersEnabled: true }), MON);
    expect(nudges.length).toBeGreaterThan(0);
  });

  it('drops the Sunday push watering summary once the email is actually arriving', () => {
    const nudges = planNudges(makeProfile({ emailRemindersEnabled: true, emailDigestActive: true }), MON);
    expect(nudges).toHaveLength(0);
  });

  it('still sends day-of job nudges', () => {
    const profile = makeProfile({
      emailRemindersEnabled: true,
      emailDigestActive: true,
      scheduledReminders: [
        { id: 'a', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: new Date(2024, 0, 3, 12).toISOString(), body: '' },
      ],
    });
    expect(planNudges(profile, MON).map((n) => n.title)).toEqual(['Stake your tomatoes']);
  });
});

describe('weeklyDigest', () => {
  const SUN = new Date(2024, 0, 7, 18);
  const NEXT_MON = new Date(2024, 0, 8, 12);

  it('lists each day with a job, plus the watering plan', () => {
    const profile = makeProfile({
      scheduledReminders: [
        { id: 'a', title: 'Stake your tomatoes', cropLabel: 'Tomatoes', dateISO: new Date(2024, 0, 10, 12).toISOString(), body: '' },
      ],
    });
    const digest = weeklyDigest(profile, NEXT_MON, SUN)!;
    expect(digest.days).toHaveLength(1);
    expect(digest.days[0].date.getDay()).toBe(3);
    expect(digest.days[0].jobs).toEqual(['Stake your tomatoes']);
    expect(digest.watering).toMatch(/^Water Mon, Wed & Fri/);
  });

  it('is null when there is nothing to do or water', () => {
    expect(weeklyDigest(makeProfile({ crops: [] }), NEXT_MON, SUN)).toBeNull();
  });
});
