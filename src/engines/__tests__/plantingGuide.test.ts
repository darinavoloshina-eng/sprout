import { plantingGuidanceFor } from '../plantingGuide';
import { FrostEstimate } from '../../types';

function makeFrostDates(lastFrostMonthDay: string): FrostEstimate {
  return {
    lastFrostMonthDay,
    firstFrostMonthDay: null,
    fetchedAt: new Date().toISOString(),
  };
}

describe('plantingGuidanceFor', () => {
  it('gives generic, date-free guidance with no frost estimate', () => {
    const guidance = plantingGuidanceFor('tomatoes', null);
    expect(guidance.headline).toBe('Not planted yet');
    expect(guidance.detail).toContain('Add your location in Settings');
    expect(guidance.isPastDue).toBe(false);
  });

  it('computes an outdoor planting date after last frost for a warm-season crop', () => {
    // Tomatoes: outdoor 1 week after last frost.
    const frostDates = makeFrostDates('05-01');
    const now = new Date(2024, 3, 1); // well before last frost
    const guidance = plantingGuidanceFor('tomatoes', frostDates, now);
    expect(guidance.headline).toBe('Plant around May 8');
    expect(guidance.detail).toContain('Start seeds indoors');
    expect(guidance.isPastDue).toBe(false);
  });

  it('computes an outdoor planting date before last frost for a cold-tolerant crop', () => {
    // Carrots: outdoor 2 weeks before last frost, direct sow only.
    const frostDates = makeFrostDates('05-01');
    const now = new Date(2024, 2, 1); // well before that window
    const guidance = plantingGuidanceFor('carrots', frostDates, now);
    expect(guidance.headline).toBe('Plant around April 17');
    expect(guidance.detail).toContain('Direct sow only');
    expect(guidance.isPastDue).toBe(false);
  });

  it('flags isPastDue once today is on or after the recommended planting date', () => {
    const frostDates = makeFrostDates('05-01');
    const wellAfter = new Date(2024, 5, 1); // June — long after tomatoes' May 8 target
    const guidance = plantingGuidanceFor('tomatoes', frostDates, wellAfter);
    expect(guidance.isPastDue).toBe(true);
  });

  it('is not past due while the planting date is still ahead, even just a few days out', () => {
    // Tomatoes target May 8; May 3 is close but not there yet — Home should
    // not treat this as today's business until the day itself arrives.
    const frostDates = makeFrostDates('05-01');
    const fiveDaysBefore = new Date(2024, 4, 3);
    const guidance = plantingGuidanceFor('tomatoes', frostDates, fiveDaysBefore);
    expect(guidance.isPastDue).toBe(false);
  });

  it('is past due exactly on the target date itself', () => {
    const frostDates = makeFrostDates('05-01');
    const targetDay = new Date(2024, 4, 8); // tomatoes' own May 8 target
    const guidance = plantingGuidanceFor('tomatoes', frostDates, targetDay);
    expect(guidance.isPastDue).toBe(true);
  });

  it('includes an indoor-start date for crops usually started indoors', () => {
    const frostDates = makeFrostDates('05-01');
    const now = new Date(2024, 0, 1);
    const guidance = plantingGuidanceFor('peppers', frostDates, now);
    expect(guidance.detail).toContain('Start seeds indoors around March 5');
    expect(guidance.detail).toContain('Move outside around May 15');
  });

  it('has no indoor-start mention for a direct-sow-only crop', () => {
    const frostDates = makeFrostDates('05-01');
    const now = new Date(2024, 0, 1);
    const guidance = plantingGuidanceFor('corn', frostDates, now);
    expect(guidance.detail).not.toContain('Move outside');
  });
});
