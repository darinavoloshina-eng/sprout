// reminders.ts
// The weekly "your garden this week" email. The app sends a snapshot of
// the garden here (POST /garden) only while the user has that email turned
// on; a cron runs hourly, and for each confirmed garden where it's Sunday
// evening locally, refreshes the weather, works out the week's jobs with
// the app's own engine (../../src/engines — imported directly, so the
// email can never disagree with what the app shows), and sends it through
// Loops.
//
// While EMAIL_SENDING_ENABLED is off (see wrangler.toml), everything is
// recorded but nothing is emailed: gardens are stored, but confirmation
// emails wait, digests don't go out, and unconfirmed gardens aren't
// cleaned up. Turning it on sends the waiting confirmations on the next
// cron run, and the weekly digest starts for whoever confirms.
//
// Not the same as the old backend the README describes removing: that one
// keyed profiles by a guessable userId anyone could overwrite. Here the
// app holds a random server-issued token, only its hash is stored, and
// email links carry a separate token that can only confirm/unsubscribe.

import { weeklyDigest } from '../../src/engines/nudgeEngine';
import { fetchWeather } from '../../src/api/weather';
import type { GardenProfile } from '../../src/types';

export interface Env {
  DB: D1Database;
  LOOPS_API_KEY: string;
  LOOPS_CONFIRM_TRANSACTIONAL_ID: string;
  LOOPS_DIGEST_TRANSACTIONAL_ID: string;
  WORKER_URL: string;
  EMAIL_SENDING_ENABLED: string;
}

export function sendingEnabled(env: Env): boolean {
  return env.EMAIL_SENDING_ENABLED === 'true';
}

interface GardenRow {
  id: string;
  link_token: string;
  email: string;
  timezone: string;
  profile_json: string;
  confirmed_at: string | null;
  confirm_sent_at: string | null;
  last_digest_week: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Local hour on Sunday from which the digest goes out. Anything later that
// evening still sends (the cron is hourly and may skip a beat); the
// last_digest_week guard keeps it to one.
const DIGEST_HOUR = 17;
// The confirmation email is the one thing that goes to an unverified
// address, so it's the abuse surface — at most one per address per day.
const CONFIRM_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Gardens whose owner never clicked confirm are dropped this long after
// the confirmation email went out.
const UNCONFIRMED_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bearer(request: Request): string | null {
  const m = (request.headers.get('Authorization') ?? '').match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Only what the engine needs to work out the week. Photos are local file
 * paths that mean nothing here, notes are personal and unused, and the
 * email lives in its own column. */
function stripProfile(raw: unknown): GardenProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as GardenProfile;
  if (!Array.isArray(p.crops) || typeof p.sun !== 'string') return null;
  const { photos: _photos, notes: _notes, email: _email, emailOptIn: _optIn, ...rest } = p;
  return rest as GardenProfile;
}

async function sendLoops(env: Env, transactionalId: string, email: string, dataVariables: Record<string, string>) {
  const res = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LOOPS_API_KEY}` },
    body: JSON.stringify({ transactionalId, email, dataVariables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Loops ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function maybeSendConfirmation(env: Env, gardenId: string, email: string, linkToken: string) {
  if (!sendingEnabled(env)) return;
  const cutoff = new Date(Date.now() - CONFIRM_COOLDOWN_MS).toISOString();
  const recent = await env.DB.prepare('SELECT 1 FROM gardens WHERE email = ? AND confirm_sent_at > ? LIMIT 1')
    .bind(email, cutoff)
    .first();
  if (recent) return;
  await sendLoops(env, env.LOOPS_CONFIRM_TRANSACTIONAL_ID, email, {
    confirmUrl: `${env.WORKER_URL}/confirm?t=${encodeURIComponent(linkToken)}`,
  });
  await env.DB.prepare('UPDATE gardens SET confirm_sent_at = ? WHERE id = ?').bind(new Date().toISOString(), gardenId).run();
}

/** POST /garden — create or update this phone's garden. Returns the write
 * token on create; the app stores it and sends it on every later call. */
export async function handleSyncGarden(request: Request, env: Env): Promise<Response> {
  let body: { email?: unknown; timezone?: unknown; profile?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone : '';
  const profile = stripProfile(body.profile);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Invalid email' }, 400);
  if (!isValidTimezone(timezone)) return json({ ok: false, error: 'Invalid timezone' }, 400);
  if (!profile) return json({ ok: false, error: 'Invalid garden' }, 400);
  const profileJson = JSON.stringify(profile);
  if (profileJson.length > 200_000) return json({ ok: false, error: 'Garden too large' }, 413);

  const now = new Date().toISOString();
  const token = bearer(request);

  if (token) {
    const row = await env.DB.prepare('SELECT id, email, link_token, confirmed_at FROM gardens WHERE token_hash = ?')
      .bind(await sha256(token))
      .first<Pick<GardenRow, 'id' | 'email' | 'link_token' | 'confirmed_at'>>();
    if (!row) return json({ ok: false, error: 'Unknown garden' }, 404);
    const emailChanged = row.email !== email;
    // A new address has to be confirmed again — otherwise one confirmed
    // garden could be pointed at anyone's inbox.
    await env.DB.prepare(
      `UPDATE gardens SET email = ?, timezone = ?, profile_json = ?, updated_at = ?,
         confirmed_at = CASE WHEN ? THEN NULL ELSE confirmed_at END,
         confirm_sent_at = CASE WHEN ? THEN NULL ELSE confirm_sent_at END,
         unsubscribed_at = NULL
       WHERE id = ?`
    )
      .bind(email, timezone, profileJson, now, emailChanged ? 1 : 0, emailChanged ? 1 : 0, row.id)
      .run();
    const confirmed = !!row.confirmed_at && !emailChanged;
    if (!confirmed) await maybeSendConfirmation(env, row.id, email, row.link_token).catch(() => {});
    return json({ ok: true, confirmed, sending: sendingEnabled(env) });
  }

  const id = crypto.randomUUID();
  const newToken = randomToken();
  const linkToken = randomToken();
  await env.DB.prepare(
    `INSERT INTO gardens (id, token_hash, link_token, email, timezone, profile_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, await sha256(newToken), linkToken, email, timezone, profileJson, now, now)
    .run();
  await maybeSendConfirmation(env, id, email, linkToken).catch(() => {});
  return json({ ok: true, token: newToken, confirmed: false, sending: sendingEnabled(env) });
}

