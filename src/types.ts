// types.ts
// The shape of everything we persist. Note what is NOT here: the computed
// ScheduleResult. That used to be stored on the profile, which meant the
// schedule was frozen at onboarding time and never responded to weather again.
// It is now always derived from the profile + current weather at render time.

import { CropKey, SunExposure, WateringMethod, WeatherSnapshot } from './engines/scheduleEngine';
import { PlantedBackdate } from './engines/alertsEngine';

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
  // Optional — added after harvests already existed, so older saved entries
  // won't have it. Marks this pick as the last one of the season for this
  // crop, which is what getSeedCollectionReminders in taskEngine.ts anchors
  // its reminder to.
  isFinalHarvest?: boolean;
}

export interface CropNote {
  id: string;
  crop: CropKey;
  text: string;
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
  plantedWeeks: Partial<Record<CropKey, PlantedBackdate>>;
  // Optional — set when the user taps "Mark as planted" instead of
  // manually backdating a bucket. Once present for a crop, it's the real
  // source of truth for that crop's planted bucket (see
  // taskEngine.ts's effectiveBucket) and is what succession-planting
  // reminders are timed from — a 4-week-wide bucket like "1-4 wks ago"
  // isn't precise enough to know when 2 weeks have actually passed.
  plantedDates?: Partial<Record<CropKey, string>>; // ISO date string
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
  // Free-text, dated observations per crop — "the green beans shaded the
  // watermelon, plant it on the other side next year" — meant to be read
  // back next season, not acted on now, so there's no reminder/task tied
  // to these. Same optional-field reasoning as harvests above.
  notes?: CropNote[];
  frostDates?: FrostEstimate;
  // Optional — same fallback reasoning as harvests above. All stored values
  // stay imperial regardless of this; it only controls display/input
  // formatting (see utils/units.ts), so scheduleEngine's calibrated
  // formulas never need unit-aware branches.
  units?: 'imperial' | 'metric';
  // Optional — collected at the end of onboarding, same fallback reasoning
  // as harvests above. Stored locally either way; only reaches our mailing
  // list (via api/subscribe.ts) if emailOptIn below is also true. See
  // OnboardingScreen's 'email' step and README's note on why the old
  // account system (an unauthenticated, guessable userId) was removed
  // rather than fixed.
  email?: string;
  // Explicit, separate consent for marketing emails. Someone can save an
  // email locally (e.g. to find their way back here) without opting into
  // anything — this only becomes true from an actual opt-in tap in
  // onboarding or Settings, never implied by just having an email on file.
  emailOptIn?: boolean;
  // Mirrors the real RevenueCat/App Store entitlement once purchases are
  // configured (see purchases.ts) — kept in sync by App.tsx's
  // fetchCurrentEntitlement/onEntitlementChange listeners. Before a real
  // API key is set, PaywallScreen instead sets this directly as a local,
  // unpaid preview toggle.
  isPro?: boolean;
  // True when the active entitlement came from the one-time Lifetime
  // purchase rather than a recurring subscription — RevenueCat's
  // EntitlementInfo.willRenew is false for it. PaywallScreen uses this to
  // avoid sending a lifetime owner to "Manage subscription", since there
  // is no subscription for Apple's subscription-settings page to show.
  isLifetime?: boolean;
}

export const CURRENT_SCHEMA_VERSION = 1;
