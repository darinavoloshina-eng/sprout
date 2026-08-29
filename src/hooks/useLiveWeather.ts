// useLiveWeather.ts
// This is the fix for the bug where the schedule was computed once during
// onboarding and then never changed. Weather is refetched when the app opens
// and whenever it returns to the foreground with a stale snapshot, and the
// updated snapshot is written back to the profile so the schedule recomputes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { fetchWeather } from '../api/weather';
import { saveProfile } from '../api/storage';
import { GardenProfile } from '../types';

const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // 3 hours

export function isWeatherStale(profile: GardenProfile): boolean {
  if (!profile.weather || !profile.weatherFetchedAt) return true;
  const age = Date.now() - new Date(profile.weatherFetchedAt).getTime();
  return Number.isNaN(age) || age > STALE_AFTER_MS;
}

export function useLiveWeather(
  profile: GardenProfile,
  onProfileChange: (p: GardenProfile) => void
) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref so the AppState listener always sees the current profile
  // without being torn down and re-added on every profile change.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const inFlight = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      const current = profileRef.current;
      if (!current.location) return;
      if (!force && !isWeatherStale(current)) return;
      if (inFlight.current) return;

      inFlight.current = true;
      setRefreshing(true);
      try {
        const weather = await fetchWeather(current.location.lat, current.location.lon);
        const updated: GardenProfile = {
          ...profileRef.current,
          weather,
          weatherFetchedAt: new Date().toISOString(),
        };
        onProfileChange(updated);
        await saveProfile(updated);
        setError(null);
      } catch {
        // Keep showing the last known schedule rather than blanking the screen.
        setError('Showing your last saved forecast. No connection right now.');
      } finally {
        inFlight.current = false;
        setRefreshing(false);
      }
    },
    [onProfileChange]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { refreshing, error, refresh };
}
