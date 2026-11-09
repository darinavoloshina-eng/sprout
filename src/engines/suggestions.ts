// suggestions.ts
// "What grows well near you right now": for someone who doesn't know what
// to plant, a short list of crops that suit their location at this time of
// year, split into what to start indoors now, what to plant outside now,
// and what's coming up in the next few weeks. Pure, timed entirely from the
// same frost-based planting windows the rest of the app uses
// (plantingGuide.ts), so a suggestion never disagrees with the dates the
// crop gets once it's added.
//
// A crop is suggested only if:
//  - one of its planting windows is open now or opens soon,
//  - for frost-tender crops planted in spring, its typical season
//    (SEASON_SHAPE weeks) fits before the first fall frost, so a short-
//    season garden isn't told to plant melons it can't ripen,
//  - for warm-climate trees (citrus, avocado; figs, olives, pomegranates),
//    the winters are mild enough to grow them outdoors.
// Beginner-friendly crops come first in each list.

import { CropKey } from './scheduleEngine';
import { FrostEstimate } from '../types';
import { plantingWindowsFor, parseMonthDay } from './plantingGuide';
import { CROP_CATEGORY, CROP_META, cropLabel } from '../cropMeta';
import { SEASON_SHAPE } from '../plantStageContent';

export type SuggestionGroup = 'indoors' | 'outside' | 'soon';

export interface CropSuggestion {
  crop: CropKey;
  group: SuggestionGroup;
  /** The date this suggestion is about: sow indoors, or plant outside. */
  date: Date;
  /** One short line, e.g. "Ready in about 8 weeks · loves cool weather". */
  reason: string;
}

export type Suggestions = Record<SuggestionGroup, CropSuggestion[]>;

export const MAX_PER_GROUP = 6;

// Forgiving, fast, hard to get wrong. Listed first so a beginner's first
// picks are likely to succeed.
const BEGINNER_FRIENDLY = new Set<CropKey>([
  'lettuce', 'radishes', 'spinach', 'arugula', 'peas', 'beans', 'zucchini', 'kale', 'chard',
  'tomatoes', 'basil', 'bokchoy', 'garlic', 'potatoes', 'strawberries', 'cucumbers', 'chives', 'mint',
]);

// Need near-frost-free winters to grow outside.
const TENDER_TREES = new Set<CropKey>(['lemon', 'lime', 'orange', 'kumquat', 'avocado']);
// Want long, warm seasons and mild winters.
const WARM_TREES = new Set<CropKey>(['figs', 'olive', 'pomegranate']);
const TENDER_TREE_MIN_FROST_FREE_DAYS = 300;
const WARM_TREE_MIN_FROST_FREE_DAYS = 210;

const DAY = 86400000;
const START_NOW_FROM = -14; // a sow-indoors date up to 2 weeks ago still counts as "now"
const PLANT_NOW_FROM = -21; // an outdoor window that opened up to 3 weeks ago is still open
const NOW_UNTIL = 7; // and up to a week ahead counts as "now" too
const SOON_UNTIL = 42; // "coming up" looks 6 weeks ahead...
const QUIET_SOON_UNTIL = 150; // ...or further, in a quiet season with little to plant
const QUIET_THRESHOLD = 3;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The first fall frost after `date`, from the real measured estimate, or
 * null when there isn't one (a frost-free fall). */
function firstFrostAfter(frost: FrostEstimate, date: Date): Date | null {
  if (!frost.firstFrostMonthDay) return null;
  for (const year of [date.getFullYear(), date.getFullYear() + 1]) {
    const d = parseMonthDay(frost.firstFrostMonthDay, year);
    if (d > date) return d;
  }
  return null;
}

/** Days from the last spring frost to the next first frost: the length of
 * the frost-free season. 365 when there's no fall frost on record. */
export function frostFreeDays(frost: FrostEstimate, now: Date): number {
  const last = parseMonthDay(frost.lastFrostMonthDay, now.getFullYear());
  const first = firstFrostAfter(frost, last);
  return first ? daysBetween(last, first) : 365;
}

function climateOk(crop: CropKey, frost: FrostEstimate, now: Date): boolean {
  if (TENDER_TREES.has(crop)) return frostFreeDays(frost, now) >= TENDER_TREE_MIN_FROST_FREE_DAYS;
  if (WARM_TREES.has(crop)) return frostFreeDays(frost, now) >= WARM_TREE_MIN_FROST_FREE_DAYS;
  return true;
}

