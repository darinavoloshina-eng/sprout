// taskEngine.ts
// Shared "what needs doing" logic for Home (today's checkable tasks) and
// Calendar (any date's read-only task list), plus completion + streak
// tracking. There is no separate tasks[] store — a task's identity is a
// stable, date-scoped id derived from what generates it (watering pattern
// or a crop-stage alert), and "completing" it just records a timestamp
// against that id. This keeps tasks always in sync with the live schedule
// instead of drifting out of date the way a stored, editable list would.

import { CropKey, ScheduleResult, TimeOfDay, computeSchedule, wateringDaysOfWeek } from './scheduleEngine';
import { CARE_BUCKET_FOR, getAlerts, PlantedBackdate, PlantedBucket } from './alertsEngine';
import { addWeeks, effectiveFirstFrostMonthDay, parseMonthDay, plantingGuidanceFor } from './plantingGuide';
import { GardenProfile, FrostEstimate } from '../types';
import { colors } from '../theme';
import { bedCrops, cropIcon, cropIconBg, cropLabel } from '../cropMeta';
import { SEASON_SHAPE } from '../plantStageContent';

export type TaskCategory = 'tend' | 'harvest' | 'feed' | 'prune' | 'seed';

export const CATEGORY_COLOR: Record<TaskCategory, string> = {
  tend: colors.mossGreen,
  harvest: colors.mustard,
  feed: colors.clay,
  prune: colors.pineDeep,
  seed: colors.seedBrown,
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  tend: 'Tend',
  harvest: 'Harvest',
  feed: 'Feed',
  prune: 'Prune',
  seed: 'Seeds',
};

export function categorize(text: string): TaskCategory {
  const t = text.toLowerCase();
  if (/collect seed|save seed/.test(t)) return 'seed';
  if (/harvest|pick|ripen/.test(t)) return 'harvest';
  if (/feed|fertiliz/.test(t)) return 'feed';
  if (/prune|pinch|sucker/.test(t)) return 'prune';
  return 'tend';
}

export interface DailyTask {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  detail: string;
  category: TaskCategory;
  // Set only on 'feed' tasks (see getFeedReminders) — a "Buy now" link the
  // task row can render. Points at a plain Amazon search for now, not a
  // real affiliate link or a specific product; wiring in an actual
  // affiliate tag and per-crop product picks is a separate, later step.
  buyUrl?: string;
}

/** A generic, unaffiliated Amazon search for the fertilizer a feed task
 * calls for — a placeholder "Buy now" destination until real affiliate
 * links and curated per-crop products exist. */
function placeholderFertilizerBuyUrl(crop: CropKey): string {
  const query = `${cropLabel(crop)} fertilizer`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeOfDayLabel(t: TimeOfDay): string {
  return t === 'morning and evening' ? 'Morning and evening' : 'Morning';
}

/** The most recent scheduled watering day at or before `today` (today
 * itself if today is one). Looks back at most a week, which is always
 * enough since watering happens at least twice a week — there's never a
 * gap longer than that between scheduled days. */
function mostRecentWateringDay(sessionsPerWeek: number, today: Date): Date {
  const days = wateringDaysOfWeek(sessionsPerWeek);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let back = 0; back < 7; back++) {
    if (days.includes(cursor.getDay())) return cursor;
    cursor.setDate(cursor.getDate() - 1);
  }
  return today; // unreachable given the "at least twice a week" guarantee above
}

function scheduleFor(profile: GardenProfile): ScheduleResult {
  return computeSchedule({
    crops: bedCrops(profile.crops),
    sun: profile.sun,
    bedWidthFt: profile.bedWidthFt,
    bedLengthFt: profile.bedLengthFt,
    method: profile.method,
    lineSpacingIn: profile.lineSpacingIn,
    emitterSpacingIn: profile.emitterSpacingIn,
    emitterGph: profile.emitterGph,
    weather: profile.weather,
  });
}

/** A crop's real bucket, preferring the exact date recorded by "Mark as
 * planted" over the coarse, manually-picked w2/w4/w8 pill. plantedDates is
 * the source of truth once it exists for a crop — every screen that shows
 * a planted crop's stage (Home, My Garden, Plant Detail, the alerts this
 * file generates) should read a crop's bucket through this instead of
 * `profile.plantedWeeks[crop]` directly, so "when they checked planted"
 * actually drives what's shown, not just an initial guess that's never
 * revisited. */
export function effectiveBucket(profile: GardenProfile, crop: CropKey, today: Date = new Date()): PlantedBucket {
  const plantedDate = profile.plantedDates?.[crop];
  if (!plantedDate) return CARE_BUCKET_FOR[profile.plantedWeeks[crop] ?? 'w2'];
  const weeksSince = Math.floor((today.getTime() - new Date(plantedDate).getTime()) / (7 * 86400000));
  if (weeksSince < 4) return 'w2';
  if (weeksSince < 8) return 'w4';
  return 'w8';
}

/** A manual pick of 'm6', 'y1', or 'y2' only ever comes from an explicit
 * long-duration bucket choice — markPlanted always writes 'w2', and
 * PlantedBucket (effectiveBucket's return type) has no way to represent
 * any of the three at all. Before assumedPlantedDateForBucket existed,
 * that never mattered here: a manual pick left plantedDates empty, so
 * effectiveBackdate/plantedAgoLabel below would take their "no tracked
 * date" branch and read the pick straight off plantedWeeks. Now that a
 * pick also synthesizes a plantedDates entry (so feed/succession
 * reminders have something to anchor to), both functions would otherwise
 * see a real date and try to derive a bucket from it — silently
 * collapsing "2+ yrs" to 'w8' the instant it's picked, which is a
 * regression, not a refinement: the whole point of picking 'y2' was to
 * say something effectiveBucket's four buckets can't say. Checking for
 * these three first keeps that pick intact everywhere it's displayed. */
function isLongDurationPick(bucket: PlantedBackdate | undefined): bucket is 'm6' | 'y1' | 'y2' {
  return bucket === 'm6' || bucket === 'y1' || bucket === 'y2';
}

/** The actual backdate a user picked for a crop with no tracked exact
 * date — unlike effectiveBucket, this preserves a long-duration pick
 * ('m6'/'y1'/'y2') instead of collapsing it to 'w8', since it's meant for
 * display (the pill that should read as selected, the label shown when
 * there's no exact date to compute from) rather than for driving care
 * content. */
export function effectiveBackdate(profile: GardenProfile, crop: CropKey, today: Date = new Date()): PlantedBackdate {
  const rawPick = profile.plantedWeeks[crop];
  if (isLongDurationPick(rawPick)) return rawPick;
  const plantedDate = profile.plantedDates?.[crop];
  if (!plantedDate) return rawPick ?? 'w2';
  return effectiveBucket(profile, crop, today);
}

