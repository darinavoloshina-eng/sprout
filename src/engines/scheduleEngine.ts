// scheduleEngine.ts
// Pure functions, no UI or network dependencies — easy to unit test.

export type SunExposure = 'full' | 'morning' | 'shade';
export type WateringMethod = 'drip' | 'hand';
// The first four are the free tier (see FREE_CROPS in EditCropsScreen.tsx /
// OnboardingScreen.tsx); the rest unlock with profile.isPro.
export type CropKey =
  | 'tomatoes'
  | 'cucumbers'
  | 'lettuce'
  | 'carrots'
  | 'peppers'
  | 'basil'
  | 'potatoes'
  | 'garlic'
  | 'strawberries'
  | 'squash'
  | 'corn'
  | 'onions'
  | 'broccoli'
  | 'cauliflower'
  | 'cabbage'
  | 'kale'
  | 'spinach'
  | 'chard'
  | 'beets'
  | 'radishes'
  | 'turnips'
  | 'peas'
  | 'beans'
  | 'zucchini'
  | 'pumpkin'
  | 'eggplant'
  | 'celery'
  | 'asparagus'
  | 'brusselssprouts'
  | 'leeks'
  | 'okra'
  | 'sweetpotatoes'
  | 'rutabaga'
  | 'kohlrabi'
  | 'arugula'
  | 'collards'
  | 'bokchoy'
  | 'cilantro'
  | 'parsley'
  | 'mint'
  | 'rosemary'
  | 'thyme'
  | 'oregano'
  | 'dill'
  | 'chives'
  | 'sage'
  | 'watermelon'
  | 'cantaloupe'
  | 'blueberries'
  | 'raspberries'
  | 'blackberries'
  | 'grapes'
  | 'rhubarb'
  | 'figs'
  | 'marigold'
  | 'zinnia'
  | 'sunflower'
  | 'cosmos'
  | 'nasturtium'
  | 'pansy'
  | 'other';

export interface WeatherSnapshot {
  recentRainIn: number; // rain fallen in the last ~2 days
  upcomingRainIn: number; // rain forecast in the next few days
  tempF: number | null; // current temperature
  forecastMaxTempF: number | null; // max forecast high, next few days
  todayHighF: number | null; // today's forecast high
  todayLowF: number | null; // today's forecast low
  weatherCode: number | null; // current WMO weather interpretation code
}

export interface GardenSetup {
  crops: CropKey[];
  sun: SunExposure;
  bedWidthFt: number;
  bedLengthFt: number;
  method: WateringMethod;
  // drip-only fields
  lineSpacingIn?: number;
  emitterSpacingIn?: number;
  emitterGph?: number;
  weather?: WeatherSnapshot | null;
}

export type TimeOfDay = 'morning' | 'morning and evening';

export interface ScheduleResult {
  areaSqFt: number;
  targetInchesPerWeek: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  timeOfDay: TimeOfDay;
  weatherAlert: string | null;
}

const CROP_WEEKLY_NEED_IN: Record<CropKey, number> = {
  tomatoes: 1.75,
  cucumbers: 1.75,
  lettuce: 1.0,
  carrots: 1.0,
  peppers: 1.5,
  basil: 1.25,
  potatoes: 1.5,
  garlic: 1.0,
  strawberries: 1.5,
  squash: 1.75,
  corn: 1.75,
  onions: 1.25,
  broccoli: 1.25,
  cauliflower: 1.25,
  cabbage: 1.25,
  kale: 1.0,
  spinach: 1.0,
  chard: 1.0,
  beets: 1.0,
  radishes: 1.0,
  turnips: 1.0,
  rutabaga: 1.0,
  kohlrabi: 1.0,
  peas: 1.0,
  beans: 1.25,
  zucchini: 1.75,
  pumpkin: 1.75,
  eggplant: 1.5,
  okra: 1.5,
  watermelon: 1.75,
  cantaloupe: 1.75,
  leeks: 1.0,
  sweetpotatoes: 1.25,
  celery: 1.75,
  asparagus: 1.0,
  brusselssprouts: 1.25,
  arugula: 1.0,
  collards: 1.0,
  bokchoy: 1.0,
  cilantro: 1.0,
  dill: 1.0,
  parsley: 1.0,
  chives: 1.0,
  mint: 1.25,
  rosemary: 0.75,
  thyme: 0.75,
  oregano: 0.75,
  sage: 0.75,
  blueberries: 1.25,
  raspberries: 1.25,
  blackberries: 1.25,
  grapes: 1.0,
  rhubarb: 1.25,
  figs: 1.0,
  marigold: 1.0,
  zinnia: 1.0,
  sunflower: 1.25,
  cosmos: 1.0,
  nasturtium: 1.0,
  pansy: 1.0,
  other: 1.25,
};

