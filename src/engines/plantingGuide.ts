// plantingGuide.ts
// "Not planted yet" (PlantedBucket 'w0') needs fundamentally different
// guidance than "planted N weeks ago" gets from plantStageContent.ts /
// alertsEngine.ts's STAGE_TABLE: not care instructions for an established
// plant, but when to actually put it in the ground and how (seed vs.
// seedling, direct sow vs. starting indoors in a container first). That's
// computed here from the user's real frost-date estimate (api/frost.ts)
// rather than static per-bucket copy, which is why it's its own module —
// plantStageContent.ts already imports PlantedBucket from alertsEngine.ts,
// so either of those importing this (or each other) would risk a cycle;
// this one only depends on scheduleEngine's CropKey and types.ts.
//
// Two planting windows, not one: cool-season crops (broccoli, beets,
// garlic, and most other things that aren't frost-tender) get a real fall
// planting timed off the estimated first fall frost, alongside the spring
// window timed off the last spring frost — garlic, in particular, is
// fall-ONLY in real gardening practice (spring-planted garlic barely
// bulbs), which this used to get backwards. Warm-season, frost-tender
// crops (tomatoes, peppers, squash, melons, corn, and the rest) only get a
// spring window since a fall planting wouldn't mature before frost kills
// it. When both windows exist and a frost estimate is available for each,
// whichever window's target date is chronologically nearest to today wins
// — that's what lets fall guidance take over from spring guidance once
// spring's window has closed, instead of a crop staying stuck on stale
// spring advice (or "plant it now!") for the rest of the year.

import { CropKey } from './scheduleEngine';
import { FrostEstimate } from '../types';
import { cropLabel } from '../cropMeta';

export interface PlantingGuidance {
  headline: string;
  detail: string;
  /** True once today is on or past the recommended planting date. Home's
   * "what needs doing today" cards (see HomeScreen.tsx) gate on this
   * directly — Home only surfaces a not-planted-yet crop once it's
   * actually due, not ahead of time, so a crop that isn't plantable for
   * months doesn't get featured as if it were today's business. False
   * when there's no frost estimate, since timing can't be confirmed. */
  isPastDue: boolean;
  /** The actual calculated target date behind the headline, or null for the
   * fully generic (no-frost-estimate) fallback where no real date exists.
   * Lets a caller that browses by date (Calendar) place this guidance on
   * the specific day it lands on, rather than only surfacing it once due
   * (which is all isPastDue alone supports). */
  date: Date | null;
}

interface SeasonWindow {
  method: string;
  /** Weeks relative to that season's frost date: negative = before it,
   * positive = after it. */
  outdoorWeeksFromFrost: number;
  indoorWeeksFromFrost?: number;
  note: string;
}

interface PlantingMethodInfo {
  /** Timed off the estimated last spring frost. Omitted for fall-only
   * crops (garlic). */
  spring?: SeasonWindow;
  /** Timed off the estimated first fall frost, for a second/fall garden.
   * Omitted for frost-tender, single-season crops. */
  fall?: SeasonWindow;
}