/** DELETE /garden — the app turned the email off, or deleted everything. */
export async function handleDeleteGarden(request: Request, env: Env): Promise<Response> {
  const token = bearer(request);
  if (!token) return json({ ok: false, error: 'Missing token' }, 401);
  await env.DB.prepare('DELETE FROM gardens WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true });
}

/** /confirm?t= and /unsubscribe?t= — the links in emails. A GET only
 * shows a button; the change happens on the POST it submits. Corporate
 * mail scanners prefetch every link in an email, and if a GET did the
 * work, they'd confirm addresses nobody confirmed and unsubscribe people
 * who never clicked. */
export async function handleEmailLink(request: Request, url: URL, env: Env): Promise<Response> {
  const t = url.searchParams.get('t') ?? '';
  const confirming = url.pathname === '/confirm';
  if (request.method !== 'POST') {
    return confirming
      ? page('Confirm your weekly email', 'One email on Sunday evenings with the week’s garden jobs.', 'Confirm')
      : page('Unsubscribe?', 'You’ll stop getting the weekly garden email.', 'Unsubscribe');
  }
  const now = new Date().toISOString();
  if (confirming) {
    const res = await env.DB.prepare('UPDATE gardens SET confirmed_at = COALESCE(confirmed_at, ?), unsubscribed_at = NULL WHERE link_token = ?')
      .bind(now, t)
      .run();
    return res.meta.changes
      ? page('You’re all set', 'Your first “garden this week” email arrives Sunday evening.')
      : page('Link expired', 'Turn the weekly email off and on again in GardenWise’s Settings to get a fresh link.');
  }
  await env.DB.prepare('UPDATE gardens SET unsubscribed_at = ? WHERE link_token = ?').bind(now, t).run();
  return page('Unsubscribed', 'You won’t get the weekly garden email any more. You can turn it back on any time in GardenWise’s Settings.');
}

/** Local date parts for `instant` in `timezone`. */
function localParts(instant: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday as string,
    hour: Number(parts.hour),
  };
}

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function sendDigest(env: Env, row: GardenRow, weekKey: string, local: ReturnType<typeof localParts>) {
  const profile = JSON.parse(row.profile_json) as GardenProfile;
  if (profile.location) {
    profile.weather = await fetchWeather(profile.location.lat, profile.location.lon).catch(() => profile.weather);
  }
  // Workers run in UTC, and the engine reads dates with local getters
  // (getDate, getDay). Building "now" and the week from the user's local
  // calendar date at UTC noon makes those getters return the user's own
  // day, which is what the week's jobs are keyed to.
  const now = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
  const weekStart = new Date(Date.UTC(local.year, local.month - 1, local.day + 1, 12));
  const digest = weeklyDigest(profile, weekStart, now);

  if (digest) {
    const jobs = digest.days.length
      ? digest.days.map((d) => `${DAY_LABEL[d.date.getDay()]}: ${d.jobs.join(', ')}`).join('\n')
      : 'No planting, feeding, or harvest jobs this week. Enjoy the garden.';
    await sendLoops(env, env.LOOPS_DIGEST_TRANSACTIONAL_ID, row.email, {
      weekOf: `${MONTH_LABEL[weekStart.getMonth()]} ${weekStart.getDate()}`,
      jobs,
      watering: digest.watering ?? '',
      unsubscribeUrl: `${env.WORKER_URL}/unsubscribe?t=${encodeURIComponent(row.link_token)}`,
    });
  }
  // Recorded even for a quiet week with nothing sent, so the next hourly
  // run doesn't re-check this garden all evening.
  await env.DB.prepare('UPDATE gardens SET last_digest_week = ? WHERE id = ?').bind(weekKey, row.id).run();
}

