// storage.ts
// The profile lives on the device. No account, no server, no userId — which
// also means no data leaves the phone, so App Privacy can be declared as
// "Data Not Collected".
//
// If you later add multi-device sync, this is the seam to change: keep these
// four function signatures and swap the body for a Supabase call.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENT_SCHEMA_VERSION, GardenProfile } from '../types';

const PROFILE_KEY = 'sprout:profile:v1';

export async function loadProfile(): Promise<GardenProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GardenProfile;
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // Only one version so far. When you add a v2, migrate here rather than
      // discarding — losing a saved garden is worse than a messy migration.
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('Sprout: could not read saved garden', e);
    return null;
  }
}

export async function saveProfile(profile: GardenProfile): Promise<void> {
  const toWrite: GardenProfile = { ...profile, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(toWrite));
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
