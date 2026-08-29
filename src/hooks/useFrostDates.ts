// useFrostDates.ts
// Fetches a real frost-date estimate once per location (see api/frost.ts),
// mirroring useLiveWeather's shape: lazy, best-effort, cached on the
// profile. Re-fetches automatically if frostDates is cleared — which
// happens whenever onboarding re-saves the profile (it doesn't carry
// frostDates forward), so editing the garden's location naturally
// refreshes the estimate.

import { useEffect, useRef } from 'react';
import { estimateFrostDates } from '../api/frost';
import { saveProfile } from '../api/storage';
import { GardenProfile } from '../types';

export function useFrostDates(profile: GardenProfile, onProfileChange: (p: GardenProfile) => void) {
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    const loc = profile.location;
    if (!loc || profile.frostDates) return;
    let cancelled = false;
    (async () => {
      const result = await estimateFrostDates(loc.lat, loc.lon);
      if (cancelled || !result) return;
      const updated: GardenProfile = { ...profileRef.current, frostDates: result };
      onProfileChange(updated);
      saveProfile(updated).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.location?.lat, profile.location?.lon, profile.frostDates]);
}
