// cropMeta.ts
// Icon + display label per crop, shared so screens don't quietly drift apart
// the way the chip/pill styles did before ui.tsx existed.

import { CropKey } from './engines/scheduleEngine';
import { PlantedBackdate } from './engines/alertsEngine';
import { colors } from './theme';

export const CROP_META: Record<CropKey, { label: string; icon: string }> = {
  tomatoes: { label: 'Tomatoes', icon: '🍅' },
  cucumbers: { label: 'Cucumbers', icon: '🥒' },
  lettuce: { label: 'Lettuce', icon: '🥬' },
  carrots: { label: 'Carrots', icon: '🥕' },
  peppers: { label: 'Peppers', icon: '🫑' },
  basil: { label: 'Basil', icon: '🌿' },
  potatoes: { label: 'Potatoes', icon: '🥔' },
  garlic: { label: 'Garlic', icon: '🧄' },
  strawberries: { label: 'Strawberries', icon: '🍓' },
  squash: { label: 'Squash', icon: '🎃' },
  corn: { label: 'Corn', icon: '🌽' },
  onions: { label: 'Onions', icon: '🧅' },
  broccoli: { label: 'Broccoli', icon: '🥦' },
  cauliflower: { label: 'Cauliflower', icon: '🥦' },
  cabbage: { label: 'Cabbage', icon: '🥬' },
  kale: { label: 'Kale', icon: '🥬' },
  spinach: { label: 'Spinach', icon: '🥬' },
  chard: { label: 'Swiss chard', icon: '🥬' },
  beets: { label: 'Beets', icon: '🟣' },
  radishes: { label: 'Radishes', icon: '🔴' },
  turnips: { label: 'Turnips', icon: '⚪' },
  rutabaga: { label: 'Rutabaga', icon: '🟤' },
  kohlrabi: { label: 'Kohlrabi', icon: '🟢' },
  peas: { label: 'Peas', icon: '🫛' },
  beans: { label: 'Green beans', icon: '🫘' },
  zucchini: { label: 'Zucchini', icon: '🥒' },
  pumpkin: { label: 'Pumpkin', icon: '🟠' },
  eggplant: { label: 'Eggplant', icon: '🍆' },
  okra: { label: 'Okra', icon: '🌿' },
  watermelon: { label: 'Watermelon', icon: '🍉' },
  cantaloupe: { label: 'Cantaloupe', icon: '🍈' },
  leeks: { label: 'Leeks', icon: '🧅' },
  sweetpotatoes: { label: 'Sweet potatoes', icon: '🍠' },
  celery: { label: 'Celery', icon: '🌿' },
  asparagus: { label: 'Asparagus', icon: '🌱' },
  brusselssprouts: { label: 'Brussels sprouts', icon: '🥬' },
  arugula: { label: 'Arugula', icon: '🥬' },
  collards: { label: 'Collard greens', icon: '🥬' },
  bokchoy: { label: 'Bok choy', icon: '🥬' },
  cilantro: { label: 'Cilantro', icon: '🌿' },
  parsley: { label: 'Parsley', icon: '🌿' },
  mint: { label: 'Mint', icon: '🌿' },
  rosemary: { label: 'Rosemary', icon: '🌿' },
  thyme: { label: 'Thyme', icon: '🌿' },
  oregano: { label: 'Oregano', icon: '🌿' },
  dill: { label: 'Dill', icon: '🌿' },
  chives: { label: 'Chives', icon: '🌿' },
  sage: { label: 'Sage', icon: '🌿' },
  blueberries: { label: 'Blueberries', icon: '🫐' },
  raspberries: { label: 'Raspberries', icon: '🌱' },
  blackberries: { label: 'Blackberries', icon: '🌱' },
  grapes: { label: 'Grapes', icon: '🍇' },
  rhubarb: { label: 'Rhubarb', icon: '🌱' },
  figs: { label: 'Fig tree', icon: '🌱' },
  lemon: { label: 'Lemon tree', icon: '🍋' },
  lime: { label: 'Lime tree', icon: '🌱' },
  orange: { label: 'Orange tree', icon: '🍊' },
  kumquat: { label: 'Kumquat tree', icon: '🌱' },
  olive: { label: 'Olive tree', icon: '🫒' },
  avocado: { label: 'Avocado tree', icon: '🥑' },
  pomegranate: { label: 'Pomegranate tree', icon: '🌱' },
  peach: { label: 'Peach tree', icon: '🍑' },
  cherry: { label: 'Cherry tree', icon: '🍒' },
  marigold: { label: 'Marigold', icon: '🌱' },
  zinnia: { label: 'Zinnia', icon: '🌱' },
  sunflower: { label: 'Sunflower', icon: '🌻' },
  cosmos: { label: 'Cosmos', icon: '🌱' },
  nasturtium: { label: 'Nasturtium', icon: '🌱' },
  pansy: { label: 'Pansy', icon: '🌱' },
  dahlias: { label: 'Dahlias', icon: '🌱' },
  other: { label: 'Something else', icon: '🌱' },
};