/** How long ago a crop with a real plantedDates entry actually went in the
 * ground — "13 days ago", "6 weeks ago", "4 months ago" — instead of the
 * coarse w2/w4/w8 bucket label (BUCKET_LABEL in plantStageContent.ts),
 * which only ever says "1-4 wks ago" for the entire month after planting
 * and never moves within a bucket. Null for a long-duration pick
 * ('m6'/'y1'/'y2', see isLongDurationPick) even though it now has a
 * synthesized plantedDates entry — showing "3 years ago" for a "2+ yrs"
 * pick would read as falsely precise for something the user only ever
 * gestured at. Also null for a crop with no tracked date at all
 * (backdated via a short manual bucket pill, not "Mark as planted
 * today"), since there's no real date to measure from — callers should
 * fall back to the bucket label in either case, same as effectiveBucket
 * does internally. */
export function plantedAgoLabel(profile: GardenProfile, crop: CropKey, today: Date = new Date()): string | null {
  if (isLongDurationPick(profile.plantedWeeks[crop])) return null;
  const plantedDate = profile.plantedDates?.[crop];
  if (!plantedDate) return null;
  const days = Math.max(0, Math.floor((today.getTime() - new Date(plantedDate).getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (days < 730) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** The full plantedWeeks-shaped map, but with every crop's bucket resolved
 * through effectiveBucket — what getAlerts and friends should actually be
 * fed, instead of the raw stored map, so a date-tracked crop's stage
 * alerts move forward on their own as time passes rather than staying
 * pinned to whatever bucket was picked (or defaulted to) when it was
 * marked planted. */
function resolvedPlantedWeeks(profile: GardenProfile, today: Date): Partial<Record<CropKey, PlantedBucket>> {
  const result: Partial<Record<CropKey, PlantedBucket>> = {};
  for (const crop of profile.crops) {
    if (crop === 'other') continue;
    result[crop] = effectiveBucket(profile, crop, today);
  }
  return result;
}

/** Records today as the real planted date for a crop and moves it out of
 * "not planted yet" — the one-tap alternative to guessing which of the
 * 1-4/4-8/8+ week pills is closest, for the common case of marking
 * something planted the same day it went in the ground. */
export function markPlanted(profile: GardenProfile, crop: CropKey, today: Date = new Date()): GardenProfile {
  return {
    ...profile,
    plantedWeeks: { ...profile.plantedWeeks, [crop]: 'w2' },
    plantedDates: { ...profile.plantedDates, [crop]: today.toISOString() },
  };
}

// Roughly the midpoint of each bucket's range, in weeks — 'w0' has no
// entry since "not planted" has no date to guess at. 'w8' and 'y2' are
// open-ended ranges ("8+ wks", "2+ yrs"), so their number is just a
// reasonable stand-in rather than a real midpoint.
const ASSUMED_WEEKS_AGO: Partial<Record<PlantedBackdate, number>> = {
  w2: 2.5,
  w4: 6,
  w8: 10,
  m6: 19, // ~4.5 months
  y1: 65, // ~15 months
  y2: 156, // ~3 years
};

/** A manual backdate pill only records a fuzzy range ("1-4 wks ago"), not
 * a real date. Without a real date, getSuccessionReminders and
 * getFeedReminders have nothing to anchor their every-N-weeks cycle to and
 * can never fire — which used to mean picking a bucket instead of tapping
 * "Mark as planted today" (the common case) silently opted a crop out of
 * both features forever, even on Pro. This turns a bucket pick into a
 * one-time, stable best guess — the bucket's rough midpoint, counted back
 * from the day it was picked — so those reminders have something to work
 * from. It's deliberately not recomputed later: once stored, it ages
 * forward like any other plantedDates entry, exactly as if "Mark as
 * planted today" had been tapped that many weeks ago. Returns null for
 * 'w0' ("not planted" has no date to guess at), which callers should treat
 * as "clear plantedDates for this crop" the same as before this existed. */
export function assumedPlantedDateForBucket(bucket: PlantedBackdate, pickedOn: Date = new Date()): string | null {
  const weeksAgo = ASSUMED_WEEKS_AGO[bucket];
  if (weeksAgo == null) return null;
  return new Date(pickedOn.getTime() - weeksAgo * 7 * 86400000).toISOString();
}

interface SuccessionInfo {
  everyWeeks: number;
  note: string;
  /** How many weeks before the estimated first fall frost the LAST round of
   * this crop should still be sown — the true end of its growing season,
   * not an arbitrary cutoff. Short for fast, frost-hardy crops that can be
   * sown right up near frost (radishes, spinach); longer for slow crops or
   * ones frost kills outright with no fall tolerance at all (corn, basil,
   * beans, cucumbers, summer squash), which need real runway to mature —
   * or, for the frost-tender ones, simply to not be killed as seedlings. */
  cutoffWeeksBeforeFrost: number;
}

/** Fast, short-lived crops that are normally sown in repeated rounds for a
 * steady supply rather than once — see each crop's own planting note in
 * plantingGuide.ts, which already says as much. Only meaningful once a
 * crop has a real plantedDates entry: a succession reminder is timed to
 * the week, and a 4-week-wide bucket like "1-4 wks ago" isn't precise
 * enough to say whether 2 weeks have actually passed.
 *
 * Deliberately excludes some fast crops that might look like candidates:
 * peas stop being sowable once summer heat arrives, not near frost, and
 * this file has no way to detect "heat has arrived" — repeating this
 * crop's cadence off a frost date alone would eventually tell someone to
 * sow peas in July. Broccoli, cauliflower, and cabbage are usually grown
 * from nursery seedlings in one spring batch and one fall batch (already
 * covered by plantingGuide.ts's own spring/fall windows) rather than
 * genuinely repeated every few weeks by home gardeners. */
const SUCCESSION_INFO: Partial<Record<CropKey, SuccessionInfo>> = {
  radishes: { everyWeeks: 2, cutoffWeeksBeforeFrost: 4, note: 'So fast (25-30 days) that a fresh round every couple weeks keeps them coming instead of one big batch all at once.' },
  arugula: { everyWeeks: 2, cutoffWeeksBeforeFrost: 4, note: 'Bolts fast once it matures, so a new round every couple weeks keeps you in fresh leaves rather than one batch that all bolts together.' },
  lettuce: { everyWeeks: 2, cutoffWeeksBeforeFrost: 5, note: 'A fresh sowing every couple weeks means new heads are always coming along as older ones finish.' },
  spinach: { everyWeeks: 2, cutoffWeeksBeforeFrost: 3, note: 'Bolts fast in warm weather, so small, frequent sowings beat one big one that all turns bitter at once. Tolerant enough of frost to sow right up near it.' },
  bokchoy: { everyWeeks: 2, cutoffWeeksBeforeFrost: 5, note: 'Bolts quickly once mature, so a new round every couple weeks keeps a steady supply coming.' },
  turnips: { everyWeeks: 3, cutoffWeeksBeforeFrost: 5, note: 'Fast enough that another sowing every few weeks keeps young, tender roots coming all season.' },
  beets: { everyWeeks: 3, cutoffWeeksBeforeFrost: 6, note: 'Another sowing every few weeks keeps a steady supply of young, tender roots coming.' },
  carrots: { everyWeeks: 3, cutoffWeeksBeforeFrost: 8, note: 'Another sowing every few weeks keeps a continuous supply coming instead of a single big harvest.' },
  cilantro: { everyWeeks: 3, cutoffWeeksBeforeFrost: 5, note: 'Bolts fast in heat, so sowing a fresh round every few weeks instead of one big batch keeps you in fresh leaves.' },
  dill: { everyWeeks: 3, cutoffWeeksBeforeFrost: 5, note: 'Bolts in heat, so a fresh round every few weeks keeps leaves coming rather than one batch that flowers all at once.' },
  beans: { everyWeeks: 3, cutoffWeeksBeforeFrost: 9, note: 'Bush beans slow down after their first flush, so another sowing every few weeks keeps a steady harvest through the season.' },
  kohlrabi: { everyWeeks: 3, cutoffWeeksBeforeFrost: 6, note: 'Best harvested small before it turns woody, so another round every few weeks keeps young bulbs coming.' },
  corn: { everyWeeks: 2, cutoffWeeksBeforeFrost: 12, note: 'A whole planting tassels and ripens within about a week of itself, so staggered sowings every couple weeks are the only way to spread the harvest out instead of getting it all at once.' },
  basil: { everyWeeks: 4, cutoffWeeksBeforeFrost: 8, note: 'Leaf quality drops once a plant flowers, so starting a fresh round every few weeks keeps you in tender, best-quality leaves. Very frost-tender, so it needs real runway before frost.' },
  cucumbers: { everyWeeks: 4, cutoffWeeksBeforeFrost: 10, note: 'Production and disease resistance decline after several weeks of bearing, so a fresh round every few weeks keeps vines productive instead of relying on one aging planting.' },
  zucchini: { everyWeeks: 4, cutoffWeeksBeforeFrost: 10, note: 'Vine borers and mildew often take plants out midseason, so a fresh round every few weeks is cheap insurance and keeps the harvest going.' },
  squash: { everyWeeks: 4, cutoffWeeksBeforeFrost: 10, note: 'Vine borers and mildew often take plants out midseason, so a fresh round every few weeks is cheap insurance and keeps the harvest going.' },
};

/** The last date another round of a succession crop should still be sown —
 * the true end of its growing season, not an arbitrary number of rounds.
 * Timed off the same anomaly-capped first-fall-frost date the rest of the
 * planting guide uses (see plantingGuide.ts's effectiveFirstFrostMonthDay),
 * so a missing or wildly late measured frost date doesn't push this into
 * winter. Picks whichever year's frost date actually falls after planting,
 * since a crop planted late in the year could otherwise get matched to a
 * frost date that already passed. Null when there's no frost estimate at
 * all to bound the season with. */
function seasonEndForSuccession(plantedDate: Date, frostDates: FrostEstimate | null | undefined, cutoffWeeksBeforeFrost: number): Date | null {
  const monthDay = effectiveFirstFrostMonthDay(frostDates);
  if (!monthDay) return null;
  let frost = parseMonthDay(monthDay, plantedDate.getFullYear());
  if (frost.getTime() < plantedDate.getTime()) {
    frost = parseMonthDay(monthDay, plantedDate.getFullYear() + 1);
  }
  return addWeeks(frost, -cutoffWeeksBeforeFrost);
}

/** Every succession round for a crop, from the first one after planting
 * through the last one that still lands on or before the crop's real
 * season end — not just the next single date. Cycle numbering starts at 1
 * (cycle 0 is the original planting, not a reminder to repeat it) and is
 * stable whichever caller reads it: "is a round due today" or "mark every
 * future date on the calendar while browsing ahead" both need to agree on
 * which cycle number a given date is. */
function successionDueDates(plantedDate: Date, everyWeeks: number, seasonEnd: Date | null): { cycle: number; date: Date }[] {
  if (!seasonEnd) return [];
  const dates: { cycle: number; date: Date }[] = [];
  const cycleDays = everyWeeks * 7;
  for (let cycle = 1; cycle <= 52; cycle++) {
    const date = new Date(plantedDate.getTime() + cycle * cycleDays * 86400000);
    if (date.getTime() > seasonEnd.getTime()) break;
    dates.push({ cycle, date });
  }
  return dates;
}

/** Any crop with succession data, a real plantedDates entry, and enough
 * elapsed time for another round to be due — Pro, matching the rest of
 * this file's crop-guidance alerts. Bounded by the crop's real, coordinate-
 * based season end (seasonEndForSuccession): once today is past that, the
 * crop's growing season is over and no further rounds are suggested. The
 * task id is scoped to which succession "cycle" it is (weeks since
 * planting ÷ the crop's interval), so it's stable and checkable for that
 * whole cycle and rolls to a fresh, unchecked task once the next one comes
 * due — the same pattern the watering task already uses. */
export function getSuccessionReminders(profile: GardenProfile, today: Date = new Date()): DailyTask[] {
  if (!profile.isPro) return [];
  const tasks: DailyTask[] = [];
  for (const crop of profile.crops) {
    if (crop === 'other') continue;
    const info = SUCCESSION_INFO[crop];
    const plantedDate = profile.plantedDates?.[crop];
    if (!info || !plantedDate) continue;
    const planted = new Date(plantedDate);
    const daysSince = Math.floor((today.getTime() - planted.getTime()) / 86400000);
    if (daysSince < 0) continue;
    const seasonEnd = seasonEndForSuccession(planted, profile.frostDates, info.cutoffWeeksBeforeFrost);
    if (!seasonEnd || today.getTime() > seasonEnd.getTime()) continue;
    const weeksSince = Math.floor(daysSince / 7);
    const cycle = Math.floor(weeksSince / info.everyWeeks);
    if (cycle < 1) continue;
    tasks.push({
      id: `succession-${crop}-${cycle}`,
      icon: cropIcon(crop),
      iconBg: cropIconBg(crop),
      title: `Sow more ${cropLabel(crop)}`,
      detail: info.note,
      category: 'tend',
    });
  }
  return tasks;
}

interface FeedInfo {
  everyWeeks: number;
  note: string;
  /** True for a perennial (a tree, cane fruit, or other multi-year plant)
   * that gets fed on this cadence every growing season for as long as it's
   * established, rather than just through the one season it was planted
   * in. Its feeding window is recomputed fresh for whichever year is
   * actually relevant (see perennialFeedWindow) instead of being anchored
   * once to plantedDate the way an annual's is — an annual only needs one
   * season's worth of dates because a real replanting next year gets its
   * own fresh plantedDates entry, but a fruit tree doesn't get "replanted"
   * each spring, so nothing would otherwise trigger a second season. */
  perennial: boolean;
  /** Weeks after planting (annuals) or after that year's last spring frost
   * (perennials) that feeding starts — annuals wait for roots/flowering to
   * begin before their first feed; perennials wait for new growth to
   * resume after their most recent dormancy. */
  startWeeks: number;
  /** Weeks before the estimated first fall frost that feeding should stop,
   * so a late feeding doesn't push tender new growth into an early frost
   * (worse for frost-tender trees than for a cold-hardy vegetable, hence
   * the wide range below). */
  cutoffWeeksBeforeFrost: number;
}

/** Which crops get a recurring "fertilize" reminder, and on what cadence —
 * genuinely established, repeated-through-the-season feeding, not routine
 * care copy. Deliberately excludes plenty of crops that might look like
 * candidates:
 *  - Root vegetables (carrots, beets, radishes, turnips, rutabaga,
 *    kohlrabi, sweet potatoes) do best with minimal nitrogen — heavy
 *    feeding grows lush tops at the expense of the root.
 *  - Peas and beans fix their own nitrogen from the air; feeding them,
 *    especially with nitrogen, typically means fewer pods, not more.
 *  - Herbs (basil, cilantro, parsley, mint, rosemary, thyme, oregano,
 *    dill, chives, sage) are more flavorful grown a little lean — the
 *    standard advice is to go light on fertilizer, not feed on a schedule.
 *  - Fast salad greens (lettuce, spinach, arugula, bok choy) are usually
 *    harvested out before a second feeding would even matter.
 *  - Garlic, asparagus, and rhubarb get one or two feedings a year as
 *    growth resumes, not a repeated multi-week cadence.
 *  - Raspberries, blackberries, and grapes do best on one light spring
 *    feeding; overfeeding (especially grapes) pushes leafy growth at the
 *    expense of fruit.
 *  - Peach and cherry trees are typically fed once in early spring before
 *    bud break, occasionally a second light feeding if growth is weak —
 *    not a recurring multi-week cadence like citrus.
 *  - Figs are famously light feeders — overfeeding is a common cause of
 *    lots of leaves and little fruit, sometimes even split bark.
 *  - Most annual flowers (marigold, zinnia, sunflower, cosmos,
 *    nasturtium, pansy) bloom better in leaner soil; heavy fertilizing
 *    grows foliage instead of flowers. Dahlias are the one exception here
 *    — their heavy bloom production genuinely benefits from feeding. */
const FEED_INFO: Partial<Record<CropKey, FeedInfo>> = {
  // Citrus and other container fruit trees — the case that prompted this:
  // regular feeding through the growing season is standard practice,
  // unlike most of what's in this table.
  lemon: { everyWeeks: 4, startWeeks: 1, cutoffWeeksBeforeFrost: 6, perennial: true, note: 'Feed monthly with a balanced citrus fertilizer during active growth (or quarterly if using a slow-release granular — space those applications further apart). Stop a few weeks before your first fall frost so you are not pushing tender new growth into the cold.' },
  lime: { everyWeeks: 4, startWeeks: 1, cutoffWeeksBeforeFrost: 6, perennial: true, note: 'Feed monthly with a balanced citrus fertilizer during active growth (or quarterly if using a slow-release granular). Stop a few weeks before your first fall frost — lime is especially cold-sensitive, so avoid encouraging new growth late in the season.' },
  orange: { everyWeeks: 4, startWeeks: 1, cutoffWeeksBeforeFrost: 6, perennial: true, note: 'Feed monthly with a balanced citrus fertilizer during active growth (or quarterly if using a slow-release granular). Stop a few weeks before your first fall frost so you are not pushing tender new growth into the cold.' },
  kumquat: { everyWeeks: 4, startWeeks: 1, cutoffWeeksBeforeFrost: 6, perennial: true, note: 'Feed monthly with a balanced citrus fertilizer during active growth (or quarterly if using a slow-release granular). Stop a few weeks before your first fall frost, same as any citrus, even though kumquat tolerates a little more cold once dormant.' },
  avocado: { everyWeeks: 5, startWeeks: 2, cutoffWeeksBeforeFrost: 6, perennial: true, note: 'Feed roughly every 5 weeks through the growing season with a citrus/avocado-formulated fertilizer, and water deeply afterward — avocado is sensitive to the salt buildup fertilizer can leave behind.' },
  olive: { everyWeeks: 10, startWeeks: 1, cutoffWeeksBeforeFrost: 8, perennial: true, note: 'A light feeder — 2-3 applications spread through the growing season is plenty. Overfeeding pushes leafy growth at the expense of fruit and oil quality.' },
  pomegranate: { everyWeeks: 9, startWeeks: 1, cutoffWeeksBeforeFrost: 7, perennial: true, note: 'A moderate feeder — a few applications through the growing season is enough. Too much nitrogen encourages leafy growth over fruiting.' },
  blueberries: { everyWeeks: 8, startWeeks: 1, cutoffWeeksBeforeFrost: 8, perennial: true, note: 'Use an acid-forming fertilizer (the kind made for azaleas/camellias) a couple of times through the growing season — regular garden fertilizer can push soil pH the wrong way for blueberries.' },
  strawberries: { everyWeeks: 7, startWeeks: 1, cutoffWeeksBeforeFrost: 8, perennial: true, note: 'A light, regular feeding through the growing season supports fruiting in an established planting more than one heavy application.' },
  // Heavy-feeding annual vegetables — fed on a recurring cadence once
  // they're actively growing, not just once at planting.
  tomatoes: { everyWeeks: 4, startWeeks: 5, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'Once flowering begins, feed every 3-4 weeks with a lower-nitrogen fertilizer (higher phosphorus/potassium) — too much nitrogen grows leaves at the expense of fruit.' },
  peppers: { everyWeeks: 5, startWeeks: 5, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'Once flowering begins, feed every 4-5 weeks with a lower-nitrogen fertilizer — too much nitrogen grows leaves at the expense of fruit.' },
  eggplant: { everyWeeks: 5, startWeeks: 5, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'Once flowering begins, feed every 4-5 weeks with a lower-nitrogen fertilizer, same reasoning as tomatoes and peppers.' },
  cucumbers: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy feeder once vining starts — feed every 3-4 weeks to keep production going.' },
  squash: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy feeder once vining starts — feed every 3-4 weeks to keep production going.' },
  zucchini: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy feeder once vining starts — feed every 3-4 weeks to keep production going.' },
  pumpkin: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 10, perennial: false, note: 'A heavy feeder with a long season ahead of it — feed every 4-5 weeks to support the large fruit it is building toward.' },
  watermelon: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'A heavy feeder — feed every 4-5 weeks once vines are actively growing.' },
  cantaloupe: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'A heavy feeder — feed every 4-5 weeks once vines are actively growing.' },
  corn: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'A heavy nitrogen feeder — a feeding when plants are about knee-high and again as tassels form covers its two biggest need windows.' },
  okra: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'Feed every 4-5 weeks through its long, hot growing season to keep pods coming.' },
  celery: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy feeder — consistent feeding every 3-4 weeks supports the stalk growth it needs.' },
  onions: { everyWeeks: 3, startWeeks: 2, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'Feed every couple weeks with a nitrogen-rich fertilizer while bulbs are forming, then stop once bulbing is well underway — continuing to feed late can hurt storage quality.' },
  leeks: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A steady feeder — feed every 3-4 weeks to support the long shaft it is building.' },
  broccoli: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy nitrogen feeder — feed every 3-4 weeks for a fuller head.' },
  cauliflower: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy nitrogen feeder — feed every 3-4 weeks for steady, unchecked growth.' },
  cabbage: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 6, perennial: false, note: 'A heavy nitrogen feeder — feed every 3-4 weeks for a fuller head.' },
  brusselssprouts: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'A heavy nitrogen feeder over its long season — feed every 3-4 weeks.' },
  kale: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 5, perennial: false, note: 'A long, cut-and-come-again harvest benefits from feeding every 4-5 weeks to keep new leaves coming.' },
  chard: { everyWeeks: 5, startWeeks: 4, cutoffWeeksBeforeFrost: 5, perennial: false, note: 'A long, cut-and-come-again harvest benefits from feeding every 4-5 weeks to keep new leaves coming.' },
  dahlias: { everyWeeks: 4, startWeeks: 3, cutoffWeeksBeforeFrost: 8, perennial: false, note: 'A heavy bloomer — feed every 3-4 weeks with a low-nitrogen, higher-phosphorus/potassium fertilizer to support flowering without excess foliage.' },
};

