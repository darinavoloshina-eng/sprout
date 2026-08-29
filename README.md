# Sprout

A watering-schedule and plant-triage app for raised-bed gardeners. React Native
+ Expo, iOS-first. All logic runs on the device; there is no backend.

## Structure

```
sprout/
├─ index.js                     entry point
├─ App.tsx                      screen switching + profile load
├─ app.json                     Expo config, iOS permission strings
├─ package.json                 pinned to Expo SDK 57 (versions verified to resolve)
├─ tsconfig.json                strict mode on
└─ src/
   ├─ theme.ts                  colors/spacing/radii from the HTML mockup
   ├─ types.ts                  GardenProfile and friends
   ├─ api/
   │  ├─ weather.ts             Open-Meteo forecast + geocoding, called directly
   │  └─ storage.ts             AsyncStorage persistence
   ├─ engines/
   │  ├─ scheduleEngine.ts      watering math (pure)
   │  ├─ alertsEngine.ts        growth-stage + weather alerts (pure)
   │  └─ triageEngine.ts        "why is my plant doing this" tree (pure)
   ├─ hooks/
   │  └─ useLiveWeather.ts      refetches weather, keeps the schedule live
   ├─ components/
   │  └─ ui.tsx                 Chip / Pill / OptionRow / PrimaryButton
   └─ screens/
      ├─ OnboardingScreen.tsx
      ├─ HomeScreen.tsx
      └─ TriageScreen.tsx
```

## Running it

```bash
npm install
npx expo start        # then press "i" for the iOS Simulator
```

`npm run typecheck` runs `tsc --noEmit`. It currently passes clean.

If `npm install` ever fights you after an SDK bump, `npx expo install --fix`
realigns every package to the installed SDK, and `npm run doctor` reports what
is still mismatched.

## What changed from the previous scaffold

**The backend is gone.** `server/` and `src/api/client.ts` were deleted. The old
server proxied Open-Meteo and a reverse-geocode endpoint — neither needs an API
key, so the proxy added a service to deploy and keep alive in exchange for
nothing. It also stored profiles in an in-memory `Map` keyed by an unauthenticated
random `userId`, which anyone could guess and overwrite. The phone now calls the
public APIs directly and saves to `AsyncStorage`.

The practical consequence: no data leaves the device, so App Privacy can be
declared **Data Not Collected** and no privacy-policy URL is required.

**The schedule is live again.** Previously `computeSchedule` ran once during
onboarding and the result was frozen onto the profile, so the app's central
promise — that watering adjusts to weather — never actually happened after day
one. `ScheduleResult` is no longer stored anywhere. `useLiveWeather` refetches
on launch and on foreground when the snapshot is over three hours old, writes
the new snapshot to the profile, and `HomeScreen` recomputes from it. Pull to
refresh forces it. A failed fetch keeps the last known schedule on screen
instead of blanking it.

**Bed size and drip settings are collected again.** The scaffold hardcoded
4 × 8 ft, 12" lines, 6" emitters, 0.5 GPH for every user, which meant the
engine's math was running on someone else's garden. Onboarding now asks, matching
the mockup's options.

**Location denial is a supported path.** `geocodeSearch` existed but nothing
called it, so denying the permission left the user at a disabled button. There
is now a city-name search fallback, offered both up front and automatically when
permission is refused. App Review tests this specific path.

**Smaller fixes:** `(profile as any).weather` / `.result` replaced with a real
typed `GardenProfile`; notification scheduling uses the current
`SchedulableTriggerInputTypes.DATE` trigger API; removing a reminder now cancels
the OS notification instead of leaving it to fire anyway; "Edit my garden"
prefills from the saved profile instead of starting blank; colors moved out of
three separate StyleSheets into `theme.ts`.

## Still to do

1. **Tests.** The three engine files are pure functions with no imports beyond
   each other — the cheapest tests you will ever write. `npx expo install -- --dev jest-expo jest`
   and start with `computeSchedule`: a 4×8 bed, full sun, tomatoes, drip at
   12"/6"/0.5 GPH should give a stable minutes figure, and recent rain should
   reduce it.
2. **The onboarding flow is one long scroll.** The mockup was five paced steps
   with a growth-progress indicator. Functionally equivalent, noticeably less
   charming. Worth restoring before launch.
3. **App icon, splash screen, screenshots.** None are included.
4. **Watering reminders themselves.** Right now only the stage alerts can be
   scheduled. The recurring "water today" notification the mockup promised isn't
   wired up — see `nextWateringDate()` in `scheduleEngine.ts`, which exists for
   this.
5. **Consider iCloud key-value sync.** Cheap insurance against a user losing
   their garden when they change phones, and it needs no server.

## Path to the App Store

1. Iterate on your Mac. [Claude Code](https://claude.com/product/claude-code) can
   run `npx expo start`, read real simulator errors, and fix them in place.
2. Apple Developer account, $99/year, at developer.apple.com. Start early —
   verification can take days.
3. `eas build --platform ios` handles code signing without touching Xcode's
   signing UI.
4. `eas submit --platform ios`.
5. Review is usually 24–48 hours. Expect one rejection round on a first
   submission; the usual causes are permission-string wording and missing
   screenshots, both of which are cheap to fix.

## A note on the advice content

`alertsEngine.ts` and `triageEngine.ts` give horticultural guidance. It is
general and low-stakes, but it is stated confidently. Before launch, have a
gardener you trust read both tables, and consider a line in the UI making clear
these are suggestions rather than a diagnosis.