// Forecast high (°F) above which that crop benefits from a second, evening
// session rather than one morning soak — shallower-rooted/leafier crops
// wilt faster in heat, so they get a lower threshold. When several crops
// are picked, the most heat-sensitive one drives the recommendation, same
// "worst case wins" logic computeSchedule already uses for water volume.
const CROP_HEAT_THRESHOLD_F: Record<CropKey, number> = {
  lettuce: 80,
  carrots: 85,
  cucumbers: 88,
  tomatoes: 90,
  strawberries: 82,
  potatoes: 85,
  basil: 85,
  onions: 85,
  garlic: 88,
  squash: 90,
  peppers: 92,
  corn: 92,
  broccoli: 75,
  cauliflower: 75,
  cabbage: 80,
  kale: 80,
  spinach: 75,
  chard: 85,
  beets: 82,
  radishes: 78,
  turnips: 78,
  rutabaga: 78,
  kohlrabi: 78,
  peas: 75,
  beans: 90,
  zucchini: 90,
  pumpkin: 90,
  eggplant: 90,
  okra: 92,
  watermelon: 92,
  cantaloupe: 92,
  leeks: 85,
  sweetpotatoes: 92,
  celery: 80,
  asparagus: 85,
  brusselssprouts: 78,
  arugula: 75,
  collards: 82,
  bokchoy: 78,
  cilantro: 75,
  dill: 78,
  parsley: 82,
  chives: 85,
  mint: 85,
  rosemary: 95,
  thyme: 95,
  oregano: 95,
  sage: 95,
  blueberries: 88,
  raspberries: 88,
  blackberries: 88,
  grapes: 90,
  rhubarb: 78,
  figs: 95,
  marigold: 90,
  zinnia: 90,
  sunflower: 92,
  cosmos: 92,
  nasturtium: 88,
  pansy: 75,
  other: 85,
};

const SUN_ADJUSTMENT: Record<SunExposure, { factor: number; sessionsPerWeek: number }> = {
  full: { factor: 1.0, sessionsPerWeek: 3 },
  morning: { factor: 0.85, sessionsPerWeek: 3 },
  shade: { factor: 0.7, sessionsPerWeek: 2 },
};

/** Bed sizes offered in onboarding, in feet. */
export const BED_SIZES: { key: string; label: string; widthFt: number; lengthFt: number }[] = [
  { key: '4x4', label: '4 × 4 ft', widthFt: 4, lengthFt: 4 },
  { key: '4x6', label: '4 × 6 ft', widthFt: 4, lengthFt: 6 },
  { key: '4x8', label: '4 × 8 ft', widthFt: 4, lengthFt: 8 },
];

// Previously capped at 18"/0.5, which meant a real, sparser drip layout
// (wider spacing, or lower-flow emitters — both common: many kits use
// 0.25 GPH "low flow" emitters, and beds set up with one line per row
// rather than a full grid effectively have much wider spacing) couldn't
// be represented, silently understating the real minutes needed. 24"/36"
// and 0.25 GPH extend the range to cover that.
export const LINE_SPACING_OPTIONS = [6, 12, 18, 24, 36];
export const EMITTER_SPACING_OPTIONS = [6, 12, 18, 24, 36];
export const EMITTER_GPH_OPTIONS = [0.25, 0.5, 0.8, 1.0];

/**
 * Morning is the default — it cuts evaporation loss and keeps foliage from
 * sitting wet overnight, which invites fungal disease. Evening is added on
 * top (not swapped in) when the forecast high crosses the picked crops'
 * heat threshold, so a hot stretch gets a second, cooler-hours session
 * rather than skipping the morning one.
 */