/** A perennial crop's real fertilizing window for one specific year, timed
 * off the user's own coordinate-based frost estimates — start a set number
 * of weeks after that year's last spring frost (or, in the establishment
 * year, not before the tree was actually planted), end a set number of
 * weeks before that year's first fall frost. Unlike an annual's single
 * season (seasonEndForSuccession), this gets recomputed for whichever
 * year is actually relevant, since the same window recurs every year the
 * plant is established. Null when there's no frost estimate to bound it
 * with, or when the resulting window is empty (planted after that year's
 * window already closed). */
function perennialFeedWindow(
  year: number,
  plantedDate: Date,
  frostDates: FrostEstimate | null | undefined,
  info: FeedInfo
): { start: Date; end: Date } | null {
  if (!frostDates?.lastFrostMonthDay) return null;
  const fallMonthDay = effectiveFirstFrostMonthDay(frostDates);
  if (!fallMonthDay) return null;
  const springStart = addWeeks(parseMonthDay(frostDates.lastFrostMonthDay, year), info.startWeeks);
  let fallFrost = parseMonthDay(fallMonthDay, year);
  if (fallFrost.getTime() < springStart.getTime()) {
    fallFrost = parseMonthDay(fallMonthDay, year + 1);
  }
  const end = addWeeks(fallFrost, -info.cutoffWeeksBeforeFrost);
  const start = plantedDate.getTime() > springStart.getTime() ? plantedDate : springStart;
  if (start.getTime() > end.getTime()) return null;
  return { start, end };
}

