// useFrostDates.ts
// Fetches a real frost-date estimate once per location (see api/frost.ts),
// mirroring useLiveWeather's shape: lazy, best-effort, cached on the
// profile. Re-fetches automatically if frostDates is cleared — which
// happens whenever onboarding (or Settings' location editor) re-saves the
// profile with a new location, so editing the garden's location naturally
// refreshes the estimate.
//
// Mounted once at the app root rather than inside HomeScreen: My Garden and
// Plant Detail both read profile.frostDates (via plantingGuideFor) too, and
// tying the fetch to Home meant it never ran — and the estimate never
// arrived — for anyone who reached those screens without Home mounting
// first.

import { useEffect, useRef } from 'react';
import { estimateFrostDates } from '../api/frost';
import { saveProfile } from '../api/storage';
import { GardenProfile } from '../types';

export function useFrostDates(
  profile: GardenProfile | null,
  onProfileChange: (p: GardenProfile) => void
) {
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    const loc = profile?.location;
    if (!loc || profile?.frostDates) return;
    let cancelled = false;
    (async () => {
      const result = await estimateFrostDates(loc.lat, loc.lon);
      if (cancelled || !result || !profileRef.current) return;
      const updated: GardenProfile = { ...profileRef.current, frostDates: result };
      onProfileChange(updated);
      saveProfile(updated).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.location?.lat, profile?.location?.lon, profile?.frostDates]);
}