function reasonFor(crop: CropKey, group: SuggestionGroup, warmWeather: boolean, date: Date, outdoorDate: Date, startIndoors: boolean): string {
  if (CROP_CATEGORY[crop] === 'tree') {
    return group === 'soon' ? `Plant around ${shortDate(date)} · pick for years` : 'Plant once, pick for years';
  }
  const weather = warmWeather ? 'loves warm weather' : 'loves cool weather';
  if (group === 'indoors') return `Plant out around ${shortDate(outdoorDate)} · ${weather}`;
  if (group === 'soon') return `${startIndoors ? 'Start indoors' : 'Plant'} around ${shortDate(date)} · ${weather}`;
  const weeks = SEASON_SHAPE[crop]?.weeks;
  return weeks ? `Harvest in about ${weeks} weeks · ${weather}` : weather.charAt(0).toUpperCase() + weather.slice(1);
}

/** What to suggest, or null when there's no frost estimate to time it by.
 * `owned` crops (already in the garden) are left out. */
export function suggestCrops(
  frost: FrostEstimate | null | undefined,
  owned: readonly string[],
  now: Date = new Date()
): Suggestions | null {
  if (!frost) return null;
  const usual = collect(frost, owned, now, SOON_UNTIL);
  const total = usual.indoors.length + usual.outside.length + usual.soon.length;
  return total >= QUIET_THRESHOLD ? usual : collect(frost, owned, now, QUIET_SOON_UNTIL);
}

function collect(frost: FrostEstimate, owned: readonly string[], now: Date, soonUntil: number): Suggestions {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const found: CropSuggestion[] = [];

  for (const crop of Object.keys(CROP_META) as CropKey[]) {
    if (crop === 'other' || owned.includes(crop) || CROP_CATEGORY[crop] === 'flower') continue;
    if (!climateOk(crop, frost, today)) continue;

    const weeks = SEASON_SHAPE[crop]?.weeks;
    let best: CropSuggestion | null = null;
    const rank: Record<SuggestionGroup, number> = { indoors: 0, outside: 1, soon: 2 };

    for (const w of plantingWindowsFor(crop, frost, today)) {
      // A frost-tender spring crop has to finish before fall frost.
      if (!w.coolSeason && w.season === 'spring' && weeks && CROP_CATEGORY[crop] !== 'tree') {
        const frostAfter = firstFrostAfter(frost, w.outdoorDate);
        if (frostAfter && w.outdoorDate.getTime() + weeks * 7 * DAY > frostAfter.getTime()) continue;
      }
      const outDays = daysBetween(today, w.outdoorDate);
      const inDays = w.indoorDate ? daysBetween(today, w.indoorDate) : null;

      let group: SuggestionGroup | null = null;
      let date = w.outdoorDate;
      if (inDays != null && inDays >= START_NOW_FROM && inDays <= NOW_UNTIL && outDays > NOW_UNTIL) {
        group = 'indoors';
        date = w.indoorDate!;
      } else if (outDays >= PLANT_NOW_FROM && outDays <= NOW_UNTIL) {
        group = 'outside';
      } else if (inDays != null && inDays > NOW_UNTIL && inDays <= soonUntil) {
        group = 'soon';
        date = w.indoorDate!;
      } else if (inDays == null && outDays > NOW_UNTIL && outDays <= soonUntil) {
        group = 'soon';
      }
      if (!group) continue;

      const reason = reasonFor(crop, group, w.warmWeather, date, w.outdoorDate, !!w.indoorDate && date === w.indoorDate);
      const candidate: CropSuggestion = { crop, group, date, reason };
      if (!best || rank[group] < rank[best.group]) best = candidate;
    }
    if (best) found.push(best);
  }

  const order = (a: CropSuggestion, b: CropSuggestion) =>
    Number(BEGINNER_FRIENDLY.has(b.crop)) - Number(BEGINNER_FRIENDLY.has(a.crop)) ||
    a.date.getTime() - b.date.getTime() ||
    cropLabel(a.crop).localeCompare(cropLabel(b.crop));

  const groups: Suggestions = { indoors: [], outside: [], soon: [] };
  for (const g of Object.keys(groups) as SuggestionGroup[]) {
    groups[g] = found.filter((s) => s.group === g).sort(order).slice(0, MAX_PER_GROUP);
  }
  return groups;
}