/** Every feeding round within a single window, starting AT `start` itself
 * (cycle 1), unlike successionDueDates — a first feeding is itself an
 * actionable task, not something to skip the way succession sowing skips
 * the original planting. Shared by both the annual (one plantedDate-
 * anchored season) and perennial (one year's recomputed window) cases
 * below, which differ only in how they compute `start`/`end`. */
function feedDueDatesFrom(start: Date, everyWeeks: number, end: Date): { cycle: number; date: Date }[] {
  const dates: { cycle: number; date: Date }[] = [];
  const cycleDays = everyWeeks * 7;
  for (let cycle = 1; cycle <= 26; cycle++) {
    const date = new Date(start.getTime() + (cycle - 1) * cycleDays * 86400000);
    if (date.getTime() > end.getTime()) break;
    dates.push({ cycle, date });
  }
  return dates;
}

/** Any crop with feeding data, a real plantedDates entry, and a today (or
 * browsed date) that lands inside its real feeding window — Pro, same
 * gating as succession reminders. An annual's window is a single season
 * anchored to plantedDate; a perennial's is recomputed fresh for whichever
 * year the date in question actually falls in, so the reminder keeps
 * recurring every year the plant is established rather than stopping
 * after its first season. Task ids are scoped to the cycle (and, for
 * perennials, the year) so they're stable and checkable per round and
 * roll to a fresh task once the next one comes due. */