/** Hourly cron. */
export async function runScheduled(env: Env): Promise<void> {
  if (!sendingEnabled(env)) return;

  // Gardens that signed up while sending was paused have never had a
  // confirmation email. Capped per run to stay well inside Loops' rate
  // limit; the rest go out over the next few hours.
  const { results: pending } = await env.DB.prepare(
    `SELECT id, email, link_token FROM gardens
     WHERE confirmed_at IS NULL AND confirm_sent_at IS NULL AND unsubscribed_at IS NULL LIMIT 200`
  ).all<Pick<GardenRow, 'id' | 'email' | 'link_token'>>();
  for (const row of pending) {
    await maybeSendConfirmation(env, row.id, row.email, row.link_token).catch((e) =>
      console.error(`confirmation failed for ${row.id}`, e)
    );
  }

  const unconfirmedCutoff = new Date(Date.now() - UNCONFIRMED_TTL_MS).toISOString();
  await env.DB.prepare('DELETE FROM gardens WHERE confirmed_at IS NULL AND confirm_sent_at < ?').bind(unconfirmedCutoff).run();

  const { results } = await env.DB.prepare(
    `SELECT id, link_token, email, timezone, profile_json, confirmed_at, confirm_sent_at, last_digest_week
     FROM gardens WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`
  ).all<GardenRow>();

  const instant = new Date();
  for (const row of results) {
    const local = localParts(instant, row.timezone);
    if (local.weekday !== 'Sun' || local.hour < DIGEST_HOUR) continue;
    const weekKey = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    if (row.last_digest_week === weekKey) continue;
    try {
      await sendDigest(env, row, weekKey, local);
    } catch (e) {
      // Leave last_digest_week alone so the next hourly run retries.
      console.error(`digest failed for ${row.id}`, e);
    }
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function page(title: string, message: string, button?: string): Response {
  // A bare form posts back to the same URL, token and all.
  const form = button ? `<form method="post"><button type="submit">${button}</button></form>` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · GardenWise</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#f6f1e7;color:#23302a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}main{max-width:420px;text-align:center}h1{font-size:24px;color:#2f4a3a}p{line-height:1.5}button{font:inherit;font-weight:600;background:#2f4a3a;color:#fff;border:0;border-radius:999px;padding:12px 28px;cursor:pointer}</style>
</head><body><main><h1>${title}</h1><p>${message}</p>${form}</main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
