// subscribe.ts
// Bridges the app to our mailing list: this sends an opt-in or opt-out to
// a tiny Cloudflare Worker (see /subscribe-worker at the repo root), which
// records it in our own list and, once email sending is turned on there,
// forwards it to Loops — so no secret API key ever ships in the client. Best-effort — the email is
// already saved locally regardless of whether this succeeds, so a failed
// request here never blocks or interrupts anything the user is doing.

// TODO: replace with the real Worker URL once it's deployed — see
// subscribe-worker/README.md. Also used by gardenSync.ts, which talks to
// the same Worker.
export const WORKER_URL = 'https://gardenwise-subscribe.darinavoloshina.workers.dev';

export async function recordEmailOptIn(email: string, optIn: boolean): Promise<void> {
  try {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, optIn }),
    });
  } catch {
    // Best-effort — see header comment.
  }
}