export function getFeedReminders(profile: GardenProfile, date: Date): DailyTask[] {
  if (!profile.isPro) return [];
  const tasks: DailyTask[] = [];
  for (const crop of profile.crops) {
    if (crop === 'other') continue;
    const info = FEED_INFO[crop];
    const plantedDateStr = profile.plantedDates?.[crop];
    if (!info || !plantedDateStr) continue;
    const planted = new Date(plantedDateStr);
    if (date.getTime() < planted.getTime()) continue;

    if (info.perennial) {
      for (const year of [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]) {
        const window = perennialFeedWindow(year, planted, profile.frostDates, info);
        if (!window) continue;
        const due = feedDueDatesFrom(window.start, info.everyWeeks, window.end).find((d) => sameDay(d.date, date));
        if (!due) continue;
        tasks.push({
          id: `feed-${crop}-${year}-${due.cycle}`,
          icon: cropIcon(crop),
          iconBg: cropIconBg(crop),
          title: `Fertilize ${cropLabel(crop)}`,
          detail: info.note,
          category: 'feed',
          buyUrl: placeholderFertilizerBuyUrl(crop),
        });
        break;
      }
    } else {
      const end = seasonEndForSuccession(planted, profile.frostDates, info.cutoffWeeksBeforeFrost);
      if (!end) continue;
      const start = addWeeks(planted, info.startWeeks);
      const due = feedDueDatesFrom(start, info.everyWeeks, end).find((d) => sameDay(d.date, date));
      if (!due) continue;
      tasks.push({
        id: `feed-${crop}-${due.cycle}`,
        icon: cropIcon(crop),
        iconBg: cropIconBg(crop),
        title: `Fertilize ${cropLabel(crop)}`,
        detail: info.note,
        category: 'feed',
        buyUrl: placeholderFertilizerBuyUrl(crop),
      });
    }
  }
  return tasks;
}

interface TreeWaterInfo {
  everyDays: number;
  /** Which day in the cycle this crop's check lands on (0-based), so
   * several trees on the same cadence don't all land on the same day —
   * arbitrary but fixed per crop, same purpose as succession/feed's
   * per-crop cadence numbers. */
  offset: number;
  note: string;
}

/** How often to check a container tree's — or perennial bush's — soil,
 * separate from the bed's own watering task (see bedCrops in cropMeta.ts
 * for why this whole category is excluded from that calculation
 * entirely). Deliberately not tied to an
 * exact plantedDates entry the way succession/feed reminders are — this
 * only needs to know the tree is actually planted (effectiveBucket !==
 * 'w0'), not precisely when, so it works the same whether that was set
 * with "Mark as planted today" or a backdated pill. Deliberately also not
 * bounded by frost dates the way fertilizing is: watering doesn't stop in
 * winter, it just tends to matter less, and this app doesn't model that
 * reduction (it doesn't for the bed's own watering task either — that one
 * runs year-round on a fixed weekly pattern too).
 *
 * Cadence is a reasonable default, not a promise about any specific pot,
 * soil mix, or climate — the honest signal is "check if the top couple
 * inches of soil are dry," which every note below says explicitly, same
 * as the per-bucket care copy already does for these crops. */