export type CropCategory = 'vegetable' | 'fruit' | 'herb' | 'flower' | 'tree';

export const CROP_CATEGORY: Record<CropKey, CropCategory> = {
  tomatoes: 'vegetable',
  cucumbers: 'vegetable',
  lettuce: 'vegetable',
  carrots: 'vegetable',
  peppers: 'vegetable',
  basil: 'herb',
  potatoes: 'vegetable',
  garlic: 'vegetable',
  strawberries: 'fruit',
  squash: 'vegetable',
  corn: 'vegetable',
  onions: 'vegetable',
  broccoli: 'vegetable',
  cauliflower: 'vegetable',
  cabbage: 'vegetable',
  kale: 'vegetable',
  spinach: 'vegetable',
  chard: 'vegetable',
  beets: 'vegetable',
  radishes: 'vegetable',
  turnips: 'vegetable',
  rutabaga: 'vegetable',
  kohlrabi: 'vegetable',
  peas: 'vegetable',
  beans: 'vegetable',
  zucchini: 'vegetable',
  pumpkin: 'vegetable',
  eggplant: 'vegetable',
  okra: 'vegetable',
  watermelon: 'fruit',
  cantaloupe: 'fruit',
  leeks: 'vegetable',
  sweetpotatoes: 'vegetable',
  celery: 'vegetable',
  asparagus: 'vegetable',
  brusselssprouts: 'vegetable',
  arugula: 'vegetable',
  collards: 'vegetable',
  bokchoy: 'vegetable',
  cilantro: 'herb',
  parsley: 'herb',
  mint: 'herb',
  rosemary: 'herb',
  thyme: 'herb',
  oregano: 'herb',
  dill: 'herb',
  chives: 'herb',
  sage: 'herb',
  blueberries: 'tree',
  raspberries: 'tree',
  blackberries: 'fruit',
  grapes: 'fruit',
  rhubarb: 'fruit',
  figs: 'tree',
  lemon: 'tree',
  lime: 'tree',
  orange: 'tree',
  kumquat: 'tree',
  olive: 'tree',
  avocado: 'tree',
  pomegranate: 'tree',
  peach: 'tree',
  cherry: 'tree',
  marigold: 'flower',
  zinnia: 'flower',
  sunflower: 'flower',
  cosmos: 'flower',
  nasturtium: 'flower',
  pansy: 'flower',
  dahlias: 'flower',
  other: 'vegetable',
};

/** What a user can pick when backdating a crop's planting manually (no
 * tracked exact date) — see PlantedBackdate in alertsEngine.ts for why the
 * three long-duration rungs exist and why they're tree-only. Shared here
 * (rather than duplicated per screen) so the crop editor (EditCropsScreen,
 * OnboardingScreen) and My Garden's own inline editor can't drift apart on
 * which crops get the longer options. */
