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
//
// The fall/first-frost search window used to stop at Dec 31, which is
// wrong for mild, coastal-influenced climates (confirmed against real
// archive data for a Sonoma County, CA location) where the season's first
// sub-32°F reading doesn't land until January or February — so
// firstFrostMonthDay came back null even though the location does get a
// real first frost, just later than the window checked. The search now
// runs a full six months (Sep-Feb north, Feb-Jul south) so it doesn't cut
// off before winter actually arrives. That window crosses a calendar-year
// boundary, so "day of year" (which resets to 0 every Jan 1) can't be
// averaged directly — averageFromAnchor works in "days since the window's
// start" instead, which counts through the boundary correctly.

const FROST_THRESHOLD_F = 32;
const YEARS_SAMPLED = 3;

export interface FrostEstimate {
  lastFrostMonthDay: string; // "MM-DD" — average estimated last frost of the cold season
  firstFrostMonthDay: string | null; // "MM-DD" — average estimated first frost of the next cold season; null if no reliable one found
  isNorthernHemisphere: boolean; // which search windows were used — plantingGuide.ts needs this too, to know which side of the year its own fall-season reference date falls on
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

/** Same idea as averageMonthDay, but for a window that crosses a
 * calendar-year boundary (e.g. Sep-Feb): `daysFromAnchor` values are
 * counted from the window's own start date rather than from Jan 1, so a
 * January reading (large offset from the prior September) averages
 * correctly against a December one instead of wrapping back to a tiny
 * "day of year" number. */
function averageMonthDayFromAnchor(daysFromAnchor: number[], anchor: Date): string {
  const avg = Math.round(daysFromAnchor.reduce((a, b) => a + b, 0) / daysFromAnchor.length);
  const ref = new Date(anchor);
  ref.setDate(ref.getDate() + avg);
  return `${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
}

function formatDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function lastFrostInWindow(
  dates: string[],
  mins: (number | null)[],
  startMD: string,
  endMD: string
): number | null {
  let lastIdx = -1;
  for (let i = 0; i < dates.length; i++) {
    if (!(dates[i].slice(5) >= startMD && dates[i].slice(5) <= endMD)) continue;
    if (mins[i] != null && mins[i]! <= FROST_THRESHOLD_F) lastIdx = i;
  }
  return lastIdx >= 0 ? dayOfYear(dates[lastIdx]) : null;
}

/** First sub-threshold reading at or after `anchor`, searched across
 * `windowDays` days (crossing into the following year is fine — dates are
 * real calendar dates, not MM-DD strings). Returns days since `anchor`. */
function firstFrostFromAnchor(
  dates: string[],
  mins: (number | null)[],
  anchor: Date,
  windowDays: number
): number | null {
  const end = new Date(anchor.getTime() + windowDays * 86400000);
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(`${dates[i]}T00:00:00`);
    if (d < anchor || d > end) continue;
    if (mins[i] != null && mins[i]! <= FROST_THRESHOLD_F) {
      return Math.round((d.getTime() - anchor.getTime()) / 86400000);
    }
  }
  return null;
}

export async function estimateFrostDates(lat: number, lon: number): Promise<FrostEstimate | null> {
  const isNorthern = lat >= 0;
  const lastWindow: [string, string] = isNorthern ? ['01-01', '06-30'] : ['07-01', '12-31'];
  // Six months starting where the growing season ends, so a mild or
  // coastal-influenced climate whose first real frost lands well into
  // winter (Jan/Feb north, Jul/Aug south) still gets found instead of the
  // search cutting off at the old Dec 31 / May 31 boundary.
  const fallAnchorMonth = isNorthern ? 8 : 1; // 0-indexed: Sep (north) / Feb (south)
  const fallWindowDays = 182;

  const currentYear = new Date().getFullYear();
  const years = [1, 2, 3].slice(0, YEARS_SAMPLED).map((n) => currentYear - n);

  const lastFrostDays: number[] = [];
  const firstFrostOffsets: number[] = [];
  // All samples share the same anchor month/day (just different years), so
  // any one of them works as the reference point for reconstructing the
  // final averaged MM-DD.
  let firstFrostAnchor: Date | null = null;

  await Promise.all(
    years.map(async (year) => {
      try {
        // Spans the fall-window anchor year through the following Feb/Aug,
        // covering both this year's spring window and the (possibly
        // year-crossing) fall window in a single request.
        const anchor = new Date(year, fallAnchorMonth, 1);
        const rangeEnd = new Date(anchor.getTime() + fallWindowDays * 86400000);
        const url =
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
          `&start_date=${year}-01-01&end_date=${formatDateParam(rangeEnd)}` +
          `&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const dates: string[] = data?.daily?.time ?? [];
        const mins: (number | null)[] = data?.daily?.temperature_2m_min ?? [];

        // The fetch spans into `year + 1` (for the fall search below), so
        // the last-frost search — which only ever looks at Jan-Jun and
        // would otherwise match a January date by MM-DD alone regardless
        // of which year it's actually from — is restricted to `year`'s own
        // dates. Without this, a mild-climate first frost landing in the
        // following January gets picked up as if it were also this year's
        // (more recent) last spring frost.
        const ownYearPrefix = `${year}-`;
        const yearDates: string[] = [];
        const yearMins: (number | null)[] = [];
        for (let i = 0; i < dates.length; i++) {
          if (!dates[i].startsWith(ownYearPrefix)) continue;
          yearDates.push(dates[i]);
          yearMins.push(mins[i]);
        }

        const last = lastFrostInWindow(yearDates, yearMins, lastWindow[0], lastWindow[1]);
        if (last != null) lastFrostDays.push(last);

        const firstOffset = firstFrostFromAnchor(dates, mins, anchor, fallWindowDays);
        if (firstOffset != null) {
          firstFrostOffsets.push(firstOffset);
          if (!firstFrostAnchor) firstFrostAnchor = anchor;
        }
      } catch {
        // Skip this year — a partial sample from the others is still useful.
      }
    })
  );

  if (lastFrostDays.length === 0) return null;

  return {
    lastFrostMonthDay: averageMonthDay(lastFrostDays),
    firstFrostMonthDay:
      firstFrostOffsets.length > 0 ? averageMonthDayFromAnchor(firstFrostOffsets, firstFrostAnchor!) : null,
    isNorthernHemisphere: isNorthern,
    fetchedAt: new Date().toISOString(),
  };
}