const TREE_WATER_INFO: Partial<Record<CropKey, TreeWaterInfo>> = {
  lemon: { everyDays: 3, offset: 0, note: 'Citrus in containers dries out faster than an in-ground bed. Check the top couple inches of soil, and water deeply if dry.' },
  lime: { everyDays: 3, offset: 1, note: 'Citrus in containers dries out faster than an in-ground bed. Check the top couple inches of soil, and water deeply if dry.' },
  orange: { everyDays: 3, offset: 2, note: 'Citrus in containers dries out faster than an in-ground bed. Check the top couple inches of soil, and water deeply if dry.' },
  kumquat: { everyDays: 3, offset: 0, note: 'Citrus in containers dries out faster than an in-ground bed. Check the top couple inches of soil, and water deeply if dry.' },
  avocado: { everyDays: 3, offset: 1, note: 'Avocado has shallow roots that dislike drying out completely, but also rot in soggy soil. Check the top couple inches of soil, and water deeply if dry.' },
  olive: { everyDays: 5, offset: 0, note: 'Drought-tolerant once established, and prone to root rot if kept too wet. Let it dry out somewhat between waterings.' },
  pomegranate: { everyDays: 5, offset: 2, note: 'Fairly drought-tolerant once established. Check the top couple inches of soil, and water deeply if dry.' },
  figs: { everyDays: 4, offset: 0, note: 'Tolerates some drying out once established, but a container still needs more frequent water than a bed. Check the top couple inches of soil.' },
  peach: { everyDays: 4, offset: 1, note: 'Wants consistent moisture, especially while fruit is developing, but not soggy soil. Check the top couple inches of soil, and water deeply if dry.' },
  cherry: { everyDays: 4, offset: 2, note: 'Wants consistent moisture, especially while fruit is developing, but not soggy soil. Check the top couple inches of soil, and water deeply if dry.' },
  blueberries: { everyDays: 3, offset: 2, note: 'Shallow roots in the acidic, well-drained soil blueberries need mean they dry out faster than most bed plants. Check the top couple inches of soil, and water deeply if dry.' },
  raspberries: { everyDays: 4, offset: 3, note: 'Cane fruit want consistent moisture through fruiting, especially now that they are off the bed\'s shared schedule. Check the top couple inches of soil, and water deeply if dry.' },
};

function isTreeWaterDay(info: TreeWaterInfo, date: Date): boolean {
  const daysSinceEpoch = Math.floor(date.getTime() / 86400000);
  return ((daysSinceEpoch - info.offset) % info.everyDays + info.everyDays) % info.everyDays === 0;
}

/** Any planted tree crop due for a water check on `date` — Pro, same
 * gating as succession/feed (moot in practice since every tree crop is
 * itself Pro-only, but kept for the same reason those check it: a
 * profile that downgraded after adding one shouldn't keep getting Pro
 * task reminders for free). Works identically whether `date` is today or
 * a day being browsed ahead on the Calendar, since the cadence is a fixed
 * calendar pattern rather than something anchored to a specific planting
 * date. */
export function getTreeWateringReminders(profile: GardenProfile, date: Date): DailyTask[] {
  if (!profile.isPro) return [];
  const tasks: DailyTask[] = [];
  for (const crop of profile.crops) {
    if (crop === 'other') continue;
    const info = TREE_WATER_INFO[crop];
    if (!info) continue;
    if (effectiveBucket(profile, crop, date) === 'w0') continue;
    if (!isTreeWaterDay(info, date)) continue;
    tasks.push({
      id: `treewater-${crop}-${dateKey(date)}`,
      icon: cropIcon(crop),
      iconBg: cropIconBg(crop),
      title: `Water ${cropLabel(crop)}`,
      detail: info.note,
      category: 'tend',
    });
  }
  return tasks;
}

// Crops where saving your own seed isn't really how home gardeners
// propagate them, so a "collect seeds" reminder would be bad advice rather
// than a nice-to-have:
//  - Root and tuber crops (carrots, beets, radishes, turnips, rutabaga,
//    kohlrabi, sweet potatoes, potatoes) are harvested for the root/tuber
//    itself — saving seed means leaving one in the ground an extra year to
//    bolt, not a normal extension of picking it.
//  - Alliums (onions, garlic, leeks) are almost always replanted from sets
//    or cloves at home, not grown from seed.
//  - Perennials propagated by division or runners (asparagus, rhubarb,
//    strawberries, blueberries, raspberries, blackberries, grapes) aren't
//    typically seed-grown either.
//  - Trees are usually grafted — a seed-grown citrus or stone fruit often
//    doesn't come true to the parent and can take years to fruit at all.
const SEED_SAVE_EXCLUDED = new Set<CropKey>([
  'carrots', 'beets', 'radishes', 'turnips', 'rutabaga', 'kohlrabi', 'sweetpotatoes', 'potatoes',
  'onions', 'garlic', 'leeks',
  'asparagus', 'rhubarb', 'strawberries', 'blueberries', 'raspberries', 'blackberries', 'grapes',
  'figs', 'lemon', 'lime', 'orange', 'kumquat', 'olive', 'avocado', 'pomegranate', 'peach', 'cherry',
]);

// A window, not a single precise day — seed drying time genuinely varies,
// so this is deliberately fuzzy the same way harvestWindowsFor's estimate
// is. The single checkable task below still fires on one specific day (the
// window's midpoint), the same asymmetry getAlerts/harvestWindowsFor has:
// Home needs one concrete day to make something actionable, but Calendar's
// forward-browsing view is better served by a range when browsing ahead of
// time, not a single date presented as more certain than it really is.
const SEED_COLLECTION_WINDOW_START_WEEKS = 2;
const SEED_COLLECTION_WINDOW_END_WEEKS = 4;
const SEED_COLLECTION_WEEKS_AFTER =
  (SEED_COLLECTION_WINDOW_START_WEEKS + SEED_COLLECTION_WINDOW_END_WEEKS) / 2;

/** A one-time reminder to collect seeds, a few weeks after a harvest
 * logged with isFinalHarvest — Pro, same gating as the other recurring
 * reminders. Anchored to the harvest entry's own id rather than
 * crop+cycle (there's exactly one of these per final harvest, not a
 * repeating cadence), so logging a second final harvest for the same crop
 * next season gets its own separate reminder instead of colliding with
 * last year's. */
