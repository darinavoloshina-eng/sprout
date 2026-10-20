// index.ts
// The GardenWise app's one small server. Two jobs:
//
//  1. POST /  — the mailing list. Every opt-in and opt-out is recorded in
//     the subscribers table here, our own copy of the list. When sending
//     is enabled it's also forwarded to Loops — the app can't call Loops
//     directly, since that would mean shipping the Loops API key inside
//     the app bundle.
//  2. The weekly reminder email — /garden, /confirm, /unsubscribe, and
//     the hourly cron. See reminders.ts.

import {
  Env,
  corsHeaders,
  handleDeleteGarden,
  handleEmailLink,
  handleSyncGarden,
  json,
  runScheduled,
  sendingEnabled,
} from './reminders';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let body: { email?: unknown; optIn?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Invalid email' }, 400);
  }
  // Older app builds only ever call this to opt in, without the field.
  const optIn = body.optIn !== false;
  // Where the signup came from: the app, or the landing page's launch
  // waitlist (docs/index.html). Anything else is treated as the app.
  const source = body.source === 'website' ? 'gardenwise-website' : 'gardenwise-app';

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO subscribers (email, opted_in, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET opted_in = excluded.opted_in, updated_at = excluded.updated_at`
  )
    .bind(email, optIn ? 1 : 0, source, now, now)
    .run();

  if (!sendingEnabled(env)) return json({ ok: true });

  // Loops treats create as an upsert, so re-sending an address that's
  // already there just updates it.
  const loopsRes = await fetch(`https://app.loops.so/api/v1/contacts/${optIn ? 'create' : 'update'}`, {
    method: optIn ? 'POST' : 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LOOPS_API_KEY}`,
    },
    body: JSON.stringify(optIn ? { email, source } : { email, subscribed: false }),
  });

  if (!loopsRes.ok) {
    const text = await loopsRes.text().catch(() => '');
    return json({ ok: false, error: `Loops error: ${text.slice(0, 200)}` }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (url.pathname === '/confirm' || url.pathname === '/unsubscribe') {
      return handleEmailLink(request, url, env);
    }
    if (url.pathname === '/garden') {
      if (request.method === 'POST') return handleSyncGarden(request, env);
      if (request.method === 'DELETE') return handleDeleteGarden(request, env);
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }
    if (url.pathname === '/' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }
    return json({ ok: false, error: 'Not found' }, 404);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env));
  },
};