function timeOfDayFor(setup: GardenSetup): TimeOfDay {
  const maxTemp = setup.weather?.forecastMaxTempF;
  if (maxTemp == null) return 'morning';
  const threshold = setup.crops.reduce(
    (min, crop) => Math.min(min, CROP_HEAT_THRESHOLD_F[crop]),
    Infinity
  );
  return maxTemp >= threshold ? 'morning and evening' : 'morning';
}

/**
 * Computes a watering schedule from bed geometry, drip/hand setup, crop mix,
 * sun exposure, and (optionally) live weather data.
 */
export function computeSchedule(setup: GardenSetup): ScheduleResult {
  const areaSqFt = setup.bedWidthFt * setup.bedLengthFt;

  const baseTarget = setup.crops.reduce(
    (max, crop) => Math.max(max, CROP_WEEKLY_NEED_IN[crop] ?? 1.0),
    1.0
  );

  const sunInfo = SUN_ADJUSTMENT[setup.sun];
  let targetInchesPerWeek = baseTarget * sunInfo.factor;

  const rainOffset = setup.weather?.recentRainIn ?? 0;
  targetInchesPerWeek = Math.max(0.25, targetInchesPerWeek - rainOffset);

  const sessionsPerWeek = sunInfo.sessionsPerWeek;
  const inchesPerSession = targetInchesPerWeek / sessionsPerWeek;

  let minutesPerSession: number;

  // Emitter count/spacing/GPH still drive how long the session actually
  // needs to run (a sparser or lower-flow drip layout needs more minutes to
  // deliver the same water) — that math stays. It just no longer shows up
  // in the task copy; see timeOfDayFor below for what does.
  if (setup.method === 'drip') {
    const lineSpacing = setup.lineSpacingIn ?? 12;
    const emitterSpacing = setup.emitterSpacingIn ?? 12;
    const gph = setup.emitterGph ?? 0.5;

    const linesAcross = Math.max(1, Math.round((setup.bedWidthFt * 12) / lineSpacing));
    const emittersPerLine = Math.max(1, Math.round((setup.bedLengthFt * 12) / emitterSpacing));
    const totalEmitters = linesAcross * emittersPerLine;
    const totalFlowGph = totalEmitters * gph;
    const densityGphPerSqFt = totalFlowGph / areaSqFt;
    const rateInPerHr = densityGphPerSqFt * 1.6; // 1 gal/sqft ≈ 1.6" of water depth

    minutesPerSession = Math.round((inchesPerSession / rateInPerHr) * 60);
  } else {
    const rateInPerHr = 0.6; // rough hand-watering effective rate
    minutesPerSession = Math.round((inchesPerSession / rateInPerHr) * 60);
  }

  const timeOfDay = timeOfDayFor(setup);
  // A "morning and evening" day splits the same daily total into two
  // shorter waterings rather than doubling how much water goes down —
  // minutesPerSession is what to run at each of those times.
  if (timeOfDay === 'morning and evening') {
    minutesPerSession = Math.round(minutesPerSession / 2);
  }
  minutesPerSession = Math.max(3, minutesPerSession);

  let weatherAlert: string | null = null;
  if (setup.weather) {
    if (setup.weather.upcomingRainIn > 0.1) {
      weatherAlert = 'rain expected soon, you may be able to skip a session';
    } else if (rainOffset > 0.05) {
      weatherAlert = 'trimmed for recent rain';
    }
  }

  return {
    areaSqFt,
    targetInchesPerWeek: Number(targetInchesPerWeek.toFixed(2)),
    sessionsPerWeek,
    minutesPerSession,
    timeOfDay,
    weatherAlert,
  };
}

/** Which weekdays (0=Sun..6=Sat) the schedule waters on, for display purposes. */
export function wateringDaysOfWeek(sessionsPerWeek: number): number[] {
  return sessionsPerWeek === 3 ? [1, 3, 5] : [1, 4];
}

/** The next watering day after today, as a Date at 7am local. */
export function nextWateringDate(sessionsPerWeek: number, from: Date = new Date()): Date {
  const days = wateringDaysOfWeek(sessionsPerWeek);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(7, 0, 0, 0);
    if (days.includes(candidate.getDay()) && candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }
  const fallback = new Date(from);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(7, 0, 0, 0);
  return fallback;
}
