// frost.ts
// Real frost-date estimates from historical daily minimum temperatures
// (Open-Meteo's archive API — same key-free provider as weather.ts), not a
// calendar-month guess. A month-based "it's January, must be cold-start"
// heuristic would be wrong for the Southern Hemisphere and for any
// non-temperate climate; this instead looks at the last 3 years of actual
// temperature history at the user's coordinates and picks the search
// window (spring vs. fall) based on which hemisphere they're actually in.
//
// Some places genuinely don't get a hard frost some years (San Francisco
// is a real example) — when that happens the year is simply skipped rather
// than a frost date being invented, and if no year has one, the whole
// estimate comes back null.

const FROST_THRESHOLD_F = 32;
const YEARS_SAMPLED = 3;

export interface FrostEstimate {
  lastFrostMonthDay: string; // "MM-DD" — average estimated last frost of the cold season
  firstFrostMonthDay: string | null; // "MM-DD" — average estimated first frost of the next cold season; null if no reliable one found
  fetchedAt: string;
}

function dayOfYear(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((d.getTime() - start.getTime()) / 86400000);
}

function averageMonthDay(days: number[]): string {
  const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  const ref = new Date(2021, 0, 1); // non-leap reference year
  ref.setDate(ref.getDate() + avg);
  return `${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
}

function inWindow(monthDay: string, startMD: string, endMD: string): boolean {
  return monthDay >= startMD && monthDay <= endMD;
}

function lastFrostInWindow(
  dates: string[],
  mins: (number | null)[],
  startMD: string,
  endMD: string
): number | null {
  let lastIdx = -1;
  for (let i = 0; i < dates.length; i++) {
    if (!inWindow(dates[i].slice(5), startMD, endMD)) continue;
    if (mins[i] != null && mins[i]! <= FROST_THRESHOLD_F) lastIdx = i;
  }
  return lastIdx >= 0 ? dayOfYear(dates[lastIdx]) : null;
}

function firstFrostInWindow(
  dates: string[],
  mins: (number | null)[],
  startMD: string,
  endMD: string
): number | null {
  for (let i = 0; i < dates.length; i++) {
    if (!inWindow(dates[i].slice(5), startMD, endMD)) continue;
    if (mins[i] != null && mins[i]! <= FROST_THRESHOLD_F) return dayOfYear(dates[i]);
  }
  return null;
}

export async function estimateFrostDates(lat: number, lon: number): Promise<FrostEstimate | null> {
  const isNorthern = lat >= 0;
  const lastWindow: [string, string] = isNorthern ? ['01-01', '06-30'] : ['07-01', '12-31'];
  const firstWindow: [string, string] = isNorthern ? ['09-01', '12-31'] : ['02-01', '05-31'];

  const currentYear = new Date().getFullYear();
  const years = [1, 2, 3].slice(0, YEARS_SAMPLED).map((n) => currentYear - n);

  const lastFrostDays: number[] = [];
  const firstFrostDays: number[] = [];

  await Promise.all(
    years.map(async (year) => {
      try {
        const url =
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
          `&start_date=${year}-01-01&end_date=${year}-12-31` +
          `&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const dates: string[] = data?.daily?.time ?? [];
        const mins: (number | null)[] = data?.daily?.temperature_2m_min ?? [];

        const last = lastFrostInWindow(dates, mins, lastWindow[0], lastWindow[1]);
        if (last != null) lastFrostDays.push(last);

        const first = firstFrostInWindow(dates, mins, firstWindow[0], firstWindow[1]);
        if (first != null) firstFrostDays.push(first);
      } catch {
        // Skip this year — a partial sample from the others is still useful.
      }
    })
  );

  if (lastFrostDays.length === 0) return null;

  return {
    lastFrostMonthDay: averageMonthDay(lastFrostDays),
    firstFrostMonthDay: firstFrostDays.length > 0 ? averageMonthDay(firstFrostDays) : null,
    fetchedAt: new Date().toISOString(),
  };
}