const PLANTING_METHOD: Record<CropKey, PlantingMethodInfo> = {
  tomatoes: {
    spring: {
      method: 'Start seeds indoors',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -6,
      note: 'Transplant seedlings out once nights stay reliably above 50°F.',
    },
  },
  cucumbers: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -3,
      note: 'Soil should be warm; cold soil stalls germination.',
    },
  },
  lettuce: {
    spring: {
      method: 'Direct sow, or start seedlings in containers',
      outdoorWeeksFromFrost: -2,
      note: 'Tolerates light frost, no need to wait for it to fully pass.',
    },
    fall: {
      method: 'Direct sow, or start seedlings in containers',
      outdoorWeeksFromFrost: -7,
      note: 'Tolerates light frost and often outperforms a spring crop, which tends to bolt as it finishes.',
    },
  },
  carrots: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -2,
      note: "Doesn't transplant well. The taproot doesn't like being disturbed.",
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -10,
      note: 'A fall crop is a favorite for a reason: cold weather converts starches to sugar, sweetening the roots.',
    },
  },
  peppers: {
    spring: {
      method: 'Start seeds indoors',
      outdoorWeeksFromFrost: 2,
      indoorWeeksFromFrost: -8,
      note: 'Peppers want warmer soil than tomatoes, give it an extra week or two past last frost.',
    },
  },
  basil: {
    spring: {
      method: 'Start indoors, or direct sow once it warms up',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -6,
      note: 'Very frost-tender; cold sets it back badly.',
    },
  },
  potatoes: {
    spring: {
      method: 'Plant seed potato pieces (with eyes) directly in the ground',
      outdoorWeeksFromFrost: -3,
      note: 'Tolerates light frost.',
    },
  },
  garlic: {
    fall: {
      method: 'Plant cloves directly in the ground',
      outdoorWeeksFromFrost: 3,
      note: 'Plant a few weeks after your first fall frost, before the ground freezes solid. Mulch heavily and it overwinters to harvest next summer. Spring-planted garlic rarely bulbs properly, so fall is really the only window.',
    },
  },
  strawberries: {
    spring: {
      method: 'Plant bare-root crowns or starts directly in the ground',
      outdoorWeeksFromFrost: -3,
      note: 'Grown from crowns, not seed, for a first-year harvest.',
    },
  },
  squash: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -3,
      note: 'Soil should be warm.',
    },
  },
  corn: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: 1,
      note: "Doesn't transplant well.",
    },
  },
  onions: {
    spring: {
      method: 'Plant sets or seedlings directly in the ground',
      outdoorWeeksFromFrost: -3,
      note: 'Get it in as early as the soil can be worked.',
    },
  },
  broccoli: {
    spring: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -1,
      indoorWeeksFromFrost: -6,
      note: 'Tolerates light frost; getting it in before summer heat prevents premature bolting.',
    },
    fall: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -12,
      indoorWeeksFromFrost: -18,
      note: 'Fall broccoli often tastes sweeter than spring, since cool weather curbs bitterness. Protect the head if a hard frost threatens.',
    },
  },
  cauliflower: {
    spring: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -1,
      indoorWeeksFromFrost: -6,
      note: 'Needs steady, unchecked growth; a check in growth from cold or heat causes small heads.',
    },
    fall: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -13,
      indoorWeeksFromFrost: -19,
      note: 'A late-summer heat wave can stress young transplants, so keep them consistently watered while they establish for the cool finish ahead.',
    },
  },
  cabbage: {
    spring: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -1,
      indoorWeeksFromFrost: -6,
      note: 'Tolerates light frost; plant early for a head before summer heat.',
    },
    fall: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -11,
      indoorWeeksFromFrost: -17,
      note: 'A favorite second-season crop: cool fall weather tends to produce firmer, sweeter heads than spring does.',
    },
  },
  kale: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'Very cold-hardy, can go in weeks before last frost.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -9,
      note: 'Very cold-hardy; flavor actually improves after a light frost.',
    },
  },
  spinach: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -3,
      note: 'Bolts fast in heat; get it in as early as the soil can be worked.',
    },
    fall: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -6,
      note: 'One of the most frost-tolerant crops there is, a fall crop can often be picked well past the first frost.',
    },
  },
  chard: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -1,
      note: 'More heat-tolerant than spinach and keeps producing leaves all season.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -8,
      note: 'Tolerates a light frost and keeps producing into cooler weather better than most greens.',
    },
  },
  beets: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -2,
      note: 'Soak seed clusters overnight before sowing to speed germination.',
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -8,
      note: 'Roots grown in cooler fall weather are often sweeter than a spring crop.',
    },
  },
  radishes: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -3,
      note: 'Very fast, ready in weeks. Sow in succession for a steady supply.',
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -11,
      note: 'So fast (25-30 days) that it works as a repeat, succession-sow crop from late summer through most of fall, not a one-shot planting.',
    },
  },
  turnips: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -3,
      note: 'Tolerates light frost; thin seedlings so roots have room to size up.',
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -6,
      note: 'A classic fall crop, roots sweeten after a light frost.',
    },
  },
  rutabaga: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -1,
      note: 'Slower and larger than turnips; give it a longer runway before fall.',
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -12,
      note: 'Slower than turnips, so give it more runway before frost; flavor improves with cold.',
    },
  },
  kohlrabi: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'Harvest while the bulb is still small; oversized ones turn woody.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -8,
      note: 'Handles light frost well, and the bulb stays milder in cool weather.',
    },
  },
  peas: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -3,
      note: 'Cold-tolerant and heat-averse; get it in as early as possible.',
    },
    fall: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: -9,
      note: 'Trickier than a spring crop since it starts in lingering summer heat, but pods finish in the cool weather peas actually prefer.',
    },
  },
  beans: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: 1,
      note: 'Frost-tender; seeds rot in cold, wet soil, so wait until it has truly warmed up.',
    },
  },
  zucchini: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -3,
      note: 'Extremely productive once it gets going; check on it daily.',
    },
  },
  pumpkin: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: 1,
      note: 'Needs a long season and plenty of room to sprawl.',
    },
  },
  eggplant: {
    spring: {
      method: 'Start seeds indoors',
      outdoorWeeksFromFrost: 2,
      indoorWeeksFromFrost: -8,
      note: 'Slow to start and wants consistently warm soil, similar timing to peppers.',
    },
  },
  celery: {
    spring: {
      method: 'Start seeds indoors',
      outdoorWeeksFromFrost: 1,
      indoorWeeksFromFrost: -10,
      note: 'Slow to start and thirsty throughout; do not let it dry out even briefly.',
    },
  },
  asparagus: {
    spring: {
      method: 'Plant crowns directly in the ground',
      outdoorWeeksFromFrost: -1,
      note: "A perennial: crowns planted now won't be harvestable until year three, so this tracks the establishment year.",
    },
  },
  brusselssprouts: {
    spring: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: 0,
      indoorWeeksFromFrost: -6,
      note: 'A long-season crop; sprouts actually sweeten after a light frost in fall, so this one planting already carries you into the second season.',
    },
  },
  leeks: {
    spring: {
      method: 'Start seeds indoors, or buy seedlings',
      outdoorWeeksFromFrost: -2,
      indoorWeeksFromFrost: -10,
      note: 'Slow-growing; hill soil around the stem as it grows to blanch it white.',
    },
  },
  okra: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: 2,
      note: "Loves heat; don't rush it into cold soil, seeds will just sit there.",
    },
  },
  sweetpotatoes: {
    spring: {
      method: 'Plant slips (rooted cuttings), not seed',
      outdoorWeeksFromFrost: 3,
      note: 'Wait until soil is thoroughly warm before planting slips.',
    },
  },
  watermelon: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 2,
      indoorWeeksFromFrost: -3,
      note: 'Needs warm soil and a long season.',
    },
  },
  cantaloupe: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 2,
      indoorWeeksFromFrost: -3,
      note: 'Similar needs to watermelon, but a shorter season.',
    },
  },
  arugula: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -2,
      note: 'Fast and bolt-prone; sow every couple weeks for a steady supply.',
    },
    fall: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -11,
      note: "Fast enough to sow every couple weeks from late summer through fall. Cool weather also slows bolting, so it holds longer than a spring crop.",
    },
  },
  collards: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'More cold- and heat-tolerant than most greens, a forgiving crop.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -9,
      note: 'Like kale, flavor sweetens after a light frost.',
    },
  },
  bokchoy: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'Fast-growing but bolts quickly once heat arrives, so plant early.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -7,
      note: "Bolts less in fall's cooling temperatures than it does in spring's warming ones.",
    },
  },
  cilantro: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -1,
      note: 'Bolts fast in heat; sow every few weeks instead of one big batch.',
    },
    fall: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -7,
      note: "Actually an easier season for cilantro than spring: it bolts fast in heat, and fall's cooling weather holds it longer.",
    },
  },
  dill: {
    spring: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -1,
      note: 'Bolts in heat like cilantro, so plant in succession.',
    },
    fall: {
      method: 'Direct sow',
      outdoorWeeksFromFrost: -6,
      note: "Cooler fall weather slows the bolting that cuts a spring crop short.",
    },
  },
  parsley: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'Slow to germinate; be patient, it can take a few weeks to sprout.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -10,
      note: 'Slow to start, but cold-hardy enough that a fall planting often overwinters in milder climates.',
    },
  },
  chives: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -2,
      note: 'Easygoing and cold-tolerant; comes back reliably once established.',
    },
  },
  mint: {
    spring: {
      method: 'Start from a nursery start, not seed',
      outdoorWeeksFromFrost: -1,
      note: 'Spreads aggressively. Grow it in a container unless you want it everywhere.',
    },
  },
  rosemary: {
    spring: {
      method: 'Start from a nursery start; seed is slow and unreliable',
      outdoorWeeksFromFrost: 0,
      note: "Drought-tolerant once established; go easy on water, it dislikes wet roots.",
    },
  },
  thyme: {
    spring: {
      method: 'Start from a nursery start; seed is slow and unreliable',
      outdoorWeeksFromFrost: 0,
      note: 'Drought-tolerant like rosemary, so do not overwater.',
    },
  },
  oregano: {
    spring: {
      method: 'Start from a nursery start; seed is slow and unreliable',
      outdoorWeeksFromFrost: 0,
      note: 'Drought-tolerant once established, more flavorful when grown a little lean.',
    },
  },
  sage: {
    spring: {
      method: 'Start from a nursery start; seed is slow and unreliable',
      outdoorWeeksFromFrost: 0,
      note: 'Drought-tolerant once established; needs good drainage more than frequent water.',
    },
  },
  blueberries: {
    spring: {
      method: 'Plant a potted bush, not seed',
      outdoorWeeksFromFrost: -1,
      note: 'A perennial. Needs acidic soil; expect a light harvest this first year.',
    },
  },
  raspberries: {
    spring: {
      method: 'Plant bare-root canes',
      outdoorWeeksFromFrost: -2,
      note: 'A perennial. This first season is mostly about establishing; fuller harvests come next year.',
    },
  },
  blackberries: {
    spring: {
      method: 'Plant bare-root canes',
      outdoorWeeksFromFrost: -2,
      note: 'A perennial. This first season is mostly about establishing; fuller harvests come next year.',
    },
  },
  grapes: {
    spring: {
      method: 'Plant a bare-root or potted vine',
      outdoorWeeksFromFrost: -1,
      note: 'A perennial vine that needs a trellis or arbor to climb. Expect little to no fruit this first year while it establishes.',
    },
  },
  rhubarb: {
    spring: {
      method: 'Plant crowns directly in the ground',
      outdoorWeeksFromFrost: -2,
      note: "A perennial: don't harvest any stalks this first year, let it build strength for years of harvests to come. Only the stalks are edible; the leaves are toxic and belong in the compost, not the kitchen.",
    },
  },
  figs: {
    spring: {
      method: 'Plant a potted or bare-root tree',
      outdoorWeeksFromFrost: 0,
      note: 'A perennial that fruits best in warm climates. In colder zones, grow it in a large container you can move to shelter for winter.',
    },
  },
  marigold: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      note: 'Thrives in heat once established. A classic vegetable-garden companion, its scent is said to help keep some pests away.',
    },
  },
  zinnia: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      note: 'Fast and prolific, one of the easiest cut flowers to grow from seed.',
    },
  },
  sunflower: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: 1,
      note: "Doesn't transplant well thanks to a deep taproot, so sow it directly where it will grow.",
    },
  },
  cosmos: {
    spring: {
      method: 'Direct sow, or start indoors for a head start',
      outdoorWeeksFromFrost: 1,
      note: 'Thrives in poor soil and heat. Rich soil or heavy feeding gives lots of foliage but fewer flowers.',
    },
  },
  nasturtium: {
    spring: {
      method: 'Direct sow only',
      outdoorWeeksFromFrost: 1,
      note: "Doesn't transplant well. Both the leaves and flowers are edible, with a peppery, watercress-like bite.",
    },
  },
  pansy: {
    spring: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -3,
      note: 'Tolerates light frost and cool weather, but struggles once summer heat arrives.',
    },
    fall: {
      method: 'Direct sow, or start seedlings',
      outdoorWeeksFromFrost: -6,
      note: 'A classic fall planting in mild climates, where it often blooms right through a light winter.',
    },
  },
  other: {
    spring: {
      method: 'Check the seed packet or plant tag',
      outdoorWeeksFromFrost: 0,
      note: 'Timing varies a lot by plant. Around your last frost date is a reasonable default.',
    },
  },
};

