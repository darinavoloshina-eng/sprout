import { suggestCrops, frostFreeDays, MAX_PER_GROUP } from '../suggestions';

const chicago = { lastFrostMonthDay: '04-25', firstFrostMonthDay: '10-20', isNorthernHemisphere: true, fetchedAt: '' };
const shortSeason = { lastFrostMonthDay: '06-01', firstFrostMonthDay: '09-10', isNorthernHemisphere: true, fetchedAt: '' };
const mild = { lastFrostMonthDay: '01-20', firstFrostMonthDay: '01-05', isNorthernHemisphere: true, fetchedAt: '' };

const crops = (list: { crop: string }[]) => list.map((s) => s.crop);

describe('suggestCrops', () => {
  it('needs a frost estimate', () => {
    expect(suggestCrops(null, [], new Date(2027, 2, 1))).toBeNull();
  });

  it('suggests starting peppers indoors in early March, ahead of a late-April frost', () => {
    const s = suggestCrops(chicago, [], new Date(2027, 2, 1))!;
    expect(crops(s.indoors)).toContain('peppers');
    expect(s.indoors.find((x) => x.crop === 'peppers')!.reason).toMatch(/^Start indoors around .* · plant out /);
  });

  it('suggests warm-weather crops outside in May and cool ones in August', () => {
    const may = suggestCrops(chicago, [], new Date(2027, 4, 10))!;
    expect(crops(may.outside)).toContain('beans');
    expect(crops(may.outside)).not.toContain('lettuce');
    const aug = suggestCrops(chicago, [], new Date(2027, 7, 1))!;
    expect(crops(aug.outside)).toContain('radishes');
    expect(crops(aug.outside)).not.toContain('tomatoes');
  });

  it("leaves out crops already in the garden, and flowers", () => {
    const s = suggestCrops(chicago, ['beans'], new Date(2027, 4, 10))!;
    const all = [...s.indoors, ...s.outside, ...s.soon].map((x) => x.crop);
    expect(all).not.toContain('beans');
    expect(all.some((c) => ['marigold', 'zinnia', 'sunflower', 'cosmos', 'nasturtium', 'pansy', 'dahlias'].includes(c))).toBe(false);
  });

  it("doesn't suggest a long-season crop that can't finish before fall frost", () => {
    const s = suggestCrops(shortSeason, [], new Date(2027, 4, 25))!;
    const all = [...s.indoors, ...s.outside, ...s.soon].map((x) => x.crop);
    expect(all).not.toContain('pumpkin');
    expect(all).not.toContain('watermelon');
  });

  it('only suggests citrus where winters are mild', () => {
    const lots = (f: typeof chicago, d: Date) => {
      const s = suggestCrops(f, ['tomatoes', 'peppers', 'basil', 'lettuce', 'kale', 'chard', 'bokchoy', 'beans', 'zucchini', 'cucumbers', 'peas', 'spinach', 'radishes', 'arugula', 'chives', 'mint', 'strawberries', 'potatoes', 'garlic', 'broccoli', 'cabbage', 'cauliflower', 'eggplant', 'collards', 'kohlrabi', 'onions', 'leeks', 'parsley', 'cilantro', 'dill', 'squash', 'carrots', 'beets'], d)!;
      return [...s.indoors, ...s.outside, ...s.soon].map((x) => x.crop);
    };
    const warmTrees = ['lemon', 'lime', 'orange', 'kumquat', 'avocado'];
    expect(lots(mild, new Date(2027, 0, 25)).some((c) => warmTrees.includes(c))).toBe(true);
    expect(lots(chicago, new Date(2027, 4, 1)).some((c) => warmTrees.includes(c))).toBe(false);
  });

  it('looks further ahead in a quiet season rather than coming back empty', () => {
    const s = suggestCrops(chicago, [], new Date(2026, 10, 20))!;
    expect(s.indoors.length + s.outside.length + s.soon.length).toBeGreaterThanOrEqual(3);
  });

  it('caps each list and orders it by planting date, soonest first', () => {
    const s = suggestCrops(chicago, [], new Date(2027, 4, 10))!;
    expect(s.outside.length).toBeLessThanOrEqual(MAX_PER_GROUP);
    const times = s.outside.map((x) => x.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('frostFreeDays', () => {
  it('measures last spring frost to first fall frost', () => {
    expect(frostFreeDays(chicago, new Date(2027, 0, 1))).toBe(178);
  });
});