export const BASE_PLANTED_BUCKETS: { key: PlantedBackdate; label: string }[] = [
  { key: 'w0', label: 'Not planted' },
  { key: 'w2', label: '1–4 wks' },
  { key: 'w4', label: '4–8 wks' },
  { key: 'w8', label: '8+ wks' },
];

export const TREE_PLANTED_BUCKETS: { key: PlantedBackdate; label: string }[] = [
  ...BASE_PLANTED_BUCKETS,
  { key: 'm6', label: '3–6 mo' },
  { key: 'y1', label: '6mo–2 yrs' },
  { key: 'y2', label: '2+ yrs' },
];

export function plantedBucketsFor(crop: CropKey): { key: PlantedBackdate; label: string }[] {
  return CROP_CATEGORY[crop] === 'tree' ? TREE_PLANTED_BUCKETS : BASE_PLANTED_BUCKETS;
}

/** The crops that belong in the bed's watering-schedule math — everything
 * except the "tree" category. Most of these are grown in a container, not
 * in the bed itself, so folding a citrus or avocado's water need into a
 * calculation driven by bed square footage and drip-emitter layout never
 * actually meant anything physically; it just happened to mostly go
 * unnoticed because the "worst case wins" math rarely picked one as the
 * driver. Blueberries and raspberries live here too even though they're
 * usually grown straight in a bed, not a pot — they're perennial bushes on
 * their own multi-year establishment clock (see TREE_PLANTED_BUCKETS),
 * which the annual-vegetable bed schedule was never built to represent
 * either. Filtering here once (rather than at each computeSchedule call
 * site) is what keeps every caller — Home's weather-alert check, the
 * watering task itself — from having to remember to do this themselves.
 * This category gets its own separate watering reminder instead; see
 * getTreeWateringReminders in taskEngine.ts. */
export function bedCrops(crops: CropKey[]): CropKey[] {
  return crops.filter((c) => CROP_CATEGORY[c] !== 'tree');
}

/** How many crops a free (non-Pro) garden can have, total, picked from
 * anywhere in the catalog — not four specific named crops anymore. A free
 * user can browse and pick any four, across any category; the fifth pick
 * is what actually needs Pro. */
export const FREE_CROP_LIMIT = 4;

// Icon-chip background per crop — used anywhere a crop gets a small round
// swatch (My Garden cards, Log entries). Cycles through the same four
// pastel swatches the free crops use; there's no dedicated color per crop.
const CROP_ICON_BG: Record<CropKey, string> = {
  tomatoes: colors.selectedBg,
  cucumbers: colors.sevFyiBg,
  lettuce: colors.sevLowBg,
  carrots: colors.sevSoonBg,
  peppers: colors.selectedBg,
  basil: colors.sevLowBg,
  potatoes: colors.sevFyiBg,
  garlic: colors.sevSoonBg,
  strawberries: colors.selectedBg,
  squash: colors.sevFyiBg,
  corn: colors.sevSoonBg,
  onions: colors.sevLowBg,
  broccoli: colors.sevLowBg,
  cauliflower: colors.sevFyiBg,
  cabbage: colors.sevSoonBg,
  kale: colors.selectedBg,
  spinach: colors.sevLowBg,
  chard: colors.sevFyiBg,
  beets: colors.sevSoonBg,
  radishes: colors.selectedBg,
  turnips: colors.sevLowBg,
  rutabaga: colors.sevFyiBg,
  kohlrabi: colors.sevSoonBg,
  peas: colors.selectedBg,
  beans: colors.sevLowBg,
  zucchini: colors.sevFyiBg,
  pumpkin: colors.sevSoonBg,
  eggplant: colors.selectedBg,
  okra: colors.sevLowBg,
  watermelon: colors.sevFyiBg,
  cantaloupe: colors.sevSoonBg,
  leeks: colors.selectedBg,
  sweetpotatoes: colors.sevLowBg,
  celery: colors.sevFyiBg,
  asparagus: colors.sevSoonBg,
  brusselssprouts: colors.selectedBg,
  arugula: colors.sevLowBg,
  collards: colors.sevFyiBg,
  bokchoy: colors.sevSoonBg,
  cilantro: colors.selectedBg,
  parsley: colors.sevLowBg,
  mint: colors.sevFyiBg,
  rosemary: colors.sevSoonBg,
  thyme: colors.selectedBg,
  oregano: colors.sevLowBg,
  dill: colors.sevFyiBg,
  chives: colors.sevSoonBg,
  sage: colors.selectedBg,
  blueberries: colors.sevLowBg,
  raspberries: colors.sevFyiBg,
  blackberries: colors.sevSoonBg,
  grapes: colors.selectedBg,
  rhubarb: colors.sevLowBg,
  figs: colors.sevFyiBg,
  lemon: colors.sevLowBg,
  lime: colors.sevFyiBg,
  orange: colors.sevSoonBg,
  kumquat: colors.selectedBg,
  olive: colors.sevLowBg,
  avocado: colors.sevFyiBg,
  pomegranate: colors.sevSoonBg,
  peach: colors.selectedBg,
  cherry: colors.sevFyiBg,
  marigold: colors.sevSoonBg,
  zinnia: colors.selectedBg,
  sunflower: colors.sevLowBg,
  cosmos: colors.sevFyiBg,
  nasturtium: colors.sevSoonBg,
  pansy: colors.selectedBg,
  dahlias: colors.sevSoonBg,
  other: colors.selectedBg,
};

