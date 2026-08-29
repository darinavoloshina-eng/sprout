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

import { CropKey } from './scheduleEngine';
import { FrostEstimate } from '../types';

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
}

interface PlantingMethodInfo {
  method: string;
  outdoorWeeksFromLastFrost: number; // negative = before last frost, positive = after
  indoorWeeksFromLastFrost?: number; // only set for crops usually started indoors first
  note: string;
}

const PLANTING_METHOD: Record<CropKey, PlantingMethodInfo> = {
  tomatoes: {
    method: 'Start seeds indoors',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -6,
    note: 'Transplant seedlings out once nights stay reliably above 50°F.',
  },
  cucumbers: {
    method: 'Direct sow, or start indoors for a head start',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -3,
    note: 'Soil should be warm; cold soil stalls germination.',
  },
  lettuce: {
    method: 'Direct sow, or start seedlings in containers',
    outdoorWeeksFromLastFrost: -2,
    note: 'Tolerates light frost, no need to wait for it to fully pass.',
  },
  carrots: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -2,
    note: "Doesn't transplant well. The taproot doesn't like being disturbed.",
  },
  peppers: {
    method: 'Start seeds indoors',
    outdoorWeeksFromLastFrost: 2,
    indoorWeeksFromLastFrost: -8,
    note: 'Peppers want warmer soil than tomatoes, give it an extra week or two past last frost.',
  },
  basil: {
    method: 'Start indoors, or direct sow once it warms up',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -6,
    note: 'Very frost-tender; cold sets it back badly.',
  },
  potatoes: {
    method: 'Plant seed potato pieces (with eyes) directly in the ground',
    outdoorWeeksFromLastFrost: -3,
    note: 'Tolerates light frost.',
  },
  garlic: {
    method: 'Plant cloves directly in the ground',
    outdoorWeeksFromLastFrost: -4,
    note: 'Get it in as early as the soil can be worked.',
  },
  strawberries: {
    method: 'Plant bare-root crowns or starts directly in the ground',
    outdoorWeeksFromLastFrost: -3,
    note: 'Grown from crowns, not seed, for a first-year harvest.',
  },
  squash: {
    method: 'Direct sow, or start indoors for a head start',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -3,
    note: 'Soil should be warm.',
  },
  corn: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: 1,
    note: "Doesn't transplant well.",
  },
  onions: {
    method: 'Plant sets or seedlings directly in the ground',
    outdoorWeeksFromLastFrost: -3,
    note: 'Get it in as early as the soil can be worked.',
  },
  broccoli: {
    method: 'Start seeds indoors, or buy seedlings',
    outdoorWeeksFromLastFrost: -1,
    indoorWeeksFromLastFrost: -6,
    note: 'Tolerates light frost; getting it in before summer heat prevents premature bolting.',
  },
  cauliflower: {
    method: 'Start seeds indoors, or buy seedlings',
    outdoorWeeksFromLastFrost: -1,
    indoorWeeksFromLastFrost: -6,
    note: 'Needs steady, unchecked growth; a check in growth from cold or heat causes small heads.',
  },
  cabbage: {
    method: 'Start seeds indoors, or buy seedlings',
    outdoorWeeksFromLastFrost: -1,
    indoorWeeksFromLastFrost: -6,
    note: 'Tolerates light frost; plant early for a head before summer heat.',
  },
  kale: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'Very cold-hardy, can go in weeks before last frost.',
  },
  spinach: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: -3,
    note: 'Bolts fast in heat; get it in as early as the soil can be worked.',
  },
  chard: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -1,
    note: 'More heat-tolerant than spinach and keeps producing leaves all season.',
  },
  beets: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -2,
    note: 'Soak seed clusters overnight before sowing to speed germination.',
  },
  radishes: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -3,
    note: 'Very fast, ready in weeks. Sow in succession for a steady supply.',
  },
  turnips: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -3,
    note: 'Tolerates light frost; thin seedlings so roots have room to size up.',
  },
  rutabaga: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -1,
    note: 'Slower and larger than turnips; give it a longer runway before fall.',
  },
  kohlrabi: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'Harvest while the bulb is still small; oversized ones turn woody.',
  },
  peas: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: -3,
    note: 'Cold-tolerant and heat-averse; get it in as early as possible.',
  },
  beans: {
    method: 'Direct sow only',
    outdoorWeeksFromLastFrost: 1,
    note: 'Frost-tender; seeds rot in cold, wet soil, so wait until it has truly warmed up.',
  },
  zucchini: {
    method: 'Direct sow, or start indoors for a head start',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -3,
    note: 'Extremely productive once it gets going; check on it daily.',
  },
  pumpkin: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: 1,
    note: 'Needs a long season and plenty of room to sprawl.',
  },
  eggplant: {
    method: 'Start seeds indoors',
    outdoorWeeksFromLastFrost: 2,
    indoorWeeksFromLastFrost: -8,
    note: 'Slow to start and wants consistently warm soil, similar timing to peppers.',
  },
  celery: {
    method: 'Start seeds indoors',
    outdoorWeeksFromLastFrost: 1,
    indoorWeeksFromLastFrost: -10,
    note: 'Slow to start and thirsty throughout; do not let it dry out even briefly.',
  },
  asparagus: {
    method: 'Plant crowns directly in the ground',
    outdoorWeeksFromLastFrost: -1,
    note: "A perennial: crowns planted now won't be harvestable until year three, so this tracks the establishment year.",
  },
  brusselssprouts: {
    method: 'Start seeds indoors, or buy seedlings',
    outdoorWeeksFromLastFrost: 0,
    indoorWeeksFromLastFrost: -6,
    note: 'A long-season crop; sprouts actually sweeten after a light frost in fall.',
  },
  leeks: {
    method: 'Start seeds indoors, or buy seedlings',
    outdoorWeeksFromLastFrost: -2,
    indoorWeeksFromLastFrost: -10,
    note: 'Slow-growing; hill soil around the stem as it grows to blanch it white.',
  },
  okra: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: 2,
    note: "Loves heat; don't rush it into cold soil, seeds will just sit there.",
  },
  sweetpotatoes: {
    method: 'Plant slips (rooted cuttings), not seed',
    outdoorWeeksFromLastFrost: 3,
    note: 'Wait until soil is thoroughly warm before planting slips.',
  },
  watermelon: {
    method: 'Direct sow, or start indoors for a head start',
    outdoorWeeksFromLastFrost: 2,
    indoorWeeksFromLastFrost: -3,
    note: 'Needs warm soil and a long season.',
  },
  cantaloupe: {
    method: 'Direct sow, or start indoors for a head start',
    outdoorWeeksFromLastFrost: 2,
    indoorWeeksFromLastFrost: -3,
    note: 'Similar needs to watermelon, but a shorter season.',
  },
  arugula: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: -2,
    note: 'Fast and bolt-prone; sow every couple weeks for a steady supply.',
  },
  collards: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'More cold- and heat-tolerant than most greens, a forgiving crop.',
  },
  bokchoy: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'Fast-growing but bolts quickly once heat arrives, so plant early.',
  },
  cilantro: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: -1,
    note: 'Bolts fast in heat; sow every few weeks instead of one big batch.',
  },
  dill: {
    method: 'Direct sow',
    outdoorWeeksFromLastFrost: -1,
    note: 'Bolts in heat like cilantro, so plant in succession.',
  },
  parsley: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'Slow to germinate; be patient, it can take a few weeks to sprout.',
  },
  chives: {
    method: 'Direct sow, or start seedlings',
    outdoorWeeksFromLastFrost: -2,
    note: 'Easygoing and cold-tolerant; comes back reliably once established.',
  },
  mint: {
    method: 'Start from a nursery start, not seed',
    outdoorWeeksFromLastFrost: -1,
    note: 'Spreads aggressively. Grow it in a container unless you want it everywhere.',
  },
  rosemary: {
    method: 'Start from a nursery start; seed is slow and unreliable',
    outdoorWeeksFromLastFrost: 0,
    note: "Drought-tolerant once established; go easy on water, it dislikes wet roots.",
  },
  thyme: {
    method: 'Start from a nursery start; seed is slow and unreliable',
    outdoorWeeksFromLastFrost: 0,
    note: 'Drought-tolerant like rosemary, so do not overwater.',
  },
  oregano: {
    method: 'Start from a nursery start; seed is slow and unreliable',
    outdoorWeeksFromLastFrost: 0,
    note: 'Drought-tolerant once established, more flavorful when grown a little lean.',
  },
  sage: {
    method: 'Start from a nursery start; seed is slow and unreliable',
    outdoorWeeksFromLastFrost: 0,
    note: 'Drought-tolerant once established; needs good drainage more than frequent water.',
  },
  blueberries: {
    method: 'Plant a potted bush, not seed',
    outdoorWeeksFromLastFrost: -1,
    note: 'A perennial. Needs acidic soil; expect a light harvest this first year.',
  },
  raspberries: {
    method: 'Plant bare-root canes',
    outdoorWeeksFromLastFrost: -2,
    note: 'A perennial. This first season is mostly about establishing; fuller harvests come next year.',
  },
  other: {
    method: 'Check the seed packet or plant tag',
    outdoorWeeksFromLastFrost: 0,
    note: 'Timing varies a lot by plant. Around your last frost date is a reasonable default.',
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

/** What to do about a crop the user hasn't planted yet: when (relative to
 * their real last-frost estimate) and how (seed vs. seedling, container vs.
 * direct in the ground). Falls back to generic, date-free guidance when no
 * frost estimate exists yet (no location set). */
export function plantingGuidanceFor(
  crop: CropKey,
  frostDates: FrostEstimate | null | undefined,
  now: Date = new Date()
): PlantingGuidance {
  const info = PLANTING_METHOD[crop];

  if (!frostDates?.lastFrostMonthDay) {
    return {
      headline: 'Not planted yet',
      detail: `${info.method}. ${info.note} Add your location in Settings for exact dates for your zone.`,
      isPastDue: false,
    };
  }

  const lastFrost = parseMonthDay(frostDates.lastFrostMonthDay, now.getFullYear());
  const outdoorDate = addWeeks(lastFrost, info.outdoorWeeksFromLastFrost);
  const outdoorLabel = formatDate(outdoorDate);
  const isPastDue = now >= outdoorDate;

  if (info.indoorWeeksFromLastFrost != null) {
    const indoorLabel = formatDate(addWeeks(lastFrost, info.indoorWeeksFromLastFrost));
    return {
      headline: `Plant around ${outdoorLabel}`,
      detail: `${info.method} around ${indoorLabel}. Move outside around ${outdoorLabel}, after your last frost. ${info.note}`,
      isPastDue,
    };
  }

  return {
    headline: `Plant around ${outdoorLabel}`,
    detail: `${info.method}, around ${outdoorLabel}. ${info.note}`,
    isPastDue,
  };
}