function parseMonthDay(monthDay: string, year: number): Date {
  const [m, d] = monthDay.split('-').map(Number);
  return new Date(year, m - 1, d);
}

function addWeeks(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * 86400000);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

interface Candidate {
  season: 'spring' | 'fall';
  window: SeasonWindow;
  frostDate: Date;
  outdoorDate: Date;
}

// A generic, typical first fall frost, substituted in only when the real
// measured estimate is anomalously late (see isAnomalouslyLateFrost below).
// Mild, coastal-influenced climates can have a real first frost as late as
// January or February (see frost.ts) — backward-computing a fall planting
// date from that pushes even fast, forgiving crops toward literal
// midwinter, which no real gardening guide would recommend, because the
// fall-planting window is really set by when summer heat breaks and days
// start shortening, not by the literal frost date.
const FALL_FROST_CAP: Record<'north' | 'south', string> = { north: '11-15', south: '05-15' };

// How far frost.ts's fall search originally ran (Sep1-Dec31 north /
// Feb1-May31 south, ~121 days) before it was widened to catch mild-climate
// first frosts landing in Jan/Feb (or Jun/Jul south) — see frost.ts's own
// comment. A measured first frost beyond that original span is exactly the
// case the widening was for: a real value, but too late to usefully time a
// fall garden by, so FALL_FROST_CAP substitutes for it instead. A frost
// within the original span (the normal case for most temperate climates)
// is always trusted as-is, however late in that range it falls.
const ORIGINAL_FALL_SEARCH_DAYS = 121;

