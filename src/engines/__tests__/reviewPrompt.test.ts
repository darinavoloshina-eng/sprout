import { isReviewMoment } from '../../reviewPrompt';
import { GardenProfile } from '../../types';

const today = new Date(2026, 10, 12, 9);
const day = (n: number) => new Date(2026, 10, 12 - n, 8).toISOString();

function profile(overrides: Partial<GardenProfile> = {}): GardenProfile {
  return {
    schemaVersion: 1, crops: ['kale'], plantedWeeks: { kale: 'w4' }, sun: 'full', bedWidthFt: 4, bedLengthFt: 4,
    method: 'drip', location: null, weather: null, weatherFetchedAt: null, scheduledReminders: [],
    notificationsEnabled: true, savedAt: today.toISOString(), ...overrides,
  };
}
const harvest = (id: string) => ({ id, crop: 'kale' as const, weightLbs: 0.5, note: '', dateISO: today.toISOString() });

describe('isReviewMoment', () => {
  it('asks right after a harvest is logged', () => {
    expect(isReviewMoment(profile(), profile({ harvests: [harvest('a')] }), today)).toBe(true);
  });

  it('asks when a streak reaches 3 days, not 2 or 4', () => {
    const two = { t1: day(1), t2: day(2) };
    expect(isReviewMoment(profile({ taskCompletions: { t1: day(1) } }), profile({ taskCompletions: two }), today)).toBe(false);
    expect(isReviewMoment(profile({ taskCompletions: two }), profile({ taskCompletions: { ...two, t0: day(0) } }), today)).toBe(true);
    const three = { t0: day(0), t1: day(1), t2: day(2) };
    expect(isReviewMoment(profile({ taskCompletions: { t1: day(1), t2: day(2), t3: day(3) } }), profile({ taskCompletions: { ...three, t3: day(3) } }), today)).toBe(false);
  });

  it('waits months after asking, and never fires on first load', () => {
    const asked = { reviewAskedAt: new Date(2026, 9, 1).toISOString() };
    expect(isReviewMoment(profile(asked), profile({ ...asked, harvests: [harvest('a')] }), today)).toBe(false);
    const longAgo = { reviewAskedAt: new Date(2026, 4, 1).toISOString() };
    expect(isReviewMoment(profile(longAgo), profile({ ...longAgo, harvests: [harvest('a')] }), today)).toBe(true);
    expect(isReviewMoment(null, profile({ harvests: [harvest('a')] }), today)).toBe(false);
  });

  it('does not ask on an edit that adds nothing', () => {
    const p = profile({ harvests: [harvest('a')] });
    expect(isReviewMoment(p, { ...p, bedWidthFt: 3 }, today)).toBe(false);
  });
});
