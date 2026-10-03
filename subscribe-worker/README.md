# gardenwise-subscribe

A one-endpoint Cloudflare Worker that takes an email from the GardenWise
app and adds it to our Loops mailing list. It exists only so the real
Loops API key never has to ship inside the app bundle.

## One-time setup

1. **Create a Loops account** at [loops.so](https://loops.so) (free tier
   covers up to 1,000 contacts). In Settings → API, copy your API key.

2. **Install Wrangler** (Cloudflare's CLI) if you don't have it:
   ```
   npm install -g wrangler
   ```

3. **Log in to Cloudflare** (creates a free account on first login if you
   don't already have one — no credit card required):
   ```
   cd subscribe-worker
   npx wrangler login
   ```

4. **Store the Loops API key as a secret** (Wrangler will prompt you to
   paste it — it's never written to a file or committed):
   ```
   npx wrangler secret put LOOPS_API_KEY
   ```

5. **Deploy:**
   ```
   npx wrangler deploy
   ```
   This prints a URL like
   `https://gardenwise-subscribe.<your-subdomain>.workers.dev`.

6. **Point the app at it:** paste that URL into `SUBSCRIBE_ENDPOINT` in
   `src/api/subscribe.ts`, then commit and include it in the next
   TestFlight build.

## Redeploying after an edit

```
cd subscribe-worker
npx wrangler deploy
```

## Known tradeoff

The endpoint is unauthenticated beyond basic email-format validation —
anyone who finds the URL could POST arbitrary addresses into the list.
For a small app this is a low-value target, but if it ever becomes a
problem, add a Cloudflare Turnstile check or a shared-secret header
before accepting a submission.