// Crops with no real, dedicated emoji fall back to a plain colored dot
// (🔴🟣⚪️...), which reads as "no icon" rather than as that vegetable, and
// several land on the same dot. These get a two-letter colored monogram
// badge instead (see components/ui.tsx's CropIcon), colored to evoke the
// actual vegetable (radish red, beet magenta, rutabaga's golden flesh...).
// Crops that already share a real but generic emoji (basil/mint/etc. all
// using 🌿) are left alone — that's a legible, still-relevant icon, just
// not unique, which is a smaller problem than having no real icon at all.
export const CROP_BADGE: Partial<Record<CropKey, { letters: string; color: string }>> = {
  beets: { letters: 'BT', color: '#8E3A56' },
  radishes: { letters: 'RD', color: '#C1503F' },
  turnips: { letters: 'TN', color: '#9C8AA8' },
  rutabaga: { letters: 'RT', color: '#C08A3E' },
  kohlrabi: { letters: 'KB', color: '#8FA83E' },
  pumpkin: { letters: 'PM', color: '#D9822F' },
  blackberries: { letters: 'BK', color: '#4A3352' },
  raspberries: { letters: 'RA', color: '#A62C52' },
  rhubarb: { letters: 'RB', color: '#C15C6B' },
  figs: { letters: 'FG', color: '#6B4A4E' },
  lime: { letters: 'LM', color: '#7A9A3D' },
  kumquat: { letters: 'KQ', color: '#D97B29' },
  pomegranate: { letters: 'PG', color: '#9C2D42' },
  marigold: { letters: 'MG', color: '#C98A1F' },
  zinnia: { letters: 'ZN', color: '#B84568' },
  cosmos: { letters: 'CS', color: '#C97F92' },
  nasturtium: { letters: 'NT', color: '#D1652E' },
  pansy: { letters: 'PN', color: '#6B4C8A' },
  dahlias: { letters: 'DH', color: '#9C2D5C' },
};

export function cropLabel(crop: CropKey | string): string {
  return CROP_META[crop as CropKey]?.label ?? crop.charAt(0).toUpperCase() + crop.slice(1);
}

export function cropIcon(crop: CropKey | string): string {
  return CROP_META[crop as CropKey]?.icon ?? '🌱';
}

export function cropIconBg(crop: CropKey | string): string {
  return CROP_ICON_BG[crop as CropKey] ?? colors.selectedBg;
}
