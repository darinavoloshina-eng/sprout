// types.ts
// The shape of everything we persist. Note what is NOT here: the computed
// ScheduleResult. That used to be stored on the profile, which meant the
// schedule was frozen at onboarding time and never responded to weather again.
// It is now always derived from the profile + current weather at render time.

import { CropKey, SunExposure, WateringMethod, WeatherSnapshot } from './engines/scheduleEngine';
import { PlantedBucket } from './engines/alertsEngine';

export interface LocationInfo {
  lat: number;
  lon: number;
  label: string;
}

export interface ScheduledReminder {
  id: string; // `${crop}|${headline}` — stable, so we don't double-schedule
  title: string;
  cropLabel: string;
  dateISO: string;
  body: string;
  notificationId?: string; // returned by expo-notifications, needed to cancel
}

export interface HarvestEntry {
  id: string;
  crop: CropKey;
  weightLbs: number;
  note: string; // e.g. "4 cucumbers" — free text, no unit-count modeling
  dateISO: string;
}

export interface PlantPhoto {
  id: string;
  crop: CropKey;
  uri: string; // local file:// URI — see api/photos.ts
  dateISO: string;
}

export interface FrostEstimate {
  lastFrostMonthDay: string; // "MM-DD" — see api/frost.ts
  firstFrostMonthDay: string | null;
  isNorthernHemisphere: boolean;
  fetchedAt: string;
}

export interface GardenProfile {
  schemaVersion: number;
  crops: CropKey[];
  plantedWeeks: Partial<Record<CropKey, PlantedBucket>>;
  sun: SunExposure;
  bedWidthFt: number;
  bedLengthFt: number;
  // Optional — added post-launch, same fallback reasoning as harvests below.
  gardenType?: 'raised' | 'ground';
  method: WateringMethod;
  // Optional — left unset until the user picks a value; scheduleEngine
  // falls back to 12"/12"/0.5 GPH defaults when they're missing.
  lineSpacingIn?: number;
  emitterSpacingIn?: number;
  emitterGph?: number;
  location: LocationInfo | null;
  weather: WeatherSnapshot | null;
  weatherFetchedAt: string | null; // ISO — used to decide when to refetch
  scheduledReminders: ScheduledReminder[];
  notificationsEnabled: boolean;
  savedAt: string;
  // Optional — added after schemaVersion 1 shipped. Profiles saved before
  // this existed won't have it, so every reader falls back to `?? []`
  // rather than bumping the schema version and losing older saves.
  harvests?: HarvestEntry[];
  // Task completions, keyed by a stable per-day task id (see taskEngine.ts)
  // and valued by the ISO timestamp of completion. Same optional-field
  // reasoning as harvests above.
  taskCompletions?: Record<string, string>;
  photos?: PlantPhoto[];
  frostDates?: FrostEstimate;
  // Optional — same fallback reasoning as harvests above. All stored values
  // stay imperial regardless of this; it only controls display/input
  // formatting (see utils/units.ts), so scheduleEngine's calibrated
  // formulas never need unit-aware branches.
  units?: 'imperial' | 'metric';
  // Optional — collected at the end of onboarding, same fallback reasoning
  // as harvests above. Local field only: no auth, no backend, nothing sent
  // anywhere. See OnboardingScreen's 'email' step and README's note on why
  // the old account system (an unauthenticated, guessable userId) was
  // removed rather than fixed.
  email?: string;
  // Optional — same fallback reasoning as harvests above. There is no real
  // payment/subscription system behind this (see PaywallScreen.tsx): it's
  // a local flag the paywall's trial button sets directly, for previewing
  // what Pro unlocks. Not tied to any App Store/Play receipt.
  isPro?: boolean;
}

export const CURRENT_SCHEMA_VERSION = 1;