function daysFromFallAnchor(monthDay: string, isNorthern: boolean): number {
  const anchorMonth = isNorthern ? 8 : 1; // Sep (north) / Feb (south), 0-indexed
  const refYear = 2021; // arbitrary non-leap reference year
  const anchor = new Date(refYear, anchorMonth, 1);
  const [m, d] = monthDay.split('-').map(Number);
  let target = new Date(refYear, m - 1, d);
  if (target < anchor) target = new Date(refYear + 1, m - 1, d); // wrapped into the window's following year
  return Math.round((target.getTime() - anchor.getTime()) / 86400000);
}

function isAnomalouslyLateFrost(monthDay: string, isNorthern: boolean): boolean {
  return daysFromFallAnchor(monthDay, isNorthern) > ORIGINAL_FALL_SEARCH_DAYS;
}

/** What to do about a crop the user hasn't planted yet: when (relative to
 * their real frost-date estimates) and how (seed vs. seedling, container vs.
 * direct in the ground, spring vs. fall). Falls back to generic, date-free
 * guidance when no frost estimate exists yet (no location set) or the crop
 * has no window matching the frost data that is available. */
export function plantingGuidanceFor(
  crop: CropKey,
  frostDates: FrostEstimate | null | undefined,
  now: Date = new Date()
): PlantingGuidance {
  const info = PLANTING_METHOD[crop];
  const candidates: Candidate[] = [];

  function addCandidates(season: 'spring' | 'fall', window: SeasonWindow | undefined, frostMonthDay: string | null | undefined) {
    if (!window || !frostMonthDay) return;
    // Three occurrences (last year's, this year's, next year's) of the
    // same frost anchor so the nearest-to-today pick below wraps correctly
    // around the calendar-year boundary in either direction.
    for (const yearOffset of [-1, 0, 1]) {
      const frostDate = parseMonthDay(frostMonthDay, now.getFullYear() + yearOffset);
      candidates.push({ season, window, frostDate, outdoorDate: addWeeks(frostDate, window.outdoorWeeksFromFrost) });
    }
  }

  addCandidates('spring', info.spring, frostDates?.lastFrostMonthDay);

  if (frostDates) {
    // Defaults to north for profiles saved before this field existed —
    // most users are northern-hemisphere, and this only affects which
    // generic reference substitutes for an anomalously late measured frost.
    const isNorthern = frostDates.isNorthernHemisphere !== false;
    const cap = FALL_FROST_CAP[isNorthern ? 'north' : 'south'];
    const measured = frostDates.firstFrostMonthDay;
    const effectiveFirstFrost = measured && !isAnomalouslyLateFrost(measured, isNorthern) ? measured : cap;
    addCandidates('fall', info.fall, effectiveFirstFrost);
  }

  if (candidates.length === 0) {
    const fallback = (info.spring ?? info.fall) as SeasonWindow;
    return {
      headline: 'Not planted yet',
      detail: `${fallback.method}. ${fallback.note} Add your location in Settings for exact dates for your zone.`,
      isPastDue: false,
      date: null,
    };
  }

  // Whichever window's target date is chronologically closest to today —
  // spring or fall — is the one worth acting on right now. This is what
  // hands guidance over to the fall window once spring's has passed,
  // instead of a crop being stuck showing (or being "due for") its spring
  // advice for the rest of the year.
  candidates.sort(
    (a, b) => Math.abs(a.outdoorDate.getTime() - now.getTime()) - Math.abs(b.outdoorDate.getTime() - now.getTime())
  );
  const chosen = candidates[0];
  const outdoorLabel = formatDate(chosen.outdoorDate);
  const isPastDue = now >= chosen.outdoorDate;

  let detail: string;
  if (chosen.window.indoorWeeksFromFrost != null) {
    const indoorLabel = formatDate(addWeeks(chosen.frostDate, chosen.window.indoorWeeksFromFrost));
    const frostPhrase = chosen.season === 'spring' ? 'after your last frost' : 'before your first fall frost';
    detail = isPastDue
      ? `${chosen.window.method}. The window opened around ${indoorLabel} indoors, moving outside around ${outdoorLabel}. Plant now if you haven't yet. ${chosen.window.note}`
      : `${chosen.window.method} around ${indoorLabel}. Move outside around ${outdoorLabel}, ${frostPhrase}. ${chosen.window.note}`;
  } else {
    detail = isPastDue
      ? `${chosen.window.method}. The window opened around ${outdoorLabel}. Plant it now. ${chosen.window.note}`
      : `${chosen.window.method}, around ${outdoorLabel}. ${chosen.window.note}`;
  }

  const label = cropLabel(crop);
  return {
    // A date that's already passed reads as "you missed it" rather than
    // "the window's open, go ahead" — once due, the headline says so
    // directly instead of naming a now-past date. Naming the crop keeps
    // the Home task list (which shows several of these back to back)
    // scannable instead of a repeated, undifferentiated "Plant now".
    headline: isPastDue ? `Plant ${label} now` : `Plant ${label} around ${outdoorLabel}`,
    detail,
    isPastDue,
    date: chosen.outdoorDate,
  };
}
