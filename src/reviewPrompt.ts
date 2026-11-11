// reviewPrompt.ts
// When to ask for an App Store rating. Only at a happy moment (a harvest
// just logged, or a task streak just reaching a milestone), and at most once
// every few months. Apple also caps the prompt at three times a year and
// decides itself whether to show it, so asking never nags.

import { GardenProfile } from './types';
import { computeStreak } from './engines/taskEngine';

export const REVIEW_COOLDOWN_DAYS = 120;
const STREAK_MILESTONES = [3, 7, 14];

export function isReviewMoment(
  prev: GardenProfile | null,
  next: GardenProfile | null,
  today: Date = new Date()
): boolean {
  if (!prev || !next) return false;
  if (next.reviewAskedAt) {
    const daysSince = (today.getTime() - new Date(next.reviewAskedAt).getTime()) / 86400000;
    if (daysSince < REVIEW_COOLDOWN_DAYS) return false;
  }
  if ((next.harvests?.length ?? 0) > (prev.harvests?.length ?? 0)) return true;
  const before = computeStreak(prev, today);
  const after = computeStreak(next, today);
  return after > before && STREAK_MILESTONES.includes(after);
}
