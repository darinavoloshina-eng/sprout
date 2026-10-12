// location.ts
// expo-location's getCurrentPositionAsync has no built-in timeout, and with
// Accuracy.High it can hang indefinitely indoors, on a weak signal, or in a
// Simulator with no location set, leaving a "Locating..." card stuck with
// no way out. Shared by onboarding and Edit location so both always fall
// back to typing a city instead of hanging — this used to live only in
// EditLocationScreen, and onboarding hung where it didn't.

import * as Location from 'expo-location';

const GPS_TIMEOUT_MS = 10000;

/** High (not Balanced) forces an actual GPS fix instead of a coarse
 * WiFi/cell-tower estimate — the latter tends to snap to the nearest
 * heavily-mapped metro (e.g. San Francisco) for a rural address. Rejects
 * after GPS_TIMEOUT_MS. */
export function getCurrentPositionWithTimeout(): Promise<Location.LocationObject> {
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Location request timed out')), GPS_TIMEOUT_MS)
    ),
  ]);
}
