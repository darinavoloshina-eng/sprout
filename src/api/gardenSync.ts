// gardenSync.ts
// The app half of the weekly reminder email (server half:
// subscribe-worker/src/reminders.ts). While profile.emailRemindersEnabled
// is on, a copy of the garden is kept on the Worker so it can work out
// each week's jobs without the phone. Turning it off deletes that copy —
// nothing about the garden is kept server-side for anyone who isn't
// getting the email.
//
// The Worker hands back a random token on first sync; it's stored here,
// separately from the profile, and is the only way to update or delete
// this garden's copy. Best-effort throughout, like subscribe.ts — a failed
// sync is retried the next time the garden changes or the app opens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GardenProfile } from '../types';
import { WORKER_URL } from './subscribe';

const TOKEN_KEY = 'sprout:syncToken:v1';

export interface SyncResult {
  /** False until the address owner clicks the link in the confirmation
   * email — no digest goes out before then. */
  confirmed: boolean;
  /** False while email sending is switched off on the Worker — signups
   * are kept, but nothing goes out yet. */
  sending: boolean;
}

/** Only what the Worker's copy of the engine needs. Mirrors the server's
 * own stripProfile, so this never sends more than it keeps. */
function snapshot(profile: GardenProfile) {
  const { photos: _photos, notes: _notes, email: _email, emailOptIn: _optIn, ...rest } = profile;
  return rest;
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Syncs run one at a time. Settings syncs immediately when the toggle goes
// on while App's debounced sync may follow right behind — without this,
// both could start before either had stored a token, and the server would
// create two gardens for one phone.
let queue: Promise<unknown> = Promise.resolve();

export function syncGarden(profile: GardenProfile): Promise<SyncResult | null> {
  const run = queue.then(() => syncGardenNow(profile));
  queue = run.catch(() => {});
  return run;
}

async function syncGardenNow(profile: GardenProfile): Promise<SyncResult | null> {
  if (!profile.email) return null;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${WORKER_URL}/garden`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ email: profile.email, timezone: deviceTimezone(), profile: snapshot(profile) }),
    });
    // The server no longer knows this token (e.g. the garden was cleaned
    // up after going unconfirmed) — drop it so the next sync starts fresh.
    if (res.status === 404 && token) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      return syncGardenNow(profile);
    }
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string; confirmed?: boolean; sending?: boolean };
    if (body.token) await AsyncStorage.setItem(TOKEN_KEY, body.token);
    return { confirmed: !!body.confirmed, sending: !!body.sending };
  } catch {
    return null;
  }
}

/** Deletes the server copy, if there is one. */
export function unsyncGarden(): Promise<void> {
  const run = queue.then(unsyncGardenNow);
  queue = run.catch(() => {});
  return run;
}

async function unsyncGardenNow(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const res = await fetch(`${WORKER_URL}/garden`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best-effort — retried on the next sync while the toggle stays off.
  }
}
