import { plantingGuidanceFor } from '../plantingGuide';
import { FrostEstimate } from '../../types';

function makeFrostDates(
  lastFrostMonthDay: string,
  firstFrostMonthDay: string | null = null,
  isNorthernHemisphere = true
): FrostEstimate {
  return {
    lastFrostMonthDay,
    firstFrostMonthDay,
    isNorthernHemisphere,
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
    expect(guidance.headline).toBe('Plant Tomatoes around May 8');
    expect(guidance.detail).toContain('Start seeds indoors');
    expect(guidance.isPastDue).toBe(false);
  });

  it('computes an outdoor planting date before last frost for a cold-tolerant crop', () => {
    // Carrots: outdoor 2 weeks before last frost, direct sow only.
    const frostDates = makeFrostDates('05-01');
    const now = new Date(2024, 2, 1); // well before that window
    const guidance = plantingGuidanceFor('carrots', frostDates, now);
    expect(guidance.headline).toBe('Plant Carrots around April 17');
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

  describe('fall / second-season windows', () => {
    it('hands guidance to the fall window once spring has closed and fall is nearer', () => {
      // Broccoli: fall outdoor target is 12 weeks before first frost.
      const frostDates = makeFrostDates('04-15', '11-15');
      const fallTarget = new Date(2024, 7, 23); // ~Aug 23, 12 weeks before Nov 15
      const now = new Date(2024, 8, 3); // Sep 3 — matches the reported real-world case
      const guidance = plantingGuidanceFor('broccoli', frostDates, now);
      // Past due, so the headline says so directly rather than naming a
      // now-past date (which read as "you missed it" — see the detail for
      // the actual target date instead).
      expect(guidance.headline).toBe('Plant Broccoli now');
      expect(guidance.isPastDue).toBe(true);
      expect(guidance.detail).toContain(fallTarget.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
      expect(guidance.detail).toContain('sweeter than spring');
    });

    it('still prefers the spring window in spring, even when a fall window exists', () => {
      const frostDates = makeFrostDates('04-15', '11-15');
      const now = new Date(2024, 2, 1); // March — close to spring, nowhere near fall
      const guidance = plantingGuidanceFor('broccoli', frostDates, now);
      expect(guidance.detail).toContain('bolting');
      expect(guidance.detail).not.toContain('sweeter than spring');
    });

    it('shows an upcoming (not past-due) fall date shortly before the fall window opens', () => {
      // Beets: fall outdoor target is 8 weeks before first frost.
      const frostDates = makeFrostDates('04-15', '11-15');
      const fallTarget = new Date(2024, 8, 20); // ~Sep 20, 8 weeks before Nov 15
      const now = new Date(2024, 8, 3); // Sep 3 — a couple weeks ahead of the target
      const guidance = plantingGuidanceFor('beets', frostDates, now);
      expect(guidance.headline).toBe(`Plant Beets around ${fallTarget.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`);
      expect(guidance.isPastDue).toBe(false);
    });

    it('treats garlic as fall-only: no spring guidance even with a last-frost estimate', () => {
      // No real first-frost measurement (null) — garlic still gets a fall
      // date via the generic fall-frost reference rather than no guidance
      // at all, since it has no spring window to fall back to.
      const frostDates = makeFrostDates('04-15', null);
      const capTarget = new Date(2024, 11, 6); // 3 weeks after the Nov 15 generic reference
      const guidance = plantingGuidanceFor('garlic', frostDates, new Date(2024, 3, 1));
      expect(guidance.detail).toContain('Plant cloves directly in the ground');
      expect(guidance.detail).toContain(capTarget.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
    });

    it('falls back to fully generic guidance only when there is no frost estimate at all', () => {
      const guidance = plantingGuidanceFor('garlic', null, new Date(2024, 3, 1));
      expect(guidance.headline).toBe('Not planted yet');
      expect(guidance.detail).toContain('Plant cloves directly in the ground');
      expect(guidance.isPastDue).toBe(false);
    });

    it('trusts a normal (non-anomalous) measured frost even when later than the generic reference', () => {
      // Dec 1 first frost is a perfectly ordinary late-season frost, not
      // the "anomalously mild climate" case the cap exists for — it should
      // never be overridden by the (earlier) Nov 15 generic reference.
      const frostDates = makeFrostDates('04-15', '12-01');
      const target = new Date(2024, 8, 15); // radishes: 11 weeks before Dec 1
      const guidance = plantingGuidanceFor('radishes', frostDates, new Date(2024, 7, 1));
      expect(guidance.headline).toBe(`Plant Radishes around ${target.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`);
    });

    it('substitutes the generic reference when the measured frost is anomalously late (mild coastal climate)', () => {
      // Feb 14 — the real value confirmed against actual archive data for a
      // Sonoma County, CA location — is well beyond the original Sep-Dec
      // search range, so it's treated as unreliable for fall-planting
      // timing and the generic Nov 15 reference is used instead.
      const frostDates = makeFrostDates('03-05', '02-14');
      const target = new Date(2024, 7, 23); // broccoli: 12 weeks before Nov 15
      const guidance = plantingGuidanceFor('broccoli', frostDates, new Date(2024, 8, 3));
      expect(guidance.headline).toBe('Plant Broccoli now');
      expect(guidance.isPastDue).toBe(true);
      expect(guidance.detail).toContain(target.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
    });

    it('reads as plantable now for fast crops too, under the same anomalous-frost real-world case', () => {
      // Same real Sonoma County, CA data as above — radishes and arugula
      // (explicitly reported as plantable "now" on Sep 3, not "January")
      // both correctly resolve to a near-immediate date via the generic
      // reference rather than backward-counting from the unreliable Feb 14.
      const frostDates = makeFrostDates('03-05', '02-14');
      const now = new Date(2024, 8, 3); // Sep 3
      const radishes = plantingGuidanceFor('radishes', frostDates, now);
      const arugula = plantingGuidanceFor('arugula', frostDates, now);
      expect(radishes.headline).not.toContain('January');
      expect(radishes.isPastDue).toBe(true);
      expect(arugula.headline).not.toContain('January');
      expect(arugula.isPastDue).toBe(true);
    });

    it('gives garlic a real fall target date once a first-frost estimate exists', () => {
      const frostDates = makeFrostDates('04-15', '11-15');
      const target = new Date(2024, 11, 6); // 3 weeks after Nov 15
      const guidance = plantingGuidanceFor('garlic', frostDates, new Date(2024, 9, 1));
      expect(guidance.headline).toBe(`Plant Garlic around ${target.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`);
      expect(guidance.isPastDue).toBe(false);
    });

    it('does not offer fall guidance for a frost-tender, spring-only crop', () => {
      const frostDates = makeFrostDates('04-15', '11-15');
      const now = new Date(2024, 8, 3); // September — deep into what would be tomatoes' fall window if it had one
      const guidance = plantingGuidanceFor('tomatoes', frostDates, now);
      // No fall window exists to compete, so the nearest occurrence is
      // still this year's (already-passed) spring target, not a fall date.
      expect(guidance.headline).toBe('Plant Tomatoes now');
      expect(guidance.isPastDue).toBe(true);
      expect(guidance.detail).toContain('April');
    });
  });

  describe('new crops added for the vegetable/fruit/flower expansion', () => {
    const NEW_CROPS = [
      'blackberries',
      'grapes',
      'rhubarb',
      'figs',
      'marigold',
      'zinnia',
      'sunflower',
      'cosmos',
      'nasturtium',
      'pansy',
    ] as const;

    it('produces valid, non-throwing guidance for every new crop with no frost estimate', () => {
      for (const crop of NEW_CROPS) {
        const guidance = plantingGuidanceFor(crop, null);
        expect(guidance.headline).toBe('Not planted yet');
        expect(guidance.detail.length).toBeGreaterThan(0);
        expect(guidance.date).toBeNull();
      }
    });

    it('computes a real spring target date for sunflower', () => {
      const frostDates = makeFrostDates('05-01');
      const guidance = plantingGuidanceFor('sunflower', frostDates, new Date(2024, 2, 1));
      expect(guidance.headline).toBe('Plant Sunflower around May 8');
      expect(guidance.date).not.toBeNull();
    });

    it('gives pansy both a spring and a fall window', () => {
      const frostDates = makeFrostDates('04-15', '11-15');
      const spring = plantingGuidanceFor('pansy', frostDates, new Date(2024, 2, 1));
      expect(spring.detail).toContain('cool weather');
      const fall = plantingGuidanceFor('pansy', frostDates, new Date(2024, 8, 3));
      expect(fall.detail.toLowerCase()).toContain('fall');
    });

    it('treats perennial fruit like rhubarb as an establishment-year planting', () => {
      const frostDates = makeFrostDates('05-01');
      const guidance = plantingGuidanceFor('rhubarb', frostDates, new Date(2024, 2, 1));
      expect(guidance.detail).toContain('perennial');
      expect(guidance.detail).toContain('toxic');
    });
  });
});
