// subscribe.ts
// Bridges the app to our mailing list without putting a secret API key in
// the client: this just forwards an email to a tiny Cloudflare Worker (see
// /subscribe-worker at the repo root), which holds the real Loops API key
// server-side and does the actual list signup. Best-effort — the email is
// already saved locally regardless of whether this succeeds, so a failed
// request here never blocks or interrupts anything the user is doing.

// TODO: replace with the real Worker URL once it's deployed — see
// subscribe-worker/README.md.
const SUBSCRIBE_ENDPOINT = 'https://gardenwise-subscribe.YOUR-SUBDOMAIN.workers.dev';

export async function subscribeEmail(email: string): Promise<void> {
  try {
    await fetch(SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {
    // Best-effort — see header comment.
  }
}
