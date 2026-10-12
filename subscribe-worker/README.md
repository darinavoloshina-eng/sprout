# gardenwise-subscribe

The GardenWise app's one small Cloudflare Worker. It does two things:

1. **Mailing list** (`POST /`): records every "Email updates" opt-in and
   opt-out from the app in our own `subscribers` table.
2. **The weekly garden email**: the app keeps a copy of the garden here
   (`/garden`) while "Weekly garden email" is on in Settings. Every hour, a
   cron sends the digest to each confirmed garden where it's Sunday
   evening locally. The week's jobs come from the app's own engines
   (`../src/engines`, imported directly), so the email always matches the
   app. See `src/reminders.ts` for the details.

**Email sending starts switched off** (`EMAIL_SENDING_ENABLED = "false"`
in `wrangler.toml`). In that mode everything is collected and kept, but
nothing is emailed and Loops is never contacted, so it all runs on
Cloudflare's free plan with no email account at all. See
"Turning email on" below for when you're ready.

## One-time setup (free, no email account needed)

1. **Log in to Cloudflare** (creates a free account on first login if you
   don't already have one — no credit card required):
   ```
   cd subscribe-worker
   npm install
   npx wrangler login
   ```

2. **Create the database:**
   ```
   npx wrangler d1 create gardenwise
   ```
   Paste the `database_id` it prints into `wrangler.toml`, then create the
   tables:
   ```
   npm run migrate
   ```

3. **Deploy:**
   ```
   npx wrangler deploy
   ```
   This prints a URL like
   `https://gardenwise-subscribe.<your-subdomain>.workers.dev`.

4. **Point the app at it:** paste that URL into `WORKER_URL` in
   `src/api/subscribe.ts` *and* into `WORKER_URL` in `wrangler.toml`
   (the email links are built from it), run `npx wrangler deploy` again,
   then include it in the next TestFlight build.

## Seeing who has signed up

In the Cloudflare dashboard: Storage & Databases → D1 → `gardenwise` →
the `subscribers` and `gardens` tables. Or from this folder:

```
# Mailing list (opted_in: 1 = yes, 0 = opted out)
npx wrangler d1 execute gardenwise --remote --command "SELECT email, opted_in, created_at FROM subscribers ORDER BY created_at"

# Weekly garden email sign-ups
npx wrangler d1 execute gardenwise --remote --command "SELECT email, timezone, created_at FROM gardens WHERE unsubscribed_at IS NULL"
```

Add `--json` to either for output you can paste into a spreadsheet.

## Turning email on

When you have a sending account:

1. **Create a Loops account** at [loops.so](https://loops.so), set up your
   sending domain, and copy your API key from Settings → API. Store it as
   a secret (Wrangler prompts you to paste it; it's never written to a
   file):
   ```
   npx wrangler secret put LOOPS_API_KEY
   ```

2. **Import the existing mailing list.** Export the people who opted in
   while sending was off and upload the CSV in Loops (Audience → Import):
   ```
   npx wrangler d1 execute gardenwise --remote --json --command "SELECT email FROM subscribers WHERE opted_in = 1"
   ```
   New opt-ins and opt-outs after this go to Loops automatically.

3. **Create the two emails in Loops** (Transactional → New). Each one's
   "API" tab shows its transactional ID; paste them into `wrangler.toml`
   under `[vars]`.
   - **Confirm**: one data variable, `confirmUrl`. Suggested copy:
     "Tap below to get a short email every Sunday evening with your
     garden's jobs for the week." with a button linking to `{confirmUrl}`.
   - **Weekly digest**: data variables `weekOf` (e.g. "Oct 18"), `jobs`
     (one line per day, e.g. "Tuesday: Fertilize Tomatoes"), `watering`
     (may be empty), and `unsubscribeUrl`. Put an unsubscribe link to
     `{unsubscribeUrl}` in the footer. Send yourself a test from Loops
     to check the line breaks in `jobs` come through.

4. **Flip the switch:** set `EMAIL_SENDING_ENABLED = "true"` in
   `wrangler.toml` and `npx wrangler deploy`. Within the hour, everyone
   who signed up for the weekly email gets a confirmation email (200 an
   hour, so a big backlog spreads over a few hours), and the Sunday
   digest starts for whoever confirms. No app update is needed.

## Redeploying after an edit

```
cd subscribe-worker
npx wrangler deploy
```

## Checking it locally

```
npx wrangler d1 migrations apply gardenwise --local
npx wrangler dev --test-scheduled --var WORKER_URL:http://localhost:8787
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"   # runs the hourly job once
npm run typecheck
```

## Known tradeoffs

The endpoint is unauthenticated beyond basic email-format validation —
anyone who finds the URL could POST arbitrary addresses into the list.
For a small app this is a low-value target, but if it ever becomes a
problem, add a Cloudflare Turnstile check or a shared-secret header
before accepting a submission.

The same goes for `POST /garden`, but the damage is capped: an
unconfirmed address only ever gets the one confirmation email, at most
once a day, and is deleted after 14 days if nobody confirms.
