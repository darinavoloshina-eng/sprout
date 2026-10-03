// index.js
// Tiny bridge between the GardenWise app and our Loops mailing list.
// The app can't call Loops directly: that would mean shipping the Loops
// API key inside the app bundle, where anyone can pull it out and use it
// to add or read contacts in our list. This Worker holds that key as a
// server-side secret instead and exposes one narrow endpoint that only
// does one thing: take an email, forward it to Loops.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: 'Invalid email' }, 400);
    }

    // Loops treats this as an upsert — calling it again for an email
    // that's already subscribed just updates that contact, so the app
    // doesn't need to track whether it already sent this one.
    const loopsRes = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({ email, source: 'gardenwise-app' }),
    });

    if (!loopsRes.ok) {
      const text = await loopsRes.text().catch(() => '');
      return json({ ok: false, error: `Loops error: ${text.slice(0, 200)}` }, 502);
    }

    return json({ ok: true });
  },
};