export function getSeedCollectionReminders(profile: GardenProfile, date: Date): DailyTask[] {
  if (!profile.isPro) return [];
  const tasks: DailyTask[] = [];
  for (const h of profile.harvests ?? []) {
    if (!h.isFinalHarvest || h.crop === 'other' || SEED_SAVE_EXCLUDED.has(h.crop)) continue;
    const dueDate = addWeeks(new Date(h.dateISO), SEED_COLLECTION_WEEKS_AFTER);
    if (!sameDay(dueDate, date)) continue;
    tasks.push({
      id: `seeds-${h.id}`,
      icon: cropIcon(h.crop),
      iconBg: cropIconBg(h.crop),
      title: `Collect seeds from ${cropLabel(h.crop)}`,
      detail: 'Let seed pods or fruit dry fully before collecting, then store them somewhere cool and dry for next season.',
      category: 'seed',
    });
  }
  return tasks;
}

export interface HarvestWindow {
  crop: CropKey;
  start: Date;
  end: Date;
}

/** Crops whose estimated harvest window covers `date` — a rough date-based
 * projection from SEASON_SHAPE's sow/grow/harvest proportions applied to
 * the crop's planted date, unlike getAlerts' severity='soon' "ready to
 * pick" signal, which is precise but only ever evaluates today's actual
 * tracked state (see STAGE_TABLE in alertsEngine.ts) and has nothing to
 * say about a date weeks or months out. This is what lets Calendar
 * highlight a likely-harvest window when browsing ahead, where getAlerts
 * is silent. Deliberately kept separate from getTasksForDate's own task
 * list rather than folded in as another task, so it doesn't create a
 * second, less precise "is it ready" signal next to today's real one —
 * callers that want a highlight (not a checkable task) call this
 * directly. */
export function harvestWindowsFor(profile: GardenProfile, date: Date): HarvestWindow[] {
  if (!profile.isPro) return [];
  const windows: HarvestWindow[] = [];
  for (const crop of profile.crops) {
    if (crop === 'other') continue;
    const shape = SEASON_SHAPE[crop];
    const plantedDateStr = profile.plantedDates?.[crop];
    if (!shape || !plantedDateStr) continue;
    const planted = new Date(plantedDateStr);
    const totalDays = shape.weeks * 7;
    const harvestStartDay = (totalDays * (shape.sow + shape.grow)) / 100;
    const start = new Date(planted.getTime() + harvestStartDay * 86400000);
    const end = new Date(planted.getTime() + totalDays * 86400000);
    if (date.getTime() >= start.getTime() && date.getTime() <= end.getTime()) {
      windows.push({ crop, start, end });
    }
  }
  return windows;
}

export interface SeedWindow {
  crop: CropKey;
  harvestId: string;
  start: Date;
  end: Date;
}

/** The same kind of forward-looking, fuzzy-window estimate as
 * harvestWindowsFor, but for when a final harvest's seeds are likely ready
 * to collect (see SEED_COLLECTION_WINDOW_START_WEEKS/END_WEEKS above) —
 * lets Calendar highlight the days leading up to getSeedCollectionReminders'
 * one precise, checkable due day the same way it already does for a
 * regular harvest. */
export function seedCollectionWindowsFor(profile: GardenProfile, date: Date): SeedWindow[] {
  if (!profile.isPro) return [];
  const windows: SeedWindow[] = [];
  for (const h of profile.harvests ?? []) {
    if (!h.isFinalHarvest || h.crop === 'other' || SEED_SAVE_EXCLUDED.has(h.crop)) continue;
    const harvestDate = new Date(h.dateISO);
    const start = addWeeks(harvestDate, SEED_COLLECTION_WINDOW_START_WEEKS);
    const end = addWeeks(harvestDate, SEED_COLLECTION_WINDOW_END_WEEKS);
    if (date.getTime() >= start.getTime() && date.getTime() <= end.getTime()) {
      windows.push({ crop: h.crop, harvestId: h.id, start, end });
    }
  }
  return windows;
}

/** Any date's task list — watering pattern, reminders explicitly scheduled
 * for that date, and (for Pro) crop guidance. Read-only; used by the
 * Calendar. Today's cell mirrors Home's task list exactly (the same
 * severity='soon' alerts — "Plant Broccoli now" for a not-yet-planted crop
 * whose window is open, or "Water frequently, celery stays thirsty" for an
 * already-planted one), since that's the live, currently-true state Home
 * itself shows — it isn't tied to a single fixed calendar day, and it
 * keeps showing there, unchanged, for as many days as it takes until the
 * user checks it off or the crop's stage moves on. Checking a task off on
 * Home shares the same task id, so it drops off today's calendar cell too
 * (unlike Home, which keeps a checked task visible with a checkmark — the
 * calendar has no checkbox of its own, so a lingering checked-off entry
 * would just read as still-outstanding). Other days show two kinds of
 * fixed-date markers: a not-yet-planted crop's own calculated target date,
 * and — for an already-planted crop with a real plantedDates entry —
 * every date another succession-sowing or fertilizing round comes due
 * (see successionDueDates/getFeedReminders), not just the next one, so
 * browsing ahead across the whole season shows "Sow more Arugula" or
 * "Fertilize Lemon tree" landing on every date it's actually due, up
 * through the crop's real, frost-bounded window — a perennial's recurring
 * every year it stays established, an annual's only through its own single
 * season — instead of a single occurrence or an indefinite run into
 * winter. A tree crop's own water-check reminder (getTreeWateringReminders)
 * also shows on any date it's due, but on a fixed calendar cadence rather
 * than one anchored to a planting date, since it only needs to know the
 * tree is planted, not precisely when. An already-planted crop's other,
 * non-dated ongoing care alerts (STAGE_TABLE's "keep soil evenly moist")
 * still only ever show on today, since there's no fixed date to hang
 * those on. */
