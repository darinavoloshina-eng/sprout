// cropMeta.ts
// Icon + display label per crop, shared so screens don't quietly drift apart
// the way the chip/pill styles did before ui.tsx existed.

import { CropKey } from './engines/scheduleEngine';
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
  raspberries: { label: 'Raspberries', icon: '🍒' },
  other: { label: 'Something else', icon: '🌱' },
};

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
  other: colors.selectedBg,
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
