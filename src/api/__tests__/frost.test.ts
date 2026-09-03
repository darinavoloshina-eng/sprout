import { estimateFrostDates } from '../frost';

// System time is fixed inside a non-leap 3-year window (2021-2023) so the
// sampled years (currentYear-1..3) are never leap years — that keeps
// day-of-year arithmetic identical across years for the same "MM-DD",
// letting the averaging assertions below be exact rather than fuzzy.
const FIXED_NOW = new Date('2024-06-01T00:00:00Z');

type YearFixture = { last?: string; first?: string } | 'fail' | 'not-ok' | 'no-frost';

function mockFetchForYears(byYear: Record<number, YearFixture>) {
  return jest.fn(async (url: string) => {
    const match = url.match(/start_date=(\d+)-01-01/);
    const year = Number(match?.[1]);
    const fixture = byYear[year] ?? 'no-frost';

    if (fixture === 'fail') throw new Error('network error');
    if (fixture === 'not-ok') return { ok: false, json: async () => ({}) } as Response;
    if (fixture === 'no-frost') {
      return { ok: true, json: async () => ({ daily: { time: [], temperature_2m_min: [] } }) } as Response;
    }

    const dates: string[] = [];
    const mins: number[] = [];
    if (fixture.last) {
      dates.push(`${year}-${fixture.last}`);
      mins.push(20);
    }
    if (fixture.first) {
      dates.push(`${year}-${fixture.first}`);
      mins.push(20);
    }
    return { ok: true, json: async () => ({ daily: { time: dates, temperature_2m_min: mins } }) } as Response;
  });
}

describe('estimateFrostDates', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('estimates last and first frost by averaging the northern-hemisphere search windows across sampled years', async () => {
    global.fetch = mockFetchForYears({
      2023: { last: '03-10', first: '11-05' },
      2022: { last: '03-12', first: '11-07' },
      2021: { last: '03-08', first: '11-03' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result).not.toBeNull();
    expect(result?.lastFrostMonthDay).toBe('03-10');
    expect(result?.firstFrostMonthDay).toBe('11-05');
    expect(() => new Date(result!.fetchedAt).toISOString()).not.toThrow();
  });

  it('uses the southern-hemisphere search windows for a negative latitude', async () => {
    global.fetch = mockFetchForYears({
      2023: { last: '08-15', first: '04-10' },
      2022: { last: '08-15', first: '04-10' },
      2021: { last: '08-15', first: '04-10' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(-33.87, 151.21);

    expect(result?.lastFrostMonthDay).toBe('08-15');
    expect(result?.firstFrostMonthDay).toBe('04-10');
  });

  it('returns null when frost data falls outside the search window for the hemisphere', async () => {
    // "08-15" only falls inside the southern last-frost window, not the
    // northern one (Jan-Jun) — a northern query should find nothing.
    global.fetch = mockFetchForYears({
      2023: { last: '08-15' },
      2022: { last: '08-15' },
      2021: { last: '08-15' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result).toBeNull();
  });

  it('returns null when no sampled year has a frost day at all', async () => {
    global.fetch = mockFetchForYears({
      2023: 'no-frost',
      2022: 'no-frost',
      2021: 'no-frost',
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result).toBeNull();
  });

  it('finds a last-frost date even when no year has a first-frost date', async () => {
    global.fetch = mockFetchForYears({
      2023: { last: '03-10' },
      2022: { last: '03-10' },
      2021: { last: '03-10' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result?.lastFrostMonthDay).toBe('03-10');
    expect(result?.firstFrostMonthDay).toBeNull();
  });

  it('skips a year whose fetch throws and still estimates from the rest', async () => {
    global.fetch = mockFetchForYears({
      2023: { last: '03-10' },
      2022: 'fail',
      2021: { last: '03-10' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result?.lastFrostMonthDay).toBe('03-10');
  });

  it('skips a year whose response is not ok and still estimates from the rest', async () => {
    global.fetch = mockFetchForYears({
      2023: { last: '03-10' },
      2022: 'not-ok',
      2021: { last: '03-10' },
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(37.77, -122.42);

    expect(result?.lastFrostMonthDay).toBe('03-10');
  });

  it('finds a first frost that lands in January of the following year (mild coastal climate)', async () => {
    // Real archive data for a Sonoma County, CA location never dipped to
    // 32°F within Sep-Dec in any recent year — the first sub-freezing
    // reading actually landed in mid-January. The old Sep1-Dec31 search
    // window would report this as no frost at all.
    global.fetch = jest.fn(async (url: string) => {
      const match = url.match(/start_date=(\d+)-01-01/);
      const year = Number(match?.[1]);
      // Jan 20 of the year AFTER the sampled year — well past Dec 31.
      return {
        ok: true,
        json: async () => ({
          daily: {
            time: [`${year}-03-10`, `${year + 1}-01-20`],
            temperature_2m_min: [20, 20],
          },
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await estimateFrostDates(38.47, -122.91);

    expect(result).not.toBeNull();
    expect(result?.lastFrostMonthDay).toBe('03-10');
    expect(result?.firstFrostMonthDay).toBe('01-20');
  });
});