export function getTasksForDate(profile: GardenProfile, date: Date, today: Date = new Date()): DailyTask[] {
  const tasks: DailyTask[] = [];
  const result = scheduleFor(profile);
  const waterId = `water-${dateKey(date)}`;
  if (wateringDaysOfWeek(result.sessionsPerWeek).includes(date.getDay()) && !isTaskComplete(profile, waterId)) {
    tasks.push({
      id: waterId,
      icon: '💧',
      iconBg: colors.selectedBg,
      title: 'Water the garden',
      detail: `${result.minutesPerSession} min · ${timeOfDayLabel(result.timeOfDay)}`,
      category: 'tend',
    });
  }
  for (const r of profile.scheduledReminders) {
    if (sameDay(new Date(r.dateISO), date)) {
      const crop = profile.crops.find((c) => c.toLowerCase() === r.cropLabel.toLowerCase());
      tasks.push({
        id: `reminder-${r.id}`,
        icon: crop ? cropIcon(crop) : '🌱',
        iconBg: cropIconBg((crop ?? 'other') as CropKey),
        title: r.title,
        detail: r.body,
        category: categorize(r.title || r.body),
      });
    }
  }
  // A harvest already logged (Log a pick) on this exact date, shown as a
  // read-only record of what actually happened rather than something to
  // do — there's nothing to check off, so this deliberately isn't in
  // getTodayTasks (Home's actionable list) or gated by isTaskComplete, only
  // here, where Calendar can show it on the day it happened. Not Pro-gated,
  // since logging a harvest at all isn't a Pro feature.
  for (const h of profile.harvests ?? []) {
    if (h.crop === 'other' || !sameDay(new Date(h.dateISO), date)) continue;
    tasks.push({
      id: `harvested-${h.id}`,
      icon: cropIcon(h.crop),
      iconBg: cropIconBg(h.crop),
      title: `Picked ${cropLabel(h.crop)}`,
      detail: h.note.trim() || `${h.weightLbs} lb${h.weightLbs === 1 ? '' : 's'} picked`,
      category: 'harvest',
    });
  }
  if (profile.isPro && sameDay(date, today)) {
    const alerts = getAlerts(profile.crops, resolvedPlantedWeeks(profile, today), profile.weather, profile.frostDates);
    for (const a of alerts) {
      if (a.severity !== 'soon') continue;
      const id = `alert-${a.crop}-${a.headline}-${dateKey(today)}`;
      if (isTaskComplete(profile, id)) continue;
      tasks.push({
        id,
        icon: cropIcon(a.crop),
        iconBg: cropIconBg(a.crop),
        title: a.headline,
        detail: a.detail,
        category: categorize(a.headline + ' ' + a.detail),
      });
    }
    for (const t of getSuccessionReminders(profile, today)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
    for (const t of getFeedReminders(profile, today)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
    for (const t of getTreeWateringReminders(profile, today)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
    for (const t of getSeedCollectionReminders(profile, today)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
  } else if (profile.isPro) {
    for (const crop of profile.crops) {
      if (crop === 'other') continue;
      const bucket = effectiveBucket(profile, crop, today);
      if (bucket === 'w0') {
        const guidance = plantingGuidanceFor(crop, profile.frostDates, today);
        if (guidance.date && sameDay(guidance.date, date)) {
          tasks.push({
            id: `plant-${crop}-${dateKey(date)}`,
            icon: cropIcon(crop),
            iconBg: cropIconBg(crop),
            title: guidance.headline,
            detail: guidance.detail,
            category: 'tend',
          });
        }
        continue;
      }
      const info = SUCCESSION_INFO[crop];
      const plantedDate = profile.plantedDates?.[crop];
      if (!info || !plantedDate) continue;
      const planted = new Date(plantedDate);
      const seasonEnd = seasonEndForSuccession(planted, profile.frostDates, info.cutoffWeeksBeforeFrost);
      const due = successionDueDates(planted, info.everyWeeks, seasonEnd).find((d) => sameDay(d.date, date));
      if (!due) continue;
      const id = `succession-${crop}-${due.cycle}`;
      if (isTaskComplete(profile, id)) continue;
      tasks.push({
        id,
        icon: cropIcon(crop),
        iconBg: cropIconBg(crop),
        title: `Sow more ${cropLabel(crop)}`,
        detail: info.note,
        category: 'tend',
      });
    }
    for (const t of getFeedReminders(profile, date)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
    for (const t of getTreeWateringReminders(profile, date)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
    for (const t of getSeedCollectionReminders(profile, date)) {
      if (isTaskComplete(profile, t.id)) continue;
      tasks.push(t);
    }
  }
  return tasks;
}

/** Today's checkable tasks — watering plus, for Pro, any crop-stage alert
 * urgent enough to act on today (the "Stage & harvest alerts" Pro benefit —
 * see PaywallScreen.tsx). Nothing here is ever from the future: watering
 * only ever reflects the most recent scheduled day at or before today, and
 * alerts only fire once their own condition (e.g. a planting date) is
 * actually due. If that most recent scheduled watering never got checked
 * off, it stays exactly as-is under its original date/id rather than
 * disappearing — it keeps showing, one day at a time, until it's done or a
 * later scheduled day replaces it as "most recent."
 *
 * Alerts work differently: their id is scoped to today's date, so they
 * naturally rotate as a crop's stage (and its headline) moves forward, and
 * reset fresh each day rather than staying "done" forever — that's
 * deliberate, since most of them are ongoing care reminders (e.g. "keep
 * soil evenly moist") rather than a one-time box to check. */
export function getTodayTasks(profile: GardenProfile, today: Date = new Date()): DailyTask[] {
  const tasks: DailyTask[] = [];
  const result = scheduleFor(profile);
  const waterDate = mostRecentWateringDay(result.sessionsPerWeek, today);
  const waterId = `water-${dateKey(waterDate)}`;
  // sessionsPerWeek is 0 for an all-tree garden (nothing in the bed to
  // water) — see computeSchedule in scheduleEngine.ts. mostRecentWateringDay
  // has no "no watering day" of its own to return, so this is checked here
  // instead of trusting it to come back empty.
  if (result.sessionsPerWeek > 0 && !isTaskComplete(profile, waterId)) {
    tasks.push({
      id: waterId,
      icon: '💧',
      iconBg: colors.selectedBg,
      title: 'Water the garden',
      detail: `${result.minutesPerSession} min · ${timeOfDayLabel(result.timeOfDay)}`,
      category: 'tend',
    });
  }
  if (profile.isPro) {
    const alerts = getAlerts(profile.crops, resolvedPlantedWeeks(profile, today), profile.weather, profile.frostDates);
    for (const a of alerts) {
      if (a.severity !== 'soon') continue;
      tasks.push({
        id: `alert-${a.crop}-${a.headline}-${dateKey(today)}`,
        icon: cropIcon(a.crop),
        iconBg: cropIconBg(a.crop),
        title: a.headline,
        detail: a.detail,
        category: categorize(a.headline + ' ' + a.detail),
      });
    }
    tasks.push(...getSuccessionReminders(profile, today));
    tasks.push(...getFeedReminders(profile, today));
    tasks.push(...getTreeWateringReminders(profile, today));
    tasks.push(...getSeedCollectionReminders(profile, today));
  }
  return tasks;
}

export function isTaskComplete(profile: GardenProfile, taskId: string): string | null {
  return profile.taskCompletions?.[taskId] ?? null;
}

export function toggleTask(profile: GardenProfile, taskId: string): GardenProfile {
  const completions = { ...(profile.taskCompletions ?? {}) };
  if (completions[taskId]) {
    delete completions[taskId];
  } else {
    completions[taskId] = new Date().toISOString();
  }
  return { ...profile, taskCompletions: completions };
}

function completedDateSet(profile: GardenProfile): Set<string> {
  const completions = profile.taskCompletions ?? {};
  return new Set(Object.values(completions).map((iso) => iso.slice(0, 10)));
}

/** Consecutive days (walking back from today) with at least one completed
 * task. Today doesn't have to be done yet for the streak to still count —
 * it just resumes counting from yesterday until today closes out. */
export function computeStreak(profile: GardenProfile, today: Date = new Date()): number {
  const dates = completedDateSet(profile);
  const cursor = new Date(today);
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive completed days ever, for the "your longest
 * run is N days" line — a real number derived from completion history. */
export function computeLongestStreak(profile: GardenProfile): number {
  const dates = Array.from(completedDateSet(profile)).sort();
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const cur = new Date(dates[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
